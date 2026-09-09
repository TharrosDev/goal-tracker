import { create } from 'zustand'
import type {
  Goal,
  Milestone,
  ProgressEntry,
  Settings,
  TimelineEvent,
  UnlockedAchievement,
} from '@/domain/types'
import type { NewGoal } from '@/domain/schema'
import { DEFAULT_SETTINGS } from '@/domain/schema'
import * as repo from '@/data/repo'
import type { LogResult, Trash } from '@/data/repo'
import { loadSettings, saveSettings } from '@/data/db'
import { migrateLegacy } from '@/data/migrations'
import {
  commitImport,
  downloadBackup,
  importFile,
  previewImport,
  restoreSnapshot,
  takeSnapshot,
  type ImportPreview,
  type ImportReport,
} from '@/data/backup'

/**
 * The single in-memory copy of the world.
 *
 * Everything is held in plain arrays because this product holds a handful of
 * goals and a few thousand events — small enough that recomputing derived views
 * from scratch is cheaper than maintaining indexes, and far easier to keep
 * correct. If that ever stops being true, the fix is memoised selectors, not a
 * second source of truth.
 */

export interface WorldStore {
  goals: Goal[]
  milestones: Milestone[]
  entries: ProgressEntry[]
  events: TimelineEvent[]
  achievements: UnlockedAchievement[]
  settings: Settings

  ready: boolean
  error: string | null
  /** Set once on boot when v1 almanac data was found and brought across. */
  migratedCount: number
  /** Days since the last recorded event at boot. Drives the welcome-back copy. */
  awayDays: number | null

  /** Achievements unlocked since the last time the UI drained this. */
  pendingUnlocks: UnlockedAchievement[]
  /**
   * What just happened, for the ceremony host to honour. Set by every mutation
   * that earns a ceremony and cleared when it has been shown — the store decides
   * WHAT happened, the shell decides how loudly to say so.
   */
  ceremony: CeremonyCue | null
  /** The last destructive action, held for undo. */
  lastTrash: Trash | null
  /**
   * The last dispatch, held so it can be taken back. Cleared once the window
   * closes — an undo you can still reach an hour later is a second way to
   * corrupt the record, not a kindness.
   */
  lastDispatch: { entryId: string; goalId: string; title: string; at: number } | null

  boot: () => Promise<void>
  refresh: () => Promise<void>

  createGoal: (input: NewGoal, milestones?: string[]) => Promise<Goal>
  logProgress: (
    goalId: string,
    amount: number,
    options?: { mode?: ProgressEntry['mode']; note?: string; at?: string },
  ) => Promise<LogResult>
  /** Reverse a dispatch and everything it caused. See repo.undoEntry. */
  undoEntry: (entryId: string) => Promise<void>
  patchGoal: (id: string, patch: Partial<Goal>) => Promise<void>
  completeGoal: (id: string) => Promise<void>
  reopenGoal: (id: string) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  undoDelete: () => Promise<void>
  /** Let the undo window close without restoring. */
  forgetTrash: () => void

  /** Take back the last dispatch, with everything it caused. */
  undoLastDispatch: () => Promise<void>
  forgetDispatch: () => void

  addMilestone: (goalId: string, title: string, at?: number | null) => Promise<void>
  setMilestoneDone: (id: string, done: boolean) => Promise<void>
  removeMilestone: (id: string) => Promise<void>
  toggleLink: (a: string, b: string) => Promise<void>

  updateSettings: (patch: Partial<Settings>) => Promise<void>
  exportBackup: () => Promise<void>
  /** Read a file and say what it holds, WITHOUT writing anything. */
  previewBackup: (file: File) => Promise<ImportPreview>
  /** Commit what a preview showed. */
  commitBackup: (preview: ImportPreview) => Promise<ImportReport>
  importBackup: (file: File) => Promise<ImportReport>
  /** Take a local snapshot now. */
  snapshot: () => Promise<void>
  /** Go back to a snapshot, taking one of the present first. */
  rollBack: (at: string) => Promise<ImportReport>
  /** Run the invariants over the stored world; returns what had to be fixed. */
  repair: () => Promise<string[]>

  drainUnlocks: () => UnlockedAchievement[]
  clearCeremony: () => void
}

/** The four tiers, from a tap of feedback to the fall of a castle. */
export type CeremonyTier = 'dispatch' | 'gate' | 'taken' | 'siege'

export interface CeremonyCue {
  tier: CeremonyTier
  goalId: string
  merit: number
  /** Gates crossed by the same dispatch that triggered this. */
  gates: string[]
  record: boolean
  recovery: boolean
  /** Bumps on every cue so a repeat of the same event still fires. */
  seq: number
}

/**
 * Boot runs at most once per page load. React StrictMode mounts effects twice in
 * development, and a second boot would report `migratedCount: 0` over the first
 * one's real count — so the person who just had data brought across would never
 * be told. Holding the in-flight promise makes the second call a no-op that
 * still resolves when the first finishes.
 */
let booting: Promise<void> | null = null

