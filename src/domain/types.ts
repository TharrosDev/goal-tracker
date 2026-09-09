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
  /**
   * The dispatch that closed this goal, when a dispatch closed it. Null when a
   * person closed it by hand. Undo reverses a completion only when it owns it.
   */
  completedBy: string | null

  startDate: ISODate
  deadline: ISODate | null

  category: string | null
  /**
   * Dye index 0-5, or null to derive it from the category (see identity.ts).
   * Deliberately not a free hue: colour outside the indigo dye family always
   * means state, so identity can never collide with a warning.
   */
  dye: number | null
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
  /**
   * The dispatch that crossed this gate, when a dispatch crossed it. Null when
   * it was ticked by hand — a hand-ticked gate is never rolled back by an undo.
   */
  doneBy: string | null
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
  /**
   * Position in this goal's ledger, assigned at write time and never reused.
   *
   * `at` alone is not a total order: two dispatches can share a millisecond, and
   * a 'set' correction replaces rather than adds — so replaying the ledger in an
   * ambiguous order can land on a different figure each time. The pair
   * (`at`, `seq`) is total and deterministic, which is what makes rebuilding the
   * figure from the ledger — on undo, on import, on repair — give one answer.
   */
  seq: number
}

/**
 * THE EVENT VOCABULARY.
 *
 * Every meaningful change to the record writes one of these, and each one is
 * specific enough that the chronicle can explain later what actually happened.
 * The bar for adding one is that a reader would want it explained; the bar for
 * NOT adding one is that the change says nothing about the campaign — settings,
 * a selection, a scroll position.
 *
 * `edited` is retained for records written before the vocabulary existed. New
 * writes use the specific type.
 */
export const EVENT_TYPES = [
  'created',
  'progress',
  'milestone',
  'milestone_added',
  'milestone_removed',
  'milestone_reopened',
  'deadline_changed',
  'target_changed',
  'recurrence_changed',
  'difficulty_changed',
  'boss_declared',
  'identity_changed',
  'linked',
  'unlinked',
  'reparented',
  'paused',
  'resumed',
  'record',
  'completed',
  'reopened',
  'archived',
  'restored',
  'struck',
  'unstruck',
  'imported',
  'edited',
  'note',
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
  /**
   * THE ACTION THAT CAUSED THIS.
   *
   * One dispatch can produce a progress event, several gate events, a record
   * and a completion. All of them carry the id of the ProgressEntry that caused
   * them, which is what makes an undo able to reverse the whole causal result
   * of one act instead of guessing at it by timestamp. Null for an event that
   * is its own cause (a goal created, a field edited).
   */
  cause: string | null
  data: Record<string, string | number | boolean | null>
}

export interface UnlockedAchievement {
  id: string
  at: ISOTime
  /** Whatever number earned it, for the badge to display. */
  value: number | null
  /** The action that earned it, so an undo can take back what it granted. */
  cause: string | null
}

export interface Settings {
  world: WorldId
  sound: boolean
  reducedMotionOverride: boolean | null
  universeRenderer: 'auto' | 'webgl' | 'list'
  lastSeenAt: ISOTime | null
}

/**
 * The five camps. Same semantic token names, different values — see DESIGN.md
 * section 4. LACQUER is the authored default; the rest are peers, not variants.
 */
export const WORLD_IDS = ['lacquer', 'washi', 'sumi', 'kuro', 'jigoku'] as const
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
