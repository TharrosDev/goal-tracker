import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useWorldView } from '@/state/useWorldView'
import { useWorld } from '@/state/world'
import { planCampaign } from '@/campaign/layout'
import { CampaignRoll } from '@/campaign/CampaignRoll'
import { useRenderTier } from '@/shell/prefs'
import { ambientFor } from '@/design/motion'
import { SURFACE } from '@/design/marks'
import './campaign.css'

/**
 * THE CAMPAIGN (戦) — the war table pulled back to every standard at once.
 *
 * Two renderings of one plan. The scene shows the camp in space; the roll shows
 * the same camp as a tree. Neither is a degraded version of the other, and the
 * choice is the person's — it is only DEFAULTED by what the device and the
 * motion preference can actually support.
 */
const CampaignScene = lazy(() => import('@/campaign/CampaignScene'))

export function Campaign() {
  const world = useWorldView()
  const navigate = useNavigate()
  const tier = useRenderTier()
  const settings = useWorld((s) => s.settings)
  const updateSettings = useWorld((s) => s.updateSettings)
  const [selected, setSelected] = useState<string | null>(null)
  const [showRoll, setShowRoll] = useState(tier === 'none')

  /**
   * Reorganising, from the map.
   *
   * The campaign was a reading surface: you could select and open, and nothing
   * else. Relationships had to be made on a standard's own ground, which is the
   * wrong place — a tie is a fact ABOUT THE MAP and it should be made on it.
   *
   * The model is pick-then-pick, which works identically in the scene and in
   * the roll and needs no dragging: choose a standard, choose what to do, then
   * choose the other standard. Escape leaves the mode at any point.
   */
  const [pending, setPending] = useState<{ action: 'tie' | 'under'; from: string } | null>(null)
  const toggleLink = useWorld((s) => s.toggleLink)
  const patchGoal = useWorld((s) => s.patchGoal)

  const live = useMemo(() => world.views.filter((v) => !v.goal.archived), [world.views])
  const plan = useMemo(() => planCampaign(live), [live])
  const ambient = ambientFor(world.momentum.score, tier === 'none')

  const scene = tier !== 'none' && !showRoll
  const chosen = world.byId.get(selected ?? '')
  const source = world.byId.get(pending?.from ?? '')

  useEffect(() => {
    if (!pending) return
    const leave = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Stops the shell's own Escape from also firing: leaving the mode is the
      // more local meaning of the key while a mode is armed.
      e.stopPropagation()
      setPending(null)
    }
    window.addEventListener('keydown', leave, true)
    return () => window.removeEventListener('keydown', leave, true)
  }, [pending])

  /** In a pending mode, picking a standard completes the act instead. */
  const pick = (id: string | null) => {
    if (!pending || !id || id === pending.from) {
      setSelected(id)
      return
    }
    if (pending.action === 'tie') void toggleLink(pending.from, id)
    else void patchGoal(pending.from, { parentId: id })
    setPending(null)
    setSelected(id)
  }

  if (!live.length)
    return (
      <div className="campaign campaign--empty">
        <span className="campaign__mark" aria-hidden="true">
          {SURFACE.campaign.mark}
        </span>
        <h1 className="mega">NO CAMP</h1>
        <p className="lede">
          Nothing is pitched here yet. The campaign is the war table pulled back — it fills as
          standards are planted.
        </p>
        <button type="button" className="campaign__plant" onClick={() => navigate('/plant')}>
          PLANT THE FIRST STANDARD
        </button>
      </div>
    )

  return (
    <div className="campaign">
      <header className="campaign__head enter">
        <div>
          <p className="label">{SURFACE.campaign.name}</p>
          <p className="campaign__count num">
            {plan.bodies.length} PITCHED · {plan.links.length} TIES
          </p>
        </div>

        <button type="button" className="campaign__plant-small" onClick={() => navigate('/plant')}>
          PITCH A STANDARD
        </button>

        <div className="campaign__views" role="group" aria-label="How to read the campaign">
          <button
            type="button"
            aria-pressed={scene}
            disabled={tier === 'none'}
            onClick={() => setShowRoll(false)}
          >
            THE CAMP
          </button>
          <button type="button" aria-pressed={!scene} onClick={() => setShowRoll(true)}>
            THE ROLL
          </button>
        </div>
      </header>

      {/*
        Shown whenever the device or the motion setting made the choice, not only
        when the roll is somehow unselected — the condition used to be
        `!showRoll`, which is never true here, so the person was handed the roll
        with no explanation and no visible way back.
      */}
      {tier === 'none' && (
        <p className="campaign__why label">
          THE ROLL IS SHOWN BECAUSE THIS DEVICE OR YOUR MOTION SETTING ASKS FOR IT.{' '}
          <button type="button" onClick={() => void updateSettings({ universeRenderer: 'webgl' })}>
            SHOW THE CAMP ANYWAY
          </button>
        </p>
      )}

      {pending && (
        <p className="campaign__pending" role="status">
          <span className="label">
            {pending.action === 'tie' ? 'TIE' : 'BELONGS TO'} — CHOOSE THE OTHER STANDARD
          </span>
          <span className="campaign__pending-from">{source?.goal.title}</span>
          <button type="button" onClick={() => setPending(null)}>
            CANCEL — ESC
          </button>
        </p>
      )}

      <div className="campaign__body">
        {scene ? (
          <Suspense fallback={<p className="label campaign__loading">PITCHING THE CAMP…</p>}>
            <CampaignScene
              plan={plan}
              selectedId={selected}
              intensity={ambient.rate}
              onSelect={pick}
              onOpen={(id) => navigate(`/standard/${id}`)}
            />
          </Suspense>
        ) : (
          <div className="campaign__roll enter">
            <CampaignRoll plan={plan} selectedId={selected} onSelect={pick} />
          </div>
        )}
      </div>

      {chosen && (
        <aside className="campaign__chosen" aria-live="polite">
          <p className="label">{chosen.sigil.callsign}</p>
          <p className="campaign__chosen-title">{chosen.goal.title}</p>
          <p className="label">
            {Math.round(chosen.fraction * 100)}% ·{' '}
            {chosen.arrival ? chosen.arrival.text : 'no hour'}
          </p>
          <div className="campaign__acts">
            <button type="button" onClick={() => navigate(`/standard/${chosen.goal.id}`)}>
              GO TO IT →
            </button>
            <button
              type="button"
              onClick={() => setPending({ action: 'tie', from: chosen.goal.id })}
            >
              TIE TO…
            </button>
            <button
              type="button"
              onClick={() => setPending({ action: 'under', from: chosen.goal.id })}
            >
              BELONGS TO…
            </button>
            <button type="button" onClick={() => navigate(`/plant?under=${chosen.goal.id}`)}>
              PLANT A DETACHMENT
            </button>
            {chosen.goal.parentId && (
              <button
                type="button"
                onClick={() => void patchGoal(chosen.goal.id, { parentId: null })}
              >
                FREE IT
              </button>
            )}
          </div>
        </aside>
      )}

      {settings.universeRenderer !== 'auto' && (
        <button
          type="button"
          className="campaign__reset label"
          onClick={() => void updateSettings({ universeRenderer: 'auto' })}
        >
          RESET TO AUTOMATIC
        </button>
      )}
    </div>
  )
}
