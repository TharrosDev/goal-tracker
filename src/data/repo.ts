import type {
  Goal,
  Milestone,
  ProgressEntry,
  TimelineEvent,
  UnlockedAchievement,
} from '@/domain/types'
import { makeGoal, makeMilestone, uid, type NewGoal } from '@/domain/schema'
import { dayOf, days, now, today } from '@/domain/date'
import {
  applyEntry,
  daysSinceProgress,
  isDone,
  streakLength,
} from '@/domain/progress'
import { RECOVERY_AFTER, xpFor } from '@/domain/xp'
import { newlyUnlocked } from '@/domain/achievements'
import { db } from './db'

/**
 * Every mutation in the product goes through this file.
 *
 * Two invariants hold here and nowhere else:
 *   1. A change to a record and the event that describes it are written in the
 *      same transaction. The timeline cannot drift from the data.
 *   2. XP is stamped onto the event at write time, so tuning the curve later
 *      never rewrites what somebody already earned.
 */

export interface Snapshot {
  goals: Goal[]
  milestones: Milestone[]
  entries: ProgressEntry[]
  events: TimelineEvent[]
}

export interface WorldState extends Snapshot {
  achievements: UnlockedAchievement[]
}

export async function readAll(): Promise<WorldState> {
  const [goals, milestones, entries, events, achievements] = await Promise.all([
    db.goals.toArray(),
    db.milestones.toArray(),
    db.entries.toArray(),
    db.events.toArray(),
    db.achievements.toArray(),
  ])
  return { goals, milestones, entries, events, achievements }
}

function event(
  type: TimelineEvent['type'],
  goalId: string | null,
  xp: number,
  data: TimelineEvent['data'] = {},
): TimelineEvent {
  return { id: uid(), goalId, type, at: now(), xp, data }
}

// ── creation ────────────────────────────────────────────────────────────────

export async function createGoal(
  input: NewGoal,
  milestoneTitles: string[] = [],
): Promise<{ goal: Goal; milestones: Milestone[]; event: TimelineEvent }> {
  const goal = makeGoal(input)
  const milestones = milestoneTitles
    .map((t) => t.trim())
    .filter(Boolean)
    .map((title, i) => makeMilestone(goal.id, title, i))
  const created = event('created', goal.id, xpFor('created', goal), {
    kind: goal.kind,
    boss: goal.boss,
    difficulty: goal.difficulty,
  })

  await db.transaction('rw', [db.goals, db.milestones, db.events], async () => {
    await db.goals.put(goal)
    if (milestones.length) await db.milestones.bulkPut(milestones)
    await db.events.put(created)
  })
  return { goal, milestones, event: created }
}

// ── progress ────────────────────────────────────────────────────────────────

export interface LogResult {
  goal: Goal
  entry: ProgressEntry
  events: TimelineEvent[]
  /** Milestones crossed by this entry. Drives the celebration tier. */
  reached: Milestone[]
  completed: boolean
  /** True when this entry is the largest single move on this goal so far. */
  record: boolean
  /** True when this ended a fortnight or more of silence. */
  recovery: boolean
  xp: number
}

/**
 * The hot path. Logging progress is the one interaction that must never feel
 * expensive, so this is a single transaction and a single read of the ledger.
 */
export async function logProgress(
  goalId: string,
  amount: number,
  options: { mode?: ProgressEntry['mode']; note?: string; at?: string } = {},
): Promise<LogResult> {
  const goal = await db.goals.get(goalId)
  if (!goal) throw new Error('goal not found')

  const mine = await db.entries.where('goalId').equals(goalId).toArray()
  const idle = daysSinceProgress(mine)
  const recovery = idle !== null && idle >= RECOVERY_AFTER

  const allEntries = await db.entries.toArray()
  const streak = streakLength(allEntries)

  const entry: ProgressEntry = {
    id: uid(),
    goalId,
    at: options.at ?? now(),
    amount,
    mode: options.mode ?? 'delta',
    note: options.note ?? '',
  }

  const before = goal.current
  const next: Goal = {
    ...goal,
    current: applyEntry(goal, entry),
    updatedAt: now(),
  }

  const goalMilestones = await db.milestones.where('goalId').equals(goalId).toArray()
  const reached = goalMilestones
    .filter((m) => !m.done && m.at !== null)
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
    .filter((m) => next.current >= (m.at ?? Infinity))

  const biggest = Math.max(0, ...mine.filter((e) => e.mode === 'delta').map((e) => e.amount))
  const record = entry.mode === 'delta' && amount > biggest && mine.length >= 3

  const doneStamp = now()
  const reachedDone = reached.map((m) => ({ ...m, done: true, doneAt: doneStamp }))
  // A project closes when its last part does, so completion is judged against
  // the milestone list as it will be after this write, not as it was before.
  const afterMilestones = goalMilestones.map((m) => reachedDone.find((r) => r.id === m.id) ?? m)
  const completed = !goal.completedAt && isDone(next, afterMilestones)
  if (completed) {
    next.completedAt = now()
    next.done = true
  }

  const events: TimelineEvent[] = [
    event('progress', goalId, xpFor('progress', goal, { streak, recovery }), {
      amount,
      mode: entry.mode,
      from: before,
      to: next.current,
      recovery,
      streak,
    }),
  ]
  for (const m of reached)
    events.push(event('milestone', goalId, xpFor('milestone', goal), { title: m.title, at: m.at }))
  if (record) events.push(event('record', goalId, xpFor('record', goal), { amount }))
  if (completed)
    events.push(
      event('completed', goalId, xpFor('completed', goal), {
        value: next.current,
        target: goal.target,
        days: days(goal.startDate, today()),
      }),
    )

  await db.transaction('rw', [db.goals, db.entries, db.events, db.milestones], async () => {
    await db.entries.put(entry)
    await db.goals.put(next)
    if (reachedDone.length) await db.milestones.bulkPut(reachedDone)
    await db.events.bulkPut(events)
  })

  return {
    goal: next,
    entry,
    events,
    reached: reachedDone,
    completed,
    record,
    recovery,
    xp: events.reduce((s, e) => s + e.xp, 0),
  }
}

