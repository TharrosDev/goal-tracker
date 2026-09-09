import { useMemo, useRef, useState } from 'react'
import { useWorld } from '@/state/world'
import { useWorldView } from '@/state/useWorldView'
import { SURFACE } from '@/design/marks'
import { value } from '@/domain/format'
import type { LogResult } from '@/data/repo'
import { useFocusTrap } from './focus'
import './dispatch.css'

/**
 * A DISPATCH (報) — logging progress.
 *
 * This is the hot path and the product dies without it: if logging is not
 * cheaper than skipping it, the data goes stale and nothing else here matters.
 * So it is one field, already focused, with the standard preselected, and it
 * closes on submit. No ceremony is allowed to slow it down.
 */
export function Dispatch({
  open,
  goalId,
  onClose,
  onLogged,
}: {
  open: boolean
  /** Preselected standard. Falls back to the one whose hour is nearest. */
  goalId?: string | null
  onClose: () => void
  onLogged: (result: LogResult) => void
}) {
  // Mounts on open, so the amount field starts empty by construction rather
  // than being cleared by an effect a render later.
  return open ? <DispatchBody goalId={goalId} onClose={onClose} onLogged={onLogged} /> : null
}

function DispatchBody({
  goalId,
  onClose,
  onLogged,
}: {
  goalId?: string | null
  onClose: () => void
  onLogged: (result: LogResult) => void
}) {
  const world = useWorldView()
  const logProgress = useWorld((s) => s.logProgress)
  const setMilestoneDone = useWorld((s) => s.setMilestoneDone)
  const completeGoal = useWorld((s) => s.completeGoal)

  const candidates = useMemo(() => world.live.filter((v) => v.state !== 'completed'), [world.live])
  const fallback = world.urgent?.goal.id ?? candidates[0]?.goal.id ?? null

  const [target, setTarget] = useState<string | null>(goalId ?? fallback)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLFormElement>(null)

  // Escape closes the sheet from anywhere inside it, including from the amount
  // field — which is where a person's hands already are, and which the shell's
  // own global handler could not reach because this sheet is opened from a
  // standard's own ground as well as from the shell.
  useFocusTrap(panel, { onEscape: onClose, initial: field })

  const view = candidates.find((v) => v.goal.id === target) ?? null
  const quantified = view?.goal.target !== null && view?.goal.target !== undefined

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!view || busy) return
    setBusy(true)
    try {
      if (!quantified) {
        // A binary standard has nothing to count: taking it IS the dispatch.
        await completeGoal(view.goal.id)
        onClose()
        return
      }
      const n = Number(amount)
      if (!Number.isFinite(n) || n === 0) return
      const result = await logProgress(view.goal.id, n)
      onLogged(result)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dispatch" role="presentation" onPointerDown={onClose}>
      <form
        ref={panel}
        className="dispatch__panel"
        onSubmit={submit}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Log a dispatch"
      >
        <p className="label">
          <span className="dispatch__mark" aria-hidden="true">
            {SURFACE.dispatch.mark}
          </span>
          {SURFACE.dispatch.name}
        </p>

        <label className="dispatch__field">
          <span className="label">STANDARD</span>
          <select
            value={target ?? ''}
            onChange={(e) => setTarget(e.target.value)}
            className="dispatch__select"
          >
            {candidates.map((v) => (
              <option key={v.goal.id} value={v.goal.id}>
                {v.goal.title}
              </option>
            ))}
          </select>
        </label>

        {quantified && view ? (
          <label className="dispatch__field">
            <span className="label">AMOUNT{view.goal.unit ? ` (${view.goal.unit})` : ''}</span>
            <input
              ref={field}
              className="dispatch__amount num"
              type="number"
              step="any"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
            />
            <span className="dispatch__standing">
              {value(view.goal, view.goal.current)} of {value(view.goal, view.goal.target!)}
              {view.remaining ? ` · ${value(view.goal, view.remaining)} to go` : ''}
            </span>
          </label>
        ) : (
          <p className="lede">Nothing to count on this one. Sending the dispatch takes it.</p>
        )}

        {view && view.milestones.some((m) => !m.done) && (
          <fieldset className="dispatch__gates">
            <legend className="label">{SURFACE.gate.name}</legend>
            {view.milestones
              .filter((m) => !m.done)
              .slice(0, 4)
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="dispatch__gate"
                  onClick={() => void setMilestoneDone(m.id, true)}
                >
                  {m.title}
                </button>
              ))}
          </fieldset>
        )}

        <div className="dispatch__actions">
          <button type="button" className="dispatch__cancel" onClick={onClose}>
            CANCEL
          </button>
          <button type="submit" className="dispatch__send" disabled={busy || !view}>
            {quantified ? 'SEND' : 'TAKE IT'}
          </button>
        </div>
      </form>
    </div>
  )
}
