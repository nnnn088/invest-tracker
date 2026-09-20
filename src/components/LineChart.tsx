import { useEffect, useRef } from 'react'
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ScriptableLineSegmentContext,
} from 'chart.js'
import { useCssColors } from '@/hooks/useCssColors'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler)

export interface ChartSeries {
  label: string
  data: (number | null)[]
  color: string
  /** 右侧纵轴（如收益率） */
  axis?: 'y' | 'y1'
  dashed?: boolean
  /** 按数值正负给线段和点着涨跌色（颜色随涨跌配色设置） */
  signColors?: { up: string; down: string }
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

/** Chart.js 折线图封装：数据变化时重建图表；点击某个点回调其序号 */
export function LineChart({
  labels,
  tooltipTitles,
  series,
  formatY,
  formatY1,
  selected,
  onSelect,
}: {
  labels: string[]
  tooltipTitles: string[]
  series: ChartSeries[]
  formatY: (v: number) => string
  formatY1?: (v: number) => string
  selected: number | null
  onSelect: (index: number) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const colors = useCssColors(['foreground', 'muted-foreground', 'border', 'card'] as const)
  // 回调放在 ref 里，避免每次渲染都重建图表
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const hasY1 = series.some((s) => s.axis === 'y1')

  useEffect(() => {
    if (!canvas.current) return
    const chart = new Chart(canvas.current, {
      type: 'line',
      data: {
        labels,
        datasets: series.map((s) => {
          const colorAt = (v: number | null) => (s.signColors && (v ?? 0) < 0 ? s.signColors.down : (s.signColors?.up ?? s.color))
          return {
            label: s.label,
            data: s.data,
            yAxisID: s.axis ?? 'y',
            borderColor: s.signColors ? s.signColors.up : s.color,
            // 图例标记与线条同色：涨跌着色的线以“涨”色为准
            backgroundColor: s.signColors ? s.signColors.up : s.color,
            borderDash: s.dashed ? [6, 4] : undefined,
            borderWidth: 2,
            tension: 0.25,
            spanGaps: true,
            pointRadius: s.data.map((_, i) => (i === selected ? 6 : 3)),
            pointHoverRadius: 6,
            pointBackgroundColor: s.data.map(colorAt),
            pointBorderColor: s.data.map(colorAt),
            segment: s.signColors
              ? { borderColor: (ctx: ScriptableLineSegmentContext) => ((ctx.p1.parsed.y ?? 0) < 0 ? s.signColors!.down : s.signColors!.up) }
              : undefined,
          }
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        onClick: (event, _elements, ch) => {
          const hit = ch.getElementsAtEventForMode(event.native as Event, 'index', { intersect: false }, true)
          if (hit.length) onSelectRef.current(hit[0].index)
        },
        plugins: {
          legend: { labels: { color: colors['muted-foreground'], usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
          tooltip: {
            callbacks: {
              title: (items) => tooltipTitles[items[0].dataIndex] ?? '',
              label: (item) => {
                const v = item.parsed.y
                if (v === null || v === undefined) return `${item.dataset.label}: —`
                const f = item.dataset.yAxisID === 'y1' && formatY1 ? formatY1 : formatY
                return `${item.dataset.label}: ${f(v)}`
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: colors['muted-foreground'], maxRotation: 0, autoSkipPadding: 12 }, grid: { color: colors.border } },
          y: {
            position: 'left',
            ticks: { color: colors['muted-foreground'], callback: (v) => compact.format(Number(v)) },
            grid: { color: colors.border },
          },
          ...(hasY1
            ? {
                y1: {
                  position: 'right' as const,
                  ticks: { color: colors['muted-foreground'], callback: (v: string | number) => (formatY1 ? formatY1(Number(v)) : String(v)) },
                  grid: { drawOnChartArea: false },
                },
              }
            : {}),
        },
      },
    })
    return () => chart.destroy()
  }, [labels, tooltipTitles, series, selected, formatY, formatY1, colors, hasY1])

  return (
    <div className="h-64 w-full">
      <canvas ref={canvas} role="img" />
    </div>
  )
}
