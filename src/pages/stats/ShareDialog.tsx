import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { Download, Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DEFAULT_REPORT_OPTIONS, ShareReport, type ReportOptions } from '@/components/share/ShareReport'
import { useCapitalFlows, useEntries, usePlatforms, useSnapshots } from '@/data/hooks'
import { fmt, useI18n } from '@/i18n'
import { buildReport } from '@/lib/report'
import type { Range } from '@/lib/range'
import { dataUrlToBlob, downloadBlob, isIOS, renderPng, shareImageFile } from '@/lib/shareImage'
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

/** 生成分享图：先勾选内容，再渲染成 PNG 预览，最后“保存”或“分享” */
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
  const [notice, setNotice] = useState('')
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
    setNotice('')
    setChartReady(false)
    setPng(null)
    setStage('rendering')
  }

  /** 分享：调用系统分享面板发给别人；设备不支持时提示改用“保存” */
  async function share() {
    if (!png) return
    setNotice('')
    const result = await shareImageFile(png.blob, png.name, t.share.report.title)
    if (result === 'unsupported') setNotice(t.share.unsupported)
  }

  /** 保存：iPhone 上全屏显示图片、长按存到相册（主屏幕模式下普通下载不可靠）；其他设备直接下载 */
  function save() {
    if (!png) return
    setNotice('')
    if (isIOS()) {
      setFallback(true)
      return
    }
    downloadBlob(png.blob, png.name)
    setNotice(fmt(t.share.saved, { name: png.name }))
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
            <div className="max-h-[46dvh] overflow-y-auto rounded-lg border bg-muted/40 p-2">
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

          {stage === 'preview' && notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}

          <DialogFooter>
            {stage === 'preview' ? (
              // “保存”和“分享”并排一行，“返回修改”在下面，小屏幕上也不会被挤出弹窗
              <div className="grid w-full grid-cols-2 gap-2">
                <Button variant="outline" onClick={save}>
                  <Download /> {t.share.save}
                </Button>
                <Button onClick={share}>
                  <Share2 /> {t.share.shareAction}
                </Button>
                <Button
                  variant="ghost"
                  className="col-span-2"
                  onClick={() => {
                    setNotice('')
                    setStage('options')
                  }}
                >
                  {t.share.back}
                </Button>
              </div>
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
