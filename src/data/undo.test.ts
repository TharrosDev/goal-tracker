import { beforeEach, describe, expect, it } from 'vitest'
import { clearRecords, db } from './db'
import {
  addMilestone,
  completeGoal,
  createGoal,
  logProgress,
  patchGoal,
  reconcileAchievements,
  readAll,
  setMilestoneDone,
  undoEntry,
} from './repo'
import { totalXp } from '@/domain/xp'
import type { Milestone } from '@/domain/types'

/**
 * UNDO IS A CAUSAL REVERSAL, NOT A SUBTRACTION.
 *
 * One dispatch can move the figure, cross gates, set a record, close the goal,
 * pay merit on each of those and unlock honours off the back of them. These
 * tests exist because the first implementation reversed two of those eight
 * things and matched the rest by timestamp proximity, which is a guess.
 *
 * Every test here asserts the WHOLE result of the act, not the number.
 */

async function reset() {
  await clearRecords()
  await db.meta.clear()
  localStorage.clear()
}

beforeEach(reset)

const gate = async (goalId: string, title: string, at: number): Promise<Milestone> => {
  const m = await addMilestone(goalId, title, at)
  if (!m) throw new Error('gate not made')
  return m
}

/** A goal with three prior dispatches, so the record test has a baseline. */
async function seeded(target = 1000) {
  const { goal } = await createGoal({ kind: 'numeric', title: 'Run', target, unit: 'km' })
  await logProgress(goal.id, 10)
  await logProgress(goal.id, 10)
  await logProgress(goal.id, 10)
  return goal
}

describe('undo: one gate', () => {
  it('takes the gate back down and removes its event and its merit', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'Run', target: 1000 })
    const m = await gate(goal.id, 'First hundred', 100)

    // Settle the honours first, so the merit comparison is like for like: undo
    // re-derives them, and one earned merely by planting is still earned after.
    await reconcileAchievements()
    const before = totalXp((await readAll()).events)
    const dispatch = await logProgress(goal.id, 150)
    expect(dispatch.reached.map((g) => g.id)).toEqual([m.id])
    expect((await db.milestones.get(m.id))!.done).toBe(true)

    await undoEntry(dispatch.entry.id)

    const after = await readAll()
    expect((await db.goals.get(goal.id))!.current).toBe(0)
    expect((await db.milestones.get(m.id))!.done).toBe(false)
    expect((await db.milestones.get(m.id))!.doneAt).toBeNull()
    expect((await db.milestones.get(m.id))!.doneBy).toBeNull()
    expect(after.events.filter((e) => e.type === 'milestone')).toHaveLength(0)
    expect(totalXp(after.events)).toBe(before)
  })
})

describe('undo: several gates in one dispatch', () => {
  it('takes every gate that dispatch crossed back down, and only those', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'Run', target: 1000 })
    const a = await gate(goal.id, 'One', 100)
    const b = await gate(goal.id, 'Two', 200)
    const c = await gate(goal.id, 'Three', 900)

    const first = await logProgress(goal.id, 250)
    expect(first.reached.map((g) => g.id).sort()).toEqual([a.id, b.id].sort())

    const second = await logProgress(goal.id, 700)
    expect(second.reached.map((g) => g.id)).toEqual([c.id])

    await undoEntry(first.entry.id)

    // The first dispatch's two gates come back; the third stays passed, because
    // a different dispatch crossed it and the figure still clears it.
    expect((await db.milestones.get(a.id))!.done).toBe(false)
    expect((await db.milestones.get(b.id))!.done).toBe(false)
    expect((await db.milestones.get(c.id))!.done).toBe(true)
    expect((await db.goals.get(goal.id))!.current).toBe(700)
  })

  it('leaves a gate that was ticked by hand alone', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'Run', target: 1000 })
    const byHand = await gate(goal.id, 'Signed up', 5000)
    await setMilestoneDone(byHand.id, true)

    const dispatch = await logProgress(goal.id, 100)
    await undoEntry(dispatch.entry.id)

    const m = (await db.milestones.get(byHand.id))!
    expect(m.done).toBe(true)
    expect(m.doneBy).toBeNull()
  })
})

describe('undo: the dispatch that took the goal', () => {
  it('reopens the goal, removes the completion, and puts it back in play', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 100 })
    const dispatch = await logProgress(goal.id, 100)
    expect(dispatch.completed).toBe(true)

    await undoEntry(dispatch.entry.id)

    const after = (await db.goals.get(goal.id))!
    expect(after.done).toBe(false)
    expect(after.completedAt).toBeNull()
    expect(after.completedBy).toBeNull()
    expect(after.current).toBe(0)
    expect((await readAll()).events.filter((e) => e.type === 'completed')).toHaveLength(0)
  })

  it('does not reopen a goal a person closed by hand', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'Write', target: 1000 })
    const dispatch = await logProgress(goal.id, 10)
    await completeGoal(goal.id)

    await undoEntry(dispatch.entry.id)

    const after = (await db.goals.get(goal.id))!
    expect(after.done).toBe(true)
    expect(after.completedAt).not.toBeNull()
  })
})

