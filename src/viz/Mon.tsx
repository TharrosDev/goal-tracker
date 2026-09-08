import { useId } from 'react'
import type { GoalKind, GoalState } from '@/domain/types'
import type { Sigil } from '@/domain/identity'

/**
 * THE MON — a goal's crest, generated rather than drawn. DESIGN.md 7.
 *
 * Everything here is deterministic from what `src/domain/identity.ts` already
 * produces, so a goal's crest is identical on every device, across every export,
 * forever.
 *
 * Kind is carried by the ENCLOSURE's silhouette, not by colour. That is what
 * makes the crest readable in SUMI and KURO, where there is no colour to spend.
 */

const R = 46

/** Regular polygon path, first vertex pointing up. */
function polygon(sides: number, radius = R, rotation = -90): string {
  const points = Array.from({ length: sides }, (_, i) => {
    const a = ((rotation + (360 / sides) * i) * Math.PI) / 180
    return `${(Math.cos(a) * radius).toFixed(2)},${(Math.sin(a) * radius).toFixed(2)}`
  })
  return `M${points.join('L')}Z`
}

const circle = (radius = R): string =>
  `M0,${-radius}A${radius},${radius} 0 1,1 0,${radius}A${radius},${radius} 0 1,1 0,${-radius}Z`

const square = (radius = R): string => {
  const h = radius * 0.86
  return `M${-h},${-h}H${h}V${h}H${-h}Z`
}

/**
 * Ten enclosures, one per goal kind. A person learns these the way they learn
 * road signs: by silhouette, before reading anything.
 */
function enclosure(kind: GoalKind): string {
  switch (kind) {
    case 'money':
      return circle()
    case 'numeric':
      return square()
    case 'percentage':
      return polygon(6)
    case 'habit':
      // A square with its top-right corner cut — a tally mark's notch.
      return `M${-40},${-40}H${22}L${40},${-22}V${40}H${-40}Z`
    case 'streak':
      return `${circle()} ${circle(R * 0.78)}`
    case 'project':
      return polygon(5)
    case 'deadline':
      return polygon(4, R, -90)
    case 'milestone':
      return polygon(3)
    case 'countdown':
      return polygon(8, R, -112.5)
    case 'custom':
      return `${square()} ${circle(R * 0.66)}`
  }
}

/** One ring mark, drawn at the origin and positioned by the caller's rotation. */
function ringMark(shape: Sigil['rings'][number]['shape'], radius: number, index: string) {
  switch (shape) {
    case 'dot':
      return <circle key={index} cx={0} cy={-radius} r={3} />
    case 'bar':
      return <rect key={index} x={-1} y={-radius - 4.5} width={2} height={9} />
    case 'notch':
      return (
        <line
          key={index}
          x1={0}
          y1={-radius - 3}
          x2={0}
          y2={-radius + 3}
          strokeWidth={2}
          strokeLinecap="butt"
        />
      )
  }
}

export function Mon({
  sigil,
  kind,
  state,
  fraction = 0,
  dye,
  size = 44,
  title,
}: {
  sigil: Sigil
  kind: GoalKind
  state: GoalState
  /** 0..1. Fills the enclosure as a secondary reading of progress. */
  fraction?: number
  /** Dye index 0-5. */
  dye: number
  size?: number
  /** Accessible name. Omit inside a labelled control, where it would repeat. */
  title?: string
}) {
  const id = useId()
  const clipId = `mon-fill-${id}`
  const colour =
    state === 'stalled' || state === 'paused' ? 'var(--state-stalled)' : `var(--dye-${dye + 1})`
  const path = enclosure(kind)

  return (
    <svg
      className={`mon mon--${state}`}
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={clipId}>
          {/* Fills from the bottom, like the standard's own cloth. */}
          <rect x={-50} y={50 - 100 * fraction} width={100} height={100 * fraction} />
        </clipPath>
      </defs>

      {/* Progress, as a wash inside the enclosure. Secondary: the standard's
          height is the primary reading, so this never has to carry alone. */}
      {fraction > 0 && (
        <path d={path} fill="var(--ink)" opacity={0.18} clipPath={`url(#${clipId})`} />
      )}

      <path
        d={path}
        fill="none"
        stroke={colour}
        strokeWidth={2}
        strokeDasharray={state === 'new' ? '4 3' : undefined}
        vectorEffect="non-scaling-stroke"
      />

      {/* CRITICAL doubles the enclosure rather than reddening it, so the state
          survives KURO, where every state token is a grey. */}
      {state === 'critical' && (
        <path
          d={enclosure(kind)}
          fill="none"
          stroke="var(--state-critical)"
          strokeWidth={1}
          transform="scale(1.12)"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* PAUSED removes the marks entirely, leaving the enclosure and the empty
          lacing holes: a camp struck, not abandoned. */}
      {state !== 'paused' && (
        <g fill={colour} stroke={colour}>
          {sigil.rings.map((ring, r) =>
            Array.from({ length: ring.count }, (_, i) => (
              <g key={`${r}-${i}`} transform={`rotate(${ring.rotation + (360 / ring.count) * i})`}>
                {ringMark(ring.shape, ring.radius * 40, `${r}-${i}`)}
              </g>
            )),
          )}
        </g>
      )}

      {state === 'paused' && (
        <g fill="none" stroke={colour} strokeWidth={1} opacity={0.7}>
          {sigil.rings
            .slice(0, 1)
            .map((ring, r) =>
              Array.from({ length: ring.count }, (_, i) => (
                <circle
                  key={`hole-${r}-${i}`}
                  cx={
                    Math.cos(((ring.rotation + (360 / ring.count) * i - 90) * Math.PI) / 180) *
                    ring.radius *
                    40
                  }
                  cy={
                    Math.sin(((ring.rotation + (360 / ring.count) * i - 90) * Math.PI) / 180) *
                    ring.radius *
                    40
                  }
                  r={2.5}
                />
              )),
            )}
        </g>
      )}

      {/* Difficulty, at the crest's core. */}
      <circle r={sigil.weight * 9} fill={colour} />

      {/* The seal. Struck across the lower right, at 22 degrees, on completion. */}
      {state === 'completed' && (
        <g transform="rotate(22) translate(6 18)">
          <rect
            x={-16}
            y={-11}
            width={32}
            height={22}
            fill="none"
            stroke="var(--caution)"
            strokeWidth={3}
          />
          <line x1={-10} y1={0} x2={10} y2={0} stroke="var(--caution)" strokeWidth={3} />
        </g>
      )}
    </svg>
  )
}
