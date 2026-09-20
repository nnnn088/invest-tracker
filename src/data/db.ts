import Dexie, { type EntityTable } from 'dexie'
import { BUILTIN_PLATFORMS } from './builtin'
import type { CapitalFlow, Entry, Platform, RateCacheRow, Settings, Snapshot } from './types'

/** settings 表只有一行，固定主键 */
export const SETTINGS_KEY = 'main'
type SettingsRow = Settings & { key: typeof SETTINGS_KEY }

class InvestDB extends Dexie {
  platforms!: EntityTable<Platform, 'id'>
  entries!: EntityTable<Entry, 'id'>
  snapshots!: EntityTable<Snapshot, 'date'>
  capitalFlows!: EntityTable<CapitalFlow, 'id'>
  rateCache!: EntityTable<RateCacheRow, 'date'>
  settings!: EntityTable<SettingsRow, 'key'>

  constructor() {
    super('invest-tracker')
    this.version(1).stores({
      platforms: 'id',
      entries: 'id, platformId, order',
      snapshots: 'date',
      capitalFlows: 'id, date',
      rateCache: 'date',
      settings: 'key',
    })
    // v2：平台增加 order 字段，用于固定显示顺序
    this.version(2)
      .stores({ platforms: 'id, order' })
      .upgrade((tx) =>
        tx.table('platforms').toCollection().modify((p) => {
          const i = BUILTIN_PLATFORMS.findIndex((b) => b.id === p.id)
          p.order = i >= 0 ? i : BUILTIN_PLATFORMS.length + 1
        }),
      )
  }
}

// 仅供 src/data 内部使用；界面层一律通过 src/data/repo.ts 读写
export const db = new InvestDB()
export type { SettingsRow }
