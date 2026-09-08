import { z } from 'zod'
import { EVENT_TYPES, GOAL_KINDS, WORLD_IDS } from './types'
import type { Goal, GoalKind, Milestone, Rating, Settings } from './types'
import { now, today } from './date'

/**
 * The trust boundary. Anything arriving from a file, a URL, or a previous
 * version of this app passes through here before it is allowed near the store.
 * Unknown keys are stripped rather than rejected: a backup from a newer build
 * should still import what this build understands.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
const isoTime = z.string().min(20).max(30)
const rating = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])

export const goalLinkSchema = z.object({
  label: z.string().max(120).default(''),
  url: z.string().max(2000).default(''),
})

export const recurrenceSchema = z.object({
  period: z.enum(['day', 'week', 'month']),
  times: z.number().int().min(1).max(100),
})

export const goalSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(GOAL_KINDS),
  title: z.string().min(1).max(200),
  why: z.string().max(2000).default(''),
  definitionOfDone: z.string().max(2000).default(''),
  unit: z.string().max(24).default(''),
  target: z.number().finite().nullable().default(null),
  current: z.number().finite().default(0),
  done: z.boolean().default(false),
  completedAt: isoTime.nullable().default(null),
  startDate: isoDate,
  deadline: isoDate.nullable().default(null),
  category: z.string().max(60).nullable().default(null),
  hue: z.number().min(0).max(359).nullable().default(null),
  icon: z.string().max(8).nullable().default(null),
  priority: rating.default(3),
  difficulty: rating.default(3),
  boss: z.boolean().default(false),
  parentId: z.string().nullable().default(null),
  linkedIds: z.array(z.string()).default([]),
  notes: z.string().max(20000).default(''),
  links: z.array(goalLinkSchema).default([]),
  recurrence: recurrenceSchema.nullable().default(null),
  paused: z.boolean().default(false),
  archived: z.boolean().default(false),
  createdAt: isoTime,
  updatedAt: isoTime,
})

export const milestoneSchema = z.object({
  id: z.string().min(1),
  goalId: z.string().min(1),
  title: z.string().min(1).max(200),
  at: z.number().finite().nullable().default(null),
  dueDate: isoDate.nullable().default(null),
  done: z.boolean().default(false),
  doneAt: isoTime.nullable().default(null),
  order: z.number().int().default(0),
})

export const progressEntrySchema = z.object({
  id: z.string().min(1),
  goalId: z.string().min(1),
  at: isoTime,
  amount: z.number().finite(),
  mode: z.enum(['delta', 'set']).default('delta'),
  note: z.string().max(2000).default(''),
})

export const timelineEventSchema = z.object({
  id: z.string().min(1),
  goalId: z.string().nullable().default(null),
  type: z.enum(EVENT_TYPES),
  at: isoTime,
  xp: z.number().finite().default(0),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
})

export const unlockedAchievementSchema = z.object({
  id: z.string().min(1),
  at: isoTime,
  value: z.number().finite().nullable().default(null),
})

export const settingsSchema = z.object({
  world: z.enum(WORLD_IDS).default('signal'),
  sound: z.boolean().default(false),
  reducedMotionOverride: z.boolean().nullable().default(null),
  universeRenderer: z.enum(['auto', 'webgl', 'list']).default('auto'),
  lastSeenAt: isoTime.nullable().default(null),
})

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({})

/** Current backup format version. Bump only when the shape changes. */
export const BACKUP_VERSION = 2

export const backupSchema = z.object({
  format: z.literal('ambition-engine'),
  version: z.number().int().min(1),
  exportedAt: isoTime,
  goals: z.array(goalSchema).default([]),
  milestones: z.array(milestoneSchema).default([]),
  entries: z.array(progressEntrySchema).default([]),
  events: z.array(timelineEventSchema).default([]),
  achievements: z.array(unlockedAchievementSchema).default([]),
  settings: settingsSchema.default(DEFAULT_SETTINGS),
})

/** The v1 almanac's storage shape: a bare array under `goals.v1`. */
export const legacyGoalSchema = z.object({
  id: z.string().default(''),
  type: z.enum(['money', 'milestone']),
  title: z.string().min(1),
  target: z.number().nullable().default(null),
  current: z.number().nullable().default(null),
  done: z.boolean().default(false),
  deadline: isoDate.nullable().default(null),
  createdAt: isoDate,
})
export const legacyBackupSchema = z.array(legacyGoalSchema)
export type LegacyGoal = z.infer<typeof legacyGoalSchema>

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

/** Kinds that carry no numeric target, so the form never asks for one. */
export const TARGETLESS: ReadonlySet<GoalKind> = new Set([
  'milestone',
  'deadline',
  'project',
  'countdown',
])

export interface NewGoal {
  kind: GoalKind
  title: string
  target?: number | null
  unit?: string
  deadline?: string | null
  startDate?: string
  why?: string
  definitionOfDone?: string
  category?: string | null
  hue?: number | null
  icon?: string | null
  priority?: Rating
  difficulty?: Rating
  boss?: boolean
  parentId?: string | null
  linkedIds?: string[]
  notes?: string
  recurrence?: Goal['recurrence']
}

/** The one place a Goal is born, so no field is ever quietly missing. */
export function makeGoal(input: NewGoal): Goal {
  const stamp = now()
  const target = TARGETLESS.has(input.kind)
    ? null
    : input.kind === 'percentage'
      ? (input.target ?? 100)
      : (input.target ?? null)
  return {
    id: uid(),
    kind: input.kind,
    title: input.title.trim(),
    why: input.why?.trim() ?? '',
    definitionOfDone: input.definitionOfDone?.trim() ?? '',
    unit: input.unit?.trim() ?? '',
    target,
    current: 0,
    done: false,
    completedAt: null,
    startDate: input.startDate ?? today(),
    deadline: input.deadline || null,
    category: input.category?.trim() || null,
    hue: input.hue ?? null,
    icon: input.icon ?? null,
    priority: input.priority ?? 3,
    difficulty: input.difficulty ?? 3,
    boss: input.boss ?? false,
    parentId: input.parentId ?? null,
    linkedIds: input.linkedIds ?? [],
    notes: input.notes ?? '',
    links: [],
    recurrence: input.recurrence ?? (input.kind === 'habit' ? { period: 'week', times: 3 } : null),
    paused: false,
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

export function makeMilestone(goalId: string, title: string, order: number, at?: number | null): Milestone {
  return {
    id: uid(),
    goalId,
    title: title.trim(),
    at: at ?? null,
    dueDate: null,
    done: false,
    doneAt: null,
    order,
  }
}

/**
 * Salvage what parses and quarantine what does not, rather than throwing away a
 * whole file because one record is broken. Returns both halves so the UI can say
 * exactly what it could not read.
 */
export function salvage<T>(
  schema: z.ZodType<T>,
  rows: unknown,
): { ok: T[]; rejected: { index: number; reason: string }[] } {
  if (!Array.isArray(rows)) return { ok: [], rejected: [{ index: -1, reason: 'not a list' }] }
  const ok: T[] = []
  const rejected: { index: number; reason: string }[] = []
  rows.forEach((row, index) => {
    const result = schema.safeParse(row)
    if (result.success) ok.push(result.data)
    else rejected.push({ index, reason: result.error.issues[0]?.message ?? 'invalid' })
  })
  return { ok, rejected }
}
