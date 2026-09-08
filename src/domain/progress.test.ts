import { describe, expect, it } from 'vitest'
import {
  applyEntry,
  daysSinceProgress,
  fraction,
  habitPeriod,
  isDone,
  longestStreak,
  money,
  recomputeCurrent,
  remaining,
  stateOf,
  streakLength,
} from './progress'
import { makeMilestone } from './schema'
import { dailyEntries, entry, goal } from '@/test/fixtures'

describe('money', () => {
  it('rounds to cents on every write, as v1 did', () => {
    expect(money(10.005)).toBe(10.01)
    expect(money(0.1 + 0.2)).toBe(0.3)
    expect(money(2400)).toBe(2400)
    expect(money(1 / 3)).toBe(0.33)
  })

  it('never accumulates float drift across a hundred writes', () => {
    let total = 0
    for (let i = 0; i < 100; i += 1) total = money(total + 0.07)
    expect(total).toBe(7)
  })
})

describe('applyEntry', () => {
  it('adds a delta and replaces on set', () => {
    const g = goal({ current: 100 })
    expect(applyEntry(g, { amount: 50, mode: 'delta' })).toBe(150)
    expect(applyEntry(g, { amount: 50, mode: 'set' })).toBe(50)
  })

  it('rounds money but leaves other units alone', () => {
    expect(applyEntry(goal({ kind: 'money', current: 0 }), { amount: 10.005, mode: 'delta' })).toBe(
      10.01,
    )
    expect(
      applyEntry(goal({ kind: 'numeric', current: 0 }), { amount: 10.005, mode: 'delta' }),
    ).toBe(10.005)
  })

  it('never goes below zero', () => {
    expect(applyEntry(goal({ current: 10 }), { amount: -100, mode: 'delta' })).toBe(0)
  })

  it('caps a percentage at its target', () => {
    const g = goal({ kind: 'percentage', target: 100, current: 90 })
    expect(applyEntry(g, { amount: 50, mode: 'delta' })).toBe(100)
  })
})

describe('fraction', () => {
  it('is the ratio for quantified kinds, clamped', () => {
    expect(fraction(goal({ target: 1000, current: 250 }))).toBe(0.25)
    expect(fraction(goal({ target: 1000, current: 5000 }))).toBe(1)
    expect(fraction(goal({ target: 0, current: 5 }))).toBe(0)
  })

  it('is zero for binary kinds until they are done', () => {
    expect(fraction(goal({ kind: 'milestone', target: null }))).toBe(0)
    expect(fraction(goal({ kind: 'milestone', target: null, done: true }))).toBe(1)
  })

  it('is the completed share of milestones for a project', () => {
    const g = goal({ kind: 'project', target: null })
    const ms = [
      { ...makeMilestone('g1', 'a', 0), done: true },
      { ...makeMilestone('g1', 'b', 1), done: false },
      { ...makeMilestone('g1', 'c', 2), done: false },
      { ...makeMilestone('g1', 'd', 3), done: true },
    ]
    expect(fraction(g, ms)).toBe(0.5)
    expect(fraction(g, [])).toBe(0)
  })

  it('is elapsed time for a countdown', () => {
    const g = goal({
      kind: 'countdown',
      target: null,
      startDate: '2026-01-01',
      deadline: '2026-01-11',
    })
    expect(fraction(g, [], '2026-01-06')).toBe(0.5)
    expect(fraction(g, [], '2026-02-01')).toBe(1)
  })
})

describe('isDone', () => {
  it('closes a money goal when the target is reached, exactly as v1 did', () => {
    expect(isDone(goal({ target: 1000, current: 999.99 }))).toBe(false)
    expect(isDone(goal({ target: 1000, current: 1000 }))).toBe(true)
    expect(isDone(goal({ target: 1000, current: 1200 }))).toBe(true)
  })

  it('only a person closes a binary goal', () => {
    expect(isDone(goal({ kind: 'milestone', target: null, current: 999 }))).toBe(false)
    expect(isDone(goal({ kind: 'project', target: null, done: true }))).toBe(true)
  })

  it('leaves remaining at zero rather than negative', () => {
    expect(remaining(goal({ target: 100, current: 130 }))).toBe(0)
    expect(remaining(goal({ target: null }))).toBeNull()
  })
})