export const useWorld = create<WorldStore>((set, get) => {
  /** Pull the whole world back out of the database. Cheap at this scale. */
  const refresh = async () => {
    const state = await repo.readAll()
    set({ ...state, error: null })
  }

  /**
   * Every mutation goes: write, re-derive achievements, re-read. Doing the read
   * last means the UI can never observe a half-applied change.
   */
  const after = async (cause?: string) => {
    const { unlocked } = await repo.reconcileAchievements(cause ?? null)
    await refresh()
    if (unlocked.length) set({ pendingUnlocks: [...get().pendingUnlocks, ...unlocked] })
  }

  return {
    goals: [],
    milestones: [],
    entries: [],
    events: [],
    achievements: [],
    settings: DEFAULT_SETTINGS,
    ready: false,
    error: null,
    migratedCount: 0,
    awayDays: null,
    pendingUnlocks: [],
    ceremony: null,
    lastTrash: null,
    lastDispatch: null,

    boot: () => {
      booting ??= (async () => {
        try {
          const migration = await migrateLegacy()
          const [settings, away] = await Promise.all([loadSettings(), repo.daysAway()])
          await refresh()
          set({
            ready: true,
            settings,
            awayDays: away,
            migratedCount: migration.migrated,
          })
          // Achievements are re-derived on boot too, so an import or a migration
          // never leaves somebody holding an unlock they cannot see.
          const unlocked = await repo.syncAchievements()
          if (unlocked.length) {
            await refresh()
            set({ pendingUnlocks: unlocked })
          }
        } catch (e) {
          set({ ready: true, error: e instanceof Error ? e.message : 'could not open your data' })
        }
      })()
      return booting
    },

    refresh,

    createGoal: async (input, milestones = []) => {
      const { goal } = await repo.createGoal(input, milestones)
      await after()
      return goal
    },

    logProgress: async (goalId, amount, options) => {
      const result = await repo.logProgress(goalId, amount, options)
      await after(result.entry.id)

      // The tier is decided here, from what actually happened, so the shell
      // never has to work out how big a thing this was.
      const boss = result.goal.boss
      const tier: CeremonyTier = result.completed
        ? boss
          ? 'siege'
          : 'taken'
        : result.reached.length
          ? 'gate'
          : 'dispatch'

      set({
        ceremony: {
          tier,
          goalId,
          merit: result.xp,
          gates: result.reached.map((m) => m.title),
          record: result.record,
          recovery: result.recovery,
          seq: (get().ceremony?.seq ?? 0) + 1,
        },
        lastDispatch: {
          entryId: result.entry.id,
          goalId,
          title: result.goal.title,
          at: Date.now(),
        },
      })
      return result
    },

    undoEntry: async (entryId) => {
      await repo.undoEntry(entryId)
      set({ lastDispatch: null, ceremony: null })
      await refresh()
    },

    undoLastDispatch: async () => {
      const last = get().lastDispatch
      if (!last) return
      await repo.undoEntry(last.entryId)
      set({ lastDispatch: null, ceremony: null })
      await refresh()
    },

    forgetDispatch: () => set({ lastDispatch: null }),

    patchGoal: async (id, patch) => {
      await repo.patchGoal(id, patch)
      await after()
    },

    completeGoal: async (id) => {
      const result = await repo.completeGoal(id)
      await after()
      if (result)
        set({
          ceremony: {
            tier: result.goal.boss ? 'siege' : 'taken',
            goalId: id,
            merit: result.xp,
            gates: [],
            record: false,
            recovery: false,
            seq: (get().ceremony?.seq ?? 0) + 1,
          },
        })
    },

    reopenGoal: async (id) => {
      await repo.reopenGoal(id)
      await refresh()
    },

    deleteGoal: async (id) => {
      const trash = await repo.deleteGoal(id)
      set({ lastTrash: trash })
      await refresh()
    },

    forgetTrash: () => set({ lastTrash: null }),

    undoDelete: async () => {
      const trash = get().lastTrash
      if (!trash) return
      await repo.restoreTrash(trash)
      set({ lastTrash: null })
      await refresh()
    },

    addMilestone: async (goalId, title, at = null) => {
      await repo.addMilestone(goalId, title, at)
      await refresh()
    },

    setMilestoneDone: async (id, done) => {
      const m = await repo.setMilestoneDone(id, done)
      await after()
      if (m && done)
        set({
          ceremony: {
            tier: 'gate',
            goalId: m.goalId,
            merit: 0,
            gates: [m.title],
            record: false,
            recovery: false,
            seq: (get().ceremony?.seq ?? 0) + 1,
          },
        })
    },

    removeMilestone: async (id) => {
      await repo.removeMilestone(id)
      await refresh()
    },

    toggleLink: async (a, b) => {
      await repo.toggleLink(a, b)
      await after()
    },

    updateSettings: async (patch) => {
      const settings = { ...get().settings, ...patch }
      set({ settings })
      await saveSettings(settings)
    },

    exportBackup: async () => {
      await downloadBackup()
    },

    importBackup: async (file) => {
      const report = await importFile(file)
      const settings = await loadSettings()
      set({ settings, lastTrash: null, lastDispatch: null })
      await refresh()
      return report
    },

    previewBackup: (file) => previewImport(file),

    commitBackup: async (preview) => {
      await commitImport(preview)
      const settings = await loadSettings()
      set({ settings, lastTrash: null, lastDispatch: null })
      await refresh()
      return preview.incoming
    },

    snapshot: () => takeSnapshot(),

    rollBack: async (at) => {
      const report = await restoreSnapshot(at)
      const settings = await loadSettings()
      set({ settings, lastTrash: null, lastDispatch: null })
      await refresh()
      return report
    },

    repair: async () => {
      const changes = await repo.repairWorld()
      await refresh()
      return changes
    },

    clearCeremony: () => set({ ceremony: null }),

    drainUnlocks: () => {
      const pending = get().pendingUnlocks
      if (pending.length) set({ pendingUnlocks: [] })
      return pending
    },
  }
})
