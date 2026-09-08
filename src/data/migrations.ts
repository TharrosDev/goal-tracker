import type { Goal, Milestone, ProgressEntry, TimelineEvent } from '@/domain/types'
import { legacyBackupSchema, makeGoal, salvage, uid, legacyGoalSchema } from '@/domain/schema'
import type { LegacyGoal } from '@/domain/schema'
import { db, META_KEYS, readMeta, writeMeta } from './db'
import { money } from '@/domain/progress'
import { xpFor } from '@/domain/xp'

/**
 * Getting the old app's data into the new one.
 *
 * The rule that governs everything here: the v1 blob under `goals.v1` is copied,
 * never moved and never cleared. If this migration is wrong in a way nobody
 * notices for a month, the original is still sitting in localStorage untouched
 * and a copy of it is in the meta table.
 */

export const LEGACY_KEY = 'goals.v1'

/** Midnight UTC on a calendar day, as an instant. v1 only ever stored days. */
const at = (day: string, offsetMs = 0): string => new Date(Date.parse(day) + offsetMs).toISOString()

export interface MigrationResult {
  migrated: number
  rejected: { index: number; reason: string }[]
  goals: Goal[]
  milestones: Milestone[]
  entries: ProgressEntry[]
  events: TimelineEvent[]
}

const EMPTY: MigrationResult = {
  migrated: 0,
  rejected: [],
  goals: [],
  milestones: [],
  entries: [],
  events: [],
}

/**
 * Map one v1 record onto the new model.
 *
 * money -> money goal, milestone -> milestone goal. The accumulated `current` is
 * replayed as a single carried-over ledger entry dated at the goal's creation,
 * so `recomputeCurrent` agrees with the cached value and the timeline is not a
 * lie about when the money actually moved.
 */
export function convertLegacyGoal(legacy: LegacyGoal): MigrationResult {
  const isMoney = legacy.type === 'money'
  const created = legacy.createdAt
  const goal: Goal = {
    ...makeGoal({
      kind: isMoney ? 'money' : 'milestone',
      title: legacy.title,
      target: isMoney ? legacy.target : null,
      deadline: legacy.deadline,
      startDate: created,
      why: '',
      definitionOfDone: isMoney ? `Reach ${legacy.target ?? 0}.` : 'Marked done in the almanac.',
    }),
    id: legacy.id || uid(),
    createdAt: at(created),
    updatedAt: at(created),
  }

  const entries: ProgressEntry[] = []
  const events: TimelineEvent[] = [
    {
      id: uid(),
      goalId: goal.id,
      type: 'created',
      at: at(created),
      xp: xpFor('created', goal),
      data: { migrated: true, from: 'goals.v1' },
    },
  ]

  const carried = isMoney ? money(legacy.current ?? 0) : 0
  if (carried > 0) {
    const stamp = at(created, 60_000)
    entries.push({
      id: uid(),
      goalId: goal.id,
      at: stamp,
      amount: carried,
      mode: 'delta',
      note: 'carried over from the almanac',
    })
    goal.current = carried
    events.push({
      id: uid(),
      goalId: goal.id,
      type: 'progress',
      at: stamp,
      xp: xpFor('progress', goal),
      data: { amount: carried, migrated: true },
    })
  }

  const finished = isMoney ? legacy.target !== null && carried >= legacy.target : legacy.done
  if (finished) {
    const stamp = at(created, 120_000)
    goal.done = !isMoney ? true : goal.done
    goal.completedAt = stamp
    events.push({
      id: uid(),
      goalId: goal.id,
      type: 'completed',
      at: stamp,
      xp: xpFor('completed', goal),
      data: { migrated: true },
    })
  }

  return { migrated: 1, rejected: [], goals: [goal], milestones: [], entries, events }
}

/** Read and convert the raw v1 payload without touching any storage. */
export function convertLegacyPayload(raw: unknown): MigrationResult {
  const asArray = legacyBackupSchema.safeParse(raw)
  const { ok, rejected } = asArray.success
    ? { ok: asArray.data, rejected: [] as MigrationResult['rejected'] }
    : salvage(legacyGoalSchema, raw)

  return ok.reduce<MigrationResult>(
    (acc, legacy) => {
      const one = convertLegacyGoal(legacy)
      return {
        migrated: acc.migrated + 1,
        rejected: acc.rejected,
        goals: [...acc.goals, ...one.goals],
        milestones: acc.milestones,
        entries: [...acc.entries, ...one.entries],
        events: [...acc.events, ...one.events],
      }
    },
    { ...EMPTY, rejected },
  )
}

function readLegacyBlob(): { raw: unknown; text: string } | null {
  if (typeof localStorage === 'undefined') return null
  const text = localStorage.getItem(LEGACY_KEY)
  if (!text) return null
  try {
    return { raw: JSON.parse(text), text }
  } catch {
    return { raw: null, text }
  }
}

/**
 * Runs once, on an empty database, when a v1 blob is present.
 *
 * The guard and the insert share ONE transaction, and that is not incidental.
 * A read-then-write guard with an await between them is a race: two concurrent
 * boots — which is exactly what a React StrictMode double-mount produces — both
 * see `migratedAt` unset and both insert. Goals survive it because they carry
 * their original ids, but ledger entries and events are minted fresh each pass,
 * so the second run silently doubles the history and leaves every cached total
 * disagreeing with its ledger.
 *
 * IndexedDB serialises readwrite transactions over the same object stores, so
 * re-checking the guard inside the transaction makes this safe against any
 * number of concurrent callers.
 */
export async function migrateLegacy(): Promise<MigrationResult> {
  const blob = readLegacyBlob()
  if (!blob) return EMPTY

  // Copy the original before doing anything else, verbatim, as text.
  await writeMeta(META_KEYS.legacyBackup, blob.text)

  const result = convertLegacyPayload(blob.raw)

  let applied = false
  await db.transaction('rw', [db.goals, db.entries, db.events, db.meta], async () => {
    const already = await readMeta<string | null>(META_KEYS.migratedAt, null)
    const existing = await db.goals.count()
    if (already || existing > 0) return

    applied = true
    if (result.goals.length) {
      await db.goals.bulkPut(result.goals)
      await db.entries.bulkPut(result.entries)
      await db.events.bulkPut(result.events)
    }
    await writeMeta(META_KEYS.migratedAt, new Date().toISOString())
  })

  return applied ? result : EMPTY
}

/** The kept copy of the original v1 payload, if there is one. */
export const readLegacyBackup = (): Promise<string | null> =>
  readMeta<string | null>(META_KEYS.legacyBackup, null)
