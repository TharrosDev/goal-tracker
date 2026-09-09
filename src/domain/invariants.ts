import type { Goal, Milestone, ProgressEntry, TimelineEvent } from './types'
import { isDone, recomputeCurrent } from './progress'

/**
 * THE IMPOSSIBLE STATES, AND THE ONE PLACE THEY ARE PREVENTED.
 *
 * Every rule here is about the SHAPE of the record rather than about what the
 * numbers mean. A goal that is its own parent, a tie one side of which does not
 * know about the other, a gate marked passed above a figure that has since come
 * back down, a target of zero that makes a goal finished before it starts —
 * none of these are opinions, and none of them should depend on a particular
 * screen having behaved correctly.
 *
 * So they are enforced in two places and nowhere else:
 *
 *   `data/repo.ts` calls the guards before it writes, so the interface cannot
 *   create a broken shape however hard it tries.
 *
 *   `data/backup.ts` calls `normaliseWorld` on import, so a hand-edited file, a
 *   truncated write, or an export from a future build cannot bring one in.
 *
 * Everything here is pure. It takes plain records and returns plain records,
 * which is why the whole set can be tested without a database.
 */

// ── relationships ───────────────────────────────────────────────────────────

/**
 * The chain of parents above a goal, nearest first, stopping at the first
 * repeat. The visited set is not paranoia: an imported cycle would otherwise
 * hang every caller, and there are four of them across the interface.
 */
export function ancestors(goals: Pick<Goal, 'id' | 'parentId'>[], id: string): string[] {
  const byId = new Map(goals.map((g) => [g.id, g]))
  const out: string[] = []
  const seen = new Set<string>([id])
  let cursor = byId.get(id)?.parentId ?? null
  while (cursor && !seen.has(cursor)) {
    out.push(cursor)
    seen.add(cursor)
    cursor = byId.get(cursor)?.parentId ?? null
  }
  return out
}

/** True when making `childId` belong to `parentId` would close a loop. */
export function wouldCycle(
  goals: Pick<Goal, 'id' | 'parentId'>[],
  childId: string,
  parentId: string | null,
): boolean {
  if (!parentId) return false
  if (parentId === childId) return true
  return ancestors(goals, parentId).includes(childId)
}

export interface Refusal {
  ok: boolean
  reason: string
}

const ALLOWED: Refusal = { ok: true, reason: '' }

/**
 * Whether a proposed parent is legal, with a sentence a person can read. The
 * interface shows the reason; the repository refuses the write either way.
 */
export function canParent(
  goals: Pick<Goal, 'id' | 'parentId' | 'title'>[],
  childId: string,
  parentId: string | null,
): Refusal {
  if (!parentId) return ALLOWED
  if (parentId === childId) return { ok: false, reason: 'A standard cannot belong to itself.' }
  if (!goals.some((g) => g.id === parentId))
    return { ok: false, reason: 'That standard is no longer on the field.' }
  if (wouldCycle(goals, childId, parentId)) {
    const title = goals.find((g) => g.id === childId)?.title ?? 'it'
    return { ok: false, reason: `That standard already belongs to ${title}, at some remove.` }
  }
  return ALLOWED
}

/** Whether two standards may be tied. Self-ties and ties to the missing are not. */
export function canLink(goals: Pick<Goal, 'id'>[], a: string, b: string): Refusal {
  if (a === b) return { ok: false, reason: 'A standard cannot be tied to itself.' }
  if (!goals.some((g) => g.id === a) || !goals.some((g) => g.id === b))
    return { ok: false, reason: 'One of those standards is no longer on the field.' }
  return ALLOWED
}

// ── one goal's own shape ────────────────────────────────────────────────────

const finite = (n: number | null, fallback: number | null): number | null =>
  n === null || Number.isFinite(n) ? n : fallback

/**
 * A single goal, made internally consistent. Never throws and never drops a
 * record: the worst that happens to a nonsense value is that it becomes the
 * nearest sensible one.
 */
