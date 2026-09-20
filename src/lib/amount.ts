/** 金额输入框的清洗与解析（录入页、本金页、历史编辑共用） */

/** 只保留数字、一个小数点，以及（allowNegative 时）开头的负号 */
export function sanitizeAmount(v: string, allowNegative = true): string {
  let s = v.replace(/,/g, '').replace(allowNegative ? /[^0-9.-]/g : /[^0-9.]/g, '')
  const neg = allowNegative && s.startsWith('-')
  s = s.replace(/-/g, '')
  const i = s.indexOf('.')
  if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '')
  return (neg ? '-' : '') + s
}

/** 解析失败或留空按 0 处理 */
export function parseAmount(s: string): number {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}
