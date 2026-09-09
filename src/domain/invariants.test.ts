import { describe, expect, it } from 'vitest'
import {
  ancestors,
  canLink,
  canParent,
  completionDrift,
  normaliseGoal,
  normaliseGraph,
  normaliseWorld,
  reconcileMilestones,
  wouldCycle,
} from './invariants'
import type { Goal, Milestone, ProgressEntry } from './types'
import { goal as makeTestGoal } from '@/test/fixtures'

/**
 * The states this product must never be able to reach.
 *
 * Each of these was reachable through some real path — a screen that wrote a
 * field without checking, an import of a file somebody had edited, or a number
 * that came back down after it had already passed something. They are prevented
 * in one place now, and this is that place's proof.
 */

const g = (over: Partial<Goal> = {}): Goal => ({ ...makeTestGoal(), ...over })

const gate = (over: Partial<Milestone> = {}): Milestone => ({
  id: 'm1',
  goalId: 'g1',
  title: 'A gate',
  at: null,
  dueDate: null,
  done: false,
  doneAt: null,
  doneBy: null,
  order: 0,
  ...over,
})

const dispatch = (over: Partial<ProgressEntry> = {}): ProgressEntry => ({
  id: 'e1',
  goalId: 'g1',
  at: '2026-01-02T00:00:00.000Z',
  amount: 10,
  mode: 'delta',
  note: '',
  seq: 1,
  ...over,
})

describe('parent cycles', () => {
  const chain = [
    g({ id: 'a', title: 'A', parentId: null }),
    g({ id: 'b', title: 'B', parentId: 'a' }),
    g({ id: 'c', title: 'C', parentId: 'b' }),
  ]

  it('walks a chain of parents nearest first', () => {
    expect(ancestors(chain, 'c')).toEqual(['b', 'a'])
  })

  it('refuses a goal as its own parent', () => {
    expect(wouldCycle(chain, 'a', 'a')).toBe(true)
    expect(canParent(chain, 'a', 'a').ok).toBe(false)
  })

  it('refuses a two-goal loop', () => {
    expect(wouldCycle(chain, 'a', 'b')).toBe(true)
  })

  it('refuses a loop several removes away', () => {
    expect(wouldCycle(chain, 'a', 'c')).toBe(true)
    expect(canParent(chain, 'a', 'c').reason).toMatch(/already belongs/)
  })

  it('allows an ordinary reparent', () => {
    expect(canParent(chain, 'c', 'a').ok).toBe(true)
  })

  it('refuses a parent that is not on the field', () => {
    expect(canParent(chain, 'c', 'ghost').ok).toBe(false)
  })

  it('does not hang on a ring that no root reaches', () => {
    const ring = [g({ id: 'x', parentId: 'y' }), g({ id: 'y', parentId: 'x' })]
    expect(ancestors(ring, 'x')).toEqual(['y'])
  })

  it('breaks an imported ring rather than dropping the goals in it', () => {
    const ring = [
      g({ id: 'x', title: 'X', parentId: 'y' }),
      g({ id: 'y', title: 'Y', parentId: 'x' }),
    ]
    const { goals, changes } = normaliseGraph(ring)
    expect(goals).toHaveLength(2)
    expect(goals.filter((n) => n.parentId !== null).length).toBeLessThan(2)
    expect(changes.join(' ')).toMatch(/loop/)
  })

  it('drops a parent that does not exist', () => {
    const { goals } = normaliseGraph([g({ id: 'x', parentId: 'gone' })])
    expect(goals[0]!.parentId).toBeNull()
  })
})

