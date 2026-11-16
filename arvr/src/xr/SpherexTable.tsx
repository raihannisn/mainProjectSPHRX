import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Text, useTexture } from '@react-three/drei'
import { SRGBColorSpace, Texture, TextureLoader, type Group, type Mesh } from 'three'
import { useXRApp } from './store'
import { FONT_BOLD } from './font'
import { t } from './i18n'
import { Button, Choice3D, GlassPanel, Label, UI, roundedFrame, roundedRect, uiMat } from './ui3d'
import { backToSource } from './events'
import { KIND_COLORS } from './bodies'
import { SceneReady } from './smooth'
import { pressFeedback, playChime } from './feedback'
import type { ViewMode } from './types'
import { isHit, loadBlinkMeta, movedArcsec, useSpherex, utcOf } from './spherexState'
import { runWormhole } from '../frontend/wormhole'

/** Reveal the known object; a chime if the visitor had flagged it. */
export function revealBlink() {
  const s = useSpherex.getState()
  s.reveal()
  if (s.meta && s.flags.some((f) => isHit(f, s.meta!))) playChime()
}

export const SPHEREX_IMAGES = () => IMAGES

/**
 * SPHEREx on a table, laid out like a photographic plate (on a virtual table in VR / on screen, on your real
 * table in AR).
 *
 * Supports two distinct experiences:
 * MODE A: Curated educational SPHEREx experience (Blink comparator with asteroid 15 Eunomia, Vela Molecular Ridge, First Light)
 * MODE B: Live SPHEREx observation experience (Live FITS preview textures from NASA IRSA SIA2 archive, Single Obs & Comparison A/B)
 */
interface SkyImage {
  id: string
  label: string
  url: string
  aspect: number
  credit: string
  known: { u: number; v: number; label: string }[]
}
const IMAGES: SkyImage[] = [
  {
    id: 'vela',
    label: 'Vela Molecular Ridge (Jul 2025)',
    url: '/spherex/vela.jpg',
    aspect: 949 / 1919,
    credit: 'NASA/JPL-Caltech SPHEREx: Vela Molecular Ridge, first public data release, 2 July 2025 (PIA26354)',
    known: [{ u: 0.688, v: 0.358, label: 'Known: RCW 36, an emission nebula' }],
  },
  {
    id: 'first-light',
    label: 'First images (Mar 2025)',
    url: '/spherex/first-light.jpg',
    aspect: 1243 / 1920,
    credit: 'NASA/JPL-Caltech SPHEREx: first images, 27 March 2025, uncalibrated (PIA26280)',
    known: [],
  },
]
const W = 3

