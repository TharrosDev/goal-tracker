import Dexie, { type EntityTable } from 'dexie'
import type {
  Goal,
  Milestone,
  ProgressEntry,
  Settings,
  TimelineEvent,
  UnlockedAchievement,
} from '@/domain/types'
import { DEFAULT_SETTINGS, settingsSchema } from '@/domain/schema'

/**
 * Persistence. IndexedDB via Dexie, entirely on the device — there is no server
 * to fall back to, so this layer is the product's memory and is treated with
 * more care than the UI above it.
 *
 * The UI never imports Dexie. Everything goes through the repository functions
 * here and in repo.ts, so persistence can be swapped without touching a route.
 */

export interface MetaRow {
  key: string
  value: unknown
}

export class AmbitionDB extends Dexie {
  goals!: EntityTable<Goal, 'id'>
  milestones!: EntityTable<Milestone, 'id'>
  entries!: EntityTable<ProgressEntry, 'id'>
  events!: EntityTable<TimelineEvent, 'id'>
  achievements!: EntityTable<UnlockedAchievement, 'id'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor(name = 'ambition-engine') {
    super(name)
    // v1 was localStorage-only and never had an IndexedDB store, so the first
    // Dexie version here is 2 to keep the numbering honest with the data format.
    this.version(2).stores({
      goals: 'id, kind, archived, paused, deadline, category, parentId, updatedAt, completedAt',
      milestones: 'id, goalId, order, done',
      entries: 'id, goalId, at',
      events: 'id, goalId, at, type',
      achievements: 'id, at',
      meta: 'key',
    })

    /**
     * v3 adds CAUSE.
     *
     * `events.cause` and `milestones.doneBy` carry the id of the dispatch that
     * produced them, so an undo can find the complete causal result of one act
     * by identity rather than by guessing at timestamps. Both are indexed
     * because undo queries them directly. Rows written before this version have
     * no cause and are backfilled with null, which is correct: nothing is known
     * about what produced them, and an unindexable null is exactly the right
     * answer to "which dispatch owns this?"
     */
    this.version(3)
      .stores({
        goals: 'id, kind, archived, paused, deadline, category, parentId, updatedAt, completedAt',
        milestones: 'id, goalId, order, done, doneBy',
        entries: 'id, goalId, at',
        events: 'id, goalId, at, type, cause',
        achievements: 'id, at',
        meta: 'key',
      })
      .upgrade(async (tx) => {
        await tx
          .table('events')
          .toCollection()
          .modify((e: Record<string, unknown>) => {
            e.cause ??= null
          })
        await tx
          .table('milestones')
          .toCollection()
          .modify((m: Record<string, unknown>) => {
            m.doneBy ??= null
          })
        await tx
          .table('goals')
          .toCollection()
          .modify((g: Record<string, unknown>) => {
            g.completedBy ??= null
          })
        await tx
          .table('achievements')
          .toCollection()
          .modify((a: Record<string, unknown>) => {
            a.cause ??= null
          })
      })
  }
}

export const db = new AmbitionDB()

export const META_KEYS = {
  settings: 'settings',
  /** The untouched v1 blob, kept forever. Migration copies; it never moves. */
  legacyBackup: 'legacy.goals.v1',
  migratedAt: 'migrated.v1.at',
  /** Rolling local snapshots, newest last. */
  snapshots: 'snapshots',
} as const

export async function readMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row === undefined ? fallback : (row.value as T)
}

export const writeMeta = async (key: string, value: unknown): Promise<void> => {
  await db.meta.put({ key, value })
}

export async function loadSettings(): Promise<Settings> {
  const raw = await readMeta<unknown>(META_KEYS.settings, null)
  const parsed = settingsSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : DEFAULT_SETTINGS
}

export const saveSettings = (settings: Settings): Promise<void> =>
  writeMeta(META_KEYS.settings, settings)

export interface Snapshot {
  at: string
  /** Serialised backup. Kept as a string so a corrupt object cannot poison the row. */
  json: string
}

/** How many automatic snapshots to keep. Small: this is a recovery net, not history. */
export const SNAPSHOT_LIMIT = 5

export async function pushSnapshot(json: string): Promise<void> {
  const list = await readMeta<Snapshot[]>(META_KEYS.snapshots, [])
  const next = [...list, { at: new Date().toISOString(), json }].slice(-SNAPSHOT_LIMIT)
  await writeMeta(META_KEYS.snapshots, next)
}

export const listSnapshots = (): Promise<Snapshot[]> =>
  readMeta<Snapshot[]>(META_KEYS.snapshots, [])

/** Wipe every record but keep the meta table's legacy backup and snapshots. */
export async function clearRecords(): Promise<void> {
  await db.transaction(
    'rw',
    [db.goals, db.milestones, db.entries, db.events, db.achievements],
    async () => {
      await Promise.all([
        db.goals.clear(),
        db.milestones.clear(),
        db.entries.clear(),
        db.events.clear(),
        db.achievements.clear(),
      ])
    },
  )
}
