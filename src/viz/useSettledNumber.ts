import { useEffect, useRef, useState } from 'react'
import { DURATION } from '@/design/motion'
import { useReducedMotion } from '@/shell/prefs'

/**
 * A figure that travels to its new value rather than blinking to it — SETTLE,
 * from the motion language. Ported in spirit from the v1 almanac's one authored
 * moment, including the part that mattered: a throttled tab can starve rAF, so
 * a timer owns the final value and the loop only paints on the way there.
 *
 * When motion is off the target is returned directly rather than pushed through
 * state, so no render is spent animating something that will not animate.
 */
export function useSettledNumber(target: number, enabled = true): number {
  const reduced = useReducedMotion()
  const still = reduced || !enabled

  const [value, setValue] = useState(target)
  const from = useRef(target)
  const frame = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (still) {
      from.current = target
      return
    }
    const start = from.current
    if (start === target) return

    const t0 = performance.now()
    const ms = DURATION.travel * 1000

    // The frames are decoration; the settle is not.
    const settle = () => {
      cancelAnimationFrame(frame.current)
      setValue(target)
      from.current = target
    }
    timer.current = setTimeout(settle, ms + 90)

    const step = (now: number) => {
      const p = Math.min((now - t0) / ms, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(start + (target - start) * eased)
      if (p < 1) frame.current = requestAnimationFrame(step)
      else settle()
    }
    frame.current = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(frame.current)
      clearTimeout(timer.current)
      from.current = target
    }
  }, [target, still])

  return still ? target : value
}