describe('undo: a personal record', () => {
  it('removes the record event so the same amount can be a record again', async () => {
    const goal = await seeded()
    const big = await logProgress(goal.id, 500)
    expect(big.record).toBe(true)

    await undoEntry(big.entry.id)
    expect((await readAll()).events.filter((e) => e.type === 'record')).toHaveLength(0)

    const again = await logProgress(goal.id, 500)
    expect(again.record).toBe(true)
    expect((await readAll()).events.filter((e) => e.type === 'record')).toHaveLength(1)
  })
})

describe('undo: gates and completion in one dispatch', () => {
  it('reverses both, and the merit for both', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'Run', target: 200 })
    const a = await gate(goal.id, 'One', 50)
    const b = await gate(goal.id, 'Two', 150)

    await reconcileAchievements()
    const before = totalXp((await readAll()).events)
    const dispatch = await logProgress(goal.id, 200)
    expect(dispatch.reached).toHaveLength(2)
    expect(dispatch.completed).toBe(true)
    expect(totalXp((await readAll()).events)).toBeGreaterThan(before)

    await undoEntry(dispatch.entry.id)

    const state = await readAll()
    expect((await db.goals.get(goal.id))!.done).toBe(false)
    expect((await db.milestones.get(a.id))!.done).toBe(false)
    expect((await db.milestones.get(b.id))!.done).toBe(false)
    expect(state.events.filter((e) => e.cause === dispatch.entry.id)).toHaveLength(0)
    expect(totalXp(state.events)).toBe(before)
  })
})

describe('undo: an entry that is not the most recent', () => {
  it('replays the ledger rather than subtracting, and leaves later dispatches alone', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Fund', target: 10_000 })
    const first = await logProgress(goal.id, 100)
    await logProgress(goal.id, 250)
    await logProgress(goal.id, 25)

    await undoEntry(first.entry.id)

    expect((await db.goals.get(goal.id))!.current).toBe(275)
    expect(await db.entries.where('goalId').equals(goal.id).count()).toBe(2)
  })

  it('replays correctly through a "set" correction that came after it', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'Pages', target: 500 })
    const first = await logProgress(goal.id, 40)
    await logProgress(goal.id, 120, { mode: 'set' })
    await logProgress(goal.id, 10)

    // The set wipes out everything before it, so undoing the first entry must
    // leave the figure exactly where it was. Subtracting 40 would not.
    await undoEntry(first.entry.id)
    expect((await db.goals.get(goal.id))!.current).toBe(130)
  })
})

describe('undo: a backdated dispatch', () => {
  it('finds its events by cause rather than by when they say they happened', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'Run', target: 1000 })
    const m = await gate(goal.id, 'First hundred', 100)
    const when = '2026-03-04T09:30:00.000Z'

    const dispatch = await logProgress(goal.id, 150, { at: when })
    for (const e of dispatch.events) expect(e.at).toBe(when)

    await undoEntry(dispatch.entry.id)

    const left = (await readAll()).events.filter(
      (e) => e.goalId === goal.id && e.type !== 'created' && e.type !== 'milestone_added',
    )
    expect(left).toHaveLength(0)
    expect((await db.milestones.get(m.id))!.done).toBe(false)
    expect((await db.goals.get(goal.id))!.current).toBe(0)
  })
})

describe('undo: two dispatches inside the same second', () => {
  it('reverses only its own, leaving the other with its event intact', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'Reps', target: 1000 })
    const when = '2026-03-04T09:30:00.000Z'

    // The exact same instant: the old timestamp-window heuristic could not tell
    // these apart at all, and deleted both events for one undo.
    const a = await logProgress(goal.id, 10, { at: when })
    const b = await logProgress(goal.id, 20, { at: when })

    await undoEntry(a.entry.id)

    const events = (await readAll()).events.filter((e) => e.type === 'progress')
    expect(events).toHaveLength(1)
    expect(events[0]!.cause).toBe(b.entry.id)
    expect((await db.goals.get(goal.id))!.current).toBe(20)
    expect(await db.entries.count()).toBe(1)
  })
})

