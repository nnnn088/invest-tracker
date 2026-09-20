import { forwardRef } from 'react'
import { PlatformBadge } from '@/components/PlatformBadge'
import { CURRENCIES, formatAmount } from '@/data/currencies'
import { fmt, useI18n } from '@/i18n'
import { formatPercent, formatSigned, trendClass } from '@/lib/format'
import type { ReportData } from '@/lib/report'
import { cn } from '@/lib/utils'
import { ReportChart } from './ReportChart'

export interface ReportOptions {
  total: boolean
  currencies: boolean
  profit: boolean
  perCurrency: boolean
  chart: boolean
  overlay: boolean
  platforms: boolean
  /** 隐藏金额：只显示收益率、占比和走势 */
  hide: boolean
}

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  total: true,
  currencies: true,
  profit: true,
  perCurrency: false,
  chart: true,
  overlay: false,
  platforms: false,
  hide: false,
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      {title && <h2 className="mb-3 text-sm font-semibold">{title}</h2>}
      {children}
    </section>
  )
}

function ShareBar({ share }: { share: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, share * 100))}%` }} />
      </div>
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{(share * 100).toFixed(1)}%</span>
    </div>
  )
}

/** 国旗 + 币种名，固定在一行（emoji 在渲染成图片时宽度不稳定，普通文本会被挤成两行） */
function Cur({ code }: { code: keyof typeof CURRENCIES }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{CURRENCIES[code].flag}</span>
      <span>{CURRENCIES[code].label}</span>
    </span>
  )
}

const rateText = (r: number | null) => (r === null ? '—' : formatPercent(r))
const rateClass = (r: number | null) => (r === null ? 'text-flat' : trendClass(r))

/**
 * 汇报长图的版面：固定 390 宽，固定浅色（.force-light），语言跟随设置。
 * 只负责展示，由 ShareDialog 渲染到屏幕外后转成 PNG。
 */
export const ShareReport = forwardRef<HTMLDivElement, { data: ReportData; opts: ReportOptions; generatedOn: string; onChartReady: () => void }>(
  function ShareReport({ data, opts, generatedOn, onChartReady }, ref) {
    const { t } = useI18n()
    const r = t.share.report
    const base = data.base
    const baseLabel = CURRENCIES[base].label
    const hide = opts.hide
    const p = data.period

    return (
      <div ref={ref} className="force-light space-y-3 bg-background p-5 text-foreground" style={{ width: 390 }}>
        <header className="space-y-1 pb-1">
          <h1 className="text-xl font-bold">{r.title}</h1>
          <p className="text-sm text-muted-foreground">{fmt(r.asOf, { date: data.asOf })}</p>
          {hide && <p className="text-xs text-muted-foreground">{r.hidden}</p>}
        </header>

        {opts.total && !hide && (
          <Card>
            <p className="text-xs text-muted-foreground">{fmt(r.total, { cur: baseLabel })}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{formatAmount(data.total, base, true)}</p>
          </Card>
        )}

        {opts.profit &&
          (p ? (
            <Card title={r.periodTitle}>
              <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                {fmt(r.periodRange, { start: p.startDate, end: p.endDate, n: String(p.days) })}
              </p>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{r.periodReturn}</p>
                  <p className={cn('text-3xl font-bold tabular-nums', rateClass(p.converted.rate))}>{rateText(p.converted.rate)}</p>
                </div>
                {!hide && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{r.netProfit}</p>
                    <p className={cn('text-lg font-semibold tabular-nums', trendClass(p.converted.profit))}>
                      {formatSigned(p.converted.profit, base, true)}
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">{r.cumReturn}</span>
                <span className={cn('font-medium tabular-nums', rateClass(p.converted.cumRate))}>{rateText(p.converted.cumRate)}</span>
              </div>
              {opts.perCurrency && (
                <ul className="mt-3 divide-y border-t">
                  {p.perCurrency.map((m) => (
                    <li key={m.currency} className="flex items-center justify-between py-2 text-sm">
                      <Cur code={m.currency} />
                      <span className={cn('tabular-nums', rateClass(m.rate))}>
                        {!hide && <span className="mr-2">{formatSigned(m.profit, m.currency, true)}</span>}
                        {rateText(m.rate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-muted-foreground">{r.noPeriod}</p>
            </Card>
          ))}

        {opts.currencies && data.currencies.length > 0 && (
          <Card title={r.currencies}>
            <ul className="space-y-3">
              {data.currencies.map((c) => (
                <li key={c.currency} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <Cur code={c.currency} />
                    {!hide && <span className="tabular-nums">{formatAmount(c.amount, c.currency, true)}</span>}
                  </div>
                  <ShareBar share={c.share} />
                </li>
              ))}
            </ul>
          </Card>
        )}

        {opts.chart && data.chart && (
          <Card title={fmt(r.chart, { cur: baseLabel })}>
            <div className="-mt-2 mb-2 flex gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-0.5 w-4 bg-primary" /> {r.totalLine}
              </span>
              {opts.overlay && (
                <span className="inline-flex items-center gap-1.5">
                  <i className="inline-block w-4 border-t-2 border-dashed border-muted-foreground" /> {r.capitalLine}
                </span>
              )}
            </div>
            <ReportChart
              labels={data.chart.labels}
              total={data.chart.total}
              capital={opts.overlay ? data.chart.capital : undefined}
              hideAxis={hide}
              onReady={onChartReady}
            />
          </Card>
        )}

        {opts.platforms && data.platforms.length > 0 && (
          <Card title={r.platforms}>
            <ul className="space-y-4">
              {data.platforms.map((pl) => (
                <li key={pl.platform.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <PlatformBadge platform={pl.platform} className="size-7 text-xs" />
                    <span className="flex-1 text-sm font-medium">{pl.platform.name}</span>
                    {!hide && <span className="text-sm font-medium tabular-nums">{formatAmount(pl.inBase, base, true)}</span>}
                  </div>
                  {!hide && (
                    <ul className="space-y-0.5 pl-9">
                      {pl.entries.map((e) => (
                        <li key={e.currency} className="flex justify-between text-xs text-muted-foreground">
                          <Cur code={e.currency} />
                          <span className="tabular-nums">{formatAmount(e.amount, e.currency, true)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ShareBar share={pl.share} />
                </li>
              ))}
            </ul>
          </Card>
        )}

        <footer className="pt-1 text-center text-xs text-muted-foreground">
          {fmt(r.generatedOn, { date: generatedOn })} · {t.appName}
        </footer>
      </div>
    )
  },
)
