import { useMemo, useRef } from 'react'
import { Canvas, useFrame, type ThreeElements } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { CampaignPlan, Pitched } from './layout'
import { orbitPosition } from './layout'
import type { GoalState } from '@/domain/types'

/**
 * THE CAMPAIGN, pitched.
 *
 * Loaded only when it is going to be used — three and the fiber runtime are the
 * only genuinely heavy dependencies in the product, and they are never on the
 * path to logging a dispatch.
 *
 * What the scene is allowed to do: show WHERE things stand relative to each
 * other, WHAT belongs to what, and WHO stands with whom. What it is not allowed
 * to do: be the only place any of that can be read. Every fact here is also in
 * the roll, which is a peer surface and not a fallback.
 */

/**
 * Colour is read from the document so the scene follows the camp.
 *
 * Translucent tokens are composited over --ground first: THREE.Color has no
 * alpha channel and silently gives you white for an `rgba()` it cannot parse,
 * which turned the ground grid — the dimmest thing in the design — into the
 * brightest thing on screen.
 */
function readVar(name: string): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function tokenColour(name: string, fallback = '#ffffff'): THREE.Color {
  const raw = readVar(name)
  if (!raw) return new THREE.Color(fallback)

  const rgba = raw.match(
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i,
  )
  if (rgba) {
    const a = rgba[4] === undefined ? 1 : Number(rgba[4])
    const ground = new THREE.Color(readVar('--ground') || '#000000')
    const over = new THREE.Color(
      Number(rgba[1]) / 255,
      Number(rgba[2]) / 255,
      Number(rgba[3]) / 255,
    )
    return ground.clone().lerp(over, a)
  }

  try {
    return new THREE.Color(raw)
  } catch {
    return new THREE.Color(fallback)
  }
}

const STATE_TOKEN: Record<GoalState, string> = {
  new: '--state-new',
  active: '--state-active',
  critical: '--state-critical',
  stalled: '--state-stalled',
  paused: '--state-paused',
  completed: '--state-completed',
}

function Body({
  body,
  parent,
  selected,
  intensity,
  onSelect,
  onOpen,
}: {
  body: Pitched
  parent: Pitched | undefined
  selected: boolean
  intensity: number
  onSelect: () => void
  onOpen: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const { view } = body

  const colour = useMemo(() => tokenColour(STATE_TOKEN[view.state], '#d8b25e'), [view.state])
  const dye = useMemo(() => tokenColour(`--dye-${view.dye + 1}`, '#4a7fc1'), [view.dye])

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime

    if (body.orbits) {
      const p = orbitPosition(body, parent, t * intensity)
      g.position.set(p.x, p.y, p.z)
    }

    // PRESSURE: an unstable standard refuses to sit still. Amplitude comes from
    // the real deadline pressure, so it is invisible at a distance and
    // unmistakable up close — and it is never the only signal.
    if (view.state === 'critical') {
      g.position.x += Math.sin(t * 6) * 0.012 * view.pressure * intensity
    }
    // DECAY: a quiet standard drifts.
    if (view.state === 'stalled') {
      g.position.y += Math.sin(t * 0.6) * 0.004 * intensity
    }
  })

  const props: ThreeElements['group'] = {
    position: [body.x, body.y, body.z],
    onClick: (e) => {
      e.stopPropagation()
      onSelect()
    },
    onDoubleClick: (e) => {
      e.stopPropagation()
      onOpen()
    },
  }

  return (
    <group ref={group} {...props}>
      {/* The pole and the cloth: the same object as on the war table, standing
          in three dimensions. Cloth height is progress, exactly as it is there. */}
      <mesh position={[0, body.size * 1.2, 0]}>
        <cylinderGeometry args={[0.028, 0.028, body.size * 2.4, 6]} />
        <meshBasicMaterial color={colour} />
      </mesh>

      {/* The cloth hangs from the head of the pole and reaches DOWN by progress,
          so a full standard is a full banner — the same reading as the field. */}
      {view.fraction > 0 && (
        <mesh
          position={[body.size * 0.44, body.size * 2.4 - (view.fraction * body.size * 2.1) / 2, 0]}
        >
          <planeGeometry args={[body.size * 0.82, view.fraction * body.size * 2.1]} />
          <meshBasicMaterial color={dye} side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
      )}

      {/* The foot: a ring on the ground, sized by importance. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[body.size * 0.5, body.size * 0.5 + (selected ? 0.09 : 0.035), 32]} />
        <meshBasicMaterial color={selected ? tokenColour('--accent') : colour} />
      </mesh>

      {/* The name. HTML rather than a texture: it stays crisp, it is selectable,
          and it does not need a font atlas. */}
      {/* No zIndexRange override: drei's default stacks these above the canvas,
          and lowering it puts every name behind the thing it names. */}
      <Html center distanceFactor={11} position={[0, body.size * 2.9, 0]} prepend>
        <span className={`camp3d__label${selected ? ' is-selected' : ''}`}>{view.goal.title}</span>
      </Html>
    </group>
  )
}

