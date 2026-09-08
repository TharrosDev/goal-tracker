import { describe, expect, it } from 'vitest'
import { BEHIND, arrival, onPace, paceGap, perWeek, perPeriod, pressure, projectedFinish } from './pace'
import { compact, fig } from './format'
import { days, fmtDate, weekKey, weekStart, addDays } from './date'
import { goal } from '@/test/fixtures'

/**
 * The first block is the v1 almanac's own `demo()` assertions, carried over
 * unchanged. These numbers have been on screen for months; a redesign is not
 * allowed to move them.
 */
describe('inherited from the v1 almanac', () => {
  it('computes the weekly rate needed', () => {
    expect(perWeek(1000, 0, 70)).toBe(100)
    expect(perWeek(2400, 350, 140)).toBe(102.5)
  })

  it('returns null when there is nothing left to save or no time left', () => {
    expect(perWeek(500, 500, 30)).toBeNull()
    expect(perWeek(500, 100, 0)).toBeNull()
    expect(perWeek(500, 100, -3)).toBeNull()
  })

  it('reads half saved at halfway as on pace', () => {
    const g = goal({ startDate: '2026-01-01', deadline: '2026-01-11', target: 100, current: 50 })
    expect(onPace(g, '2026-01-06')).toBe(true)
    expect(onPace(g, '2026-01-09')).toBe(false)
  })

  it('measures the shortfall as a fraction of target', () => {
    const g = goal({ startDate: '2026-01-01', deadline: '2026-01-11', target: 100, current: 50 })
    expect(paceGap(g, '2026-01-09')).toBeCloseTo(0.3, 9)
    expect(paceGap(g, '2026-01-09')! > BEHIND).toBe(true)
  })

  it('treats a small early gap as noise, not a caution', () => {
    const near = goal({
      startDate: '2026-08-01',
      deadline: '2026-12-01',
      target: 2400,
      current: 350,
    })
    expect(paceGap(near, '2026-08-22')! < BEHIND).toBe(true)
  })

  it('formats figures and dates the way the almanac did', () => {
    expect(fmtDate('2026-12-01')).toBe('01 DEC 2026')
    expect(fig(2400)).toBe('2,400.00')
    expect(compact(2400)).toBe('2,400')
    expect(compact(2400.5)).toBe('2,400.50')
  })
})

describe('paceGap', () => {
  it('is null without a deadline or a target', () => {
    expect(paceGap(goal({ deadline: null }))).toBeNull()
    expect(paceGap(goal({ deadline: '2026-06-01', target: null }))).toBeNull()
  })

  it('is null when the deadline is on or before the start', () => {
    expect(paceGap(goal({ startDate: '2026-01-10', deadline: '2026-01-10' }))).toBeNull()
    expect(paceGap(goal({ startDate: '2026-01-10', deadline: '2026-01-01' }))).toBeNull()
  })

  it('clamps elapsed time to the span, so an overdue goal stops getting worse', () => {
    const g = goal({ startDate: '2026-01-01', deadline: '2026-01-11', target: 100, current: 0 })
    expect(paceGap(g, '2026-01-11')).toBeCloseTo(1, 9)
    expect(paceGap(g, '2027-01-11')).toBeCloseTo(1, 9)
  })

  it('goes negative when ahead', () => {
    const g = goal({ startDate: '2026-01-01', deadline: '2026-01-11', target: 100, current: 90 })
    expect(paceGap(g, '2026-01-03')).toBeLessThan(0)
  })
})

describe('perPeriod', () => {
  it('generalises the weekly rate', () => {
    expect(perPeriod(1000, 0, 70, 7)).toBe(100)
    expect(perPeriod(1000, 0, 70, 1)).toBeCloseTo(1000 / 70, 9)
    expect(perPeriod(1000, 1000, 70, 7)).toBeNull()
  })
})