export function SpherexTable({ mode }: { mode: ViewMode }) {
  useXRApp((s) => s.settings.lang)
  const {
    view,
    blinking,
    frame,
    flags,
    revealed,
    meta,
    liveFrame,
    liveBlinking,
    setView,
    setBlinking,
    flip,
    flipLive,
    setLiveBlinking,
    addFlag,
    reset,
  } = useSpherex()

  const obsIdA = useXRApp((s) => s.observation)
  const obsIdB = useXRApp((s) => s.observationB)
  const obsDataA = useXRApp((s) => s.observationDataA)
  const obsDataB = useXRApp((s) => s.observationDataB)
  const target = useXRApp((s) => s.target)
  const band = useXRApp((s) => s.band)

  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current) return
    if (obsIdB) {
      setView('live-compare')
      initialized.current = true
    } else if (obsIdA) {
      setView('live-obs')
      initialized.current = true
    }
  }, [obsIdA, obsIdB, setView])

  useEffect(() => void loadBlinkMeta(), [])

  // phones held upright: the console moves into an on-screen panel (SpherexPanel) where text stays readable
  const narrow = useThree((st) => st.size.width < 640 && st.size.width < st.size.height)
  const consoleIn3D = mode !== 'desktop' || !narrow
  const image = IMAGES.find((i) => i.id === view)
  const isLive = view === 'live-obs' || view === 'live-compare'

  // the square blink plate is a little smaller so the plate + console still fit the view
  const PW = image ? W : 2.3
  const H = image ? W * image.aspect : PW
  const y = mode === 'vr' ? -1.15 : mode === 'ar' ? -1.1 : -0.2
  const tilt = mode === 'ar' ? -Math.PI / 2 : -Math.PI / 2 + 0.42
  const toPlate = (p: { u: number; v: number }): [number, number, number] => [(p.u - 0.5) * PW, (0.5 - p.v) * H, 0.006]

  // blink comparator state for both curated and live
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const last = useRef(0)
  const lastLive = useRef(0)

  useFrame(({ clock }) => {
    if (view === 'blink' && blinking) {
      if (clock.elapsedTime - last.current > (reduced ? 1.2 : 0.7)) {
        last.current = clock.elapsedTime
        flip()
      }
    } else if (view === 'live-compare' && liveBlinking) {
      if (clock.elapsedTime - lastLive.current > (reduced ? 1.3 : 0.85)) {
        lastLive.current = clock.elapsedTime
        flipLive()
      }
    }
  })

  const found = meta ? flags.some((f) => isHit(f, meta)) : false
  const moved = meta ? movedArcsec(meta) : 0

  const onPlate = (e: ThreeEvent<MouseEvent>) => {
    if (view !== 'blink' || !e.uv) return
    e.stopPropagation()
    pressFeedback()
    addFlag({ u: e.uv.x, v: 1 - e.uv.y })
  }
  const reveal = revealBlink

  const handleReturnTo2D = () => {
    if (view === 'live-compare') {
      const sp = new URLSearchParams()
      if (target) sp.set('target', target)
      if (obsIdA) sp.set('obs', obsIdA)
      if (obsIdB) sp.set('obs2', obsIdB)
      if (band) sp.set('band', band)
      void runWormhole({ label: 'Returning to Comparison…', waitForScene: false, minMs: 380 }, () => {
        window.location.href = `/comparison?${sp}`
      })
    } else if (view === 'live-obs') {
      const sp = new URLSearchParams()
      if (target) sp.set('target', target)
      if (obsIdA) sp.set('obs', obsIdA)
      if (band) sp.set('band', band)
      void runWormhole({ label: 'Returning to Cosmic Expedition…', waitForScene: false, minMs: 380 }, () => {
        window.location.href = `/explorer?${sp}`
      })
    } else {
      backToSource('spherex', view)
    }
  }

  // Build choice options with clear distinction between Live Archive and Curated Local
  const choiceOptions = useMemo(() => {
    const list: { value: string; label: string }[] = []
    if (obsIdB) {
      list.push({ value: 'live-compare', label: t('Live Comparison (A / B)') })
    }
    if (obsIdA) {
      list.push({ value: 'live-obs', label: `${t('Live Obs')}: ${obsIdA.slice(0, 12)}` })
    }
    list.push({ value: 'blink', label: `${t('Spot what moved')} (Curated)` })
    for (const img of IMAGES) {
      list.push({ value: img.id, label: `${t(img.label)} (Curated)` })
    }
    return list
  }, [obsIdA, obsIdB])

  const liveActiveObs = liveFrame === 0 ? obsDataA : obsDataB
  const liveActiveId = liveFrame === 0 ? obsIdA : obsIdB

  return (
    <group position={[0, y, 0]}>
      {mode !== 'ar' && <TableTop />}
      <group rotation={[tilt, 0, 0]} position={[0, mode === 'ar' ? 0.01 : (H / 2 + 0.1) * Math.sin(0.42) + 0.04, 0]}>
        <mesh geometry={roundedRect(PW + 0.16, H + 0.16, 0.06)} material={uiMat('#0b1820')} position={[0, 0, -0.004]} />
        <mesh geometry={roundedFrame(PW + 0.16, H + 0.16, 0.06, 0.018)} material={uiMat(isLive ? '#4fe3d6' : UI.rim, 0.5)} position={[0, 0, -0.002]} />
        <Suspense fallback={null}>
          {view === 'blink' ? (
            <>
              <Plate url="/spherex/blink-a.png" w={PW} h={H} visible={frame === 0} onClick={onPlate} />
              <Plate url="/spherex/blink-b.png" w={PW} h={H} visible={frame === 1} onClick={onPlate} />
            </>
          ) : view === 'live-obs' ? (
            <LivePlate url={obsDataA?.preview_url} w={PW} h={H} />
          ) : view === 'live-compare' ? (
            <>
              <LivePlate url={obsDataA?.preview_url} w={PW} h={H} visible={liveFrame === 0} />
              <LivePlate url={obsDataB?.preview_url} w={PW} h={H} visible={liveFrame === 1} />
            </>
          ) : (
            image && <Plate url={image.url} w={W} h={H} />
          )}
        </Suspense>

        {/* Live Observation Plate Header Overlay */}
        {view === 'live-obs' && (
          <>
            <Text font={FONT_BOLD} position={[-PW / 2 + 0.08, H / 2 - 0.08, 0.006]} fontSize={0.085} color="#4fe3d6" outlineWidth={0.005} outlineColor="#000" anchorX="left" anchorY="top">
              {`LIVE NASA ARCHIVE · ${obsDataA?.observation_id || obsIdA || 'SPHEREx'}`}
            </Text>
            <Text font={FONT_BOLD} position={[PW / 2 - 0.08, H / 2 - 0.08, 0.006]} fontSize={0.08} color="#38bdf8" outlineWidth={0.005} outlineColor="#000" anchorX="right" anchorY="top">
              {obsDataA?.effective_wavelength_at_target || band || ''}
            </Text>
          </>
        )}

        {/* Live Comparison Plate Header Overlay */}
        {view === 'live-compare' && (
          <>
            <Text font={FONT_BOLD} position={[-PW / 2 + 0.08, H / 2 - 0.08, 0.006]} fontSize={0.085} color={liveFrame === 0 ? '#4fe3d6' : '#f5ae43'} outlineWidth={0.005} outlineColor="#000" anchorX="left" anchorY="top">
              {liveFrame === 0
                ? `LIVE A · ${obsDataA?.observation_id || obsIdA || 'Epoch 1'}`
                : `LIVE B · ${obsDataB?.observation_id || obsIdB || 'Epoch 2'}`}
            </Text>
            <Text font={FONT_BOLD} position={[PW / 2 - 0.08, H / 2 - 0.08, 0.006]} fontSize={0.08} color="#38bdf8" outlineWidth={0.005} outlineColor="#000" anchorX="right" anchorY="top">
              {liveFrame === 0 ? obsDataA?.effective_wavelength_at_target || '' : obsDataB?.effective_wavelength_at_target || ''}
            </Text>
          </>
        )}

        {/* Curated Mode A Overlay */}
        {view === 'blink' && meta && (
          <>
            <Text font={FONT_BOLD} position={[-PW / 2 + 0.08, H / 2 - 0.08, 0.006]} fontSize={0.09} color="#ffffff" outlineWidth={0.006} outlineColor="#000" anchorX="left" anchorY="top">
              {frame === 0 ? `A · ${utcOf(meta.a.mjd)}` : `B · ${utcOf(meta.b.mjd)} (+${meta.gapHours} h)`}
            </Text>
            {flags.map((f, i) => {
              const hit = revealed && isHit(f, meta)
              return (
                <Marker
                  key={i}
                  position={toPlate(f)}
                  color={hit ? UI.good : revealed ? KIND_COLORS.illustration : KIND_COLORS.candidate}
                  label={hit ? t('✓ Found it') : revealed ? t('Unverified') : t('Your flag')}
                  small
                />
              )
            })}
            {revealed && (
              <>
                <Marker position={toPlate(meta.a)} color={KIND_COLORS.fact} label={`A · ${t('Known: asteroid {x}', { x: meta.target.name })}`} />
                <Marker position={toPlate(meta.b)} color={KIND_COLORS.fact} label="B" />
                <TrackLine a={toPlate(meta.a)} b={toPlate(meta.b)} />
              </>
            )}
          </>
        )}
        {image?.known.map((k) => (
          <Marker key={k.label} position={toPlate(k)} color={KIND_COLORS.fact} label={t(k.label)} />
        ))}
      </group>

      {/* Control panel in front of the plate */}
      {consoleIn3D && (
        <group
          position={mode === 'vr' ? [0, 0.3, H / 2 + 0.5] : mode === 'ar' ? [0, 0.02, H / 2 + 0.55] : [0, -0.1, H / 2 + 0.78]}
          rotation={[mode === 'vr' ? -0.5 : -Math.PI / 2 + (mode === 'ar' ? 0 : 0.35), 0, 0]}
          scale={mode === 'vr' ? 0.34 : 0.42}
        >
          <GlassPanel width={5.6} height={2.7} radius={0.16} />

          {/* Mode headers & dynamic readouts */}
          {view === 'blink' ? (
            <>
              <Label text={t('Spot what moved')} position={[-2.6, 1.1, 0.005]} size={UI.type.title} bold />
              <Label
                text={
                  revealed
                    ? found
                      ? t('You found it! That dot is asteroid {x}: it moved {n}″ in {h} hours.', { x: meta?.target.name ?? '', n: Math.round(moved), h: meta?.gapHours ?? '' })
                      : t('The moving dot is asteroid {x} (known, from NASA JPL). Your other flags stay unverified.', { x: meta?.target.name ?? '' })
                    : t('Two real SPHEREx images of the same sky, 1.8 hours apart. Stars stay put. Tap the dot that jumps.')
                }
                position={[-2.6, 0.78, 0.005]}
                size={UI.type.small}
                color={revealed && found ? UI.good : '#d6e4ea'}
                maxWidth={5.2}
              />
              <Button label={blinking ? t('Pause blink') : t('Blink')} icon={blinking ? 'pause' : 'play'} onPress={() => setBlinking(!blinking)} position={[-1.95, 0.25, 0]} width={1.5} height={0.32} />
              <Button label={t('Reveal')} icon="check" tone="accent" disabled={revealed} onPress={reveal} position={[-0.3, 0.25, 0]} width={1.5} height={0.32} />
              <Button label={t('Start over')} icon="refresh" onPress={reset} position={[1.35, 0.25, 0]} width={1.5} height={0.32} />
            </>
          ) : view === 'live-compare' ? (
            <>
              <Label text={t('Live SPHEREx Comparison')} position={[-2.6, 1.1, 0.005]} size={UI.type.title} bold color="#f5ae43" />
              <Label
                text={`Epoch ${liveFrame === 0 ? 'A' : 'B'}: ${liveActiveId || 'Obs'} · ${liveActiveObs?.detector || 'Detector'} · ${liveActiveObs?.observed_at_utc?.slice(0, 10) || 'UTC'} · ${liveActiveObs?.effective_wavelength_at_target || ''}`}
                position={[-2.6, 0.78, 0.005]}
                size={UI.type.small}
                color="#d6e4ea"
                maxWidth={5.2}
              />
              <Button label={liveBlinking ? t('Pause blink') : t('Blink')} icon={liveBlinking ? 'pause' : 'play'} onPress={() => setLiveBlinking(!liveBlinking)} position={[-1.95, 0.25, 0]} width={1.5} height={0.32} />
              <Button label={`Flip (${liveFrame === 0 ? 'A' : 'B'})`} icon="refresh" tone="accent" onPress={flipLive} position={[-0.3, 0.25, 0]} width={1.5} height={0.32} />
              <Button label={t('Comparison (2D)')} icon="back" onPress={handleReturnTo2D} position={[1.35, 0.25, 0]} width={1.5} height={0.32} />
            </>
          ) : view === 'live-obs' ? (
            <>
              <Label text={t('Live SPHEREx Observation')} position={[-2.6, 1.1, 0.005]} size={UI.type.title} bold color="#4fe3d6" />
              <Label
                text={`${obsDataA?.observation_id || obsIdA || 'Observation'} · ${obsDataA?.detector || 'Detector'} · ${obsDataA?.observed_at_utc?.slice(0, 19).replace('T', ' ') || 'UTC'} UTC`}
                position={[-2.6, 0.78, 0.005]}
                size={UI.type.small}
                color="#d6e4ea"
                maxWidth={5.2}
              />
              <Label
                text={`Band: ${obsDataA?.effective_wavelength_at_target || band || 'Nominal'} · Quality: ${obsDataA?.quality_flag_meaning || 'Unflagged (0)'} · Source: IRSA SIA2`}
                position={[-2.6, 0.48, 0.005]}
                size={UI.type.tiny}
                color="#9ba8bf"
                maxWidth={5.2}
              />
              <Button label={t('2D Explorer')} icon="back" onPress={handleReturnTo2D} position={[-1.95, 0.12, 0]} width={1.5} height={0.32} />
            </>
          ) : (
            <Label text={t('NASA’s released SPHEREx images to explore. Only NASA-identified objects are marked.')} position={[-2.6, 0.78, 0.005]} size={UI.type.small} color="#d6e4ea" maxWidth={5.2} />
          )}

          <Choice3D
            label={t('Experience mode')}
            value={view}
            options={choiceOptions}
            onChange={setView}
            position={[-0.7, -0.38, 0]}
            width={3.9}
          />
          <Button label={t('Back to source image')} icon="back" onPress={handleReturnTo2D} position={[2.05, -0.46, 0]} width={1.0} height={0.3} />
          <Legend position={[-2.6, -0.92, 0.005]} />
          <Label
            text={
              isLive
                ? t('NASA/JPL-Caltech/IPAC SPHEREx archive preview · Visual preview only; not for quantitative photometry.')
                : t(view === 'blink' ? (meta?.credit ?? '') : (image?.credit ?? ''))
            }
            position={[-2.6, -1.14, 0.005]}
            size={UI.type.tiny}
            color={UI.muted}
            maxWidth={5.2}
          />
        </group>
      )}
      <SceneReady />
    </group>
  )
}

