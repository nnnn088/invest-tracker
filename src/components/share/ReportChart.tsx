import { useEffect, useRef } from 'react'
import {
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

/**
 * 分享图里的总资产走势图。颜色取自所在的 .force-light 作用域（固定浅色），
 * 不随系统深色模式变化；以 3 倍像素比绘制，保证长图放大后依然清晰。
 * hideAxis：隐藏金额时不显示纵轴数值，只保留走势。
 */
export function ReportChart({
  labels,
  total,
  capital,
  hideAxis,
  onReady,
}: {
  labels: string[]
  total: number[]
  /** 传入则叠加累计净投入本金虚线 */
  capital?: number[]
  hideAxis: boolean
  onReady: () => void
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const readyRef = useRef(onReady)
  readyRef.current = onReady

  useEffect(() => {
    if (!wrap.current || !canvas.current) return
    const cs = getComputedStyle(wrap.current)
    const primary = cs.getPropertyValue('--primary').trim()
    const muted = cs.getPropertyValue('--muted-foreground').trim()
    const border = cs.getPropertyValue('--border').trim()

    const chart = new Chart(canvas.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'total', data: total, borderColor: primary, backgroundColor: primary, borderWidth: 2.5, pointRadius: 0, tension: 0.25 },
          ...(capital
            ? [{ label: 'capital', data: capital, borderColor: muted, backgroundColor: muted, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, tension: 0.25 }]
            : []),
        ],
      },
      options: {
        responsive: false,
        animation: false,
        devicePixelRatio: 3,
        events: [],
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { ticks: { color: muted, maxRotation: 0, autoSkipPadding: 16, font: { size: 10 } }, grid: { display: false }, border: { color: border } },
          y: {
            display: !hideAxis,
            ticks: { color: muted, font: { size: 10 }, callback: (v) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v)) },
            grid: { color: border },
            border: { display: false },
          },
        },
      },
    })
    readyRef.current()
    return () => chart.destroy()
  }, [labels, total, capital, hideAxis])

  return (
    <div ref={wrap}>
      <canvas ref={canvas} width={318} height={170} style={{ width: 318, height: 170 }} />
    </div>
  )
}