describe('arrival', () => {
  const g = (deadline: string) => goal({ deadline, startDate: '2026-01-01' })

  it('describes the distance to the deadline', () => {
    expect(arrival(g('2026-03-01'), '2026-02-01')).toMatchObject({
      left: 28,
      text: '28 days out',
      urgent: false,
      overdue: false,
    })
    expect(arrival(g('2026-02-10'), '2026-02-01')?.urgent).toBe(true)
    expect(arrival(g('2026-02-02'), '2026-02-01')?.text).toBe('1 day out')
    expect(arrival(g('2026-02-01'), '2026-02-01')?.text).toBe('due today')
  })

  it('counts overdue days and singularises one', () => {
    expect(arrival(g('2026-01-31'), '2026-02-01')).toMatchObject({
      text: '1 day overdue',
      overdue: true,
      urgent: true,
    })
    expect(arrival(g('2026-01-25'), '2026-02-01')?.text).toBe('7 days overdue')
  })

  it('turns urgent at exactly a fortnight, not before', () => {
    expect(arrival(g('2026-02-15'), '2026-02-01')?.urgent).toBe(true)
    expect(arrival(g('2026-02-16'), '2026-02-01')?.urgent).toBe(false)
  })

  it('is null without a deadline', () => {
    expect(arrival(goal({ deadline: null }))).toBeNull()
  })
})

describe('pressure', () => {
  it('is zero without a deadline and one when overdue', () => {
    expect(pressure(goal({ deadline: null }))).toBe(0)
    expect(pressure(goal({ startDate: '2026-01-01', deadline: '2026-02-01' }), '2026-03-01')).toBe(1)
  })

  it('rises monotonically towards the deadline and never exceeds one', () => {
    const g = goal({ startDate: '2026-01-01', deadline: '2026-04-01' })
    const readings = ['2026-01-05', '2026-02-01', '2026-03-01', '2026-03-28'].map((d) =>
      pressure(g, d),
    )
    for (let i = 1; i < readings.length; i += 1)
      expect(readings[i]!).toBeGreaterThan(readings[i - 1]!)
    expect(Math.max(...readings)).toBeLessThanOrEqual(1)
  })
})

describe('projectedFinish', () => {
  it('extrapolates the observed rate', () => {
    // 100 of 400 in 10 days = 10/day, so 30 more days for the remaining 300.
    const g = goal({ startDate: '2026-01-01', target: 400, current: 100 })
    expect(projectedFinish(g, '2026-01-11')).toBe('2026-02-10')
  })

  it('declines to guess without a rate', () => {
    expect(projectedFinish(goal({ current: 0 }), '2026-01-11')).toBeNull()
    expect(projectedFinish(goal({ target: 100, current: 100 }), '2026-01-11')).toBeNull()
    expect(projectedFinish(goal({ target: null }), '2026-01-11')).toBeNull()
  })

  it('declines to guess when the finish is absurdly far out', () => {
    const g = goal({ startDate: '2026-01-01', target: 10_000_000, current: 1 })
    expect(projectedFinish(g, '2026-01-11')).toBeNull()
  })
})

describe('date maths', () => {
  it('counts whole days across a leap day', () => {
    expect(days('2028-02-28', '2028-03-01')).toBe(2)
    expect(days('2026-02-28', '2026-03-01')).toBe(1)
  })

  it('counts whole days across a DST boundary', () => {
    // North American spring forward, 2026-03-08. UTC parsing plus rounding means
    // this stays exact regardless of the machine's local zone.
    expect(days('2026-03-07', '2026-03-09')).toBe(2)
    expect(days('2026-11-01', '2026-11-02')).toBe(1)
  })

  it('is negative looking backwards', () => {
    expect(days('2026-03-01', '2026-02-01')).toBe(-28)
  })

  it('buckets ISO weeks, including the year boundary', () => {
    expect(weekKey('2026-01-01')).toBe('2026-W01')
    expect(weekKey('2026-12-31')).toBe('2026-W53')
    expect(weekStart('2026-01-01')).toBe('2025-12-29')
    expect(weekStart('2026-01-05')).toBe('2026-01-05')
  })

  it('adds days across month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})
