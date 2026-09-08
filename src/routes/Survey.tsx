import { useMemo } from 'react'
import { useWorld } from '@/state/world'
import { useWorldView } from '@/state/useWorldView'
import { byHouse, byWeek, records } from '@/domain/history'
import { activityByDay } from '@/state/selectors'
import { SURFACE } from '@/design/marks'
import { fmtDate, today } from '@/domain/date'
import './surface.css'

/**
 * THE SURVEY (検) — what the record actually says.
 *
 * Every figure here is measured. Where there is not enough history to say
 * something, the surface says THAT instead of showing a number that looks
 * authoritative — a completion rate over two standards is not a rate.
 */
export function Survey() {
  const world = useWorldView()
  const goals = useWorld((s) => s.goals)
  const entries = useWorld((s) => s.entries)
  const events = useWorld((s) => s.events)
  const at = today()

  const weeks = useMemo(() => byWeek(entries, events, 12, at), [entries, events, at])
  const heat = useMemo(() => activityByDay(entries, 182, at), [entries, at])
  const houses = useMemo(
    () => byHouse(goals, (g) => world.byId.get(g.id)?.fraction ?? 0),
    [goals, world],
  )
  const personalRecords = useMemo(() => records(goals, entries, events), [goals, entries, events])

  const finished = goals.filter((g) => g.completedAt).length
  const closed = finished + world.live.length
  const consistency = weeks.length
    ? weeks.reduce((s, w) => s + Math.min(w.activeDays, 7), 0) / (weeks.length * 7)
    : 0
  const peakHeat = Math.max(1, ...heat.map((d) => d.count))

  if (entries.length < 3)
    return (
      <div className="surface surface--empty">
        <span className="surface__mark" aria-hidden="true">
          {SURFACE.survey.mark}
        </span>
        <h1 className="mega">TOO EARLY TO SURVEY</h1>
        <p className="lede">
          There are {entries.length} dispatches on record. A survey of that is a guess with a chart
          around it, so there is not one yet. Come back after a couple of weeks.
        </p>
      </div>
    )

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <p className="label">{SURFACE.survey.name}</p>
          <h1 className="h1">WHAT THE RECORD SAYS</h1>
        </div>
      </header>

      <section className="surface__answers">
        <Measure
          label="CONSISTENCY"
          value={`${Math.round(consistency * 100)}%`}
          detail="Days with a dispatch, across the last twelve weeks."
        />
        <Measure
          label="COMPLETION"
          value={closed >= 5 ? `${Math.round((finished / closed) * 100)}%` : '—'}
          detail={
            closed >= 5
              ? `${finished} taken of ${closed} planted.`
              : `Only ${closed} standards on record. A rate over that few is not a rate.`
          }
        />
        <Measure
          label="VELOCITY"
          value={`${(entries.length / Math.max(weeks.length, 1)).toFixed(1)}`}
          detail="Dispatches per week, over the last twelve."
        />
      </section>

      <section className="surface__block">
        <p className="label">ACTIVITY · LAST 182 DAYS · DARKEST IS {peakHeat} IN A DAY</p>
        <ol className="heat" aria-label="Dispatches per day over the last 182 days">
          {heat.map((d) => (
            <li
              key={d.date}
              className="heat__day"
              style={{ '--v': d.count / peakHeat } as React.CSSProperties}
              title={`${fmtDate(d.date)}: ${d.count}`}
            >
              <span className="sr-only">
                {fmtDate(d.date)}: {d.count} dispatches
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="surface__block">
        <p className="label">HOUSES</p>
        <ul className="houses">
          {houses.map((h) => (
            <li key={h.house}>
              <span className="houses__name">{h.house}</span>
              <span
                className="houses__bar"
                style={{ '--f': h.progress } as React.CSSProperties}
                aria-hidden="true"
              />
              <span className="houses__figure num">{Math.round(h.progress * 100)}%</span>
              <span className="houses__count label">
                {h.standards} standard{h.standards === 1 ? '' : 's'}
                {h.taken ? ` · ${h.taken} taken` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

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

function Measure({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="answer">
      <p className="label">{label}</p>
      <p className="answer__value num">{value}</p>
      <p className="answer__detail">{detail}</p>
    </div>
  )
}
