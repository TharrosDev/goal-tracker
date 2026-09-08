import { lazy, Suspense, useMemo, useState } from 'react'
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

  const live = useMemo(() => world.views.filter((v) => !v.goal.archived), [world.views])
  const plan = useMemo(() => planCampaign(live), [live])
  const ambient = ambientFor(world.momentum.score, tier === 'none')

  const scene = tier !== 'none' && !showRoll
  const chosen = world.byId.get(selected ?? '')

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
      <header className="campaign__head">
        <div>
          <p className="label">{SURFACE.campaign.name}</p>
          <p className="campaign__count num">
            {plan.bodies.length} PITCHED · {plan.links.length} TIES
          </p>
        </div>

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

      {tier === 'none' && !showRoll && (
        <p className="campaign__why label">
          THE ROLL IS SHOWN BECAUSE THIS DEVICE OR YOUR MOTION SETTING ASKS FOR IT.{' '}
          <button type="button" onClick={() => void updateSettings({ universeRenderer: 'webgl' })}>
            SHOW THE CAMP ANYWAY
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
              onSelect={setSelected}
              onOpen={(id) => navigate(`/standard/${id}`)}
            />
          </Suspense>
        ) : (
          <div className="campaign__roll">
            <CampaignRoll plan={plan} selectedId={selected} onSelect={setSelected} />
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
          <button type="button" onClick={() => navigate(`/standard/${chosen.goal.id}`)}>
            GO TO IT →
          </button>
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
