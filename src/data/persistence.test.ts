import { beforeEach, describe, expect, it } from 'vitest'
import {
  convertLegacyGoal,
  convertLegacyPayload,
  LEGACY_KEY,
  migrateLegacy,
  readLegacyBackup,
} from './migrations'
import { collect, parseBackup, restore, serialise } from './backup'
import { clearRecords, db, listSnapshots, META_KEYS, readMeta, writeMeta } from './db'
import {
  completeGoal,
  createGoal,
  deleteGoal,
  logProgress,
  patchGoal,
  readAll,
  restoreTrash,
  syncAchievements,
  toggleLink,
  undoEntry,
} from './repo'
import { recomputeCurrent } from '@/domain/progress'
import type { LegacyGoal } from '@/domain/schema'

const legacy = (over: Partial<LegacyGoal> = {}): LegacyGoal => ({
  id: 'legacy-1',
  type: 'money',
  title: 'Road bike',
  target: 2400,
  current: 350,
  done: false,
  deadline: '2026-12-01',
  createdAt: '2026-08-01',
  ...over,
})

async function reset() {
  await clearRecords()
  await db.meta.clear()
  localStorage.clear()
}

beforeEach(reset)

describe('legacy conversion', () => {
  it('maps a money goal onto the new model without moving its numbers', () => {
    const { goals, entries } = convertLegacyGoal(legacy())
    const g = goals[0]!
    expect(g).toMatchObject({
      kind: 'money',
      title: 'Road bike',
      target: 2400,
      current: 350,
      startDate: '2026-08-01',
      deadline: '2026-12-01',
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]!.amount).toBe(350)
  })

  it('leaves the ledger agreeing with the cached total', () => {
    const { goals, entries } = convertLegacyGoal(legacy())
    expect(recomputeCurrent(goals[0]!, entries)).toBe(350)
  })

  it('maps a milestone goal and carries its done state', () => {
    const { goals, entries } = convertLegacyGoal(
      legacy({ type: 'milestone', target: null, current: null, done: true, title: 'Sign it' }),
    )
    expect(goals[0]).toMatchObject({ kind: 'milestone', target: null, done: true })
    expect(goals[0]!.completedAt).not.toBeNull()
    expect(entries).toHaveLength(0)
  })

  it('closes a money goal that had already reached its target', () => {
    const { goals } = convertLegacyGoal(legacy({ target: 300, current: 350 }))
    expect(goals[0]!.completedAt).not.toBeNull()
  })

  it('dates the carried-over entry at the goal start, not at migration time', () => {
    const { entries } = convertLegacyGoal(legacy())
    expect(entries[0]!.at.slice(0, 10)).toBe('2026-08-01')
  })

  it('keeps the original id so a re-import does not duplicate the goal', () => {
    expect(convertLegacyGoal(legacy()).goals[0]!.id).toBe('legacy-1')
  })

  it('mints an id when the old record had none', () => {
    expect(convertLegacyGoal(legacy({ id: '' })).goals[0]!.id).not.toBe('')
  })

  it('salvages a list where one record is broken', () => {
    const result = convertLegacyPayload([legacy(), { type: 'money' }, legacy({ id: 'legacy-2' })])
    expect(result.goals).toHaveLength(2)
    expect(result.rejected).toHaveLength(1)
  })
})

