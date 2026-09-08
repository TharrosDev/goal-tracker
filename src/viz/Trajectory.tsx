import { useId } from 'react'
import type { GoalView } from '@/state/selectors'
import { days } from '@/domain/date'
import type { ISODate } from '@/domain/types'
import { applyEntry } from '@/domain/progress'

/**
 * THE STANDARD'S OWN STORY.
 *
 * Cumulative progress plotted against the same line the field uses, so the two
 * surfaces agree. Every point is a real dispatch — there is no smoothing, no
 * interpolation and no invented sample. A flat stretch IS a flat stretch, and
 * the gaps are the story: this is where the eighteen quiet days show up.
 */
export function Trajectory({
  view,
  at,
  height = 180,
}: {
  view: GoalView
  at: ISODate
  height?: number
}) {
  const id = useId()
  const { goal, entries } = view
  const target = goal.target ?? 0

  const span = goal.deadline ? days(goal.startDate, goal.deadline) : days(goal.startDate, at)
  if (!target || span <= 0 || entries.length === 0) return null

  // Oldest first, replaying the ledger exactly the way recomputeCurrent does —
  // including 'set' entries, which is why this is a fold and not a running sum.
  const ordered = [...entries].sort((a, b) => a.at.localeCompare(b.at))
  const points: { day: number; value: number }[] = []
  for (const e of ordered) {
    const previous = points.at(-1)?.value ?? 0
    points.push({
      day: days(goal.startDate, e.at.slice(0, 10)),
      value: applyEntry({ ...goal, current: previous }, e),
    })
  }

  const W = 100
  const H = 100
  const x = (day: number) => Math.max(0, Math.min((day / span) * W, W))
  const y = (v: number) => H - Math.max(0, Math.min(v / target, 1)) * H

  // Starts at the origin: a standard begins at nothing, on the day it was planted.
  const path =
    `M${x(0)},${y(0)}` +
    points.map((p) => `L${x(p.day).toFixed(2)},${y(p.value).toFixed(2)}`).join('')

  const todayX = x(days(goal.startDate, at))
  const behind = view.behind

  return (
    <figure className="trajectory">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        height={height}
        width="100%"
        role="img"
        aria-label={`Trajectory: ${points.length} dispatches, currently ${Math.round(view.fraction * 100)} per cent with ${Math.round((view.paceGap ?? 0) * 100)} points ${behind ? 'behind' : 'ahead of'} the line`}
      >
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={`var(--dye-${view.dye + 1})`} stopOpacity="0.05" />
            <stop offset="100%" stopColor={`var(--dye-${view.dye + 1})`} stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* THE LINE, identical in meaning to the field's. */}
        <line
          x1={0}
          y1={H}
          x2={W}
          y2={0}
          stroke="var(--rule-strong)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />

        {/* Today. Everything right of it has not happened. */}
        <line
          x1={todayX}
          y1={0}
          x2={todayX}
          y2={H}
          stroke="var(--rule)"
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />

        <path d={`${path}L${x(points.at(-1)!.day)},${H}L${x(0)},${H}Z`} fill={`url(#fill-${id})`} />
        <path
          d={path}
          fill="none"
          stroke={behind ? 'var(--caution)' : `var(--dye-${view.dye + 1})`}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/*
          Each dispatch, as a tick on the floor. The gaps between them are the
          story — this is where eighteen quiet days show up.

          Ticks rather than dots because the viewBox is stretched to the
          container (preserveAspectRatio="none"), which turns a circle into an
          ellipse and a cluster of them into a smear. An axis-aligned line with a
          non-scaling stroke survives the stretch intact.
        */}
        {points.map((p, i) => (
          <line
            key={i}
            x1={x(p.day)}
            y1={H}
            x2={x(p.day)}
            y2={H - 6}
            stroke="var(--ink-dim)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <figcaption className="label">
        PLANTED · {points.length} DISPATCHES · {goal.deadline ? 'THE HOUR' : 'TODAY'}
      </figcaption>
    </figure>
  )
}
