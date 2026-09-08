import { useEffect } from 'react'

/**
 * Global keyboard commands.
 *
 * One listener for the whole application. Every binding is a single key so the
 * hand never leaves the keyboard, and every one of them is also reachable by
 * pointer somewhere — a shortcut is an accelerator, never the only way in.
 */

export interface Binding {
  /** Lowercase key, or 'k' with `meta` for the palette. */
  key: string
  meta?: boolean
  label: string
  run: () => void
}

/**
 * True when the keystroke belongs to whatever the person is typing into.
 * Without this, pressing "n" inside a note field opens the create sequence.
 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function useHotkeys(bindings: Binding[], enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey

      // Escape is the one key that works while typing: it is how you leave.
      if (e.key === 'Escape') {
        const escape = bindings.find((b) => b.key === 'escape')
        if (escape) {
          e.preventDefault()
          escape.run()
        }
        return
      }

      if (isTyping(e.target)) return
      if (e.altKey || e.shiftKey) return

      const key = e.key.toLowerCase()
      const match = bindings.find((b) => b.key === key && Boolean(b.meta) === meta)
      if (!match) return
      e.preventDefault()
      match.run()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bindings, enabled])
}
