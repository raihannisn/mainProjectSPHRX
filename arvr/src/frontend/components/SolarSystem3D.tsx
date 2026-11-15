import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  Object3D,
  SRGBColorSpace,
  type Group,
  type InstancedMesh,
  type Mesh,
} from 'three'
import { ErrorBoundary } from '../../xr/ErrorBoundary'
import { originOf, runWormhole } from '../wormhole'

/**
 * Interactive 3D Solar System for the Gateway (blueprint section 12): eight planets with the
 * proportions of the blueprint (Jupiter largest, Saturn second with a tilted, Cassini-gapped ring),
 * a one-draw-call InstancedMesh starfield, a pixel ratio capped at 1.5, a two-layer additive Sun
 * glow (no post-processing) and raycaster hover that names the planet and its distance in AU.
 *
 * Honest labelling: orbit sizes are compressed and sizes exaggerated, so the scene says
 * "illustrative · not to scale". It is not an ephemeris (the real positions live in /xr).
 */

interface PlanetDef {
  id: string
  name: string
  /** mean distance from the Sun, astronomical units (real value, shown in the HUD) */
  au: number
  /** display radius (blueprint proportions) */
  radius: number
  /** orbit radius in scene units (compressed) */
  orbit: number
  color: string
  /** latitude bands for the gas giants */
  bands?: [string, string]
  ringed?: boolean
  moon?: boolean
}

const PLANETS: PlanetDef[] = [
  { id: 'mercury', name: 'Mercury', au: 0.39, radius: 0.22, orbit: 2.7, color: '#a8a29e' },
  { id: 'venus', name: 'Venus', au: 0.72, radius: 0.38, orbit: 3.7, color: '#e8c48a' },
  { id: 'earth', name: 'Earth', au: 1.0, radius: 0.42, orbit: 4.8, color: '#3b82c4', moon: true },
  { id: 'mars', name: 'Mars', au: 1.52, radius: 0.28, orbit: 5.9, color: '#c1440e' },
  { id: 'jupiter', name: 'Jupiter', au: 5.2, radius: 1.05, orbit: 7.8, color: '#d6a26b', bands: ['#e8c9a0', '#b07a4a'] },
  { id: 'saturn', name: 'Saturn', au: 9.58, radius: 0.88, orbit: 9.9, color: '#e3cf8f', bands: ['#f0e2b0', '#c9b06f'], ringed: true },
  { id: 'uranus', name: 'Uranus', au: 19.2, radius: 0.54, orbit: 11.6, color: '#8fd4e0' },
  { id: 'neptune', name: 'Neptune', au: 30.05, radius: 0.52, orbit: 13.1, color: '#3b6fe0' },
]

const SUN_RADIUS = 1.3
const STAR_COUNT = 750
const TAU = Math.PI * 2

/** Planets with their own 3D scene in /xr; the others open the Solar System hub. */
const OWN_SCENE: Record<string, string> = { mars: '/xr/body/mars' }

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

let glowTexture: CanvasTexture | null = null
function getGlowTexture(): CanvasTexture | null {
  if (glowTexture || typeof document === 'undefined') return glowTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.14)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  glowTexture = new CanvasTexture(canvas)
  glowTexture.colorSpace = SRGBColorSpace
  return glowTexture
}

