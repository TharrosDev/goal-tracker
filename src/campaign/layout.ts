import type { GoalView } from '@/state/selectors'
import { hash, orbitOf } from '@/domain/identity'

/**
 * THE CAMPAIGN'S GROUND PLAN.
 *
 * An encampment, not a galaxy. Standards are pitched around a centre, and the
 * one rule that makes the plan readable is that DISTANCE FROM THE CENTRE IS
 * INVERSE WEIGHT: what matters most is pitched closest to the command tent, the
 * way a camp is actually laid out. Nothing is placed at random, and nothing
 * moves unless the data moves.
 *
 * Positions are deterministic from the goal id, so the camp a person learns is
 * the camp they come back to. The angle is hashed; the radius is earned.
 */

export interface Pitched {
  view: GoalView
  /** Scene units from the centre. */
  x: number
  y: number
  z: number
  /** Body radius in scene units. */
  size: number
  /** Parent's id when this standard orbits another. */
  orbits: string | null
  /** Radians per second at momentum 1. Zero for a pitched standard. */
  spin: number
  orbitRadius: number
  phase: number
}

export interface Link {
  from: string
  to: string
  /** True when the relationship is parent/child rather than an alliance. */
  hierarchy: boolean
}

export interface CampaignPlan {
  bodies: Pitched[]
  links: Link[]
  /** Furthest body from the centre, so a camera can frame the whole camp. */
  extent: number
}

/**
 * Innermost and outermost radius a root standard can be pitched at.
 * Kept tight relative to body size: a camp spread over four times its own
 * contents reads as an empty plain with specks on it.
 */
const INNER = 2.4
const OUTER = 7.5

export function planCampaign(views: GoalView[]): CampaignPlan {
  const byId = new Map(views.map((v) => [v.goal.id, v]))
  const roots = views.filter((v) => !v.goal.parentId || !byId.has(v.goal.parentId))
  const children = views.filter((v) => v.goal.parentId && byId.has(v.goal.parentId))

  const bodies: Pitched[] = []

  // Roots: angle from the id, radius from weight. Heaviest nearest the centre.
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  roots.forEach((view, i) => {
    const jitter = ((hash(view.goal.id) % 1000) / 1000 - 0.5) * 0.6
    const angle = i * goldenAngle + jitter
    const radius = INNER + (1 - view.weight) * (OUTER - INNER)
    // A shallow height offset keeps the plan from reading as a flat disc without
    // making anything depend on depth to be understood.
    const lift = ((hash(view.goal.id + 'lift') % 1000) / 1000 - 0.5) * 2.4

    bodies.push({
      view,
      x: Math.cos(angle) * radius,
      y: lift,
      z: Math.sin(angle) * radius,
      size: sizeOf(view),
      orbits: null,
      spin: 0,
      orbitRadius: 0,
      phase: 0,
    })
  })

  // Detachments orbit whatever they belong to.
  const perParent = new Map<string, number>()
  for (const view of children) {
    const parentId = view.goal.parentId!
    const index = perParent.get(parentId) ?? 0
    perParent.set(parentId, index + 1)

    const parent = bodies.find((b) => b.view.goal.id === parentId)
    const orbit = orbitOf(view.goal, index)
    const scale = 0.42 // detachments orbit close; they are not their own camps

    bodies.push({
      view,
      x: parent?.x ?? 0,
      y: parent?.y ?? 0,
      z: parent?.z ?? 0,
      size: sizeOf(view) * 0.7,
      orbits: parentId,
      spin: orbit.speed,
      orbitRadius: orbit.radius * scale + (parent?.size ?? 0.5) + 0.6,
      phase: orbit.phase,
    })
  }

  const links: Link[] = []
  const seen = new Set<string>()
  for (const view of views) {
    if (view.goal.parentId && byId.has(view.goal.parentId))
      links.push({ from: view.goal.id, to: view.goal.parentId, hierarchy: true })
    for (const other of view.goal.linkedIds) {
      if (!byId.has(other)) continue
      const key = [view.goal.id, other].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      links.push({ from: view.goal.id, to: other, hierarchy: false })
    }
  }

  const extent = bodies.reduce(
    (max, b) => Math.max(max, Math.hypot(b.x, b.z) + b.orbitRadius + b.size),
    INNER,
  )

  return { bodies, links, extent }
}

/**
 * Body size. Boss standards are given a floor so a siege always dominates
 * whatever else is pitched near it.
 */
function sizeOf(view: GoalView): number {
  const base = 0.62 + view.goal.priority * 0.12 + view.goal.difficulty * 0.09
  return view.goal.boss ? Math.max(base * 1.8, 2.2) : base
}

/** Where a detachment actually sits at a given time. Pure, so the list agrees. */
export function orbitPosition(
  body: Pitched,
  parent: Pitched | undefined,
  seconds: number,
): { x: number; y: number; z: number } {
  if (!body.orbits || !parent) return { x: body.x, y: body.y, z: body.z }
  const a = body.phase + seconds * body.spin
  return {
    x: parent.x + Math.cos(a) * body.orbitRadius,
    y: parent.y + Math.sin(a * 0.5) * 0.3,
    z: parent.z + Math.sin(a) * body.orbitRadius,
  }
}
