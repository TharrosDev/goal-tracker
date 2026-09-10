import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas, useFrame, useThree, type ThreeElements } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { Terrain } from './Terrain'
import type { CampaignPlan, Pitched } from './layout'
import { orbitAt } from './layout'
import type { GoalState, WorldId } from '@/domain/types'

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
 *
 * THREE RULES THIS FILE LEARNED THE HARD WAY, all of them from bugs:
 *
 *   Nothing is constructed during render. A geometry or a material built in a
 *   render body is a GPU allocation that react-three-fiber will never dispose,
 *   because it refuses to dispose a <primitive> — its state may be held outside
 *   React. The ties used to build three objects per link per render, and this
 *   component re-renders on every click.
 *
 *   The frame loop SETS positions, it never adds to them. A wobble written as
 *   `position.y += sin(t)` is a discrete sum of a sine, which carries a
 *   permanent offset of roughly one over the frame period — two orders of
 *   magnitude past the intended amplitude, and worse on a 120 Hz display.
 *
 *   Angles accumulate, they are not recomputed from `elapsed * rate`. Multiply
 *   elapsed time by a rate that changes and every orbiting body teleports the
 *   moment the rate does — which here is every time momentum moves.
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

/**
 * Every body's live transform, by goal id.
 *
 * The ties need to know where things actually ARE, which is not where the plan
 * says they are pitched: a detachment is wherever its orbit has carried it this
 * frame. One shared registry is how the two halves of the scene agree.
 */
type Registry = Map<string, THREE.Object3D>

