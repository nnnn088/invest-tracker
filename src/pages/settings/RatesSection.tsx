import { useState } from 'react'
import { format } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CurrencyLabel } from '@/components/CurrencyLabel'
import { DateField } from '@/components/DateField'
import { CURRENCIES, CURRENCY_CODES, type Currency } from '@/data/currencies'
import { pairRate } from '@/data/rates'
import { fmt, useI18n } from '@/i18n'
import { useRates } from '@/hooks/useRates'
import { formatRate } from '@/lib/format'
import { useSettings } from '@/settings'

export function RatesSection() {
  const { t } = useI18n()
  const { baseCurrency } = useSettings()
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const { result, loading, useFallback, setUseFallback, reload, rates, effectiveDate } = useRates(date)

  // 显示用的汇率表与其所属日期
  const shown = rates && effectiveDate ? { rates, effectiveDate } : null

  // 已选择使用缓存后，不再显示错误框（下方标签会注明数据来自本机缓存）
  const errorText = result && !result.ok && !useFallback ? t.rates.errors[result.reason] : ''
  const others = CURRENCY_CODES.filter((c) => c !== baseCurrency)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.rates.title}</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" disabled={loading} onClick={reload}>
            <RefreshCw className={loading ? 'animate-spin' : ''} /> {t.rates.refresh}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t.rates.hint}</p>
        <div className="space-y-2">
          <Label>{t.rates.date}</Label>
          <DateField value={date} onChange={setDate} />
        </div>

        {errorText && (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p>{errorText}</p>
            {result && !result.ok && result.fallback && !useFallback && (
              <Button size="sm" variant="outline" onClick={() => setUseFallback(true)}>
                {fmt(t.rates.useCached, { date: result.fallback.effectiveDate })}
              </Button>
            )}
            {result && !result.ok && !result.fallback && <p className="text-muted-foreground">{t.rates.noCache}</p>}
          </div>
        )}

        {shown && (
          <>
            <p className="text-xs text-muted-foreground">
              {fmt(t.rates.effective, { date: shown.effectiveDate })}
              {result?.ok && ` · ${result.source === 'network' ? t.rates.fromNetwork : t.rates.fromCache}`}
              {!result?.ok && ` · ${t.rates.fromCache}`}
            </p>
            {result?.ok && result.effectiveDate !== result.requestedDate && (
              <p className="text-xs text-muted-foreground">{t.rates.nonWorkday}</p>
            )}
            <ul className="divide-y">
              {others.map((c: Currency) => (
                <li key={c} className="flex items-center justify-between py-2 text-sm">
                  <span className="inline-flex items-center gap-2">
                    1 <CurrencyLabel currency={c} />
                  </span>
                  <span className="tabular-nums">
                    = {formatRate(pairRate(c, baseCurrency, shown.rates))} {CURRENCIES[baseCurrency].label}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {loading && !shown && <p className="py-4 text-center text-sm text-muted-foreground">{t.rates.loading}</p>}
      </CardContent>
    </Card>
  )
}
