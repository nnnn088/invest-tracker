import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CurrencyLabel } from '@/components/CurrencyLabel'
import { LineChart, type ChartSeries } from '@/components/LineChart'
import { CURRENCIES, CURRENCY_CODES, formatAmount, type Currency } from '@/data/currencies'
import { useCapitalFlows, useSnapshots } from '@/data/hooks'
import type { Snapshot } from '@/data/types'
import { useCssColors } from '@/hooks/useCssColors'
import { fmt, useI18n } from '@/i18n'
import { formatPercent, formatSigned, trendClass } from '@/lib/format'
import {
  axisLabel,
  convertedTotalOf,
  profitSeries,
  recordedCurrencies,
  timeSeries,
  type ProfitMode,
  type ProfitScope,
} from '@/lib/series'
import type { Range } from '@/lib/range'
import { convertedNetCapital } from '@/lib/stats'
import { cn } from '@/lib/utils'
import { useSettings } from '@/settings'
import { Chips } from './Chips'

type ChartType = 'total' | 'currency' | 'profit'

/** 图表下方：被点选的那次记录的详细数值 */
function RecordPanel({
  snapshot,
  pointDate,
  flows,
}: {
  snapshot: Snapshot
  /** 被点选的时间点；快照日期早于它时，说明这个时间点沿用了前面的记录 */
  pointDate: string
  flows: ReturnType<typeof useCapitalFlows>
}) {
  const { t } = useI18n()
  const { baseCurrency: base } = useSettings()
  const total = convertedTotalOf(snapshot, base)
  const hasFlows = flows.some((f) => f.date <= snapshot.date)
  const capital = convertedNetCapital(flows, snapshot.date, base)
  const profit = total - capital
  const currencies = CURRENCY_CODES.filter((c) => snapshot.currencyTotals[c] !== undefined)

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">{t.charts.record}</h3>
          <span className="text-sm tabular-nums text-muted-foreground">{pointDate}</span>
        </div>
        {snapshot.date !== pointDate && (
          <p className="-mt-2 text-xs text-muted-foreground">{fmt(t.charts.carriedFrom, { date: snapshot.date })}</p>
        )}
        <ul className="divide-y">
          {currencies.map((c) => (
            <li key={c} className="flex items-center justify-between py-1.5 text-sm">
              <CurrencyLabel currency={c} />
              <span className="tabular-nums">{formatAmount(snapshot.currencyTotals[c] ?? 0, c, true)}</span>
            </li>
          ))}
          <li className="flex items-center justify-between py-1.5 text-sm font-medium">
            <span>
              {t.charts.convertedTotal} · {CURRENCIES[base].label}
            </span>
            <span className="tabular-nums">{formatAmount(total, base, true)}</span>
          </li>
          <li className="flex items-center justify-between py-1.5 text-sm">
            <span>{t.charts.capitalLine}</span>
            <span className="tabular-nums">{hasFlows ? formatAmount(capital, base, true) : t.charts.noCapital}</span>
          </li>
          {hasFlows && (
            <li className="flex items-center justify-between py-1.5 text-sm">
              <span>{t.charts.cumProfit}</span>
              <span className={cn('tabular-nums', trendClass(profit))}>
                {formatSigned(profit, base, true)}
                <span className="ml-2 text-xs">{capital > 0 ? formatPercent(profit / capital) : '—'}</span>
              </span>
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}

export function ChartsView({ range, onGoEntry }: { range: Range; onGoEntry: () => void }) {
  const { t } = useI18n()
  const { baseCurrency: base } = useSettings()
  const snapshots = useSnapshots()
  const flows = useCapitalFlows()
  const colors = useCssColors(['primary', 'muted-foreground', 'up', 'down'] as const)

  const [type, setType] = useState<ChartType>('total')
  const [overlay, setOverlay] = useState(true)
  const [currencyPick, setCurrencyPick] = useState<Currency | null>(null)
  const [scopePick, setScopePick] = useState<ProfitScope>('converted')
  const [mode, setMode] = useState<ProfitMode>('cumulative')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const all = useMemo(() => snapshots ?? [], [snapshots])
  const recorded = useMemo(() => recordedCurrencies(all), [all])
  const currency: Currency | undefined = currencyPick && recorded.includes(currencyPick) ? currencyPick : recorded[0]
  const scope: ProfitScope = scopePick === 'converted' || recorded.includes(scopePick) ? scopePick : 'converted'

  // 固定最多 MAX_POINTS 个时间点，间隔由所选区间长度倒推；没有记录的日期沿用前一次记录
  const series = useMemo(() => timeSeries(all, range.start, range.end), [all, range.start, range.end])
  const points = useMemo(() => series?.points ?? [], [series])

  const profit = useMemo(
    () => (type === 'profit' && series ? profitSeries(series, all, flows, base, scope, mode) : []),
    [type, series, all, flows, base, scope, mode],
  )

  const chart = useMemo(() => {
    const multiYear = points.length > 0 && points[0].date.slice(0, 4) !== points[points.length - 1].date.slice(0, 4)
    const labels = series ? points.map((p) => axisLabel(p.date, multiYear)) : []
    const titles = points.map((p) => (p.snapshot.date === p.date ? p.date : `${p.date} · ${fmt(t.charts.carriedFrom, { date: p.snapshot.date })}`))
    const lines: ChartSeries[] = []
    let formatY = (v: number) => String(v)
    let formatY1: ((v: number) => string) | undefined

    if (type === 'total') {
      formatY = (v) => formatAmount(v, base, true)
      lines.push({ label: `${t.charts.totalLine} (${CURRENCIES[base].label})`, data: points.map((p) => convertedTotalOf(p.snapshot, base)), color: colors.primary })
      if (overlay) {
        lines.push({
          label: t.charts.capitalLine,
          data: points.map((p) => convertedNetCapital(flows, p.snapshot.date, base)),
          color: colors['muted-foreground'],
          dashed: true,
        })
      }
    } else if (type === 'currency' && currency) {
      formatY = (v) => formatAmount(v, currency, true)
      lines.push({ label: CURRENCIES[currency].label, data: points.map((p) => p.snapshot.currencyTotals[currency] ?? 0), color: colors.primary })
    } else if (type === 'profit') {
      const cur = scope === 'converted' ? base : scope
      formatY = (v) => formatSigned(v, cur, true)
      formatY1 = (v) => formatPercent(v)
      lines.push({
        label: t.charts.profitLine,
        data: profit.map((p) => p.profit),
        color: colors.primary,
        signColors: { up: colors.up, down: colors.down },
      })
      lines.push({ label: t.charts.rateLine, data: profit.map((p) => p.rate), color: colors['muted-foreground'], axis: 'y1', dashed: true })
    }
    return { labels, titles, series: lines, formatY, formatY1 }
  }, [points, series, type, overlay, currency, scope, profit, base, flows, colors, t])

  const selectedIndex = (() => {
    const i = points.findIndex((p) => p.date === selectedDate)
    return i >= 0 ? i : points.length - 1
  })()
  const selected = points[selectedIndex]

  if (!snapshots) return null

  return (
    <div className="space-y-3 pb-4">
      <Chips
        value={type}
        onChange={setType}
        options={[
          { value: 'total', label: t.charts.types.total },
          { value: 'currency', label: t.charts.types.currency },
          { value: 'profit', label: t.charts.types.profit },
        ]}
      />

      {type === 'currency' && recorded.length > 0 && currency && (
        <Chips
          value={currency}
          onChange={setCurrencyPick}
          options={recorded.map((c) => ({ value: c, label: <CurrencyLabel currency={c} /> }))}
        />
      )}

      {type === 'profit' && (
        <div className="space-y-2">
          <Chips
            value={scope}
            onChange={setScopePick}
            options={[
              { value: 'converted' as ProfitScope, label: `${t.charts.scopeConverted} · ${CURRENCIES[base].label}` },
              ...recorded.map((c) => ({ value: c as ProfitScope, label: <CurrencyLabel currency={c} /> })),
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t.charts.modeLabel}</span>
            <Chips
              value={mode}
              onChange={setMode}
              options={[
                { value: 'cumulative', label: t.charts.modeCumulative },
                { value: 'period', label: t.charts.modePeriod },
              ]}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t.charts.modeHint}</p>
        </div>
      )}

      {type === 'total' && (
        <Button size="sm" variant={overlay ? 'default' : 'outline'} aria-pressed={overlay} onClick={() => setOverlay(!overlay)}>
          {t.charts.overlayCapital}
        </Button>
      )}

      {series && (
        <p className="text-xs text-muted-foreground">
          {fmt(t.charts.stepHint, { step: String(series.step), count: String(points.length) })}
        </p>
      )}

      {points.length === 0 || (type === 'currency' && !currency) ? (
        <Card>
          <CardContent className="space-y-2 py-8 text-center">
            <p className="font-medium">{t.charts.empty}</p>
            <p className="text-sm text-muted-foreground">{t.charts.emptyHint}</p>
            {all.length === 0 && <Button onClick={onGoEntry}>{t.common.goEntry}</Button>}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent>
              <LineChart
                labels={chart.labels}
                tooltipTitles={chart.titles}
                series={chart.series}
                formatY={chart.formatY}
                formatY1={chart.formatY1}
                selected={selectedIndex}
                onSelect={(i) => setSelectedDate(points[i]?.date ?? null)}
              />
              <p className="mt-2 text-center text-xs text-muted-foreground">{t.charts.tapHint}</p>
            </CardContent>
          </Card>
          {selected && <RecordPanel snapshot={selected.snapshot} pointDate={selected.date} flows={flows} />}
        </>
      )}
    </div>
  )
}