/** Undo the most recent entry on a goal, rolling the cached total back with it. */
export async function undoEntry(entryId: string): Promise<void> {
  const entry = await db.entries.get(entryId)
  if (!entry) return
  const goal = await db.goals.get(entry.goalId)
  if (!goal) return
  const remaining = (await db.entries.where('goalId').equals(entry.goalId).toArray()).filter(
    (e) => e.id !== entryId,
  )
  let value = 0
  for (const e of remaining.sort((a, b) => a.at.localeCompare(b.at)))
    value = applyEntry({ ...goal, current: value }, e)

  const events = await db.events.where('goalId').equals(entry.goalId).toArray()
  const orphaned = events
    .filter((e) => e.type === 'progress' && Math.abs(Date.parse(e.at) - Date.parse(entry.at)) < 2000)
    .map((e) => e.id)

  await db.transaction('rw', [db.goals, db.entries, db.events], async () => {
    await db.entries.delete(entryId)
    await db.goals.put({ ...goal, current: value, updatedAt: now() })
    if (orphaned.length) await db.events.bulkDelete(orphaned)
  })
}

// ── milestones ──────────────────────────────────────────────────────────────

export async function setMilestoneDone(id: string, done: boolean): Promise<Milestone | null> {
  const m = await db.milestones.get(id)
  if (!m) return null
  const next: Milestone = { ...m, done, doneAt: done ? now() : null }
  const goal = await db.goals.get(m.goalId)
  await db.transaction('rw', [db.milestones, db.events], async () => {
    await db.milestones.put(next)
    if (done)
      await db.events.put(
        event('milestone', m.goalId, xpFor('milestone', goal), { title: m.title }),
      )
  })
  return next
}

export async function addMilestone(goalId: string, title: string, at: number | null = null) {
  const count = await db.milestones.where('goalId').equals(goalId).count()
  const m = makeMilestone(goalId, title, count, at)
  await db.milestones.put(m)
  return m
}

export const removeMilestone = (id: string): Promise<void> => db.milestones.delete(id)

// ── lifecycle ───────────────────────────────────────────────────────────────

export async function patchGoal(id: string, patch: Partial<Goal>): Promise<Goal | null> {
  const goal = await db.goals.get(id)
  if (!goal) return null
  const next: Goal = { ...goal, ...patch, id: goal.id, updatedAt: now() }

  const events: TimelineEvent[] = []
  if (patch.deadline !== undefined && patch.deadline !== goal.deadline)
    events.push(
      event('deadline_changed', id, 0, { from: goal.deadline, to: patch.deadline ?? null }),
    )
  if (patch.paused !== undefined && patch.paused !== goal.paused)
    events.push(
      patch.paused
        ? event('paused', id, 0)
        : event('resumed', id, xpFor('resumed', goal)),
    )
  if (patch.archived !== undefined && patch.archived !== goal.archived)
    events.push(patch.archived ? event('archived', id, 0) : event('restored', id, 0))
  if (!events.length) events.push(event('edited', id, 0, { fields: Object.keys(patch).join(',') }))

  await db.transaction('rw', [db.goals, db.events], async () => {
    await db.goals.put(next)
    await db.events.bulkPut(events)
  })
  return next
}

