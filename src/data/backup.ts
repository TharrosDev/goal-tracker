import type { Backup } from '@/domain/types'
import {
  BACKUP_VERSION,
  backupSchema,
  goalSchema,
  milestoneSchema,
  progressEntrySchema,
  settingsSchema,
  timelineEventSchema,
  unlockedAchievementSchema,
  salvage,
} from '@/domain/schema'
import { normaliseWorld } from '@/domain/invariants'
import { convertLegacyPayload } from './migrations'
import { clearRecords, db, loadSettings, pushSnapshot, saveSettings } from './db'
import { now, today } from '@/domain/date'
import { uid } from '@/domain/schema'

/**
 * Backup, restore, and repair.
 *
 * localStorage was one cache-clear from empty in v1 and IndexedDB is no safer,
 * so export stays a first-class action rather than a settings-page afterthought.
 * Import never trusts its input: it salvages what parses, quarantines what does
 * not, and snapshots the current state before overwriting anything.
 */

export async function collect(): Promise<Backup> {
  const [goals, milestones, entries, events, achievements, settings] = await Promise.all([
    db.goals.toArray(),
    db.milestones.toArray(),
    db.entries.toArray(),
    db.events.toArray(),
    db.achievements.toArray(),
    loadSettings(),
  ])
  return {
    format: 'ambition-engine',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    goals,
    milestones,
    entries,
    events,
    achievements,
    settings,
  }
}

export const serialise = (backup: Backup): string => JSON.stringify(backup, null, 2)

export const backupFilename = (): string => `ambition-${today()}.json`

/** Hands the browser a file. The only place in the app that touches the DOM for data. */
export async function downloadBackup(): Promise<string> {
  const json = serialise(await collect())
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = backupFilename()
  a.click()
  URL.revokeObjectURL(url)
  return json
}

export interface ImportReport {
  goals: number
  milestones: number
  entries: number
  events: number
  achievements: number
  /** Records that could not be read, by table. The UI shows this verbatim. */
  rejected: { table: string; index: number; reason: string }[]
  /** True when the file was a v1 almanac export rather than a v2 backup. */
  legacy: boolean
  /** Goals whose cached total disagreed with their ledger and were repaired. */
  repaired: number
  /** Everything the invariants had to put right, in plain sentences. */
  repairs: string[]
}

/**
 * Parse a backup file into records, salvaging per row.
 *
 * Accepts three shapes: a v2 backup object, a bare v1 array (the old app's
 * export), and a v2-shaped object with some rows broken.
 */
export function parseBackup(raw: unknown): { data: Backup; report: ImportReport } {
  const report: ImportReport = {
    goals: 0,
    milestones: 0,
    entries: 0,
    events: 0,
    achievements: 0,
    rejected: [],
    legacy: false,
    repaired: 0,
    repairs: [],
  }

  if (Array.isArray(raw)) {
    const converted = convertLegacyPayload(raw)
    report.legacy = true
    report.goals = converted.goals.length
    report.entries = converted.entries.length
    report.events = converted.events.length
    report.rejected = converted.rejected.map((r) => ({ table: 'goals', ...r }))
    return {
      data: {
        format: 'ambition-engine',
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        goals: converted.goals,
        milestones: [],
        entries: converted.entries,
        events: converted.events,
        achievements: [],
        settings: settingsSchema.parse({}),
      },
      report,
    }
  }

  const strict = backupSchema.safeParse(raw)
  if (strict.success) {
    const data = strict.data as Backup
    report.goals = data.goals.length
    report.milestones = data.milestones.length
    report.entries = data.entries.length
    report.events = data.events.length
    report.achievements = data.achievements.length
    return { data: repair(data, report), report }
  }

  const source = (raw ?? {}) as Record<string, unknown>
  if (typeof source !== 'object') throw new Error('that file is not a backup')

  const goals = salvage(goalSchema, source.goals ?? [])
  const milestones = salvage(milestoneSchema, source.milestones ?? [])
  const entries = salvage(progressEntrySchema, source.entries ?? [])
  const events = salvage(timelineEventSchema, source.events ?? [])
  const achievements = salvage(unlockedAchievementSchema, source.achievements ?? [])

  if (!goals.ok.length && goals.rejected.length) throw new Error('no readable goals in that file')

  report.goals = goals.ok.length
  report.milestones = milestones.ok.length
  report.entries = entries.ok.length
  report.events = events.ok.length
  report.achievements = achievements.ok.length
  report.rejected = [
    ...goals.rejected.map((r) => ({ table: 'goals', ...r })),
    ...milestones.rejected.map((r) => ({ table: 'milestones', ...r })),
    ...entries.rejected.map((r) => ({ table: 'entries', ...r })),
    ...events.rejected.map((r) => ({ table: 'events', ...r })),
    ...achievements.rejected.map((r) => ({ table: 'achievements', ...r })),
  ]

  const data: Backup = {
    format: 'ambition-engine',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    goals: goals.ok,
    milestones: milestones.ok,
    entries: entries.ok,
    events: events.ok,
    achievements: achievements.ok,
    settings: settingsSchema.parse(source.settings ?? {}),
  }
  return { data: repair(data, report), report }
}

/**
 * Put an arriving world right.
 *
 * A backup edited by hand, truncated mid-write, or exported by a build that had
 * a bug in it arrives internally inconsistent — orphaned rows, cached totals
 * that disagree with the ledger, ties with only one end, a goal inside a loop of
 * ownership. The full invariant pass in `domain/invariants.ts` runs here, so
 * import can never be the way a broken shape gets in, and the person is told in
 * sentences what had to be changed.
 */
function repair(data: Backup, report: ImportReport): Backup {
  const fixed = normaliseWorld(data)
  report.repairs = fixed.changes
  report.repaired = fixed.changes.filter((c) => c.includes('disagreed with its dispatches')).length
  return {
    ...data,
    goals: fixed.goals,
    milestones: fixed.milestones,
    entries: fixed.entries,
    events: fixed.events,
  }
}

/** Replace everything. Snapshots the current state first, so this is undoable. */
export async function restore(data: Backup): Promise<void> {
  const current = await collect()
  if (current.goals.length) await pushSnapshot(serialise(current))

  await clearRecords()
  await db.transaction(
    'rw',
    [db.goals, db.milestones, db.entries, db.events, db.achievements],
    async () => {
      await db.goals.bulkPut(data.goals)
      await db.milestones.bulkPut(data.milestones)
      await db.entries.bulkPut(data.entries)
      await db.events.bulkPut(data.events)
      await db.achievements.bulkPut(data.achievements)
      // Written AFTER the rows, or it would be wiped by the very restore it
      // describes. The chronicle should never show a record that simply begins.
      await db.events.put({
        id: uid(),
        goalId: null,
        type: 'imported',
        at: now(),
        xp: 0,
        cause: null,
        data: {
          goals: data.goals.length,
          entries: data.entries.length,
          from: data.exportedAt,
        },
      })
    },
  )
  await saveSettings(data.settings)
}

/** Read a picked file end to end. Throws with a sentence a person can act on. */
export async function importFile(file: File): Promise<ImportReport> {
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    throw new Error(`${file.name} is not valid JSON`)
  }
  const { data, report } = parseBackup(raw)
  await restore(data)
  return report
}
