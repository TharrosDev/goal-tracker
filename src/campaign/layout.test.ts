import { describe, expect, it } from 'vitest'
import { orbitAt, planCampaign, type Pitched } from './layout'
import { viewOf } from '@/state/selectors'
import { goal as makeGoal } from '@/test/fixtures'
import type { Goal } from '@/domain/types'

/**
 * THE CAMP'S GROUND PLAN.
 *
 * Pure, so it is testable without a GPU — which matters more here than usual,
 * because the two worst bugs this surface ever had were both in this file and
 * both invisible in a screenshot: detachments pitched at their parent's exact
 * coordinates, which made every hierarchy line two identical points and drew
 * nothing at all; and a grandchild whose parent happened to appear later in the
 * list pitched at the world origin, halfway across the camp from what it
 * belongs to.
 */

const view = (over: Partial<Goal> & { id: string }) =>
  viewOf({ ...makeGoal(), ...over } as Goal, [], [], '2026-06-01')

const at = (plan: { bodies: Pitched[] }, id: string) =>
  plan.bodies.find((b) => b.view.goal.id === id)!

describe('planCampaign', () => {
  it('pitches nothing for an empty camp, and still reports an extent to frame', () => {
    const plan = planCampaign([])
    expect(plan.bodies).toHaveLength(0)
    expect(plan.links).toHaveLength(0)
    expect(plan.extent).toBeGreaterThan(0)
  })

  it('gives a detachment its own seat, not its parent’s', () => {
    const plan = planCampaign([
      view({ id: 'p', title: 'Parent' }),
      view({ id: 'c', title: 'Child', parentId: 'p' }),
    ])
    const parent = at(plan, 'p')
    const child = at(plan, 'c')
    expect(Math.hypot(child.x - parent.x, child.z - parent.z)).toBeGreaterThan(0.5)
  })

  it('seats a grandchild against its own parent however the list is ordered', () => {
    // Deliberately out of order: the grandchild comes before its parent.
    const plan = planCampaign([
      view({ id: 'grand', title: 'Grand', parentId: 'child' }),
      view({ id: 'child', title: 'Child', parentId: 'root' }),
      view({ id: 'root', title: 'Root' }),
    ])
    const child = at(plan, 'child')
    const grand = at(plan, 'grand')
    expect(grand.orbits).toBe('child')
    // The old plan put it at the origin, which is where the root region is.
    expect(Math.hypot(grand.x - child.x, grand.z - child.z)).toBeLessThan(
      child.orbitRadius + grand.orbitRadius + 2,
    )
  })

  it('draws one link per tie and one per belonging, never a duplicate', () => {
    const plan = planCampaign([
      view({ id: 'a', title: 'A', linkedIds: ['b'] }),
      view({ id: 'b', title: 'B', linkedIds: ['a'] }),
      view({ id: 'c', title: 'C', parentId: 'a' }),
    ])
    expect(plan.links.filter((l) => !l.hierarchy)).toHaveLength(1)
    expect(plan.links.filter((l) => l.hierarchy)).toHaveLength(1)
  })

  it('ignores a tie or a parent pointing at a standard that is not here', () => {
    const plan = planCampaign([view({ id: 'a', title: 'A', linkedIds: ['ghost'], parentId: 'gone' })])
    expect(plan.links).toHaveLength(0)
    expect(at(plan, 'a').orbits).toBeNull()
  })

  it('terminates on a loop of ownership rather than hanging', () => {
    // The invariants break these before they can be stored, but an older file
    // could still carry one and this must not be an infinite loop.
    const plan = planCampaign([
      view({ id: 'x', title: 'X', parentId: 'y' }),
      view({ id: 'y', title: 'Y', parentId: 'x' }),
    ])
    expect(plan.bodies).toHaveLength(2)
  })

  it('grows the camp as more is pitched in it, so density stays readable', () => {
    const spread = (n: number) => {
      const plan = planCampaign(
        Array.from({ length: n }, (_, i) => view({ id: `g${i}`, title: `G${i}` })),
      )
      return Math.max(...plan.bodies.map((b) => Math.hypot(b.x, b.z)))
    }
    expect(spread(40)).toBeGreaterThan(spread(5))
  })

  it('gives a siege a body no ordinary standard can reach', () => {
    const plan = planCampaign([
      view({ id: 'a', title: 'A', priority: 5, difficulty: 5 }),
      view({ id: 'boss', title: 'Boss', boss: true, priority: 1, difficulty: 1 }),
    ])
    expect(at(plan, 'boss').size).toBeGreaterThan(at(plan, 'a').size)
  })

  it('is deterministic: the same camp is the same camp tomorrow', () => {
    const views = [view({ id: 'a', title: 'A' }), view({ id: 'b', title: 'B', parentId: 'a' })]
    const first = planCampaign(views)
    const second = planCampaign(views)
    expect(second.bodies.map((b) => [b.x, b.y, b.z])).toEqual(
      first.bodies.map((b) => [b.x, b.y, b.z]),
    )
  })
})

describe('orbitAt', () => {
  it('returns a root’s own position, whatever the angle', () => {
    const plan = planCampaign([view({ id: 'a', title: 'A' })])
    const body = at(plan, 'a')
    expect(orbitAt(body, undefined, 3)).toEqual({ x: body.x, y: body.y, z: body.z })
  })

  it('carries a detachment around its parent at a constant distance', () => {
    const plan = planCampaign([
      view({ id: 'p', title: 'Parent' }),
      view({ id: 'c', title: 'Child', parentId: 'p' }),
    ])
    const parent = at(plan, 'p')
    const child = at(plan, 'c')
    for (const angle of [0, 1, 2.5, 4, 6]) {
      const p = orbitAt(child, parent, angle)
      expect(Math.hypot(p.x - parent.x, p.z - parent.z)).toBeCloseTo(child.orbitRadius, 6)
    }
  })

  it('agrees with where the plan seats it at rest', () => {
    const plan = planCampaign([
      view({ id: 'p', title: 'Parent' }),
      view({ id: 'c', title: 'Child', parentId: 'p' }),
    ])
    const child = at(plan, 'c')
    const seat = orbitAt(child, at(plan, 'p'), child.phase)
    expect(seat.x).toBeCloseTo(child.x, 6)
    expect(seat.z).toBeCloseTo(child.z, 6)
  })
})
