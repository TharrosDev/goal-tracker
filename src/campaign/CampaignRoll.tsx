import { useNavigate } from 'react-router'
import type { CampaignPlan } from './layout'
import type { GoalView } from '@/state/selectors'
import { staggerIndex } from '@/design/motion'
import { Mon } from '@/viz/Mon'
import { STATE_MARK } from '@/design/marks'
import { value } from '@/domain/format'
import './roll.css'

/**
 * THE ROLL — the campaign as a muster roll.
 *
 * This is a PEER of the scene, not a fallback from it. It carries the same
 * information — who is pitched where, what belongs to what, who stands with
 * whom — as a semantic tree that a screen reader walks and a keyboard drives.
 * It is what STILL AIR and a machine without WebGL get, and anybody can choose
 * it, because a slowly rotating camp is a poor way to read a list you actually
 * need to act on.
 */
export function CampaignRoll({
  plan,
  selectedId,
  onSelect,
}: {
  plan: CampaignPlan
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const navigate = useNavigate()
  const roots = plan.bodies.filter((b) => !b.orbits)
  const childrenOf = (id: string) => plan.bodies.filter((b) => b.orbits === id)

  const alliesOf = (view: GoalView) =>
    plan.links
      .filter((l) => !l.hierarchy && (l.from === view.goal.id || l.to === view.goal.id))
      .map((l) => (l.from === view.goal.id ? l.to : l.from))

  const nameOf = (id: string) =>
    plan.bodies.find((b) => b.view.goal.id === id)?.view.goal.title ?? id

  const Entry = ({ view, depth, index }: { view: GoalView; depth: number; index: number }) => {
    const allies = alliesOf(view)
    const mark = STATE_MARK[view.state]
    return (
      <li
        className={`roll__entry roll__entry--${depth}`}
        style={{ '--i': staggerIndex(index) } as React.CSSProperties}
      >
        <button
          type="button"
          className={`roll__row${view.goal.id === selectedId ? ' is-selected' : ''}`}
          onClick={() => onSelect(view.goal.id)}
          onDoubleClick={() => navigate(`/standard/${view.goal.id}`)}
        >
          <Mon
            sigil={view.sigil}
            kind={view.goal.kind}
            state={view.state}
            fraction={view.fraction}
            dye={view.dye}
            size={26}
          />
          <span className="roll__title">{view.goal.title}</span>
          <span className="roll__state label">{mark.name}</span>
          <span className="roll__figure num">
            {view.goal.target
              ? `${value(view.goal, view.goal.current)} / ${value(view.goal, view.goal.target)}`
              : `${Math.round(view.fraction * 100)}%`}
          </span>
          <span className="roll__hour label">{view.arrival ? view.arrival.text : 'no hour'}</span>
        </button>

        {allies.length > 0 && (
          <p className="roll__allies label">STANDS WITH {allies.map(nameOf).join(' · ')}</p>
        )}

        {childrenOf(view.goal.id).length > 0 && (
          <ul className="roll__detachments">
            {childrenOf(view.goal.id).map((child, i) => (
              <Entry key={child.view.goal.id} view={child.view} depth={depth + 1} index={i} />
            ))}
          </ul>
        )}
      </li>
    )
  }

  if (!roots.length)
    return (
      <p className="lede roll__empty">
        Nothing is pitched. The campaign fills as standards are planted.
      </p>
    )

  return (
    <ul className="roll stagger" aria-label="The muster roll">
      {roots.map((b, i) => (
        <Entry key={b.view.goal.id} view={b.view} depth={0} index={i} />
      ))}
    </ul>
  )
}
