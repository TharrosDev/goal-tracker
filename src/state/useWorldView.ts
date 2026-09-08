import { useMemo } from 'react'
import { useWorld } from './world'
import { worldView, type WorldView } from './selectors'
import { today } from '@/domain/date'

/**
 * The one hook the interface reads. Recomputes the whole derived view whenever
 * the records change — cheap at this scale, and it means no component can hold a
 * stale or divergent copy of a number.
 */
export function useWorldView(): WorldView {
  const goals = useWorld((s) => s.goals)
  const milestones = useWorld((s) => s.milestones)
  const entries = useWorld((s) => s.entries)
  const events = useWorld((s) => s.events)
  const at = today()
  return useMemo(
    () => worldView({ goals, milestones, entries, events }, at),
    [goals, milestones, entries, events, at],
  )
}
