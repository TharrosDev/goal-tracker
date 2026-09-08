import { useEffect, useState } from 'react'
import { useWorld } from '@/state/world'
import './undo.css'

/**
 * UNDO.
 *
 * Striking a standard from the field is the only irreversible thing this
 * product does, so it is not irreversible: `repo.deleteGoal` hands back every
 * row it removed — the goal, its gates, its dispatches, its whole chronicle —
 * and this puts them back exactly.
 *
 * The window is generous on purpose. A confirm dialog asks you to be certain
 * before you have seen the result; an undo lets you look at what happened and
 * change your mind, which is the better trade for something you cannot rebuild
 * from memory.
 */
const WINDOW_MS = 20_000

export function Undo() {
  const trash = useWorld((s) => s.lastTrash)
  return trash ? <UndoBar key={trash.goal.id} /> : null
}

function UndoBar() {
  const trash = useWorld((s) => s.lastTrash)!
  const undoDelete = useWorld((s) => s.undoDelete)
  const forget = useWorld((s) => s.forgetTrash)
  const [remaining, setRemaining] = useState(WINDOW_MS)

  useEffect(() => {
    const started = performance.now()
    const tick = setInterval(() => {
      const left = WINDOW_MS - (performance.now() - started)
      if (left <= 0) forget()
      else setRemaining(left)
    }, 250)
    return () => clearInterval(tick)
  }, [forget])

  const counts = [
    `${trash.entries.length} dispatch${trash.entries.length === 1 ? '' : 'es'}`,
    trash.milestones.length ? `${trash.milestones.length} gates` : null,
    trash.children.length ? `${trash.children.length} detachments freed` : null,
  ].filter(Boolean)

  return (
    <div className="undo" role="alert">
      <span
        className="undo__clock"
        style={{ '--left': remaining / WINDOW_MS } as React.CSSProperties}
        aria-hidden="true"
      />
      <span className="undo__line">
        <b>{trash.goal.title}</b> struck from the field — {counts.join(', ')} with it.
      </span>
      <button type="button" className="undo__go" onClick={() => void undoDelete()}>
        PUT IT BACK
      </button>
      <button type="button" className="undo__dismiss" onClick={forget} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
