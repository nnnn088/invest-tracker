import { useMemo, useState } from 'react'
import { format, startOfMonth } from 'date-fns'
import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useI18n } from '@/i18n'
import { useSnapshots } from '@/data/hooks'
import { presetRange, type Preset, type Range } from '@/lib/range'
import { ChartsView } from './stats/ChartsView'
import { PeriodPicker } from './stats/PeriodPicker'
import { ProfitView } from './stats/ProfitView'
import { ShareDialog } from './stats/ShareDialog'

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * 统计页：最上层是时段选择（收益统计与图表共用），
 * 下面用分段切换在“收益”（时段收益统计）与“图表”（折线图）之间切换。
 */
export function StatsPage({ onGoEntry }: { onGoEntry: () => void }) {
  const { t } = useI18n()
  const today = useMemo(() => new Date(), [])
  const [view, setView] = useState<'profit' | 'charts'>('profit')
  const [preset, setPreset] = useState<Preset>('year')
  const [customStart, setCustomStart] = useState(() => ymd(startOfMonth(today)))
  const [customEnd, setCustomEnd] = useState(() => ymd(today))
  const [sharing, setSharing] = useState(false)
  const snapshots = useSnapshots()

  const range: Range =
    preset === 'custom'
      ? { start: customStart, end: customEnd, isAll: false }
      : { ...presetRange(preset, today), isAll: preset === 'all' }
  const invalid = range.start > range.end

  // 点选预设时把自定义日期同步成该预设的范围，方便接着微调
  function choose(p: Preset) {
    if (p !== 'custom' && p !== 'all') {
      const r = presetRange(p, today)
      setCustomStart(r.start)
      setCustomEnd(r.end)
    }
    setPreset(p)
  }

  return (
    <div className="space-y-3">
      <PeriodPicker
        preset={preset}
        onPreset={choose}
        start={customStart}
        end={customEnd}
        onStart={setCustomStart}
        onEnd={setCustomEnd}
        invalid={invalid}
      />

      <Button variant="outline" className="w-full" disabled={invalid || !snapshots?.length} onClick={() => setSharing(true)}>
        <Share2 /> {t.share.button}
      </Button>

      <Tabs value={view} onValueChange={(v) => setView(v as 'profit' | 'charts')}>
        <TabsList className="w-full">
          <TabsTrigger value="profit">{t.charts.tabs.profit}</TabsTrigger>
          <TabsTrigger value="charts">{t.charts.tabs.charts}</TabsTrigger>
        </TabsList>
      </Tabs>

      {sharing && <ShareDialog range={range} onClose={() => setSharing(false)} />}

      {!invalid && (view === 'profit' ? <ProfitView range={range} onGoEntry={onGoEntry} /> : <ChartsView range={range} onGoEntry={onGoEntry} />)}
    </div>
  )
}
