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
 * The CSS half of this lives in `motion.css`, which owns every keyframe and the
 * `--dur-*` / `--ease-*` custom properties. The values below are the same
 * numbers, for the two places that need them in JavaScript: the settle hook and
 * the WebGL scene.
 *
 * Still air is handled by animating to the element's NATURAL state and then
 * cancelling the animation — never by hiding things — so the composition that
 * remains is exactly the one that was intended.
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
 * Ambient intensity, read by the WebGL scene. Driven by momentum so a strong
 * month genuinely feels different from a quiet one, and floored so a dormant
 * camp still breathes.
 */
export const ambientFor = (momentum: number, reduced: boolean) => ({
  /** Multiplier on every looping animation's amplitude. */
  amplitude: reduced ? 0 : 0.25 + momentum * 0.75,
  /** Multiplier on every looping animation's rate. */
  rate: reduced ? 0 : 0.6 + momentum * 0.8,
  /** Particle budget, before the device tier is applied. */
  particles: Math.round(reduced ? 0 : 120 + momentum * 480),
})

/**
 * The per-item delay for a staggered list, capped so a long list arrives as a
 * wave rather than a queue. Returns the value for `--i`, or null past the cap.
 */
export const STAGGER_CAP = 12
export const staggerIndex = (i: number): number => Math.min(i, STAGGER_CAP)