describe('streaks', () => {
  it('counts consecutive days back from today', () => {
    const e = dailyEntries('2026-03-01', '2026-03-10')
    expect(streakLength(e, '2026-03-10')).toBe(10)
  })

  it('does not break the streak just because today is not logged yet', () => {
    const e = dailyEntries('2026-03-01', '2026-03-09')
    expect(streakLength(e, '2026-03-10')).toBe(9)
  })

  it('breaks after two silent days', () => {
    const e = dailyEntries('2026-03-01', '2026-03-09')
    expect(streakLength(e, '2026-03-11')).toBe(0)
  })

  it('is zero with no entries at all', () => {
    expect(streakLength([], '2026-03-10')).toBe(0)
  })

  it('counts several entries in one day once', () => {
    const e = [entry('2026-03-09'), entry('2026-03-09'), entry('2026-03-10')]
    expect(streakLength(e, '2026-03-10')).toBe(2)
  })

  it('finds the longest run ever, not the current one', () => {
    const e = [
      ...dailyEntries('2026-01-01', '2026-01-20'),
      ...dailyEntries('2026-03-01', '2026-03-03'),
    ]
    expect(longestStreak(e)).toBe(20)
    expect(streakLength(e, '2026-03-03')).toBe(3)
  })
})

describe('daysSinceProgress', () => {
  it('measures from the newest entry regardless of order', () => {
    const e = [entry('2026-03-01'), entry('2026-03-09'), entry('2026-03-05')]
    expect(daysSinceProgress(e, '2026-03-11')).toBe(2)
  })

  it('is null when nothing was ever logged', () => {
    expect(daysSinceProgress([], '2026-03-11')).toBeNull()
  })
})

describe('stateOf', () => {
  const base = { startDate: '2026-03-01', target: 1000, current: 100 }

  it('reads as new for the first few days', () => {
    expect(stateOf(goal(base), [], [], '2026-03-02')).toBe('new')
  })

  it('reads as active while something is moving', () => {
    const e = dailyEntries('2026-03-05', '2026-03-10')
    expect(stateOf(goal(base), e, [], '2026-03-11')).toBe('active')
  })

  it('reads as stalled after a fortnight of silence', () => {
    const e = [entry('2026-03-05')]
    expect(stateOf(goal(base), e, [], '2026-03-20')).toBe('stalled')
  })

  it('reads as critical when the deadline presses and the pace is short', () => {
    const g = goal({ ...base, deadline: '2026-03-25', current: 10 })
    expect(stateOf(g, dailyEntries('2026-03-18', '2026-03-20'), [], '2026-03-20')).toBe('critical')
  })

  it('does not shout at an urgent goal that is comfortably ahead', () => {
    const g = goal({ ...base, deadline: '2026-03-25', current: 990 })
    expect(stateOf(g, dailyEntries('2026-03-18', '2026-03-20'), [], '2026-03-20')).toBe('active')
  })

  it('completed and paused outrank everything else', () => {
    expect(stateOf(goal({ ...base, current: 1000 }), [], [], '2026-03-20')).toBe('completed')
    expect(stateOf(goal({ ...base, paused: true }), [], [], '2026-03-20')).toBe('paused')
  })
})

describe('habitPeriod', () => {
  it('counts check-ins inside the current week against what was committed', () => {
    const g = goal({ kind: 'habit', target: null, recurrence: { period: 'week', times: 3 } })
    const e = [entry('2026-03-09'), entry('2026-03-10'), entry('2026-03-11')]
    expect(habitPeriod(g, e, '2026-03-13')).toMatchObject({ done: 3, target: 3, kept: true })
  })

  it('ignores entries from the period before', () => {
    const g = goal({ kind: 'habit', target: null, recurrence: { period: 'week', times: 3 } })
    const e = [entry('2026-03-02'), entry('2026-03-03'), entry('2026-03-09')]
    expect(habitPeriod(g, e, '2026-03-13')).toMatchObject({ done: 1, kept: false })
  })

  it('handles a daily commitment', () => {
    const g = goal({ kind: 'habit', target: null, recurrence: { period: 'day', times: 2 } })
    expect(habitPeriod(g, [entry('2026-03-13'), entry('2026-03-13')], '2026-03-13').kept).toBe(true)
  })
})

describe('recomputeCurrent', () => {
  it('rebuilds the cached total from the ledger', () => {
    const g = goal({ kind: 'money', current: 999 })
    const e = [entry('2026-03-01', 100), entry('2026-03-02', 50.5), entry('2026-03-03', 0.25)]
    expect(recomputeCurrent(g, e)).toBe(150.75)
  })

  it('honours set entries in date order, not array order', () => {
    const g = goal({ kind: 'numeric', current: 0 })
    const e = [
      { ...entry('2026-03-03', 5), mode: 'delta' as const },
      { ...entry('2026-03-01', 100), mode: 'set' as const },
    ]
    expect(recomputeCurrent(g, e)).toBe(105)
  })

  it('ignores entries belonging to another goal', () => {
    const g = goal({ current: 0 })
    expect(recomputeCurrent(g, [entry('2026-03-01', 100, 'other')])).toBe(0)
  })
})
