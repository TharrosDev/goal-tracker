import { describe, expect, it } from 'vitest'
import { bestPeriod, byHouse, byMonth, byWeek, comebacks, records, runs } from './history'
import { dailyEntries, entry, ev, goal } from '@/test/fixtures'
import type { Goal } from './types'

describe('runs', () => {
  it('finds every unbroken run, longest first', () => {
    const e = [
      ...dailyEntries('2026-03-01', '2026-03-05'),
      ...dailyEntries('2026-03-10', '2026-03-11'),
      ...dailyEntries('2026-04-01', '2026-04-12'),
    ]
    const found = runs(e)
    expect(found.map((r) => r.length)).toEqual([12, 5, 2])
    expect(found[0]).toMatchObject({ from: '2026-04-01', to: '2026-04-12' })
  })

  it('counts a single day as a run of one', () => {
    expect(runs([entry('2026-03-01')])).toEqual([
      { from: '2026-03-01', to: '2026-03-01', length: 1 },
    ])
  })

  it('is empty with no entries', () => {
    expect(runs([])).toEqual([])
  })

  it('counts several entries on one day once', () => {
    const e = [entry('2026-03-01'), entry('2026-03-01'), entry('2026-03-02')]
    expect(runs(e)[0]!.length).toBe(2)
  })
})

describe('comebacks', () => {
  it('reports a return only after a real silence', () => {
    const close = [entry('2026-03-01'), entry('2026-03-05')]
    expect(comebacks(close)).toEqual([])

    const far = [entry('2026-03-01'), entry('2026-04-05')]
    expect(comebacks(far)[0]).toMatchObject({ silence: 35, returnedOn: '2026-04-05' })
  })

  it('measures silence per goal, not across the whole world', () => {
    // Alternating between two goals is not a comeback on either of them.
    const e = [
      entry('2026-03-01', 1, 'a'),
      entry('2026-03-10', 1, 'b'),
      entry('2026-03-20', 1, 'a'),
    ]
    expect(comebacks(e).map((c) => c.goalId)).toEqual(['a'])
  })

  it('sorts the longest silence first', () => {
    const e = [
      entry('2026-01-01', 1, 'a'),
      entry('2026-02-01', 1, 'a'),
      entry('2026-01-01', 1, 'b'),
      entry('2026-05-01', 1, 'b'),
    ]
    expect(comebacks(e)[0]!.goalId).toBe('b')
  })
})

describe('byWeek and byMonth', () => {
  const at = '2026-03-15'

  it('returns exactly the requested number of periods, oldest first', () => {
    const weeks = byWeek([], [], 6, at)
    expect(weeks).toHaveLength(6)
    expect(weeks[0]!.from < weeks[5]!.from).toBe(true)
  })

  it('counts dispatches, active days, gates, takings and merit into the right bucket', () => {
    const entries = [entry('2026-03-10'), entry('2026-03-10'), entry('2026-03-11')]
    const events = [
      ev('milestone', '2026-03-10', 80),
      ev('completed', '2026-03-11', 260),
      ev('progress', '2026-03-11', 12),
    ]
    const week = byWeek(entries, events, 2, at).at(-1)!
    expect(week).toMatchObject({ dispatches: 3, activeDays: 2, gates: 1, taken: 1, merit: 352 })
  })

  it('ignores anything outside the window rather than folding it into the edge', () => {
    const ancient = [entry('2020-01-01')]
    const weeks = byWeek(ancient, [], 4, at)
    expect(weeks.reduce((s, w) => s + w.dispatches, 0)).toBe(0)
  })

  it('buckets months by calendar month', () => {
    const months = byMonth([entry('2026-02-14')], [], 3, at)
    expect(months.map((m) => m.key)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(months[1]!.dispatches).toBe(1)
  })
})

describe('bestPeriod', () => {
  it('is null when nothing has happened', () => {
    expect(bestPeriod(byWeek([], [], 8, '2026-03-15'))).toBeNull()
  })

  it('picks the period with the most merit', () => {
    const entries = [entry('2026-03-02'), entry('2026-03-10')]
    const events = [ev('progress', '2026-03-02', 12), ev('completed', '2026-03-10', 500)]
    const best = bestPeriod(byWeek(entries, events, 4, '2026-03-15'))
    expect(best!.merit).toBe(500)
  })
})

describe('records', () => {
  it('reports nothing it cannot measure', () => {
    expect(records([], [], [])).toEqual([{ label: 'DISPATCHES LOGGED', value: '0', when: null }])
  })

  it('finds the longest run, the largest dispatch and the fastest taking', () => {
    const goals: Goal[] = [
      goal({ id: 'a', startDate: '2026-03-01', completedAt: '2026-03-04T00:00:00.000Z' }),
      goal({ id: 'b', startDate: '2026-01-01', completedAt: '2026-03-01T00:00:00.000Z' }),
    ]
    const entries = [
      ...dailyEntries('2026-03-01', '2026-03-06', 'a'),
      entry('2026-03-08', 900, 'a'),
    ]
    const found = records(goals, entries, [ev('completed', '2026-03-04', 260)])
    const byLabel = new Map(found.map((r) => [r.label, r.value]))

    expect(byLabel.get('LONGEST RUN')).toBe('6 days')
    expect(byLabel.get('LARGEST DISPATCH')).toBe('900')
    expect(byLabel.get('STANDARDS TAKEN')).toBe('2')
    expect(byLabel.get('FASTEST TAKEN')).toBe('3 days')
  })
})

describe('byHouse', () => {
  it('groups by category and names the absence of one', () => {
    const goals = [
      goal({ id: 'a', category: 'SAVINGS' }),
      goal({ id: 'b', category: 'SAVINGS', completedAt: '2026-03-01T00:00:00.000Z' }),
      goal({ id: 'c', category: null }),
    ]
    const standing = byHouse(goals, () => 0.5)
    expect(standing[0]).toMatchObject({ house: 'SAVINGS', standards: 2, taken: 1, progress: 0.5 })
    expect(standing[1]!.house).toBe('NO HOUSE')
  })

  it('reads a house whose standards are all taken as complete, not as zero', () => {
    const goals = [goal({ id: 'a', category: 'DONE', completedAt: '2026-03-01T00:00:00.000Z' })]
    expect(byHouse(goals, () => 0)[0]!.progress).toBe(1)
  })

  it('leaves archived standards out entirely', () => {
    expect(byHouse([goal({ archived: true })], () => 1)).toEqual([])
  })
})
