import { lazy, Suspense, useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { XR } from '@react-three/xr'
import type { PerspectiveCamera } from 'three'
import '../../xr/loading' // registers the /xr/ base-path URL modifier for textures and models
import { BodyExplorer } from '../../xr/BodyExplorer'
import { SolarSystemHub } from '../../xr/SolarSystemHub'
import { BODY_BY_ID } from '../../xr/bodies'
import { useSiteContent } from '../../xr/content'
import { ErrorBoundary } from '../../xr/ErrorBoundary'
import { useXRApp } from '../../xr/store'
import { xrStore } from '../../xr/xrStore'

const SurfaceScene = lazy(() =>
  import('../../xr/surface/SurfaceScene').then((module) => ({ default: module.SurfaceScene })),
)

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
              <FitSurfaceCamera siteId={siteId} />
            ) : (
              <FitCamera resetKey={resetKey} radius={bodyId === 'solar' ? 3.4 : FRAME_RADIUS} lift={bodyId === 'solar' ? 0.55 : 0.18} />
            )}
            <Suspense fallback={null}>
              {siteId ? (
                <SurfaceScene key={`${siteId}:${resetKey}`} siteId={siteId} mode="desktop" />
              ) : bodyId === 'solar' ? (
                <SolarSystemHub />
              ) : (
                <BodyExplorer key={bodyId} id={bodyId} vr={false} showTitle={false} showObjectCard={false} />
              )}
            </Suspense>
            {!siteId && (
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
    </div>
  )
}
