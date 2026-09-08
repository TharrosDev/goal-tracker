import { describe, expect, it } from 'vitest'
import { bandOf, energySeries, intensity, momentum, WINDOW } from './momentum'
import { progression, RECOVERY_XP, streakBonus, totalXp, xpFor, xpForLevel } from './xp'
import { addDays } from './date'
import { ev } from '@/test/fixtures'
import type { TimelineEvent } from './types'

const dailyEvents = (from: string, to: string, type: TimelineEvent['type'] = 'progress') => {
  const out: TimelineEvent[] = []
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000)
    out.push(ev(type, new Date(t).toISOString().slice(0, 10)))
  return out
}

describe('momentum', () => {
  const at = '2026-06-30'

  it('is zero with no history and never negative', () => {
    const m = momentum([], at)
    expect(m.score).toBe(0)
    expect(m.band).toBe('dormant')
    expect(m.score).toBeGreaterThanOrEqual(0)
  })

  it('never exceeds one, however frantic the week', () => {
    const spam = Array.from({ length: 400 }, () => ev('completed', at))
    expect(momentum(spam, at).score).toBeLessThanOrEqual(1)
  })

  it('rewards showing up daily over one enormous afternoon', () => {
    const steady = dailyEvents(addDays(at, -13), at)
    const burst = Array.from({ length: 14 }, () => ev('progress', at))
    expect(momentum(steady, at).score).toBeGreaterThan(momentum(burst, at).score)
  })

  it('weights recent days more heavily than old ones', () => {
    const recent = dailyEvents(addDays(at, -6), at)
    const old = dailyEvents(addDays(at, -27), addDays(at, -21))
    expect(momentum(recent, at).score).toBeGreaterThan(momentum(old, at).score)
  })

  it('ignores anything older than the window', () => {
    const ancient = dailyEvents(addDays(at, -200), addDays(at, -WINDOW - 1))
    expect(momentum(ancient, at).score).toBe(0)
  })

  it('decays rather than punishing when activity stops', () => {
    const events = dailyEvents(addDays(at, -40), addDays(at, -20))
    const score = momentum(events, at).score
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThan(0.2)
  })

  it('reports a trend against the previous window', () => {
    const rising = dailyEvents(addDays(at, -6), at)
    expect(momentum(rising, at).trend).toBeGreaterThan(0)
  })

  it('bands the score without gaps', () => {
    expect(bandOf(0)).toBe('dormant')
    expect(bandOf(0.2)).toBe('low')
    expect(bandOf(0.4)).toBe('steady')
    expect(bandOf(0.6)).toBe('high')
    expect(bandOf(0.95)).toBe('surging')
  })

  it('returns a series of the requested length, oldest first', () => {
    const series = energySeries([ev('progress', at)], 7, at)
    expect(series).toHaveLength(7)
    expect(series.at(-1)).toBeGreaterThan(0)
    expect(series[0]).toBe(0)
  })

  it('keeps a floor under visual intensity so a quiet universe still breathes', () => {
    expect(intensity(0)).toBeGreaterThan(0.2)
    expect(intensity(1)).toBe(1)
  })
})

describe('xp', () => {
  const easy = { difficulty: 1 as const, boss: false }
  const hard = { difficulty: 5 as const, boss: false }

  it('pays more for harder goals', () => {
    expect(xpFor('completed', hard)).toBeGreaterThan(xpFor('completed', easy))
  })

  it('pays far more for a boss goal', () => {
    expect(xpFor('completed', { ...hard, boss: true })).toBeGreaterThan(xpFor('completed', hard) * 2)
  })

  it('pays a streak bonus only past a week', () => {
    expect(streakBonus(6)).toBe(0)
    expect(streakBonus(7)).toBeGreaterThan(0)
    expect(streakBonus(30)).toBeGreaterThan(streakBonus(14))
  })

  it('pays for coming back', () => {
    const plain = xpFor('progress', easy)
    expect(xpFor('progress', easy, { recovery: true })).toBe(plain + RECOVERY_XP)
  })

  it('pays nothing for bookkeeping events', () => {
    expect(xpFor('edited', easy)).toBe(0)
    expect(xpFor('deadline_changed', easy)).toBe(0)
    expect(xpFor('reopened', easy)).toBe(0)
  })

  it('sums what the events actually recorded, not what the table says now', () => {
    expect(totalXp([ev('progress', '2026-01-01', 12), ev('completed', '2026-01-02', 999)])).toBe(1011)
  })
})

describe('progression', () => {
  it('starts everybody at level one with nothing', () => {
    expect(progression(0)).toMatchObject({ level: 1, into: 0, fraction: 0 })
  })

  it('climbs monotonically and never stalls at a boundary', () => {
    let previous = 0
    for (let level = 1; level <= 40; level += 1) {
      const threshold = xpForLevel(level)
      expect(threshold).toBeGreaterThanOrEqual(previous)
      previous = threshold
      expect(progression(threshold).level).toBe(level)
      expect(progression(threshold + 1).level).toBe(level)
    }
  })

  it('reports a sane fraction through the level', () => {
    const mid = Math.round((xpForLevel(5) + xpForLevel(6)) / 2)
    const p = progression(mid)
    expect(p.level).toBe(5)
    expect(p.fraction).toBeGreaterThan(0.4)
    expect(p.fraction).toBeLessThan(0.6)
    expect(p.into + xpForLevel(5)).toBe(mid)
  })

  it('gives a title that changes with the level', () => {
    expect(progression(0).title).toBe('DRIFTER')
    expect(progression(xpForLevel(40)).title).not.toBe('DRIFTER')
  })
})
