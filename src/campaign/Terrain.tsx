import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

/** One static, low-poly landmass. Valleys stay below the canonical formation seats. */
export function Terrain({ extent }: { extent: number }) {
  const ground = getComputedStyle(document.documentElement)
    .getPropertyValue('--ground-raised')
    .trim()
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(extent * 4, extent * 4, 48, 48)
    const vertices = g.getAttribute('position')
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i),
        y = vertices.getY(i)
      const wave = Math.sin(x * 0.6) * Math.cos(y * 0.43) + Math.sin(x * 1.7 + y * 0.7) * 0.23
      vertices.setZ(i, -1.5 + wave * 0.55)
    }
    g.computeVertexNormals()
    return g
  }, [extent])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group>
      <ambientLight intensity={1.4} />
      <directionalLight position={[-10, 18, 6]} intensity={3.5} color={accent} />
      <directionalLight position={[12, 8, -12]} intensity={2} />
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color={ground}
          roughness={0.96}
          flatShading
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          onBeforeCompile={(shader) => {
            shader.uniforms.terrainExtent = { value: extent }
            shader.vertexShader =
              'varying float terrainRadius;\n' +
              shader.vertexShader.replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\nterrainRadius = length(position.xy);',
              )
            shader.fragmentShader =
              'varying float terrainRadius; uniform float terrainExtent;\n' +
              shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                '#include <dithering_fragment>\ngl_FragColor.a *= 1.0 - smoothstep(terrainExtent * 0.85, terrainExtent * 1.8, terrainRadius);',
              )
          }}
        />
      </mesh>
    </group>
  )
}
