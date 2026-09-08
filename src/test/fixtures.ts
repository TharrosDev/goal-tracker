import type { Goal, ProgressEntry, TimelineEvent } from '@/domain/types'
import { makeGoal, uid, type NewGoal } from '@/domain/schema'

/** A goal with a fixed id and dates, so assertions are not time-dependent. */
export function goal(overrides: Partial<Goal> & Partial<NewGoal> = {}): Goal {
  const base = makeGoal({
    kind: overrides.kind ?? 'money',
    title: overrides.title ?? 'Test goal',
    target: 'target' in overrides ? (overrides.target ?? null) : 1000,
    startDate: overrides.startDate ?? '2026-01-01',
    deadline: 'deadline' in overrides ? (overrides.deadline ?? null) : null,
  })
  return { ...base, id: 'g1', createdAt: '2026-01-01T00:00:00.000Z', ...overrides } as Goal
}

export function entry(at: string, amount = 10, goalId = 'g1'): ProgressEntry {
  return { id: uid(), goalId, at: `${at}T12:00:00.000Z`, amount, mode: 'delta', note: '' }
}

export function ev(
  type: TimelineEvent['type'],
  at: string,
  xp = 0,
  goalId: string | null = 'g1',
): TimelineEvent {
  return { id: uid(), goalId, type, at: `${at}T12:00:00.000Z`, xp, data: {} }
}

/** One entry per day across an inclusive date range. */
export function dailyEntries(from: string, to: string, goalId = 'g1'): ProgressEntry[] {
  const out: ProgressEntry[] = []
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000)
    out.push(entry(new Date(t).toISOString().slice(0, 10), 1, goalId))
  return out
}