function TableTop() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.35]} geometry={roundedRect(4.2, 3.6, 0.3)} material={uiMat('#10202a', 0.9)} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0.35]} geometry={roundedFrame(4.2, 3.6, 0.3, 0.03)} material={uiMat(UI.rim, 0.45)} />
    </group>
  )
}

function Plate({ url, w, h, visible = true, onClick }: { url: string; w: number; h: number; visible?: boolean; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const map = useTexture(url)
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  map.colorSpace = SRGBColorSpace
  map.anisotropy = Math.max(1, Math.min(8, maxAnisotropy || 1))
  return (
    <mesh visible={visible} onClick={visible ? onClick : undefined}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  )
}

/**
 * Three.js texture renderer for dynamic live backend preview PNGs.
 * Ensures GPU anisotropy clamping, aspect-ratio preservation, SRGBColorSpace,
 * deterministic texture lifecycle management, and error recovery.
 */
function LivePlate({
  url,
  w,
  h,
  visible = true,
  onClick,
}: {
  url: string | null | undefined
  w: number
  h: number
  visible?: boolean
  onClick?: (e: ThreeEvent<MouseEvent>) => void
}) {
  const [texture, setTexture] = useState<Texture | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  // Read maximum supported anisotropy from WebGL renderer capabilities
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const activeTextureRef = useRef<Texture | null>(null)

  useEffect(() => {
    // If no URL is provided, dispose any previous texture and show error/unavailable
    if (!url) {
      if (activeTextureRef.current) {
        activeTextureRef.current.dispose()
        activeTextureRef.current = null
      }
      setTexture(null)
      setLoading(false)
      setError(true)
      return
    }

    // Immediately clear stale texture state when URL changes to avoid showing older observation
    if (activeTextureRef.current) {
      activeTextureRef.current.dispose()
      activeTextureRef.current = null
    }
    setTexture(null)
    setLoading(true)
    setError(false)

    let cancelled = false
    const loader = new TextureLoader()

    loader.load(
      url,
      (tex) => {
        if (cancelled) {
          // Dispose textures returned by cancelled loader callbacks
          tex.dispose()
          return
        }
        tex.colorSpace = SRGBColorSpace
        const clampedAnisotropy = Math.max(1, Math.min(8, maxAnisotropy || 1))
        tex.anisotropy = clampedAnisotropy
        tex.needsUpdate = true

        // Clean up previously active texture if distinct
        if (activeTextureRef.current && activeTextureRef.current !== tex) {
          activeTextureRef.current.dispose()
        }
        activeTextureRef.current = tex
        setTexture(tex)
        setLoading(false)
        setError(false)
      },
      undefined,
      () => {
        if (cancelled) return
        if (activeTextureRef.current) {
          activeTextureRef.current.dispose()
          activeTextureRef.current = null
        }
        setTexture(null)
        setError(true)
        setLoading(false)
      }
    )

    return () => {
      cancelled = true
      if (activeTextureRef.current) {
        activeTextureRef.current.dispose()
        activeTextureRef.current = null
      }
    }
  }, [url, maxAnisotropy])

  if (!visible) return null

  if (error || !url) {
    return (
      <group>
        <mesh>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color="#1a0d18" toneMapped={false} />
        </mesh>
        <Text
          font={FONT_BOLD}
          position={[0, 0, 0.01]}
          fontSize={0.08}
          color="#ff7b88"
          anchorX="center"
          anchorY="middle"
          maxWidth={w * 0.85}
        >
          {t('Live preview unavailable')}
        </Text>
      </group>
    )
  }

  if (loading || !texture) {
    return (
      <group>
        <mesh>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color="#0c1d28" toneMapped={false} />
        </mesh>
        <Text
          font={FONT_BOLD}
          position={[0, 0, 0.01]}
          fontSize={0.075}
          color="#4fe3d6"
          anchorX="center"
          anchorY="middle"
          maxWidth={w * 0.85}
        >
          {t('Loading live FITS preview from IRSA…')}
        </Text>
      </group>
    )
  }

  return (
    <mesh onClick={onClick}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

function Marker({ position, color, label, small = false }: { position: [number, number, number]; color: string; label: string; small?: boolean }) {
  const r = small ? 0.06 : 0.11
  const ring = useRef<Mesh>(null)
  const g = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (ring.current) ring.current.scale.setScalar(1 + 0.12 * Math.sin(clock.elapsedTime * 3))
  })
  const frame = useMemo(() => roundedFrame(r * 2, r * 2, r, r * 0.22), [r])
  return (
    <group ref={g} position={position}>
      <mesh ref={ring} geometry={frame} material={uiMat(color)} />
      <Text font={FONT_BOLD} position={[r + 0.03, r + 0.02, 0.002]} fontSize={0.065} color={color} outlineWidth={0.005} outlineColor="#000" anchorX="left" anchorY="bottom" maxWidth={1.3}>
        {label}
      </Text>
    </group>
  )
}

function TrackLine({ a, b }: { a: [number, number, number]; b: [number, number, number] }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  return (
    <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.005]} rotation={[0, 0, ang]}>
      <planeGeometry args={[len, 0.014]} />
      <meshBasicMaterial color={KIND_COLORS.fact} transparent opacity={0.7} toneMapped={false} />
    </mesh>
  )
}

function Legend({ position }: { position: [number, number, number] }) {
  const items: [string, string][] = [
    [KIND_COLORS.fact, t('Known (catalogued)')],
    [KIND_COLORS.candidate, t('Your flag')],
    [KIND_COLORS.illustration, t('Unverified')],
  ]
  return (
    <group position={position}>
      {items.map(([c, l], i) => (
        <group key={l} position={[i * 1.75, 0, 0]}>
          <mesh geometry={roundedRect(0.12, 0.12, 0.06)} material={uiMat(c)} position={[0.06, 0, 0]} />
          <Label text={l} position={[0.18, 0, 0.002]} size={UI.type.tiny} />
        </group>
      ))}
    </group>
  )
}
