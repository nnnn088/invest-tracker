/**
 * 统一的数据访问模块：界面层所有读写都经由这里，
 * 便于以后接入云端同步而不用改界面代码。
 */
import { db, SETTINGS_KEY } from './db'
import { BUILTIN_PLATFORMS } from './builtin'
import type { Currency } from './currencies'
import { DEFAULT_SETTINGS, type CapitalFlow, type RateCacheRow, type Settings, type Snapshot } from './types'

/** 自定义平台可选的徽标颜色 */
export const PLATFORM_COLORS = [
  '#0f766e', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#475569',
]

const uid = () => crypto.randomUUID()

export class DuplicateEntryError extends Error {
  constructor() {
    super('duplicate entry')
  }
}

export class DuplicatePlatformNameError extends Error {
  constructor() {
    super('duplicate platform name')
  }
}

const normName = (name: string) => name.trim().toLowerCase()

/** 名称与任何已有平台（含内置、已归档）重复；editingId 用于编辑时排除自己 */
async function assertPlatformNameFree(name: string, editingId?: string): Promise<void> {
  const target = normName(name)
  const all = await db.platforms.toArray()
  if (all.some((p) => p.id !== editingId && normName(p.name) === target)) {
    throw new DuplicatePlatformNameError()
  }
}

// ---------- 初始化 ----------

/** 幂等：补齐缺失的内置平台与默认设置 */
export async function initData(): Promise<void> {
  await db.transaction('rw', db.platforms, db.settings, async () => {
    for (const [i, p] of BUILTIN_PLATFORMS.entries()) {
      if (!(await db.platforms.get(p.id))) {
        await db.platforms.add({ ...p, builtin: true, archived: false, order: i })
      }
    }
    if (!(await db.settings.get(SETTINGS_KEY))) {
      await db.settings.add({ key: SETTINGS_KEY, ...DEFAULT_SETTINGS })
    }
  })
}

// ---------- 设置 ----------

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...row }
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await db.settings.update(SETTINGS_KEY, patch)
}

// ---------- 引用检查 ----------

async function referencedEntryIds(): Promise<Set<string>> {
  const ids = new Set<string>()
  await db.snapshots.each((s) => s.items.forEach((i) => ids.add(i.entryId)))
  return ids
}

/** 该平台下是否有条目被历史快照引用 */
export async function isPlatformReferenced(platformId: string): Promise<boolean> {
  const [entries, used] = await Promise.all([
    db.entries.where('platformId').equals(platformId).toArray(),
    referencedEntryIds(),
  ])
  return entries.some((e) => used.has(e.id))
}

export async function isEntryReferenced(entryId: string): Promise<boolean> {
  return (await referencedEntryIds()).has(entryId)
}

// ---------- 平台 ----------

export async function addPlatform(name: string, color: string): Promise<void> {
  await assertPlatformNameFree(name)
  const last = await db.platforms.orderBy('order').last()
  await db.platforms.add({
    id: uid(),
    name: name.trim(),
    color,
    builtin: false,
    archived: false,
    order: (last?.order ?? BUILTIN_PLATFORMS.length) + 1,
  })
}

export async function updatePlatform(id: string, patch: { name: string; color: string }): Promise<void> {
  const p = await db.platforms.get(id)
  if (!p || p.builtin) return
  await assertPlatformNameFree(patch.name, id)
  await db.platforms.update(id, { name: patch.name.trim(), color: patch.color })
}

/** 未被引用则真正删除（连同其条目）；已被引用则归档。返回实际结果 */
export async function removePlatform(id: string): Promise<'deleted' | 'archived'> {
  const p = await db.platforms.get(id)
  if (!p || p.builtin) throw new Error('builtin platforms cannot be removed')
  const referenced = await isPlatformReferenced(id)
  await db.transaction('rw', db.platforms, db.entries, async () => {
    if (referenced) {
      await db.platforms.update(id, { archived: true })
      await db.entries.where('platformId').equals(id).modify({ archived: true })
    } else {
      await db.entries.where('platformId').equals(id).delete()
      await db.platforms.delete(id)
    }
  })
  return referenced ? 'archived' : 'deleted'
}

export async function restorePlatform(id: string): Promise<void> {
  await db.platforms.update(id, { archived: false })
}

// ---------- 条目 ----------

