import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyLabel } from '@/components/CurrencyLabel'
import { DateField } from '@/components/DateField'
import { CURRENCY_CODES, type Currency } from '@/data/currencies'
import { addCapitalFlow, updateCapitalFlow } from '@/data/repo'
import type { CapitalFlow, RateTable } from '@/data/types'
import { useRates } from '@/hooks/useRates'
import { useI18n } from '@/i18n'
import { sanitizeAmount } from '@/lib/amount'
import { useSettings } from '@/settings'
import { RateBar } from '@/pages/entry/RateBar'
import { cn } from '@/lib/utils'

/** 新增或编辑一笔本金流水；汇率随流水一起保存，之后折算不再变动 */
export function FlowDialog({ flow, onClose }: { flow?: CapitalFlow; onClose: () => void }) {
  const { t } = useI18n()
  const { baseCurrency } = useSettings()
  const [date, setDate] = useState(flow?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const [currency, setCurrency] = useState<Currency>(flow?.currency ?? baseCurrency)
  const [amount, setAmount] = useState(flow ? String(flow.amount) : '')
  const [type, setType] = useState<'in' | 'out'>(flow?.type ?? 'in')
  const [note, setNote] = useState(flow?.note ?? '')
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)

  // 编辑时先沿用流水已保存的汇率；改了日期或点“重新获取”才按新日期重新取
  const [manual, setManual] = useState<RateTable | null>(flow?.rates ?? null)
  const [usingSaved, setUsingSaved] = useState(!!flow)
  const { result, loading, useFallback, setUseFallback, reload, rates: autoRates } = useRates(date)
  const rates = manual ?? autoRates

  const value = parseFloat(amount)
  const canSave = !!rates && value > 0 && !saving

  async function save() {
    if (!(value > 0)) return setError(true)
    if (!rates) return
    setSaving(true)
    const input = { date, currency, amount: value, type, note, rates }
    if (flow) await updateCapitalFlow(flow.id, input)
    else await addCapitalFlow(input)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{flow ? t.capital.edit : t.capital.add}</DialogTitle>
          <DialogDescription className="sr-only">{t.capital.summaryHint}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['in', 'out'] as const).map((v) => (
              <Button
                key={v}
                type="button"
                variant={type === v ? 'default' : 'outline'}
                onClick={() => setType(v)}
                aria-pressed={type === v}
              >
                {t.capital[v]}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label>{t.capital.date}</Label>
            <DateField
              value={date}
              onChange={(d) => {
                setDate(d)
                setManual(null)
                setUsingSaved(false)
              }}
            />
          </div>

          <div className="grid grid-cols-[1fr_1.4fr] gap-2">
            <div className="space-y-2">
              <Label>{t.capital.currency}</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="flow-amount">{t.capital.amount}</Label>
              <Input
                id="flow-amount"
                inputMode="decimal"
                className={cn('text-right tabular-nums', error && 'border-destructive')}
                value={amount}
                onChange={(e) => {
                  setAmount(sanitizeAmount(e.target.value, false))
                  setError(false)
                }}
              />
            </div>
          </div>
          {error && <p className="-mt-2 text-xs text-destructive">{t.capital.amountRequired}</p>}

          <div className="space-y-2">
            <Label htmlFor="flow-note">{t.capital.note}</Label>
            <Input
              id="flow-note"
              value={note}
              maxLength={100}
              placeholder={t.capital.notePlaceholder}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <RateBar
            loading={loading}
            result={result}
            useFallback={useFallback}
            manual={manual}
            rates={rates}
            base={baseCurrency}
            onUseFallback={() => setUseFallback(true)}
            onRetry={reload}
            onManual={(r) => {
              setManual(r)
              setUsingSaved(false)
            }}
            onResetManual={() => {
              setManual(null)
              setUsingSaved(false)
            }}
            manualLabel={usingSaved ? t.capital.savedRates : undefined}
            resetLabel={usingSaved ? t.capital.refetch : undefined}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button disabled={!canSave} onClick={save}>
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
