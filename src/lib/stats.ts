/** 录入页与后续统计使用的纯计算函数（不访问数据库） */
import { CURRENCY_CODES, type Currency } from '@/data/currencies'
import { convert } from '@/data/rates'
import type { CapitalFlow, RateTable } from '@/data/types'

export type CurrencyMap = Partial<Record<Currency, number>>

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** 按币种汇总（原币）；保留传入顺序之外按固定币种顺序输出 */
export function sumByCurrency(items: { currency: Currency; amount: number }[]): CurrencyMap {
  const out: CurrencyMap = {}
  for (const { currency, amount } of items) out[currency] = round6((out[currency] ?? 0) + amount)
  return out
}

/** 各币种合计按汇率折算为 base 后求和 */
export function convertTotals(totals: CurrencyMap, base: Currency, rates: RateTable): number {
  let sum = 0
  for (const c of CURRENCY_CODES) {
    const v = totals[c]
    if (v !== undefined) sum += convert(v, c, base, rates)
  }
  return round6(sum)
}

const signed = (f: CapitalFlow) => (f.type === 'in' ? f.amount : -f.amount)

/** 截至某日（含）各币种累计净投入本金（原币） */
export function netCapitalByCurrency(flows: CapitalFlow[], upTo: string): CurrencyMap {
  const out: CurrencyMap = {}
  for (const f of flows) {
    if (f.date <= upTo) out[f.currency] = round6((out[f.currency] ?? 0) + signed(f))
  }
  return out
}

/**
 * 截至某日（含）折算货币口径的累计净投入本金：
 * 每笔流水按其发生当天保存的汇率折算后再累加。
 */
export function convertedNetCapital(flows: CapitalFlow[], upTo: string, base: Currency): number {
  let sum = 0
  for (const f of flows) {
    if (f.date <= upTo) sum += convert(signed(f), f.currency, base, f.rates)
  }
  return round6(sum)
}

export interface ProfitRow {
  /** 币种；折算合计行为 base 币种 */
  currency: Currency
  assets: number
  capital: number
  profit: number
  /** 累计收益率 = 累计收益 ÷ 累计净投入本金；本金 ≤ 0 时为 null */
  rate: number | null
}

export function makeProfitRow(currency: Currency, assets: number, capital: number): ProfitRow {
  const profit = round6(assets - capital)
  return { currency, assets, capital, profit, rate: capital > 0 ? profit / capital : null }
}

export interface FlowTotals {
  in: number
  out: number
  net: number
}

export interface CapitalSummary {
  /** 各币种（原币）的累计转入、转出、净转入，仅含有流水的币种 */
  perCurrency: ({ currency: Currency } & FlowTotals)[]
  /** 折算货币口径：每笔按其发生当天的汇率折算后累加 */
  converted: FlowTotals
}

export function summarizeCapital(flows: CapitalFlow[], base: Currency): CapitalSummary {
  const per = new Map<Currency, FlowTotals>()
  const converted: FlowTotals = { in: 0, out: 0, net: 0 }
  for (const f of flows) {
    const t = per.get(f.currency) ?? { in: 0, out: 0, net: 0 }
    const inBase = convert(f.amount, f.currency, base, f.rates)
    if (f.type === 'in') {
      t.in += f.amount
      converted.in += inBase
    } else {
      t.out += f.amount
      converted.out += inBase
    }
    per.set(f.currency, t)
  }
  const fix = (t: FlowTotals): FlowTotals => ({ in: round6(t.in), out: round6(t.out), net: round6(t.in - t.out) })
  return {
    perCurrency: CURRENCY_CODES.filter((c) => per.has(c)).map((c) => ({ currency: c, ...fix(per.get(c)!) })),
    converted: fix(converted),
  }
}
