/**
 * 演示数据：用于测试时不必先手动录入。
 * 数据来自 demo-backup.json（按需懒加载，不进主包），载入时把全部日期平移，
 * 让最后一条快照落在“今天”，这样本月、近 3 个月等时段打开永远有内容。
 */
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { restoreBackup, parseBackup } from './backup'
import { db } from './db'
import { getSettings, initData } from './repo'

const DEMO_SEEDED_KEY = 'invest-tracker:demo-seeded'

const shift = (date: string, days: number) => format(addDays(parseISO(date), days), 'yyyy-MM-dd')

/** 用演示数据覆盖现有的平台、条目、快照和本金流水；保留你现有的设置（语言、折算货币、涨跌配色） */
export async function loadDemoData(): Promise<{ snapshots: number; flows: number }> {
  const raw = (await import('./demo-backup.json')).default
  const parsed = parseBackup(JSON.stringify(raw))
  if (!parsed.ok) throw new Error(`invalid demo data: ${parsed.error}`)
  const b = parsed.backup
  const last = b.data.snapshots.reduce((m, s) => (s.date > m ? s.date : m), '')
  const delta = differenceInCalendarDays(new Date(), parseISO(last))
  b.data.snapshots = b.data.snapshots.map((s) => ({ ...s, date: shift(s.date, delta) }))
  b.data.capitalFlows = b.data.capitalFlows.map((f) => ({ ...f, date: shift(f.date, delta) }))
  b.data.settings = await getSettings()
  await restoreBackup(b)
  return { snapshots: b.data.snapshots.length, flows: b.data.capitalFlows.length }
}

/** 清除全部业务数据（条目、快照、本金流水、自定义平台）；保留设置和汇率缓存 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.platforms, db.entries, db.snapshots, db.capitalFlows], async () => {
    await Promise.all([db.platforms.clear(), db.entries.clear(), db.snapshots.clear(), db.capitalFlows.clear()])
  })
  await initData() // 重新补回内置平台
}

async function isDataEmpty(): Promise<boolean> {
  const [entries, snapshots, flows] = await Promise.all([db.entries.count(), db.snapshots.count(), db.capitalFlows.count()])
  return entries + snapshots + flows === 0
}

/**
 * 仅开发模式（npm run dev）：这个浏览器第一次进入且没有任何数据时，自动载入演示数据。
 * 只执行一次（记在 localStorage），之后即使你清空数据也不会再自动灌入；上线版本不会调用。
 */
export async function seedDemoOnFirstDevRun(): Promise<void> {
  if (!import.meta.env.DEV) return
  try {
    if (localStorage.getItem(DEMO_SEEDED_KEY)) return
  } catch {
    /* 存储不可用时按未执行过处理 */
  }
  if (await isDataEmpty()) await loadDemoData()
  try {
    localStorage.setItem(DEMO_SEEDED_KEY, '1')
  } catch {
    /* 忽略 */
  }
}
