/**
 * 时段收益统计（纯函数，不访问数据库）。规则见 CLAUDE.md 5.4：
 * - 期末快照 S1：结束日当天或之前最近的一次快照；期初快照 S0：开始日当天或之前最近的一次。
 * - 没有 S0 时期初资产为 0，期初日期取第一笔本金流水与第一次快照中较早的一天。
 * - 期间净投入本金：(S0 日期, S1 日期] 内的流水（无 S0 时为 S1 日期及之前的全部流水），转入为正、转出为负。
 * - 期间加权平均本金：[S0 日期, S1 日期] 内每天的“累计净投入本金”（开始以来全部流水）按天取平均。
 * - 期间净收益 = 期末资产 − 期初资产 − 期间净投入本金；期间收益率 = 净收益 ÷ 加权平均本金（≤ 0 时为 null）。
 * - 折算口径：资产按各快照保存的汇率折算；本金按每笔流水发生当天的汇率折算。
 */
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { CURRENCY_CODES, type Currency } from '@/data/currencies'
import { convert } from '@/data/rates'
import type { CapitalFlow, Snapshot } from '@/data/types'
import { convertTotals } from './stats'

export interface PeriodMetrics {
  currency: Currency
  opening: number
  closing: number
  /** 期间净投入本金 */
  netCapital: number
  /** 期间净收益 */
  profit: number
  /** 期间加权平均本金 */
  avgCapital: number
  /** 期间收益率；加权平均本金 ≤ 0 时为 null */
  rate: number | null
  /** 截至期末的累计净投入本金 */
  cumCapital: number
  /** 累计收益 = 期末资产 − 累计净投入本金 */
  cumProfit: number
  /** 累计收益率 = 累计收益 ÷ 累计净投入本金；本金 ≤ 0 时为 null */
  cumRate: number | null
}

export type PeriodResult =
  | { kind: 'no-data' }
  /** 期初与期末是同一次快照：期内没有新的快照，无法计算 */
  | { kind: 'no-new'; date: string }
  | {
      kind: 'ok'
      startDate: string
      endDate: string
      /** 期初快照不存在，期初资产按 0 计算 */
      openingVirtual: boolean
      /** 区间天数（含首尾） */
      days: number
      converted: PeriodMetrics
      perCurrency: PeriodMetrics[]
    }

interface Amount {
  date: string
  amount: number
}

const days = (a: string, b: string) => differenceInCalendarDays(parseISO(b), parseISO(a))
const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** [d0, d1] 内每天累计本金的平均值（d0 之前的流水计入起始本金） */
export function weightedAverage(list: Amount[], d0: string, d1: string): number {
  const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  let cur = 0
  for (const f of sorted) if (f.date <= d0) cur += f.amount
  let prev = d0
  let area = 0
  for (const f of sorted) {
    if (f.date <= d0 || f.date > d1) continue
    area += cur * days(prev, f.date)
    cur += f.amount
    prev = f.date
  }
  area += cur * (days(prev, d1) + 1)
  return area / (days(d0, d1) + 1)
}

const signed = (f: CapitalFlow) => (f.type === 'in' ? f.amount : -f.amount)

function metrics(
  currency: Currency,
  opening: number,
  closing: number,
  flows: Amount[],
  d0: string,
  d1: string,
  hasS0: boolean,
): PeriodMetrics {
  const netCapital = flows
    .filter((f) => (hasS0 ? f.date > d0 : true) && f.date <= d1)
    .reduce((s, f) => s + f.amount, 0)
  const cumCapital = flows.filter((f) => f.date <= d1).reduce((s, f) => s + f.amount, 0)
  const avgCapital = weightedAverage(flows, d0, d1)
  const profit = closing - opening - netCapital
  const cumProfit = closing - cumCapital
  return {
    currency,
    opening: round6(opening),
    closing: round6(closing),
    netCapital: round6(netCapital),
    profit: round6(profit),
    avgCapital: round6(avgCapital),
    rate: avgCapital > 0 ? profit / avgCapital : null,
    cumCapital: round6(cumCapital),
    cumProfit: round6(cumProfit),
    cumRate: cumCapital > 0 ? cumProfit / cumCapital : null,
  }
}

export function computePeriod(
  snapshots: Snapshot[],
  flows: CapitalFlow[],
  start: string,
  end: string,
  base: Currency,
): PeriodResult {
  const sorted = [...snapshots].sort((a, b) => (a.date < b.date ? -1 : 1))
  const s1 = [...sorted].reverse().find((s) => s.date <= end)
  if (!s1) return { kind: 'no-data' }
  const s0 = [...sorted].reverse().find((s) => s.date <= start)
  if (s0 && s0.date === s1.date) return { kind: 'no-new', date: s1.date }

  const firstFlow = flows.reduce<string | null>((min, f) => (min === null || f.date < min ? f.date : min), null)
  const d0 = s0 ? s0.date : firstFlow && firstFlow < sorted[0].date ? firstFlow : sorted[0].date
  const d1 = s1.date

  // 折算口径：每笔流水按其当天汇率折算成折算货币
  const convertedFlows: Amount[] = flows.map((f) => ({ date: f.date, amount: convert(signed(f), f.currency, base, f.rates) }))
  const converted = metrics(
    base,
    s0 ? convertTotals(s0.currencyTotals, base, s0.rates) : 0,
    convertTotals(s1.currencyTotals, base, s1.rates),
    convertedFlows,
    d0,
    d1,
    !!s0,
  )

  const perCurrency = CURRENCY_CODES.flatMap((c) => {
    const own: Amount[] = flows.filter((f) => f.currency === c).map((f) => ({ date: f.date, amount: signed(f) }))
    const m = metrics(c, s0?.currencyTotals[c] ?? 0, s1.currencyTotals[c] ?? 0, own, d0, d1, !!s0)
    const active = m.opening !== 0 || m.closing !== 0 || m.cumCapital !== 0 || m.netCapital !== 0
    return active ? [m] : []
  })

  return {
    kind: 'ok',
    startDate: d0,
    endDate: d1,
    openingVirtual: !s0,
    days: days(d0, d1) + 1,
    converted,
    perCurrency,
  }
}
