import { useEffect, useMemo } from 'react'
import { useWorld } from '@/state/world'
import { worldView } from '@/state/selectors'
import { useApplyWorld, useRenderTier } from '@/shell/prefs'
import { fmtDate, today } from '@/domain/date'
import './boot.css'

/**
 * STAGE 1 DIAGNOSTIC
 *
 * The foundation, made visible. This screen exists so the domain, the database,
 * the migration and the token system can be verified in a browser before any of
 * the real interface is built on top of them. Stage 2 replaces it entirely.
 */
export function App() {
  const boot = useWorld((s) => s.boot)
  const ready = useWorld((s) => s.ready)
  const error = useWorld((s) => s.error)
  const goals = useWorld((s) => s.goals)
  const milestones = useWorld((s) => s.milestones)
  const entries = useWorld((s) => s.entries)
  const events = useWorld((s) => s.events)
  const achievements = useWorld((s) => s.achievements)
  const migratedCount = useWorld((s) => s.migratedCount)
  const tier = useRenderTier()
  useApplyWorld()

  useEffect(() => {
    void boot()
  }, [boot])

  const view = useMemo(
    () => worldView({ goals, milestones, entries, events }),
    [goals, milestones, entries, events],
  )

  const rows: [string, string][] = [
    ['records', `${goals.length} goals · ${entries.length} entries · ${events.length} events`],
    ['migration', migratedCount ? `${migratedCount} carried from goals.v1` : 'nothing to carry'],
    ['momentum', `${Math.round(view.momentum.score * 100)} · ${view.momentum.band}`],
    ['level', `${view.progression.level} ${view.progression.title} · ${view.xp} xp`],
    ['streak', `${view.streak} days`],
    ['achievements', `${achievements.length} unlocked`],
    ['universe', `renderer ${tier}`],
  ]

  return (
    <main className="boot">
      <div className="ambient" aria-hidden="true" />
      <div className="gridfield" aria-hidden="true" />

      <header className="boot__head">
        <p className="label label--live">SYSTEM {ready ? 'ONLINE' : 'BOOTING'}</p>
        <p className="label">{fmtDate(today())}</p>
      </header>

      <h1 className="mega boot__title">
        AMBITION
        <br />
        ENGINE
      </h1>

      {error ? (
        <p className="lede boot__error">{error}</p>
      ) : (
        <dl className="boot__table">
          {rows.map(([term, value]) => (
            <div key={term} className="boot__row">
              <dt className="label">{term}</dt>
              <dd className="mono">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="label boot__foot">STAGE 1 · FOUNDATION · DOMAIN · PERSISTENCE</p>
    </main>
  )
}
