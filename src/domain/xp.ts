import type { EventType, Goal, Rating, TimelineEvent } from './types'

/**
 * Progression. Not stickers — a curve slow enough that a level means something
 * and fast enough that the first week moves.
 *
 * XP is awarded at write time and stored on the event, so changing this table
 * later never rewrites a person's history.
 */

const BASE: Partial<Record<EventType, number>> = {
  created: 20,
  progress: 12,
  milestone: 80,
  completed: 260,
  record: 45,
  achievement: 60,
  resumed: 15,
  reopened: 0,
}

/** A difficulty-5 goal is worth 2.4× a difficulty-1 one. */
const difficultyMultiplier = (d: Rating): number => 1 + (d - 1) * 0.35
/** Boss goals are the long game; finishing one should read as an event. */
const BOSS_MULTIPLIER = 2.5

/** Logging on a long streak pays a little more. Consistency is the product. */
export const streakBonus = (streak: number): number =>
  streak >= 30 ? 25 : streak >= 14 ? 15 : streak >= 7 ? 8 : 0

/** Coming back to something dormant is the hardest thing this product asks. */
export const RECOVERY_XP = 60
/** Idle days after which a return counts as a recovery. */
export const RECOVERY_AFTER = 14

export function xpFor(
  type: EventType,
  goal?: Pick<Goal, 'difficulty' | 'boss'> | null,
  extras: { streak?: number; recovery?: boolean } = {},
): number {
  const base = BASE[type] ?? 0
  if (!base) return 0
  let xp = base
  if (goal) {
    xp *= difficultyMultiplier(goal.difficulty)
    if (goal.boss) xp *= BOSS_MULTIPLIER
  }
  if (type === 'progress') {
    xp += streakBonus(extras.streak ?? 0)
    if (extras.recovery) xp += RECOVERY_XP
  }
  return Math.round(xp)
}

export const totalXp = (events: TimelineEvent[]): number =>
  events.reduce((sum, e) => sum + e.xp, 0)

/** Cumulative XP required to *reach* a level. Level 1 starts at zero. */
const CURVE_BASE = 140
const CURVE_EXP = 1.6
export const xpForLevel = (level: number): number =>
  level <= 1 ? 0 : Math.round(CURVE_BASE * Math.pow(level - 1, CURVE_EXP))

export interface Progression {
  level: number
  xp: number
  /** XP into the current level. */
  into: number
  /** XP the current level spans. */
  span: number
  /** 0..1 through the current level. */
  fraction: number
  nextAt: number
  title: string
}

/** Flavour, not hierarchy. Nobody is ranked against anybody. */
const TITLES = [
  'DRIFTER',
  'INITIATE',
  'OPERATOR',
  'ARCHITECT',
  'NAVIGATOR',
  'STRATEGIST',
  'VANGUARD',
  'PARAGON',
  'SOVEREIGN',
  'MYTHIC',
] as const

export function progression(xp: number): Progression {
  let level = 1
  while (xpForLevel(level + 1) <= xp && level < 999) level += 1
  const floor = xpForLevel(level)
  const nextAt = xpForLevel(level + 1)
  const span = nextAt - floor
  const into = xp - floor
  return {
    level,
    xp,
    into,
    span,
    fraction: span ? into / span : 0,
    nextAt,
    title: TITLES[Math.min(Math.floor((level - 1) / 4), TITLES.length - 1)] ?? 'DRIFTER',
  }
}
