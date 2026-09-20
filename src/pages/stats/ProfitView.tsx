import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CurrencyLabel } from '@/components/CurrencyLabel'
import { CURRENCIES } from '@/data/currencies'
import { useCapitalFlows, useSnapshots } from '@/data/hooks'
import { fmt, useI18n } from '@/i18n'
import { computePeriod } from '@/lib/period'
import type { Range } from '@/lib/range'
import { useSettings } from '@/settings'
import { ProfitCard } from './ProfitCard'

export function ProfitView({ range, onGoEntry }: { range: Range; onGoEntry: () => void }) {
  const { t } = useI18n()
  const { baseCurrency } = useSettings()
  const snapshots = useSnapshots()
  const flows = useCapitalFlows()

  const result = useMemo(
    () => (snapshots ? computePeriod(snapshots, flows, range.start, range.end, baseCurrency) : null),
    [snapshots, flows, range.start, range.end, baseCurrency],
  )

  if (!snapshots) return null

  return (
    <div className="space-y-3 pb-4">
      {snapshots.length === 0 || result?.kind === 'no-data' ? (
        <Card>
          <CardContent className="space-y-2 py-8 text-center">
            <p className="font-medium">{t.stats.noData}</p>
            <p className="text-sm text-muted-foreground">{t.stats.noDataHint}</p>
            <Button onClick={onGoEntry}>{t.common.goEntry}</Button>
          </CardContent>
        </Card>
      ) : result?.kind === 'no-new' ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {fmt(t.stats.noNew, { date: result.date })}
          </CardContent>
        </Card>
      ) : result?.kind === 'ok' ? (
        <>
          <div className="space-y-1 px-1 text-xs text-muted-foreground">
            {!range.isAll && <p>{fmt(t.stats.selected, { start: range.start, end: range.end })}</p>}
            <p>
              {t.stats.range}
              {fmt(t.stats.rangeText, { start: result.startDate, end: result.endDate, n: String(result.days) })}
            </p>
            {result.openingVirtual && <p>{fmt(t.stats.virtualOpening, { start: result.startDate })}</p>}
          </div>

          <ProfitCard
            emphasize
            title={fmt(t.stats.convertedTitle, { cur: CURRENCIES[baseCurrency].label })}
            m={result.converted}
          />

          <h2 className="px-1 pt-1 text-sm font-semibold">{t.stats.perCurrency}</h2>
          {result.perCurrency.map((m) => (
            <ProfitCard key={m.currency} title={<CurrencyLabel currency={m.currency} />} m={m} />
          ))}

          <p className="px-1 text-xs text-muted-foreground">{t.stats.rateNote}</p>
          <p className="px-1 text-xs text-muted-foreground">{t.stats.fxNote}</p>
        </>
      ) : null}
    </div>
  )
}