export function normaliseGoal(goal: Goal): Goal {
  const next = { ...goal }

  // A target of zero or less is not a target. Left alone it makes `isDone` true
  // the instant the goal is created, while `fraction` reports 0% — the standard
  // is enshrined at nought.
  const target = finite(next.target, null)
  next.target = target !== null && target > 0 ? target : null

  const current = Number.isFinite(next.current) ? next.current : 0
  next.current =
    next.kind === 'percentage' && next.target !== null
      ? Math.min(Math.max(current, 0), next.target)
      : Math.max(current, 0)

  if (next.recurrence)
    next.recurrence = {
      period: next.recurrence.period,
      times: Math.min(Math.max(Math.round(next.recurrence.times) || 1, 1), 100),
    }

  // A tie has two ends, and only one of each.
  next.linkedIds = [...new Set(next.linkedIds.filter((id) => id !== next.id))]
  if (next.parentId === next.id) next.parentId = null

  // `done` and `completedAt` are two halves of one fact. Whichever half is
  // present decides, so nothing is ever half-taken.
  if (next.completedAt !== null && !next.done) next.done = true
  if (next.done && next.completedAt === null) next.completedAt = next.updatedAt
  if (!next.done && next.completedAt === null) next.completedBy = null

  return next
}

// ── the graph ───────────────────────────────────────────────────────────────

export interface GraphRepair {
  goals: Goal[]
  /** One line per thing that had to be changed, for the import report. */
  changes: string[]
}

/**
 * The whole relationship graph, made sound: no self-parents, no parents that do
 * not exist, no cycles, no self-ties, no duplicate ties, no one-sided ties, no
 * ties to standards that are gone.
 *
 * A cycle is broken at the edge that closes it rather than by dropping every
 * goal in it — losing the relationship is recoverable, losing the goals is not.
 */
export function normaliseGraph(input: Goal[]): GraphRepair {
  const changes: string[] = []
  const goals = input.map(normaliseGoal)
  const ids = new Set(goals.map((g) => g.id))

  for (const goal of goals) {
    if (goal.parentId && !ids.has(goal.parentId)) {
      changes.push(`${goal.title} belonged to a standard that is gone`)
      goal.parentId = null
    }
  }

  // Break cycles. Walking from every goal catches rings that no root reaches.
  for (const goal of goals) {
    const seen = new Set<string>([goal.id])
    let cursor = goal
    while (cursor.parentId) {
      if (seen.has(cursor.parentId)) {
        changes.push(`${cursor.title} was inside a loop of ownership`)
        cursor.parentId = null
        break
      }
      seen.add(cursor.parentId)
      const parent = goals.find((g) => g.id === cursor.parentId)
      if (!parent) break
      cursor = parent
    }
  }

  // Ties, made mutual. Building the set first means one pass decides both ends.
  const ties = new Map<string, Set<string>>(goals.map((g) => [g.id, new Set<string>()]))
  for (const goal of goals)
    for (const other of goal.linkedIds) {
      if (other === goal.id || !ids.has(other)) continue
      ties.get(goal.id)!.add(other)
      ties.get(other)!.add(goal.id)
    }
  for (const goal of goals) {
    const next = [...ties.get(goal.id)!].sort()
    const before = [...goal.linkedIds].sort()
    if (next.length !== before.length || next.some((id, i) => id !== before[i])) {
      changes.push(`${goal.title}'s ties were one-sided or pointed at nothing`)
      goal.linkedIds = next
    }
  }

  return { goals, changes }
}

// ── gates ───────────────────────────────────────────────────────────────────

/**
 * Gates a figure no longer clears.
 *
 * A value gate crossed BY A DISPATCH is a statement about the number, so when
 * the number comes back down — a correction, a negative dispatch, an undo — the
 * gate has to come back down with it. A gate ticked BY HAND is a statement about
 * the world, and nothing here is entitled to untick it: that is what `doneBy`
 * distinguishes.
 */
export function reconcileMilestones(goal: Goal, milestones: Milestone[]): Milestone[] {
  return milestones.map((m) => {
    if (m.goalId !== goal.id) return m
    if (!m.done || m.at === null || m.doneBy === null) return m
    if (goal.current >= m.at) return m
    return { ...m, done: false, doneAt: null, doneBy: null }
  })
}

