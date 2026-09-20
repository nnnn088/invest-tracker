import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CurrencyLabel } from '@/components/CurrencyLabel'
import { DateField } from '@/components/DateField'
import { PlatformBadge } from '@/components/PlatformBadge'
import { CURRENCY_CODES } from '@/data/currencies'
import { useCapitalFlows, useEntries, usePlatforms, useSnapshotForPrefill } from '@/data/hooks'
import { saveSnapshot } from '@/data/repo'
import type { RateTable, SnapshotItem } from '@/data/types'
import { useRates } from '@/hooks/useRates'
import { fmt, useI18n } from '@/i18n'
import { parseAmount, sanitizeAmount } from '@/lib/amount'
import {
  convertTotals,
  convertedNetCapital,
  makeProfitRow,
  netCapitalByCurrency,
  sumByCurrency,
} from '@/lib/stats'
import { useSettings } from '@/settings'
import { RateBar } from './entry/RateBar'
import { StatsDetails, TotalBar } from './entry/StatsBar'

const todayStr = () => format(new Date(), 'yyyy-MM-dd')

export function EntryPage({ onGoSettings }: { onGoSettings: () => void }) {
  const { t } = useI18n()
  const { baseCurrency } = useSettings()
  const platforms = usePlatforms()
  const entries = useEntries()
  const flows = useCapitalFlows()

  const [date, setDate] = useState(todayStr)
  const { result, loading, useFallback, setUseFallback, reload, rates: autoRates } = useRates(date)
  const [manual, setManual] = useState<RateTable | null>(null)
  const rates = manual ?? autoRates

  const prefill = useSnapshotForPrefill(date)
  // 用户改过的金额；没改过的条目显示预填值
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)

  useEffect(() => {
    if (!saved) return
    const id = setTimeout(() => setSaved(false), 2000)
    return () => clearTimeout(id)
  }, [saved])

  const platformOf = (id: string) => platforms.find((p) => p.id === id)
  const activeEntries = useMemo(
    () => entries.filter((e) => !e.archived && platforms.some((p) => p.id === e.platformId && !p.archived)),
    [entries, platforms],
  )

  const prefillAmounts = useMemo(
    () => new Map((prefill?.snapshot?.items ?? []).map((i) => [i.entryId, i.amount])),
    [prefill],
  )
  const existing = prefill?.exact ? prefill.snapshot : undefined

  const valueOf = (id: string): string => {
    if (amounts[id] !== undefined) return amounts[id]
    const p = prefillAmounts.get(id)
    return p === undefined ? '' : String(p)
  }

  // 已有快照里属于已归档条目的金额：覆盖保存时原样保留，并计入统计
  const carried: SnapshotItem[] = useMemo(() => {
    if (!existing) return []
    const active = new Set(activeEntries.map((e) => e.id))
    return existing.items.filter((i) => !active.has(i.entryId))
  }, [existing, activeEntries])

  const items: SnapshotItem[] = [
    ...activeEntries.map((e) => ({ entryId: e.id, amount: parseAmount(valueOf(e.id)) })),
    ...carried,
  ]

  // ---------- 实时统计 ----------
  const currencyOf = (entryId: string) => entries.find((e) => e.id === entryId)?.currency
  const totals = sumByCurrency(
    items.flatMap((i) => {
      const currency = currencyOf(i.entryId)
      return currency ? [{ currency, amount: i.amount }] : []
    }),
  )
  const convertedTotal = rates ? convertTotals(totals, baseCurrency, rates) : null

  const flowsUpTo = flows.filter((f) => f.date <= date)
  const hasCapital = flowsUpTo.length > 0
  const capitalByCurrency = netCapitalByCurrency(flows, date)
  // 资产和本金都为 0 的币种没有收益可言，不列出
  const profitRows = CURRENCY_CODES.map((c) => makeProfitRow(c, totals[c] ?? 0, capitalByCurrency[c] ?? 0)).filter(
    (row) => row.assets !== 0 || row.capital !== 0,
  )
  const convertedProfit =
    convertedTotal === null
      ? null
      : makeProfitRow(baseCurrency, convertedTotal, convertedNetCapital(flows, date, baseCurrency))

  // ---------- 保存 ----------
  async function doSave() {
    if (!rates || convertedTotal === null) return
    setSaving(true)
    const now = Date.now()
    await saveSnapshot({
      date,
      items,
      rates,
      currencyTotals: totals,
      baseCurrency,
      convertedTotal,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    setSaving(false)
    setSaved(true)
  }

  function changeDate(d: string) {
    setDate(d)
    setManual(null)
    setAmounts({})
    setSaved(false)
  }

  return (
    <div className="space-y-3 pb-24">
      <DateField value={date} onChange={changeDate} />

      <RateBar
        loading={loading}
        result={result}
        useFallback={useFallback}
        manual={manual}
        rates={rates}
        base={baseCurrency}
        onUseFallback={() => setUseFallback(true)}
        onRetry={reload}
        onManual={setManual}
        onResetManual={() => setManual(null)}
      />

      {existing && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {fmt(t.entry.overwriteBody, { date })}
        </p>
      )}

      {activeEntries.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="font-medium">{t.entry.empty}</p>
            <p className="text-sm text-muted-foreground">{t.entry.emptyHint}</p>
            <Button onClick={onGoSettings}>{t.entry.goSettings}</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y">
              {activeEntries.map((e) => {
                const p = platformOf(e.platformId)
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                    {p && <PlatformBadge platform={p} />}
                    <div className="min-w-0 flex-1 basis-16">
                      <div className="truncate text-sm font-medium">{p?.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        <CurrencyLabel currency={e.currency} />
                      </div>
                    </div>
                    <Input
                      inputMode="decimal"
                      placeholder="0"
                      aria-label={`${p?.name} ${e.currency}`}
                      className="w-36 text-right tabular-nums max-[359px]:w-full"
                      value={valueOf(e.id)}
                      onChange={(ev) => {
                        setAmounts({ ...amounts, [e.id]: sanitizeAmount(ev.target.value) })
                        setSaved(false)
                      }}
                      onFocus={(ev) => ev.target.select()}
                    />
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {activeEntries.length > 0 && (
        <StatsDetails
          base={baseCurrency}
          totals={totals}
          convertedTotal={convertedTotal}
          perCurrencyProfit={profitRows}
          convertedProfit={convertedProfit}
          hasCapital={hasCapital}
          hasCarried={carried.length > 0}
        />
      )}

      <TotalBar
        base={baseCurrency}
        convertedTotal={convertedTotal}
        canSave={!!rates && activeEntries.length > 0}
        saving={saving}
        saved={saved}
        onSave={() => (existing ? setConfirmOverwrite(true) : doSave())}
      />

      <ConfirmDialog
        open={confirmOverwrite}
        title={t.entry.overwriteTitle}
        description={fmt(t.entry.overwriteBody, { date })}
        onConfirm={doSave}
        onClose={() => setConfirmOverwrite(false)}
      />
    </div>
  )
}

