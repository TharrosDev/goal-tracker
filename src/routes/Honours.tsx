import { useWorld } from '@/state/world'
import { ACHIEVEMENTS, type AchievementDef, type AchievementTier } from '@/domain/achievements'
import { SURFACE } from '@/design/marks'
import { dayOf, fmtDate } from '@/domain/date'
import { rng } from '@/domain/identity'
import { staggerIndex } from '@/design/motion'
import './surface.css'

/**
 * HONOURS (誉).
 *
 * Every badge is drawn, not picked from an icon set: the geometry comes from the
 * honour's own id, so the set is coherent without any two being alike. Locked
 * honours show their shape but not their name — the shape is the hint.
 */
export function Honours() {
  const unlocked = useWorld((s) => s.achievements)
  const held = new Map(unlocked.map((u) => [u.id, u]))

  const open = ACHIEVEMENTS.filter((a) => !a.hidden)
  const hidden = ACHIEVEMENTS.filter((a) => a.hidden)
  const foundHidden = hidden.filter((a) => held.has(a.id))

  return (
    <div className="surface enter">
      <header className="surface__head">
        <div>
          <p className="label">{SURFACE.honours.name}</p>
          <h1 className="h1">
            {held.size} OF {ACHIEVEMENTS.length}
          </h1>
        </div>
      </header>

      <section className="surface__block">
        <p className="label">AWARDED FOR</p>
        <ul className="honours stagger">
          {open.map((a, i) => (
            <Honour
              key={a.id}
              index={i}
              def={a}
              at={held.get(a.id)?.at ?? null}
              value={held.get(a.id)?.value ?? null}
            />
          ))}
        </ul>
      </section>

      <section className="surface__block">
        <p className="label">
          UNNAMED — {foundHidden.length} OF {hidden.length} FOUND
        </p>
        <p className="lede">
          These are not listed. They are found by doing something worth doing, and the shape is the
          only clue you get.
        </p>
        <ul className="honours stagger">
          {hidden.map((a, i) => (
            <Honour
              key={a.id}
              index={i}
              def={a}
              at={held.get(a.id)?.at ?? null}
              value={held.get(a.id)?.value ?? null}
              redacted={!held.has(a.id)}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}

const TIER_ORDER: Record<AchievementTier, number> = { bronze: 3, silver: 4, gold: 5, mythic: 6 }

function Honour({
  def,
  at,
  value,
  index,
  redacted = false,
}: {
  def: AchievementDef
  at: string | null
  value: number | null
  index: number
  redacted?: boolean
}) {
  const won = at !== null
  return (
    <li
      className={`honour honour--${def.tier}${won ? ' is-won' : ''}`}
      style={{ '--i': staggerIndex(index) } as React.CSSProperties}
    >
      <Badge id={def.id} tier={def.tier} won={won} />
      <span className="honour__name">{redacted && !won ? '—' : def.name}</span>
      <span className="honour__desc">{redacted && !won ? 'Not yet found.' : def.description}</span>
      {won && (
        <span className="honour__when label">
          {fmtDate(dayOf(at))}
          {value !== null ? ` · ${value.toLocaleString('en-CA')}` : ''}
        </span>
      )}
    </li>
  )
}

/**
 * The badge. A rosette seeded entirely from the honour's own id — so all
 * twenty-three are distinct and not one of them was drawn by hand.
 *
 * The tier sets a FLOOR on the point count rather than fixing it: fixing it made
 * every bronze honour a triangle and every gold one the same five-pointed star,
 * which is a set that looks generated rather than a set of individuals.
 */
function Badge({ id, tier, won }: { id: string; tier: AchievementTier; won: boolean }) {
  const next = rng(id)
  const points = TIER_ORDER[tier] + Math.floor(next() * 3)
  const inner = 0.34 + next() * 0.36
  const rotation = next() * 360
  const bars = 4 + Math.floor(next() * 6)

  const star = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? 44 : 44 * inner
    const a = ((rotation + (360 / (points * 2)) * i - 90) * Math.PI) / 180
    return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`
  }).join('L')

  return (
    <svg
      className="honour__badge"
      viewBox="-50 -50 100 100"
      width={56}
      height={56}
      aria-hidden="true"
    >
      <circle
        r={47}
        fill="none"
        stroke="currentColor"
        strokeWidth={won ? 2 : 1}
        opacity={won ? 1 : 0.4}
      />
      <path
        d={`M${star}Z`}
        fill={won ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.5}
        opacity={won ? 0.9 : 0.35}
      />
      {/* Rim notches. The count is part of the honour's identity, so they are
          drawn heavily enough to actually be counted. */}
      {Array.from({ length: bars }, (_, i) => (
        <line
          key={i}
          x1={0}
          y1={-47}
          x2={0}
          y2={-38}
          strokeWidth={3}
          strokeLinecap="butt"
          stroke="currentColor"
          opacity={won ? 1 : 0.35}
          transform={`rotate(${(360 / bars) * i + rotation})`}
        />
      ))}
    </svg>
  )
}
