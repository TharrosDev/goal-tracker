import type { CSSProperties } from 'react'
import type { GoalView } from '@/state/selectors'
import { Mon } from '@/viz/Mon'

/** A goal's immutable crest and kind compose its ground; no second progress model. */
export function GoalPresence({ view }: { view: GoalView }) {
  const rhythm = view.goal.kind === 'habit' || view.goal.kind === 'streak'
  const clock = ['deadline', 'countdown'].includes(view.goal.kind)
  return (
    <div
      className="goal-presence"
      data-form={view.goal.boss ? 'fortress' : rhythm ? 'rhythm' : clock ? 'horizon' : 'standard'}
      data-state={view.state}
      aria-hidden="true"
      style={
        {
          '--presence': view.fraction,
          '--weight': view.goal.difficulty,
          '--dye': `var(--dye-${view.dye + 1})`,
        } as CSSProperties
      }
    >
      <div className="goal-presence__socket" />
      <div className="goal-presence__cloth">
        <Mon
          sigil={view.sigil}
          kind={view.goal.kind}
          state={view.state}
          fraction={view.fraction}
          dye={view.dye}
          size={240}
        />
      </div>
      <div className="goal-presence__steps">
        {Array.from({ length: view.goal.difficulty }, (_, i) => (
          <i key={i} style={{ '--step': i } as CSSProperties} />
        ))}
      </div>
    </div>
  )
}
