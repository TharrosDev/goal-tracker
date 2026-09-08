import { useRef, useState } from 'react'
import { useWorld } from '@/state/world'
import { WORLD_IDS, type WorldId } from '@/domain/types'
import { SURFACE } from '@/design/marks'
import { useSystemReducedMotion } from '@/shell/prefs'
import { readLegacyBackup } from '@/data/migrations'
import type { ImportReport } from '@/data/backup'
import './surface.css'

/**
 * THE QUARTERMASTER (具) — supply, and the safety of the record.
 *
 * The data half of this surface is the important half. Everything is on this
 * device and nothing syncs anywhere, so export is not a settings-page
 * afterthought: it is the only thing standing between a cleared browser and an
 * empty field, and it is the first thing on the page.
 */

const CAMPS: { id: WorldId; name: string; note: string }[] = [
  { id: 'lacquer', name: 'LACQUER', note: 'Night. Indigo-black, gold leaf, one vermilion.' },
  { id: 'washi', name: 'WASHI', note: 'Day, on paper. Nothing glows.' },
  { id: 'sumi', name: 'SUMI', note: 'Ink only. The seal is the one colour.' },
  { id: 'kuro', name: 'KURO', note: 'Cinema. Every state is a grey — form carries it.' },
  { id: 'jigoku', name: 'JIGOKU', note: 'The hell-screen. Every signal at once.' },
]

export function Quartermaster() {
  const settings = useWorld((s) => s.settings)
  const updateSettings = useWorld((s) => s.updateSettings)
  const exportBackup = useWorld((s) => s.exportBackup)
  const importBackup = useWorld((s) => s.importBackup)
  const goals = useWorld((s) => s.goals)
  const entries = useWorld((s) => s.entries)
  const events = useWorld((s) => s.events)
  const systemReduced = useSystemReducedMotion()

  const file = useRef<HTMLInputElement>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [legacy, setLegacy] = useState<string | null>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    setProblem(null)
    setReport(null)
    try {
      setReport(await importBackup(picked))
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'that file could not be read')
    }
  }

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <p className="label">{SURFACE.quartermaster.name}</p>
          <h1 className="h1">SUPPLY</h1>
        </div>
      </header>

      <section className="surface__block">
        <p className="label">THE RECORD</p>
        <p className="lede">
          {goals.length} standards, {entries.length} dispatches, {events.length} entries in the
          chronicle — all of it in this browser, on this device. Nothing is sent anywhere and there
          is no copy but yours. Clearing site data deletes it, so export sometimes.
        </p>
        <div className="qm__actions">
          <button type="button" className="qm__primary" onClick={() => void exportBackup()}>
            EXPORT EVERYTHING
          </button>
          <button type="button" className="qm__secondary" onClick={() => file.current?.click()}>
            IMPORT A BACKUP
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => void onFile(e)}
          />
        </div>

        {problem && <p className="qm__problem">{problem}</p>}

        {report && (
          <div className="qm__report" role="status">
            <p className="lede">
              Read {report.goals} standards, {report.entries} dispatches, {report.events} chronicle
              entries{report.legacy ? ', carried over from a v1 almanac export' : ''}.
            </p>
            {report.repaired > 0 && (
              <p className="lede">
                {report.repaired} cached totals disagreed with their ledger and were rebuilt from
                it.
              </p>
            )}
            {report.rejected.length > 0 && (
              <details className="qm__rejected">
                <summary className="label">
                  {report.rejected.length} RECORDS COULD NOT BE READ
                </summary>
                <ul>
                  {report.rejected.slice(0, 20).map((r, i) => (
                    <li key={i}>
                      {r.table} #{r.index}: {r.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="lede">
              Your previous record was snapshotted before this import overwrote it.
            </p>
          </div>
        )}

        <p className="qm__legacy">
          <button
            type="button"
            onClick={() => void readLegacyBackup().then((v) => setLegacy(v ?? 'none found'))}
          >
            CHECK FOR ALMANAC DATA
          </button>
          {legacy && (
            <span className="label">
              {legacy === 'none found'
                ? 'NO v1 ALMANAC DATA ON THIS DEVICE'
                : `v1 ALMANAC DATA KEPT — ${legacy.length} BYTES, UNTOUCHED`}
            </span>
          )}
        </p>
      </section>

      <section className="surface__block">
        <p className="label">CAMP</p>
        <ul className="camps">
          {CAMPS.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`camps__item${settings.world === c.id ? ' is-on' : ''}`}
                aria-pressed={settings.world === c.id}
                onClick={() => void updateSettings({ world: c.id })}
              >
                <span className="camps__name">{c.name}</span>
                <span className="camps__note">{c.note}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="label">
          {WORLD_IDS.length} CAMPS · SAME TOKENS, SAME PRODUCT, DIFFERENT VALUES
        </p>
      </section>

      <section className="surface__block">
        <p className="label">STILL AIR</p>
        <p className="lede">
          Your system asks for reduced motion: {systemReduced ? 'yes' : 'no'}. Still air is not a
          stripped version — the wind drops and transitions arrive at once, and nothing else
          changes.
        </p>
        <div className="qm__choices" role="group" aria-label="Motion">
          {[
            { v: null, label: 'FOLLOW THE SYSTEM' },
            { v: true, label: 'ALWAYS STILL' },
            { v: false, label: 'ALWAYS MOVING' },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              aria-pressed={settings.reducedMotionOverride === o.v}
              onClick={() => void updateSettings({ reducedMotionOverride: o.v })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section className="surface__block">
        <p className="label">SOUND</p>
        <p className="lede">
          Five sounds, synthesised on the device — there are no audio files here. They mark things
          that happened: a dispatch landing, a gate passed, a standard taken, a siege falling, an
          honour. Nothing plays on hover, on focus, or while you type.
        </p>
        <div className="qm__choices" role="group" aria-label="Sound">
          {[
            { v: false, label: 'SILENT' },
            { v: true, label: 'SOUND ON' },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              aria-pressed={settings.sound === o.v}
              onClick={() => void updateSettings({ sound: o.v })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section className="surface__block">
        <p className="label">THE CAMPAIGN</p>
        <div className="qm__choices" role="group" aria-label="How the campaign is drawn">
          {[
            { v: 'auto' as const, label: 'DECIDE FOR ME' },
            { v: 'webgl' as const, label: 'ALWAYS THE CAMP' },
            { v: 'list' as const, label: 'ALWAYS THE ROLL' },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              aria-pressed={settings.universeRenderer === o.v}
              onClick={() => void updateSettings({ universeRenderer: o.v })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
