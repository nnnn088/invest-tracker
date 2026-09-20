import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyLabel } from '@/components/CurrencyLabel'
import { CURRENCIES, CURRENCY_CODES, formatAmount, type Currency } from '@/data/currencies'
import { useI18n } from '@/i18n'
import { formatPercent, formatSigned, trendClass } from '@/lib/format'
import type { CurrencyMap, ProfitRow } from '@/lib/stats'
import { cn } from '@/lib/utils'

/** 固定在底部导航上方：只常驻折算总资产和保存按钮，保持简短，输入时不遮挡内容 */
export function TotalBar({
  base,
  convertedTotal,
  canSave,
  saving,
  saved,
  onSave,
}: {
  base: Currency
  convertedTotal: number | null
  canSave: boolean
  saving: boolean
  saved: boolean
  onSave: () => void
}) {
  const { t } = useI18n()
  return (
    <div
      className="fixed inset-x-0 z-30 border-t bg-card shadow-[0_-4px_12px_rgb(0_0_0/0.06)]"
      style={{ bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">
            {t.entry.totalAssets} · {CURRENCIES[base].label}
          </span>
          <span className="block truncate text-lg font-semibold tabular-nums">
            {convertedTotal === null ? '—' : formatAmount(convertedTotal, base, true)}
          </span>
        </div>
        <Button disabled={!canSave || saving} onClick={onSave} className="shrink-0">
          {saving ? t.entry.saving : saved ? t.entry.saved : t.entry.save}
        </Button>
      </div>
    </div>
  )
}

function ProfitLine({ row, label }: { row: ProfitRow; label: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span>{label}</span>
      <span className={cn('text-right tabular-nums', trendClass(row.profit))}>
        {formatSigned(row.profit, row.currency)}
        <span className="ml-2 text-xs">{row.rate === null ? '—' : formatPercent(row.rate)}</span>
      </span>
    </li>
  )
}

/** 页面内的统计详情：各币种资产合计（原币）、折算总额、各币种及折算后的累计收益与收益率 */
export function StatsDetails({
  base,
  totals,
  convertedTotal,
  perCurrencyProfit,
  convertedProfit,
  hasCapital,
  hasCarried,
}: {
  base: Currency
  totals: CurrencyMap
  convertedTotal: number | null
  perCurrencyProfit: ProfitRow[]
  convertedProfit: ProfitRow | null
  hasCapital: boolean
  hasCarried: boolean
}) {
  const { t } = useI18n()
  const totalCurrencies = CURRENCY_CODES.filter((c) => totals[c] !== undefined)
  const convertedLabel = `${t.entry.convertedTotal} · ${CURRENCIES[base].label}`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.entry.currencyTotals}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <ul className="divide-y">
            {totalCurrencies.map((c) => (
              <li key={c} className="flex items-center justify-between py-1.5 text-sm">
                <CurrencyLabel currency={c} />
                <span className="tabular-nums">{formatAmount(totals[c] ?? 0, c, true)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between py-1.5 text-sm font-medium">
              <span>{convertedLabel}</span>
              <span className="tabular-nums">
                {convertedTotal === null ? '—' : formatAmount(convertedTotal, base, true)}
              </span>
            </li>
          </ul>
          {hasCarried && <p className="mt-1 text-xs text-muted-foreground">{t.entry.carried}</p>}
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold">{t.entry.profitSection}</h3>
          {hasCapital ? (
            <>
              <ul className="divide-y">
                {perCurrencyProfit.map((row) => (
                  <ProfitLine key={row.currency} row={row} label={<CurrencyLabel currency={row.currency} />} />
                ))}
                {convertedProfit && (
                  <ProfitLine row={convertedProfit} label={<span className="font-medium">{convertedLabel}</span>} />
                )}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">{t.entry.rateNote}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t.entry.noCapital}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
