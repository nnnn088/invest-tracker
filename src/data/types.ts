import type { Currency } from './currencies'

export type Lang = 'zh' | 'en'
/** red-up：红涨绿跌；green-up：绿涨红跌 */
export type TrendScheme = 'red-up' | 'green-up'
export type RateTable = Record<Currency, number>

export interface Platform {
  /** 内置平台使用固定标识（如 'ibkr'），自定义平台使用随机 id */
  id: string
  name: string
  builtin: boolean
  /** 徽标底色；内置平台用于图标缺失时的首字母徽标 */
  color: string
  archived: boolean
  /** 显示顺序：内置平台按预设顺序，自定义平台排在其后 */
  order: number
}

export interface Entry {
  id: string
  platformId: string
  currency: Currency
  order: number
  archived: boolean
}

export interface SnapshotItem {
  entryId: string
  amount: number
}

export interface Snapshot {
  /** YYYY-MM-DD，唯一 */
  date: string
  items: SnapshotItem[]
  rates: RateTable
  currencyTotals: Partial<Record<Currency, number>>
  baseCurrency: Currency
  convertedTotal: number
  createdAt: number
  updatedAt: number
}

export interface CapitalFlow {
  id: string
  date: string
  currency: Currency
  /** 正数 */
  amount: number
  type: 'in' | 'out'
  note: string
  /** 流水发生当天使用的汇率表（可能经用户手动修改） */
  rates: RateTable
  createdAt: number
}

export interface RateCacheRow {
  /** 请求的日期（YYYY-MM-DD），作为缓存键；周末/节假日会对应更早的生效日期 */
  date: string
  /** 汇率实际所属的日期（欧洲央行最近一个工作日） */
  effectiveDate: string
  rates: RateTable
  /** 获取时间（毫秒时间戳） */
  fetchedAt: number
}

export interface Settings {
  baseCurrency: Currency
  language: Lang
  trendScheme: TrendScheme
}

export const DEFAULT_SETTINGS: Settings = {
  baseCurrency: 'CNY',
  language: 'zh',
  trendScheme: 'red-up',
}
