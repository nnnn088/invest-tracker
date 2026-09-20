import { useLiveQuery } from 'dexie-react-hooks'
import { db, SETTINGS_KEY } from './db'
import { getSnapshotForPrefill, listCapitalFlows } from './repo'
import { DEFAULT_SETTINGS, type CapitalFlow, type Entry, type Platform, type Settings, type Snapshot } from './types'

/** 设置尚未读出时返回 undefined */
export function useSettingsRow(): Settings | undefined {
  return useLiveQuery(async () => {
    const row = await db.settings.get(SETTINGS_KEY)
    return row ? { ...DEFAULT_SETTINGS, ...row } : undefined
  }, [])
}

export function usePlatforms(): Platform[] {
  return useLiveQuery(() => db.platforms.orderBy('order').toArray(), [], [] as Platform[])
}

/** 按 order 排序的全部条目（含已归档，由调用方过滤） */
export function useEntries(): Entry[] {
  return useLiveQuery(() => db.entries.orderBy('order').toArray(), [], [] as Entry[])
}

export function useCapitalFlows(): CapitalFlow[] {
  return useLiveQuery(() => listCapitalFlows(), [], [] as CapitalFlow[])
}

/** 录入页预填数据；尚未读出时返回 undefined */
export function useSnapshotForPrefill(date: string) {
  return useLiveQuery(() => getSnapshotForPrefill(date), [date])
}

/** 全部快照，日期倒序 */
export function useSnapshots(): Snapshot[] | undefined {
  return useLiveQuery(() => db.snapshots.orderBy('date').reverse().toArray(), [])
}

export function useSnapshot(date: string): Snapshot | null | undefined {
  // 不存在时返回 null，尚未读出时返回 undefined
  return useLiveQuery(async () => (await db.snapshots.get(date)) ?? null, [date])
}