describe('migrateLegacy', () => {
  it('imports the v1 blob and keeps the original untouched', async () => {
    const raw = JSON.stringify([legacy(), legacy({ id: 'legacy-2', title: 'Emergency fund' })])
    localStorage.setItem(LEGACY_KEY, raw)

    const result = await migrateLegacy()
    expect(result.migrated).toBe(2)
    expect(await db.goals.count()).toBe(2)

    expect(localStorage.getItem(LEGACY_KEY)).toBe(raw)
    expect(await readLegacyBackup()).toBe(raw)
  })

  it('is a no-op the second time', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([legacy()]))
    await migrateLegacy()
    const again = await migrateLegacy()
    expect(again.migrated).toBe(0)
    expect(await db.goals.count()).toBe(1)
  })

  it('survives two concurrent boots without doubling the ledger', async () => {
    // A React StrictMode double-mount calls boot twice with no await between
    // them. Goals carry their original ids so they dedupe on their own; entries
    // and events are minted fresh each pass, so a racing second run is the one
    // that silently doubles the history.
    localStorage.setItem(LEGACY_KEY, JSON.stringify([legacy(), legacy({ id: 'legacy-2' })]))

    const [first, second] = await Promise.all([migrateLegacy(), migrateLegacy()])

    expect(first.migrated + second.migrated).toBe(2)
    expect(await db.goals.count()).toBe(2)
    expect(await db.entries.count()).toBe(2)

    const goals = await db.goals.toArray()
    const entries = await db.entries.toArray()
    for (const g of goals) expect(recomputeCurrent(g, entries)).toBe(g.current)
  })

  it('refuses to run over a database that already has goals', async () => {
    await createGoal({ kind: 'numeric', title: 'Existing', target: 10 })
    localStorage.setItem(LEGACY_KEY, JSON.stringify([legacy()]))
    expect((await migrateLegacy()).migrated).toBe(0)
    expect(await db.goals.count()).toBe(1)
  })

  it('gives the data back if the database was cleared but the marker survived', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([legacy()]))
    await migrateLegacy()
    await clearRecords()
    await writeMeta(META_KEYS.migratedAt, null)
    expect((await migrateLegacy()).migrated).toBe(1)
  })

  it('does nothing when there is no v1 blob', async () => {
    expect((await migrateLegacy()).migrated).toBe(0)
  })

  it('keeps a copy of an unparseable blob instead of discarding it', async () => {
    localStorage.setItem(LEGACY_KEY, '{ broken')
    await migrateLegacy()
    expect(await readLegacyBackup()).toBe('{ broken')
    expect(await db.goals.count()).toBe(0)
  })
})

describe('export and import', () => {
  it('round-trips a full world exactly', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 2400 }, [
      'Frame',
      'Wheels',
    ])
    await logProgress(goal.id, 350)
    await syncAchievements()

    const before = await collect()
    const json = serialise(before)

    await clearRecords()
    expect(await db.goals.count()).toBe(0)

    const { data } = parseBackup(JSON.parse(json))
    await restore(data)

    const after = await collect()
    expect(after.goals).toEqual(before.goals)
    expect(after.milestones).toEqual(before.milestones)
    expect(after.entries).toEqual(before.entries)
    expect(after.achievements).toEqual(before.achievements)

    // Every original event comes back untouched, and the restore adds one of
    // its own so the chronicle can say where this record came from.
    const carried = after.events.filter((e) => e.type !== 'imported')
    expect(carried).toEqual(before.events)
    expect(after.events.filter((e) => e.type === 'imported')).toHaveLength(1)
  })

  it('accepts a v1 almanac export as an import', async () => {
    const { report } = parseBackup([legacy()])
    expect(report.legacy).toBe(true)
    expect(report.goals).toBe(1)
  })

  it('salvages a partly corrupt backup instead of refusing the file', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 2400 })
    const good = await collect()
    const damaged = {
      ...good,
      goals: [...good.goals, { id: 'x', kind: 'not-a-kind', title: '' }],
      entries: [{ nonsense: true }],
    }
    const { data, report } = parseBackup(damaged)
    expect(data.goals.map((g) => g.id)).toEqual([goal.id])
    expect(report.rejected.length).toBeGreaterThan(0)
    expect(report.rejected.some((r) => r.table === 'goals')).toBe(true)
  })

  it('refuses a file with goals it cannot read at all', () => {
    expect(() => parseBackup({ goals: [{ junk: 1 }, { junk: 2 }] })).toThrow(/no readable goals/)
  })

  it('drops orphaned rows that point at goals which are gone', () => {
    const { data } = parseBackup({
      goals: [],
      milestones: [{ id: 'm', goalId: 'ghost', title: 'x', order: 0 }],
      entries: [],
      events: [],
    })
    expect(data.milestones).toHaveLength(0)
  })

  it('repairs a cached total that disagrees with its ledger', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 2400 })
    await logProgress(goal.id, 100)
    const good = await collect()
    const tampered = { ...good, goals: good.goals.map((g) => ({ ...g, current: 99_999 })) }

    const { data, report } = parseBackup(tampered)
    expect(data.goals[0]!.current).toBe(100)
    expect(report.repaired).toBe(1)
  })

  it('snapshots the existing world before an import overwrites it', async () => {
    await createGoal({ kind: 'money', title: 'Bike', target: 2400 })
    const { data } = parseBackup({ goals: [], milestones: [], entries: [], events: [] })
    await restore(data)
    const snapshots = await listSnapshots()
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]!.json).toContain('Bike')
  })
})