/** Alliances and hierarchy, drawn as lines between feet. */
function Links({ plan }: { plan: CampaignPlan }) {
  const positions = useMemo(() => new Map(plan.bodies.map((b) => [b.view.goal.id, b])), [plan])
  const colour = useMemo(() => tokenColour('--rule-strong', '#666'), [])

  return (
    <>
      {plan.links.map((link) => {
        const a = positions.get(link.from)
        const b = positions.get(link.to)
        if (!a || !b) return null
        const points = [
          new THREE.Vector3(a.x, a.y + 0.02, a.z),
          new THREE.Vector3(b.x, b.y + 0.02, b.z),
        ]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        return (
          <primitive
            key={`${link.from}-${link.to}`}
            object={
              new THREE.Line(
                geometry,
                new THREE.LineBasicMaterial({
                  color: colour,
                  transparent: true,
                  opacity: link.hierarchy ? 0.55 : 0.28,
                }),
              )
            }
          />
        )
      })}
    </>
  )
}

/**
 * The ground the camp is pitched on. A grid is allowed HERE and nowhere else in
 * this product, because this surface actually is a map and the grid actually is
 * its scale — one square is one unit of distance from the command tent. It is
 * drawn at the dimmest token in the system so it stays underneath the camp
 * rather than competing with it.
 */
function Ground({ extent }: { extent: number }) {
  const colour = useMemo(() => tokenColour('--rule-hair', '#1a1a1a'), [])
  // gridHelper's first argument is the grid's full WIDTH, not its radius, so
  // this has to be twice the extent or the camp stands outside its own ground.
  const size = Math.ceil(extent * 2.4)
  return (
    <gridHelper
      args={[size, Math.max(4, Math.round(size / 2)), colour, colour]}
      position={[0, -0.01, 0]}
    />
  )
}

export default function CampaignScene({
  plan,
  selectedId,
  intensity,
  onSelect,
  onOpen,
}: {
  plan: CampaignPlan
  selectedId: string | null
  /** Momentum-driven multiplier on every motion in the scene. */
  intensity: number
  onSelect: (id: string | null) => void
  onOpen: (id: string) => void
}) {
  const byId = useMemo(() => new Map(plan.bodies.map((b) => [b.view.goal.id, b])), [plan])

  return (
    <Canvas
      camera={{ position: [0, plan.extent * 1.05, plan.extent * 1.35], fov: 40 }}
      dpr={[1, 2]}
      // The loop stops when nothing is moving and when the tab is hidden: there
      // is no permanent render loop in this product.
      frameloop={intensity > 0 ? 'always' : 'demand'}
      onPointerMissed={() => onSelect(null)}
      gl={{ antialias: true, alpha: true }}
    >
      <Ground extent={plan.extent} />
      <Links plan={plan} />
      {plan.bodies.map((body) => (
        <Body
          key={body.view.goal.id}
          body={body}
          parent={body.orbits ? byId.get(body.orbits) : undefined}
          selected={body.view.goal.id === selectedId}
          intensity={intensity}
          onSelect={() => onSelect(body.view.goal.id)}
          onOpen={() => onOpen(body.view.goal.id)}
        />
      ))}
      <OrbitControls
        makeDefault
        enablePan
        minDistance={3}
        maxDistance={plan.extent * 3}
        maxPolarAngle={Math.PI * 0.49}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  )
}
