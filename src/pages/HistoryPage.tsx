import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatAmount } from '@/data/currencies'
import { useSnapshots } from '@/data/hooks'
import { fmt, useI18n } from '@/i18n'
import { convertTotals } from '@/lib/stats'
import { useSettings } from '@/settings'
import { SnapshotDetail } from './history/SnapshotDetail'

export function HistoryPage({ onGoEntry }: { onGoEntry: () => void }) {
  const { t } = useI18n()
  const { baseCurrency } = useSettings()
  const snapshots = useSnapshots()
  const [selected, setSelected] = useState<string | null>(null)

  if (selected) return <SnapshotDetail date={selected} onBack={() => setSelected(null)} />
  if (!snapshots) return null

  if (snapshots.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-2 py-8 text-center">
          <p className="font-medium">{t.history.empty}</p>
          <p className="text-sm text-muted-foreground">{t.history.emptyHint}</p>
          <Button onClick={onGoEntry}>{t.common.goEntry}</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs text-muted-foreground">{fmt(t.history.count, { n: String(snapshots.length) })}</p>
      <Card>
        <CardContent>
          <ul className="divide-y">
            {snapshots.map((s) => (
              <li key={s.date}>
                <button
                  type="button"
                  onClick={() => setSelected(s.date)}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <span className="flex-1 tabular-nums">{s.date}</span>
                  {/* 按当前折算货币，用该快照保存的汇率重新折算 */}
                  <span className="font-medium tabular-nums">
                    {formatAmount(convertTotals(s.currencyTotals, baseCurrency, s.rates), baseCurrency, true)}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
