import type { Goal } from './types'

/**
 * Procedural identity.
 *
 * Every goal gets a look nobody had to draw: a hue, a sigil, an orbit and a
 * call-sign, all derived deterministically from its id and metadata. Same goal,
 * same appearance, forever — across devices, exports and reloads. This is what
 * stops twenty goals from looking like twenty identical rows.
 */

/** FNV-1a. Small, stable, and good enough to spread ids across a hue wheel. */
export function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Deterministic 0..1 stream from a seed, so each trait can draw independently. */
export function rng(seed: string) {
  let state = hash(seed) || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0x100000000
  }
}

/**
 * Identity is a dye, not a hue.
 *
 * The first draft spread goals across the whole 360-degree wheel. That put a
 * money goal six degrees from `--ok` and a deadline goal on top of `--caution`,
 * inside a palette whose entire thesis is that colour is scarce — so a colour a
 * person never chose could contradict a warning the system was trying to give.
 *
 * There are now six dyes, all in the indigo family, all cleared for contrast in
 * every camp. Colour outside that family always means state. Identity's strong
 * channels are the mon and the stencil cut into the cloth; the dye is
 * deliberately a weak one, and it encodes CATEGORY — which is what a unit's
 * lacing colour actually identified.
 */
export const DYE_COUNT = 6

export function dyeOf(goal: Pick<Goal, 'dye' | 'kind' | 'category'>): number {
  if (goal.dye !== null) return goal.dye
  return hash(goal.category ?? goal.kind) % DYE_COUNT
}

export interface Sigil {
  /** Points per ring, outer first. Drawn as a radial glyph. */
  rings: { count: number; radius: number; rotation: number; shape: 'dot' | 'bar' | 'notch' }[]
  /** Rotational symmetry order, 2..8. */
  symmetry: number
  /** 0..1 — how much the glyph fills its box. Tracks difficulty. */
  weight: number
  /** Two-letter call-sign plus a number, e.g. 'RB-407'. */
  callsign: string
}

const SHAPES = ['dot', 'bar', 'notch'] as const

export function sigilOf(goal: Pick<Goal, 'id' | 'kind' | 'difficulty' | 'title'>): Sigil {
  const next = rng(goal.id + goal.kind)
  const ringCount = 2 + Math.floor(next() * 2) + (goal.difficulty >= 4 ? 1 : 0)
  const symmetry = 3 + Math.floor(next() * 6)
  const rings = Array.from({ length: ringCount }, (_, i) => ({
    count: symmetry * (1 + Math.floor(next() * 2)),
    radius: 1 - i * (0.62 / ringCount) - next() * 0.06,
    rotation: next() * 360,
    shape: SHAPES[Math.floor(next() * SHAPES.length)] ?? 'dot',
  }))
  const letters = goal.title
    .replace(/[^a-zA-Z ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join('')
    .slice(0, 2)
    .padEnd(2, 'X')
  return {
    rings,
    symmetry,
    weight: 0.4 + goal.difficulty * 0.12,
    callsign: `${letters}-${String(hash(goal.id) % 1000).padStart(3, '0')}`,
  }
}

export interface Orbit {
  /** Distance from the parent body, in scene units. */
  radius: number
  /** Radians per second at momentum 1. */
  speed: number
  /** Orbital plane tilt, radians. */
  inclination: number
  /** Starting angle, radians. */
  phase: number
  eccentricity: number
}

export function orbitOf(goal: Pick<Goal, 'id' | 'priority'>, index: number): Orbit {
  const next = rng(goal.id + 'orbit')
  return {
    radius: 2.2 + index * 1.35 + next() * 0.7,
    speed: (0.06 + next() * 0.09) / (1 + index * 0.35),
    inclination: (next() - 0.5) * 0.9,
    phase: next() * Math.PI * 2,
    eccentricity: next() * 0.22,
  }
}

/**
 * Physical size in the universe. Importance is priority × difficulty, with boss
 * goals given a floor so they always dominate whatever else is on screen.
 */
export function massOf(goal: Pick<Goal, 'priority' | 'difficulty' | 'boss'>): number {
  const base = 0.55 + goal.priority * 0.13 + goal.difficulty * 0.1
  return goal.boss ? Math.max(base * 1.9, 2.1) : base
}