describe('undo: honours', () => {
  it('takes back an honour the undone dispatch earned, and its merit with it', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 2400 })
    const dispatch = await logProgress(goal.id, 50)
    await reconcileAchievements(dispatch.entry.id)

    const held = await db.achievements.toArray()
    expect(held.map((a) => a.id)).toContain('first-move')

    await undoEntry(dispatch.entry.id)

    const after = await readAll()
    expect(after.achievements.map((a) => a.id)).not.toContain('first-move')
    expect(
      after.events.filter((e) => e.type === 'achievement' && e.data.achievement === 'first-move'),
    ).toHaveLength(0)
  })

  it('keeps an honour that is still genuinely held after the undo', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 2400 })
    await logProgress(goal.id, 10)
    await reconcileAchievements()
    const second = await logProgress(goal.id, 20)
    await reconcileAchievements(second.entry.id)

    await undoEntry(second.entry.id)

    // first-move needs one entry and one goal, and one entry is still there.
    expect((await db.achievements.toArray()).map((a) => a.id)).toContain('first-move')
  })
})

describe('undo: and then logging again', () => {
  it('leaves the record in the state it would have been in if the dispatch never happened', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'Run', target: 500 })
    const m = await gate(goal.id, 'Halfway', 250)

    const wrong = await logProgress(goal.id, 400)
    expect(wrong.reached).toHaveLength(1)
    await undoEntry(wrong.entry.id)

    const right = await logProgress(goal.id, 300)
    expect(right.reached.map((g) => g.id)).toEqual([m.id])

    const state = await readAll()
    expect((await db.goals.get(goal.id))!.current).toBe(300)
    expect(state.entries).toHaveLength(1)
    expect(state.events.filter((e) => e.type === 'milestone')).toHaveLength(1)
    expect(state.events.filter((e) => e.type === 'progress')).toHaveLength(1)
  })
})

describe('undo: nothing else', () => {
  it('does not touch another goal', async () => {
    const a = await createGoal({ kind: 'numeric', title: 'A', target: 100 })
    const b = await createGoal({ kind: 'numeric', title: 'B', target: 100 })
    const dispatch = await logProgress(a.goal.id, 30)
    await logProgress(b.goal.id, 40)

    await undoEntry(dispatch.entry.id)

    expect((await db.goals.get(b.goal.id))!.current).toBe(40)
    expect(await db.entries.where('goalId').equals(b.goal.id).count()).toBe(1)
  })

  it('is a no-op for an entry that is already gone', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'A', target: 100 })
    const dispatch = await logProgress(goal.id, 30)
    await undoEntry(dispatch.entry.id)
    await expect(undoEntry(dispatch.entry.id)).resolves.toBeUndefined()
    expect((await db.goals.get(goal.id))!.current).toBe(0)
  })
})

describe('a dispatch that moves the figure back', () => {
  it('takes down the gates the figure no longer clears, and says so in the record', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'Run', target: 1000 })
    const m = await gate(goal.id, 'First hundred', 100)
    await logProgress(goal.id, 150)
    expect((await db.milestones.get(m.id))!.done).toBe(true)

    // A correction downward: the gate was crossed by arithmetic, so arithmetic
    // takes it back.
    await logProgress(goal.id, 50, { mode: 'set' })

    expect((await db.milestones.get(m.id))!.done).toBe(false)
    expect(
      (await readAll()).events.filter((e) => e.type === 'milestone_reopened'),
    ).toHaveLength(1)
  })

  it('reopens a goal a dispatch had closed once the figure falls back', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'Run', target: 100 })
    await logProgress(goal.id, 100)
    expect((await db.goals.get(goal.id))!.done).toBe(true)

    await logProgress(goal.id, -40)

    const after = (await db.goals.get(goal.id))!
    expect(after.done).toBe(false)
    expect(after.completedAt).toBeNull()
    expect((await readAll()).events.some((e) => e.type === 'reopened')).toBe(true)
  })
})

describe('merit is a record, not a currency', () => {
  it('does not pay for the same gate twice', async () => {
    const { goal } = await createGoal({ kind: 'project', title: 'Ship it' })
    const m = await gate(goal.id, 'Draft', 0)

    await setMilestoneDone(m.id, true)
    const paid = totalXp((await readAll()).events)

    await setMilestoneDone(m.id, false)
    await setMilestoneDone(m.id, true)

    expect(totalXp((await readAll()).events)).toBe(paid)
  })

  it('does not pay for the same completion twice', async () => {
    const { goal } = await createGoal({ kind: 'milestone', title: 'Get accepted' })
    await completeGoal(goal.id)
    const paid = totalXp((await readAll()).events)

    await patchGoal(goal.id, { done: false, completedAt: null })
    await completeGoal(goal.id)

    expect(totalXp((await readAll()).events)).toBe(paid)
  })

  it('does not pay for striking and raising a camp in the same minute', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'Run', target: 10 })
    const before = totalXp((await readAll()).events)
    await patchGoal(goal.id, { paused: true })
    await patchGoal(goal.id, { paused: false })
    expect(totalXp((await readAll()).events)).toBe(before)
  })
})
