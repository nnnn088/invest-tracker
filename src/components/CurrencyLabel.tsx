import { CURRENCIES, type Currency } from '@/data/currencies'

export function CurrencyLabel({ currency }: { currency: Currency }) {
  const c = CURRENCIES[currency]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{c.flag}</span>
      <span>{c.label}</span>
    </span>
  )
}
