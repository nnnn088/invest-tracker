import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyLabel } from '@/components/CurrencyLabel'
import { CURRENCY_CODES, type Currency } from '@/data/currencies'
import type { Lang, TrendScheme } from '@/data/types'
import { useI18n } from '@/i18n'
import { updateSettings, useSettings } from '@/settings'

function TrendPreview({ scheme, label }: { scheme: TrendScheme; label: string }) {
  const { t } = useI18n()
  const [up, down] = t.settings.trendPreview.split(' / ')
  return (
    <span className="inline-flex items-center gap-2" data-trend={scheme}>
      <span>{label}</span>
      <span className="text-xs">
        <span className="text-up">{up}</span> / <span className="text-down">{down}</span>
      </span>
    </span>
  )
}

export function GeneralSection() {
  const { t } = useI18n()
  const settings = useSettings()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.general}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>{t.settings.baseCurrency}</Label>
          <Select
            value={settings.baseCurrency}
            onValueChange={(v) => updateSettings({ baseCurrency: v as Currency })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_CODES.map((c) => (
                <SelectItem key={c} value={c}>
                  <CurrencyLabel currency={c} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t.settings.baseCurrencyHint}</p>
        </div>

        <div className="space-y-2">
          <Label>{t.settings.language}</Label>
          <Select value={settings.language} onValueChange={(v) => updateSettings({ language: v as Lang })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh">中文</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t.settings.trendScheme}</Label>
          <Select
            value={settings.trendScheme}
            onValueChange={(v) => updateSettings({ trendScheme: v as TrendScheme })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="red-up">
                <TrendPreview scheme="red-up" label={t.settings.trendRedUp} />
              </SelectItem>
              <SelectItem value="green-up">
                <TrendPreview scheme="green-up" label={t.settings.trendGreenUp} />
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
