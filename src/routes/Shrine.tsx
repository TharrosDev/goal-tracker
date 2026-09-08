import { useNavigate } from 'react-router'
import { useWorldView } from '@/state/useWorldView'
import { useWorld } from '@/state/world'
import { staggerIndex } from '@/design/motion'
import { Mon } from '@/viz/Mon'
import { SURFACE } from '@/design/marks'
import { dayOf, days, fmtDate } from '@/domain/date'
import { value } from '@/domain/format'
import { records } from '@/domain/history'
import './surface.css'

/**
 * THE SHRINE (社) — where taken standards are kept.
 *
 * Not a grey archive. A standard that was taken keeps its crest, its dates, its
 * span and its final figure, and it keeps them permanently, because the fact
 * that it was hard and it took eight months is the part worth keeping.
 */
export function Shrine() {
  const world = useWorldView()
  const goals = useWorld((s) => s.goals)
  const entries = useWorld((s) => s.entries)
  const events = useWorld((s) => s.events)
  const navigate = useNavigate()

  const taken = world.completed
  const personalRecords = records(goals, entries, events)

  if (!taken.length)
    return (
      <div className="surface surface--empty">
        <span className="surface__mark" aria-hidden="true">
          {SURFACE.shrine.mark}
        </span>
        <h1 className="mega">
          THE SHRINE
          <br />
          IS BARE
        </h1>
        <p className="lede">
          Nothing has been taken yet. The first standard you finish is enshrined here with its whole
          span — the date it was planted, the date it was taken, and everything in between.
        </p>
      </div>
    )

  return (
    <div className="surface enter">
      <header className="surface__head">
        <div>
          <p className="label">{SURFACE.shrine.name}</p>
          <h1 className="h1">{taken.length} TAKEN</h1>
        </div>
      </header>

      <ul className="shrine stagger">
        {taken.map((v, i) => {
          const span =
            v.goal.completedAt !== null
              ? days(v.goal.startDate, dayOf(v.goal.completedAt))
              : v.daysAlive
          const early =
            v.goal.deadline && v.goal.completedAt
              ? days(dayOf(v.goal.completedAt), v.goal.deadline)
              : null
          const merit = events.filter((e) => e.goalId === v.goal.id).reduce((s, e) => s + e.xp, 0)

          return (
            <li
              key={v.goal.id}
              className="monument"
              style={{ '--i': staggerIndex(i) } as React.CSSProperties}
            >
              <button type="button" onClick={() => navigate(`/standard/${v.goal.id}`)}>
                <Mon
                  sigil={v.sigil}
                  kind={v.goal.kind}
                  state="completed"
                  fraction={1}
                  dye={v.dye}
                  size={64}
                />
                <span className="monument__title">{v.goal.title}</span>
                <span className="monument__figure num">
                  {v.goal.target !== null
                    ? value(v.goal, v.goal.current)
                    : `${v.milestones.length || ''} ${v.milestones.length ? 'gates' : 'taken'}`}
                </span>
                <dl className="monument__facts">
                  <div>
                    <dt className="label">PLANTED</dt>
                    <dd>{fmtDate(v.goal.startDate)}</dd>
                  </div>
                  <div>
                    <dt className="label">TAKEN</dt>
                    <dd>{v.goal.completedAt ? fmtDate(dayOf(v.goal.completedAt)) : '—'}</dd>
                  </div>
                  <div>
                    <dt className="label">HELD</dt>
                    <dd>{span} days</dd>
                  </div>
                  <div>
                    <dt className="label">DIFFICULTY</dt>
                    <dd>{'▮'.repeat(v.goal.difficulty)}</dd>
                  </div>
                  <div>
                    <dt className="label">MERIT</dt>
                    <dd className="monument__merit">{merit.toLocaleString('en-CA')}</dd>
                  </div>
                  {early !== null && early > 0 && (
                    <div>
                      <dt className="label">AHEAD OF THE HOUR</dt>
                      <dd>{early} days</dd>
                    </div>
                  )}
                </dl>
                {v.goal.why && <p className="monument__why">{v.goal.why}</p>}
              </button>
            </li>
          )
        })}
      </ul>

      <section className="surface__block">
        <p className="label">RECORDS</p>
        <dl className="ledger">
          {personalRecords.map((r) => (
            <div key={r.label}>
              <dt className="label">{r.label}</dt>
              <dd>
                <span className="num">{r.value}</span>
                {r.when && <span className="ledger__when label">{fmtDate(r.when)}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
