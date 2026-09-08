import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useWorld } from '@/state/world'
import { useWorldView } from '@/state/useWorldView'
import type { GoalView } from '@/state/selectors'
import { Mon } from '@/viz/Mon'
import { SURFACE } from '@/design/marks'
import { value } from '@/domain/format'
import './govern.css'

/**
 * GOVERNING A STANDARD — everything about it that is not a dispatch.
 *
 * These are all mutations the repository has always had and nothing could
 * reach: gates after planting, ties to other standards, notes, recurrence,
 * archiving, and striking it from the field.
 *
 * It is collapsed by default. The standard's own ground is for reading where you
 * stand; this is for changing what the thing IS, which is a rarer act and should
 * not compete with the figure.
 */
export function Govern({ view }: { view: GoalView }) {
  const navigate = useNavigate()
  const world = useWorldView()
  const patchGoal = useWorld((s) => s.patchGoal)
  const addMilestone = useWorld((s) => s.addMilestone)
  const removeMilestone = useWorld((s) => s.removeMilestone)
  const toggleLink = useWorld((s) => s.toggleLink)
  const deleteGoal = useWorld((s) => s.deleteGoal)

  const { goal } = view
  const [open, setOpen] = useState(false)
  const [gate, setGate] = useState('')
  const [gateAt, setGateAt] = useState('')
  const [notes, setNotes] = useState(goal.notes)

  const others = world.views.filter((v) => v.goal.id !== goal.id && !v.goal.archived)

  const submitGate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gate.trim()) return
    await addMilestone(goal.id, gate, gateAt === '' ? null : Number(gateAt))
    setGate('')
    setGateAt('')
  }

  return (
    <section className="govern">
      <button
        type="button"
        className="govern__toggle label"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? '−' : '+'} GOVERN THIS STANDARD
      </button>

      {open && (
        <div className="govern__body">
          {/* ── gates ─────────────────────────────────────────────────────── */}
          <div className="govern__block">
            <p className="label">{SURFACE.gate.name}S</p>
            {view.milestones.length > 0 && (
              <ul className="govern__gates">
                {view.milestones.map((m) => (
                  <li key={m.id}>
                    <span className={m.done ? 'is-passed' : undefined}>{m.title}</span>
                    {m.at !== null && <span className="num">{value(goal, m.at)}</span>}
                    <button
                      type="button"
                      onClick={() => void removeMilestone(m.id)}
                      aria-label={`Remove the gate ${m.title}`}
                    >
                      REMOVE
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form className="govern__row" onSubmit={submitGate}>
              <input
                value={gate}
                onChange={(e) => setGate(e.target.value)}
                placeholder="Name a gate"
                aria-label="New gate"
              />
              {goal.target !== null && (
                <input
                  className="num"
                  type="number"
                  step="any"
                  value={gateAt}
                  onChange={(e) => setGateAt(e.target.value)}
                  placeholder="at"
                  aria-label="Value at which this gate is passed"
                />
              )}
              <button type="submit">ADD</button>
            </form>
            <p className="govern__note">
              A gate with a value is crossed automatically by the dispatch that reaches it.
            </p>
          </div>

          {/* ── ties ──────────────────────────────────────────────────────── */}
          {others.length > 0 && (
            <div className="govern__block">
              <p className="label">STANDS WITH</p>
              <ul className="govern__ties">
                {others.map((other) => {
                  const tied = goal.linkedIds.includes(other.goal.id)
                  return (
                    <li key={other.goal.id}>
                      <button
                        type="button"
                        className={tied ? 'is-tied' : undefined}
                        aria-pressed={tied}
                        onClick={() => void toggleLink(goal.id, other.goal.id)}
                      >
                        <Mon
                          sigil={other.sigil}
                          kind={other.goal.kind}
                          state={other.state}
                          fraction={other.fraction}
                          dye={other.dye}
                          size={18}
                        />
                        {other.goal.title}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="govern__note">
                Ties are drawn in the campaign and read out in the roll.
              </p>
            </div>
          )}

          {/* ── recurrence ────────────────────────────────────────────────── */}
          <div className="govern__block">
            <p className="label">A STANDING COMMITMENT</p>
            <div className="govern__row">
              <select
                value={goal.recurrence?.period ?? ''}
                aria-label="How often"
                onChange={(e) =>
                  void patchGoal(goal.id, {
                    recurrence: e.target.value
                      ? {
                          period: e.target.value as 'day' | 'week' | 'month',
                          times: goal.recurrence?.times ?? 3,
                        }
                      : null,
                  })
                }
              >
                <option value="">Not recurring</option>
                <option value="day">Every day</option>
                <option value="week">Every week</option>
                <option value="month">Every month</option>
              </select>
              {goal.recurrence && (
                <input
                  className="num"
                  type="number"
                  min={1}
                  max={100}
                  value={goal.recurrence.times}
                  aria-label="How many times per period"
                  onChange={(e) =>
                    void patchGoal(goal.id, {
                      recurrence: {
                        period: goal.recurrence!.period,
                        times: Number(e.target.value),
                      },
                    })
                  }
                />
              )}
            </div>
            {view.habit && (
              <p className="govern__note">
                {view.habit.done} of {view.habit.target} kept this {view.habit.period}.
              </p>
            )}
          </div>

          {/* ── notes ─────────────────────────────────────────────────────── */}
          <div className="govern__block">
            <p className="label">NOTES</p>
            <textarea
              value={notes}
              rows={4}
              aria-label="Notes"
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== goal.notes && void patchGoal(goal.id, { notes })}
              placeholder="Anything the figure does not say."
            />
          </div>

          {/* ── the field ─────────────────────────────────────────────────── */}
          <div className="govern__block govern__block--strike">
            <p className="label">THE FIELD</p>
            <div className="govern__row">
              <button
                type="button"
                onClick={() => void patchGoal(goal.id, { archived: !goal.archived })}
              >
                {goal.archived ? 'BRING BACK TO THE FIELD' : 'MOVE OUT OF THE FIELD'}
              </button>
              <button
                type="button"
                className="govern__strike"
                onClick={async () => {
                  await deleteGoal(goal.id)
                  navigate('/')
                }}
              >
                STRIKE IT FROM THE FIELD
              </button>
            </div>
            <p className="govern__note">
              Moving it out keeps everything and takes it off the field. Striking it removes the
              standard and its whole chronicle — you get twenty seconds to put it back.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
