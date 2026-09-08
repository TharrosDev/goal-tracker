/**
 * THE CAMP'S SOUND.
 *
 * Three oscillators and an envelope. There are no audio files in this product
 * and there will not be: everything below is synthesised on the device, costs
 * nothing to ship, and works offline like the rest of it.
 *
 * Rules, all binding:
 *  - OFF by default. `settings.sound` gates every call, and nothing here is
 *    reached until somebody turns it on.
 *  - Nothing plays on hover, focus, navigation or typing. Sound marks things
 *    that HAPPENED — a dispatch landing, a gate passed, a standard taken.
 *  - The context is created on the first sound, never at import: browsers
 *    require a gesture, and constructing one at load leaves it suspended and
 *    warning in the console.
 *  - Every voice is short. The longest is the siege's low note at 2.4s.
 */

let context: AudioContext | null = null

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    context = new Ctor()
  }
  // Autoplay policy suspends the context until a gesture; every call site is
  // downstream of one, so resuming here is safe and cheap.
  if (context.state === 'suspended') void context.resume()
  return context
}

interface Voice {
  /** Hz. */
  freq: number
  /** Seconds. */
  duration: number
  type?: OscillatorType
  /** Peak gain, 0..1. Kept low: this is punctuation, not music. */
  gain?: number
  /** Seconds to wait before starting. */
  delay?: number
  /** Slide to this frequency over the voice's life. */
  to?: number
}

function play(voices: Voice[]): void {
  const audio = ctx()
  if (!audio) return
  const now = audio.currentTime

  for (const v of voices) {
    const start = now + (v.delay ?? 0)
    const osc = audio.createOscillator()
    const amp = audio.createGain()

    osc.type = v.type ?? 'sine'
    osc.frequency.setValueAtTime(v.freq, start)
    if (v.to !== undefined) osc.frequency.exponentialRampToValueAtTime(v.to, start + v.duration)

    // A fast attack and an exponential decay: a struck thing, not a swell.
    const peak = v.gain ?? 0.12
    amp.gain.setValueAtTime(0.0001, start)
    amp.gain.exponentialRampToValueAtTime(peak, start + 0.012)
    amp.gain.exponentialRampToValueAtTime(0.0001, start + v.duration)

    osc.connect(amp).connect(audio.destination)
    osc.start(start)
    osc.stop(start + v.duration + 0.02)
  }
}

/** Every sound the product makes. There are five. */
export const SOUNDS = {
  /** A dispatch landing. Barely there — this fires often. */
  dispatch: () => play([{ freq: 660, duration: 0.09, gain: 0.06, type: 'triangle' }]),

  /** A gate passed. Two notes, rising. */
  gate: () =>
    play([
      { freq: 523, duration: 0.14, gain: 0.09, type: 'triangle' },
      { freq: 784, duration: 0.22, gain: 0.09, type: 'triangle', delay: 0.1 },
    ]),

  /** A standard taken. A chord that settles. */
  taken: () =>
    play([
      { freq: 392, duration: 0.9, gain: 0.1 },
      { freq: 523, duration: 0.9, gain: 0.08, delay: 0.06 },
      { freq: 659, duration: 1.1, gain: 0.07, delay: 0.12 },
    ]),

  /** A siege falling. The low note DESIGN.md 12 specifies, and a rise over it. */
  siege: () =>
    play([
      { freq: 78, duration: 2.4, gain: 0.16 },
      { freq: 156, duration: 1.8, gain: 0.08, delay: 0.05 },
      { freq: 392, to: 784, duration: 1.2, gain: 0.07, type: 'triangle', delay: 0.5 },
    ]),

  /** An honour, or a rank. Bright and brief. */
  honour: () =>
    play([
      { freq: 880, duration: 0.18, gain: 0.08, type: 'triangle' },
      { freq: 1319, duration: 0.3, gain: 0.06, type: 'triangle', delay: 0.12 },
    ]),
} as const

export type SoundName = keyof typeof SOUNDS

/** The only entry point. A no-op unless sound is on. */
export function sound(name: SoundName, enabled: boolean): void {
  if (!enabled) return
  try {
    SOUNDS[name]()
  } catch {
    // A blocked or unavailable audio context must never break a mutation that
    // has already been written to the database.
  }
}
