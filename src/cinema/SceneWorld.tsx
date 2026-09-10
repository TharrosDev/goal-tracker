import { useEffect, useRef, type CSSProperties } from 'react'
import { useLocation } from 'react-router'
import { useWorld } from '@/state/world'
import { useWorldView } from '@/state/useWorldView'
import { useReducedMotion } from '@/shell/prefs'
import { ENVIRONMENTS, intensityFor, spaceFor } from './environment'
import './cinema.css'

/** Scenery never owns information. The route and its instruments remain readable without it. */
export function SceneWorld() {
  const location = useLocation()
  const world = useWorldView()
  const camp = useWorld((s) => s.settings.world)
  const cue = useWorld((s) => s.ceremony)
  const reduced = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const space = spaceFor(location.pathname)
  const environment = ENVIRONMENTS[camp]
  const intensity = intensityFor(world.momentum.score, world.momentum.trend, cue?.tier === 'siege')
  const chamber = ['dojo', 'shrine', 'honours'].includes(space)

  // One phase for all environmental planes and field cloth. No React updates per frame.
  useEffect(() => {
    const node = root.current
    if (!node || reduced || space === 'dojo' || space === 'quartermaster') return
    let frame = 0
    let phase = 0
    let previous = 0
    let visible = true
    const score = world.momentum.score
    const tick = (time: number) => {
      phase += Math.min((time - previous) / 1000, 0.05) * (0.1 + score * 0.7)
      previous = time
      const wind = Math.sin(phase) * score * environment.direction
      node.style.setProperty('--air', String(wind))
      document.documentElement.style.setProperty('--camp-wind', String(wind))
      frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      if (!document.hidden && visible && score >= 0.12) frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting
      sync()
    })
    observer.observe(node)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      document.documentElement.style.setProperty('--camp-wind', '0')
    }
  }, [world.momentum.score, reduced, space, environment.direction])

  return (
    <div
      ref={root}
      className="scene-world"
      data-space={space}
      data-intensity={intensity}
      data-material={environment.material}
      aria-hidden="true"
      style={{ '--force': world.momentum.score } as CSSProperties}
    >
      {space !== 'quartermaster' && (
        <picture key={chamber ? 'chamber' : 'valley'} className="scene-world__plate">
          <source
            media="(max-width: 640px)"
            srcSet={`/assets/environments/${chamber ? 'chamber' : 'valley'}-v1-640.webp`}
          />
          <img
            src={`/assets/environments/${chamber ? 'chamber' : 'valley'}-v1-1536.webp`}
            alt=""
            decoding="async"
            loading={space === 'war' ? 'eager' : 'lazy'}
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden'
            }}
          />
        </picture>
      )}
      <div className="scene-world__veil" />
      <div className="scene-world__front" />
      <div key={location.key} className={`scene-cut scene-cut--${space}`} />
      {cue && <div key={cue.seq} className="scene-impact" />}
    </div>
  )
}

/** Route focus follows completed navigation, without stealing form autofocus. */
export function SceneFocus() {
  const location = useLocation()
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.camp__main')
    if (document.activeElement?.matches('input, textarea, select')) return
    main?.focus({ preventScroll: true })
  }, [location.pathname])
  return null
}