describe('ties', () => {
  it('refuses a self-tie', () => {
    expect(canLink([g({ id: 'a' })], 'a', 'a').ok).toBe(false)
  })

  it('makes a one-sided tie mutual', () => {
    const { goals } = normaliseGraph([
      g({ id: 'a', title: 'A', linkedIds: ['b'] }),
      g({ id: 'b', title: 'B', linkedIds: [] }),
    ])
    expect(goals.find((x) => x.id === 'b')!.linkedIds).toEqual(['a'])
  })

  it('removes duplicates and self-references', () => {
    const { goals } = normaliseGraph([
      g({ id: 'a', title: 'A', linkedIds: ['b', 'b', 'a'] }),
      g({ id: 'b', title: 'B', linkedIds: ['a'] }),
    ])
    expect(goals.find((x) => x.id === 'a')!.linkedIds).toEqual(['b'])
  })

  it('drops a tie to a goal that is gone', () => {
    const { goals } = normaliseGraph([g({ id: 'a', title: 'A', linkedIds: ['ghost'] })])
    expect(goals[0]!.linkedIds).toEqual([])
  })
})

describe('a goal on its own', () => {
  it('treats a target of zero as no target, rather than instantly finished', () => {
    const fixed = normaliseGoal(g({ kind: 'numeric', target: 0, current: 0 }))
    expect(fixed.target).toBeNull()
    expect(completionDrift(fixed, [])).toBeNull()
  })

  it('treats a negative target the same way', () => {
    expect(normaliseGoal(g({ kind: 'numeric', target: -50 })).target).toBeNull()
  })

  it('drops a target that is not a number', () => {
    expect(normaliseGoal(g({ kind: 'numeric', target: Number.NaN })).target).toBeNull()
    expect(normaliseGoal(g({ kind: 'numeric', target: Number.POSITIVE_INFINITY })).target).toBeNull()
  })

  it('never lets a figure go below nought', () => {
    expect(normaliseGoal(g({ current: -12 })).current).toBe(0)
  })

  it('holds a percentage inside its own range', () => {
    const fixed = normaliseGoal(g({ kind: 'percentage', target: 100, current: 140 }))
    expect(fixed.current).toBe(100)
  })

  it('clamps a recurrence of zero times rather than destroying the goal', () => {
    const fixed = normaliseGoal(g({ recurrence: { period: 'week', times: 0 } }))
    expect(fixed.recurrence).toEqual({ period: 'week', times: 1 })
  })

  it('refuses to let a goal be its own parent', () => {
    expect(normaliseGoal(g({ id: 'g1', parentId: 'g1' })).parentId).toBeNull()
  })

  it('makes the two halves of "taken" agree', () => {
    expect(normaliseGoal(g({ done: true, completedAt: null })).completedAt).not.toBeNull()
    expect(
      normaliseGoal(g({ done: false, completedAt: '2026-02-02T00:00:00.000Z' })).done,
    ).toBe(true)
  })
})

describe('gates against the figure', () => {
  const goal = g({ id: 'g1', kind: 'numeric', target: 1000, current: 50 })

  it('takes down a value gate the figure no longer clears', () => {
    const gates = [gate({ id: 'm1', at: 100, done: true, doneBy: 'e1', doneAt: 'x' })]
    const fixed = reconcileMilestones(goal, gates)
    expect(fixed[0]).toMatchObject({ done: false, doneAt: null, doneBy: null })
  })

  it('leaves a gate the figure still clears', () => {
    const gates = [gate({ id: 'm1', at: 10, done: true, doneBy: 'e1' })]
    expect(reconcileMilestones(goal, gates)[0]!.done).toBe(true)
  })

  it('never unticks a gate a person ticked by hand', () => {
    const gates = [gate({ id: 'm1', at: 900, done: true, doneBy: null })]
    expect(reconcileMilestones(goal, gates)[0]!.done).toBe(true)
  })

  it('never unticks a gate with no value on it', () => {
    const gates = [gate({ id: 'm1', at: null, done: true, doneBy: 'e1' })]
    expect(reconcileMilestones(goal, gates)[0]!.done).toBe(true)
  })

  it("leaves another goal's gates alone", () => {
    const gates = [gate({ id: 'm1', goalId: 'other', at: 900, done: true, doneBy: 'e1' })]
    expect(reconcileMilestones(goal, gates)[0]!.done).toBe(true)
  })
})

