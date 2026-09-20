import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DEFAULT_REPORT_OPTIONS, ShareReport, type ReportOptions } from '@/components/share/ShareReport'
import { useCapitalFlows, useEntries, usePlatforms, useSnapshots } from '@/data/hooks'
import { useI18n } from '@/i18n'
import { buildReport } from '@/lib/report'
import type { Range } from '@/lib/range'
import { dataUrlToBlob, renderPng, shareImageFile } from '@/lib/shareImage'
import { cn } from '@/lib/utils'
import { useSettings } from '@/settings'

type Stage = 'options' | 'rendering' | 'preview'

function Check({
  checked,
  onChange,
  disabled,
  indent,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  indent?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={cn('flex items-center gap-3 py-1.5 text-sm', indent && 'pl-7', disabled && 'opacity-40')}>
      <input
        type="checkbox"
        className="size-4 accent-[var(--primary)]"
        checked={checked && !disabled}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  )
}

/** 生成分享图：先勾选内容，再渲染成 PNG 预览，最后分享/保存 */
export function ShareDialog({ range, onClose }: { range: Range; onClose: () => void }) {
  const { t } = useI18n()
  const { baseCurrency } = useSettings()
  const snapshots = useSnapshots()
  const flows = useCapitalFlows()
  const entries = useEntries()
  const platforms = usePlatforms()

  const [opts, setOpts] = useState<ReportOptions>(DEFAULT_REPORT_OPTIONS)
  const [stage, setStage] = useState<Stage>('options')
  const [chartReady, setChartReady] = useState(false)
  const [png, setPng] = useState<{ url: string; blob: Blob; name: string } | null>(null)
  const [error, setError] = useState('')
  const [fallback, setFallback] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const runId = useRef(0)

  const data = useMemo(
    () => (snapshots ? buildReport(snapshots, flows, entries, platforms, range, baseCurrency) : null),
    [snapshots, flows, entries, platforms, range, baseCurrency],
  )
  const today = format(new Date(), 'yyyy-MM-dd')
  const set = (patch: Partial<ReportOptions>) => setOpts((o) => ({ ...o, ...patch }))
  const needsChart = opts.chart && !!data?.chart

  // 渲染阶段：报告挂载到屏幕外并画好图表后，转成 PNG
  useEffect(() => {
    if (stage !== 'rendering' || !data || (needsChart && !chartReady)) return
    const id = ++runId.current
    ;(async () => {
      try {
        if (!stageRef.current) return
        const url = await renderPng(stageRef.current)
        if (id !== runId.current) return
        const blob = await dataUrlToBlob(url)
        if (id !== runId.current) return
        setPng({ url: URL.createObjectURL(blob), blob, name: `invest-report-${today}.png` })
        setStage('preview')
      } catch {
        if (id === runId.current) {
          setError(t.share.failed)
          setStage('options')
        }
      }
    })()
  }, [stage, chartReady, needsChart, data, today, t.share.failed])

  // 换图或关闭时释放对象 URL
  useEffect(() => {
    return () => {
      if (png) URL.revokeObjectURL(png.url)
    }
  }, [png])

  function generate() {
    setError('')
    setChartReady(false)
    setPng(null)
    setStage('rendering')
  }

  async function share() {
    if (!png) return
    const result = await shareImageFile(png.blob, png.name, t.share.report.title)
    if (result === 'unsupported') setFallback(true)
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.share.title}</DialogTitle>
            <DialogDescription>{t.share.optionsHint}</DialogDescription>
          </DialogHeader>

          {!data ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.share.noData}</p>
          ) : stage === 'preview' && png ? (
            <div className="max-h-[58dvh] overflow-y-auto rounded-lg border bg-muted/40 p-2">
              <img src={png.url} alt={t.share.report.title} className="w-full rounded-md" />
            </div>
          ) : (
            <div className="space-y-1">
              <Check checked={opts.total} onChange={(v) => set({ total: v })}>{t.share.sections.total}</Check>
              <Check checked={opts.currencies} onChange={(v) => set({ currencies: v })}>{t.share.sections.currencies}</Check>
              <Check checked={opts.profit} onChange={(v) => set({ profit: v })}>{t.share.sections.profit}</Check>
              <Check indent disabled={!opts.profit} checked={opts.perCurrency} onChange={(v) => set({ perCurrency: v })}>
                {t.share.sections.perCurrency}
              </Check>
              <Check checked={opts.chart} onChange={(v) => set({ chart: v })}>{t.share.sections.chart}</Check>
              <Check indent disabled={!opts.chart} checked={opts.overlay} onChange={(v) => set({ overlay: v })}>
                {t.share.sections.overlay}
              </Check>
              <Check checked={opts.platforms} onChange={(v) => set({ platforms: v })}>{t.share.sections.platforms}</Check>
              <div className="mt-2 rounded-lg bg-muted px-3 py-2">
                <Check checked={opts.hide} onChange={(v) => set({ hide: v })}>{t.share.hideAmounts}</Check>
                <p className="pb-1 pl-7 text-xs text-muted-foreground">{t.share.hideHint}</p>
              </div>
              {error && <p className="pt-2 text-sm text-destructive">{error}</p>}
            </div>
          )}

          <DialogFooter>
            {stage === 'preview' ? (
              <>
                <Button variant="outline" onClick={() => setStage('options')}>{t.share.back}</Button>
                <Button onClick={share}>{t.share.shareSave}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>{t.share.close}</Button>
                <Button disabled={!data || stage === 'rendering'} onClick={generate}>
                  {stage === 'rendering' ? t.share.generating : t.share.generate}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 屏幕外渲染的汇报视图：只在生成时存在，转成 PNG 后即卸载 */}
      {stage === 'rendering' &&
        data &&
        createPortal(
          <div style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }} aria-hidden>
            <ShareReport ref={stageRef} data={data} opts={opts} generatedOn={today} onChartReady={() => setChartReady(true)} />
          </div>,
          document.body,
        )}

      {/* 不支持系统分享时：全屏显示图片，长按保存；桌面浏览器可点“下载” */}
      {fallback &&
        png &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
            <div className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.share.longPress}</p>
                <p className="text-xs text-white/70">{t.share.longPressHint}</p>
              </div>
              <a
                href={png.url}
                download={png.name}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-white/15 px-3 text-sm"
              >
                <Download className="size-4" /> {t.share.download}
              </a>
              <button type="button" aria-label={t.share.close} onClick={() => setFallback(false)} className="rounded-md bg-white/15 p-2">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-6">
              <img src={png.url} alt={t.share.report.title} className="mx-auto w-full max-w-md" />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
