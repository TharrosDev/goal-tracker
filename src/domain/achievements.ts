import type {
  Goal,
  ISODate,
  Milestone,
  ProgressEntry,
  TimelineEvent,
  UnlockedAchievement,
} from './types'
import { dayOf, days, today } from './date'
import { habitPeriod, longestStreak, stateOf, streakLength } from './progress'
import { BEHIND, paceGap } from './pace'
import { momentum } from './momentum'
import { progression, totalXp } from './xp'

/**
 * Achievements are pure predicates over a snapshot. No achievement writes
 * anything; the store diffs `evaluate()` against what is already unlocked and
 * appends the difference. That keeps them re-derivable after an import and makes
 * every one of them testable in isolation.
 */

export interface AchievementContext {
  goals: Goal[]
  milestones: Milestone[]
  entries: ProgressEntry[]
  events: TimelineEvent[]
  at: ISODate
}

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'mythic'

export interface AchievementDef {
  id: string
  name: string
  /** Shown once unlocked. Hidden achievements show a redacted line until then. */
  description: string
  hidden: boolean
  tier: AchievementTier
  /** Returns the number that earned it, or null. */
  check: (ctx: AchievementContext) => number | null
}

const entriesOf = (ctx: AchievementContext, goalId: string) =>
  ctx.entries.filter((e) => e.goalId === goalId)

const completedGoals = (ctx: AchievementContext) => ctx.goals.filter((g) => g.completedAt !== null)

/** Distinct calendar days on which anything at all was logged. */
const activeDays = (ctx: AchievementContext) => new Set(ctx.entries.map((e) => dayOf(e.at))).size

