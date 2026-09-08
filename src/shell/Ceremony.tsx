import { useEffect, useMemo, useRef, useState } from 'react'
import { useWorld } from '@/state/world'
import { useWorldView } from '@/state/useWorldView'
import { Mon } from '@/viz/Mon'
import { ACHIEVEMENTS_BY_ID } from '@/domain/achievements'
import { SURFACE } from '@/design/marks'
import { EVENT_COPY } from '@/domain/copy'
import { dayOf, days, fmtDate, today } from '@/domain/date'
import { value } from '@/domain/format'
import { useReducedMotion } from './prefs'
import './ceremony.css'

/**
 * THE SEALING (印) — completion, at four sizes.
 *
 * dispatch  a tap. Under 300ms, never blocking, never in the way.
 * gate      the gate's name rises and the tick strikes gold. ~1s.
 * taken     the standard resolves to gold and is sealed. ~2.4s.
 * siege     eight beats, about seven seconds, and deliberately far too much.
 *
 * Everything here is skippable with any key, and SKIPPING IS NOT A LESSER
 * OUTCOME: the merit is already awarded and the record already written before a
 * single frame is drawn. The ceremony is a reading of what happened, not the
 * thing that makes it happen.
 *
 * STILL AIR gets its own version rather than a stripped one: the eight beats
 * become eight stills, advanced on their own or by Space, so it reads as a
 * printed record of the victory instead of a film of it.
 */
export function Ceremony() {
  const cue = useWorld((s) => s.ceremony)
  // Keyed on the cue's sequence: a ceremony MOUNTS when it fires and unmounts
  // when it is done, so its beat starts at zero by construction and two
  // completions in a row cannot share one run of timers.
  return cue ? <Sealing key={cue.seq} /> : null
}

