import type { Goal, ISODate } from './types'
import { days, today } from './date'

/**
 * Pace and arrival. Every rule here is ported verbatim from the v1 almanac and
 * is covered by the original assertions in pace.test.ts — the numbers a person
 * has been looking at for months must not silently change under a redesign.
 */

/**
 * Rate per week needed to reach `target` from `current` in `daysLeft`.
 * Null when there is nothing left to do, or the deadline has already passed.
 */
export function perWeek(target: number, current: number, daysLeft: number): number | null {
  const remaining = target - current
  if (remaining <= 0 || daysLeft <= 0) return null
  return remaining / (daysLeft / 7)
}

/** Generalisation of perWeek across any period. */
export const perPeriod = (
  target: number,
  current: number,
  daysLeft: number,
  periodDays: number,
): number | null => {
  const remaining = target - current
  if (remaining <= 0 || daysLeft <= 0) return null
  return remaining / (daysLeft / periodDays)
}

/**
 * How far short of the straight pace line you are, as a fraction of target.
 * Negative means ahead. Null when there is no deadline to pace against.
 */
export function paceGap(goal: Goal, at: ISODate = today()): number | null {
  if (!goal.deadline || !goal.target) return null
  const span = days(goal.startDate, goal.deadline)
  if (span <= 0) return null
  const elapsed = Math.min(Math.max(days(goal.startDate, at), 0), span)
  return elapsed / span - goal.current / goal.target
}

/**
 * Magenta is scarce on purpose. A couple of points behind on day 21 of 122 is
 * noise, not a hazard, so only a material shortfall earns the caution.
 */
export const BEHIND = 0.1

export function onPace(goal: Goal, at: ISODate = today()): boolean | null {
  const gap = paceGap(goal, at)
  return gap === null ? null : gap <= BEHIND
}

export interface Arrival {
  /** Days until the deadline. Negative when overdue. */
  left: number
  text: string
  /** True when the deadline is pressing or passed. Drives colour, never blame. */
  urgent: boolean
  overdue: boolean
}

/** Deadline within a fortnight is the point at which the interface leans in. */
export const URGENT_DAYS = 14

export function arrival(goal: Goal, at: ISODate = today()): Arrival | null {
  if (!goal.deadline) return null
  const left = days(at, goal.deadline)
  if (left < 0)
    return {
      left,
      text: `${-left} ${left === -1 ? 'day' : 'days'} overdue`,
      urgent: true,
      overdue: true,
    }
  if (left === 0) return { left, text: 'due today', urgent: true, overdue: false }
  if (left === 1) return { left, text: '1 day out', urgent: true, overdue: false }
  return { left, text: `${left} days out`, urgent: left <= URGENT_DAYS, overdue: false }
}

/**
 * Deadline pressure, 0..1, for the visual system to read. Rises non-linearly so
 * the last fortnight is felt and the first month is not. Clamped, never above 1
 * — an overdue goal is loud, not infinitely loud.
 */
export function pressure(goal: Goal, at: ISODate = today()): number {
  const a = arrival(goal, at)
  if (!a) return 0
  if (a.overdue) return 1
  const span = Math.max(days(goal.startDate, goal.deadline!), 1)
  const remaining = Math.min(a.left / span, 1)
  return Math.pow(1 - remaining, 2.5)
}

/**
 * Projected finish date from observed rate since the start. Null when there is
 * no rate to project from (nothing logged yet, or already finished).
 */
export function projectedFinish(goal: Goal, at: ISODate = today()): ISODate | null {
  if (!goal.target || goal.current >= goal.target) return null
  const elapsed = days(goal.startDate, at)
  if (elapsed <= 0 || goal.current <= 0) return null
  const perDay = goal.current / elapsed
  const daysNeeded = Math.ceil((goal.target - goal.current) / perDay)
  if (!Number.isFinite(daysNeeded) || daysNeeded > 365 * 20) return null
  const d = new Date(Date.parse(at) + daysNeeded * 86_400_000)
  return d.toISOString().slice(0, 10)
}