function bandTexture(a: string, b: string): CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  for (let y = 0; y < 128; y += 1) {
    const wave = 0.5 + 0.5 * Math.sin(y * 0.38) * Math.cos(y * 0.11)
    ctx.fillStyle = wave > 0.55 ? a : b
    ctx.globalAlpha = 0.55 + 0.45 * wave
    ctx.fillRect(0, y, 8, 1)
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

/** 750 stars in a spherical shell (radius 24-69): 55% white, 23% ice-blue, 12% sky-blue, 10% warm gold. One draw call. */
function Starfield() {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new Object3D()
    const color = new Color()
    for (let i = 0; i < STAR_COUNT; i += 1) {
      const radius = 24 + Math.random() * 45
      const theta = Math.random() * TAU
      const phi = Math.acos(2 * Math.random() - 1)
      dummy.position.set(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta))
      const s = 0.45 + Math.random() * 0.9
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      const roll = Math.random()
      color.set(roll < 0.55 ? '#ffffff' : roll < 0.78 ? '#cfe9ff' : roll < 0.9 ? '#38bdf8' : '#fde68a')
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, STAR_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[0.09, 6, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

/** Sun: bright core plus two additive glow sprites that breathe slowly. */
function Sun({ reduceMotion }: { reduceMotion: boolean }) {
  const inner = useRef<Mesh>(null)
  const outer = useRef<Mesh>(null)
  const glow = getGlowTexture()
  useFrame(({ clock }) => {
    if (reduceMotion) return
    const t = clock.elapsedTime
    inner.current?.scale.setScalar(1 + Math.sin(t * 1.6) * 0.035)
    outer.current?.scale.setScalar(1 + Math.sin(t * 0.9 + 1) * 0.06)
  })
  return (
    <group>
      <mesh>
        <sphereGeometry args={[SUN_RADIUS, 40, 40]} />
        <meshBasicMaterial color="#ffd166" toneMapped={false} />
      </mesh>
      {glow && (
        <>
          <sprite ref={inner as never} scale={[SUN_RADIUS * 4.4, SUN_RADIUS * 4.4, 1]}>
            <spriteMaterial map={glow} color="#ffb347" transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} />
          </sprite>
          <sprite ref={outer as never} scale={[SUN_RADIUS * 9, SUN_RADIUS * 9, 1]}>
            <spriteMaterial map={glow} color="#fde047" transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} />
          </sprite>
        </>
      )}
    </group>
  )
}

function Orbit({ radius, active }: { radius: number; active: boolean }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(128 * 3)
    for (let i = 0; i < 128; i += 1) {
      const a = (i / 128) * TAU
      arr[i * 3] = Math.cos(a) * radius
      arr[i * 3 + 2] = Math.sin(a) * radius
    }
    return arr
  }, [radius])
  return (
    <lineLoop>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={active ? '#4fe3d6' : '#38bdf8'} transparent opacity={active ? 0.7 : 0.22} />
    </lineLoop>
  )
}

interface PlanetProps {
  def: PlanetDef
  phase: number
  active: boolean
  reduceMotion: boolean
  onHover: (id: string | null) => void
  onPick: (id: string) => void
}

