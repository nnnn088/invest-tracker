export const CURRENCY_CODES = ['CNY', 'USD', 'GBP', 'HKD', 'EUR', 'JPY', 'KRW'] as const
export type Currency = (typeof CURRENCY_CODES)[number]

interface CurrencyInfo {
  code: Currency
  /** 界面显示的名称（人民币显示为 RMB） */
  label: string
  flag: string
  /** 金额符号，人民币与日元需区分 */
  symbol: string
  decimals: number
}

export const CURRENCIES: Record<Currency, CurrencyInfo> = {
  CNY: { code: 'CNY', label: 'RMB', flag: '🇨🇳', symbol: 'CN¥', decimals: 2 },
  USD: { code: 'USD', label: 'USD', flag: '🇺🇸', symbol: '$', decimals: 2 },
  GBP: { code: 'GBP', label: 'GBP', flag: '🇬🇧', symbol: '£', decimals: 2 },
  HKD: { code: 'HKD', label: 'HKD', flag: '🇭🇰', symbol: 'HK$', decimals: 2 },
  EUR: { code: 'EUR', label: 'EUR', flag: '🇪🇺', symbol: '€', decimals: 2 },
  JPY: { code: 'JPY', label: 'JPY', flag: '🇯🇵', symbol: 'JP¥', decimals: 0 },
  KRW: { code: 'KRW', label: 'KRW', flag: '🇰🇷', symbol: '₩', decimals: 0 },
}

/** 汇率表统一以 CNY 为基准：rates[X] = 1 CNY 可兑换多少 X（CNY 恒为 1） */
export const RATE_BASE: Currency = 'CNY'

/** 带千分位、按币种习惯的小数位（JPY、KRW 无小数）；可选带符号 */
export function formatAmount(amount: number, currency: Currency, withSymbol = false): string {
  const { decimals, symbol } = CURRENCIES[currency]
  const text = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
  return withSymbol ? `${symbol}${text}` : text
}
