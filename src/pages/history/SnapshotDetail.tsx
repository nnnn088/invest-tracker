import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CurrencyLabel } from '@/components/CurrencyLabel'
import { PlatformBadge } from '@/components/PlatformBadge'
import { CURRENCIES, CURRENCY_CODES, formatAmount } from '@/data/currencies'
import { useEntries, usePlatforms, useSnapshot } from '@/data/hooks'
import { convert, pairRate } from '@/data/rates'
import { deleteSnapshot, saveSnapshot } from '@/data/repo'
import type { RateTable, Snapshot } from '@/data/types'
import { fmt, useI18n } from '@/i18n'
import { parseAmount, sanitizeAmount } from '@/lib/amount'
import { formatRate } from '@/lib/format'
import { convertTotals, sumByCurrency } from '@/lib/stats'
import { useSettings } from '@/settings'
import { RateEditorDialog } from '@/pages/entry/RateBar'

/** 快照详情：查看各条目金额、当时汇率、各币种合计与占比；可编辑金额/汇率、删除 */
export function SnapshotDetail({ date, onBack }: { date: string; onBack: () => void }) {
  const snapshot = useSnapshot(date)
  // 已被删除（或不存在）时回到列表
  useEffect(() => {
    if (snapshot === null) onBack()
  }, [snapshot, onBack])
  if (!snapshot) return null
  return <Detail snapshot={snapshot} onBack={onBack} />
}

function Detail({ snapshot, onBack }: { snapshot: Snapshot; onBack: () => void }) {
  const { t } = useI18n()
  const { baseCurrency } = useSettings()
  const platforms = usePlatforms()
  const entries = useEntries()

  const [editing, setEditing] = useState(false)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [editedRates, setEditedRates] = useState<RateTable | null>(null)
  const [editingRates, setEditingRates] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const rates = editedRates ?? snapshot.rates
  const amountOf = (entryId: string, original: number) =>
    editing && amounts[entryId] !== undefined ? parseAmount(amounts[entryId]) : original

  const rows = useMemo(
    () =>
      snapshot.items.map((i) => {
        const entry = entries.find((e) => e.id === i.entryId)
        return { item: i, entry, platform: platforms.find((p) => p.id === entry?.platformId) }
      }),
    [snapshot.items, entries, platforms],
  )

  // 编辑中实时重新计算：合计与占比都按当前（可能已修改的）金额与汇率
  const totals = sumByCurrency(
    rows.flatMap(({ item, entry }) =>
      entry ? [{ currency: entry.currency, amount: amountOf(item.entryId, item.amount) }] : [],
    ),
  )
  const convertedTotal = convertTotals(totals, baseCurrency, rates)
  const currencies = CURRENCY_CODES.filter((c) => totals[c] !== undefined)

  function startEdit() {
    setAmounts(Object.fromEntries(snapshot.items.map((i) => [i.entryId, String(i.amount)])))
    setEditedRates(null)
    setEditing(true)
  }

  async function saveEdit() {
    const items = snapshot.items.map((i) => ({ entryId: i.entryId, amount: amountOf(i.entryId, i.amount) }))
    await saveSnapshot({
      ...snapshot,
      items,
      rates,
      currencyTotals: totals,
      baseCurrency,
      convertedTotal,
      updatedAt: Date.now(),
    })
    setEditing(false)
  }

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={editing ? () => setEditing(false) : onBack}>
          <ArrowLeft /> {editing ? t.common.cancel : t.history.back}
        </Button>
        <span className="flex-1 text-center font-medium tabular-nums">{snapshot.date}</span>
        {editing ? (
          <Button size="sm" onClick={saveEdit}>
            {t.history.saveChanges}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil /> {t.history.edit}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="py-1">
          <p className="text-xs text-muted-foreground">
            {t.history.total} · {CURRENCIES[baseCurrency].label}
          </p>
          <p className="text-2xl font-semibold tabular-nums">{formatAmount(convertedTotal, baseCurrency, true)}</p>
          {editing && <p className="mt-1 text-xs text-muted-foreground">{t.history.editHint}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.history.entries}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {rows.map(({ item, entry, platform }) => (
              <li key={item.entryId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                {platform && <PlatformBadge platform={platform} />}
                <div className="min-w-0 flex-1 basis-16">
                  <div className="truncate text-sm font-medium">
                    {platform?.name}
                    {(entry?.archived || platform?.archived) && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        {t.history.archivedTag}
                      </span>
                    )}
                  </div>
                  {entry && (
                    <div className="truncate text-xs text-muted-foreground">
                      <CurrencyLabel currency={entry.currency} />
                    </div>
                  )}
                </div>
                {editing ? (
                  <Input
                    inputMode="decimal"
                    className="w-36 text-right tabular-nums max-[359px]:w-full"
                    value={amounts[item.entryId] ?? ''}
                    onChange={(e) => setAmounts({ ...amounts, [item.entryId]: sanitizeAmount(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                  />
                ) : (
                  entry && (
                    <div className="text-right">
                      <div className="text-sm tabular-nums">{formatAmount(item.amount, entry.currency, true)}</div>
                      {entry.currency !== baseCurrency && (
                        <div className="text-xs tabular-nums text-muted-foreground">
                          ≈ {formatAmount(convert(item.amount, entry.currency, baseCurrency, rates), baseCurrency, true)}
                        </div>
                      )}
                    </div>
                  )
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.history.currencyTotals}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {currencies.map((c) => {
              const inBase = convert(totals[c] ?? 0, c, baseCurrency, rates)
              const share = convertedTotal > 0 ? inBase / convertedTotal : 0
              return (
                <li key={c} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <CurrencyLabel currency={c} />
                    <span className="tabular-nums">{formatAmount(totals[c] ?? 0, c, true)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(0, share * 100))}%` }}
                      />
                    </div>
                    <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                      {(share * 100).toFixed(1)}%
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.history.rates}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {fmt(t.history.ratesHint, { base: CURRENCIES[baseCurrency].label })}
          </p>
          <ul className="divide-y">
            {CURRENCY_CODES.filter((c) => c !== baseCurrency).map((c) => (
              <li key={c} className="flex items-center justify-between py-1.5 text-sm">
                <span className="inline-flex items-center gap-2">
                  1 <CurrencyLabel currency={c} />
                </span>
                <span className="tabular-nums">
                  {formatRate(pairRate(c, baseCurrency, rates))} {CURRENCIES[baseCurrency].label}
                </span>
              </li>
            ))}
          </ul>
          {editing && (
            <Button variant="outline" size="sm" onClick={() => setEditingRates(true)}>
              {t.history.editRates}
            </Button>
          )}
        </CardContent>
      </Card>

      <p className="px-1 text-center text-xs text-muted-foreground">
        {fmt(t.history.savedAt, { time: format(new Date(snapshot.updatedAt), 'yyyy-MM-dd HH:mm') })}
      </p>

      {!editing && (
        <Button variant="outline" className="w-full text-destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 /> {t.history.deleteRecord}
        </Button>
      )}

      {editingRates && (
        <RateEditorDialog
          rates={rates}
          base={baseCurrency}
          onApply={setEditedRates}
          onClose={() => setEditingRates(false)}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={t.history.deleteTitle}
        description={fmt(t.history.deleteBody, { date: snapshot.date })}
        onConfirm={() => deleteSnapshot(snapshot.date)}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}
