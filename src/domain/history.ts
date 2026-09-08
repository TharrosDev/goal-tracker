import type { Goal, ISODate, ProgressEntry, TimelineEvent } from './types'
import { addDays, dayOf, days, monthKey, today, weekKey, weekStart } from './date'

/**
 * FOLDS OVER THE RECORD.
 *
 * Everything the chronicle and the survey show is derived here, from the event
 * log and the ledger. Nothing is stored twice and nothing is estimated: if a
 * number cannot be computed from what actually happened, this file returns null
 * and the surface says so rather than inventing one.
 */

export interface Period {
  /** 'YYYY-Www' or 'YYYY-MM'. */
  key: string
  /** First day of the period. */
  from: ISODate
  label: string
  dispatches: number
  gates: number
  taken: number
  merit: number
  /** Distinct days with any dispatch. */
  activeDays: number
}

/** Dispatch activity grouped by ISO week, oldest first. */
export function byWeek(
  entries: ProgressEntry[],
  events: TimelineEvent[],
  weeks: number,
  at: ISODate = today(),
): Period[] {
  const out: Period[] = []
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const from = weekStart(addDays(at, -i * 7))
    const key = weekKey(from)
    out.push(emptyPeriod(key, from, from))
  }
  const index = new Map(out.map((p) => [p.key, p]))
  fill(index, entries, events, (day) => weekKey(day))
  return out
}

/** Dispatch activity grouped by calendar month, oldest first. */
export function byMonth(
  entries: ProgressEntry[],
  events: TimelineEvent[],
  months: number,
  at: ISODate = today(),
): Period[] {
  const out: Period[] = []
  const [y, m] = at.split('-').map(Number) as [number, number]
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    const from = d.toISOString().slice(0, 10)
    out.push(emptyPeriod(from.slice(0, 7), from, from))
  }
  const index = new Map(out.map((p) => [p.key, p]))
  fill(index, entries, events, (day) => monthKey(day))
  return out
}

const emptyPeriod = (key: string, from: ISODate, label: string): Period => ({
  key,
  from,
  label,
  dispatches: 0,
  gates: 0,
  taken: 0,
  merit: 0,
  activeDays: 0,
})

function fill(
  index: Map<string, Period>,
  entries: ProgressEntry[],
  events: TimelineEvent[],
  keyOf: (day: ISODate) => string,
) {
  const activeDays = new Map<string, Set<string>>()

  for (const e of entries) {
    const day = dayOf(e.at)
    const period = index.get(keyOf(day))
    if (!period) continue
    period.dispatches += 1
    const set = activeDays.get(period.key) ?? new Set<string>()
    set.add(day)
    activeDays.set(period.key, set)
  }

  for (const ev of events) {
    const period = index.get(keyOf(dayOf(ev.at)))
    if (!period) continue
    period.merit += ev.xp
    if (ev.type === 'milestone') period.gates += 1
    if (ev.type === 'completed') period.taken += 1
  }

  for (const [key, set] of activeDays) {
    const period = index.get(key)
    if (period) period.activeDays = set.size
  }
}

/** The single strongest period on record, by merit. Null when nothing exists. */
export function bestPeriod(periods: Period[]): Period | null {
  const withAny = periods.filter((p) => p.dispatches > 0 || p.taken > 0)
  if (!withAny.length) return null
  return withAny.reduce((best, p) => (p.merit > best.merit ? p : best))
}

export interface Run {
  from: ISODate
  to: ISODate
  length: number
}

/** Every unbroken run of consecutive logged days, longest first. */
export function runs(entries: ProgressEntry[]): Run[] {
  const logged = [...new Set(entries.map((e) => dayOf(e.at)))].sort()
  const out: Run[] = []
  let start: string | null = null
  let previous: string | null = null

  for (const day of logged) {
    if (previous !== null && days(previous, day) === 1) {
      previous = day
      continue
    }
    if (start !== null && previous !== null)
      out.push({ from: start, to: previous, length: days(start, previous) + 1 })
    start = day
    previous = day
  }
  if (start !== null && previous !== null)
    out.push({ from: start, to: previous, length: days(start, previous) + 1 })

  return out.sort((a, b) => b.length - a.length)
}

