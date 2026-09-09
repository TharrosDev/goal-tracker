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
  ledgerOrder,
  streakLength,
} from '@/domain/progress'
import {
  canLink,
  canParent,
  completionDrift,
  normaliseGoal,
  normaliseWorld,
  reconcileMilestones,
} from '@/domain/invariants'
import { RECOVERY_AFTER, xpFor } from '@/domain/xp'
import { evaluate } from '@/domain/achievements'
import { db } from './db'

/**
 * Every mutation in the product goes through this file.
 *
 * Four invariants hold here and nowhere else:
 *
 *   1. A change to a record and the event that describes it are written in the
 *      same transaction. The timeline cannot drift from the data.
 *
 *   2. XP is stamped onto the event at write time, so tuning the curve later
 *      never rewrites what somebody already earned — and a given award is made
 *      ONCE. Passing the same gate twice, or closing the same goal twice, does
 *      not pay twice; merit is a record of what happened, not a currency.
 *
 *   3. Every event a single act produces carries that act's id in `cause`, so
 *      the act can be reversed completely rather than approximately. Nothing in
 *      this file matches events to actions by timestamp.
 *
 *   4. Nothing here trusts its caller to have kept the shape sound. Cycles,
 *      self-ties, gates above the figure and completions that no longer hold
 *      are refused or reconciled by `domain/invariants.ts` before a write
 *      lands, so no screen has to behave correctly for the record to stay true.
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

/**
 * `at` defaults to this instant but is passed explicitly whenever the thing being
 * recorded happened at another time. An event that says it happened now, for a
 * dispatch dated last Tuesday, quietly corrupts everything folded over the log.
 *
 * `cause` is the id of the act that produced this event — a ProgressEntry's id
 * for anything a dispatch caused, null for an event that is its own cause.
 */
function event(
  type: TimelineEvent['type'],
  goalId: string | null,
  xp: number,
  data: TimelineEvent['data'] = {},
  at: string = now(),
  cause: string | null = null,
): TimelineEvent {
  return { id: uid(), goalId, type, at, xp, cause, data }
}

/**
 * Whether this goal has ever been paid for this kind of thing before.
 *
 * Merit is awarded for something HAPPENING. Untick a gate and tick it again and
 * the same thing has not happened twice, so it is not paid twice — otherwise the
 * rank ladder is a button rather than a record. The event still gets written;
 * only the award is withheld.
 */
async function alreadyPaid(
  goalId: string,
  type: TimelineEvent['type'],
  match?: (e: TimelineEvent) => boolean,
): Promise<boolean> {
  const past = await db.events.where('goalId').equals(goalId).toArray()
  return past.some((e) => e.type === type && e.xp > 0 && (!match || match(e)))
}

// ── creation ────────────────────────────────────────────────────────────────

