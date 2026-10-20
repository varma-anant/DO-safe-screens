import { format, formatDistanceToNowStrict, differenceInCalendarDays } from 'date-fns'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

const valid = (iso?: string) => !!iso && !Number.isNaN(new Date(iso).getTime())

export const fmtDate = (iso?: string) => (valid(iso) ? format(new Date(iso!), 'MMM d, yyyy') : '—')
export const fmtDateTime = (iso?: string) => (valid(iso) ? format(new Date(iso!), 'MMM d, yyyy HH:mm') : '—')
export const fmtTime = (iso?: string) => (valid(iso) ? format(new Date(iso!), 'HH:mm') : '—')
export const fmtRelative = (iso?: string) => {
  if (!valid(iso)) return '—'
  const d = new Date(iso!)
  return Math.abs(Date.now() - d.getTime()) < 45_000 ? 'just now' : `${formatDistanceToNowStrict(d)} ${d.getTime() > Date.now() ? 'from now' : 'ago'}`
}
export const daysUntil = (iso?: string) => (valid(iso) ? differenceInCalendarDays(new Date(iso!), new Date()) : 0)
export const daysSince = (iso?: string) => (valid(iso) ? differenceInCalendarDays(new Date(), new Date(iso!)) : 0)

export const fmtMoney = (n: number, compact = true) =>
  compact
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: n >= 1_000_000 ? 1 : 0 }).format(n)
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
export const fmtNum = (n: number) => new Intl.NumberFormat('en-US').format(n)
export const fmtPct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`

export const titleCase = (s: string) => s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
  const blob = new Blob([`# DO SAFE demo export — simulated data\n${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(filename: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
