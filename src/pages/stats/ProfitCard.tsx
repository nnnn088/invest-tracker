import { Card, CardContent } from '@/components/ui/card'
import { CURRENCIES, formatAmount } from '@/data/currencies'
import { useI18n } from '@/i18n'
import { formatPercent, formatSigned, trendClass } from '@/lib/format'
import type { PeriodMetrics } from '@/lib/period'
import { cn } from '@/lib/utils'

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm tabular-nums">{value}</dd>
    </div>
  )
}

/** 一个币种（或折算合计）的时段收益卡片：净收益与收益率、期初/期末资产、本金；可附累计口径 */
export function ProfitCard({
  title,
  m,
  emphasize,
}: {
  title: React.ReactNode
  m: PeriodMetrics
  emphasize?: boolean
}) {
  const { t } = useI18n()
  const c = m.currency
  const money = (n: number) => formatAmount(n, c, true)
  const rateText = (r: number | null) => (r === null ? '—' : formatPercent(r))

  return (
    <Card className={cn(emphasize && 'border-primary/40')}>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-right">
            <div className={cn('text-xl font-semibold tabular-nums', trendClass(m.profit))}>
              {formatSigned(m.profit, c, true)}
            </div>
            <div className={cn('text-sm tabular-nums', m.rate === null ? 'text-flat' : trendClass(m.rate))}>
              {t.stats.rate} {rateText(m.rate)}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          <Cell label={t.stats.opening} value={money(m.opening)} />
          <Cell label={t.stats.closing} value={money(m.closing)} />
          <Cell label={t.stats.netCapital} value={formatSigned(m.netCapital, c, true)} />
          <Cell label={t.stats.avgCapital} value={money(m.avgCapital)} />
        </dl>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-3">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{t.stats.cumProfit}</dt>
            <dd className={cn('text-sm tabular-nums', trendClass(m.cumProfit))}>
              <span className="block truncate">{formatSigned(m.cumProfit, c, true)}</span>
              <span className="block text-xs">{rateText(m.cumRate)}</span>
            </dd>
          </div>
          <Cell label={t.stats.cumCapital} value={money(m.cumCapital)} />
        </dl>
        <span className="sr-only">{CURRENCIES[c].label}</span>
      </CardContent>
    </Card>
  )
}
