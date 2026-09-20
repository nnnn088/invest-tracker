/**
 * 汇率获取与缓存。
 * 数据来自 Frankfurter API v2（限定欧洲央行 ecb 数据源，周末/节假日自动回退到最近一个工作日）。
 * 汇率表统一以 CNY 为基准：rates[X] = 1 CNY 可兑换多少 X，rates.CNY 恒为 1。
 */
import { format } from 'date-fns'
import { CURRENCY_CODES, RATE_BASE, type Currency } from './currencies'
import { getNearestRateCache, getRateCache, putRateCache } from './repo'
import type { RateCacheRow, RateTable } from './types'

const API = 'https://api.frankfurter.dev/v2/rates'
const TIMEOUT_MS = 10_000
/** 尚未“定稿”的缓存（当天获取、欧洲央行可能还没发布）的有效时长 */
const PROVISIONAL_TTL_MS = 3 * 60 * 60 * 1000

export type RateSource = 'cache' | 'network'

export type RatesResult =
  | { ok: true; rates: RateTable; requestedDate: string; effectiveDate: string; source: RateSource }
  | {
      ok: false
      reason: 'offline' | 'no-data' | 'bad-response'
      /** 可选的兜底：最近一次缓存的汇率 */
      fallback?: { rates: RateTable; effectiveDate: string }
    }

const today = () => format(new Date(), 'yyyy-MM-dd')

/** 缓存是否已“定稿”：获取时间已晚于请求日期当天，说明欧洲央行当天的数据早已发布 */
function isFinal(row: RateCacheRow): boolean {
  return format(new Date(row.fetchedAt), 'yyyy-MM-dd') > row.date
}

function fromCache(row: RateCacheRow, requestedDate: string): RatesResult {
  return { ok: true, rates: row.rates, requestedDate, effectiveDate: row.effectiveDate, source: 'cache' }
}

class FetchError extends Error {
  constructor(public reason: 'offline' | 'no-data' | 'bad-response') {
    super(reason)
  }
}

async function fetchFromApi(date: string): Promise<{ rates: RateTable; effectiveDate: string }> {
  const others = CURRENCY_CODES.filter((c) => c !== RATE_BASE)
  const params = new URLSearchParams({ base: RATE_BASE, quotes: others.join(','), providers: 'ecb' })
  // 未来日期没有数据，改取最新汇率
  if (date <= today()) params.set('date', date)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let rows: unknown
  try {
    const res = await fetch(`${API}?${params}`, { signal: ctrl.signal })
    if (!res.ok) throw new FetchError('bad-response')
    rows = await res.json()
  } catch (e) {
    if (e instanceof FetchError) throw e
    throw new FetchError('offline')
  } finally {
    clearTimeout(timer)
  }

  if (!Array.isArray(rows) || rows.length === 0) throw new FetchError('no-data')
  const rates: Partial<RateTable> = { [RATE_BASE]: 1 }
  let effectiveDate = ''
  for (const r of rows as { date?: string; quote?: string; rate?: number }[]) {
    if (r.quote && others.includes(r.quote as Currency) && typeof r.rate === 'number' && r.rate > 0) {
      rates[r.quote as Currency] = r.rate
      effectiveDate = r.date ?? effectiveDate
    }
  }
  if (!CURRENCY_CODES.every((c) => rates[c] !== undefined) || !effectiveDate) throw new FetchError('bad-response')
  return { rates: rates as RateTable, effectiveDate }
}

/**
 * 获取指定日期的汇率表。
 * 优先用已定稿的缓存；否则请求接口并写入缓存；失败时返回失败原因和可用的兜底缓存。
 * force = true 时跳过缓存，强制重新请求。
 */
export async function getRates(date: string, force = false): Promise<RatesResult> {
  const cached = await getRateCache(date)
  if (!force && cached) {
    if (isFinal(cached) || Date.now() - cached.fetchedAt < PROVISIONAL_TTL_MS) return fromCache(cached, date)
  }
  try {
    const { rates, effectiveDate } = await fetchFromApi(date)
    await putRateCache({ date, effectiveDate, rates, fetchedAt: Date.now() })
    return { ok: true, rates, requestedDate: date, effectiveDate, source: 'network' }
  } catch (e) {
    const reason = e instanceof FetchError ? e.reason : 'offline'
    const near = cached ?? (await getNearestRateCache(date))
    return {
      ok: false,
      reason,
      fallback: near ? { rates: near.rates, effectiveDate: near.effectiveDate } : undefined,
    }
  }
}

// ---------- 换算 ----------

/** 把 amount 从 from 币种按汇率表换算成 to 币种 */
export function convert(amount: number, from: Currency, to: Currency, rates: RateTable): number {
  return (amount / rates[from]) * rates[to]
}

/** 1 单位 from 币种 = 多少 to 币种 */
export function pairRate(from: Currency, to: Currency, rates: RateTable): number {
  return convert(1, from, to, rates)
}
