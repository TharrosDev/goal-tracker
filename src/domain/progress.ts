import type { Goal, GoalKind, GoalState, ISODate, Milestone, ProgressEntry } from './types'
import { addDays, dayOf, days, today, weekKey } from './date'
import { arrival, BEHIND, paceGap } from './pace'

/**
 * One question every kind of goal has to answer — "how far along is this?" —
 * plus the rules for when it is finished. The UI never re-derives either.
 */

/** Kinds a running number can finish on its own. */
const QUANTIFIED: ReadonlySet<GoalKind> = new Set([
  'money',
  'numeric',
  'percentage',
  'custom',
  'streak',
  'habit',
])
/** Kinds only a person can close. */
const BINARY: ReadonlySet<GoalKind> = new Set(['milestone', 'deadline', 'project'])

export const isQuantified = (kind: GoalKind): boolean => QUANTIFIED.has(kind)
export const isBinary = (kind: GoalKind): boolean => BINARY.has(kind)

/** Cents, always. Ported from v1 — money is rounded on every write, never on read. */
export const money = (n: number): number => Math.round(n * 100) / 100

/**
 * Progress as 0..1. The single number the whole visual system reads.
 * `milestones` matters only for project goals, whose progress is their parts.
 */
export function fraction(goal: Goal, milestones: Milestone[] = [], at: ISODate = today()): number {
  if (goal.done) return 1
  switch (goal.kind) {
    case 'countdown': {
      if (!goal.deadline) return 0
      const span = days(goal.startDate, goal.deadline)
      if (span <= 0) return 1
      return clamp01(days(goal.startDate, at) / span)
    }
    case 'project': {
      const mine = milestones.filter((m) => m.goalId === goal.id)
      if (!mine.length) return 0
      return mine.filter((m) => m.done).length / mine.length
    }
    case 'milestone':
    case 'deadline':
      return 0
    default: {
      if (!goal.target) return 0
      return clamp01(goal.current / goal.target)
    }
  }
}

export const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

export function isDone(goal: Goal, milestones: Milestone[] = []): boolean {
  if (goal.done) return true
  if (goal.kind === 'project') {
    // A project is its parts. Once every part is done there is nothing left to
    // ask a person to confirm.
    const mine = milestones.filter((m) => m.goalId === goal.id)
    return mine.length > 0 && mine.every((m) => m.done)
  }
  if (isBinary(goal.kind)) return false
  if (goal.kind === 'countdown') return goal.deadline ? days(today(), goal.deadline) <= 0 : false
  return goal.target !== null && goal.current >= goal.target
}

/** What remains, in the goal's own unit. Null when the kind has no quantity. */
export function remaining(goal: Goal): number | null {
  if (goal.target === null) return null
  return Math.max(goal.target - goal.current, 0)
}

/**
 * Days since anything was logged against this goal. Null when nothing ever was.
 * The input is the goal's own entries, newest-first order not assumed.
 */
export function daysSinceProgress(entries: ProgressEntry[], at: ISODate = today()): number | null {
  let latest: string | null = null
  for (const e of entries) if (!latest || e.at > latest) latest = e.at
  return latest === null ? null : days(dayOf(latest), at)
}

/** A goal is stalled once a fortnight passes with nothing logged. */
export const STALL_DAYS = 14
/** Below this it is too new to judge; it reads as forming, not failing. */
export const NEW_DAYS = 3

/**
 * The state that drives appearance and behaviour everywhere: colour, motion,
 * the body's look in the universe, and the order of the command centre.
 *
 * Note the deliberate absence of a "failing" state. Behind is not failure —
 * `critical` describes the clock, not the person.
 */
export function stateOf(
  goal: Goal,
  entries: ProgressEntry[],
  milestones: Milestone[] = [],
  at: ISODate = today(),
): GoalState {
  if (isDone(goal, milestones)) return 'completed'
  if (goal.paused) return 'paused'

  const a = arrival(goal, at)
  const gap = paceGap(goal, at)
  if (a?.overdue || (a?.urgent && (gap === null || gap > BEHIND))) return 'critical'

  const idle = daysSinceProgress(entries, at)
  if (idle !== null && idle >= STALL_DAYS) return 'stalled'
  if (idle === null && days(goal.startDate, at) >= STALL_DAYS) return 'stalled'
  if (days(goal.startDate, at) <= NEW_DAYS) return 'new'
  return 'active'
}

/**
 * Consecutive days with at least one entry, counting back from `at`.
 * Today not yet logged does not break the streak — yesterday still counts,
 * because the day is not over. Two silent days do.
 */
export function streakLength(entries: ProgressEntry[], at: ISODate = today()): number {
  const logged = new Set(entries.map((e) => dayOf(e.at)))
  if (!logged.size) return 0
  let cursor = logged.has(at) ? at : addDays(at, -1)
  if (!logged.has(cursor)) return 0
  let n = 0
  while (logged.has(cursor)) {
    n += 1
    cursor = addDays(cursor, -1)
  }
  return n
}

/** The longest run of consecutive logged days ever recorded. */
export function longestStreak(entries: ProgressEntry[]): number {
  const logged = [...new Set(entries.map((e) => dayOf(e.at)))].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const d of logged) {
    run = prev !== null && days(prev, d) === 1 ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return best
}

/** Check-ins inside the current recurrence period, against what was committed. */
export function habitPeriod(goal: Goal, entries: ProgressEntry[], at: ISODate = today()) {
  const r = goal.recurrence ?? { period: 'week' as const, times: 1 }
  const inPeriod = entries.filter((e) => {
    const d = dayOf(e.at)
    if (r.period === 'day') return d === at
    if (r.period === 'week') return weekKey(d) === weekKey(at)
    return d.slice(0, 7) === at.slice(0, 7)
  })
  return {
    done: inPeriod.length,
    target: r.times,
    period: r.period,
    kept: inPeriod.length >= r.times,
  }
}

/** Apply an entry to a goal's cached `current`, respecting the mode and kind. */
export function applyEntry(goal: Goal, entry: Pick<ProgressEntry, 'amount' | 'mode'>): number {
  const next = entry.mode === 'set' ? entry.amount : goal.current + entry.amount
  const bounded =
    goal.kind === 'percentage' ? Math.min(Math.max(next, 0), goal.target ?? 100) : next
  return goal.kind === 'money' ? money(Math.max(bounded, 0)) : Math.max(bounded, 0)
}

/** Rebuild `current` from the ledger. Used by import and corrupt-data repair. */
export function recomputeCurrent(goal: Goal, entries: ProgressEntry[]): number {
  const mine = entries.filter((e) => e.goalId === goal.id).sort((a, b) => a.at.localeCompare(b.at))
  let value = 0
  for (const e of mine) value = applyEntry({ ...goal, current: value }, e)
  return value
}
