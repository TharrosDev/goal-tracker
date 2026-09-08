/**
 * Local shapes rather than an import.
 *
 * These mirrored Motion's `Transition` and `Variants`, but every animation in
 * this product ships as CSS — which is GPU-friendly, costs nothing, and is
 * already doing the job — so the library was a dependency that existed only to
 * supply two type aliases that get erased at build. It is gone; this file stays
 * as what it always really was: the motion VOCABULARY and its tokens.
 */
type Transition = Record<string, unknown>
type Variants = Record<string, Record<string, unknown>>

/**
 * THE MOTION LANGUAGE
 *
 * Motion here is a vocabulary, not decoration. Six words, and every animation in
 * the product is one of them:
 *
 *   ENTER      something arrives in the world
 *   FORM       something is being created — it assembles rather than fades
 *   SETTLE     a number or a bar arrives at its new value
 *   PRESSURE   a deadline is close; the object refuses to sit still
 *   DECAY      a goal has gone quiet; it drifts and dims
 *   RESOLVE    something is finished, permanently
 *
 * If a proposed animation is not one of those, it does not go in.
 *
 * Reduced motion is handled by swapping the transition, never by deleting the
 * state change — the interface still moves between states, it just arrives
 * immediately, so nothing becomes unreachable or invisible.
 */

export const DURATION = {
  /** Direct manipulation feedback. Anything slower feels broken. */
  instant: 0.09,
  /** The default for state changes on a single element. */
  quick: 0.22,
  /** Panels, sheets, route content. */
  normal: 0.42,
  /** Counting a number up, a bar travelling — the v1 "travel" duration. */
  travel: 0.62,
  /** Camera moves and world transitions. */
  slow: 0.95,
  /** Ceremony beats. Long on purpose. */
  ceremony: 1.6,
} as const

/**
 * Easings. Two authored curves do nearly all the work: `out` for anything
 * arriving, `inOut` for anything that both leaves and arrives.
 */
export const EASE = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.76, 0, 0.24, 1],
  /** Overshoots slightly. Used only where something should feel physical. */
  back: [0.34, 1.56, 0.64, 1],
  /** Sharp start, long tail. For pressure and urgency. */
  snap: [0.05, 0.7, 0.1, 1],
} as const satisfies Record<string, [number, number, number, number]>

export const SPRING = {
  /** Interface elements. Fast, barely any overshoot. */
  crisp: { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 },
  /** Objects with apparent weight — goal bodies, drag targets. */
  heavy: { type: 'spring', stiffness: 180, damping: 26, mass: 1.4 },
  /** Magnetic hover and pointer-following. */
  magnetic: { type: 'spring', stiffness: 260, damping: 22, mass: 0.6 },
} as const satisfies Record<string, Transition>

/** Instant, but still a state change, so nothing depends on a transition firing. */
export const REDUCED: Transition = { duration: 0.001 }

export const transition = (t: Transition, reduced: boolean): Transition => (reduced ? REDUCED : t)

export const tween = (duration: number, ease: readonly number[] = EASE.out): Transition => ({
  duration,
  ease: ease as [number, number, number, number],
})

// ── the six words ───────────────────────────────────────────────────────────

/**
 * ENTER — arriving content. A short rise and a wipe, never a plain fade: fading
 * reads as loading, rising reads as arriving.
 */
export const enterVariants: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
  shown: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: tween(DURATION.normal),
  },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', transition: tween(DURATION.quick) },
}

/**
 * FORM — creation. The object assembles: it scales up from a line, its stroke
 * draws in, then its contents appear. Used by goal creation and by anything
 * entering the universe for the first time.
 */
export const formVariants: Variants = {
  hidden: { opacity: 0, scaleY: 0.02, scaleX: 0.6 },
  shown: {
    opacity: 1,
    scaleY: 1,
    scaleX: 1,
    transition: { ...tween(DURATION.slow, EASE.back), opacity: tween(DURATION.quick) },
  },
  exit: { opacity: 0, scaleY: 0.02, transition: tween(DURATION.quick) },
}

/** Stagger for a list arriving together. Capped so a long list is not a queue. */
export const stagger = (children: number, delay = 0) => ({
  transition: {
    staggerChildren: Math.min(0.05, 0.4 / Math.max(children, 1)),
    delayChildren: delay,
  },
})

/**
 * PRESSURE — a deadline closing in. Amplitude scales with 0..1 pressure so the
 * effect is invisible at a distance and unmistakable up close. It never blinks
 * and never turns red on its own; urgency is not punishment.
 */
export const pressureMotion = (pressure: number, reduced: boolean) =>
  reduced || pressure < 0.35
    ? {}
    : {
        animate: { x: [0, pressure * 1.2, 0, -pressure * 1.2, 0] },
        transition: { duration: 2.4 - pressure, repeat: Infinity, ease: 'linear' as const },
      }

/** DECAY — a stalled goal. Drifts slightly and sits at reduced opacity. */
export const decayMotion = (reduced: boolean) =>
  reduced
    ? { animate: { opacity: 0.55 } }
    : {
        animate: { opacity: [0.5, 0.62, 0.5], y: [0, 2, 0] },
        transition: { duration: 7, repeat: Infinity, ease: 'easeInOut' as const },
      }

/**
 * SETTLE — a value arriving. Returns the timing for a counter; the count itself
 * is driven by the caller so it can round to the goal's own unit.
 */
export const settle = (reduced: boolean): Transition =>
  reduced ? REDUCED : tween(DURATION.travel, EASE.out)

/** RESOLVE — completion. Collapses inward, then reappears transformed. */
export const resolveVariants: Variants = {
  live: { scale: 1, opacity: 1 },
  collapsing: { scale: 0.86, opacity: 0.9, transition: tween(0.3, EASE.inOut) },
  resolved: {
    scale: 1,
    opacity: 1,
    transition: { ...tween(DURATION.slow, EASE.back), delay: 0.1 },
  },
}

/**
 * Ambient intensity, read by the WebGL scene and the ambient CSS layers. Driven
 * by momentum so a strong month genuinely feels different from a quiet one.
 */
export const ambientFor = (momentum: number, reduced: boolean) => ({
  /** Multiplier on every looping animation's amplitude. */
  amplitude: reduced ? 0 : 0.25 + momentum * 0.75,
  /** Multiplier on every looping animation's rate. */
  rate: reduced ? 0 : 0.6 + momentum * 0.8,
  /** Particle budget, before the device tier is applied. */
  particles: Math.round(reduced ? 0 : 120 + momentum * 480),
})