describe('repo mutations', () => {
  it('writes a created event alongside the goal', async () => {
    const { goal, event } = await createGoal({ kind: 'money', title: 'Bike', target: 2400 })
    expect(await db.goals.get(goal.id)).toBeTruthy()
    expect(event.type).toBe('created')
    expect(event.xp).toBeGreaterThan(0)
  })

  it('logs progress, moves the total, and records the event', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 2400 })
    const result = await logProgress(goal.id, 350)
    expect(result.goal.current).toBe(350)
    expect(result.completed).toBe(false)
    expect(result.xp).toBeGreaterThan(0)
    expect(await db.entries.toArray()).toHaveLength(1)
  })

  it('completes the goal when the target is reached', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 100 })
    const result = await logProgress(goal.id, 100)
    expect(result.completed).toBe(true)
    expect(result.goal.completedAt).not.toBeNull()
    expect(result.events.some((e) => e.type === 'completed')).toBe(true)
  })

  it('does not complete a goal twice', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 100 })
    await logProgress(goal.id, 100)
    const second = await logProgress(goal.id, 50)
    expect(second.completed).toBe(false)
    expect(await db.events.where('type').equals('completed').count()).toBe(1)
  })

  it('crosses value milestones as the number passes them', async () => {
    const { goal } = await createGoal({ kind: 'numeric', title: 'Run', target: 1000, unit: 'km' })
    await db.milestones.bulkPut([
      {
        id: 'm1',
        goalId: goal.id,
        title: 'First 100',
        at: 100,
        dueDate: null,
        done: false,
        doneAt: null,
        doneBy: null,
        order: 0,
      },
      {
        id: 'm2',
        goalId: goal.id,
        title: 'Halfway',
        at: 500,
        dueDate: null,
        done: false,
        doneAt: null,
        doneBy: null,
        order: 1,
      },
    ])
    const result = await logProgress(goal.id, 600)
    expect(result.reached.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect((await db.milestones.get('m1'))!.done).toBe(true)
  })

  it('stamps every event with the dispatch instant, not with now', async () => {
    // A backdated dispatch whose events say "now" makes the timeline disagree
    // with the ledger, and momentum, the chronicle and every streak fold over
    // the wrong day.
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 2400 })
    const when = '2026-03-04T09:30:00.000Z'
    const result = await logProgress(goal.id, 120, { at: when })

    expect(result.entry.at).toBe(when)
    for (const e of result.events) expect(e.at).toBe(when)
  })

  it('dates a completion at the dispatch that finished it', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 100 })
    const when = '2026-03-04T09:30:00.000Z'
    const result = await logProgress(goal.id, 100, { at: when })
    expect(result.completed).toBe(true)
    expect(result.goal.completedAt).toBe(when)
  })

  it('undoes an entry and rolls the total back with it', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 2400 })
    await logProgress(goal.id, 100)
    const second = await logProgress(goal.id, 250)
    await undoEntry(second.entry.id)
    expect((await db.goals.get(goal.id))!.current).toBe(100)
    expect(await db.entries.count()).toBe(1)
  })

  it('records a deadline change as its own event', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 2400 })
    await patchGoal(goal.id, { deadline: '2026-12-01' })
    const events = await db.events.where('goalId').equals(goal.id).toArray()
    expect(events.some((e) => e.type === 'deadline_changed')).toBe(true)
  })

  it('links goals in both directions and unlinks the same way', async () => {
    const a = await createGoal({ kind: 'money', title: 'A', target: 1 })
    const b = await createGoal({ kind: 'money', title: 'B', target: 1 })
    await toggleLink(a.goal.id, b.goal.id)
    expect((await db.goals.get(a.goal.id))!.linkedIds).toContain(b.goal.id)
    expect((await db.goals.get(b.goal.id))!.linkedIds).toContain(a.goal.id)
    await toggleLink(a.goal.id, b.goal.id)
    expect((await db.goals.get(b.goal.id))!.linkedIds).toHaveLength(0)
  })

  it('deletes a goal, detaches its children, and can put it all back', async () => {
    const parent = await createGoal({ kind: 'project', title: 'Business' })
    const child = await createGoal({
      kind: 'money',
      title: 'Seed',
      target: 5000,
      parentId: parent.goal.id,
    })
    await logProgress(parent.goal.id, 1)

    const trash = await deleteGoal(parent.goal.id)
    expect(trash).toBeTruthy()
    expect(await db.goals.get(parent.goal.id)).toBeUndefined()
    expect((await db.goals.get(child.goal.id))!.parentId).toBeNull()
    expect(await db.entries.where('goalId').equals(parent.goal.id).count()).toBe(0)

    await restoreTrash(trash!)
    expect(await db.goals.get(parent.goal.id)).toBeTruthy()
    expect(await db.entries.where('goalId').equals(parent.goal.id).count()).toBe(1)
  })

  it('strips dangling links from the goals left behind', async () => {
    const a = await createGoal({ kind: 'money', title: 'A', target: 1 })
    const b = await createGoal({ kind: 'money', title: 'B', target: 1 })
    await toggleLink(a.goal.id, b.goal.id)
    await deleteGoal(a.goal.id)
    expect((await db.goals.get(b.goal.id))!.linkedIds).toHaveLength(0)
  })

  it('closes a binary goal on request', async () => {
    const { goal } = await createGoal({ kind: 'milestone', title: 'Get accepted' })
    const result = await completeGoal(goal.id)
    expect(result!.goal.completedAt).not.toBeNull()
    expect(result!.xp).toBeGreaterThan(0)
    expect(await completeGoal(goal.id)).toBeNull()
  })
})

