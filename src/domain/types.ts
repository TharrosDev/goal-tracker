/**
 * The domain vocabulary. Nothing in this folder imports from React, the DB, or
 * the DOM: these are values and pure functions over them, so every rule that
 * decides where a person stands is testable without a browser.
 */

/** Calendar day, 'YYYY-MM-DD'. Day-granular on purpose — see date.ts. */
export type ISODate = string
/** Full instant, `new Date().toISOString()`. */
export type ISOTime = string

export const GOAL_KINDS = [
  'money',
  'numeric',
  'percentage',
  'habit',
  'streak',
  'project',
  'deadline',
  'milestone',
  'countdown',
  'custom',
] as const
export type GoalKind = (typeof GOAL_KINDS)[number]

/** 1 = trivial, 5 = the impossible. Drives XP, size in the universe, and pressure. */
export type Rating = 1 | 2 | 3 | 4 | 5

export type GoalState = 'new' | 'active' | 'critical' | 'stalled' | 'paused' | 'completed'

export interface GoalLink {
  label: string
  url: string
}

export interface Recurrence {
  period: 'day' | 'week' | 'month'
  /** How many times inside each period counts as keeping the commitment. */
  times: number
}

export interface Goal {
  id: string
  kind: GoalKind
  title: string
  /** The Ritual asks WHY. Kept because a cold reader needs the reason more than the number. */
  why: string
  /** The Ritual asks WHAT DOES FINISHED MEAN. Free text; the machine-readable half is `target`. */
  definitionOfDone: string

  /** Display unit for numeric/custom kinds ('km', 'books', 'lb'). Empty for the rest. */
  unit: string
  /** Null for kinds with no quantity (milestone, deadline, project, countdown). */
  target: number | null
  /** Cached fold of the entry ledger. Repaired by recomputeCurrent on import. */
  current: number
  /** Explicit completion, for kinds a number cannot close. */
  done: boolean
  completedAt: ISOTime | null

  startDate: ISODate
  deadline: ISODate | null

  category: string | null
  /** Hue 0-359. Null means derive it from the id (see identity.ts). */
  hue: number | null
  icon: string | null
  priority: Rating
  difficulty: Rating
  /** A long-horizon goal that earns the outrageous presentation. */
  boss: boolean

  parentId: string | null
  /** Non-hierarchical relationships, drawn as edges in the universe. */
  linkedIds: string[]
  notes: string
  links: GoalLink[]
  recurrence: Recurrence | null

  paused: boolean
  archived: boolean
  createdAt: ISOTime
  updatedAt: ISOTime
}

export interface Milestone {
  id: string
  goalId: string
  title: string
  /** Value of `goal.current` at which this is reached. Null = manual only. */
  at: number | null
  dueDate: ISODate | null
  done: boolean
  doneAt: ISOTime | null
  order: number
}

export interface ProgressEntry {
  id: string
  goalId: string
  at: ISOTime
  /** Signed delta in the goal's unit. Habit/streak check-ins use 1. */
  amount: number
  /** 'delta' adds; 'set' replaces (used by percentage and correction). */
  mode: 'delta' | 'set'
  note: string
}

export const EVENT_TYPES = [
  'created',
  'progress',
  'milestone',
  'deadline_changed',
  'paused',
  'resumed',
  'record',
  'completed',
  'reopened',
  'archived',
  'restored',
  'edited',
  'note',
  'level_up',
  'achievement',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

/**
 * The append-only spine. Momentum, XP, streaks, achievements, analytics and the
 * Time Machine are all folds over this list — nothing derived is stored twice.
 */
export interface TimelineEvent {
  id: string
  goalId: string | null
  type: EventType
  at: ISOTime
  /** Awarded at write time so a curve change never rewrites history. */
  xp: number
  data: Record<string, string | number | boolean | null>
}

export interface UnlockedAchievement {
  id: string
  at: ISOTime
  /** Whatever number earned it, for the badge to display. */
  value: number | null
}

export interface Settings {
  world: WorldId
  sound: boolean
  reducedMotionOverride: boolean | null
  universeRenderer: 'auto' | 'webgl' | 'list'
  lastSeenAt: ISOTime | null
}

export const WORLD_IDS = ['signal', 'void', 'paper', 'terminal', 'chaos'] as const
export type WorldId = (typeof WORLD_IDS)[number]

/** The full portable shape: what export writes and import reads. */
export interface Backup {
  format: 'ambition-engine'
  version: number
  exportedAt: ISOTime
  goals: Goal[]
  milestones: Milestone[]
  entries: ProgressEntry[]
  events: TimelineEvent[]
  achievements: UnlockedAchievement[]
  settings: Settings
}