describe('completion that no longer holds', () => {
  it('reopens a goal a dispatch closed once the figure falls back', () => {
    const goal = g({ kind: 'numeric', target: 100, current: 40, done: true, completedBy: 'e1' })
    expect(completionDrift(goal, [])).toMatchObject({ done: false })
  })

  it('does not reopen a goal a person closed by hand', () => {
    const goal = g({ kind: 'numeric', target: 100, current: 40, done: true, completedBy: null })
    expect(completionDrift(goal, [])).toBeNull()
  })

  it('closes a project once every part is done', () => {
    const goal = g({ id: 'g1', kind: 'project', target: null, done: false })
    const gates = [gate({ id: 'm1', done: true }), gate({ id: 'm2', done: true })]
    expect(completionDrift(goal, gates)).toMatchObject({ done: true })
  })

  it('leaves a project with no parts open', () => {
    const goal = g({ id: 'g1', kind: 'project', target: null, done: false })
    expect(completionDrift(goal, [])).toBeNull()
  })

  it('reopens a project once a new part is added to it', () => {
    const goal = g({ id: 'g1', kind: 'project', target: null, done: true, completedBy: 'e1' })
    const gates = [gate({ id: 'm1', done: true }), gate({ id: 'm2', done: false })]
    expect(completionDrift(goal, gates)).toMatchObject({ done: false })
  })

  it('never closes a binary goal by arithmetic', () => {
    const goal = g({ kind: 'milestone', target: null, current: 0, done: false })
    expect(completionDrift(goal, [])).toBeNull()
  })
})

describe('a whole world put right', () => {
  it('rebuilds a figure that disagrees with its ledger', () => {
    const repair = normaliseWorld({
      goals: [g({ id: 'g1', kind: 'numeric', target: 1000, current: 9999 })],
      milestones: [],
      entries: [dispatch({ amount: 25 })],
      events: [],
    })
    expect(repair.goals[0]!.current).toBe(25)
    expect(repair.changes.join(' ')).toMatch(/disagreed with its dispatches/)
  })

  it('drops rows pointing at a goal that is gone', () => {
    const repair = normaliseWorld({
      goals: [],
      milestones: [gate({ goalId: 'ghost' })],
      entries: [dispatch({ goalId: 'ghost' })],
      events: [],
    })
    expect(repair.milestones).toHaveLength(0)
    expect(repair.entries).toHaveLength(0)
  })

  it('takes down gates the rebuilt figure no longer clears', () => {
    const repair = normaliseWorld({
      goals: [g({ id: 'g1', kind: 'numeric', target: 1000, current: 900 })],
      milestones: [gate({ id: 'm1', at: 500, done: true, doneBy: 'e1' })],
      entries: [dispatch({ amount: 20 })],
      events: [],
    })
    expect(repair.goals[0]!.current).toBe(20)
    expect(repair.milestones[0]!.done).toBe(false)
  })

  it('reports every repair in a sentence a person could read', () => {
    const repair = normaliseWorld({
      goals: [
        g({ id: 'a', title: 'A', parentId: 'a', linkedIds: ['b'] }),
        g({ id: 'b', title: 'B', linkedIds: [] }),
      ],
      milestones: [],
      entries: [],
      events: [],
    })
    expect(repair.goals.find((x) => x.id === 'a')!.parentId).toBeNull()
    expect(repair.goals.find((x) => x.id === 'b')!.linkedIds).toEqual(['a'])
    expect(repair.changes.every((c) => typeof c === 'string' && c.length > 0)).toBe(true)
  })

  it('leaves a sound world completely alone', () => {
    const repair = normaliseWorld({
      goals: [g({ id: 'g1', kind: 'numeric', target: 1000, current: 10 })],
      milestones: [gate({ id: 'm1', at: 5, done: true, doneBy: 'e1' })],
      entries: [dispatch({ amount: 10 })],
      events: [],
    })
    expect(repair.changes).toEqual([])
  })
})