function Body({
  body,
  parent,
  selected,
  related,
  intensity,
  registry,
  showLabel,
  onSelect,
  onOpen,
}: {
  body: Pitched
  parent: Pitched | undefined
  selected: boolean
  /** Tied to, or belonging to, whatever is selected. */
  related: boolean
  intensity: number
  registry: Registry
  showLabel: boolean
  onSelect: () => void
  onOpen: () => void
}) {
  const group = useRef<THREE.Group>(null)
  /** Accumulated orbit angle. Never `elapsed * rate` — see the file comment. */
  const angle = useRef(body.phase)
  const wobble = useRef(0)
  const { view } = body

  const colour = useMemo(() => tokenColour(STATE_TOKEN[view.state], '#d8b25e'), [view.state])
  const dye = useMemo(() => tokenColour(`--dye-${view.dye + 1}`, '#4a7fc1'), [view.dye])
  const accent = useMemo(() => tokenColour('--accent', '#d8b25e'), [])
  const stone = useMemo(
    () => tokenColour('--ground-raised', '#151b27').lerp(tokenColour('--ink'), 0.15),
    [],
  )

  const id = view.goal.id
  useEffect(() => {
    const object = group.current
    if (!object) return
    registry.set(id, object)
    return () => {
      registry.delete(id)
    }
  }, [registry, id])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return

    // Clamped: a tab that was hidden for a minute hands back a delta of sixty
    // seconds, which would fling every detachment across the camp on the frame
    // somebody comes back to it.
    const step = Math.min(delta, 0.1) * intensity
    angle.current += step * body.spin
    wobble.current += step

    // SET, never add. The base seat first, then whatever the state adds to it.
    const seat = orbitAt(body, parent, angle.current)
    g.position.set(seat.x, seat.y, seat.z)

    // PRESSURE: an unstable standard refuses to sit still. Amplitude comes from
    // the real deadline pressure, so it is invisible at a distance and
    // unmistakable up close — and it is never the only signal.
    if (view.state === 'critical')
      g.position.x += Math.sin(wobble.current * 6) * 0.06 * view.pressure

    // DECAY: a quiet standard drifts.
    if (view.state === 'stalled') g.position.y += Math.sin(wobble.current * 0.6) * 0.09
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

  const boss = view.goal.boss
  const head = body.size * 2.4

  return (
    <group ref={group} {...props}>
      <mesh position={[0, -0.65, 0]}>
        <cylinderGeometry args={[body.size * 0.75, body.size * 0.92, 1.3, 6]} />
        <meshStandardMaterial color={stone} roughness={1} flatShading />
      </mesh>
      {/* The pole and the cloth: the same object as on the war table, standing
          in three dimensions. Cloth height is progress, exactly as it is there.
          A SIEGE is built differently rather than coloured differently — a
          thicker pole on a stepped stone base, which is what makes it read as a
          castle from across the camp and survives KURO, where every state token
          is a grey. */}
      <mesh position={[0, body.size * 1.2, 0]}>
        <cylinderGeometry args={[boss ? 0.075 : 0.028, boss ? 0.1 : 0.028, head, boss ? 8 : 6]} />
        <meshBasicMaterial color={colour} />
      </mesh>

      {boss && (
        <>
          {/* Four corner towers make a siege legible in silhouette. */}
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <group key={x + ':' + z} position={[x * body.size * 0.65, 0, z * body.size * 0.65]}>
                <mesh position={[0, body.size * 0.45, 0]}>
                  <boxGeometry args={[body.size * 0.24, body.size * 0.9, body.size * 0.24]} />
                  <meshStandardMaterial color={stone} roughness={0.9} />
                </mesh>
                <mesh position={[0, body.size * 0.98, 0]} rotation={[0, Math.PI / 4, 0]}>
                  <coneGeometry args={[body.size * 0.23, body.size * 0.2, 4]} />
                  <meshStandardMaterial color={colour} />
                </mesh>
              </group>
            )),
          )}
          {/* The keep: three courses, narrowing. */}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, body.size * (0.1 + i * 0.16), 0]}>
              <boxGeometry
                args={[
                  body.size * (0.95 - i * 0.2),
                  body.size * 0.14,
                  body.size * (0.95 - i * 0.2),
                ]}
              />
              <meshStandardMaterial color={stone} roughness={0.85} />
            </mesh>
          ))}
        </>
      )}

      {/* The cloth hangs from the head of the pole and reaches DOWN by progress,
          so a full standard is a full banner — the same reading as the field. */}
      {view.fraction > 0 && (
        <mesh position={[body.size * 0.44, head - (view.fraction * body.size * 2.1) / 2, 0]}>
          <planeGeometry args={[body.size * 0.82, view.fraction * body.size * 2.1]} />
          <meshBasicMaterial color={dye} side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
      )}

      {/* The foot: a ring on the ground, sized by importance. It thickens when
          the standard is chosen, and again — faintly — when it stands with
          whatever is chosen, so a selection reads as a formation. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry
          args={[
            body.size * 0.5,
            body.size * 0.5 + (selected ? 0.11 : related ? 0.07 : 0.035),
            boss ? 4 : 32,
          ]}
        />
        <meshBasicMaterial color={selected || related ? accent : colour} />
      </mesh>

      {/* The name. HTML rather than a texture: it stays crisp, it is selectable,
          and it does not need a font atlas.

          No `distanceFactor`: scaling names with distance put them at about
          seven pixels at the far end of the camera's range, which is a label
          nobody can read on the half of the scene that carries the information.
          They hold a constant size instead, and a crowded camp labels what
          matters rather than everything — the roll carries every name.

          No zIndexRange override either: drei's default stacks these above the
          canvas, and lowering it puts every name behind the thing it names. */}
      {(showLabel || selected) && (
        <Html center position={[0, body.size * 2.9, 0]} prepend>
          <span className={`camp3d__label${selected ? ' is-selected' : ''}`}>
            {view.goal.title}
          </span>
        </Html>
      )}
    </group>
  )
}

/**
 * Alliances and hierarchy, as ONE object.
 *
 * Every tie used to be its own THREE.Line built during render, with its own
 * geometry and its own material, none of which were ever disposed. This is a
 * single LineSegments over one buffer: two vertices per tie, positions rewritten
 * each frame from where the bodies actually are, and colour carried per vertex
 * so a selection can light its own formation without touching a material.
 */