export async function completeGoal(id: string): Promise<{ goal: Goal; xp: number } | null> {
  const goal = await db.goals.get(id)
  if (!goal || goal.completedAt) return null
  const next: Goal = { ...goal, done: true, completedAt: now(), updatedAt: now() }
  const e = event('completed', id, xpFor('completed', goal), {
    value: goal.current,
    target: goal.target,
    days: days(goal.startDate, today()),
    manual: true,
  })
  await db.transaction('rw', [db.goals, db.events], async () => {
    await db.goals.put(next)
    await db.events.put(e)
  })
  return { goal: next, xp: e.xp }
}

export async function reopenGoal(id: string): Promise<Goal | null> {
  const goal = await db.goals.get(id)
  if (!goal) return null
  const next: Goal = { ...goal, done: false, completedAt: null, updatedAt: now() }
  await db.transaction('rw', [db.goals, db.events], async () => {
    await db.goals.put(next)
    await db.events.put(event('reopened', id, 0))
  })
  return next
}

/** Everything a delete removed, so the undo can put it back exactly. */
export interface Trash {
  goal: Goal
  milestones: Milestone[]
  entries: ProgressEntry[]
  events: TimelineEvent[]
  children: Goal[]
}

/**
 * Deleting is the only irreversible thing here, so it is not irreversible:
 * every row is handed back to the caller for an undo, and sub-goals are
 * detached rather than destroyed with their parent.
 */
export async function deleteGoal(id: string): Promise<Trash | null> {
  const goal = await db.goals.get(id)
  if (!goal) return null
  const [milestones, entries, events, children] = await Promise.all([
    db.milestones.where('goalId').equals(id).toArray(),
    db.entries.where('goalId').equals(id).toArray(),
    db.events.where('goalId').equals(id).toArray(),
    db.goals.where('parentId').equals(id).toArray(),
  ])

  await db.transaction(
    'rw',
    [db.goals, db.milestones, db.entries, db.events],
    async () => {
      await db.goals.delete(id)
      await db.milestones.bulkDelete(milestones.map((m) => m.id))
      await db.entries.bulkDelete(entries.map((e) => e.id))
      await db.events.bulkDelete(events.map((e) => e.id))
      if (children.length)
        await db.goals.bulkPut(children.map((c) => ({ ...c, parentId: null })))
      // Also drop dangling links from every other goal.
      const linked = await db.goals.filter((g) => g.linkedIds.includes(id)).toArray()
      if (linked.length)
        await db.goals.bulkPut(
          linked.map((g) => ({ ...g, linkedIds: g.linkedIds.filter((x) => x !== id) })),
        )
    },
  )
  return { goal, milestones, entries, events, children }
}

export async function restoreTrash(trash: Trash): Promise<void> {
  await db.transaction('rw', [db.goals, db.milestones, db.entries, db.events], async () => {
    await db.goals.put(trash.goal)
    await db.milestones.bulkPut(trash.milestones)
    await db.entries.bulkPut(trash.entries)
    await db.events.bulkPut(trash.events)
    if (trash.children.length) await db.goals.bulkPut(trash.children)
  })
}

// ── relationships ───────────────────────────────────────────────────────────

export async function toggleLink(a: string, b: string): Promise<void> {
  if (a === b) return
  const [ga, gb] = await Promise.all([db.goals.get(a), db.goals.get(b)])
  if (!ga || !gb) return
  const linked = ga.linkedIds.includes(b)
  const next = (g: Goal, other: string): Goal => ({
    ...g,
    linkedIds: linked ? g.linkedIds.filter((x) => x !== other) : [...g.linkedIds, other],
    updatedAt: now(),
  })
  await db.goals.bulkPut([next(ga, b), next(gb, a)])
}

// ── achievements ────────────────────────────────────────────────────────────

/**
 * Re-derives everything earned and writes only the difference. Safe to call
 * after any mutation, and safe to call twice.
 */
export async function syncAchievements(): Promise<UnlockedAchievement[]> {
  const state = await readAll()
  const fresh = newlyUnlocked({ ...state, at: today() }, state.achievements)
  if (!fresh.length) return []
  const stamp = now()
  const rows: UnlockedAchievement[] = fresh.map((a) => ({ id: a.id, at: stamp, value: a.value }))
  const events = rows.map((r) =>
    event('achievement', null, xpFor('achievement'), { achievement: r.id, value: r.value }),
  )
  await db.transaction('rw', [db.achievements, db.events], async () => {
    await db.achievements.bulkPut(rows)
    await db.events.bulkPut(events)
  })
  return rows
}

/** Days since the last event of any kind. Used to greet a returning person. */
export async function daysAway(): Promise<number | null> {
  const events = await db.events.toArray()
  if (!events.length) return null
  const latest = events.reduce((a, b) => (a.at > b.at ? a : b))
  return days(dayOf(latest.at), today())
}
