import { useWorld } from '@/state/world'
import { useWorldView } from '@/state/useWorldView'

/**
 * THE ONE LIVE REGION.
 *
 * A live region only announces a CHANGE INSIDE ITSELF. Every announcement in
 * this product used to arrive as a brand-new element carrying its text — the
 * sealing, the import report, the undo bar — and a region that appears already
 * full announces nothing at all, in every screen reader. The region has to be
 * in the document first and the words have to arrive into it second.
 *
 * So there is exactly one, it is mounted for the life of the application, and
 * everything that has something to say says it here. The visible surfaces are
 * then free to be as theatrical as they like without being the accessible name
 * of anything.
 */
export function Live() {
  const cue = useWorld((s) => s.ceremony)
  const world = useWorldView()

  const view = cue ? world.byId.get(cue.goalId) : undefined
  const title = view?.goal.title ?? 'A standard'

  let said = ''
  if (cue) {
    const gates = cue.gates.length
      ? ` ${cue.gates.length === 1 ? 'Gate passed' : `${cue.gates.length} gates passed`}: ${cue.gates.join(', ')}.`
      : ''
    const merit = cue.merit > 0 ? ` ${cue.merit} merit.` : ''
    const extra = cue.record ? ' A record.' : cue.recovery ? ' Raised again after a long quiet.' : ''

    said =
      cue.tier === 'siege'
        ? `${title} taken. The siege falls.${gates}${merit}`
        : cue.tier === 'taken'
          ? `${title} taken.${gates}${merit}`
          : cue.tier === 'gate'
            ? `${title}.${gates}${merit}`
            : `Dispatch recorded against ${title}.${extra}${merit}`
  }

  return (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {said}
    </p>
  )
}
