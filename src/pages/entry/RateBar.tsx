import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CurrencyLabel } from '@/components/CurrencyLabel'
import { CURRENCIES, CURRENCY_CODES, type Currency } from '@/data/currencies'
import { pairRate, type RatesResult } from '@/data/rates'
import type { RateTable } from '@/data/types'
import { fmt, useI18n } from '@/i18n'
import { formatRate } from '@/lib/format'

/** 由“1 单位各币种 = 多少 base”反推以 CNY 为基准的汇率表 */
function ratesFromPairs(pairs: Record<Currency, number>, anchor: number): RateTable {
  const raw = {} as RateTable
  for (const c of CURRENCY_CODES) raw[c] = anchor / pairs[c]
  const cny = raw.CNY
  const out = {} as RateTable
  for (const c of CURRENCY_CODES) out[c] = raw[c] / cny
  return out
}

export function RateEditorDialog({
  rates,
  base,
  onApply,
  onClose,
}: {
  rates: RateTable | null
  base: Currency
  onApply: (rates: RateTable) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const others = CURRENCY_CODES.filter((c) => c !== base)
  const initial = (c: Currency) => (rates ? formatRate(pairRate(c, base, rates)) : '')
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(others.map((c) => [c, initial(c)])),
  )
  const [error, setError] = useState(false)

  function apply() {
    const pairs = { [base]: 1 } as Record<Currency, number>
    for (const c of others) {
      const changed = values[c] !== initial(c)
      // 没改的币种沿用原始精度的汇率，避免显示时的四舍五入带来误差
      const v = changed || !rates ? parseFloat(values[c]) : pairRate(c, base, rates)
      if (!Number.isFinite(v) || v <= 0) return setError(true)
      pairs[c] = v
    }
    onApply(ratesFromPairs(pairs, rates ? rates[base] : 1))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.entry.rate.editorTitle}</DialogTitle>
          <DialogDescription>{fmt(t.entry.rate.editorHint, { base: CURRENCIES[base].label })}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {others.map((c) => (
            <li key={c} className="flex items-center gap-3">
              <span className="w-24 text-sm">
                1 <CurrencyLabel currency={c} />
              </span>
              <span className="text-muted-foreground">=</span>
              <Input
                inputMode="decimal"
                className="flex-1 text-right"
                value={values[c]}
                onChange={(e) => {
                  setValues({ ...values, [c]: e.target.value.replace(/[^0-9.]/g, '') })
                  setError(false)
                }}
              />
              <span className="w-10 text-sm text-muted-foreground">{CURRENCIES[base].label}</span>
            </li>
          ))}
        </ul>
        {error && <p className="text-xs text-destructive">{t.entry.rate.invalid}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={apply}>{t.entry.rate.apply}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 录入页的汇率状态条：显示当前使用的汇率来源，可查看/手动修改；获取失败时给出处理选项 */
export function RateBar({
  loading,
  result,
  useFallback,
  manual,
  rates,
  base,
  onUseFallback,
  onRetry,
  onManual,
  onResetManual,
  manualLabel,
  resetLabel,
}: {
  loading: boolean
  result: RatesResult | null
  useFallback: boolean
  manual: RateTable | null
  rates: RateTable | null
  base: Currency
  onUseFallback: () => void
  onRetry: () => void
  onManual: (rates: RateTable) => void
  onResetManual: () => void
  /** 覆盖“已手动修改”的提示文字，如编辑流水时显示“已保存的汇率” */
  manualLabel?: string
  resetLabel?: string
}) {
  const { t } = useI18n()
  const r = t.entry.rate
  const [editing, setEditing] = useState(false)
  const failed = result && !result.ok && !useFallback && !manual

  let status = ''
  if (manual) status = manualLabel ?? r.manual
  else if (result?.ok) {
    status = `${fmt(r.effective, { date: result.effectiveDate })} · ${result.source === 'network' ? r.network : r.cache}`
  } else if (useFallback && result && !result.ok && result.fallback) {
    status = fmt(r.fallback, { date: result.fallback.effectiveDate })
  } else if (loading) status = r.loading

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">
          {r.label} · {status}
        </span>
        <span className="flex shrink-0 gap-1">
          {manual && (
            <Button size="sm" variant="ghost" onClick={onResetManual}>
              {resetLabel ?? r.reset}
            </Button>
          )}
          {rates && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              {r.edit}
            </Button>
          )}
        </span>
      </div>

      {failed && result && !result.ok && (
        <div className="space-y-2">
          <p className="text-destructive">{t.rates.errors[result.reason]}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onRetry}>
              {r.retry}
            </Button>
            {result.fallback && (
              <Button size="sm" variant="outline" onClick={onUseFallback}>
                {fmt(r.useCached, { date: result.fallback.effectiveDate })}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              {r.manualInput}
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <RateEditorDialog
          rates={rates}
          base={base}
          onApply={onManual}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
