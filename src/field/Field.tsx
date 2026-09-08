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
 * Interaction model: a listbox. Arrow keys walk the standards in field order,
 * Enter opens, and the selected standard is announced with a full sentence, so
 * the spatial reading has a real equivalent rather than a summary of one.
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
    }
  }

  const line = lineOf(layout, size.width)
  const ready = size.width > 0

  return (
    <div className="field" ref={ref} onKeyDown={onKeyDown}>
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

      <ul
        className="field__standards"
        role="listbox"
        aria-label="Standards, left to right by how far each is through its own span"
        aria-activedescendant={selectedId ?? undefined}
        style={{ height: `${layout.ground}px` }}
      >
        {layout.dated.map((placed) => (
          <Standard
            key={placed.view.goal.id}
            placed={placed}
            selected={placed.view.goal.id === selectedId}
            onSelect={() => onSelect(placed.view.goal.id)}
            onOpen={() => onOpen(placed.view.goal.id)}
            tabIndex={placed.view.goal.id === selectedId ? 0 : -1}
          />
        ))}
      </ul>

      {layout.reserve.length > 0 && (
        <div className="field__reserve" style={{ minHeight: `${RESERVE_BAND}px` }}>
          <span className="label">RESERVE — NOT ON A CLOCK</span>
          <ul>
            {layout.reserve.map((v) => (
              <li key={v.goal.id}>
                <button
                  type="button"
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
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
