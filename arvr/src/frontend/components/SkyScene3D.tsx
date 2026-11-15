import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { AdditiveBlending, CanvasTexture, Euler, SRGBColorSpace, Vector3, type Group } from 'three'

export type SkyMarkerId = 'rcw-36' | 'candidate-02' | 'demo-tile-01'

interface SkyScene3DProps {
  selectedId: SkyMarkerId
  onSelect: (id: SkyMarkerId) => void
  /** Drag rotation in degrees, mirroring the CSS disc transform it replaces. */
  rotation: { x: number; y: number }
  /** Wheel zoom factor (1 = default framing). */
  scale?: number
}

type ViewportSize = { width: number; height: number }

const DEG = Math.PI / 180

function markerPosition(marker: (typeof MARKERS)[number], viewport: ViewportSize): [number, number, number] {
  return [(marker.left / 100 - 0.5) * viewport.width, (0.5 - marker.top / 100) * viewport.height, marker.z]
}

/** Markers keep the old CSS anchor percentages so the composition is unchanged. */
const MARKERS = [
  {
    id: 'rcw-36' as const,
    label: 'RCW 36',
    aria: 'RCW 36 Emission Nebula (catalog target)',
    left: 57,
    top: 38,
    z: 0.16,
    color: '#4fe3d6',
    tone: 'fact',
  },
  {
    id: 'candidate-02' as const,
    label: 'Candidate · illustrative',
    aria: 'Illustrative candidate marker',
    left: 34,
    top: 57,
    z: -0.12,
    color: '#fde047',
    tone: 'candidate',
  },
  {
    id: 'demo-tile-01' as const,
    label: 'Sample · illustrative',
    aria: 'Illustrative tile marker',
    left: 70,
    top: 66,
    z: 0.04,
    color: '#ffb347',
    tone: 'demo',
  },
]

/** Soft radial sprite shared by every glow in the scene (built once). */
let glowTexture: CanvasTexture | null = null
function getGlowTexture(): CanvasTexture | null {
  if (glowTexture || typeof document === 'undefined') return glowTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.22, 'rgba(255,255,255,0.6)')
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.16)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  glowTexture = new CanvasTexture(canvas)
  glowTexture.colorSpace = SRGBColorSpace
  return glowTexture
}

function ellipsePoints(radius: number, squash: number, tiltDeg: number, segments = 128) {
  const points: [number, number, number][] = []
  const tilt = tiltDeg * DEG
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius * squash
    points.push([x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt), 0])
  }
  return points
}

/** Keeps the wheel-zoom factor mapped to camera distance, eased like the CSS transition. */
function CameraZoom({ scale }: { scale: number }) {
  const camera = useThree((state) => state.camera)
  useFrame(() => {
    const clamped = Math.max(0.75, Math.min(1.35, scale))
    const target = 3.9 / clamped
    camera.position.z += (target - camera.position.z) * 0.14
    camera.updateProjectionMatrix()
  })
  return null
}

function Stars() {
  const positions = useMemo(() => {
    const count = 620
    const array = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      array[i * 3] = (Math.random() - 0.5) * 20
      array[i * 3 + 1] = (Math.random() - 0.5) * 13
      array[i * 3 + 2] = -1 - Math.random() * 9
    }
    return array
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#cfe9ff" transparent opacity={0.78} sizeAttenuation depthWrite={false} />
    </points>
  )
}

function SkyDisc({ viewport }: { viewport: ViewportSize }) {
  const glow = getGlowTexture()
  const radius = Math.min(viewport.width * 0.42, viewport.height * 0.72)
  const rings = useMemo(
    () => [
      { squash: 0.34, tilt: 0 },
      { squash: 0.34, tilt: 68 },
      { squash: 0.34, tilt: 118 },
    ],
    [],
  )

  return (
    <group>
      <mesh>
        <circleGeometry args={[radius, 96]} />
        <meshBasicMaterial color="#0d2438" transparent opacity={0.58} depthWrite={false} />
      </mesh>
      {glow && (
        <sprite scale={[radius * 2.15, radius * 2.15, 1]} position={[-radius * 0.06, radius * 0.04, -0.02]}>
          <spriteMaterial
            map={glow}
            color="#2f7f8f"
            transparent
            opacity={0.42}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      )}
      <mesh>
        <ringGeometry args={[radius * 0.995, radius, 128]} />
        <meshBasicMaterial color="#68cdd3" transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      {rings.map((ring) => (
        <Line
          key={ring.tilt}
          points={ellipsePoints(radius * 0.9, ring.squash, ring.tilt)}
          color="#99bdd0"
          lineWidth={1}
          transparent
          opacity={0.26}
        />
      ))}
      <Line points={ellipsePoints(radius * 0.62, 0.34, 26)} color="#a0bdd3" lineWidth={1} transparent opacity={0.18} />
      <Line points={ellipsePoints(radius * 0.72, 0.34, -52)} color="#a0bdd3" lineWidth={1} transparent opacity={0.14} />
      <Line
        points={[
          [-radius * 0.96, radius * 0.42, 0],
          [radius * 0.96, -radius * 0.42, 0],
        ]}
        color="#a0bdd3"
        lineWidth={1}
        transparent
        opacity={0.16}
      />
      <Line
        points={[
          [-radius * 0.36, -radius * 0.86, 0],
          [radius * 0.36, radius * 0.86, 0],
        ]}
        color="#a0bdd3"
        lineWidth={1}
        transparent
        opacity={0.14}
      />
    </group>
  )
}

