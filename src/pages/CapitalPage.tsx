import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CurrencyLabel } from '@/components/CurrencyLabel'
import { CURRENCIES, formatAmount } from '@/data/currencies'
import { useCapitalFlows } from '@/data/hooks'
import { convert } from '@/data/rates'
import { deleteCapitalFlow } from '@/data/repo'
import type { CapitalFlow } from '@/data/types'
import { fmt, useI18n } from '@/i18n'
import { formatSigned } from '@/lib/format'
import { summarizeCapital, type FlowTotals } from '@/lib/stats'
import { useSettings } from '@/settings'
import { FlowDialog } from './capital/FlowDialog'

function TotalsGrid({ totals, currency }: { totals: FlowTotals; currency: keyof typeof CURRENCIES }) {
  const { t } = useI18n()
  const cells = [
    { label: t.capital.totalIn, value: formatAmount(totals.in, currency) },
    { label: t.capital.totalOut, value: formatAmount(totals.out, currency) },
    { label: t.capital.net, value: formatSigned(totals.net, currency), strong: true },
  ]
  return (
    <dl className="grid grid-cols-3 gap-2">
      {cells.map((c) => (
        <div key={c.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{c.label}</dt>
          <dd className={c.strong ? 'truncate text-sm font-semibold tabular-nums' : 'truncate text-sm tabular-nums'}>
            {c.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function CapitalPage() {
  const { t } = useI18n()
  const { baseCurrency } = useSettings()
  const flows = useCapitalFlows()
  const [editing, setEditing] = useState<{ flow?: CapitalFlow } | null>(null)
  const [deleting, setDeleting] = useState<CapitalFlow | null>(null)

  const summary = useMemo(() => summarizeCapital(flows, baseCurrency), [flows, baseCurrency])
  // 日期倒序；同一天按录入先后倒序
  const sorted = useMemo(
    () => [...flows].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)),
    [flows],
  )

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => setEditing({})}>
        <Plus /> {t.capital.add}
      </Button>

      {flows.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 py-8 text-center">
            <p className="font-medium">{t.capital.empty}</p>
            <p className="text-sm text-muted-foreground">{t.capital.emptyHint}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.capital.summary}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <section className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground">
                  {fmt(t.capital.converted, { cur: CURRENCIES[baseCurrency].label })}
                </h3>
                <TotalsGrid totals={summary.converted} currency={baseCurrency} />
              </section>
              <section className="space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground">{t.capital.original}</h3>
                {summary.perCurrency.map((row) => (
                  <div key={row.currency} className="space-y-1 border-t pt-3">
                    <CurrencyLabel currency={row.currency} />
                    <TotalsGrid totals={row} currency={row.currency} />
                  </div>
                ))}
              </section>
              <p className="text-xs text-muted-foreground">{t.capital.summaryHint}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.capital.list}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {sorted.map((f) => {
                  const signed = f.type === 'in' ? f.amount : -f.amount
                  const inBase = convert(signed, f.currency, baseCurrency, f.rates)
                  return (
                    <li key={f.id} className="flex items-center gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="tabular-nums text-muted-foreground">{f.date}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t.capital[f.type]}</span>
                        </div>
                        <div className="mt-0.5 flex items-baseline gap-2">
                          <span className="font-medium tabular-nums">{formatAmount(f.amount, f.currency, true)}</span>
                          {f.currency !== baseCurrency && (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              ≈ {formatAmount(Math.abs(inBase), baseCurrency, true)}
                            </span>
                          )}
                        </div>
                        {f.note && <p className="mt-0.5 truncate text-xs text-muted-foreground">{f.note}</p>}
                      </div>
                      <Button size="icon" variant="ghost" aria-label={t.common.edit} onClick={() => setEditing({ flow: f })}>
                        <Pencil />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={t.common.delete} onClick={() => setDeleting(f)}>
                        <Trash2 />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      {editing && <FlowDialog flow={editing.flow} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={t.capital.deleteTitle}
        description={
          deleting
            ? fmt(t.capital.deleteBody, {
                date: deleting.date,
                type: t.capital[deleting.type],
                amount: formatAmount(deleting.amount, deleting.currency, true),
              })
            : ''
        }
        onConfirm={() => deleting && deleteCapitalFlow(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
