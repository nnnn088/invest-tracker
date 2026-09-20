/** 图表用的数据序列计算（纯函数） */
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import { CURRENCY_CODES, type Currency } from '@/data/currencies'
import type { CapitalFlow, Snapshot } from '@/data/types'
import { computePeriod } from './period'
import { convertTotals, convertedNetCapital, netCapitalByCurrency } from './stats'

export type ProfitScope = Currency | 'converted'
/** cumulative：从开始累计到该点；period：仅相邻两个时间点之间 */
export type ProfitMode = 'cumulative' | 'period'


/** 一张图最多显示的时间点数量：一个月最长 31 天，选一个月时每天正好一个点 */
export const MAX_POINTS = 31

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')

/** 从 end 起每隔 step 天向前取时间点，直到早于 start；返回升序日期 */
function generate(start: string, end: string, step: number): string[] {
  const out: string[] = []
  let d = parseISO(end)
  const first = parseISO(start)
  while (d >= first && out.length < 5000) {
    out.push(ymd(d))
    d = subDays(d, step)
  }
  return out.reverse()
}

/** 倒推得到的第一个点若离区间起点还有半个间隔以上，就补上起点，避免最早的数据落在图外 */
function withStart(dates: string[], from: string, step: number): string[] {
  if (dates.length === 0 || dates[0] === from) return dates
  return differenceInCalendarDays(parseISO(dates[0]), parseISO(from)) * 2 >= step ? [from, ...dates] : dates
}

export interface TimePoint {
  /** 时间点日期 */
  date: string
  /** 该时间点“当时有效”的记录：日期不晚于它的最近一次快照（没有新记录就沿用前面的） */
  snapshot: Snapshot
}

export interface TimeSeries {
  /** 相邻时间点的间隔（天）：使点数不超过 MAX_POINTS 的最小整数天 */
  step: number
  points: TimePoint[]
  /** 第一个时间点再往前一个间隔的日期，供“按周期”口径计算第一个点使用 */
  prevDate: string
}

/**
 * 按时间点取样：区间内固定最多 MAX_POINTS 个点，由区间长度倒推出间隔；
 * 每个时间点取“该日或之前最近一次快照”的数据，没有记录的日期沿用前面的数据。
 * 区间起点早于最早快照时（如“全部”）从最早快照那天开始。
 */
export function timeSeries(all: Snapshot[], start: string, end: string): TimeSeries | null {
  if (all.length === 0) return null
  const sorted = [...all].sort((a, b) => (a.date < b.date ? -1 : 1))
  const from = sorted[0].date > start ? sorted[0].date : start
  if (from > end) return null

  // 点数 = ⌊跨度 ÷ 间隔⌋ + 1，所以使点数不超过 MAX_POINTS 的最小整数间隔是 ⌊跨度 ÷ MAX_POINTS⌋ + 1
  const span = differenceInCalendarDays(parseISO(end), parseISO(from))
  const step = Math.floor(span / MAX_POINTS) + 1
  let dates = generate(from, end, step)
  // 起点补成第一个点只是锦上添花：放得下才补，不为它加大间隔
  const padded = withStart(dates, from, step)
  if (padded.length <= MAX_POINTS) dates = padded
  if (dates.length === 0) return null

  let i = 0
  const points: TimePoint[] = []
  for (const date of dates) {
    while (i + 1 < sorted.length && sorted[i + 1].date <= date) i++
    if (sorted[i].date <= date) points.push({ date, snapshot: sorted[i] })
  }
  if (points.length === 0) return null
  return { step, points, prevDate: ymd(subDays(parseISO(points[0].date), step)) }
}

/** 有过记录（出现过非 0 金额）的币种 */
export function recordedCurrencies(snapshots: Snapshot[]): Currency[] {
  return CURRENCY_CODES.filter((c) => snapshots.some((s) => (s.currencyTotals[c] ?? 0) !== 0))
}

export const convertedTotalOf = (s: Snapshot, base: Currency) => convertTotals(s.currencyTotals, base, s.rates)

export interface ProfitPoint {
  profit: number | null
  rate: number | null
}

/**
 * 收益与收益率序列。
 * cumulative：该时间点有效记录的资产 − 该记录当天的累计净投入本金。
 * period：上一个时间点到这个时间点之间的收益；期间没有新记录时收益为 0。
 */
export function profitSeries(
  series: TimeSeries,
  all: Snapshot[],
  flows: CapitalFlow[],
  base: Currency,
  scope: ProfitScope,
  mode: ProfitMode,
): ProfitPoint[] {
  return series.points.map((p, i) => {
    if (mode === 'cumulative') {
      const s = p.snapshot
      const assets = scope === 'converted' ? convertedTotalOf(s, base) : (s.currencyTotals[scope] ?? 0)
      const capital =
        scope === 'converted'
          ? convertedNetCapital(flows, s.date, base)
          : (netCapitalByCurrency(flows, s.date)[scope] ?? 0)
      const profit = assets - capital
      return { profit, rate: capital > 0 ? profit / capital : null }
    }
    const start = i === 0 ? series.prevDate : series.points[i - 1].date
    const r = computePeriod(all, flows, start, p.date, base)
    if (r.kind === 'no-data') return { profit: null, rate: null }
    if (r.kind === 'no-new') return { profit: 0, rate: 0 }
    const m = scope === 'converted' ? r.converted : r.perCurrency.find((x) => x.currency === scope)
    return m ? { profit: m.profit, rate: m.rate } : { profit: 0, rate: null }
  })
}

/** 横轴标签：月-日，跨年时带年份 */
export function axisLabel(date: string, multiYear: boolean): string {
  return multiYear ? date.slice(2) : date.slice(5)
}
