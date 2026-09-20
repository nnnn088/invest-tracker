/** 分享图用的数据整理（纯函数，不访问数据库） */
import { CURRENCY_CODES, type Currency } from '@/data/currencies'
import { convert } from '@/data/rates'
import type { CapitalFlow, Entry, Platform, Snapshot } from '@/data/types'
import { computePeriod, type PeriodMetrics } from './period'
import type { Range } from './range'
import { axisLabel, convertedTotalOf, timeSeries } from './series'
import { convertedNetCapital } from './stats'

export interface CurrencyLine {
  currency: Currency
  amount: number
  inBase: number
  /** 占折算总资产的比例（总资产 ≤ 0 时为 0） */
  share: number
}

export interface PlatformLine {
  platform: Platform
  entries: { currency: Currency; amount: number; inBase: number }[]
  inBase: number
  share: number
}

export interface ReportData {
  base: Currency
  /** 最近一次快照的日期（截至日期） */
  asOf: string
  total: number
  currencies: CurrencyLine[]
  platforms: PlatformLine[]
  /** 时段收益；所选时段内没有新快照时为 null */
  period: null | {
    startDate: string
    endDate: string
    days: number
    converted: PeriodMetrics
    perCurrency: PeriodMetrics[]
  }
  chart: null | { labels: string[]; total: number[]; capital: number[] }
}

export function buildReport(
  snapshots: Snapshot[],
  flows: CapitalFlow[],
  entries: Entry[],
  platforms: Platform[],
  range: Range,
  base: Currency,
): ReportData | null {
  const sorted = [...snapshots].sort((a, b) => (a.date < b.date ? -1 : 1))
  const last = [...sorted].reverse().find((s) => s.date <= range.end)
  if (!last) return null

  const total = convertedTotalOf(last, base)
  const share = (v: number) => (total > 0 ? v / total : 0)

  const currencies: CurrencyLine[] = CURRENCY_CODES.flatMap((c) => {
    const amount = last.currencyTotals[c]
    if (amount === undefined || amount === 0) return []
    const inBase = convert(amount, c, base, last.rates)
    return [{ currency: c, amount, inBase, share: share(inBase) }]
  })

  const byPlatform = new Map<string, PlatformLine>()
  for (const item of last.items) {
    if (item.amount === 0) continue
    const entry = entries.find((e) => e.id === item.entryId)
    const platform = entry && platforms.find((p) => p.id === entry.platformId)
    if (!entry || !platform) continue
    const inBase = convert(item.amount, entry.currency, base, last.rates)
    const line = byPlatform.get(platform.id) ?? { platform, entries: [], inBase: 0, share: 0 }
    line.entries.push({ currency: entry.currency, amount: item.amount, inBase })
    line.inBase += inBase
    byPlatform.set(platform.id, line)
  }
  const platformLines = [...byPlatform.values()]
    .map((l) => ({ ...l, share: share(l.inBase) }))
    .sort((a, b) => b.inBase - a.inBase)

  const r = computePeriod(snapshots, flows, range.start, range.end, base)
  const period = r.kind === 'ok' ? { startDate: r.startDate, endDate: r.endDate, days: r.days, converted: r.converted, perCurrency: r.perCurrency } : null

  const series = timeSeries(snapshots, range.start, range.end)
  let chart: ReportData['chart'] = null
  if (series && series.points.length > 0) {
    const pts = series.points
    const multiYear = pts[0].date.slice(0, 4) !== pts[pts.length - 1].date.slice(0, 4)
    chart = {
      labels: pts.map((p) => axisLabel(p.date, multiYear)),
      total: pts.map((p) => convertedTotalOf(p.snapshot, base)),
      capital: pts.map((p) => convertedNetCapital(flows, p.snapshot.date, base)),
    }
  }

  return { base, asOf: last.date, total, currencies, platforms: platformLines, period, chart }
}
