import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { Download, FlaskConical, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { backupCounts, buildBackup, parseBackup, restoreBackup, type BackupFile } from '@/data/backup'
import { listCapitalFlows } from '@/data/repo'
import { db } from '@/data/db'
import { clearAllData, loadDemoData } from '@/data/demo'
import { fmt, useI18n } from '@/i18n'
import { flowsCsv, snapshotsCsv } from '@/lib/csv'
import { saveFile } from '@/lib/download'
import { useSettings } from '@/settings'

type Notice = { kind: 'ok' | 'error'; text: string } | null

/** 设置页“数据管理”：完整备份的导出/导入，以及 CSV 汇总导出 */
export function DataSection() {
  const { t } = useI18n()
  const { baseCurrency } = useSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [confirmDemo, setConfirmDemo] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const today = () => format(new Date(), 'yyyy-MM-dd')

  async function run(job: () => Promise<Notice>) {
    try {
      setNotice(await job())
    } catch {
      setNotice({ kind: 'error', text: t.data.errors.failed })
    }
  }

  const exportBackup = () =>
    run(async () => {
      const name = `invest-backup-${today()}.json`
      await saveFile(name, 'application/json', JSON.stringify(await buildBackup(), null, 2))
      return { kind: 'ok', text: fmt(t.data.exported, { name }) }
    })

  const exportSnapshots = () =>
    run(async () => {
      const [snapshots, flows] = await Promise.all([db.snapshots.toArray(), listCapitalFlows()])
      if (snapshots.length === 0) return { kind: 'error', text: t.data.noSnapshots }
      const L = t.data.csvSnapshots
      const csv = snapshotsCsv(snapshots, flows, baseCurrency, {
        date: L.date,
        assets: (cur) => fmt(L.assets, { cur }),
        convertedTotal: (cur) => fmt(L.convertedTotal, { cur }),
        capital: (cur) => fmt(L.capital, { cur }),
        profit: (cur) => fmt(L.profit, { cur }),
      })
      const name = `invest-snapshots-${today()}.csv`
      await saveFile(name, 'text/csv;charset=utf-8', csv)
      return { kind: 'ok', text: fmt(t.data.exported, { name }) }
    })

  const exportFlows = () =>
    run(async () => {
      const flows = await listCapitalFlows()
      if (flows.length === 0) return { kind: 'error', text: t.data.noFlows }
      const L = t.data.csvFlows
      const csv = flowsCsv(flows, baseCurrency, {
        date: L.date,
        currency: L.currency,
        type: L.type,
        amount: L.amount,
        converted: (cur) => fmt(L.converted, { cur }),
        note: L.note,
        typeName: { in: t.capital.in, out: t.capital.out },
      })
      const name = `invest-capital-flows-${today()}.csv`
      await saveFile(name, 'text/csv;charset=utf-8', csv)
      return { kind: 'ok', text: fmt(t.data.exported, { name }) }
    })

  /** 选好文件后先校验，通过再让用户确认覆盖 */
  async function onPickFile(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = '' // 允许再次选择同一个文件
    if (!file) return
    setNotice(null)
    const parsed = parseBackup(await file.text())
    if (!parsed.ok) {
      setNotice({ kind: 'error', text: fmt(t.data.errors[parsed.error], { detail: parsed.detail ?? '' }) })
      return
    }
    setPending(parsed.backup)
  }

  const importNow = () =>
    run(async () => {
      if (!pending) return null
      await restoreBackup(pending)
      const c = backupCounts(pending)
      return {
        kind: 'ok',
        text: fmt(t.data.importDone, { snapshots: String(c.snapshots), flows: String(c.flows), entries: String(c.entries) }),
      }
    })

  const loadDemo = () =>
    run(async () => {
      const c = await loadDemoData()
      return { kind: 'ok', text: fmt(t.data.loadDemoDone, { snapshots: String(c.snapshots), flows: String(c.flows) }) }
    })

  const clearAll = () =>
    run(async () => {
      await clearAllData()
      return { kind: 'ok', text: t.data.clearDone }
    })

  const counts = pending ? backupCounts(pending) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.data.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{t.data.hint}</p>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t.data.backup}</h3>
          <p className="text-xs text-muted-foreground">{t.data.backupHint}</p>
          <div className="grid gap-2">
            <Button variant="outline" onClick={exportBackup}>
              <Download /> {t.data.exportBackup}
            </Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <Upload /> {t.data.importBackup}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t.data.csv}</h3>
          <p className="text-xs text-muted-foreground">{t.data.csvHint}</p>
          <div className="grid gap-2">
            <Button variant="outline" onClick={exportSnapshots}>
              <Download /> {t.data.exportSnapshots}
            </Button>
            <Button variant="outline" onClick={exportFlows}>
              <Download /> {t.data.exportFlows}
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t.data.demo}</h3>
          <p className="text-xs text-muted-foreground">{t.data.demoHint}</p>
          <div className="grid gap-2">
            <Button variant="outline" onClick={() => setConfirmDemo(true)}>
              <FlaskConical /> {t.data.loadDemo}
            </Button>
            <Button variant="outline" className="text-destructive" onClick={() => setConfirmClear(true)}>
              <Trash2 /> {t.data.clearAll}
            </Button>
          </div>
        </section>

        {notice && (
          <p
            role="status"
            className={notice.kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
          >
            {notice.text}
          </p>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmDemo}
        title={t.data.loadDemoTitle}
        description={t.data.loadDemoBody}
        onConfirm={loadDemo}
        onClose={() => setConfirmDemo(false)}
      />
      <ConfirmDialog
        open={confirmClear}
        title={t.data.clearTitle}
        description={t.data.clearBody}
        onConfirm={clearAll}
        onClose={() => setConfirmClear(false)}
      />
      <ConfirmDialog
        open={!!pending}
        title={t.data.importTitle}
        description={
          pending && counts
            ? fmt(t.data.importBody, {
                date: pending.exportedAt ? format(new Date(pending.exportedAt), 'yyyy-MM-dd HH:mm') : t.data.unknownDate,
                snapshots: String(counts.snapshots),
                flows: String(counts.flows),
                entries: String(counts.entries),
              })
            : ''
        }
        onConfirm={importNow}
        onClose={() => setPending(null)}
      />
    </Card>
  )
}
