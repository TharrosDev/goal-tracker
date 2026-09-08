import { useSettledNumber } from './useSettledNumber'

/**
 * THE ONE NUMBER. Exactly one of these may be set at `--t-mega` per screen —
 * two mega numerals on one screen is a bug (DESIGN.md 6).
 */
export function Numeral({
  value,
  prefix = '',
  suffix = '',
  size = 'mega',
  label,
  animate = true,
  round = true,
}: {
  value: number
  prefix?: string
  suffix?: string
  size?: 'mega' | 'display' | 'h1'
  /** Accessible label. The digits alone rarely say what they are. */
  label?: string
  animate?: boolean
  round?: boolean
}) {
  const settled = useSettledNumber(value, animate)
  const shown = round ? Math.round(settled) : Math.round(settled * 100) / 100

  return (
    <span className={`numeral numeral--${size}`} role="img" aria-label={label ?? String(shown)}>
      {prefix && (
        <span className="numeral__affix" aria-hidden="true">
          {prefix}
        </span>
      )}
      <span className={`${size} num numeral__digits`} aria-hidden="true">
        {shown.toLocaleString('en-CA')}
      </span>
      {suffix && (
        <span className="numeral__affix" aria-hidden="true">
          {suffix}
        </span>
      )}
    </span>
  )
}
