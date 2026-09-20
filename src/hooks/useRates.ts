import { useCallback, useEffect, useRef, useState } from 'react'
import { getRates, type RatesResult } from '@/data/rates'

/** 按日期获取汇率；日期变化自动重新获取，忽略过期的请求结果 */
export function useRates(date: string) {
  const [result, setResult] = useState<RatesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [useFallback, setUseFallback] = useState(false)
  const token = useRef(0)

  const load = useCallback(async (d: string, force: boolean) => {
    const mine = ++token.current
    setLoading(true)
    setUseFallback(false)
    const r = await getRates(d, force)
    if (mine !== token.current) return
    setResult(r)
    setLoading(false)
  }, [])

  useEffect(() => {
    setResult(null)
    void load(date, false)
  }, [date, load])

  const reload = useCallback(() => load(date, true), [date, load])

  /** 当前可用的汇率表：成功获取的，或用户选择使用的最近缓存 */
  const rates = result?.ok ? result.rates : useFallback ? (result?.fallback?.rates ?? null) : null
  const effectiveDate = result?.ok ? result.effectiveDate : useFallback ? (result?.fallback?.effectiveDate ?? null) : null

  return { result, loading, useFallback, setUseFallback, reload, rates, effectiveDate }
}