function Ties({
  plan,
  registry,
  selectedId,
}: {
  plan: CampaignPlan
  registry: Registry
  selectedId: string | null
}) {
  const count = plan.links.length

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 6), 3))
    return g
  }, [count])

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }),
    [],
  )

  // The one place these are released. Nothing else in the scene allocates.
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  const palette = useMemo(
    () => ({
      hierarchy: tokenColour('--rule-strong', '#666'),
      alliance: tokenColour('--rule', '#444'),
      lit: tokenColour('--accent', '#d8b25e'),
      dim: tokenColour('--rule-hair', '#222'),
    }),
    [],
  )

  const byId = useMemo(() => new Map(plan.bodies.map((b) => [b.view.goal.id, b])), [plan])

  useFrame(() => {
    if (!count) return
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    const colours = geometry.getAttribute('color') as THREE.BufferAttribute

    for (let i = 0; i < count; i += 1) {
      const link = plan.links[i]!
      const a = registry.get(link.from)
      const b = registry.get(link.to)
      const from = a?.position ?? byId.get(link.from)
      const to = b?.position ?? byId.get(link.to)
      if (!from || !to) continue

      // Lifted off the ground so a tie is never coplanar with the grid.
      positions.setXYZ(i * 2, from.x, from.y + 0.02, from.z)
      positions.setXYZ(i * 2 + 1, to.x, to.y + 0.02, to.z)

      const touches = selectedId !== null && (link.from === selectedId || link.to === selectedId)
      const colour =
        selectedId === null
          ? link.hierarchy
            ? palette.hierarchy
            : palette.alliance
          : touches
            ? palette.lit
            : palette.dim

      colours.setXYZ(i * 2, colour.r, colour.g, colour.b)
      colours.setXYZ(i * 2 + 1, colour.r, colour.g, colour.b)
    }
    positions.needsUpdate = true
    colours.needsUpdate = true
  })

  if (!count) return null
  return <lineSegments geometry={geometry} material={material} frustumCulled={false} />
}

/**
 * Choosing a standard moves the camera to it, rather than cutting.
 *
 * The move is the only thing in this scene that is about the person rather than
 * about the data, and it is what makes the camp feel like somewhere you are
 * standing. In still air it is not a move at all: the camera is simply already
 * there, because a camera gliding across the screen is exactly the kind of
 * motion somebody who asked for less of it was asking about.
 */
function Focus({
  target,
  extent,
  animate,
}: {
  target: Pitched | null
  extent: number
  animate: boolean
}) {
  const controls = useThree((s) => s.controls) as {
    target: THREE.Vector3
    update: () => void
  } | null
  const want = useRef(new THREE.Vector3(0, extent * 0.22, 0))

  useEffect(() => {
    want.current.set(
      target ? target.x : 0,
      target ? target.y + target.size : extent * 0.22,
      target ? target.z : 0,
    )
    if (!animate && controls) {
      controls.target.copy(want.current)
      controls.update()
    }
  }, [target, extent, animate, controls])

  useFrame((_, delta) => {
    if (!animate || !controls) return
    if (controls.target.distanceToSquared(want.current) < 0.0004) return
    controls.target.lerp(want.current, Math.min(1, delta * 3.2))
    controls.update()
  })

  return null
}

/** Fit the opening formation to the actual canvas, including portrait tablets. */
function OpeningFrame({ extent }: { extent: number }) {
  const { camera, size, invalidate } = useThree()
  useEffect(() => {
    const fit = Math.max(1, size.height / size.width)
    camera.position.set(extent * 1.15 * fit, extent * 1.55 * fit, extent * 2.65 * fit)
    camera.lookAt(0, extent * 0.22, 0)
    invalidate()
  }, [camera, size.width, size.height, extent, invalidate])
  return null
}

/** Above this many standards, only what matters carries a name on the map. */
const LABEL_ALL_UNDER = 22

