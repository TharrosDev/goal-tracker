import { useEffect, useRef, type RefObject } from 'react'

/**
 * FOCUS, FOR THE THREE THINGS THAT COVER THE FIELD.
 *
 * The order book, the dispatch sheet and the sealing are modal: they sit over
 * everything and they own the keyboard while they are up. Nothing in this
 * product enforced that. Focus stayed on whatever opened the overlay, Tab
 * walked straight out of it into the surface behind, and closing it left focus
 * on an element that no longer existed — which sends a screen reader back to
 * the top of the document with no explanation.
 *
 * Written once and used three times, because three near-identical copies of
 * focus management is three places for it to be subtly wrong.
 */

/**
 * Everything inside `root` that a keyboard can reach, in document order.
 *
 * `disabled` and `[hidden]` are excluded by the selector; anything laid out at
 * zero size is excluded by the offsetParent check, which is what catches the
 * screen-reader-only radios in the plant form and the buttons inside a panel
 * that has been collapsed rather than unmounted.
 */
function reachable(root: HTMLElement): HTMLElement[] {
  const candidates = root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  return [...candidates].filter((el) => el.offsetParent !== null || el === document.activeElement)
}

export interface TrapOptions {
  /** Called on Escape. The overlay decides what leaving means. */
  onEscape?: () => void
  /**
   * What to focus on open. Defaults to the first reachable thing, which is
   * right for a sheet whose first control is its field, and wrong for a
   * ceremony, where the first thing should be the way out.
   */
  initial?: RefObject<HTMLElement | null>
  /** Off for an overlay that is decorative rather than modal. */
  enabled?: boolean
}

/**
 * Hold the keyboard inside `root` until it unmounts, then give it back to
 * whatever had it.
 *
 * The restore is the half people forget. It is also the half that matters most:
 * a person who opened the order book from a standard should come back to that
 * standard, not to the top of the page.
 */
export function useFocusTrap(root: RefObject<HTMLElement | null>, options: TrapOptions = {}): void {
  const { onEscape, initial, enabled = true } = options

  // Captured in a ref at mount so the cleanup restores what was focused THEN,
  // not whatever happens to be focused when the effect re-runs.
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!enabled) return
    const element = root.current
    if (!element) return

    restoreTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    // Every overlay in this product has something to focus. If one ever does
    // not, leaving the keyboard where it was is better than silently moving it
    // somewhere with nothing in it.
    const first = initial?.current ?? reachable(element)[0]
    first?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!onEscape) return
        e.preventDefault()
        e.stopPropagation()
        onEscape()
        return
      }
      if (e.key !== 'Tab') return

      const stops = reachable(element)
      if (!stops.length) {
        e.preventDefault()
        return
      }
      const firstStop = stops[0]!
      const lastStop = stops[stops.length - 1]!
      const active = document.activeElement

      // Wrap at both ends. Without this Tab walks out of the overlay and into
      // the surface behind it, which is still there and still clickable.
      if (!e.shiftKey && active === lastStop) {
        e.preventDefault()
        firstStop.focus()
      } else if (e.shiftKey && (active === firstStop || active === element)) {
        e.preventDefault()
        lastStop.focus()
      } else if (active instanceof Node && !element.contains(active)) {
        e.preventDefault()
        firstStop.focus()
      }
    }

    // Capture, so the overlay decides before the shell's own global handler
    // sees the key. Escape inside a modal is the more local meaning.
    element.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      element.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      // Only if it is still in the document: restoring focus to a detached node
      // silently drops it on the body.
      const back = restoreTo.current
      // A new modal may already have acquired focus while this one unmounts.
      // Restore only if focus still belongs to the outgoing modal or the body.
      const active = document.activeElement
      if (
        back &&
        back.isConnected &&
        (active === document.body || !active || element.contains(active))
      )
        back.focus()
    }
  }, [root, onEscape, initial, enabled])
}
