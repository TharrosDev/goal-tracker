import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import type { CampaignPlan, Pitched } from './layout'
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
 *
 * Because it is a peer, anything the scene gains has to arrive here too. The
 * scene lights a selected standard's formation; the roll marks the same
 * standards as standing with it, in words, because a colour is not a fact a
 * screen reader can read.
 */

interface Ready {
  /** Root bodies, in the order they are pitched. */
  roots: Pitched[]
  childrenOf: Map<string, Pitched[]>
  alliesOf: Map<string, string[]>
  titleOf: Map<string, string>
}

/**
 * One pass over the plan instead of two scans per row per render.
 *
 * The roll is a recursive tree, and the previous shape looked up children and
 * allies by filtering the whole plan inside every entry — which is fine at five
 * standards and quadratic at fifty.
 */
function organise(plan: CampaignPlan): Ready {
  const childrenOf = new Map<string, Pitched[]>()
  const alliesOf = new Map<string, string[]>()
  const titleOf = new Map<string, string>()

  for (const body of plan.bodies) {
    titleOf.set(body.view.goal.id, body.view.goal.title)
    if (body.orbits) {
      const list = childrenOf.get(body.orbits)
      if (list) list.push(body)
      else childrenOf.set(body.orbits, [body])
    }
  }

  for (const link of plan.links) {
    if (link.hierarchy) continue
    for (const [a, b] of [
      [link.from, link.to],
      [link.to, link.from],
    ]) {
      const list = alliesOf.get(a!)
      if (list) list.push(b!)
      else alliesOf.set(a!, [b!])
    }
  }

  return { roots: plan.bodies.filter((b) => !b.orbits), childrenOf, alliesOf, titleOf }
}

/**
 * Defined at module scope, deliberately.
 *
 * This used to be declared inside the component body, which makes it a NEW
 * component type on every render: React unmounts the whole tree and mounts a
 * fresh one, so keyboard focus was thrown to the top of the page every time
 * anything changed — including the selection this list exists to make.
 */
function Entry({
  body,
  depth,
  index,
  ready,
  selectedId,
  standsWith,
  onSelect,
  onOpen,
}: {
  body: Pitched
  depth: number
  index: number
  ready: Ready
  selectedId: string | null
  standsWith: Set<string>
  onSelect: (id: string) => void
  onOpen: (id: string) => void
}) {
  const { view } = body
  const id = view.goal.id
  const allies = ready.alliesOf.get(id) ?? []
  const children = ready.childrenOf.get(id) ?? []
  const mark = STATE_MARK[view.state]
  const selected = id === selectedId
  const related = standsWith.has(id)

  return (
    <li
      className={`roll__entry roll__entry--${Math.min(depth, 3)}`}
      style={{ '--i': staggerIndex(index) } as React.CSSProperties}
    >
      <div className={`roll__pair${related ? ' is-related' : ''}`}>
        <button
          type="button"
          className={`roll__row${selected ? ' is-selected' : ''}`}
          // Selection is a state, not a colour: said here so it is said to
          // everybody, and not only to whoever can see the accent.
          aria-pressed={selected}
          onClick={() => onSelect(id)}
          onDoubleClick={() => onOpen(id)}
        >
          <Mon
            sigil={view.sigil}
            kind={view.goal.kind}
            state={view.state}
            fraction={view.fraction}
            dye={view.dye}
            size={26}
          />
          <span className="roll__title">
            {view.goal.title}
            {view.goal.boss && <b className="roll__siege label"> SIEGE</b>}
          </span>
          <span className="roll__state label">{mark.name}</span>
          <span className="roll__figure num">
            {view.goal.target
              ? `${value(view.goal, view.goal.current)} / ${value(view.goal, view.goal.target)}`
              : `${Math.round(view.fraction * 100)}%`}
          </span>
          <span className="roll__hour label">{view.arrival ? view.arrival.text : 'no hour'}</span>
          {related && <span className="sr-only">Stands with the chosen standard.</span>}
        </button>

        {/* Opening was double-click only, which no keyboard has. */}
        <button
          type="button"
          className="roll__open"
          onClick={() => onOpen(id)}
          aria-label={`Go to ${view.goal.title}`}
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {allies.length > 0 && (
        <p className="roll__allies label">
          STANDS WITH {allies.map((a) => ready.titleOf.get(a) ?? a).join(' · ')}
        </p>
      )}

      {children.length > 0 && (
        <ul className="roll__detachments">
          {children.map((child, i) => (
            <Entry
              key={child.view.goal.id}
              body={child}
              depth={depth + 1}
              index={i}
              ready={ready}
              selectedId={selectedId}
              standsWith={standsWith}
              onSelect={onSelect}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

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
  const ready = useMemo(() => organise(plan), [plan])

  /** The chosen standard's formation: what it belongs to, what belongs to it, who it stands with. */
  const standsWith = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const out = new Set<string>()
    for (const link of plan.links)
      if (link.from === selectedId) out.add(link.to)
      else if (link.to === selectedId) out.add(link.from)
    return out
  }, [plan.links, selectedId])

  if (!ready.roots.length)
    return (
      <p className="lede roll__empty">
        Nothing is pitched. The campaign fills as standards are planted.
      </p>
    )

  return (
    <ul className="roll stagger" aria-label="The muster roll">
      {ready.roots.map((b, i) => (
        <Entry
          key={b.view.goal.id}
          body={b}
          depth={0}
          index={i}
          ready={ready}
          selectedId={selectedId}
          standsWith={standsWith}
          onSelect={onSelect}
          onOpen={(id) => navigate(`/standard/${id}`)}
        />
      ))}
    </ul>
  )
}
