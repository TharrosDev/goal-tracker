import { useEffect, useSyncExternalStore } from 'react'
import { useWorld } from '@/state/world'

/**
 * Device and person preferences that the whole interface reads: reduced motion,
 * pointer type, and the rendering tier the WebGL scene is allowed to use.
 *
 * These are read from the platform rather than guessed, and the person can
 * override the motion answer in settings — the OS setting is the default, not
 * the last word.
 */

function subscribeMedia(query: string) {
  return (onChange: () => void) => {
    const mq = window.matchMedia(query)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }
}

const mediaValue = (query: string) => () => window.matchMedia(query).matches

export function useMedia(query: string, serverValue = false): boolean {
  return useSyncExternalStore(subscribeMedia(query), mediaValue(query), () => serverValue)
}

/** The OS-level preference, before any in-app override. */
export const useSystemReducedMotion = (): boolean => useMedia('(prefers-reduced-motion: reduce)')

/**
 * The answer the application actually uses. An explicit choice in settings wins;
 * otherwise the operating system decides.
 */
export function useReducedMotion(): boolean {
  const system = useSystemReducedMotion()
  const override = useWorld((s) => s.settings.reducedMotionOverride)
  return override ?? system
}

export const useCoarsePointer = (): boolean => useMedia('(pointer: coarse)')
export const useNarrow = (): boolean => useMedia('(max-width: 900px)')

export type RenderTier = 'full' | 'reduced' | 'none'

let webglSupport: boolean | null = null

/** Cached one-off probe. Creating a throwaway context per render is expensive. */
export function supportsWebGL(): boolean {
  if (webglSupport !== null) return webglSupport
  try {
    const canvas = document.createElement('canvas')
    webglSupport = Boolean(
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl'),
    )
  } catch {
    webglSupport = false
  }
  return webglSupport
}

/**
 * What the universe is allowed to render.
 *
 * `none` is not a failure state — it is a first-class, fully featured list view.
 * Anyone can choose it from settings, and reduced motion selects it by default,
 * because a spinning galaxy is a poor way to read information you cannot watch.
 */
export function useRenderTier(): RenderTier {
  const preference = useWorld((s) => s.settings.universeRenderer)
  const reduced = useReducedMotion()
  const coarse = useCoarsePointer()

  if (preference === 'list') return 'none'
  if (preference === 'webgl') return supportsWebGL() ? 'full' : 'none'
  if (reduced || !supportsWebGL()) return 'none'
  // Phones get the scene, with a smaller budget: fewer particles, no post.
  return coarse || (navigator.hardwareConcurrency ?? 8) <= 4 ? 'reduced' : 'full'
}

/** Mirrors the chosen world and motion mode onto the document for CSS to read. */
export function useApplyWorld(): void {
  const world = useWorld((s) => s.settings.world)
  const reduced = useReducedMotion()
  useEffect(() => {
    document.documentElement.dataset.world = world
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'
  }, [world, reduced])
}
