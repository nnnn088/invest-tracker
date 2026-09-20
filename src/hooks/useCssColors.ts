import { useEffect, useState } from 'react'

/** 读取 CSS 变量的实际颜色值；深色模式、涨跌配色切换时自动更新，供 Chart.js 这类无法直接用 CSS 变量的场景使用 */
export function useCssColors<T extends string>(names: readonly T[]): Record<T, string> {
  const read = () => {
    const style = getComputedStyle(document.documentElement)
    return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(`--${n}`).trim()])) as Record<T, string>
  }
  const [colors, setColors] = useState(read)
  useEffect(() => {
    const update = () => setColors(read())
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-trend'] })
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return colors
}
