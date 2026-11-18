import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { Group, Raycaster, Vector2, Vector3 } from 'three'
import { useXRApp } from './store'
import { viewCamera } from './viewCamera'
import { Button, GlassPanel } from './ui3d'
import { haptic } from './feedback'

/**
 * AR keeps the model in ONE place, on a surface, that you choose.
 *
 * Phone camera view (Camera AR): a phone browser cannot see your table, so the surface is an assumption: a flat
 * plane a fixed height below the phone (Table = 0.5 m, Floor = 1.35 m). The model sits on that plane where the
 * centre of the screen points, so aiming at your table puts it on your table. Tap the screen, or press "Place here",
 * to pin it exactly there; it then stays put while the phone turns. "Pick up" lets it follow your aim again,
 * "Reset" brings it back and re-centres the compass. (The phone's motion sensors give turning, not position, so
 * walking toward the model does not change its distance.)
 *
 * Headset passthrough (WebXR AR): the floor is known (y = 0), so the model is placed in front of you, pinned after a
 * moment, with 3D Place / Reset buttons under it.
 */

/** Radius (in scene units) of what has to fit: the holo orbit ring of a planet, the outer orbit of the chart. */
export function contentRadius(bodyId: string) {
  return bodyId === 'solar' ? 3.4 : bodyId === 'saturn' ? 2.5 : 1.62
}
/** The Solar System chart is a flat disc, so it lies on the surface; a planet is a ball that rests on it. */
const isFlat = (bodyId: string) => bodyId === 'solar'

/** How far below the phone the assumed surface is, in metres. */
export const SURFACE_DROP = { table: 0.5, floor: 1.35 } as const
/** Apparent size: the model is this many metres of radius per metre of distance (kept when pinned), within limits. */
const ANGULAR = 0.28
const MIN_RADIUS = 0.07
const MAX_RADIUS = 0.3
const MIN_DIST = 0.4
const MAX_DIST = 3.2

const HEADSET = { distance: 1.0, radius: 0.32, drop: 0.2 }

const _fwd = new Vector3()
const _pos = new Vector3()
const _dir = new Vector3()
const _hit = new Vector3()
const _ndc = new Vector2()

/** Where a ray from `origin` along `dir` meets the plane y = planeY; looking up or too steep a miss, it lands straight ahead. */
export function surfacePoint(origin: Vector3, dir: Vector3, planeY: number, out: Vector3) {
  if (dir.y < -0.06) {
    const t = (planeY - origin.y) / dir.y
    out.copy(dir).multiplyScalar(t).add(origin)
    const flat = Math.hypot(out.x - origin.x, out.z - origin.z)
    if (flat > MAX_DIST) {
      const k = MAX_DIST / flat
      out.x = origin.x + (out.x - origin.x) * k
      out.z = origin.z + (out.z - origin.z) * k
    } else if (flat < MIN_DIST) {
      // looking almost straight down: push it out in front, so it is not under your hand
      _fwd.set(dir.x, 0, dir.z)
      if (_fwd.lengthSq() < 1e-4) _fwd.set(0, 0, -1)
      _fwd.normalize()
      out.x = origin.x + _fwd.x * MIN_DIST
      out.z = origin.z + _fwd.z * MIN_DIST
    }
  } else {
    _fwd.set(dir.x, 0, dir.z)
    if (_fwd.lengthSq() < 1e-4) _fwd.set(0, 0, -1)
    _fwd.normalize()
    out.set(origin.x + _fwd.x * 1.2, 0, origin.z + _fwd.z * 1.2)
  }
  out.y = planeY
  return out
}

function scaleForDistance(bodyId: string, distance: number) {
  const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, ANGULAR * distance))
  return radius / contentRadius(bodyId)
}