function Sealing() {
  const cue = useWorld((s) => s.ceremony)!
  const clear = useWorld((s) => s.clearCeremony)
  const drainUnlocks = useWorld((s) => s.drainUnlocks)
  const world = useWorldView()
  const reduced = useReducedMotion()

  const [beat, setBeat] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Honours unlocked by the same action ride along with this ceremony rather
  // than interrupting separately. Drained once, at mount.
  const [honours] = useState<string[]>(() => drainUnlocks().map((u) => u.id))

  const view = world.byId.get(cue.goalId)
  const big = cue.tier === 'taken' || cue.tier === 'siege'
  const beats = cue.tier === 'siege' ? 8 : cue.tier === 'taken' ? 3 : 1

  useEffect(() => {
    const step = cue.tier === 'siege' ? (reduced ? 1200 : 760) : cue.tier === 'taken' ? 700 : 900
    const handles = timers.current
    for (let i = 1; i < beats; i += 1) handles.push(setTimeout(() => setBeat(i), step * i))
    handles.push(setTimeout(() => clear(), step * beats + 400))
    return () => {
      handles.forEach(clearTimeout)
      handles.length = 0
    }
  }, [cue.tier, beats, reduced, clear])

  useEffect(() => {
    if (!big) return
    const skip = () => clear()
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
  }, [big, clear])

  const merit = useMemo(() => cue.merit, [cue])

  // ── the small tiers ───────────────────────────────────────────────────────
  if (!big)
    return (
      <div className={`sealing sealing--${cue.tier}`} role="status" aria-live="polite">
        <span className="sealing__mark" aria-hidden="true">
          {cue.tier === 'gate' ? SURFACE.gate.mark : SURFACE.dispatch.mark}
        </span>
        <span className="sealing__line">
          {cue.tier === 'gate'
            ? `Passed: ${cue.gates[0] ?? 'a gate'}`
            : cue.recovery
              ? 'Raised again.'
              : cue.record
                ? 'A record.'
                : 'Recorded.'}
        </span>
        {merit > 0 && <span className="sealing__merit num">+{merit}</span>}
      </div>
    )

  // ── taken, and the fall of a siege ────────────────────────────────────────
  const goal = view?.goal
  const held = goal ? days(goal.startDate, goal.completedAt ? dayOf(goal.completedAt) : today()) : 0
  const early =
    goal?.deadline && goal.completedAt ? days(dayOf(goal.completedAt), goal.deadline) : null
  const story = world.recent.filter((e) => e.goalId === cue.goalId).slice(0, 8)

  return (
    <div
      className={`fall fall--${cue.tier} fall--beat-${beat}${reduced ? ' fall--still' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${goal?.title ?? 'A standard'} taken`}
      onPointerDown={clear}
    >
      <div className="fall__inner">
        {cue.tier === 'siege' && <Castle beat={beat} reduced={reduced} />}

        {view && (
          <div className="fall__crest">
            <Mon
              sigil={view.sigil}
              kind={view.goal.kind}
              state="completed"
              fraction={1}
              dye={view.dye}
              size={cue.tier === 'siege' ? 140 : 96}
            />
          </div>
        )}

        <p className="label fall__kicker">
          {cue.tier === 'siege' ? 'THE SIEGE FALLS' : SURFACE.sealing.name}
        </p>

        <h2 className="mega fall__title">{goal?.title ?? 'TAKEN'}</h2>

        <dl className="fall__tally">
          <div>
            <dt className="label">HELD</dt>
            <dd className="num">{held} days</dd>
          </div>
          {goal?.target !== null && goal !== undefined && (
            <div>
              <dt className="label">FINAL</dt>
              <dd className="num">{value(goal, goal.current)}</dd>
            </div>
          )}
          {early !== null && early > 0 && (
            <div>
              <dt className="label">AHEAD OF THE HOUR</dt>
              <dd className="num">{early} days</dd>
            </div>
          )}
          <div>
            <dt className="label">MERIT</dt>
            <dd className="num fall__merit">+{merit}</dd>
          </div>
        </dl>

        {/* Its own chronicle, flashing behind the type. Real events, in order —
            the point of the beat is that you see the eighteen quiet days. */}
        {cue.tier === 'siege' && story.length > 0 && (
          <ol className="fall__story" aria-hidden="true">
            {story.map((e, i) => (
              <li key={e.id} className={i <= beat * 2 ? 'is-lit' : undefined}>
                <span className="label">{fmtDate(dayOf(e.at))}</span>
                <span>{EVENT_COPY[e.type](e.data)}</span>
              </li>
            ))}
          </ol>
        )}

        {honours.length > 0 && (
          <ul className="fall__honours">
            {honours.map((id) => (
              <li key={id}>
                <span className="label">HONOUR</span>
                <span className="fall__honour">{ACHIEVEMENTS_BY_ID.get(id)?.name ?? id}</span>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="fall__skip label" onClick={clear}>
          {reduced ? 'CLOSE' : 'ANY KEY TO CLOSE'}
        </button>
      </div>
    </div>
  )
}

/**
 * The castle, drawn and then broken, tier by tier, from the top. An SVG path
 * whose stroke draws in; in still air every tier is simply present or gone, so
 * the same eight beats read as eight stills.
 */
function Castle({ beat, reduced }: { beat: number; reduced: boolean }) {
  const tiers = [
    'M20,96 H180 V78 H20 Z',
    'M36,78 H164 V60 H36 Z',
    'M52,60 H148 V42 H52 Z',
    'M68,42 H132 V26 H68 Z',
    'M86,26 H114 V8 H86 Z',
  ]
  return (
    <svg className="fall__castle" viewBox="0 0 200 100" aria-hidden="true">
      {tiers.map((d, i) => {
        // Tiers fall from the top down, one per beat from the fourth.
        const fallen = beat >= 4 && 4 - i <= beat - 4
        return (
          <path
            key={i}
            d={d}
            className={`castle__tier${fallen ? ' is-fallen' : ''}`}
            style={{ '--i': i, '--delay': reduced ? '0ms' : `${i * 90}ms` } as React.CSSProperties}
          />
        )
      })}
    </svg>
  )
}
