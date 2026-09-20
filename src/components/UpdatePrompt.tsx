import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

export function UpdatePrompt() {
  const { t } = useI18n()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm shadow-lg">
      <span>{t.update.available}</span>
      <span className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
          {t.update.later}
        </Button>
        <Button size="sm" onClick={() => updateServiceWorker(true)}>
          {t.update.refresh}
        </Button>
      </span>
    </div>
  )
}