/** Wraps the scene content. `mode` is 'camera' (gyro + camera feed) or 'xr' (immersive AR, passthrough). */
export function ArAnchor({ bodyId, mode, children }: { bodyId: string; mode: 'camera' | 'xr'; children: ReactNode }) {
  const group = useRef<Group>(null)
  const locked = useXRApp((s) => s.arLocked)
  const surface = useXRApp((s) => s.arSurface)
  const resetNonce = useXRApp((s) => s.arResetNonce)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const raycaster = useRef(new Raycaster())
  const lockedRef = useRef(locked)
  lockedRef.current = locked
  const surfaceRef = useRef(surface)
  surfaceRef.current = surface
  const placedOnce = useRef(false)
  /** a tap has put the model down; the pin itself is applied just after the click has reached every handler */
  const pinning = useRef(false)
  const warm = useRef(0)
  const scaleNow = useRef(0.09)

  // a fresh start (new body, a reset, AR switched on): float on the surface in front again
  useEffect(() => {
    placedOnce.current = false
    warm.current = 0
    useXRApp.getState().setArLocked(false)
  }, [bodyId, resetNonce, mode])

  /**
   * Camera AR: tapping the screen puts the model on the surface at the tapped point and pins it. A "click" (not
   * a pointer-up) so the scene's own handlers run first: a tap that lands on a planet is a placement, not a selection
   * (selectBody ignores taps while the model is not placed).
   */
  useEffect(() => {
    if (mode !== 'camera') return
    // the scene's pointer events are listened for on the canvas's parent; listening on the same node, later, means
    // they have already run when this does
    const el = gl.domElement.parentElement ?? gl.domElement
    const onClick = (e: MouseEvent) => {
      if (e.target !== gl.domElement) return // a tap on a page control (Place, Reset, a card) is not a placement
      const g = group.current
      if (!g || lockedRef.current || pinning.current) return
      const rect = gl.domElement.getBoundingClientRect()
      _ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1))
      raycaster.current.setFromCamera(_ndc, camera)
      camera.getWorldPosition(_pos)
      surfacePoint(_pos, raycaster.current.ray.direction, _pos.y - SURFACE_DROP[surfaceRef.current], _hit)
      const dist = Math.hypot(_hit.x - _pos.x, _hit.z - _pos.z)
      const s = scaleForDistance(bodyId, Math.max(dist, MIN_DIST))
      scaleNow.current = s
      g.scale.setScalar(s)
      g.position.set(_hit.x, _hit.y + (isFlat(bodyId) ? 0.02 : s), _hit.z)
      placedOnce.current = true
      pinning.current = true
      haptic(0.25, 25)
      // after the whole click has been dispatched: a planet under the tap then still sees an unplaced model and ignores it
      window.setTimeout(() => {
        pinning.current = false
        useXRApp.getState().setArLocked(true)
      }, 0)
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [gl, camera, mode, bodyId])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const cam = viewCamera(gl, camera)
    cam.getWorldPosition(_pos)
    cam.getWorldDirection(_dir)

    if (mode === 'camera') {
      if (!placedOnce.current || (!lockedRef.current && !pinning.current)) {
        // on the assumed surface, where the middle of the screen points
        surfacePoint(_pos, _dir, _pos.y - SURFACE_DROP[surfaceRef.current], _hit)
        const dist = Math.hypot(_hit.x - _pos.x, _hit.z - _pos.z)
        const s = scaleForDistance(bodyId, Math.max(dist, MIN_DIST))
        const lift = isFlat(bodyId) ? 0.02 : s
        _hit.y += lift
        if (!placedOnce.current) {
          g.position.copy(_hit)
          scaleNow.current = s
          placedOnce.current = true
        } else {
          const k = 1 - Math.exp(-Math.min(dt, 0.05) * 8)
          g.position.lerp(_hit, k)
          scaleNow.current += (s - scaleNow.current) * k
        }
      }
      g.scale.setScalar(scaleNow.current)
      return
    }

    // headset: wait for a real head pose, then float in front of you, level with a table, and pin after a moment
    if (!gl.xr.isPresenting) return
    _fwd.set(_dir.x, 0, _dir.z)
    if (_fwd.lengthSq() < 1e-4) _fwd.set(0, 0, -1)
    _fwd.normalize()
    _hit.set(_pos.x + _fwd.x * HEADSET.distance, _pos.y - HEADSET.drop, _pos.z + _fwd.z * HEADSET.distance)
    if (!placedOnce.current) {
      g.position.copy(_hit)
      placedOnce.current = true
      warm.current = 0
    } else if (!lockedRef.current) {
      g.position.lerp(_hit, 1 - Math.exp(-Math.min(dt, 0.05) * 6))
    }
    if (!lockedRef.current) {
      warm.current += Math.min(dt, 0.05)
      if (warm.current > 1.2 && !manualFollow.on) useXRApp.getState().setArLocked(true)
    }
    g.scale.setScalar(HEADSET.radius / contentRadius(bodyId))
  })

  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __arAnchor: unknown }).__arAnchor = { group, locked, mode, surface, SURFACE_DROP }
  }, [locked, mode, surface])

  return (
    <>
      <group ref={group}>
        {children}
        {/* a flat ring under the model, so it reads as standing on the surface */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, isFlat(bodyId) ? -0.25 : -1, 0]} raycast={() => null} renderOrder={1}>
          <ringGeometry args={[contentRadius(bodyId) * 0.98, contentRadius(bodyId) * 1.04, 64]} />
          <meshBasicMaterial color="#4fe3d6" transparent opacity={0.55} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      {mode === 'xr' && <ArControls3D anchor={group} />}
    </>
  )
}

/** "Pick up" in a headset must not be re-pinned by the automatic pin straight away. */
const manualFollow = { on: false }

/** Place / Reset as 3D buttons under the model, for headsets (a page overlay cannot be seen there). */
function ArControls3D({ anchor }: { anchor: React.RefObject<Group | null> }) {
  const root = useRef<Group>(null)
  const locked = useXRApp((s) => s.arLocked)
  const mode = useXR((s) => s.mode)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const head = useRef(new Vector3())
  useFrame(() => {
    const g = root.current
    const a = anchor.current
    if (!g || !a) return
    viewCamera(gl, camera).getWorldPosition(head.current)
    g.position.set(a.position.x, a.position.y - 0.52, a.position.z)
    g.rotation.y = Math.atan2(head.current.x - g.position.x, head.current.z - g.position.z)
  })
  if (mode !== 'immersive-ar') return null
  return (
    <group ref={root} scale={0.2}>
      <GlassPanel width={2.3} height={0.62} radius={0.12}>
        <Button
          label={locked ? 'Pick up' : 'Place here'}
          tone="accent"
          position={[-0.55, 0, 0.01]}
          width={1.0}
          height={0.38}
          onPress={() => {
            manualFollow.on = locked // picking it up: follow until placed by hand
            useXRApp.getState().setArLocked(!locked)
            haptic(0.3, 30)
          }}
        />
        <Button
          label="Reset"
          position={[0.6, 0, 0.01]}
          width={0.8}
          height={0.38}
          onPress={() => {
            manualFollow.on = false
            useXRApp.getState().resetAr()
            haptic(0.3, 30)
          }}
        />
      </GlassPanel>
    </group>
  )
}