/** Longest silent gap between two consecutive entries on the same goal. */
function longestGapPerGoal(ctx: AchievementContext, minimum: number): number {
  let best = 0
  for (const g of ctx.goals) {
    const list = entriesOf(ctx, g.id)
      .map((e) => dayOf(e.at))
      .sort()
    for (let i = 1; i < list.length; i += 1) {
      const gap = days(list[i - 1]!, list[i]!)
      if (gap >= minimum && gap > best) best = gap
    }
  }
  return best
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-move',
    name: 'FIRST MOVE',
    description: 'Create a goal and advance it.',
    hidden: false,
    tier: 'bronze',
    check: (ctx) => (ctx.entries.length >= 1 && ctx.goals.length >= 1 ? 1 : null),
  },
  {
    id: 'seven',
    name: 'SEVEN',
    description: 'Log progress on seven separate days.',
    hidden: false,
    tier: 'bronze',
    check: (ctx) => (activeDays(ctx) >= 7 ? activeDays(ctx) : null),
  },
  {
    id: 'momentum',
    name: 'MOMENTUM',
    description: 'Reach high momentum.',
    hidden: false,
    tier: 'silver',
    check: (ctx) => {
      const m = momentum(ctx.events, ctx.at)
      return m.score >= 0.7 ? Math.round(m.score * 100) : null
    },
  },
  {
    id: 'long-game',
    name: 'LONG GAME',
    description: 'Keep a single goal alive for 180 days.',
    hidden: false,
    tier: 'gold',
    check: (ctx) => {
      const spans = ctx.goals.map((g) =>
        days(g.startDate, g.completedAt ? dayOf(g.completedAt) : ctx.at),
      )
      const best = Math.max(0, ...spans)
      return best >= 180 ? best : null
    },
  },
  {
    id: 'comeback',
    name: 'COMEBACK',
    description: 'Return to a dormant goal and move it again.',
    hidden: false,
    tier: 'silver',
    check: (ctx) => longestGapPerGoal(ctx, 14) || null,
  },
  {
    id: 'deadline-killer',
    name: 'DEADLINE KILLER',
    description: 'Finish a goal before its deadline.',
    hidden: false,
    tier: 'silver',
    check: (ctx) => {
      const early = completedGoals(ctx)
        .filter((g) => g.deadline)
        .map((g) => days(dayOf(g.completedAt!), g.deadline!))
        .filter((n) => n > 0)
      return early.length ? Math.max(...early) : null
    },
  },
  {
    id: 'perfect-week',
    name: 'PERFECT WEEK',
    description: 'Keep every recurring commitment inside one period.',
    hidden: false,
    tier: 'gold',
    check: (ctx) => {
      const recurring = ctx.goals.filter((g) => g.recurrence && !g.archived && !g.paused)
      if (recurring.length < 2) return null
      const kept = recurring.every((g) => habitPeriod(g, entriesOf(ctx, g.id), ctx.at).kept)
      return kept ? recurring.length : null
    },
  },
  {
    id: 'century',
    name: 'CENTURY',
    description: 'Log one hundred progress events.',
    hidden: false,
    tier: 'gold',
    check: (ctx) => (ctx.entries.length >= 100 ? ctx.entries.length : null),
  },
  {
    id: 'obsession',
    name: 'OBSESSION',
    description: 'Hold a thirty-day streak.',
    hidden: false,
    tier: 'gold',
    check: (ctx) => {
      const best = longestStreak(ctx.entries)
      return best >= 30 ? best : null
    },
  },
  {
    id: 'the-impossible',
    name: 'THE IMPOSSIBLE',
    description: 'Complete a maximum-difficulty goal.',
    hidden: false,
    tier: 'mythic',
    check: (ctx) => (completedGoals(ctx).some((g) => g.difficulty === 5) ? 5 : null),
  },

  // hidden -- redacted in the UI until they fire
  {
    id: 'first-light',
    name: 'FIRST LIGHT',
    description: 'Bring the first object into an empty universe.',
    hidden: true,
    tier: 'bronze',
    check: (ctx) => (ctx.goals.length >= 1 ? 1 : null),
  },
  {
    id: 'midnight-oil',
    name: 'MIDNIGHT OIL',
    description: 'Log progress between midnight and four in the morning.',
    hidden: true,
    tier: 'bronze',
    check: (ctx) => {
      const n = ctx.entries.filter((e) => {
        const h = new Date(e.at).getHours()
        return h >= 0 && h < 4
      }).length
      return n || null
    },
  },
  {
    id: 'clean-slate',
    name: 'CLEAN SLATE',
    description: 'Have every paced goal on or ahead of its line at once.',
    hidden: true,
    tier: 'silver',
    check: (ctx) => {
      const paced = ctx.goals.filter(
        (g) => !g.archived && !g.paused && !g.completedAt && g.deadline && g.target,
      )
      if (paced.length < 3) return null
      return paced.every((g) => (paceGap(g, ctx.at) ?? 0) <= 0) ? paced.length : null
    },
  },
  {
    id: 'architect',
    name: 'ARCHITECT',
    description: 'Complete every milestone of a goal broken into five or more.',
    hidden: true,
    tier: 'silver',
    check: (ctx) => {
      for (const g of ctx.goals) {
        const mine = ctx.milestones.filter((m) => m.goalId === g.id)
        if (mine.length >= 5 && mine.every((m) => m.done)) return mine.length
      }
      return null
    },
  },
  {
    id: 'constellation',
    name: 'CONSTELLATION',
    description: 'Connect five goals into a single web.',
    hidden: true,
    tier: 'gold',
    check: (ctx) => {
      const adjacency = new Map<string, Set<string>>()
      const touch = (id: string) => {
        if (!adjacency.has(id)) adjacency.set(id, new Set())
        return adjacency.get(id)!
      }
      const link = (a: string, b: string) => {
        touch(a).add(b)
        touch(b).add(a)
      }
      for (const g of ctx.goals) {
        touch(g.id)
        if (g.parentId) link(g.id, g.parentId)
        for (const other of g.linkedIds) link(g.id, other)
      }
      let best = 0
      const seen = new Set<string>()
      for (const start of adjacency.keys()) {
        if (seen.has(start)) continue
        const stack = [start]
        let size = 0
        while (stack.length) {
          const node = stack.pop()!
          if (seen.has(node)) continue
          seen.add(node)
          size += 1
          for (const n of adjacency.get(node) ?? []) if (!seen.has(n)) stack.push(n)
        }
        if (size > best) best = size
      }
      return best >= 5 ? best : null
    },
  },
  {
    id: 'phoenix',
    name: 'PHOENIX',
    description: 'Revive a goal that sat untouched for sixty days.',
    hidden: true,
    tier: 'gold',
    check: (ctx) => longestGapPerGoal(ctx, 60) || null,
  },
  {
    id: 'iron',
    name: 'IRON',
    description: 'One hundred consecutive days.',
    hidden: true,
    tier: 'mythic',
    check: (ctx) => {
      const best = longestStreak(ctx.entries)
      return best >= 100 ? best : null
    },
  },
  {
    id: 'polymath',
    name: 'POLYMATH',
    description: 'Run live goals across five different categories.',
    hidden: true,
    tier: 'silver',
    check: (ctx) => {
      const cats = new Set(
        ctx.goals.filter((g) => !g.archived && !g.completedAt && g.category).map((g) => g.category!),
      )
      return cats.size >= 5 ? cats.size : null
    },
  },
  {
    id: 'ascendant',
    name: 'ASCENDANT',
    description: 'Reach level ten.',
    hidden: true,
    tier: 'gold',
    check: (ctx) => {
      const level = progression(totalXp(ctx.events)).level
      return level >= 10 ? level : null
    },
  },
  {
    id: 'overshoot',
    name: 'OVERSHOOT',
    description: 'Finish a goal at half again its target.',
    hidden: true,
    tier: 'silver',
    check: (ctx) => {
      const over = completedGoals(ctx)
        .filter((g) => g.target && g.current >= g.target * 1.5)
        .map((g) => Math.round((g.current / g.target!) * 100))
      return over.length ? Math.max(...over) : null
    },
  },
  {
    id: 'speedrun',
    name: 'SPEEDRUN',
    description: 'Take a goal from nothing to done inside a week.',
    hidden: true,
    tier: 'silver',
    check: (ctx) => {
      const fast = completedGoals(ctx)
        .map((g) => days(g.startDate, dayOf(g.completedAt!)))
        .filter((n) => n >= 0 && n <= 7)
      return fast.length ? Math.min(...fast) : null
    },
  },
  {
    id: 'the-fleet',
    name: 'THE FLEET',
    description: 'Hold ten goals in motion at the same time.',
    hidden: true,
    tier: 'gold',
    check: (ctx) => {
      const live = ctx.goals.filter((g) => {
        if (g.archived) return false
        const state = stateOf(g, entriesOf(ctx, g.id), ctx.milestones, ctx.at)
        return state !== 'completed' && state !== 'stalled'
      }).length
      return live >= 10 ? live : null
    },
  },
  {
    id: 'unbroken',
    name: 'UNBROKEN',
    description: 'Log seven days running with nothing behind its line.',
    hidden: true,
    tier: 'gold',
    check: (ctx) => {
      if (streakLength(ctx.entries, ctx.at) < 7) return null
      const live = ctx.goals.filter((g) => !g.archived && !g.completedAt && g.deadline && g.target)
      return live.every((g) => (paceGap(g, ctx.at) ?? 0) <= BEHIND) ? 7 : null
    },
  },
]

export const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))

/** Everything currently earned. The caller diffs this against what is stored. */
export function evaluate(ctx: AchievementContext): { id: string; value: number | null }[] {
  const out: { id: string; value: number | null }[] = []
  for (const def of ACHIEVEMENTS) {
    const value = def.check(ctx)
    if (value !== null) out.push({ id: def.id, value })
  }
  return out
}

/** Newly earned achievements, given what is already unlocked. */
export function newlyUnlocked(
  ctx: AchievementContext,
  unlocked: UnlockedAchievement[],
): { id: string; value: number | null }[] {
  const have = new Set(unlocked.map((u) => u.id))
  return evaluate(ctx).filter((a) => !have.has(a.id))
}

export const emptyContext = (at: ISODate = today()): AchievementContext => ({
  goals: [],
  milestones: [],
  entries: [],
  events: [],
  at,
})
