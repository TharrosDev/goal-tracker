import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, evaluate, newlyUnlocked, type AchievementContext } from './achievements'
import { DYE_COUNT, dyeOf, hash, massOf, orbitOf, rng, sigilOf } from './identity'
import { dailyEntries, entry, ev, goal } from '@/test/fixtures'
import { makeMilestone } from './schema'
import type { Goal } from './types'

const ctx = (over: Partial<AchievementContext> = {}): AchievementContext => ({
  goals: [],
  milestones: [],
  entries: [],
  events: [],
  at: '2026-06-30',
  ...over,
})

const earned = (c: AchievementContext) => new Set(evaluate(c).map((a) => a.id))

describe('achievement definitions', () => {
  it('have unique ids and non-empty descriptions', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(0)
      expect(a.description.length).toBeGreaterThan(0)
    }
  })

  it('unlock nothing on an empty world', () => {
    expect(evaluate(ctx())).toHaveLength(0)
  })

  it('every one of them survives an empty context without throwing', () => {
    for (const a of ACHIEVEMENTS) expect(() => a.check(ctx())).not.toThrow()
  })

  it('include hidden ones worth discovering', () => {
    expect(ACHIEVEMENTS.filter((a) => a.hidden).length).toBeGreaterThanOrEqual(8)
  })
})

describe('individual achievements', () => {
  it('FIRST MOVE needs both a goal and a move', () => {
    expect(earned(ctx({ goals: [goal()] }))).not.toContain('first-move')
    expect(earned(ctx({ goals: [goal()], entries: [entry('2026-06-01')] }))).toContain('first-move')
  })

  it('SEVEN counts distinct days, not entries', () => {
    const sameDay = Array.from({ length: 20 }, () => entry('2026-06-01'))
    expect(earned(ctx({ goals: [goal()], entries: sameDay }))).not.toContain('seven')
    const week = dailyEntries('2026-06-01', '2026-06-07')
    expect(earned(ctx({ goals: [goal()], entries: week }))).toContain('seven')
  })

  it('COMEBACK needs a real gap between two entries on one goal', () => {
    const close = [entry('2026-06-01'), entry('2026-06-05')]
    expect(earned(ctx({ goals: [goal()], entries: close }))).not.toContain('comeback')
    const far = [entry('2026-05-01'), entry('2026-06-01')]
    expect(earned(ctx({ goals: [goal()], entries: far }))).toContain('comeback')
  })

  it('DEADLINE KILLER needs the completion to precede the deadline', () => {
    const early: Goal = goal({
      deadline: '2026-06-30',
      completedAt: '2026-06-01T10:00:00.000Z',
    })
    expect(earned(ctx({ goals: [early] }))).toContain('deadline-killer')

    const late: Goal = goal({ deadline: '2026-05-30', completedAt: '2026-06-01T10:00:00.000Z' })
    expect(earned(ctx({ goals: [late] }))).not.toContain('deadline-killer')
  })

  it('THE IMPOSSIBLE needs a finished maximum-difficulty goal', () => {
    const hard = goal({ difficulty: 5, completedAt: '2026-06-01T10:00:00.000Z' })
    expect(earned(ctx({ goals: [hard] }))).toContain('the-impossible')
    expect(earned(ctx({ goals: [goal({ difficulty: 5 })] }))).not.toContain('the-impossible')
  })

  it('OBSESSION needs thirty days running', () => {
    expect(earned(ctx({ entries: dailyEntries('2026-06-01', '2026-06-20') }))).not.toContain(
      'obsession',
    )
    expect(earned(ctx({ entries: dailyEntries('2026-06-01', '2026-06-30') }))).toContain(
      'obsession',
    )
  })

  it('CENTURY needs a hundred entries', () => {
    const many = Array.from({ length: 100 }, (_, i) => entry('2026-06-01', i))
    expect(earned(ctx({ entries: many }))).toContain('century')
  })

  it('ARCHITECT needs every milestone of a five-part goal', () => {
    const g = goal({ kind: 'project', target: null })
    const done = Array.from({ length: 5 }, (_, i) => ({
      ...makeMilestone('g1', `m${i}`, i),
      done: true,
    }))
    expect(earned(ctx({ goals: [g], milestones: done }))).toContain('architect')
    expect(
      earned(ctx({ goals: [g], milestones: [...done.slice(1), { ...done[0]!, done: false }] })),
    ).not.toContain('architect')
  })

  it('CONSTELLATION needs five goals in one connected web', () => {
    const chain = ['a', 'b', 'c', 'd', 'e'].map((id, i, all) =>
      goal({ id, linkedIds: i < all.length - 1 ? [all[i + 1]!] : [] }),
    )
    expect(earned(ctx({ goals: chain }))).toContain('constellation')

    const split = [
      goal({ id: 'a', linkedIds: ['b'] }),
      goal({ id: 'b', linkedIds: ['a'] }),
      goal({ id: 'c', linkedIds: [] }),
      goal({ id: 'd', linkedIds: [] }),
      goal({ id: 'e', linkedIds: [] }),
    ]
    expect(earned(ctx({ goals: split }))).not.toContain('constellation')
  })

  it('MOMENTUM needs a genuinely strong recent window', () => {
    const events = Array.from({ length: 28 }, (_, i) => {
      const day = new Date(Date.parse('2026-06-30') - i * 86_400_000).toISOString().slice(0, 10)
      return ev('progress', day)
    })
    expect(earned(ctx({ events }))).toContain('momentum')
    expect(earned(ctx({ events: [ev('progress', '2026-06-30')] }))).not.toContain('momentum')
  })

  it('PERFECT WEEK needs at least two recurring commitments, all kept', () => {
    const a = goal({
      id: 'a',
      kind: 'habit',
      target: null,
      recurrence: { period: 'week', times: 1 },
    })
    const b = goal({
      id: 'b',
      kind: 'habit',
      target: null,
      recurrence: { period: 'week', times: 1 },
    })
    const kept = [entry('2026-06-29', 1, 'a'), entry('2026-06-29', 1, 'b')]
    expect(earned(ctx({ goals: [a, b], entries: kept }))).toContain('perfect-week')
    expect(earned(ctx({ goals: [a, b], entries: [kept[0]!] }))).not.toContain('perfect-week')
    expect(earned(ctx({ goals: [a], entries: [kept[0]!] }))).not.toContain('perfect-week')
  })
})

