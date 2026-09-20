import { useState } from 'react'
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PlatformBadge } from '@/components/PlatformBadge'
import { usePlatforms } from '@/data/hooks'
import {
  PLATFORM_COLORS,
  DuplicatePlatformNameError,
  addPlatform,
  isPlatformReferenced,
  removePlatform,
  restorePlatform,
  updatePlatform,
} from '@/data/repo'
import type { Platform } from '@/data/types'
import { fmt, useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

type FormState = { platform?: Platform } | null
type Pending = { platform: Platform; referenced: boolean } | null

function PlatformForm({ state, onClose }: { state: FormState; onClose: () => void }) {
  const { t } = useI18n()
  const editing = state?.platform
  const [name, setName] = useState(editing?.name ?? '')
  const [color, setColor] = useState(editing?.color ?? PLATFORM_COLORS[0])
  const [error, setError] = useState('')

  async function submit() {
    if (!name.trim()) return setError(t.settings.platformNameRequired)
    try {
      if (editing) await updatePlatform(editing.id, { name, color })
      else await addPlatform(name, color)
      onClose()
    } catch (e) {
      if (e instanceof DuplicatePlatformNameError) setError(t.settings.platformNameDuplicate)
      else throw e
    }
  }

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t.settings.editPlatform : t.settings.addPlatform}</DialogTitle>
          <DialogDescription className="sr-only">{t.settings.platformsHint}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform-name">{t.settings.platformName}</Label>
            <Input
              id="platform-name"
              value={name}
              maxLength={30}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t.common.color}</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'size-8 rounded-full ring-offset-2 ring-offset-background',
                    color === c && 'ring-2 ring-primary',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PlatformBadge platform={{ id: 'preview', name: name || '?', color, builtin: false, archived: false, order: 0 }} />
            {name || '—'}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={submit}>{t.common.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PlatformsSection() {
  const { t } = useI18n()
  const platforms = usePlatforms()
  const [form, setForm] = useState<FormState>(null)
  const [pending, setPending] = useState<Pending>(null)

  const custom = platforms.filter((p) => !p.builtin)
  const active = custom.filter((p) => !p.archived)
  const archived = custom.filter((p) => p.archived)

  async function askRemove(platform: Platform) {
    setPending({ platform, referenced: await isPlatformReferenced(platform.id) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.platforms}</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => setForm({})}>
            <Plus /> {t.common.add}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{t.settings.platformsHint}</p>
        {active.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">{t.settings.platformsEmpty}</p>
        )}
        <ul className="divide-y">
          {active.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <PlatformBadge platform={p} />
              <span className="flex-1 truncate">{p.name}</span>
              <Button size="icon" variant="ghost" aria-label={t.common.edit} onClick={() => setForm({ platform: p })}>
                <Pencil />
              </Button>
              <Button size="icon" variant="ghost" aria-label={t.common.delete} onClick={() => askRemove(p)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>

        {archived.length > 0 && (
          <div className="pt-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">{t.settings.archivedSection}</p>
            <ul className="divide-y">
              {archived.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2 opacity-70">
                  <PlatformBadge platform={p} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => restorePlatform(p.id)}>
                    <RotateCcw /> {t.common.restore}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      {form && <PlatformForm state={form} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={!!pending}
        title={pending?.referenced ? t.settings.archivePlatformTitle : t.settings.deletePlatformTitle}
        description={
          pending
            ? fmt(pending.referenced ? t.settings.archivePlatformBody : t.settings.deletePlatformBody, {
                name: pending.platform.name,
              })
            : ''
        }
        onConfirm={() => pending && removePlatform(pending.platform.id)}
        onClose={() => setPending(null)}
      />
    </Card>
  )
}