export async function createGoal(
  input: NewGoal,
  milestoneTitles: string[] = [],
): Promise<{ goal: Goal; milestones: Milestone[]; event: TimelineEvent }> {
  const goal = normaliseGoal(makeGoal(input))

  // A parent handed in by the interface still has to be legal.
  if (goal.parentId) {
    const existing = await db.goals.toArray()
    if (!canParent([...existing, goal], goal.id, goal.parentId).ok) goal.parentId = null
  }

  const milestones = milestoneTitles
    .map((t) => t.trim())
    .filter(Boolean)
    .map((title, i) => makeMilestone(goal.id, title, i))
  const created = event('created', goal.id, xpFor('created', goal), {
    kind: goal.kind,
    boss: goal.boss,
    difficulty: goal.difficulty,
    gates: milestones.length,
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
 *
 * The entry's own id is the DISPATCH ID: every row and every event this call
 * produces carries it, which is what makes `undoEntry` exact.
 */
export async function logProgress(
  goalId: string,
  amount: number,
  options: { mode?: ProgressEntry['mode']; note?: string; at?: string } = {},
): Promise<LogResult> {
  const goal = await db.goals.get(goalId)
  if (!goal) throw new Error('goal not found')
  if (!Number.isFinite(amount)) throw new Error('that is not a number')

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
    // One past the highest this goal has ever used, so the ledger has a total
    // order even when two dispatches share a millisecond.
    seq: Math.max(0, ...mine.map((e) => e.seq ?? 0)) + 1,
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

  const reachedDone = reached.map((m) => ({
    ...m,
    done: true,
    doneAt: entry.at,
    // Crossed BY this dispatch: an undo owns it, and a figure that falls back
    // below the gate takes it back down.
    doneBy: entry.id,
  }))

  // A dispatch can move the figure DOWN — a correction, or a negative amount —
  // and a gate the number no longer clears has to come back down with it.
  const merged = goalMilestones.map((m) => reachedDone.find((r) => r.id === m.id) ?? m)
  const afterMilestones = reconcileMilestones(next, merged)
  const reopenedGates = afterMilestones.filter((m) => {
    const was = merged.find((x) => x.id === m.id)
    return was && was.done && !m.done
  })

  // A project closes when its last part does, so completion is judged against
  // the milestone list as it will be after this write, not as it was before.
  const completed = !goal.completedAt && isDone(next, afterMilestones)
  if (completed) {
    next.completedAt = entry.at
    next.done = true
    next.completedBy = entry.id
  }

  // And a figure that falls back below its target reopens a goal that a
  // dispatch — never a person — had closed.
  const drift = completed ? null : completionDrift(next, afterMilestones)
  const uncompleted = drift?.done === false
  if (uncompleted) {
    next.done = false
    next.completedAt = null
    next.completedBy = null
  }

  // Every event this dispatch produces is stamped with the DISPATCH's instant,
  // not with this one, so a backdated entry lands on the day it belongs to.
  const stamp = entry.at
  const cause = entry.id
  const events: TimelineEvent[] = [
    event(
      'progress',
      goalId,
      xpFor('progress', goal, { streak, recovery }),
      {
        amount,
        mode: entry.mode,
        from: before,
        to: next.current,
        recovery,
        streak,
        note: entry.note,
      },
      stamp,
      cause,
    ),
  ]
  for (const m of reachedDone) {
    // A gate already paid for once is not paid for again, however it comes to be
    // crossed a second time.
    const paid = await alreadyPaid(goalId, 'milestone', (e) => e.data.milestoneId === m.id)
    events.push(
      event(
        'milestone',
        goalId,
        paid ? 0 : xpFor('milestone', goal),
        { milestoneId: m.id, title: m.title, at: m.at },
        stamp,
        cause,
      ),
    )
  }
  for (const m of reopenedGates)
    events.push(
      event(
        'milestone_reopened',
        goalId,
        0,
        { milestoneId: m.id, title: m.title, reason: 'the figure came back below it' },
        stamp,
        cause,
      ),
    )
  if (record) events.push(event('record', goalId, xpFor('record', goal), { amount }, stamp, cause))
  if (completed) {
    const paid = await alreadyPaid(goalId, 'completed')
    events.push(
      event(
        'completed',
        goalId,
        paid ? 0 : xpFor('completed', goal),
        { value: next.current, target: goal.target, days: days(goal.startDate, dayOf(stamp)) },
        stamp,
        cause,
      ),
    )
  }
  if (uncompleted)
    events.push(
      event('reopened', goalId, 0, { reason: drift!.reason }, stamp, cause),
    )

  const changedMilestones = afterMilestones.filter((m) => {
    const was = goalMilestones.find((x) => x.id === m.id)
    return !was || was.done !== m.done || was.doneBy !== m.doneBy
  })

  await db.transaction('rw', [db.goals, db.entries, db.events, db.milestones], async () => {
    await db.entries.put(entry)
    await db.goals.put(next)
    if (changedMilestones.length) await db.milestones.bulkPut(changedMilestones)
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

/**
 * UNDO A DISPATCH — the complete causal reversal of one act.
 *
 * A dispatch is never only a number. It can cross gates, set a personal record,
 * close the goal, award merit on each of those, and unlock honours off the back
 * of them. Reversing it means reversing ALL of that, and reversing nothing else.
 *
 * Two rules make that exact rather than approximate:
 *
 *   Everything the dispatch produced carries the entry's id in `cause` (or in
 *   `doneBy` / `completedBy`), so the set to reverse is a lookup, not a guess.
 *
 *   The figure is REPLAYED from the surviving ledger rather than having the
 *   amount subtracted back out. Undoing a `set` correction, or an entry that is
 *   not the most recent, cannot be done by arithmetic on the current total —
 *   and the ledger is the canonical record anyway.
 *
 * Gates a person ticked BY HAND (`doneBy === null`) are left alone: they are
 * statements about the world, not about the number, and this dispatch did not
 * make them.
 */
export async function undoEntry(entryId: string): Promise<void> {
  const entry = await db.entries.get(entryId)
  if (!entry) return
  const goal = await db.goals.get(entry.goalId)
  if (!goal) return

  const remaining = (await db.entries.where('goalId').equals(entry.goalId).toArray()).filter(
    (e) => e.id !== entryId,
  )
  let value = 0
  for (const e of remaining.sort(ledgerOrder)) value = applyEntry({ ...goal, current: value }, e)

  const caused = await db.events.where('cause').equals(entryId).toArray()
  const crossed = await db.milestones.where('doneBy').equals(entryId).toArray()
  const granted = (await db.achievements.toArray()).filter((a) => a.cause === entryId)

  const restoredGates: Milestone[] = crossed.map((m) => ({
    ...m,
    done: false,
    doneAt: null,
    doneBy: null,
  }))

  const next: Goal = { ...goal, current: value, updatedAt: now() }
  // Only a completion this dispatch caused is reversed. One a person made by
  // hand, or an earlier dispatch made, is not this act's to take back.
  if (goal.completedBy === entryId) {
    next.done = false
    next.completedAt = null
    next.completedBy = null
  }

  await db.transaction(
    'rw',
    [db.goals, db.milestones, db.entries, db.events, db.achievements],
    async () => {
      await db.entries.delete(entryId)
      await db.goals.put(next)
      if (restoredGates.length) await db.milestones.bulkPut(restoredGates)
      if (caused.length) await db.events.bulkDelete(caused.map((e) => e.id))
      if (granted.length) await db.achievements.bulkDelete(granted.map((a) => a.id))
    },
  )

  // Honours are re-derived rather than assumed: one the undone dispatch earned
  // may still be genuinely held on the strength of what is left.
  await reconcileAchievements()
}

// ── milestones ──────────────────────────────────────────────────────────────

/**
 * Tick or untick a gate by hand.
 *
 * Ticking the last gate of a project closes the project — which is what the
 * interface has always shown, and what the record never used to say.
 */
export async function setMilestoneDone(id: string, done: boolean): Promise<Milestone | null> {
  const m = await db.milestones.get(id)
  if (!m) return null
  const goal = await db.goals.get(m.goalId)
  if (!goal) return null

  const next: Milestone = { ...m, done, doneAt: done ? now() : null, doneBy: null }
  const siblings = (await db.milestones.where('goalId').equals(m.goalId).toArray()).map((x) =>
    x.id === id ? next : x,
  )

  const events: TimelineEvent[] = []
  const goalNext: Goal = { ...goal, updatedAt: now() }

  if (done) {
    const paid = await alreadyPaid(m.goalId, 'milestone', (e) => e.data.milestoneId === id)
    events.push(
      event('milestone', m.goalId, paid ? 0 : xpFor('milestone', goal), {
        milestoneId: id,
        title: m.title,
        at: m.at,
        byHand: true,
      }),
    )
  } else {
    events.push(event('milestone_reopened', m.goalId, 0, { milestoneId: id, title: m.title }))
  }

  const drift = completionDrift(goalNext, siblings)
  if (drift?.done === true) {
    goalNext.done = true
    goalNext.completedAt = now()
    goalNext.completedBy = null
    const paid = await alreadyPaid(m.goalId, 'completed')
    events.push(
      event('completed', m.goalId, paid ? 0 : xpFor('completed', goal), {
        value: goal.current,
        target: goal.target,
        days: days(goal.startDate, today()),
        gates: siblings.length,
      }),
    )
  } else if (drift?.done === false) {
    goalNext.done = false
    goalNext.completedAt = null
    goalNext.completedBy = null
    events.push(event('reopened', m.goalId, 0, { reason: drift.reason }))
  }

  await db.transaction('rw', [db.goals, db.milestones, db.events], async () => {
    await db.milestones.put(next)
    await db.goals.put(goalNext)
    await db.events.bulkPut(events)
  })
  return next
}

export async function addMilestone(
  goalId: string,
  title: string,
  at: number | null = null,
): Promise<Milestone | null> {
  const goal = await db.goals.get(goalId)
  if (!goal) return null
  const clean = title.trim()
  if (!clean) return null

  const siblings = await db.milestones.where('goalId').equals(goalId).toArray()
  const m = makeMilestone(goalId, clean, siblings.length, at)

  // Adding a part to a finished project unfinishes it: the definition of done
  // just changed, and the record has to say so rather than quietly disagree
  // with what the shrine is showing.
  const goalNext: Goal = { ...goal, updatedAt: now() }
  const events = [event('milestone_added', goalId, 0, { milestoneId: m.id, title: clean, at })]
  const drift = completionDrift(goalNext, [...siblings, m])
  if (drift?.done === false) {
    goalNext.done = false
    goalNext.completedAt = null
    goalNext.completedBy = null
    events.push(event('reopened', goalId, 0, { reason: 'a new gate was added to it' }))
  }

  await db.transaction('rw', [db.goals, db.milestones, db.events], async () => {
    await db.milestones.put(m)
    await db.goals.put(goalNext)
    await db.events.bulkPut(events)
  })
  return m
}

export async function removeMilestone(id: string): Promise<void> {
  const m = await db.milestones.get(id)
  if (!m) return
  const goal = await db.goals.get(m.goalId)

  const events = [
    event('milestone_removed', m.goalId, 0, { milestoneId: id, title: m.title, done: m.done }),
  ]
  const goalNext = goal ? { ...goal, updatedAt: now() } : null

  if (goal && goalNext) {
    const left = (await db.milestones.where('goalId').equals(m.goalId).toArray()).filter(
      (x) => x.id !== id,
    )
    // Removing the last unfinished part of a project finishes it.
    const drift = completionDrift(goalNext, left)
    if (drift?.done === true) {
      goalNext.done = true
      goalNext.completedAt = now()
      goalNext.completedBy = null
      const paid = await alreadyPaid(m.goalId, 'completed')
      events.push(
        event('completed', m.goalId, paid ? 0 : xpFor('completed', goal), {
          value: goal.current,
          target: goal.target,
          days: days(goal.startDate, today()),
          gates: left.length,
        }),
      )
    } else if (drift?.done === false) {
      goalNext.done = false
      goalNext.completedAt = null
      goalNext.completedBy = null
      events.push(event('reopened', m.goalId, 0, { reason: drift.reason }))
    }
  }

  await db.transaction('rw', [db.goals, db.milestones, db.events], async () => {
    await db.milestones.delete(id)
    if (goalNext) await db.goals.put(goalNext)
    await db.events.bulkPut(events)
  })
}

// ── lifecycle ───────────────────────────────────────────────────────────────

/** How a change to each field is described in the record. */
const IDENTITY_FIELDS = [
  'title',
  'why',
  'definitionOfDone',
  'category',
  'dye',
  'icon',
  'unit',
  'notes',
  'links',
  'priority',
] as const

const describe = (r: Goal['recurrence']): string =>
  r ? `${r.times}× per ${r.period}` : 'no rhythm'

/**
 * Amend a goal.
 *
 * Every meaningful change writes its own event with its own payload — and a
 * patch that changes several things at once writes several events, rather than
 * the first one winning and the rest vanishing from the record.
 */
export async function patchGoal(id: string, patch: Partial<Goal>): Promise<Goal | null> {
  const goal = await db.goals.get(id)
  if (!goal) return null

  // A parent that would close a loop is refused outright — silently dropping
  // just the offending field is better than writing a graph nothing can walk.
  if (patch.parentId !== undefined && patch.parentId !== goal.parentId) {
    const all = await db.goals.toArray()
    if (!canParent(all, id, patch.parentId).ok) patch = { ...patch, parentId: goal.parentId }
  }

  const next = normaliseGoal({ ...goal, ...patch, id: goal.id, updatedAt: now() })
  const events: TimelineEvent[] = []
  const changed = <K extends keyof Goal>(key: K): boolean =>
    patch[key] !== undefined && JSON.stringify(next[key]) !== JSON.stringify(goal[key])

  if (changed('deadline'))
    events.push(event('deadline_changed', id, 0, { from: goal.deadline, to: next.deadline }))

  if (changed('target'))
    events.push(event('target_changed', id, 0, { from: goal.target, to: next.target }))

  if (changed('recurrence'))
    events.push(
      event('recurrence_changed', id, 0, {
        from: describe(goal.recurrence),
        to: describe(next.recurrence),
      }),
    )

  if (changed('difficulty'))
    events.push(event('difficulty_changed', id, 0, { from: goal.difficulty, to: next.difficulty }))

  if (changed('boss')) events.push(event('boss_declared', id, 0, { boss: next.boss }))

  if (changed('parentId')) {
    const parent = next.parentId ? await db.goals.get(next.parentId) : null
    events.push(
      event('reparented', id, 0, {
        from: goal.parentId,
        to: next.parentId,
        title: parent?.title ?? null,
      }),
    )
  }

  if (changed('paused')) {
    if (next.paused) events.push(event('paused', id, 0))
    else {
      // Merit for coming back is for coming back, not for tapping a button.
      // A strike that lasted less than a day was never a return.
      const struck = (await db.events.where('goalId').equals(id).toArray())
        .filter((e) => e.type === 'paused')
        .sort((a, b) => b.at.localeCompare(a.at))[0]
      const away = struck ? days(dayOf(struck.at), today()) : 0
      events.push(event('resumed', id, away >= 1 ? xpFor('resumed', goal) : 0, { away }))
    }
  }

  if (changed('archived'))
    events.push(next.archived ? event('archived', id, 0) : event('restored', id, 0))

  const identity = IDENTITY_FIELDS.filter((f) => changed(f))
  if (identity.length)
    events.push(
      event('identity_changed', id, 0, {
        fields: identity.join(','),
        ...(identity.includes('title') ? { from: goal.title, to: next.title } : {}),
      }),
    )

  // Anything else that genuinely moved, so nothing is amended in silence.
  if (!events.length) {
    const touched = (Object.keys(patch) as (keyof Goal)[]).filter(changed)
    if (!touched.length) return goal
    events.push(event('edited', id, 0, { fields: touched.join(',') }))
  }

  // Changing the target can finish a goal, or unfinish one.
  const milestones = await db.milestones.where('goalId').equals(id).toArray()
  const gates = reconcileMilestones(next, milestones)
  const drift = completionDrift(next, gates)
  if (drift?.done === true) {
    next.done = true
    next.completedAt = now()
    next.completedBy = null
    const paid = await alreadyPaid(id, 'completed')
    events.push(
      event('completed', id, paid ? 0 : xpFor('completed', goal), {
        value: next.current,
        target: next.target,
        days: days(next.startDate, today()),
      }),
    )
  } else if (drift?.done === false) {
    next.done = false
    next.completedAt = null
    next.completedBy = null
    events.push(event('reopened', id, 0, { reason: drift.reason }))
  }

  const movedGates = gates.filter((g) => {
    const was = milestones.find((m) => m.id === g.id)
    return was && was.done !== g.done
  })

  await db.transaction('rw', [db.goals, db.milestones, db.events], async () => {
    await db.goals.put(next)
    if (movedGates.length) await db.milestones.bulkPut(movedGates)
    await db.events.bulkPut(events)
  })
  return next
}

export async function completeGoal(id: string): Promise<{ goal: Goal; xp: number } | null> {
  const goal = await db.goals.get(id)
  if (!goal || goal.completedAt) return null
  const next: Goal = { ...goal, done: true, completedAt: now(), completedBy: null, updatedAt: now() }

  // Closing a goal that has been closed before pays nothing. Reopen-and-retake
  // is a legitimate thing to do; it is not a way to earn the largest award in
  // the product on a loop.
  const paid = await alreadyPaid(id, 'completed')
  const e = event('completed', id, paid ? 0 : xpFor('completed', goal), {
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
  const next: Goal = {
    ...goal,
    done: false,
    completedAt: null,
    completedBy: null,
    updatedAt: now(),
  }
  await db.transaction('rw', [db.goals, db.events], async () => {
    await db.goals.put(next)
    await db.events.put(event('reopened', id, 0, { byHand: true }))
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
  /** The other ends of every tie that had to be cut, so they can be retied. */
  allies: Goal[]
}

/**
 * Deleting is the only irreversible thing here, so it is not irreversible:
 * every row is handed back to the caller for an undo, and sub-goals are
 * detached rather than destroyed with their parent.
 *
 * The record of the striking is written with NO goal id, so it survives the
 * removal of every event that had one. Without it the chronicle would show a
 * campaign that simply stops, with nothing to say why.
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
  const allies = await db.goals.filter((g) => g.linkedIds.includes(id)).toArray()

  const struck = event('struck', null, 0, {
    goal: id,
    title: goal.title,
    kind: goal.kind,
    dispatches: entries.length,
    gates: milestones.length,
    detachments: children.length,
  })

  await db.transaction('rw', [db.goals, db.milestones, db.entries, db.events], async () => {
    await db.goals.delete(id)
    await db.milestones.bulkDelete(milestones.map((m) => m.id))
    await db.entries.bulkDelete(entries.map((e) => e.id))
    await db.events.bulkDelete(events.map((e) => e.id))
    if (children.length) await db.goals.bulkPut(children.map((c) => ({ ...c, parentId: null })))
    if (allies.length)
      await db.goals.bulkPut(
        allies.map((g) => ({ ...g, linkedIds: g.linkedIds.filter((x) => x !== id) })),
      )
    await db.events.put(struck)
  })
  return { goal, milestones, entries, events, children, allies }
}

export async function restoreTrash(trash: Trash): Promise<void> {
  await db.transaction('rw', [db.goals, db.milestones, db.entries, db.events], async () => {
    await db.goals.put(trash.goal)
    await db.milestones.bulkPut(trash.milestones)
    await db.entries.bulkPut(trash.entries)
    await db.events.bulkPut(trash.events)
    if (trash.children.length) await db.goals.bulkPut(trash.children)
    // Both ends of every tie go back, or the graph comes back half-made.
    if (trash.allies.length) await db.goals.bulkPut(trash.allies)
    await db.events.put(
      event('unstruck', trash.goal.id, 0, { title: trash.goal.title }),
    )
  })
}

// ── relationships ───────────────────────────────────────────────────────────

/**
 * Tie two standards together, or cut the tie. Both ends move in one
 * transaction, so a tie is never half-made, and both ends are recorded.
 */
export async function toggleLink(a: string, b: string): Promise<void> {
  const [ga, gb] = await Promise.all([db.goals.get(a), db.goals.get(b)])
  if (!ga || !gb) return
  if (!canLink([ga, gb], a, b).ok) return

  const linked = ga.linkedIds.includes(b) || gb.linkedIds.includes(a)
  const tie = (g: Goal, other: string): Goal => ({
    ...g,
    linkedIds: linked
      ? g.linkedIds.filter((x) => x !== other)
      : [...new Set([...g.linkedIds, other])],
    updatedAt: now(),
  })

  const type = linked ? 'unlinked' : 'linked'
  await db.transaction('rw', [db.goals, db.events], async () => {
    await db.goals.bulkPut([tie(ga, b), tie(gb, a)])
    await db.events.bulkPut([
      event(type, a, 0, { other: b, title: gb.title }),
      event(type, b, 0, { other: a, title: ga.title }),
    ])
  })
}

// ── achievements ────────────────────────────────────────────────────────────

/**
 * Re-derives everything earned and writes the difference IN BOTH DIRECTIONS.
 *
 * Adding is the ordinary case. Removing matters because of undo: an honour
 * earned by a dispatch that has since been reversed was not earned, and leaving
 * it standing would make the honours wall the one surface that disagrees with
 * the record. Its event goes with it, so the merit does too.
 *
 * Safe to call after any mutation, and safe to call twice.
 */
export async function reconcileAchievements(
  cause: string | null = null,
): Promise<{ unlocked: UnlockedAchievement[]; revoked: string[] }> {
  const state = await readAll()
  const earned = new Map(
    evaluate({ ...state, at: today() }).map((a) => [a.id, a.value] as const),
  )
  const held = new Map(state.achievements.map((a) => [a.id, a]))

  const fresh = [...earned].filter(([id]) => !held.has(id))
  const stale = [...held.keys()].filter((id) => !earned.has(id))
  if (!fresh.length && !stale.length) return { unlocked: [], revoked: [] }

  const stamp = now()
  const rows: UnlockedAchievement[] = fresh.map(([id, value]) => ({ id, at: stamp, value, cause }))
  const events = rows.map((r) =>
    event('achievement', null, xpFor('achievement'), { achievement: r.id, value: r.value }, stamp, cause),
  )
  const orphaned = state.events
    .filter((e) => e.type === 'achievement' && stale.includes(String(e.data.achievement)))
    .map((e) => e.id)

  await db.transaction('rw', [db.achievements, db.events], async () => {
    if (rows.length) await db.achievements.bulkPut(rows)
    if (stale.length) await db.achievements.bulkDelete(stale)
    if (events.length) await db.events.bulkPut(events)
    if (orphaned.length) await db.events.bulkDelete(orphaned)
  })
  return { unlocked: rows, revoked: stale }
}

/** Kept for callers that only care about what was gained. */
export const syncAchievements = async (cause?: string): Promise<UnlockedAchievement[]> =>
  (await reconcileAchievements(cause ?? null)).unlocked

// ── integrity ───────────────────────────────────────────────────────────────

/**
 * Run the invariants over the stored world and write back whatever they had to
 * fix. The Quartermaster offers this; nothing calls it automatically, because a
 * repair that happens without being asked for is indistinguishable from a bug.
 */
export async function repairWorld(): Promise<string[]> {
  const state = await readAll()
  const repair = normaliseWorld(state)
  if (!repair.changes.length) return []

  await db.transaction('rw', [db.goals, db.milestones, db.entries, db.events], async () => {
    await db.goals.clear()
    await db.goals.bulkPut(repair.goals)
    await db.milestones.clear()
    await db.milestones.bulkPut(repair.milestones)
    await db.entries.clear()
    await db.entries.bulkPut(repair.entries)
    await db.events.clear()
    await db.events.bulkPut(repair.events)
  })
  await reconcileAchievements()
  return repair.changes
}

/** Days since the last event of any kind. Used to greet a returning person. */
export async function daysAway(): Promise<number | null> {
  const events = await db.events.toArray()
  if (!events.length) return null
  const latest = events.reduce((a, b) => (a.at > b.at ? a : b))
  return days(dayOf(latest.at), today())
}