function Planet({ def, phase, active, reduceMotion, onHover, onPick }: PlanetProps) {
  const holder = useRef<Group>(null)
  const body = useRef<Mesh>(null)
  const moon = useRef<Group>(null)
  const angle = useRef(phase)
  const speed = 1.4 / Math.pow(def.orbit, 1.5)
  const bands = useMemo(() => (def.bands ? bandTexture(def.bands[0], def.bands[1]) : null), [def.bands])

  useFrame((_, dt) => {
    if (!reduceMotion) angle.current += Math.min(dt, 0.1) * speed
    holder.current?.position.set(Math.cos(angle.current) * def.orbit, 0, Math.sin(angle.current) * def.orbit)
    const m = body.current
    if (m) {
      if (!reduceMotion) m.rotation.y += Math.min(dt, 0.1) * 0.6
      const target = active ? 1.22 : 1
      m.scale.setScalar(m.scale.x + (target - m.scale.x) * 0.2)
    }
    if (moon.current && !reduceMotion) moon.current.rotation.y += Math.min(dt, 0.1) * 1.6
  })

  const hit = Math.max(def.radius * 1.5, 0.6)
  return (
    <group ref={holder}>
      <mesh ref={body}>
        <sphereGeometry args={[def.radius, 32, 24]} />
        <meshStandardMaterial color={bands ? '#ffffff' : def.color} map={bands ?? undefined} roughness={0.85} metalness={0} emissive={def.color} emissiveIntensity={active ? 0.35 : 0.08} />
      </mesh>
      {def.ringed && (
        <group rotation={[Math.PI / 2 - 0.466, 0, 0.2]}>
          {/* 26.7 degree axial tilt; two ring bands leave the Cassini Division between them */}
          <mesh>
            <ringGeometry args={[def.radius * 1.32, def.radius * 1.92, 96]} />
            <meshBasicMaterial color="#d9c48a" transparent opacity={0.78} side={DoubleSide} depthWrite={false} />
          </mesh>
          <mesh>
            <ringGeometry args={[def.radius * 2.02, def.radius * 2.35, 96]} />
            <meshBasicMaterial color="#b9a574" transparent opacity={0.6} side={DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}
      {def.moon && (
        <group ref={moon}>
          <mesh position={[0.85, 0, 0]}>
            <sphereGeometry args={[0.12, 16, 12]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
          </mesh>
        </group>
      )}
      {/* generous invisible target so small planets are easy to hover and tap */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(def.id)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          onHover(null)
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          e.stopPropagation()
          onPick(def.id)
        }}
      >
        <sphereGeometry args={[hit, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Pulls the camera back far enough to keep Neptune's orbit inside the frame, wide or narrow. */
function FitCamera() {
  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  useLayoutEffect(() => {
    const aspect = width / Math.max(1, height)
    const half = Math.tan((38 / 2) * (Math.PI / 180))
    // Neptune's orbit (13.1) plus margin must fit the narrower side of the frame
    const distance = Math.max(14.2 / (half * Math.min(1.7, aspect)), 30)
    camera.position.set(0, distance * 0.42, distance * 0.9)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, width, height])
  return null
}

interface SceneProps {
  activeId: string | null
  reduceMotion: boolean
  onHover: (id: string | null) => void
  onPick: (id: string) => void
}

function Scene({ activeId, reduceMotion, onHover, onPick }: SceneProps) {
  const phases = useMemo(() => PLANETS.map((_, i) => (i * 2.399963) % TAU), [])
  return (
    <>
      <FitCamera />
      <ambientLight intensity={0.55} />
      <pointLight position={[0, 0, 0]} intensity={4} decay={0} color="#fff4d6" />
      <Starfield />
      <Sun reduceMotion={reduceMotion} />
      {PLANETS.map((p) => (
        <Orbit key={`o-${p.id}`} radius={p.orbit} active={activeId === p.id} />
      ))}
      {PLANETS.map((p, i) => (
        <Planet key={p.id} def={p} phase={phases[i]} active={activeId === p.id} reduceMotion={reduceMotion} onHover={onHover} onPick={onPick} />
      ))}
    </>
  )
}

export function SolarSystem3D({ fallback }: { fallback: ReactNode }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const reduceMotion = useMemo(prefersReducedMotion, [])
  const activeId = hovered ?? pinned
  const active = PLANETS.find((p) => p.id === activeId) ?? null

  const open = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!active) return
    const to = OWN_SCENE[active.id] ?? '/xr'
    void runWormhole({ origin: originOf(event.currentTarget), label: `Opening ${active.name} in 3D…`, minMs: 650 }, () => navigate(to))
  }

  return (
    <div className="solar3d">
      <ErrorBoundary fallback={fallback}>
        <Canvas
          className="solar3d-canvas"
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 12, 32], fov: 38, near: 0.1, far: 200 }}
          onPointerMissed={() => setPinned(null)}
        >
          <Scene
            activeId={activeId}
            reduceMotion={reduceMotion}
            onHover={setHovered}
            onPick={(id) => setPinned((current) => (current === id ? null : id))}
          />
        </Canvas>
        <div className="solar3d-hud" aria-live="polite">
          {active ? (
            <button type="button" className="solar3d-pill active" onClick={open}>
              <b>{active.name}</b>
              <span>{active.au.toFixed(2)} AU from the Sun</span>
              <em>{OWN_SCENE[active.id] ? `Open ${active.name} in 3D` : 'Open the 3D Solar System'} ↗</em>
            </button>
          ) : (
            <span className="solar3d-pill">Hover or tap a planet</span>
          )}
          <span className="solar3d-note">ILLUSTRATIVE · NOT TO SCALE</span>
        </div>
      </ErrorBoundary>
    </div>
  )
}
