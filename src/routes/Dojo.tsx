import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useWorld } from '@/state/world'
import { useWorldView } from '@/state/useWorldView'
import { Mon } from '@/viz/Mon'
import { SURFACE } from '@/design/marks'
import { value } from '@/domain/format'
import './dojo.css'

/**
 * THE DOJO (道場) — one opponent, one technique, nothing else in the room.
 *
 * Everything the rest of the product does is removed here: no rail, no field,
 * no chronicle, no wind. One standard, its next gate, a clock if you want one,
 * and a single field to record what you did. Escape is the way out.
 *
 * The clock is a stopwatch, not a countdown, and it is optional. Nothing here
 * pressures anybody; a session that ends after four minutes is a session.
 */
export function Dojo() {
  const world = useWorldView()
  const navigate = useNavigate()
  const logProgress = useWorld((s) => s.logProgress)
  const setMilestoneDone = useWorld((s) => s.setMilestoneDone)

  const candidates = world.live
  const [id, setId] = useState<string | null>(world.headline?.goal.id ?? null)
  const chosen =
    candidates.find((v) => v.goal.id === (id ?? world.headline?.goal.id)) ?? candidates[0]

  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [amount, setAmount] = useState('')
  const started = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    started.current = performance.now() - elapsed * 1000
    const tick = setInterval(() => {
      if (started.current !== null) setElapsed((performance.now() - started.current) / 1000)
    }, 250)
    return () => clearInterval(tick)
    // `elapsed` is deliberately not a dependency: including it restarts the
    // interval on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const clock = useMemo(() => {
    const total = Math.floor(elapsed)
    const m = String(Math.floor(total / 60)).padStart(2, '0')
    const s = String(total % 60).padStart(2, '0')
    return `${m}:${s}`
  }, [elapsed])

  if (!chosen)
    return (
      <div className="dojo dojo--empty">
        <span className="dojo__mark" aria-hidden="true">
          {SURFACE.dojo.mark}
        </span>
        <h1 className="mega">THE ROOM IS EMPTY</h1>
        <p className="lede">Nothing is standing to work on. Plant a standard first.</p>
        <button type="button" className="dojo__leave" onClick={() => navigate('/plant')}>
          PLANT ONE
        </button>
      </div>
    )

  const gate = chosen.nextMilestone
  const quantified = chosen.goal.target !== null

  const record = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number(amount)
    if (!Number.isFinite(n) || n === 0) return
    const note = elapsed > 30 ? `${clock} in the dojo` : ''
    await logProgress(chosen.goal.id, n, { note })
    setAmount('')
    setRunning(false)
    setElapsed(0)
  }

  return (
    <div className="dojo">
      <header className="dojo__head">
        <label className="dojo__pick">
          <span className="sr-only">Which standard</span>
          <select value={chosen.goal.id} onChange={(e) => setId(e.target.value)}>
            {candidates.map((v) => (
              <option key={v.goal.id} value={v.goal.id}>
                {v.goal.title}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="dojo__leave" onClick={() => navigate('/')}>
          LEAVE — ESC
        </button>
      </header>

      <div className="dojo__centre">
        <Mon
          sigil={chosen.sigil}
          kind={chosen.goal.kind}
          state={chosen.state}
          fraction={chosen.fraction}
          dye={chosen.dye}
          size={92}
        />
        <h1 className="display dojo__title">{chosen.goal.title}</h1>

        {gate ? (
          <p className="dojo__gate">
            <span className="label">THE NEXT GATE</span>
            <span className="dojo__gate-title">{gate.title}</span>
            <button type="button" onClick={() => void setMilestoneDone(gate.id, true)}>
              PASSED IT
            </button>
          </p>
        ) : (
          <p className="lede dojo__one">
            {chosen.goal.definitionOfDone ||
              (quantified
                ? `${value(chosen.goal, chosen.remaining ?? 0)} left to reach ${value(chosen.goal, chosen.goal.target!)}.`
                : 'One thing. Do some of it.')}
          </p>
        )}

        <div className="dojo__clock">
          <p className="mega num dojo__time" aria-live="off">
            {clock}
          </p>
          <div className="dojo__clock-actions">
            <button type="button" onClick={() => setRunning((r) => !r)}>
              {running ? 'HOLD' : elapsed > 0 ? 'CONTINUE' : 'BEGIN'}
            </button>
            {elapsed > 0 && (
              <button
                type="button"
                onClick={() => {
                  setRunning(false)
                  setElapsed(0)
                }}
              >
                RESET
              </button>
            )}
          </div>
        </div>

        {quantified && (
          <form className="dojo__record" onSubmit={record}>
            <label>
              <span className="label">
                WHAT DID YOU DO{chosen.goal.unit ? ` (${chosen.goal.unit})` : ''}
              </span>
              <input
                className="dojo__amount num"
                type="number"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </label>
            <button type="submit">RECORD IT</button>
          </form>
        )}
      </div>
    </div>
  )
}
