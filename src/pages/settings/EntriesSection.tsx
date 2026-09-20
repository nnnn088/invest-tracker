import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CurrencyLabel } from '@/components/CurrencyLabel'
import { PlatformBadge } from '@/components/PlatformBadge'
import { CURRENCIES, CURRENCY_CODES, type Currency } from '@/data/currencies'
import { useEntries, usePlatforms } from '@/data/hooks'
import {
  DuplicateEntryError,
  addEntry,
  isEntryReferenced,
  moveEntry,
  removeEntry,
  restoreEntry,
} from '@/data/repo'
import type { Entry, Platform } from '@/data/types'
import { fmt, useI18n } from '@/i18n'

function AddEntryDialog({
  open,
  platforms,
  onClose,
}: {
  open: boolean
  platforms: Platform[]
  onClose: () => void
}) {
  const { t } = useI18n()
  const [platformId, setPlatformId] = useState('')
  const [currency, setCurrency] = useState<Currency | ''>('')
  const [error, setError] = useState('')

  async function submit() {
    if (!platformId || !currency) return
    try {
      await addEntry(platformId, currency)
      onClose()
    } catch (e) {
      if (e instanceof DuplicateEntryError) setError(t.settings.entryDuplicate)
      else throw e
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.settings.addEntry}</DialogTitle>
          <DialogDescription className="sr-only">{t.settings.entriesHint}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t.settings.platform}</Label>
            <Select
              value={platformId}
              onValueChange={(v) => {
                setPlatformId(v)
                setError('')
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.settings.choosePlatform} />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="inline-flex items-center gap-2">
                      <PlatformBadge platform={p} className="size-5 text-xs" />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.settings.currency}</Label>
            <Select
              value={currency}
              onValueChange={(v) => {
                setCurrency(v as Currency)
                setError('')
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.settings.chooseCurrency} />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_CODES.map((c) => (
                  <SelectItem key={c} value={c}>
                    <CurrencyLabel currency={c} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button disabled={!platformId || !currency} onClick={submit}>
            {t.common.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EntriesSection() {
  const { t } = useI18n()
  const platforms = usePlatforms()
  const entries = useEntries()
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState<{ entry: Entry; referenced: boolean } | null>(null)

  const platformOf = (id: string) => platforms.find((p) => p.id === id)
  const entryName = (e: Entry) => `${platformOf(e.platformId)?.name ?? ''} · ${CURRENCIES[e.currency].label}`
  const active = entries.filter((e) => !e.archived)
  const archived = entries.filter((e) => e.archived)

  async function askRemove(entry: Entry) {
    setPending({ entry, referenced: await isEntryReferenced(entry.id) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.entries}</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus /> {t.common.add}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{t.settings.entriesHint}</p>
        {active.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t.common.empty}</p>}
        <ul className="divide-y">
          {active.map((e, i) => {
            const p = platformOf(e.platformId)
            return (
              <li key={e.id} className="flex items-center gap-2 py-2">
                {p && <PlatformBadge platform={p} />}
                <span className="flex-1 truncate">
                  {p?.name} <span className="text-muted-foreground">·</span>{' '}
                  <CurrencyLabel currency={e.currency} />
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t.common.moveUp}
                  disabled={i === 0}
                  onClick={() => moveEntry(e.id, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t.common.moveDown}
                  disabled={i === active.length - 1}
                  onClick={() => moveEntry(e.id, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button size="icon" variant="ghost" aria-label={t.common.delete} onClick={() => askRemove(e)}>
                  <Trash2 />
                </Button>
              </li>
            )
          })}
        </ul>

        {archived.length > 0 && (
          <div className="pt-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">{t.settings.archivedSection}</p>
            <ul className="divide-y">
              {archived.map((e) => {
                const p = platformOf(e.platformId)
                return (
                  <li key={e.id} className="flex items-center gap-3 py-2 opacity-70">
                    {p && <PlatformBadge platform={p} />}
                    <span className="flex-1 truncate">{entryName(e)}</span>
                    <Button size="sm" variant="ghost" onClick={() => restoreEntry(e.id)}>
                      <RotateCcw /> {t.common.restore}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>

      {adding && (
        <AddEntryDialog open platforms={platforms.filter((p) => !p.archived)} onClose={() => setAdding(false)} />
      )}
      <ConfirmDialog
        open={!!pending}
        title={pending?.referenced ? t.settings.archiveEntryTitle : t.settings.deleteEntryTitle}
        description={
          pending
            ? fmt(pending.referenced ? t.settings.archiveEntryBody : t.settings.deleteEntryBody, {
                name: entryName(pending.entry),
              })
            : ''
        }
        onConfirm={() => pending && removeEntry(pending.entry.id)}
        onClose={() => setPending(null)}
      />
    </Card>
  )
}
