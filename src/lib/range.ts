import { format, startOfMonth, startOfYear, subMonths, subYears } from 'date-fns'

/** 统计页顶部的时段预设；收益统计与图表共用 */
export type Preset = 'month' | '3m' | 'year' | 'last12' | 'all' | 'custom'

/** “全部”：从很早的日期开始，保证没有期初快照，本金从第一笔起累计 */
export const EPOCH = '1970-01-01'

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')

export function presetRange(p: Exclude<Preset, 'custom'>, today: Date): { start: string; end: string } {
  const end = ymd(today)
  if (p === 'month') return { start: ymd(startOfMonth(today)), end }
  if (p === '3m') return { start: ymd(subMonths(today, 3)), end }
  if (p === 'year') return { start: ymd(startOfYear(today)), end }
  if (p === 'last12') return { start: ymd(subYears(today, 1)), end }
  return { start: EPOCH, end }
}

export interface Range {
  start: string
  end: string
  /** 选的是“全部”（起始日期不代表实际含义） */
  isAll: boolean
}
