import { formatAmount, type Currency } from '@/data/currencies'

/** 带正负号的金额，如 +1,234.00 / -56.00 */
export function formatSigned(amount: number, currency: Currency, withSymbol = false): string {
  const text = formatAmount(Math.abs(amount), currency, withSymbol)
  if (amount > 0) return `+${text}`
  if (amount < 0) return `-${text}`
  return text
}

export function formatPercent(ratio: number): string {
  const text = `${(Math.abs(ratio) * 100).toFixed(2)}%`
  if (ratio > 0) return `+${text}`
  if (ratio < 0) return `-${text}`
  return text
}

/** 涨跌颜色：正数“涨”色，负数“跌”色，零值中性色（颜色由 CSS 变量决定，随涨跌配色设置切换） */
export function trendClass(n: number): string {
  if (n > 0) return 'text-up'
  if (n < 0) return 'text-down'
  return 'text-flat'
}

/** 汇率按数量级选择小数位，保证 JPY、KRW 这类小数值也有足够有效数字 */
export function formatRate(x: number): string {
  const digits = x >= 100 ? 2 : x >= 1 ? 4 : 6
  return x.toFixed(digits)
}
