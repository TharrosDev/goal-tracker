import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useWorld } from '@/state/world'
import { useWorldView } from '@/state/useWorldView'
import { Mon } from '@/viz/Mon'
import { SURFACE } from '@/design/marks'
import { GOAL_KINDS, type GoalKind, type Rating } from '@/domain/types'
import { KIND_LABEL } from '@/domain/format'
import { makeGoal, TARGETLESS, type NewGoal } from '@/domain/schema'
import { addDays, today } from '@/domain/date'
import { sigilOf } from '@/domain/identity'
import './plant.css'

/**
 * PLANTING A STANDARD.
 *
 * Two ways in, because they answer different needs. QUICK is for the thought you
 * do not want to lose: a name, a kind, done. THE RITUAL is for the thing you
 * actually intend to do, and it asks the questions that make a goal real —
 * mostly WHY, and mostly WHAT DOES FINISHED MEAN, because a goal that cannot
 * answer those two is a wish.
 *
 * The ritual is never mandatory. Anything it asks can be answered later, and
 * anything it collects can be left blank.
 */

const STAGES = [
  { key: 'what', mark: '旗', question: 'WHAT DO YOU WANT?' },
  { key: 'why', mark: '功', question: 'WHY?' },
  { key: 'done', mark: '了', question: 'WHAT DOES FINISHED MEAN?' },
  { key: 'when', mark: '刻', question: 'WHEN?' },
  { key: 'weight', mark: '城', question: 'HOW HARD IS THIS?' },
  { key: 'parts', mark: '門', question: 'BREAK IT DOWN.' },
  { key: 'commit', mark: '印', question: 'COMMIT.' },
] as const