/** “平台 + 币种”不可重复；若命中已归档条目则直接恢复它 */
export async function addEntry(platformId: string, currency: Currency): Promise<void> {
  await db.transaction('rw', db.entries, db.platforms, async () => {
    const same = (await db.entries.where('platformId').equals(platformId).toArray()).find(
      (e) => e.currency === currency,
    )
    if (same && !same.archived) throw new DuplicateEntryError()
    if (same) {
      await db.entries.update(same.id, { archived: false, order: await nextOrder() })
      await db.platforms.update(platformId, { archived: false })
      return
    }
    await db.entries.add({ id: uid(), platformId, currency, order: await nextOrder(), archived: false })
  })
}

async function nextOrder(): Promise<number> {
  const last = await db.entries.orderBy('order').last()
  return (last?.order ?? 0) + 1
}

/** 与相邻的未归档条目交换顺序 */
export async function moveEntry(id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.entries, async () => {
    const list = (await db.entries.orderBy('order').toArray()).filter((e) => !e.archived)
    const i = list.findIndex((e) => e.id === id)
    const j = i + direction
    if (i < 0 || j < 0 || j >= list.length) return
    await db.entries.update(list[i].id, { order: list[j].order })
    await db.entries.update(list[j].id, { order: list[i].order })
  })
}

export async function removeEntry(id: string): Promise<'deleted' | 'archived'> {
  const referenced = await isEntryReferenced(id)
  if (referenced) await db.entries.update(id, { archived: true })
  else await db.entries.delete(id)
  return referenced ? 'archived' : 'deleted'
}

export async function restoreEntry(id: string): Promise<void> {
  const e = await db.entries.get(id)
  if (!e) return
  await db.transaction('rw', db.entries, db.platforms, async () => {
    await db.entries.update(id, { archived: false, order: await nextOrder() })
    await db.platforms.update(e.platformId, { archived: false })
  })
}

// ---------- 汇率缓存 ----------

export async function getRateCache(date: string): Promise<RateCacheRow | undefined> {
  return db.rateCache.get(date)
}

export async function putRateCache(row: RateCacheRow): Promise<void> {
  await db.rateCache.put(row)
}

/** 离线兜底：离指定日期最近的一条缓存（优先不晚于该日期的） */
export async function getNearestRateCache(date: string): Promise<RateCacheRow | undefined> {
  const before = await db.rateCache.where('date').belowOrEqual(date).last()
  if (before) return before
  return db.rateCache.where('date').above(date).first()
}

// ---------- 快照 ----------

export async function getSnapshot(date: string): Promise<Snapshot | undefined> {
  return db.snapshots.get(date)
}

/**
 * 录入页预填用：该日期已有快照则返回它（exact = true）；
 * 否则返回该日期之前最近的一次，再没有就取最新的一次。
 */
export async function getSnapshotForPrefill(date: string): Promise<{ snapshot?: Snapshot; exact: boolean }> {
  const same = await db.snapshots.get(date)
  if (same) return { snapshot: same, exact: true }
  const before = await db.snapshots.where('date').below(date).last()
  if (before) return { snapshot: before, exact: false }
  return { snapshot: await db.snapshots.orderBy('date').last(), exact: false }
}

/** 保存快照；同一日期已存在则覆盖 */
export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  await db.snapshots.put(snapshot)
}

// ---------- 本金流水（界面在第 5 步实现，这里先提供读取供收益统计使用） ----------

export async function listCapitalFlows(): Promise<CapitalFlow[]> {
  return db.capitalFlows.orderBy('date').toArray()
}

export type CapitalFlowInput = Omit<CapitalFlow, 'id' | 'createdAt'>

export async function addCapitalFlow(input: CapitalFlowInput): Promise<void> {
  if (!(input.amount > 0)) throw new Error('amount must be positive')
  await db.capitalFlows.add({ ...input, note: input.note.trim(), id: uid(), createdAt: Date.now() })
}

export async function updateCapitalFlow(id: string, input: CapitalFlowInput): Promise<void> {
  if (!(input.amount > 0)) throw new Error('amount must be positive')
  await db.capitalFlows.update(id, { ...input, note: input.note.trim() })
}

export async function deleteCapitalFlow(id: string): Promise<void> {
  await db.capitalFlows.delete(id)
}

export async function deleteSnapshot(date: string): Promise<void> {
  await db.snapshots.delete(date)
}
