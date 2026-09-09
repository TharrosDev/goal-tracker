import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useWorldView } from '@/state/useWorldView'
import { SURFACE } from '@/design/marks'
import { value } from '@/domain/format'
import { useFocusTrap } from './focus'
import './palette.css'

/**
 * THE ORDER BOOK — the command palette.
 *
 * One field, one list, no categories and no icons. It searches two things: the
 * places you can go, and the standards you have planted. Selecting a standard
 * takes you to it; there is no separate "search" surface to learn.
 */

interface Command {
  id: string
  label: string
  hint: string
  mark: string
  run: () => void
}

/**
 * The palette mounts when it opens and unmounts when it closes, so it starts
 * empty by construction. Resetting its fields from an effect meant a render
 * spent showing the previous query before clearing it.
 */
export function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <PaletteBody onClose={onClose} /> : null
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const world = useWorldView()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // The field takes the keyboard, Tab stays inside, and closing gives focus
  // back to whatever opened the book.
  useFocusTrap(panel, { onEscape: onClose, initial: input })

  const commands = useMemo<Command[]>(() => {
    const places: Command[] = [
      { to: '/', key: 'warTable' as const },
      { to: '/campaign', key: 'campaign' as const },
      { to: '/dojo', key: 'dojo' as const },
      { to: '/shrine', key: 'shrine' as const },
      { to: '/chronicle', key: 'chronicle' as const },
      { to: '/honours', key: 'honours' as const },
      { to: '/survey', key: 'survey' as const },
      { to: '/quartermaster', key: 'quartermaster' as const },
    ].map(({ to, key }) => ({
      id: `go:${to}`,
      label: SURFACE[key].name,
      hint: 'GO',
      mark: SURFACE[key].mark,
      run: () => navigate(to),
    }))

    const standards: Command[] = world.views
      .filter((v) => !v.goal.archived)
      .map((v) => ({
        id: `open:${v.goal.id}`,
        label: v.goal.title,
        hint: v.goal.target
          ? `${value(v.goal, v.goal.current)} of ${value(v.goal, v.goal.target)}`
          : `${Math.round(v.fraction * 100)}%`,
        mark: SURFACE.standard.mark,
        run: () => navigate(`/standard/${v.goal.id}`),
      }))

    return [
      {
        id: 'new',
        label: 'PLANT A STANDARD',
        hint: 'N',
        mark: SURFACE.standard.mark,
        run: () => navigate('/plant'),
      },
      ...standards,
      ...places,
    ]
  }, [world.views, navigate])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands.slice(0, 9)
    return commands.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 9)
  }, [commands, query])

  // Clamped at read time rather than corrected by an effect: the list can shrink
  // under the cursor on any keystroke.
  const index = Math.min(cursor, Math.max(results.length - 1, 0))

  const choose = (command: Command | undefined) => {
    if (!command) return
    onClose()
    command.run()
  }

  return (
    <div className="palette" role="presentation" onPointerDown={onClose}>
      <div
        ref={panel}
        className="palette__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Order book"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setCursor((c) => (c + 1) % Math.max(results.length, 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setCursor((c) => (c - 1 + results.length) % Math.max(results.length, 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            choose(results[index])
          }
        }}
      >
        <input
          ref={input}
          className="palette__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Give an order"
          aria-label="Give an order"
          aria-controls="palette-results"
          aria-activedescendant={results[index] ? `palette-${results[index].id}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />

        <ul className="palette__results" id="palette-results" role="listbox" aria-label="Orders">
          {results.map((c, i) => (
            <li key={c.id} id={`palette-${c.id}`} role="option" aria-selected={i === index}>
              <button
                type="button"
                className={`palette__row${i === index ? ' is-cursor' : ''}`}
                onClick={() => choose(c)}
                onPointerEnter={() => setCursor(i)}
              >
                <span className="palette__mark" aria-hidden="true">
                  {c.mark}
                </span>
                <span className="palette__label">{c.label}</span>
                <span className="palette__hint">{c.hint}</span>
              </button>
            </li>
          ))}
          {!results.length && (
            <li className="palette__empty">
              <span className="lede">No such order.</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