export default function CampaignScene({
  plan,
  selectedId,
  intensity,
  world,
  onSelect,
  onOpen,
}: {
  plan: CampaignPlan
  selectedId: string | null
  /** Momentum-driven multiplier on every motion in the scene. Zero is still air. */
  intensity: number
  /** The camp whose palette is in force. Re-reads the tokens when it changes. */
  world: WorldId
  onSelect: (id: string | null) => void
  onOpen: (id: string) => void
}) {
  const byId = useMemo(() => new Map(plan.bodies.map((b) => [b.view.goal.id, b])), [plan])
  /*
   * Held in state rather than a ref, because it is read during render to be
   * handed down. A ref read in a render body is exactly the pattern the lint
   * rule is there to catch, and a `useState` initialiser is the guarantee that
   * the map is made once and keeps its identity for the life of the scene.
   */
  const [registry] = useState<Registry>(() => new Map())

  /** Everything standing with what is chosen: its parent, its children, its ties. */
  const related = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const out = new Set<string>()
    for (const link of plan.links)
      if (link.from === selectedId) out.add(link.to)
      else if (link.to === selectedId) out.add(link.from)
    return out
  }, [plan.links, selectedId])

  const named = useMemo(() => {
    if (plan.bodies.length <= LABEL_ALL_UNDER) return null
    // A crowded camp names the heaviest standards and whatever is in play.
    const heaviest = [...plan.bodies]
      .sort((a, b) => b.view.weight - a.view.weight)
      .slice(0, LABEL_ALL_UNDER)
      .map((b) => b.view.goal.id)
    return new Set([...heaviest, ...related, ...(selectedId ? [selectedId] : [])])
  }, [plan.bodies, related, selectedId])

  const visible = useSyncExternalStore(
    (changed) => {
      document.addEventListener('visibilitychange', changed)
      return () => document.removeEventListener('visibilitychange', changed)
    },
    () => !document.hidden,
  )
  const still = intensity <= 0 || !visible
  const fogColour = useMemo(() => tokenColour('--ground', '#0c1018'), [])

  return (
    <Canvas
      /*
       * Framed for the NAMES, not for the bodies. Each standard's label floats
       * at 2.9x its own size above it, so a camera that frames the camp neatly
       * crops the labels off the top — which is the half of the scene carrying
       * the information.
       */
      camera={{ position: [0, plan.extent * 1.55, plan.extent * 2.65], fov: 38 }}
      // A phone's pixel ratio is where this scene gets expensive, and nothing
      // here is fine enough detail to need it: capped at 1.75.
      dpr={[1, 1.75]}
      // The loop stops when nothing is moving and when the tab is hidden: there
      // is no permanent render loop in this product. `demand` is genuinely
      // reachable now — still air sets the intensity to zero.
      frameloop={still ? 'demand' : 'always'}
      onPointerMissed={() => onSelect(null)}
      gl={{ antialias: true, alpha: true }}
      /*
       * Measure immediately and never on scroll.
       *
       * react-three-fiber renders NOTHING until its container measures
       * non-zero, and with the default debounce it can take its only reading
       * while this container's flex height is still resolving — after which no
       * genuine resize ever arrives to correct it, so the scene stays
       * permanently empty with nothing in the console. Costing a frame here is
       * cheaper than a camp that silently does not exist.
       */
      resize={{ debounce: 0, scroll: false }}
    >
      {/* `world` is not read here; it is in the key so every colour memo in the
          subtree is rebuilt when the camp changes. Reading a CSS custom property
          is not something React can see, so the remount is the subscription. */}
      <fog attach="fog" args={[fogColour, plan.extent * 5, plan.extent * 10]} />
      <group key={world}>
        <Terrain extent={plan.extent} />
        {plan.bodies.map((body) => (
          <Body
            key={body.view.goal.id}
            body={body}
            parent={body.orbits ? byId.get(body.orbits) : undefined}
            selected={body.view.goal.id === selectedId}
            related={related.has(body.view.goal.id)}
            intensity={intensity}
            registry={registry}
            showLabel={
              selectedId
                ? selectedId === body.view.goal.id || related.has(body.view.goal.id)
                : named === null || named.has(body.view.goal.id)
            }
            onSelect={() => onSelect(body.view.goal.id)}
            onOpen={() => onOpen(body.view.goal.id)}
          />
        ))}
        {/* After the bodies, so its frame callback reads positions this frame
            rather than last one. */}
        <Ties plan={plan} registry={registry} selectedId={selectedId} />
      </group>

      <OpeningFrame extent={plan.extent} />
      <Focus
        target={selectedId ? (byId.get(selectedId) ?? null) : null}
        extent={plan.extent}
        animate={!still}
      />

      <OrbitControls
        makeDefault
        /*
         * Aimed above the ground, not at it. The default target is the origin,
         * which centres the frame on an empty plane and pushes the standards —
         * and the names floating above them — off the top edge. Once something
         * is chosen, Focus owns the target.
         */
        target={[0, plan.extent * 0.22, 0]}
        enablePan
        minDistance={3}
        maxDistance={plan.extent * 10}
        maxPolarAngle={Math.PI * 0.49}
        enableDamping={!still}
        dampingFactor={0.08}
      />
    </Canvas>
  )
}
