import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { zh, type Dict } from './zh'
import { en } from './en'
import type { Lang } from '@/data/types'

const dicts: Record<Lang, Dict> = { zh, en }

interface I18nValue {
  lang: Lang
  t: Dict
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => ({ lang, t: dicts[lang] }), [lang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const v = useContext(I18nContext)
  if (!v) throw new Error('useI18n must be used inside I18nProvider')
  return v
}

/** 替换文案中的 {name} 之类占位符 */
export function fmt(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
}
