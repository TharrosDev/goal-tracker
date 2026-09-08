import type { ISODate, ISOTime } from './types'

/**
 * Day-granular date maths, ported unchanged from the v1 app.
 *
 * Deliberately naive: dates are 'YYYY-MM-DD' strings parsed as UTC midnight and
 * differenced in whole days. `Math.round` absorbs the one-hour drift a DST
 * boundary introduces, which is exactly why it is a round and not a floor.
 * Deadlines here are calendar facts, not instants — no timezone library needed.
 */
export const DAY_MS = 86_400_000

export const toISODate = (d: Date = new Date()): ISODate => d.toISOString().slice(0, 10)
export const today = (): ISODate => toISODate()
export const now = (): ISOTime => new Date().toISOString()

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export const days = (from: ISODate, to: ISODate): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)

/** The calendar day an instant fell on. */
export const dayOf = (at: ISOTime): ISODate => at.slice(0, 10)

export const addDays = (date: ISODate, n: number): ISODate =>
  toISODate(new Date(Date.parse(date) + n * DAY_MS))

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** Fixed-width day first, so a column of dates aligns. Inherited from v1. */
export function fmtDate(iso: ISODate): string {
  const [y, m, d] = iso.split('-')
  return `${d} ${MONTHS[Number(m) - 1] ?? '???'} ${y}`
}

export const fmtDateShort = (iso: ISODate): string => {
  const [, m, d] = iso.split('-')
  return `${d} ${MONTHS[Number(m) - 1] ?? '???'}`
}

/** ISO week key 'YYYY-Www' — the bucket the Time Machine and streak maths use. */
export function weekKey(date: ISODate): string {
  const d = new Date(Date.parse(date))
  const day = (d.getUTCDay() + 6) % 7 // Monday = 0
  d.setUTCDate(d.getUTCDate() - day + 3) // nearest Thursday defines the ISO year
  const year = d.getUTCFullYear()
  const jan4 = Date.UTC(year, 0, 4)
  const week = 1 + Math.round((d.getTime() - jan4) / DAY_MS / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export const monthKey = (date: ISODate): string => date.slice(0, 7)

/** Monday of the week containing `date`. */
export function weekStart(date: ISODate): ISODate {
  const d = new Date(Date.parse(date))
  return addDays(date, -((d.getUTCDay() + 6) % 7))
}

/** How far through the current year/month/week we are, 0..1. */
export function periodProgress(date: ISODate = today()) {
  const d = new Date(Date.parse(date))
  const y = d.getUTCFullYear()
  const yearStart = Date.UTC(y, 0, 1)
  const yearEnd = Date.UTC(y + 1, 0, 1)
  const monthStart = Date.UTC(y, d.getUTCMonth(), 1)
  const monthEnd = Date.UTC(y, d.getUTCMonth() + 1, 1)
  return {
    year: (d.getTime() - yearStart) / (yearEnd - yearStart),
    month: (d.getTime() - monthStart) / (monthEnd - monthStart),
    week: ((d.getUTCDay() + 6) % 7) / 7,
    dayOfYear: Math.round((d.getTime() - yearStart) / DAY_MS) + 1,
    daysInYear: Math.round((yearEnd - yearStart) / DAY_MS),
  }
}
