import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useWorld } from '@/state/world'
import { useWorldView } from '@/state/useWorldView'
import { bestPeriod, byMonth, byWeek, comebacks, runs } from '@/domain/history'
import { EVENT_COPY } from '@/domain/copy'
import { dayOf, fmtDate, fmtDateShort, today } from '@/domain/date'
import { SURFACE } from '@/design/marks'
import './surface.css'

/**
 * THE CHRONICLE (記) — travelling through what actually happened.
 *
 * A scrubbable bar of periods, and the record for whichever one is selected.
 * Every question it answers — my best week, my longest run, my biggest comeback
 * — is a fold over the event log, so the answer is the record rather than a
 * summary of it.
 */
export function Chronicle() {
  const world = useWorldView()
  const entries = useWorld((s) => s.entries)
  const events = useWorld((s) => s.events)
  const navigate = useNavigate()

  const [grain, setGrain] = useState<'week' | 'month'>('week')
  const [selected, setSelected] = useState<string | null>(null)

  const at = today()
  const periods = useMemo(
    () => (grain === 'week' ? byWeek(entries, events, 26, at) : byMonth(entries, events, 18, at)),
    [grain, entries, events, at],
  )

  const best = useMemo(() => bestPeriod(periods), [periods])
  const longest = useMemo(() => runs(entries)[0] ?? null, [entries])
  const biggestComeback = useMemo(() => comebacks(entries)[0] ?? null, [entries])

  const peak = Math.max(1, ...periods.map((p) => p.merit))
  const current = periods.find((p) => p.key === selected) ?? periods.at(-1) ?? null

  const inPeriod = useMemo(() => {
    if (!current) return []
    const next = periods[periods.indexOf(current) + 1]
    return events
      .filter((e) => {
        const day = dayOf(e.at)
        return day >= current.from && (!next || day < next.from)
      })
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [current, periods, events])

  if (!events.length)
    return (
      <div className="surface surface--empty">
        <span className="surface__mark" aria-hidden="true">
          {SURFACE.chronicle.mark}
        </span>
        <h1 className="mega">NOTHING RECORDED</h1>
        <p className="lede">
          The chronicle writes itself as you go. Plant a standard and send a dispatch, and this
          fills with the story of it — including the quiet stretches, which are part of the story.
        </p>
      </div>
    )

  return (
    <div className="surface enter">
      <header className="surface__head">
        <div>
          <p className="label">{SURFACE.chronicle.name}</p>
          <h1 className="h1">THE RECORD</h1>
        </div>
        <div className="surface__toggle" role="group" aria-label="Grain">
          <button type="button" aria-pressed={grain === 'week'} onClick={() => setGrain('week')}>
            WEEKS
          </button>
          <button type="button" aria-pressed={grain === 'month'} onClick={() => setGrain('month')}>
            MONTHS
          </button>
        </div>
      </header>

      {/* The scrubber. Height is merit, and the axis is stated — this is a chart
          and it says so, rather than being a bar chart with its scale removed. */}
      <section className="chron">
        <p className="label">
          MERIT BY {grain === 'week' ? 'WEEK' : 'MONTH'} · PEAK {peak.toLocaleString('en-CA')}
        </p>
        <ol className="chron__bars">
          {periods.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                className={`chron__bar${p.key === current?.key ? ' is-current' : ''}${p.key === best?.key ? ' is-best' : ''}`}
                style={{ '--h': `${(p.merit / peak) * 100}%` } as React.CSSProperties}
                onClick={() => setSelected(p.key)}
                aria-pressed={p.key === current?.key}
              >
                <span className="sr-only">
                  {fmtDate(p.from)}: {p.dispatches} dispatches, {p.gates} gates, {p.taken} taken,{' '}
                  {p.merit} merit
                  {p.key === best?.key ? '. The strongest on record.' : ''}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="chron__axis label">
          <span>{fmtDateShort(periods[0]?.from ?? at)}</span>
          <span>NOW</span>
        </p>
      </section>

      <section className="surface__answers">
        <Answer
          question="MY BEST STRETCH"
          answer={best ? fmtDate(best.from) : null}
          detail={
            best
              ? `${best.dispatches} dispatches · ${best.gates} gates · ${best.taken} taken · ${best.merit} merit`
              : 'Nothing on record yet.'
          }
          onGo={best ? () => setSelected(best.key) : undefined}
        />
        <Answer
          question="MY LONGEST RUN"
          answer={longest ? `${longest.length} days` : null}
          detail={longest ? `${fmtDate(longest.from)} to ${fmtDate(longest.to)}` : 'Not yet.'}
        />
        <Answer
          question="MY BIGGEST COMEBACK"
          answer={biggestComeback ? `${biggestComeback.silence} days away` : null}
          detail={
            biggestComeback
              ? `Raised again on ${fmtDate(biggestComeback.returnedOn)} — ${
                  world.byId.get(biggestComeback.goalId)?.goal.title ?? 'a standard'
                }`
              : 'No silence long enough to come back from.'
          }
          onGo={
            biggestComeback && world.byId.has(biggestComeback.goalId)
              ? () => navigate(`/standard/${biggestComeback.goalId}`)
              : undefined
          }
        />
      </section>

      {current && (
        <section className="surface__block">
          <p className="label">
            {fmtDate(current.from)} · {current.dispatches} DISPATCHES · {current.merit} MERIT
          </p>
          {inPeriod.length === 0 ? (
            <p className="lede">
              Nothing was recorded in this stretch. A quiet week is a fact, not a failure.
            </p>
          ) : (
            <ol className="story">
              {inPeriod.slice(0, 40).map((e) => (
                <li key={e.id}>
                  <span className="story__when label">{fmtDate(dayOf(e.at))}</span>
                  <span className="story__what">
                    {e.goalId && world.byId.has(e.goalId) && (
                      <button
                        type="button"
                        className="story__goal"
                        onClick={() => navigate(`/standard/${e.goalId}`)}
                      >
                        {world.byId.get(e.goalId)!.goal.title}
                      </button>
                    )}{' '}
                    {EVENT_COPY[e.type](e.data)}
                  </span>
                  {e.xp > 0 && <span className="story__merit num">+{e.xp}</span>}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  )
}

function Answer({
  question,
  answer,
  detail,
  onGo,
}: {
  question: string
  answer: string | null
  detail: string
  onGo?: () => void
}) {
  return (
    <div className="answer">
      <p className="label">{question}</p>
      <p className="answer__value">{answer ?? '—'}</p>
      <p className="answer__detail">{detail}</p>
      {onGo && (
        <button type="button" className="answer__go" onClick={onGo}>
          SHOW ME →
        </button>
      )}
    </div>
  )
}