/**
 * Whether a goal's own closure still holds, given its gates.
 *
 * Returns null when nothing should change. Deliberately conservative: a goal a
 * person closed by hand (`completedBy === null`) is never reopened by
 * arithmetic, because the arithmetic was never what closed it.
 */
export function completionDrift(
  goal: Goal,
  milestones: Milestone[],
): { done: boolean; reason: string } | null {
  const mine = milestones.filter((m) => m.goalId === goal.id)
  const earned = isDone({ ...goal, done: false }, mine)

  if (goal.done && !earned && goal.completedBy !== null)
    return { done: false, reason: 'its figure no longer reaches its target' }
  // `isDone` already refuses to close the kinds only a person can close, so
  // there is no second guard here: adding one is what stopped a project from
  // closing when its last part was ticked.
  if (!goal.done && earned) return { done: true, reason: 'every part of it is done' }
  return null
}

// ── the whole world ─────────────────────────────────────────────────────────

export interface Snapshot {
  goals: Goal[]
  milestones: Milestone[]
  entries: ProgressEntry[]
  events: TimelineEvent[]
}

export interface WorldRepair {
  goals: Goal[]
  milestones: Milestone[]
  entries: ProgressEntry[]
  events: TimelineEvent[]
  changes: string[]
}

/**
 * Everything above, applied to a whole world in the right order: drop orphans,
 * rebuild cached totals from the ledger, sort out the graph, then reconcile the
 * gates against the totals that were just rebuilt.
 *
 * This is what import runs, and what the Quartermaster's repair runs.
 */
export function normaliseWorld(snapshot: Snapshot): WorldRepair {
  const changes: string[] = []
  const ids = new Set(snapshot.goals.map((g) => g.id))

  const milestonesIn = snapshot.milestones.filter((m) => ids.has(m.goalId))
  if (milestonesIn.length !== snapshot.milestones.length)
    changes.push(`${snapshot.milestones.length - milestonesIn.length} gates had no standard`)

  const entries = snapshot.entries.filter((e) => ids.has(e.goalId))
  if (entries.length !== snapshot.entries.length)
    changes.push(`${snapshot.entries.length - entries.length} dispatches had no standard`)

  const events = snapshot.events.filter((e) => e.goalId === null || ids.has(e.goalId))
  if (events.length !== snapshot.events.length)
    changes.push(`${snapshot.events.length - events.length} records pointed at nothing`)

  // The ledger is canonical; the cached total is a convenience. Countdown goals
  // have no ledger to rebuild from, and neither does a goal nothing was ever
  // logged against.
  const rebuilt = snapshot.goals.map((goal) => {
    const ledgerDriven = goal.kind !== 'countdown' && entries.some((e) => e.goalId === goal.id)
    if (!ledgerDriven) return goal
    const current = recomputeCurrent(goal, entries)
    if (Math.abs(current - goal.current) > 0.005)
      changes.push(`${goal.title}'s figure disagreed with its dispatches`)
    return { ...goal, current }
  })

  const graph = normaliseGraph(rebuilt)
  changes.push(...graph.changes)

  let milestones = milestonesIn
  const goals = graph.goals.map((goal) => {
    const before = milestones
    milestones = reconcileMilestones(goal, milestones)
    if (milestones.some((m, i) => m !== before[i]))
      changes.push(`${goal.title} had gates marked passed above its figure`)

    const drift = completionDrift(goal, milestones)
    if (!drift) return goal
    changes.push(`${goal.title} was marked taken though ${drift.reason}`)
    return drift.done
      ? { ...goal, done: true, completedAt: goal.completedAt ?? goal.updatedAt }
      : { ...goal, done: false, completedAt: null, completedBy: null }
  })

  return { goals, milestones, entries, events, changes }
}

/**
 * A read-only report of everything wrong with the stored world, for the
 * Quartermaster to show before anybody is asked to act on it.
 *
 * Phrased as observations rather than alarms: this exists so a person can see
 * that their record is sound, which is the common case, not to frighten them
 * about a record that is.
 */
export function auditWorld(snapshot: Snapshot): string[] {
  const repair = normaliseWorld(snapshot)
  return repair.changes
}
