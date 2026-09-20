/**
 * 完整备份的生成、校验与还原。
 * 备份包含全部平台、条目、快照、本金流水和设置；汇率缓存可重新获取，不放进备份。
 */
import { CURRENCY_CODES } from './currencies'
import { db, SETTINGS_KEY } from './db'
import { getSettings, initData } from './repo'
import {
  DEFAULT_SETTINGS,
  type CapitalFlow,
  type Entry,
  type Platform,
  type Settings,
  type Snapshot,
} from './types'

export const BACKUP_VERSION = 1

export interface BackupData {
  platforms: Platform[]
  entries: Entry[]
  snapshots: Snapshot[]
  capitalFlows: CapitalFlow[]
  settings: Settings
}

export interface BackupFile {
  app: 'invest-tracker'
  version: number
  /** ISO 时间 */
  exportedAt: string
  data: BackupData
}

export async function buildBackup(): Promise<BackupFile> {
  const [platforms, entries, snapshots, capitalFlows, settings] = await Promise.all([
    db.platforms.orderBy('order').toArray(),
    db.entries.orderBy('order').toArray(),
    db.snapshots.orderBy('date').toArray(),
    db.capitalFlows.orderBy('date').toArray(),
    getSettings(),
  ])
  return {
    app: 'invest-tracker',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { platforms, entries, snapshots, capitalFlows, settings },
  }
}

export function backupCounts(b: BackupFile) {
  const d = b.data
  return {
    platforms: d.platforms.length,
    entries: d.entries.length,
    snapshots: d.snapshots.length,
    flows: d.capitalFlows.length,
  }
}

export type ParseResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; error: 'invalidJson' | 'notBackup' | 'badVersion' | 'badData'; detail?: string }

// ---------- 校验 ----------

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isCurrency = (v: unknown) => isStr(v) && (CURRENCY_CODES as readonly string[]).includes(v)
const isDate = (v: unknown) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v)

function validRates(v: unknown): boolean {
  return isObj(v) && CURRENCY_CODES.every((c) => isNum(v[c]) && (v[c] as number) > 0)
}

/** 返回第一处不合格的位置描述；全部合格返回 null */
function findProblem(d: Obj): string | null {
  const list = (key: string): unknown[] | null => (Array.isArray(d[key]) ? (d[key] as unknown[]) : null)
  const platforms = list('platforms')
  const entries = list('entries')
  const snapshots = list('snapshots')
  const flows = list('capitalFlows')
  if (!platforms) return 'platforms'
  if (!entries) return 'entries'
  if (!snapshots) return 'snapshots'
  if (!flows) return 'capitalFlows'

  for (const [i, p] of platforms.entries()) {
    if (!isObj(p) || !isStr(p.id) || !isStr(p.name) || typeof p.builtin !== 'boolean') return `platforms[${i}]`
  }
  for (const [i, e] of entries.entries()) {
    if (!isObj(e) || !isStr(e.id) || !isStr(e.platformId) || !isCurrency(e.currency)) return `entries[${i}]`
  }
  for (const [i, s] of snapshots.entries()) {
    if (!isObj(s) || !isDate(s.date) || !Array.isArray(s.items) || !validRates(s.rates) || !isObj(s.currencyTotals)) {
      return `snapshots[${i}]`
    }
    for (const it of s.items as unknown[]) {
      if (!isObj(it) || !isStr(it.entryId) || !isNum(it.amount)) return `snapshots[${i}].items`
    }
  }
  for (const [i, f] of flows.entries()) {
    if (
      !isObj(f) ||
      !isStr(f.id) ||
      !isDate(f.date) ||
      !isCurrency(f.currency) ||
      !isNum(f.amount) ||
      f.amount <= 0 ||
      (f.type !== 'in' && f.type !== 'out') ||
      !validRates(f.rates)
    ) {
      return `capitalFlows[${i}]`
    }
  }
  const s = d.settings
  if (!isObj(s) || !isCurrency(s.baseCurrency) || (s.language !== 'zh' && s.language !== 'en')) return 'settings'
  if (s.trendScheme !== 'red-up' && s.trendScheme !== 'green-up') return 'settings'
  return null
}

export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'invalidJson' }
  }
  if (!isObj(raw) || raw.app !== 'invest-tracker' || !isObj(raw.data)) return { ok: false, error: 'notBackup' }
  if (!isNum(raw.version) || raw.version > BACKUP_VERSION) return { ok: false, error: 'badVersion' }
  const problem = findProblem(raw.data)
  if (problem) return { ok: false, error: 'badData', detail: problem }

  const d = raw.data as unknown as BackupData
  // 补齐可能缺失的可选字段
  const platforms = d.platforms.map((p, i) => ({ ...p, color: p.color ?? '#475569', archived: !!p.archived, order: p.order ?? i }))
  const entries = d.entries.map((e, i) => ({ ...e, order: e.order ?? i, archived: !!e.archived }))
  const capitalFlows = d.capitalFlows.map((f, i) => ({ ...f, note: f.note ?? '', createdAt: f.createdAt ?? i }))
  return {
    ok: true,
    backup: {
      app: 'invest-tracker',
      version: raw.version,
      exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : '',
      data: { ...d, platforms, entries, capitalFlows, settings: { ...DEFAULT_SETTINGS, ...d.settings } },
    },
  }
}

// ---------- 还原 ----------

/** 用备份整体覆盖现有数据（不动汇率缓存）；已通过 parseBackup 校验 */
export async function restoreBackup(b: BackupFile): Promise<void> {
  const d = b.data
  await db.transaction('rw', [db.platforms, db.entries, db.snapshots, db.capitalFlows, db.settings], async () => {
    await Promise.all([db.platforms.clear(), db.entries.clear(), db.snapshots.clear(), db.capitalFlows.clear(), db.settings.clear()])
    await db.platforms.bulkAdd(d.platforms)
    await db.entries.bulkAdd(d.entries)
    await db.snapshots.bulkAdd(d.snapshots)
    await db.capitalFlows.bulkAdd(d.capitalFlows)
    await db.settings.put({ key: SETTINGS_KEY, ...d.settings })
  })
  // 备份来自旧版本时，补齐后来新增的内置平台
  await initData()
}
