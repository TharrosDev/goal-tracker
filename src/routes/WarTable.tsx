import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useWorldView } from '@/state/useWorldView'
import { Field } from '@/field/Field'
import { Numeral } from '@/viz/Numeral'
import { Mark } from '@/viz/Mark'
import { SURFACE } from '@/design/marks'
import { WINDOW } from '@/domain/momentum'
import { welcomeBack } from '@/domain/copy'
import { useWorld } from '@/state/world'
import './war-table.css'

/**
 * THE WAR TABLE (陣).
 *
 * The first viewport answers, in this order of prominence: how much wind there
 * is behind you, where every standard stands against its own line, and what the
 * next hour is. Nothing here is a panel — the wind overlaps the scale, rank sits
 * in the margin, and the field is the space they all live in.
 */
export function WarTable() {
  const world = useWorldView()
  const navigate = useNavigate()
  const awayDays = useWorld((s) => s.awayDays)
  const [selected, setSelected] = useState<string | null>(null)

  const { momentum, progression, streak, live, urgent } = world
  const trendWord =
    momentum.trend > 0.05 ? 'RISING' : momentum.trend < -0.05 ? 'FALLING' : 'HOLDING'

  if (!live.length) return <EmptyField />

  // The one place the product speaks to somebody coming back. It names the
  // length of the silence and does not scold — naming it is what makes coming
  // back possible. See DESIGN.md 10.
  const returning = welcomeBack(awayDays)

  return (
    <div className="war enter">
      {returning && (
        <p className="war__return" role="status">
          {returning}
        </p>
      )}

      <div className="war__wind">
        <Numeral
          value={Math.round(momentum.score * 100)}
          label={`The wind: ${Math.round(momentum.score * 100)} of 100, ${momentum.band}`}
        />
        <p className="war__wind-read">
          <Mark of={SURFACE.wind} label="hidden" />
          <span className="label label--live">{trendWord}</span>
          <span className="label">
            {momentum.activeDays} OF {WINDOW / 2} DAYS
          </span>
        </p>
      </div>

      <div className="war__rank">
        <span className="label">{SURFACE.rank.name}</span>
        <span className="war__rank-title">{progression.title}</span>
        <span className="war__rank-level num">{roman(progression.level)}</span>
        <span className="war__merit" style={{ '--f': progression.fraction } as React.CSSProperties}>
          <span className="sr-only">
            {progression.into} of {progression.span} merit toward the next rank
          </span>
        </span>
      </div>

      <Field
        views={live}
        selectedId={selected}
        onSelect={setSelected}
        onOpen={(id) => navigate(`/standard/${id}`)}
      />

      <p className="war__order">
        <span>
          <b className="num">{streak}</b> day{streak === 1 ? '' : 's'} unbroken
        </span>
        <span>
          <b className="num">{live.length}</b> standing
        </span>
        <span className={urgent?.arrival?.urgent ? 'is-urgent' : undefined}>
          next hour <b className="num">{urgent?.arrival ? urgent.arrival.text : 'not set'}</b>
        </span>
      </p>
    </div>
  )
}

/** Rank reads better in Roman: it is a standing, not a score. */
function roman(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let out = ''
  let rest = n
  for (const [v, s] of table)
    while (rest >= v) {
      out += s
      rest -= v
    }
  return out
}

/**
 * The empty field. Not "no goals found" — an empty field is a real state with
 * its own dignity, and the first standard is an act, not a form submission.
 */
function EmptyField() {
  const navigate = useNavigate()
  return (
    <div className="war war--empty">
      <p className="label">{SURFACE.warTable.name}</p>
      <h1 className="mega war__empty-title">
        THE FIELD
        <br />
        IS EMPTY
      </h1>
      <p className="lede">
        Nothing is planted. No hour is set. Plant the first standard and the ground, the line and
        the wind come with it.
      </p>
      <button type="button" className="war__plant" onClick={() => navigate('/plant')}>
        PLANT THE FIRST STANDARD
      </button>
    </div>
  )
}
