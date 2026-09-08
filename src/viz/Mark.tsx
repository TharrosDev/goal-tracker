import type { Mark as MarkData } from '@/design/marks'
import './mark.css'

/**
 * A kanji mark and its English string, together, always.
 *
 * This component exists so the accessibility contract in DESIGN.md 14.1 is
 * structural rather than a habit: the kanji is `aria-hidden`, the English is
 * real text, and there is no way to render one without the other. If a mark ever
 * needs to appear alone, it appears alone *visually* — `label="hidden"` keeps
 * the English in the accessibility tree.
 */
export function Mark({
  of,
  label = 'after',
  className = '',
}: {
  of: MarkData
  /** Where the English sits, or 'hidden' to keep it for screen readers only. */
  label?: 'after' | 'before' | 'below' | 'hidden'
  className?: string
}) {
  const english =
    label === 'hidden' ? (
      <span className="sr-only">{of.name}</span>
    ) : (
      <span className="mark__name">{of.name}</span>
    )

  return (
    <span className={`mark mark--${label} ${className}`.trim()}>
      {label === 'before' ? english : null}
      <span className="mark__glyph" aria-hidden="true">
        {of.mark}
      </span>
      {label === 'before' ? null : english}
    </span>
  )
}
