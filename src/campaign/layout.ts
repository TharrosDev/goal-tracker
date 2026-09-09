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

  /*
   * The camp grows with what is pitched in it.
   *
   * A fixed outer radius was right for five standards and wrong for fifty: the
   * same annulus had to hold ten times the tents, and a camp reads as a camp
   * only while you can see the ground between them. It grows as the square root
   * of the count, which is what keeps DENSITY roughly constant rather than the
   * radius.
   */
  const outer = Math.max(OUTER, INNER + Math.sqrt(Math.max(roots.length, 1)) * 1.7)

  // Roots: angle from the id, radius from weight. Heaviest nearest the centre.
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  roots.forEach((view, i) => {
    const jitter = ((hash(view.goal.id) % 1000) / 1000 - 0.5) * 0.6
    const angle = i * goldenAngle + jitter
    const radius = INNER + (1 - view.weight) * (outer - INNER)
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

  /*
   * Detachments orbit whatever they belong to.
   *
   * They are pitched in DEPTH ORDER — every parent placed before its children —
   * because a detachment's seat is measured from its parent's. Taking them in
   * `views` order left a grandchild whose parent happened to come later in the
   * list sitting at the world origin, halfway across the camp from the thing it
   * belongs to.
   */
  const placed = new Map(bodies.map((b) => [b.view.goal.id, b]))
  const perParent = new Map<string, number>()
  const waiting = [...children]

  while (waiting.length) {
    const ready = waiting.filter((v) => placed.has(v.goal.parentId!))
    // Nothing left whose parent is down: the rest are inside a loop the
    // invariants would have broken, so pitch them as roots rather than lose them.
    const batch = ready.length ? ready : waiting.slice()

    for (const view of batch) {
      waiting.splice(waiting.indexOf(view), 1)
      const parentId = view.goal.parentId!
      const index = perParent.get(parentId) ?? 0
      perParent.set(parentId, index + 1)

      const parent = placed.get(parentId)
      const orbit = orbitOf(view.goal, index)
      const scale = 0.42 // detachments orbit close; they are not their own camps
      const orbitRadius = orbit.radius * scale + (parent?.size ?? 0.5) + 0.6

      /*
       * Its seat at rest, not its parent's.
       *
       * A detachment used to be pitched at its parent's exact coordinates, and
       * the link lines are drawn between pitched coordinates — so every line
       * from a detachment to what it belongs to was two identical points, which
       * rasterises nothing. Belonging is one of the three things this surface
       * exists to show, and it showed none of it. The real seat is where the
       * orbit starts, which is also where the roll should say it is.
       */
      const seat = parent
        ? {
            x: parent.x + Math.cos(orbit.phase) * orbitRadius,
            y: parent.y + Math.sin(orbit.phase * 0.5) * 0.3,
            z: parent.z + Math.sin(orbit.phase) * orbitRadius,
          }
        : { x: 0, y: 0, z: 0 }

      const body: Pitched = {
        view,
        x: seat.x,
        y: seat.y,
        z: seat.z,
        size: sizeOf(view) * 0.7,
        orbits: parent ? parentId : null,
        spin: orbit.speed,
        orbitRadius,
        phase: orbit.phase,
      }
      bodies.push(body)
      placed.set(view.goal.id, body)
    }
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

/**
 * Where a detachment sits at a given ANGLE around its parent.
 *
 * The angle is passed rather than derived from a rate and a clock, because the
 * scene accumulates it: deriving it as `elapsed * rate` means every detachment
 * jumps the instant the rate changes, and the rate here is momentum, which moves
 * whenever anybody logs anything.
 */
export function orbitAt(
  body: Pitched,
  parent: Pitched | undefined,
  angle: number,
): { x: number; y: number; z: number } {
  if (!body.orbits || !parent) return { x: body.x, y: body.y, z: body.z }
  return {
    x: parent.x + Math.cos(angle) * body.orbitRadius,
    y: parent.y + Math.sin(angle * 0.5) * 0.3,
    z: parent.z + Math.sin(angle) * body.orbitRadius,
  }
}

/** Where a detachment sits after `seconds` at its own speed. Pure, so the list agrees. */
export const orbitPosition = (
  body: Pitched,
  parent: Pitched | undefined,
  seconds: number,
): { x: number; y: number; z: number } =>
  orbitAt(body, parent, body.phase + seconds * body.spin)
