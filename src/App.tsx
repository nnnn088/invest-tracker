import { lazy, Suspense, useEffect, useState } from 'react'
import { PencilLine, Wallet, History, LineChart, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { UpdatePrompt } from '@/components/UpdatePrompt'

// 按页面拆包：图表库等较大的依赖只在进入对应页面时才加载（Service Worker 会预缓存全部，离线也能用）
const EntryPage = lazy(() => import('@/pages/EntryPage').then((m) => ({ default: m.EntryPage })))
const HistoryPage = lazy(() => import('@/pages/HistoryPage').then((m) => ({ default: m.HistoryPage })))
const StatsPage = lazy(() => import('@/pages/StatsPage').then((m) => ({ default: m.StatsPage })))
const CapitalPage = lazy(() => import('@/pages/CapitalPage').then((m) => ({ default: m.CapitalPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

type Tab = 'entry' | 'capital' | 'history' | 'stats' | 'settings'

const tabs: { id: Tab; icon: typeof PencilLine }[] = [
  { id: 'entry', icon: PencilLine },
  { id: 'history', icon: History },
  { id: 'stats', icon: LineChart },
  { id: 'capital', icon: Wallet },
  { id: 'settings', icon: Settings },
]

export default function App() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('stats')
  // 录入页第一次进入后一直保持挂载，切换标签时不会丢失已输入的内容
  const [entryVisited, setEntryVisited] = useState(false)
  useEffect(() => {
    if (tab === 'entry') setEntryVisited(true)
  }, [tab])

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <UpdatePrompt />
      <header className="px-4 pb-2 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <h1 className="text-lg font-semibold">{t.nav[tab]}</h1>
      </header>
      <main className="flex-1 px-4 pb-24">
        <Suspense fallback={null}>
          {(entryVisited || tab === 'entry') && (
            <div hidden={tab !== 'entry'}>
              <EntryPage onGoSettings={() => setTab('settings')} />
            </div>
          )}
          {tab === 'history' && <HistoryPage onGoEntry={() => setTab('entry')} />}
          {tab === 'stats' && <StatsPage onGoEntry={() => setTab('entry')} />}
          {tab === 'capital' && <CapitalPage />}
          {tab === 'settings' && <SettingsPage />}
        </Suspense>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex h-[var(--nav-h)] max-w-2xl">
          {tabs.map(({ id, icon: Icon }) => (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={cn(
                  'flex w-full flex-col items-center gap-0.5 py-2 text-xs',
                  tab === id ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5" />
                {t.nav[id]}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