describe('achievements sync', () => {
  it('unlocks on the first move and does not unlock it twice', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 2400 })
    await logProgress(goal.id, 50)
    const first = await syncAchievements()
    expect(first.map((a) => a.id)).toContain('first-move')
    expect(await syncAchievements()).toHaveLength(0)
  })

  it('writes an event for each unlock so it shows up in the timeline', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 2400 })
    await logProgress(goal.id, 50)
    await syncAchievements()
    expect(await db.events.where('type').equals('achievement').count()).toBeGreaterThan(0)
  })

  it('survives a round trip through export and import', async () => {
    const { goal } = await createGoal({ kind: 'money', title: 'Bike', target: 2400 })
    await logProgress(goal.id, 50)
    await syncAchievements()
    const json = serialise(await collect())
    await clearRecords()
    await restore(parseBackup(JSON.parse(json)).data)
    const state = await readAll()
    expect(state.achievements.length).toBeGreaterThan(0)
    expect(await syncAchievements()).toHaveLength(0)
  })
})

describe('meta', () => {
  it('reads back what it wrote and falls back cleanly', async () => {
    expect(await readMeta('nope', 'fallback')).toBe('fallback')
    await writeMeta('nope', 42)
    expect(await readMeta('nope', 'fallback')).toBe(42)
  })
})
