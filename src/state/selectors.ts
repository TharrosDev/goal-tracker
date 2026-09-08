import type {
  Goal,
  GoalState,
  ISODate,
  Milestone,
  ProgressEntry,
  TimelineEvent,
} from '@/domain/types'
import { arrival, BEHIND, paceGap, perWeek, pressure, projectedFinish, type Arrival } from '@/domain/pace'
import {
  daysSinceProgress,
  fraction,
  habitPeriod,
  remaining,
  stateOf,
  streakLength,
} from '@/domain/progress'
import { hueOf, massOf, sigilOf, type Sigil } from '@/domain/identity'
import { momentum, type Momentum } from '@/domain/momentum'
import { progression, totalXp, type Progression } from '@/domain/xp'
import { dayOf, days, today } from '@/domain/date'
import type { WorldStore } from './world'

/**
 * Everything the interface knows about a goal, computed once.
 *
 * The rule this file exists to enforce: no component ever calls a domain
 * function itself. If two places disagreed about whether a goal is behind, the
 * product would be lying to somebody, so there is exactly one place that decides.
 */
export interface GoalView {
  goal: Goal
  milestones: Milestone[]
  entries: ProgressEntry[]

  /** 0..1. */
  fraction: number
  state: GoalState
  remaining: number | null
  arrival: Arrival | null
  /** Positive means behind the straight line; null when there is no line. */
  paceGap: number | null
  behind: boolean
  perWeek: number | null
  projectedFinish: ISODate | null
  /** 0..1 deadline pressure, for the visual system. */
  pressure: number

  daysIdle: number | null
  daysAlive: number
  streak: number
  habit: ReturnType<typeof habitPeriod> | null

  /** Milestone the goal is currently working towards, if any. */
  nextMilestone: Milestone | null

  hue: number
  sigil: Sigil
  mass: number
  /** Composite 0..1 used to rank what deserves the most space. */
  weight: number
}

export function viewOf(
  goal: Goal,
  allMilestones: Milestone[],
  allEntries: ProgressEntry[],
  at: ISODate = today(),
): GoalView {
  const milestones = allMilestones
    .filter((m) => m.goalId === goal.id)
    .sort((a, b) => a.order - b.order)
  const entries = allEntries
    .filter((e) => e.goalId === goal.id)
    .sort((a, b) => b.at.localeCompare(a.at))

  const gap = paceGap(goal, at)
  const a = arrival(goal, at)
  const state = stateOf(goal, entries, milestones, at)
  const f = fraction(goal, milestones, at)

  return {
    goal,
    milestones,
    entries,
    fraction: f,
    state,
    remaining: remaining(goal),
    arrival: a,
    paceGap: gap,
    behind: gap !== null && gap > BEHIND,
    perWeek:
      goal.target !== null && goal.deadline
        ? perWeek(goal.target, goal.current, days(at, goal.deadline))
        : null,
    projectedFinish: projectedFinish(goal, at),
    pressure: pressure(goal, at),
    daysIdle: daysSinceProgress(entries, at),
    daysAlive: days(goal.startDate, at),
    streak: streakLength(entries, at),
    habit: goal.recurrence ? habitPeriod(goal, entries, at) : null,
    nextMilestone: milestones.find((m) => !m.done) ?? null,
    hue: hueOf(goal),
    sigil: sigilOf(goal),
    mass: massOf(goal),
    weight: weightOf(goal, f, a, state),
  }
}

/**
 * How much of the interface a goal has earned. Deliberately not just progress:
 * a boss goal at 5% outranks a trivial goal at 95%, and a pressing deadline
 * outranks both.
 */
function weightOf(goal: Goal, f: number, a: Arrival | null, state: GoalState): number {
  if (state === 'completed' || goal.archived) return 0
  const importance = (goal.priority / 5) * 0.4 + (goal.difficulty / 5) * 0.2
  const urgency = a ? (a.overdue ? 0.3 : Math.max(0, 1 - a.left / 60) * 0.3) : 0
  const motion = state === 'stalled' || state === 'paused' ? -0.1 : f * 0.15
  return Math.max(0, Math.min(importance + urgency + motion + (goal.boss ? 0.35 : 0), 1))
}

export interface WorldView {
  views: GoalView[]
  byId: Map<string, GoalView>
  live: GoalView[]
  completed: GoalView[]
  archived: GoalView[]

  momentum: Momentum
  progression: Progression
  xp: number
  /** Consecutive days with any entry across every goal. */
  streak: number
  longestStreak: number

  /** Highest-weight live goal — the one the command centre leads with. */
  headline: GoalView | null
  /** Soonest live deadline. */
  urgent: GoalView | null
  /** Live goals that have gone quiet, oldest silence first. */
  stalled: GoalView[]
  /** Newest events first. */
  recent: TimelineEvent[]
  /** Overall completion across everything measurable, 0..1. */
  trajectory: number
}

const EMPTY_MOMENTUM_EVENTS: TimelineEvent[] = []

export function worldView(
  state: Pick<WorldStore, 'goals' | 'milestones' | 'entries' | 'events'>,
  at: ISODate = today(),
): WorldView {
  const views = state.goals.map((g) => viewOf(g, state.milestones, state.entries, at))
  const byId = new Map(views.map((v) => [v.goal.id, v]))

  const live = views
    .filter((v) => v.state !== 'completed' && !v.goal.archived)
    .sort((a, b) => b.weight - a.weight)
  const completed = views
    .filter((v) => v.state === 'completed')
    .sort((a, b) => (b.goal.completedAt ?? '').localeCompare(a.goal.completedAt ?? ''))
  const archived = views.filter((v) => v.goal.archived && v.state !== 'completed')

  const m = momentum(state.events.length ? state.events : EMPTY_MOMENTUM_EVENTS, at)
  const xp = totalXp(state.events)

  const dated = live.filter((v) => v.arrival).sort((a, b) => a.arrival!.left - b.arrival!.left)
  const stalled = live
    .filter((v) => v.state === 'stalled')
    .sort((a, b) => (b.daysIdle ?? 0) - (a.daysIdle ?? 0))

  const measurable = live.filter((v) => v.goal.target !== null || v.goal.kind === 'project')
  const trajectory = measurable.length
    ? measurable.reduce((s, v) => s + v.fraction, 0) / measurable.length
    : 0

  return {
    views,
    byId,
    live,
    completed,
    archived,
    momentum: m,
    progression: progression(xp),
    xp,
    streak: streakLength(state.entries, at),
    longestStreak: Math.max(0, ...views.map((v) => v.streak)),
    headline: live[0] ?? null,
    urgent: dated[0] ?? null,
    stalled,
    recent: [...state.events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40),
    trajectory,
  }
}

/** Activity per calendar day over the last `length` days, for heatmaps. */
export function activityByDay(entries: ProgressEntry[], length: number, at: ISODate = today()) {
  const counts = new Map<string, number>()
  for (const e of entries) {
    const d = dayOf(e.at)
    counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  const out: { date: ISODate; count: number }[] = []
  for (let i = length - 1; i >= 0; i -= 1) {
    const date = new Date(Date.parse(at) - i * 86_400_000).toISOString().slice(0, 10)
    out.push({ date, count: counts.get(date) ?? 0 })
  }
  return out
}