export function Plant() {
  const navigate = useNavigate()
  // `?under=<id>` comes from PLANT A DETACHMENT on the campaign, so the map can
  // create something that already belongs to what you were looking at.
  const [params] = useSearchParams()
  const under = params.get('under')
  const createGoal = useWorld((s) => s.createGoal)
  const world = useWorldView()
  const [ritual, setRitual] = useState(false)
  const [stage, setStage] = useState(0)
  const [busy, setBusy] = useState(false)

  const [draft, setDraft] = useState<NewGoal & { gates: string }>({
    kind: 'money',
    title: '',
    target: null,
    unit: '',
    deadline: null,
    why: '',
    definitionOfDone: '',
    category: null,
    priority: 3,
    difficulty: 3,
    boss: false,
    parentId: under,
    gates: '',
  })

  const set = <K extends keyof typeof draft>(key: K, v: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [key]: v }))

  const needsTarget = !TARGETLESS.has(draft.kind)
  const canPlant = draft.title.trim().length > 0 && (!needsTarget || Number(draft.target) > 0)

  // The crest exists before the goal does, so the last stage can show what is
  // about to be planted rather than describing it.
  const preview = useMemo(() => {
    const provisional = makeGoal({ ...draft, title: draft.title || 'UNNAMED' })
    return { goal: provisional, sigil: sigilOf(provisional) }
  }, [draft])

  const plant = async () => {
    if (!canPlant || busy) return
    setBusy(true)
    try {
      const gates = draft.gates
        .split('\n')
        .map((g) => g.trim())
        .filter(Boolean)
      const goal = await createGoal(draft, gates)
      navigate(`/standard/${goal.id}`)
    } finally {
      setBusy(false)
    }
  }

  const categories = [...new Set(world.views.map((v) => v.goal.category).filter(Boolean))]
  const parentTitle = under ? (world.byId.get(under)?.goal.title ?? null) : null

  if (!ritual)
    return (
      <div className="plant enter">
        <p className="label">{SURFACE.standard.name}</p>
        <h1 className="h1">{under ? 'PLANT A DETACHMENT' : 'PLANT A STANDARD'}</h1>
        {parentTitle && (
          <p className="lede">
            It will belong to <b>{parentTitle}</b> and orbit it in the campaign.
          </p>
        )}

        <form
          className="plant__quick"
          onSubmit={(e) => {
            e.preventDefault()
            void plant()
          }}
        >
          <label className="plant__field">
            <span className="label">WHAT</span>
            <input
              className="plant__title"
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Name it"
              autoFocus
              required
            />
          </label>

          <KindPicker value={draft.kind} onChange={(k) => set('kind', k)} />

          {needsTarget && (
            <div className="plant__row">
              <label className="plant__field">
                <span className="label">TARGET</span>
                <input
                  className="plant__target num"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={draft.target ?? ''}
                  onChange={(e) =>
                    set('target', e.target.value === '' ? null : Number(e.target.value))
                  }
                  required
                />
              </label>
              {(draft.kind === 'numeric' || draft.kind === 'custom') && (
                <label className="plant__field">
                  <span className="label">UNIT</span>
                  <input
                    className="plant__unit"
                    value={draft.unit ?? ''}
                    onChange={(e) => set('unit', e.target.value)}
                    placeholder="km, books, lb"
                  />
                </label>
              )}
            </div>
          )}

          <label className="plant__field">
            <span className="label">{SURFACE.hour.name} — OPTIONAL</span>
            <input
              className="plant__date"
              type="date"
              value={draft.deadline ?? ''}
              min={today()}
              onChange={(e) => set('deadline', e.target.value || null)}
            />
            <span className="plant__note">
              Without an hour it stands in the reserve. That is a real place, not a lesser one.
            </span>
          </label>

          <div className="plant__actions">
            <button type="submit" className="plant__go" disabled={!canPlant || busy}>
              PLANT IT
            </button>
            <button type="button" className="plant__ritual" onClick={() => setRitual(true)}>
              OR TAKE THE OATH →
            </button>
          </div>
        </form>
      </div>
    )

  const current = STAGES[stage]!
  const last = stage === STAGES.length - 1

  return (
    <div className="plant plant--ritual">
      <ol className="oath__progress" aria-label="Stages">
        {STAGES.map((s, i) => (
          <li key={s.key} className={i <= stage ? 'is-done' : undefined}>
            <span className="sr-only">
              {s.question} {i === stage ? '(current)' : ''}
            </span>
            <span aria-hidden="true" className="oath__pip" />
          </li>
        ))}
      </ol>

      <div className="oath">
        <span className="oath__mark" aria-hidden="true">
          {current.mark}
        </span>
        <h1 className="h1 oath__question">{current.question}</h1>

        {current.key === 'what' && (
          <>
            <input
              className="plant__title"
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Name it"
              autoFocus
              aria-label="What do you want"
            />
            <KindPicker value={draft.kind} onChange={(k) => set('kind', k)} />
          </>
        )}

        {current.key === 'why' && (
          <>
            <textarea
              className="plant__prose"
              value={draft.why}
              onChange={(e) => set('why', e.target.value)}
              placeholder="The reason you will still be here in four months."
              rows={4}
              autoFocus
              aria-label="Why"
            />
            <p className="plant__note">
              This is the only part a cold reader — including you, after a month away — needs more
              than the number.
            </p>
          </>
        )}

        {current.key === 'done' && (
          <>
            <textarea
              className="plant__prose"
              value={draft.definitionOfDone}
              onChange={(e) => set('definitionOfDone', e.target.value)}
              placeholder="How will you know, without arguing with yourself?"
              rows={3}
              autoFocus
              aria-label="What does finished mean"
            />
            {needsTarget && (
              <div className="plant__row">
                <label className="plant__field">
                  <span className="label">TARGET</span>
                  <input
                    className="plant__target num"
                    type="number"
                    step="any"
                    value={draft.target ?? ''}
                    onChange={(e) =>
                      set('target', e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                </label>
                <label className="plant__field">
                  <span className="label">UNIT</span>
                  <input
                    className="plant__unit"
                    value={draft.unit ?? ''}
                    onChange={(e) => set('unit', e.target.value)}
                  />
                </label>
              </div>
            )}
          </>
        )}

        {current.key === 'when' && (
          <>
            <input
              className="plant__date"
              type="date"
              value={draft.deadline ?? ''}
              min={today()}
              onChange={(e) => set('deadline', e.target.value || null)}
              autoFocus
              aria-label="The hour"
            />
            <div className="oath__shortcuts">
              {[30, 90, 180, 365].map((d) => (
                <button key={d} type="button" onClick={() => set('deadline', addDays(today(), d))}>
                  {d} DAYS
                </button>
              ))}
              <button type="button" onClick={() => set('deadline', null)}>
                NO HOUR
              </button>
            </div>
          </>
        )}

        {current.key === 'weight' && (
          <>
            <Rating5
              label="DIFFICULTY"
              value={draft.difficulty ?? 3}
              onChange={(v) => set('difficulty', v)}
            />
            <Rating5
              label="PRIORITY"
              value={draft.priority ?? 3}
              onChange={(v) => set('priority', v)}
            />
            <label className="oath__boss">
              <input
                type="checkbox"
                checked={draft.boss ?? false}
                onChange={(e) => set('boss', e.target.checked)}
              />
              <span>
                This is a {SURFACE.siege.name.toLowerCase()} — a thing that takes seasons.
              </span>
            </label>
          </>
        )}

        {current.key === 'parts' && (
          <>
            <textarea
              className="plant__prose"
              value={draft.gates}
              onChange={(e) => set('gates', e.target.value)}
              placeholder={
                'One gate per line.\nThe first one should be small enough to pass this week.'
              }
              rows={6}
              autoFocus
              aria-label="Gates, one per line"
            />
            <label className="plant__field">
              <span className="label">HOUSE — OPTIONAL</span>
              <input
                className="plant__unit"
                list="houses"
                value={draft.category ?? ''}
                onChange={(e) => set('category', e.target.value || null)}
                placeholder="SAVINGS, BODY, WORK"
              />
              <datalist id="houses">
                {categories.map((c) => (
                  <option key={c} value={c!} />
                ))}
              </datalist>
              <span className="plant__note">Standards of one house fly the same dye.</span>
            </label>
          </>
        )}

        {current.key === 'commit' && (
          <div className="oath__commit">
            <Mon
              sigil={preview.sigil}
              kind={draft.kind}
              state="new"
              dye={0}
              fraction={0}
              size={120}
              title={`The crest for ${draft.title || 'this standard'}`}
            />
            <div>
              <p className="label">{preview.sigil.callsign}</p>
              <p className="oath__title">{draft.title || 'UNNAMED'}</p>
              <p className="lede">
                {draft.deadline
                  ? `Its hour is ${draft.deadline}.`
                  : 'It stands in the reserve, on no clock.'}{' '}
                {draft.gates.trim() ? `${draft.gates.trim().split('\n').length} gates.` : ''}
              </p>
            </div>
          </div>
        )}

        <div className="plant__actions">
          {stage > 0 && (
            <button type="button" className="plant__back" onClick={() => setStage((s) => s - 1)}>
              ← BACK
            </button>
          )}
          {last ? (
            <button
              type="button"
              className="plant__go"
              onClick={() => void plant()}
              disabled={!canPlant || busy}
            >
              PLANT IT
            </button>
          ) : (
            <button
              type="button"
              className="plant__go"
              onClick={() => setStage((s) => s + 1)}
              disabled={stage === 0 && !draft.title.trim()}
            >
              NEXT →
            </button>
          )}
          <button type="button" className="plant__ritual" onClick={() => setRitual(false)}>
            QUICK INSTEAD
          </button>
        </div>
      </div>
    </div>
  )
}

function KindPicker({ value, onChange }: { value: GoalKind; onChange: (k: GoalKind) => void }) {
  return (
    <fieldset className="kinds">
      <legend className="label">KIND</legend>
      {GOAL_KINDS.map((k) => (
        <label key={k} className={`kinds__item${k === value ? ' is-on' : ''}`}>
          <input
            type="radio"
            name="kind"
            value={k}
            checked={k === value}
            onChange={() => onChange(k)}
            className="sr-only"
          />
          {KIND_LABEL[k]}
        </label>
      ))}
    </fieldset>
  )
}

function Rating5({
  label,
  value,
  onChange,
}: {
  label: string
  value: Rating
  onChange: (v: Rating) => void
}) {
  return (
    <fieldset className="rating">
      <legend className="label">{label}</legend>
      {([1, 2, 3, 4, 5] as Rating[]).map((n) => (
        <label key={n} className={`rating__step${n <= value ? ' is-on' : ''}`}>
          <input
            type="radio"
            name={label}
            checked={n === value}
            onChange={() => onChange(n)}
            className="sr-only"
          />
          <span className="sr-only">
            {label} {n} of 5
          </span>
          <span aria-hidden="true">{n}</span>
        </label>
      ))}
    </fieldset>
  )
}
