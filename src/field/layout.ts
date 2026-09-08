import type { GoalView } from '@/state/selectors'
import { days } from '@/domain/date'
import type { ISODate } from '@/domain/types'
import { clamp01 } from '@/domain/progress'

/**
 * THE FIELD'S COORDINATE SYSTEM.
 *
 * X is how far a standard is through its OWN span: 0 the day it was planted, 1
 * at its hour. Y is its progress. That choice is what makes the single diagonal
 * exact rather than decorative — at position x the expected progress is exactly
 * x, so a standard sitting on the line is precisely on pace, one above it is
 * ahead, and the vertical gap below it IS `paceGap`, to the pixel, for every
 * goal regardless of how long its span is.
 *
 * The first draft plotted X as absolute days-until-deadline against a shared
 * horizon. That reads well but the diagonal is then only correct for goals whose
 * whole span happens to equal the horizon, so the most prominent element in the
 * product would have been an approximation dressed as a measurement. Absolute
 * time is still carried, per standard, by its arrival text.
 *
 * Consequence worth knowing: standards drift rightward on their own as time
 * passes, and reach the right edge at their hour. The field is a race toward
 * that edge.
 */

export interface Placed {
  view: GoalView
  /** Left edge in px. */
  x: number
  width: number
  /** Centre in px, before overlap resolution. This is the true datum. */
  centre: number
  /** Cloth height in px, from the ground line up. */
  height: number
  /** Height the line sits at over this standard's centre, px. */
  lineHeight: number
  /** 0..1 through its own span. */
  t: number
  /** True when the cloth top is materially below the line. */
  behind: boolean
}

export interface FieldLayout {
  /** Standards on a clock, left to right. */
  dated: Placed[]
  /** Standards with no hour. Not lesser — simply not on a clock. */
  reserve: GoalView[]
  /** Distance from the top of the field to the ground line, px. */
  ground: number
  /** Tallest a cloth may be, px. */
  usable: number
}

/**
 * The ground is measured DOWN FROM THE TOP by subtracting what has to live below
 * it, not as a fixed fraction of the height.
 *
 * A fraction was wrong twice over: it left too little room for the feet and the
 * reserve at short viewport heights, and it was computed against the whole field
 * while the standards were laid out inside a flex child of a different height —
 * so the rules and the cloth were in two different coordinate spaces and the
 * standards floated a hundred pixels above the ground they stand on.
 */
export const FOOT_BAND = 104
export const RESERVE_BAND = 76
/** Never let the plot collapse to nothing on a very short viewport. */
const MIN_PLOT = 120
/** Headroom above a full-height cloth, px. */
const HEADROOM = 56
/** Cloth width at weight 0, and how much weight adds. DESIGN.md 9. */
const MIN_WIDTH = 56
const WIDTH_PER_WEIGHT = 120
/** Standards never touch: the palisade is gapless, but poles stay distinct. */
const MIN_GAP = 4

export function widthOf(weight: number): number {
  return Math.round(MIN_WIDTH + weight * WIDTH_PER_WEIGHT)
}

/**
 * How far through its own span a standard is. Null when it has no hour, which
 * is what puts it in the reserve.
 */
export function elapsedFraction(view: GoalView, at: ISODate): number | null {
  const { startDate, deadline } = view.goal
  if (!deadline) return null
  const span = days(startDate, deadline)
  if (span <= 0) return 1
  return clamp01(days(startDate, at) / span)
}

/**
 * Nudge overlapping standards apart while keeping their order, then pull the
 * whole run back inside the field. Position is a measurement, so this reports
 * displacement rather than hiding it: `centre` keeps the true datum and the tick
 * on the scale bar is drawn from `centre`, not from `x`.
 */
function resolveOverlaps(placed: Placed[], width: number): Placed[] {
  const sorted = [...placed].sort((a, b) => a.centre - b.centre)

  let cursor = 0
  for (const p of sorted) {
    p.x = Math.max(p.centre - p.width / 2, cursor)
    cursor = p.x + p.width + MIN_GAP
  }

  // If the run overflowed the right edge, walk back from the end.
  const overflow = cursor - MIN_GAP - width
  if (overflow > 0) {
    let right = width
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const p = sorted[i]!
      p.x = Math.min(p.x, right - p.width)
      right = p.x - MIN_GAP
    }
    // A field too narrow for its standards clamps rather than going negative.
    for (const p of sorted) p.x = Math.max(p.x, 0)
  }

  return sorted
}

export function layoutField(
  views: GoalView[],
  options: { width: number; height: number; at: ISODate },
): FieldLayout {
  const { width, height, at } = options

  const reserve: GoalView[] = []
  const dated: Placed[] = []

  const hasReserve = views.some((v) => !v.goal.deadline)
  const below = FOOT_BAND + (hasReserve ? RESERVE_BAND : 0)
  const ground = Math.max(height - below, Math.min(MIN_PLOT, height))
  const usable = Math.max(ground - HEADROOM, 0)

  for (const view of views) {
    const t = elapsedFraction(view, at)
    if (t === null) {
      reserve.push(view)
      continue
    }
    const w = widthOf(view.weight)
    const centre = t * width
    dated.push({
      view,
      t,
      width: w,
      centre,
      x: centre - w / 2,
      height: view.fraction * usable,
      // Expected progress at x is exactly x, which is what makes the line real.
      lineHeight: t * usable,
      behind: view.behind,
    })
  }

  return {
    dated: resolveOverlaps(dated, width),
    // Heaviest first, so the reserve reads in the same order as the field.
    reserve: reserve.sort((a, b) => b.weight - a.weight),
    ground,
    usable,
  }
}

/**
 * The line, as two points. It runs from the ground at the left edge to full
 * height at the right, because expected progress equals elapsed span.
 */
export const lineOf = (layout: FieldLayout, width: number) => ({
  x1: 0,
  y1: layout.ground,
  x2: width,
  y2: layout.ground - layout.usable,
})
