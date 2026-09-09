import type { Placed } from './layout'
import { Mon } from '@/viz/Mon'
import { STATE_MARK } from '@/design/marks'
import { staggerIndex } from '@/design/motion'
import { value } from '@/domain/format'

/**
 * A STANDARD — the product's only object. DESIGN.md 9.
 *
 * Every part is a data channel and nothing is ornament: width is weight, pole
 * thickness is priority, cloth height is progress, the top edge is state, the
 * mon is identity, the ticks are gates.
 *
 * The state is carried by FORM first (dashed / solid / doubled / absent), so it
 * survives KURO, where every state token is a grey.
 */
export function Standard({
  placed,
  selected,
  onSelect,
  onOpen,
  compact,
  index,
}: {
  placed: Placed
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  /**
   * The field is too narrow to carry a name under every standard, so the foot
   * is not drawn and the names live in the roll below. Nothing else changes:
   * position is still time, height is still progress, the line is still exact.
   */
  compact: boolean
  /** Position in the field, for the arrival stagger. */
  index: number
}) {
  const { view, width, height, lineHeight } = placed
  const { goal, state, fraction, arrival, sigil, dye, milestones } = view

  const behindBy = placed.behind ? Math.max(lineHeight - height, 0) : 0
  const mark = STATE_MARK[state]

  // Gate ticks sit at each milestone's value threshold, as a share of target.
  const gates = milestones
    .filter((m) => m.at !== null && goal.target)
    .map((m) => ({ id: m.id, done: m.done, at: Math.min(m.at! / goal.target!, 1) }))

  const figure = goal.target
    ? `${value(goal, goal.current)} of ${value(goal, goal.target)}`
    : `${Math.round(fraction * 100)}%`

  return (
    <li
      className={[
        'standard',
        `standard--${state}`,
        // FORM: a standard planted in the last three days is still assembling.
        state === 'new' ? 'form' : '',
        // PRESSURE: amplitude is the real 0..1 deadline pressure, so this is
        // invisible at a distance and unmistakable up close.
        state === 'critical' && view.pressure > 0.35 ? 'pressure' : '',
        // DECAY: gone quiet. The quietest thing on the field, never the loudest.
        state === 'stalled' ? 'decay' : '',
        selected ? 'is-selected' : '',
        compact ? 'standard--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--x': `${placed.x}px`,
          '--w': `${width}px`,
          '--h': `${height}px`,
          '--line': `${lineHeight}px`,
          '--behind': `${behindBy}px`,
          '--pole': `${1 + goal.priority * 0.5}px`,
          '--pressure': view.pressure,
          '--i': staggerIndex(index),
          '--dye': `var(--dye-${dye + 1})`,
          // Katazome is cut per house. The stencil's angle, period and weight
          // come from the goal's own sigil, so two standards in the same dye are
          // still different cloth — and none of them is a grid.
          '--stencil-angle': `${(sigil.symmetry * 37) % 180}deg`,
          '--stencil-period': `${6 + (sigil.rings.length % 3) * 4}px`,
          '--stencil-weight': `${1 + (sigil.symmetry % 3)}px`,
        } as React.CSSProperties
      }
      /*
       * The id the field's `aria-activedescendant` points at. It used to point
       * at the bare goal id, which was on no element in the document — so the
       * listbox announced nothing whatsoever as the arrows walked it.
       *
       * At phone width the name is not here — it is in the roll below — so the
       * OPTION is there too and this pole is a mark. Exactly one option per
       * standard exists in the document at any width.
       */
      {...(compact
        ? { 'aria-hidden': true as const }
        : { id: `standard-${goal.id}`, role: 'option', 'aria-selected': selected })}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      {/* One accessible sentence per standard. A sighted reader gets the same
          information from position and height; this is the equivalent, not a
          summary of it. At phone width it belongs to the roll's option instead,
          so it is not said twice. */}
      <span className="sr-only" hidden={compact}>
        {goal.title}. {mark.name}. {figure}.{' '}
        {arrival ? arrival.text : 'no hour set, held in reserve'}.
        {placed.behind ? ` ${Math.round((view.paceGap ?? 0) * 100)} points behind the line.` : ''}
      </span>

      <div className="standard__pole" aria-hidden="true">
        {gates.map((g) => (
          <i
            key={g.id}
            className={`standard__gate${g.done ? ' is-passed' : ''}`}
            style={{ bottom: `calc(var(--h) * ${g.at} / max(${fraction || 1}, 0.001))` }}
          />
        ))}
      </div>

      {/* The hatch between the cloth top and the line. The only red in the
          field, and it reports a distance rather than a judgement. */}
      {behindBy > 2 && <div className="standard__shortfall" aria-hidden="true" />}

      <div className="standard__cloth" aria-hidden="true">
        <div className="standard__stencil" />
      </div>

      {/* The figure rides above the cloth's head rather than inside it: a
          standard at 3% has no room to print a number on. */}
      <span className="standard__figure num" aria-hidden="true">
        {Math.round(fraction * 100)}
      </span>

      {!compact && (
        <div className="standard__foot" aria-hidden="true">
          <Mon
            sigil={sigil}
            kind={goal.kind}
            state={state}
            fraction={fraction}
            dye={dye}
            size={34}
          />
          <span className="standard__title">{goal.title}</span>
          <span className="standard__arrival">{arrival ? arrival.text : sigil.callsign}</span>
        </div>
      )}
    </li>
  )
}