interface MarkerProps {
  marker: (typeof MARKERS)[number]
  active: boolean
  viewport: ViewportSize
  reduceMotion: boolean
}

function SkyMarker({ marker, active, viewport, reduceMotion }: MarkerProps) {
  const ringRef = useRef<Group>(null)
  const glow = getGlowTexture()

  useFrame((state) => {
    const ring = ringRef.current
    if (!ring) return
    const t = state.clock.elapsedTime
    const pulse = reduceMotion ? 1 : active ? 1 + Math.sin(t * 2.6) * 0.14 : 1 + Math.sin(t * 1.3) * 0.05
    ring.scale.setScalar(pulse)
  })

  return (
    <group position={markerPosition(marker, viewport)}>
      {glow && (
        <sprite scale={[0.5, 0.5, 1]}>
          <spriteMaterial
            map={glow}
            color={marker.color}
            transparent
            opacity={active ? 0.9 : 0.55}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      )}
      <group ref={ringRef}>
        <mesh>
          <ringGeometry args={[0.05, 0.057, 48]} />
          <meshBasicMaterial color={marker.color} transparent opacity={0.92} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      <mesh>
        <circleGeometry args={[0.032, 24]} />
        <meshBasicMaterial color="#071020" />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <circleGeometry args={[0.013, 16]} />
        <meshBasicMaterial color={marker.color} />
      </mesh>
    </group>
  )
}

interface SkyContentsProps extends Pick<SkyScene3DProps, 'selectedId' | 'rotation' | 'scale'> {
  markerElements: Map<SkyMarkerId, HTMLButtonElement>
}

function SkyContents({ selectedId, rotation, scale, markerElements }: SkyContentsProps) {
  const viewport = useThree((state) => state.viewport)
  const camera = useThree((state) => state.camera)
  const point = useMemo(() => new Vector3(), [])
  const markerRotation = useMemo(() => new Euler(rotation.x * DEG, rotation.y * DEG, 0), [rotation.x, rotation.y])
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useFrame(() => {
    for (const marker of MARKERS) {
      const element = markerElements.get(marker.id)
      if (!element) continue
      point.fromArray(markerPosition(marker, viewport)).applyEuler(markerRotation).project(camera)
      element.style.left = `${(point.x + 1) * 50}%`
      element.style.top = `${(1 - point.y) * 50}%`
      element.style.visibility = point.z >= -1 && point.z <= 1 ? 'visible' : 'hidden'
    }
  })

  return (
    <>
      <CameraZoom scale={scale ?? 1} />
      <group rotation={[rotation.x * DEG, rotation.y * DEG, 0]}>
        <SkyDisc viewport={viewport} />
        {MARKERS.map((marker) => (
          <SkyMarker
            key={marker.id}
            marker={marker}
            active={selectedId === marker.id}
            viewport={viewport}
            reduceMotion={reduceMotion}
          />
        ))}
      </group>
      <Stars />
    </>
  )
}

/**
 * The real WebGL sky that used to live only in the XR app, embedded in the
 * frontend Sky Explorer: dome, orbit rings and interactive markers. Drag and
 * wheel stay wired to the parent viewport so the gesture model is unchanged.
 */
export function SkyScene3D({ selectedId, onSelect, rotation, scale = 1 }: SkyScene3DProps) {
  const markerElements = useRef(new Map<SkyMarkerId, HTMLButtonElement>())

  return (
    <div className="sky3d">
      <Canvas
        className="sky3d-canvas"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 3.9], fov: 42, near: 0.1, far: 60 }}
      >
        <SkyContents
          selectedId={selectedId}
          rotation={rotation}
          scale={scale}
          markerElements={markerElements.current}
        />
      </Canvas>
      <div className="sky3d-marker-layer" aria-label="Sky targets">
        {MARKERS.map((marker) => (
          <button
            key={marker.id}
            ref={(element) => {
              if (element) markerElements.current.set(marker.id, element)
              else markerElements.current.delete(marker.id)
            }}
            type="button"
            className={`sky3d-marker ${marker.tone} ${selectedId === marker.id ? 'active' : ''}`}
            onClick={() => onSelect(marker.id)}
            aria-label={marker.aria}
            aria-pressed={selectedId === marker.id}
          >
            <span className="sky3d-label">{marker.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
