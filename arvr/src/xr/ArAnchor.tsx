import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { Group, Vector3 } from 'three'
import { useXRApp } from './store'
import { viewCamera } from './viewCamera'
import { Button, GlassPanel } from './ui3d'
import { haptic } from './feedback'

/**
 * AR keeps the model in ONE place. Until you place it, it floats in front of wherever you aim (so it is never
 * lost or "far away"); "Place here" pins it to that spot and it stays put while you move your phone or head;
 * "Pick up" lets it follow your aim again; "Reset" brings it back in front of you, at its normal size, and
 * re-centres the phone's compass. Works for the phone's camera feed (Camera AR) and for passthrough / WebXR AR.
 */

/** Radius (in scene units) of what has to fit: the holo orbit ring of a planet, the outer orbit of the chart. */
export function contentRadius(bodyId: string) {
  return bodyId === 'solar' ? 3.4 : bodyId === 'saturn' ? 2.5 : 1.62
}

const HEADSET = { distance: 1.0, radius: 0.32, drop: 0.2 }
// phone: the object card covers the lower third of the screen, so the model floats a little above eye level, in the free part
const PHONE = { distance: 1.3, radius: 0.22, drop: -0.1 }

const _fwd = new Vector3()
const _pos = new Vector3()
const _target = new Vector3()

/** Wraps the scene content. `mode` is 'camera' (gyro + camera feed) or 'xr' (immersive AR, passthrough). */
export function ArAnchor({ bodyId, mode, children }: { bodyId: string; mode: 'camera' | 'xr'; children: ReactNode }) {
  const group = useRef<Group>(null)
  const locked = useXRApp((s) => s.arLocked)
  const resetNonce = useXRApp((s) => s.arResetNonce)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const cfg = mode === 'xr' ? HEADSET : PHONE
  const scale = cfg.radius / contentRadius(bodyId)
  const placedOnce = useRef(false)
  const warm = useRef(0)

  // a fresh start (new body, a reset, AR switched on): float in front again
  useEffect(() => {
    placedOnce.current = false
    warm.current = 0
    useXRApp.getState().setArLocked(false)
  }, [bodyId, resetNonce, mode])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const cam = viewCamera(gl, camera)
    cam.getWorldPosition(_pos)
    cam.getWorldDirection(_fwd)
    // wait for a real head pose in a headset (the first frames report the origin)
    if (mode === 'xr' && !gl.xr.isPresenting) return
    // floats in front of the aim, level with the horizon and a little below eye height, like something on a table
    _fwd.y = 0
    if (_fwd.lengthSq() < 1e-4) _fwd.set(0, 0, -1)
    _fwd.normalize()
    _target.set(_pos.x + _fwd.x * cfg.distance, _pos.y - cfg.drop, _pos.z + _fwd.z * cfg.distance)

    if (!placedOnce.current) {
      // the first frames: jump straight there, then follow smoothly
      g.position.copy(_target)
      placedOnce.current = true
      warm.current = 0
    } else if (!locked) {
      g.position.lerp(_target, 1 - Math.exp(-Math.min(dt, 0.05) * 6))
    }
    // headset: pin it automatically after a moment, so it stays where you first see it (Pick up moves it again)
    if (mode === 'xr' && !locked) {
      warm.current += Math.min(dt, 0.05)
      if (warm.current > 1.2 && !manualFollow.on) useXRApp.getState().setArLocked(true)
    }
    g.scale.setScalar(scale)
  })

  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __arAnchor: unknown }).__arAnchor = { group, locked, mode, cfg }
  }, [locked, mode, cfg])

  return (
    <>
      <group ref={group} scale={scale}>
        {children}
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
