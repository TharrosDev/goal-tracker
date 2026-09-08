import type { Goal, GoalKind } from './types'

/**
 * Number presentation. Two rules, both inherited from v1: table figures carry
 * two decimals so columns align on the point, and labels drop empty decimals so
 * they stay compact.
 */
const LOCALE = 'en-CA'

export const fig = (n: number): string =>
  n.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const compact = (n: number): string =>
  n.toLocaleString(
    LOCALE,
    n % 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 },
  )

/** Big numerals shed precision: 12,400 -> 12.4K. For headline type only. */
export function abbreviate(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(abs >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (abs >= 1e4) return (n / 1e3).toFixed(0) + 'K'
  return compact(n)
}

export const KIND_LABEL: Record<GoalKind, string> = {
  money: 'MONETARY',
  numeric: 'NUMERIC',
  percentage: 'PERCENTAGE',
  habit: 'HABIT',
  streak: 'STREAK',
  project: 'PROJECT',
  deadline: 'DEADLINE',
  milestone: 'MILESTONE',
  countdown: 'COUNTDOWN',
  custom: 'CUSTOM',
}

/** A goal's own value, in its own unit, ready to render. */
export function value(goal: Pick<Goal, 'kind' | 'unit'>, n: number, precise = false): string {
  switch (goal.kind) {
    case 'money':
      return '$' + (precise ? fig(n) : compact(n))
    case 'percentage':
      return compact(Math.round(n)) + '%'
    case 'streak':
      return compact(n) + (n === 1 ? ' day' : ' days')
    default:
      return compact(n) + (goal.unit ? ' ' + goal.unit : '')
  }
}

/** Split for typographic compositions that style the unit apart from the digits. */
export function valueParts(
  goal: Pick<Goal, 'kind' | 'unit'>,
  n: number,
  precise = false,
): { prefix: string; digits: string; suffix: string } {
  switch (goal.kind) {
    case 'money':
      return { prefix: '$', digits: precise ? fig(n) : compact(n), suffix: '' }
    case 'percentage':
      return { prefix: '', digits: compact(Math.round(n)), suffix: '%' }
    case 'streak':
      return { prefix: '', digits: compact(n), suffix: n === 1 ? 'day' : 'days' }
    default:
      return { prefix: '', digits: compact(n), suffix: goal.unit }
  }
}

export const pct = (f: number): string => Math.round(f * 100) + '%'

export function relativeDays(n: number): string {
  if (n === 0) return 'today'
  if (n === 1) return 'yesterday'
  if (n < 7) return `${n} days ago`
  if (n < 30) return `${Math.round(n / 7)}w ago`
  if (n < 365) return `${Math.round(n / 30)}mo ago`
  return `${(n / 365).toFixed(1)}y ago`
}
