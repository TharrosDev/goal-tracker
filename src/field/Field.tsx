import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GoalView } from '@/state/selectors'
import { layoutField, lineOf, RESERVE_BAND } from './layout'
import { Standard } from './Standard'
import { Mon } from '@/viz/Mon'
import { today } from '@/domain/date'
import './field.css'

/**
 * THE FIELD.
 *
 * One continuous space. Time runs left to right as elapsed span, progress rises
 * from the ground, and a single diagonal shows where every standard should be by
 * now. There is no panel here to delete — every element is a position, a height
 * or a force.
 *
 * INTERACTION MODEL: one listbox over the WHOLE field.
 *
 * Not one over the standards and a set of loose buttons under it, which is what
 * it was. Arrow keys walked into the reserve while focus stayed behind in the
 * plot, so the thing that was selected and the thing that Enter opened were two
 * different standards — and `aria-activedescendant` pointed at an id that was
 * on no element in the document, so a screen reader was told nothing at all.
 *
 * The container holds focus; the options never take it. That is the pattern
 * `aria-activedescendant` exists for, and it is what lets the reserve and the
 * plot be one selection even though they are two places on the screen.
 */
export function Field({
  views,
  selectedId,
  onSelect,
  onOpen,
}: {
  views: GoalView[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpen: (id: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect
      if (box) setSize({ width: box.width, height: box.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const at = today()
  const layout = useMemo(
    () => layoutField(views, { width: size.width, height: size.height, at }),
    [views, size.width, size.height, at],
  )

  /** Field order: dated left to right, then the reserve. */
  const order = useMemo(
    () => [...layout.dated.map((p) => p.view.goal.id), ...layout.reserve.map((v) => v.goal.id)],
    [layout],
  )

  const move = useCallback(
    (delta: number) => {
      if (!order.length) return
      const current = selectedId ? order.indexOf(selectedId) : -1
      const next = current < 0 ? (delta > 0 ? 0 : order.length - 1) : current + delta
      onSelect(order[Math.max(0, Math.min(next, order.length - 1))] ?? null)
    },
    [order, selectedId, onSelect],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        break
      case 'Home':
        e.preventDefault()
        onSelect(order[0] ?? null)
        break
      case 'End':
        e.preventDefault()
        onSelect(order.at(-1) ?? null)
        break
      case 'Enter':
      case ' ':
        // Opens whatever is SELECTED, which is now always the same thing the
        // arrows moved to, wherever on the field it happens to stand.
        if (!selectedId) return
        e.preventDefault()
        onOpen(selectedId)
        break
    }
  }

  const line = lineOf(layout, size.width)
  const ready = size.width > 0

  return (
    <div
      className={`field${layout.compact ? ' field--compact' : ''}`}
      ref={ref}
      // The listbox is the whole field, and it is what takes the keyboard. It
      // is reachable on a cold load, before anything has been selected, which
      // it was not when every option carried tabIndex -1 until one was.
      role="listbox"
      tabIndex={0}
      aria-label="Standards, left to right by how far each is through its own span. Arrow keys walk the field; Enter opens."
      aria-activedescendant={selectedId ? `standard-${selectedId}` : undefined}
      onKeyDown={onKeyDown}
    >
      {/* The scale. Real marks at real positions — the field is an instrument,
          and an instrument that hides its scale is a decoration. */}
      <div className="field__scale" aria-hidden="true">
        <span className="label">PLANTED</span>
        <span className="label field__scale-mid">ELAPSED SPAN</span>
        <span className="label">THE HOUR</span>
        {ready &&
          layout.dated.map((p) => (
            <i key={p.view.goal.id} className="field__datum" style={{ left: `${p.centre}px` }} />
          ))}
      </div>

      {ready && (
        <svg className="field__rules" aria-hidden="true" width={size.width} height={size.height}>
          {/* THE LINE. Expected progress equals elapsed span, so this is exact. */}
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="var(--rule-strong)"
            strokeWidth={1}
          />
          {/* THE GROUND. */}
          <line
            x1={0}
            y1={layout.ground}
            x2={size.width}
            y2={layout.ground}
            stroke="var(--rule-strong)"
            strokeWidth={1}
          />
        </svg>
      )}

      {/* Presentational: the options belong to the field, not to this list. */}
      <ul className="field__standards" role="presentation" style={{ height: `${layout.ground}px` }}>
        {layout.dated.map((placed, i) => (
          <Standard
            key={placed.view.goal.id}
            index={i}
            placed={placed}
            compact={layout.compact}
            selected={placed.view.goal.id === selectedId}
            onSelect={() => onSelect(placed.view.goal.id)}
            onOpen={() => onOpen(placed.view.goal.id)}
          />
        ))}
      </ul>

      {!layout.compact && layout.reserve.length > 0 && (
        <div className="field__reserve" style={{ minHeight: `${RESERVE_BAND}px` }}>
          <span className="label" aria-hidden="true">
            RESERVE — NOT ON A CLOCK
          </span>
          <ul role="presentation">
            {layout.reserve.map((v) => (
              <li
                key={v.goal.id}
                id={`standard-${v.goal.id}`}
                role="option"
                aria-selected={v.goal.id === selectedId}
                className={`reserve__item${v.goal.id === selectedId ? ' is-selected' : ''}`}
                onClick={() => onSelect(v.goal.id)}
                onDoubleClick={() => onOpen(v.goal.id)}
              >
                <Mon
                  sigil={v.sigil}
                  kind={v.goal.kind}
                  state={v.state}
                  fraction={v.fraction}
                  dye={v.dye}
                  size={22}
                />
                <span className="reserve__title">{v.goal.title}</span>
                <span className="reserve__figure num">{Math.round(v.fraction * 100)}%</span>
                <span className="sr-only">In reserve, on no clock.</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        THE ROLL OF THE FIELD.

        Only at phone width. The names have come out from under the standards so
        the poles can stand close enough together to still be a field, and this
        is where they went — in the field's own order, left to right, with the
        reserve after them exactly as the arrow keys walk it. The plot and the
        list are the same reading twice, and the mon is what ties one to the
        other.

        These carry the option role at this width, because they are where the
        names are; the poles above are then presentational marks. There is still
        exactly one option per standard in the document.
      */}
      {layout.compact && order.length > 0 && (
        <ol
          className="field__roll"
          role="presentation"
          style={{ height: `${layout.rollBand}px` }}
        >
          {[...layout.dated.map((p) => p.view), ...layout.reserve].map((v) => (
            <li
              key={v.goal.id}
              id={`standard-${v.goal.id}`}
              role="option"
              aria-selected={v.goal.id === selectedId}
              className={`field__named${v.goal.id === selectedId ? ' is-selected' : ''}`}
              onClick={() => onSelect(v.goal.id)}
              onDoubleClick={() => onOpen(v.goal.id)}
            >
              <Mon
                sigil={v.sigil}
                kind={v.goal.kind}
                state={v.state}
                fraction={v.fraction}
                dye={v.dye}
                size={20}
              />
              <span className="field__named-title">{v.goal.title}</span>
              <span className="field__named-figure num">{Math.round(v.fraction * 100)}</span>
              <span className="field__named-hour label">
                {v.arrival ? v.arrival.text : 'RESERVE'}
              </span>
              {/* The same sentence the standard carries at full width. */}
              <span className="sr-only">
                {Math.round(v.fraction * 100)} per cent.{' '}
                {v.arrival ? v.arrival.text : 'No hour set, held in reserve'}.
                {v.behind ? ` ${Math.round((v.paceGap ?? 0) * 100)} points behind the line.` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
