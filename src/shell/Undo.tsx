import { useEffect, useState } from 'react'
import { useWorld } from '@/state/world'
import './undo.css'

/**
 * TAKING IT BACK.
 *
 * Two acts in this product cannot be repaired by doing something else
 * afterwards, so both of them are offered back:
 *
 * STRIKING A STANDARD is the only destructive thing here, so it is not
 * destructive: `repo.deleteGoal` hands back every row it removed — the goal,
 * its gates, its dispatches, its whole chronicle — and this puts them back
 * exactly.
 *
 * A DISPATCH is the most common act in the product and it had no way back at
 * all. `repo.undoEntry` reverses the complete causal result of one — the
 * figure, the gates it crossed, the completion it made, the merit it paid and
 * the honours it earned — and until now nothing in the interface could reach
 * it. A number typed into the wrong standard is the single easiest mistake to
 * make here, and the ceremony fires either way.
 *
 * Both windows are generous on purpose. A confirm dialog asks you to be certain
 * before you have seen the result; an undo lets you look at what happened and
 * change your mind, which is the better trade for something you cannot rebuild
 * from memory. The dispatch's window is the shorter of the two: it closes on
 * its own so that an undo nobody meant to reach is never one stray click away
 * an hour later.
 */
const STRUCK_MS = 20_000
const DISPATCH_MS = 12_000

export function Undo() {
  const trash = useWorld((s) => s.lastTrash)
  const dispatch = useWorld((s) => s.lastDispatch)

  // A strike is the bigger thing, and the two bars share a corner. Whichever is
  // more consequential holds it.
  if (trash) return <StruckBar key={trash.goal.id} />
  if (dispatch) return <DispatchBar key={dispatch.entryId} />
  return null
}

/** The window, drawn rather than counted down in words. */
function useClosing(window: number, onClose: () => void) {
  const [left, setLeft] = useState(1)
  useEffect(() => {
    const started = performance.now()
    const tick = setInterval(() => {
      const remaining = window - (performance.now() - started)
      if (remaining <= 0) onClose()
      else setLeft(remaining / window)
    }, 250)
    return () => clearInterval(tick)
  }, [window, onClose])
  return left
}

function StruckBar() {
  const trash = useWorld((s) => s.lastTrash)!
  const undoDelete = useWorld((s) => s.undoDelete)
  const forget = useWorld((s) => s.forgetTrash)
  const left = useClosing(STRUCK_MS, forget)

  const counts = [
    `${trash.entries.length} dispatch${trash.entries.length === 1 ? '' : 'es'}`,
    trash.milestones.length ? `${trash.milestones.length} gates` : null,
    trash.children.length ? `${trash.children.length} detachments freed` : null,
  ].filter(Boolean)

  return (
    <div className="undo" role="alert">
      <span
        className="undo__clock"
        style={{ '--left': left } as React.CSSProperties}
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

function DispatchBar() {
  const last = useWorld((s) => s.lastDispatch)!
  const undoLast = useWorld((s) => s.undoLastDispatch)
  const forget = useWorld((s) => s.forgetDispatch)
  const left = useClosing(DISPATCH_MS, forget)

  return (
    <div className="undo undo--dispatch">
      <span
        className="undo__clock"
        style={{ '--left': left } as React.CSSProperties}
        aria-hidden="true"
      />
      <span className="undo__line">
        Recorded against <b>{last.title}</b>.
      </span>
      {/*
        Named for what it actually reverses. A dispatch that crossed a gate or
        took a standard undoes that too, and somebody about to press this should
        not have to guess how far it reaches.
      */}
      <button
        type="button"
        className="undo__go undo__go--quiet"
        onClick={() => void undoLast()}
        aria-label={`Take back the dispatch against ${last.title}, and everything it caused`}
      >
        TAKE IT BACK
      </button>
      <button type="button" className="undo__dismiss" onClick={forget} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