describe('newlyUnlocked', () => {
  it('reports only what is not already held', () => {
    const c = ctx({ goals: [goal()], entries: [entry('2026-06-01')] })
    const all = evaluate(c)
    expect(all.length).toBeGreaterThan(0)
    const held = all.map((a) => ({ id: a.id, at: '2026-06-01T00:00:00.000Z', value: a.value }))
    expect(newlyUnlocked(c, held)).toHaveLength(0)
  })
})

describe('procedural identity', () => {
  it('is stable for the same id, forever', () => {
    expect(hash('abc')).toBe(hash('abc'))
    const a = sigilOf(goal({ id: 'fixed' }))
    const b = sigilOf(goal({ id: 'fixed' }))
    expect(a).toEqual(b)
  })

  it('differs between ids', () => {
    const a = sigilOf(goal({ id: 'one', title: 'Road bike' }))
    const b = sigilOf(goal({ id: 'two', title: 'Emergency fund' }))
    expect(a.callsign).not.toBe(b.callsign)
  })

  it('never leaves the six-dye set, however many goals exist', () => {
    // The first draft spread identity across the whole hue wheel, which put a
    // money goal six degrees from --ok and a deadline goal on top of --caution.
    const dyes = Array.from({ length: 200 }, (_, i) =>
      dyeOf(goal({ id: `m${i}`, category: `cat-${i}` })),
    )
    for (const d of dyes) {
      expect(Number.isInteger(d)).toBe(true)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThan(DYE_COUNT)
    }
    expect(new Set(dyes).size).toBe(DYE_COUNT)
  })

  it('gives one category one dye, always', () => {
    expect(dyeOf(goal({ id: 'a', category: 'SAVINGS' }))).toBe(
      dyeOf(goal({ id: 'b', category: 'SAVINGS' })),
    )
  })

  it('varies by goal when there is no category, rather than collapsing by kind', () => {
    // Every migrated goal arrives without a category. Keying the fallback on
    // kind made a whole field of money goals fly one colour.
    const dyes = Array.from({ length: 30 }, (_, i) =>
      dyeOf(goal({ id: `m${i}`, kind: 'money', category: null })),
    )
    expect(new Set(dyes).size).toBeGreaterThan(1)
  })

  it('respects an explicit dye over the derived one', () => {
    expect(dyeOf(goal({ dye: 4, category: 'SAVINGS' }))).toBe(4)
  })

  it('builds a two-letter callsign from the title', () => {
    expect(sigilOf(goal({ id: 'x', title: 'Road bike' })).callsign.startsWith('RB-')).toBe(true)
    expect(sigilOf(goal({ id: 'x', title: 'Bike' })).callsign.startsWith('BX-')).toBe(true)
  })

  it('gives boss goals a mass that dominates everything else', () => {
    const ordinary = massOf({ priority: 5, difficulty: 5, boss: false })
    const boss = massOf({ priority: 1, difficulty: 1, boss: true })
    expect(boss).toBeGreaterThan(ordinary)
  })

  it('produces a bounded, deterministic random stream', () => {
    const next = rng('seed')
    const values = Array.from({ length: 200 }, next)
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    expect(new Set(values).size).toBeGreaterThan(150)
    expect(Array.from({ length: 3 }, rng('seed'))).toEqual(values.slice(0, 3))
  })

  it('spaces orbits so sub-goals do not sit on top of each other', () => {
    const g = goal({ id: 'orbiter' })
    const radii = [0, 1, 2, 3].map((i) => orbitOf(g, i).radius)
    for (let i = 1; i < radii.length; i += 1) expect(radii[i]!).toBeGreaterThan(radii[i - 1]!)
  })
})
