/** CSV 导出：UTF-8 带 BOM（Excel、Numbers 中文不乱码），行尾 CRLF */
import { CURRENCIES, CURRENCY_CODES, type Currency } from '@/data/currencies'
import { convert } from '@/data/rates'
import type { CapitalFlow, Snapshot } from '@/data/types'
import { convertTotals, convertedNetCapital } from './stats'

type Cell = string | number

function escapeCell(v: Cell): string {
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: Cell[][]): string {
  return '﻿' + rows.map((r) => r.map(escapeCell).join(',')).join('\r\n') + '\r\n'
}

/** 数值按币种习惯的小数位输出，不带千分位，方便表格软件直接当数字用 */
const num = (n: number, c: Currency) => n.toFixed(CURRENCIES[c].decimals)

export interface SnapshotCsvLabels {
  date: string
  /** 如 “{cur}资产” */
  assets: (cur: string) => string
  convertedTotal: (cur: string) => string
  capital: (cur: string) => string
  profit: (cur: string) => string
}

/** 快照汇总：每行一个快照日期；列为各币种资产（原币）、折算总额、累计净投入本金（折算）、累计收益（折算） */
export function snapshotsCsv(snapshots: Snapshot[], flows: CapitalFlow[], base: Currency, L: SnapshotCsvLabels): string {
  const sorted = [...snapshots].sort((a, b) => (a.date < b.date ? -1 : 1))
  // 只列出出现过记录的币种
  const currencies = CURRENCY_CODES.filter((c) => sorted.some((s) => s.currencyTotals[c] !== undefined))
  const b = CURRENCIES[base].label
  const header: Cell[] = [L.date, ...currencies.map((c) => L.assets(CURRENCIES[c].label)), L.convertedTotal(b), L.capital(b), L.profit(b)]
  const rows = sorted.map((s) => {
    const total = convertTotals(s.currencyTotals, base, s.rates)
    const capital = convertedNetCapital(flows, s.date, base)
    return [
      s.date,
      ...currencies.map((c) => (s.currencyTotals[c] === undefined ? '' : num(s.currencyTotals[c] ?? 0, c))),
      num(total, base),
      num(capital, base),
      num(total - capital, base),
    ]
  })
  return toCsv([header, ...rows])
}

export interface FlowsCsvLabels {
  date: string
  currency: string
  type: string
  amount: string
  converted: (cur: string) => string
  note: string
  typeName: { in: string; out: string }
}

/** 本金流水：日期、币种、类型、金额、折算金额（按该笔流水当天的汇率）、备注 */
export function flowsCsv(flows: CapitalFlow[], base: Currency, L: FlowsCsvLabels): string {
  const sorted = [...flows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))
  const header: Cell[] = [L.date, L.currency, L.type, L.amount, L.converted(CURRENCIES[base].label), L.note]
  const rows = sorted.map((f) => [
    f.date,
    CURRENCIES[f.currency].label,
    L.typeName[f.type],
    num(f.amount, f.currency),
    num(convert(f.amount, f.currency, base, f.rates), base),
    f.note,
  ])
  return toCsv([header, ...rows])
}
