import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useWorldView } from '@/state/useWorldView'
import { useWorld } from '@/state/world'
import { Mon } from '@/viz/Mon'
import { Numeral } from '@/viz/Numeral'
import { Trajectory } from '@/viz/Trajectory'
import { Dispatch } from '@/shell/Dispatch'
import { Govern } from './Govern'
import { STATE_MARK, SURFACE } from '@/design/marks'
import { fmtDate, today } from '@/domain/date'
import { relativeDays, value, valueParts } from '@/domain/format'
import { EVENT_COPY } from '@/domain/copy'
import './standard-detail.css'

/**
 * A STANDARD's own ground.
 *
 * Not a title, a bar and a list of tasks. The title is enormous, the figure is
 * the one number on the screen, and the middle of the surface is the standard's
 * own story: where it started, where it stopped, where it came back.
 */
export function StandardDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const world = useWorldView()
  const setMilestoneDone = useWorld((s) => s.setMilestoneDone)
  const patchGoal = useWorld((s) => s.patchGoal)
  const [dispatching, setDispatching] = useState(false)

  const view = id ? world.byId.get(id) : undefined
  if (!view) {
    return (
      <div className="detail detail--gone">
        <h1 className="h1">NO SUCH STANDARD</h1>
        <p className="lede">It was struck, or it never stood here.</p>
        <button type="button" className="detail__back" onClick={() => navigate('/')}>
          BACK TO {SURFACE.warTable.name}
        </button>
      </div>
    )
  }

  const { goal, state, fraction, arrival, milestones } = view
  const mark = STATE_MARK[state]
  const parts = valueParts(goal, goal.current)
  const at = today()

  const related = world.views.filter(
    (v) =>
      v.goal.id !== goal.id && (v.goal.parentId === goal.id || goal.linkedIds.includes(v.goal.id)),
  )

  const story = world.recent.filter((e) => e.goalId === goal.id).slice(0, 12)

  return (
    <div className="detail enter">
      <header className="detail__head">
        <Mon
          sigil={view.sigil}
          kind={goal.kind}
          state={state}
          fraction={fraction}
          dye={view.dye}
          size={72}
        />
        <div>
          <p className="label">
            {view.sigil.callsign} · {goal.category ?? 'NO HOUSE'}
            {goal.boss ? ` · ${SURFACE.siege.name}` : ''}
          </p>
          <h1 className="display detail__title">{goal.title}</h1>
        </div>
      </header>

      <div className="detail__standing">
        <div className="detail__figure">
          <Numeral
            value={goal.current}
            prefix={parts.prefix}
            suffix={parts.suffix}
            round={goal.kind !== 'money'}
            label={`${value(goal, goal.current, true)} of ${goal.target ? value(goal, goal.target, true) : 'no target'}`}
          />
          {goal.target !== null && <p className="detail__of">of {value(goal, goal.target)}</p>}
        </div>

        <dl className="detail__facts">
          <Fact term="STATE" mark={mark.mark}>
            {mark.name}
          </Fact>
          {arrival && (
            <Fact term={SURFACE.hour.name} urgent={arrival.urgent}>
              {arrival.text} · {fmtDate(goal.deadline!)}
            </Fact>
          )}
          {view.paceGap !== null && (
            <Fact term={SURFACE.line.name} urgent={view.behind}>
              {view.behind
                ? `${Math.round(view.paceGap * 100)} points behind`
                : `${Math.abs(Math.round(view.paceGap * 100))} points ahead`}
            </Fact>
          )}
          {view.perWeek !== null && (
            <Fact term="PER WEEK">{value(goal, Math.ceil(view.perWeek * 100) / 100, true)}</Fact>
          )}
          {view.projectedFinish && <Fact term="AT THIS RATE">{fmtDate(view.projectedFinish)}</Fact>}
          <Fact term="PLANTED">
            {fmtDate(goal.startDate)} · {view.daysAlive} days ago
          </Fact>
          {view.daysIdle !== null && (
            <Fact term="LAST DISPATCH">{relativeDays(view.daysIdle)}</Fact>
          )}
        </dl>
      </div>

      <Trajectory view={view} at={at} />

      {goal.why && (
        <section className="detail__why">
          <p className="label">WHY</p>
          <p className="lede">{goal.why}</p>
        </section>
      )}

      {milestones.length > 0 && (
        <section className="detail__gates">
          <p className="label">{SURFACE.gate.name}</p>
          <ol className="runway">
            {milestones.map((m) => (
              <li key={m.id} className={m.done ? 'is-passed' : undefined}>
                <button type="button" onClick={() => void setMilestoneDone(m.id, !m.done)}>
                  <span className="runway__tick" aria-hidden="true" />
                  <span className="runway__title">{m.title}</span>
                  {m.at !== null && <span className="runway__at num">{value(goal, m.at)}</span>}
                  <span className="sr-only">{m.done ? 'Passed' : 'Not yet passed'}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="detail__story">
        <p className="label">{SURFACE.chronicle.name}</p>
        {story.length === 0 ? (
          <p className="lede">Nothing recorded yet. The first dispatch starts the story.</p>
        ) : (
          <ol className="story">
            {story.map((e) => (
              <li key={e.id}>
                <span className="story__when label">{fmtDate(e.at.slice(0, 10))}</span>
                <span className="story__what">{EVENT_COPY[e.type](e.data)}</span>
                {e.xp > 0 && <span className="story__merit num">+{e.xp}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {related.length > 0 && (
        <section className="detail__related">
          <p className="label">STANDS WITH</p>
          <ul>
            {related.map((v) => (
              <li key={v.goal.id}>
                <button type="button" onClick={() => navigate(`/standard/${v.goal.id}`)}>
                  <Mon
                    sigil={v.sigil}
                    kind={v.goal.kind}
                    state={v.state}
                    dye={v.dye}
                    fraction={v.fraction}
                    size={20}
                  />
                  {v.goal.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="detail__actions">
        <button type="button" className="detail__send" onClick={() => setDispatching(true)}>
          SEND A DISPATCH
        </button>
        <button
          type="button"
          className="detail__strike"
          onClick={() => void patchGoal(goal.id, { paused: !goal.paused })}
        >
          {goal.paused ? 'RAISE AGAIN' : 'STRIKE THE CAMP'}
        </button>
      </div>

      <Govern view={view} />

      <Dispatch
        open={dispatching}
        goalId={goal.id}
        onClose={() => setDispatching(false)}
        onLogged={() => {}}
      />
    </div>
  )
}

function Fact({
  term,
  children,
  mark,
  urgent,
}: {
  term: string
  children: React.ReactNode
  mark?: string
  urgent?: boolean
}) {
  return (
    <div className={`fact${urgent ? ' is-urgent' : ''}`}>
      <dt className="label">{term}</dt>
      <dd>
        {mark && (
          <span className="fact__mark" aria-hidden="true">
            {mark}
          </span>
        )}
        {children}
      </dd>
    </div>
  )
}
