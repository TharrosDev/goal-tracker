import type { ISODate, TimelineEvent } from './types'
import { addDays, dayOf, days, today } from './date'

/**
 * Momentum is a reading, not a verdict.
 *
 * It is a recency-weighted fold over the event log, saturated per day so one
 * frantic afternoon cannot buy a month, and blended with plain consistency so
 * showing up regularly beats showing up hard. Nothing here is science; it exists
 * to give the interface a defensible reason to feel different in a strong month
 * than in a quiet one.
 *
 * Low momentum reads QUIET. There is no negative term and no penalty — absence
 * simply stops contributing, and the environment goes still.
 */

/** Contribution of each kind of event to a day's energy. */
const ENERGY: Partial<Record<TimelineEvent['type'], number>> = {
  progress: 1,
  milestone: 3,
  completed: 5,
  record: 2,
  achievement: 1.5,
  created: 1,
  resumed: 1,
}

/** Days of history the score looks at. */
export const WINDOW = 28
/** Recency half-life: a week-old day counts half as much as today. */
const HALF_LIFE = 7
/** Days the consistency term measures. */
const CONSISTENCY_WINDOW = 14

/**
 * Diminishing returns inside a single day: 1 event ≈ 0.57, 2 ≈ 0.81, 5 ≈ 0.98.
 * Tuned so that showing up once a day reads as a strong day, and stacking five
 * things into one afternoon is worth less than five ordinary days.
 */
const saturate = (energy: number): number => 1 - Math.exp(-energy / 1.2)

export type MomentumBand = 'dormant' | 'low' | 'steady' | 'high' | 'surging'

export interface Momentum {
  /** 0..1. */
  score: number
  band: MomentumBand
  /** Distinct days with any activity inside CONSISTENCY_WINDOW. */
  activeDays: number
  /** Per-day saturated energy, oldest first, length = `series` argument. */
  series: number[]
  /** Change against the same-length window before this one, -1..1. */
  trend: number
}

export function bandOf(score: number): MomentumBand {
  if (score < 0.08) return 'dormant'
  if (score < 0.28) return 'low'
  if (score < 0.55) return 'steady'
  if (score < 0.78) return 'high'
  return 'surging'
}

/** Saturated energy per calendar day, oldest first, ending on `at`. */
export function energySeries(events: TimelineEvent[], length: number, at: ISODate = today()) {
  const raw = new Map<ISODate, number>()
  for (const e of events) {
    const d = dayOf(e.at)
    const gain = ENERGY[e.type]
    if (!gain) continue
    raw.set(d, (raw.get(d) ?? 0) + gain)
  }
  const out: number[] = []
  for (let i = length - 1; i >= 0; i -= 1) out.push(saturate(raw.get(addDays(at, -i)) ?? 0))
  return out
}

function scoreWindow(events: TimelineEvent[], at: ISODate): number {
  const series = energySeries(events, WINDOW, at)
  let weighted = 0
  let total = 0
  for (let i = 0; i < series.length; i += 1) {
    const age = WINDOW - 1 - i
    const w = Math.pow(0.5, age / HALF_LIFE)
    weighted += w * (series[i] ?? 0)
    total += w
  }
  const energy = total ? weighted / total : 0

  const recent = series.slice(-CONSISTENCY_WINDOW)
  const consistency = recent.filter((v) => v > 0).length / CONSISTENCY_WINDOW

  // Consistency carries nearly half the weight on purpose: turning up every
  // day for four weeks should read as high momentum even if each day is small.
  return Math.min(0.55 * energy + 0.45 * consistency, 1)
}

export function momentum(
  events: TimelineEvent[],
  at: ISODate = today(),
  seriesLength = 56,
): Momentum {
  const score = scoreWindow(events, at)
  const previous = scoreWindow(
    events.filter((e) => days(dayOf(e.at), at) >= WINDOW),
    addDays(at, -WINDOW),
  )
  const series = energySeries(events, seriesLength, at)
  const activeDays = series.slice(-CONSISTENCY_WINDOW).filter((v) => v > 0).length
  return { score, band: bandOf(score), activeDays, series, trend: score - previous }
}

/**
 * Intensity the visual system multiplies into motion amplitude, particle count
 * and ambient energy. Floored so a dormant universe still breathes.
 */
export const intensity = (score: number): number => 0.25 + 0.75 * score
