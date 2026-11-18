import { lazy, Suspense, useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { XR, useXR } from '@react-three/xr'
import type { PerspectiveCamera } from 'three'
import '../../xr/loading' // registers the /xr/ base-path URL modifier for textures and models
import { BodyExplorer } from '../../xr/BodyExplorer'
import { SolarSystemHub } from '../../xr/SolarSystemHub'
import { BODY_BY_ID } from '../../xr/bodies'
import { useSiteContent } from '../../xr/content'
import { ErrorBoundary } from '../../xr/ErrorBoundary'
import { useXRApp } from '../../xr/store'
import { xrStore } from '../../xr/xrStore'
import { GyroControls } from '../../xr/GyroControls'
import { ArAnchor } from '../../xr/ArAnchor'
import { haptic } from '../../xr/feedback'

const SurfaceScene = lazy(() =>
  import('../../xr/surface/SurfaceScene').then((module) => ({ default: module.SurfaceScene })),
)

function SurfaceSceneHost({ siteId, resetKey, surfaceGyro }: { siteId: string; resetKey: number; surfaceGyro: boolean }) {
  const xrMode = useXR((s) => s.mode)
  const mode = xrMode === 'immersive-vr' ? 'vr' : surfaceGyro ? 'gyro' : 'desktop'
  return <SurfaceScene key={`${siteId}:${resetKey}`} siteId={siteId} mode={mode} />
}

/** Bodies that have a 3D model + hotspot content in `arvr/content/bodies/`. */
export const MODEL_BODIES = ['mars', 'moon', 'bennu'] as const
export type ModelBodyId = (typeof MODEL_BODIES)[number]

export function isModelBody(value: string | null): value is ModelBodyId {
  return value !== null && (MODEL_BODIES as readonly string[]).includes(value)
}

/** Any body of the Solar System chart can be shown in the viewer (the SPHEREx table lives in /xr). */
export function isViewerBody(value: string | null): value is string {
  return value !== null && value !== 'spherex' && value in BODY_BY_ID
}

const FOV = 40
/** Radius that must stay in frame: the holo orbit ring (1.55) plus a small margin. */
const FRAME_RADIUS = 1.62

/** Pulls the camera back far enough that the whole body + ring fits, on wide and on portrait screens. */
function FitCamera({ resetKey, radius = FRAME_RADIUS, lift = 0.18 }: { resetKey: number; radius?: number; lift?: number }) {
  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  useEffect(() => {
    camera.near = 0.05
    camera.far = 60
    const aspect = width / Math.max(1, height)
    const halfV = Math.tan(((FOV / 2) * Math.PI) / 180)
    const distance = Math.max(radius / halfV, radius / (halfV * aspect)) * 1.05
    camera.position.set(0, lift, 1).normalize().multiplyScalar(distance)
    camera.lookAt(0, 0, 0)
    // Narrow viewports: the title card and toolbar cover the top of the canvas, so draw the model a
    // little lower (a view offset shifts the picture without changing what the orbit controls rotate).
    const cam = camera as PerspectiveCamera
    if (width < 768) cam.setViewOffset(width, height, 0, -height * 0.04, width, height)
    else cam.clearViewOffset()
    cam.updateProjectionMatrix()
  }, [camera, width, height, resetKey, radius, lift])
  return null
}

/** Camera AR with motion sensors: the camera stays at the origin and turns with the phone; the model hovers ahead. */
function ArOrigin() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.position.set(0, 0, 0)
    camera.quaternion.identity() // face the model; motion sensors take over from here
    camera.near = 0.05
    camera.far = 60
    ;(camera as PerspectiveCamera).clearViewOffset()
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

/**
 * Holds the scene content. In AR (the phone camera, or a headset's passthrough) it is pinned in one place that
 * you choose with Place / Reset; otherwise it sits at the origin as before.
 */
function Placed({ bodyId, siteId, arGyro, children }: { bodyId: string; siteId: string | null; arGyro: boolean; children: React.ReactNode }) {
  const xrMode = useXR((s) => s.mode)
  if (!siteId && xrMode === 'immersive-ar') return <ArAnchor bodyId={bodyId} mode="xr">{children}</ArAnchor>
  if (arGyro) return <ArAnchor bodyId={bodyId} mode="camera">{children}</ArAnchor>
  return <group>{children}</group>
}

/** Place / Pick up and Reset on the page, for the phone's camera view (a headset gets 3D buttons instead). */
function ArControlsOverlay() {
  const locked = useXRApp((s) => s.arLocked)
  const surface = useXRApp((s) => s.arSurface)
  return (
    <>
      {!locked && <div className="ar-reticle" aria-hidden="true" />}
      <div className="ar-controls" role="group" aria-label="AR placement">
        <p className="ar-hint" role="status">
          {locked ? 'Placed. Turn your phone around it.' : `Aim at your ${surface}, then tap the screen to place it.`}
        </p>
        <div className="ar-buttons">
          <button
            type="button"
            className={`fe-icon-btn ar-btn${locked ? '' : ' selected'}`}
            aria-pressed={locked}
            onClick={() => {
              useXRApp.getState().setArLocked(!locked)
              haptic(0.2, 20)
            }}
          >
            <span aria-hidden="true">{locked ? '↥' : '◎'}</span>
            <span>{locked ? 'Pick up' : 'Place here'}</span>
          </button>
          <button
            type="button"
            className="fe-icon-btn ar-btn"
            onClick={() => {
              useXRApp.getState().resetAr()
              haptic(0.2, 20)
            }}
          >
            <span aria-hidden="true">↺</span>
            <span>Reset</span>
          </button>
          <button
            type="button"
            className="fe-icon-btn ar-btn ar-surface"
            aria-label={`Surface: ${surface}. Switch to ${surface === 'table' ? 'floor' : 'table'}`}
            title="Is it going on a table or on the floor?"
            onClick={() => useXRApp.getState().setArSurface(surface === 'table' ? 'floor' : 'table')}
          >
            <span aria-hidden="true">{surface === 'table' ? '▭' : '▁'}</span>
            <span>{surface === 'table' ? 'Table' : 'Floor'}</span>
          </button>
        </div>
      </div>
    </>
  )
}

function FitSurfaceCamera({ siteId }: { siteId: string }) {
  const camera = useThree((s) => s.camera)
  const site = useSiteContent(siteId)

  useEffect(() => {
    if (!site) return
    camera.near = 0.1
    camera.far = site.terrain.viewRadius * 2
    camera.updateProjectionMatrix()
  }, [camera, site])

  return null
}

function ViewerFallback({ label }: { label: string }) {
  return (
    <div className="model3d-fallback" role="status">
      {label}
    </div>
  )
}

interface ModelViewer3DProps {
  /** a body id, or 'solar' for the Solar System chart (tap a planet to open it) */
  bodyId: string
  /** a walkable content/sites ID; when set, the existing surface scene replaces the orbit model */
  siteId?: string | null
  /** Bumped by the toolbar's reset/recentre buttons to re-frame the model. */
  resetKey: number
}

/**
 * The AR/VR app's body explorer (NASA-textured globe or shape model + hotspot pins) rendered inline
 * in the 2D Sky Explorer viewport. Desktop/touch only: immersive VR/AR stays in the `/xr` routes.
 */
export function ModelViewer3D({ bodyId, siteId = null, resetKey }: ModelViewer3DProps) {
  // Hotspot selection lives in the shared XR store; start clean for each body and clean up on leave,
  // so a pin picked here never leaks into the XR scene (or another body).
  useEffect(() => {
    useXRApp.setState({ hotspotId: null, hoveredId: null })
    return () => {
      useXRApp.setState({ hotspotId: null, hoveredId: null })
      document.body.style.cursor = ''
    }
  }, [bodyId])

  const cameraAr = useXRApp((s) => s.cameraAr)
  const gyro = useXRApp((s) => s.gyroEnabled)
  const arGyro = cameraAr && gyro && !siteId
  // walkable surface: phone motion turns the view (look-around)
  const surfaceGyro = !!siteId && gyro
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  return (
    <div className="model3d" data-model={bodyId} data-site={siteId ?? undefined}>
      <ErrorBoundary fallback={<ViewerFallback label="3D view unavailable on this device (WebGL could not start)." />}>
        <Canvas
          className="model3d-canvas"
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 0.4, 4.8], fov: FOV, near: 0.05, far: 60 }}
          onPointerMissed={() => useXRApp.getState().selectHotspot(null)}
        >
          <XR store={xrStore}>
            <ambientLight intensity={0.32} />
            <directionalLight position={[4, 2.5, 5]} intensity={2.4} />
            <directionalLight position={[-5, -1, -3]} intensity={0.25} color="#7fa6ff" />
            {siteId ? (
              <>
                <FitSurfaceCamera siteId={siteId} />
                {surfaceGyro && <GyroControls />}
              </>
            ) : arGyro ? (
              <>
                <ArOrigin />
                <GyroControls />
              </>
            ) : (
              <FitCamera resetKey={resetKey} radius={bodyId === 'solar' ? 3.4 : bodyId === 'saturn' ? 2.5 : FRAME_RADIUS} lift={bodyId === 'solar' ? 0.55 : 0.18} />
            )}
            <Placed bodyId={bodyId} siteId={siteId} arGyro={arGyro}>
              <Suspense fallback={null}>
                {siteId ? (
                  <SurfaceSceneHost siteId={siteId} resetKey={resetKey} surfaceGyro={surfaceGyro} />
                ) : bodyId === 'solar' ? (
                  <SolarSystemHub />
                ) : (
                  <BodyExplorer key={bodyId} id={bodyId} vr={false} showTitle={false} showObjectCard={false} />
                )}
              </Suspense>
            </Placed>
            {!siteId && !arGyro && (
              <OrbitControls
                key={resetKey}
                makeDefault
                enablePan={false}
                enableDamping={!reduceMotion}
                minDistance={2.2}
                maxDistance={bodyId === 'solar' ? 30 : 12}
                rotateSpeed={0.7}
              />
            )}
          </XR>
        </Canvas>
      </ErrorBoundary>
      {arGyro && <ArControlsOverlay />}
    </div>
  )
}