export interface Comeback {
  goalId: string
  /** Days of silence before the return. */
  silence: number
  returnedOn: ISODate
}

/** Every return after a fortnight or more of silence, longest silence first. */
export function comebacks(entries: ProgressEntry[], minimum = 14): Comeback[] {
  const byGoal = new Map<string, string[]>()
  for (const e of entries) {
    const list = byGoal.get(e.goalId) ?? []
    list.push(dayOf(e.at))
    byGoal.set(e.goalId, list)
  }

  const out: Comeback[] = []
  for (const [goalId, list] of byGoal) {
    const sorted = [...new Set(list)].sort()
    for (let i = 1; i < sorted.length; i += 1) {
      const silence = days(sorted[i - 1]!, sorted[i]!)
      if (silence >= minimum) out.push({ goalId, silence, returnedOn: sorted[i]! })
    }
  }
  return out.sort((a, b) => b.silence - a.silence)
}

export interface Record {
  label: string
  value: string
  /** When it happened, if it happened on a particular day. */
  when: ISODate | null
}

/**
 * Personal records. Every one of these is measured; there is no entry here that
 * cannot be traced to a real dispatch or a real completion.
 */
export function records(
  goals: Goal[],
  entries: ProgressEntry[],
  events: TimelineEvent[],
): Record[] {
  const out: Record[] = []

  const longest = runs(entries)[0]
  if (longest)
    out.push({
      label: 'LONGEST RUN',
      value: `${longest.length} days`,
      when: longest.to,
    })

  const biggest = entries.reduce<ProgressEntry | null>(
    (best, e) => (e.mode === 'delta' && (!best || e.amount > best.amount) ? e : best),
    null,
  )
  if (biggest) {
    const goal = goals.find((g) => g.id === biggest.goalId)
    out.push({
      label: 'LARGEST DISPATCH',
      value: `${biggest.amount.toLocaleString('en-CA')}${goal?.unit ? ` ${goal.unit}` : ''}`,
      when: dayOf(biggest.at),
    })
  }

  const taken = goals.filter((g) => g.completedAt)
  if (taken.length) {
    out.push({ label: 'STANDARDS TAKEN', value: String(taken.length), when: null })
    const fastest = taken.reduce((best, g) =>
      days(g.startDate, dayOf(g.completedAt!)) < days(best.startDate, dayOf(best.completedAt!))
        ? g
        : best,
    )
    out.push({
      label: 'FASTEST TAKEN',
      value: `${days(fastest.startDate, dayOf(fastest.completedAt!))} days`,
      when: dayOf(fastest.completedAt!),
    })
  }

  const back = comebacks(entries)[0]
  if (back)
    out.push({
      label: 'LONGEST COMEBACK',
      value: `${back.silence} days away`,
      when: back.returnedOn,
    })

  const merit = events.reduce((s, e) => s + e.xp, 0)
  if (merit) out.push({ label: 'MERIT EARNED', value: merit.toLocaleString('en-CA'), when: null })

  out.push({ label: 'DISPATCHES LOGGED', value: String(entries.length), when: null })

  return out
}

export interface HouseStanding {
  house: string
  standards: number
  taken: number
  /** Mean progress across live standards, 0..1. */
  progress: number
}

/** How each house is doing. Houses with no standards do not appear. */
export function byHouse(goals: Goal[], fractionOf: (g: Goal) => number): HouseStanding[] {
  const map = new Map<string, Goal[]>()
  for (const g of goals) {
    if (g.archived) continue
    const house = g.category ?? 'NO HOUSE'
    map.set(house, [...(map.get(house) ?? []), g])
  }

  return [...map.entries()]
    .map(([house, list]) => {
      const live = list.filter((g) => !g.completedAt)
      return {
        house,
        standards: list.length,
        taken: list.filter((g) => g.completedAt).length,
        progress: live.length ? live.reduce((s, g) => s + fractionOf(g), 0) / live.length : 1,
      }
    })
    .sort((a, b) => b.standards - a.standards)
}
