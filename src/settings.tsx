import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useSettingsRow } from '@/data/hooks'
import { updateSettings } from '@/data/repo'
import type { Settings } from '@/data/types'
import { I18nProvider } from '@/i18n'
import { en } from '@/i18n/en'
import { zh } from '@/i18n/zh'

const SettingsContext = createContext<Settings | null>(null)

export function useSettings(): Settings {
  const v = useContext(SettingsContext)
  if (!v) throw new Error('useSettings must be used inside SettingsProvider')
  return v
}

export { updateSettings }

/** 读取设置，并把语言、涨跌配色、深色模式应用到页面 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useSettingsRow()

  useEffect(() => {
    if (!settings) return
    document.documentElement.dataset.trend = settings.trendScheme
    document.documentElement.lang = settings.language === 'zh' ? 'zh-CN' : 'en'
    document.title = (settings.language === 'zh' ? zh : en).appName
  }, [settings])

  // 跟随系统深色模式
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  if (!settings) return null
  return (
    <SettingsContext.Provider value={settings}>
      <I18nProvider lang={settings.language}>{children}</I18nProvider>
    </SettingsContext.Provider>
  )
}
