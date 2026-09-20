import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DateField } from '@/components/DateField'
import { useI18n } from '@/i18n'
import type { Preset } from '@/lib/range'

const PRESETS: Preset[] = ['month', '3m', 'year', 'last12', 'all', 'custom']

export function PeriodPicker({
  preset,
  onPreset,
  start,
  end,
  onStart,
  onEnd,
  invalid,
}: {
  preset: Preset
  onPreset: (p: Preset) => void
  start: string
  end: string
  onStart: (d: string) => void
  onEnd: (d: string) => void
  invalid: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={preset === p ? 'default' : 'outline'}
            aria-pressed={preset === p}
            onClick={() => onPreset(p)}
          >
            {t.stats.periodPresets[p]}
          </Button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t.stats.from}</Label>
            <DateField value={start} onChange={onStart} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t.stats.to}</Label>
            <DateField value={end} onChange={onEnd} />
          </div>
          {invalid && <p className="col-span-2 text-xs text-destructive">{t.stats.invalidRange}</p>}
        </div>
      )}
    </div>
  )
}
