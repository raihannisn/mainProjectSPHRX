import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchObjectInfo, searchSpherexObservations, type ObjectInfo, type SpherexObservation } from '../api'
import { TopBar } from './TopBar'
import { ParticleField } from './ParticleField'
import { WormholePulse } from './WormholeOverlay'
import { originOf, runWormhole } from '../wormhole'
import { cacheObservations, useXRApp } from '../../xr/store'
import { BotIcon } from '../guide/BotIcon'
import { SkyScene3D } from './SkyScene3D'
import { useAmbientAudio } from '../audio/ambientAudio'
import { ModelViewer3D, MODEL_BODIES, isViewerBody } from './ModelViewer3D'
import { BODY_BY_ID } from '../../xr/bodies'
import { useBodyContent } from '../../xr/content'
import { useDeviceCaps } from '../../xr/device'
import { KIND_LABEL } from '../../xr/InfoCard'
import { localHotspot } from '../../xr/i18n'
import { askGuide } from '../../xr/events'
import { layersFor } from '../../xr/layers'
import { useAgentNarration } from '../../xr/useAgentNarration'
import { enterImmersive, xrErrorMessage } from '../../xr/xrStore'

type MarkerId = 'rcw-36' | 'candidate-02' | 'demo-tile-01'

/**
 * What the viewport shows: the 3D Solar System (default), one of the 3D bodies, or the SPHEREx sky.
 * One round toggle in the model rail steps through Solar System -> Mars -> Moon -> Bennu -> Solar System.
 * All 3D-mode text is English.
 */
type ViewportModel = string // 'solar' (default) | 'sky' | a body id
const MODEL_ORDER: ViewportModel[] = ['solar', ...MODEL_BODIES]
const labelOf = (model: ViewportModel) => (model === 'solar' ? 'Solar System' : model === 'sky' ? 'Sky' : (BODY_BY_ID[model]?.name ?? model))
const BODY_TYPE_LABEL: Record<string, string> = { planet: 'Planet', moon: 'Moon', asteroid: 'Near-Earth asteroid', star: 'Star' }

function parseModel(value: string | null, hasTarget: boolean): ViewportModel {
  if (value === 'sky') return 'sky'
  if (isViewerBody(value)) return value
  // a SPHEREx target link (?target=) still opens the sky; everything else opens on the Solar System
  return hasTarget ? 'sky' : 'solar'
}

const ILLUSTRATIVE_TARGETS: Record<Exclude<MarkerId, 'rcw-36'>, { name: string; type: string; description: string }> = {
  'candidate-02': {
    name: 'Moving-source candidate',
    type: 'Candidate source',
    description:
      'An illustrative candidate marker. No catalog coordinates or observation record are associated with this target.',
  },
  'demo-tile-01': {
    name: 'Sample observation tile',
    type: 'Illustration',
    description: 'Illustrative interface content only; no verified observation metadata is available.',
  },
}

function isMarkerId(value: string | null): value is MarkerId {
  return value === 'rcw-36' || value === 'candidate-02' || value === 'demo-tile-01'
}

function queryValue(value: number | undefined, precision = 4) {
  return value === undefined ? '—' : value.toFixed(precision)
}

export function SkyExplorerScreen() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTarget = searchParams.get('target')
  const selectedId: MarkerId = isMarkerId(requestedTarget) ? requestedTarget : 'rcw-36'
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const { isEnabled: audioOn, toggle: toggleAudio } = useAmbientAudio()
  const [target, setTarget] = useState<ObjectInfo | null>(null)
  const [targetLoading, setTargetLoading] = useState(true)
  const [targetError, setTargetError] = useState<string | null>(null)
  const [observations, setObservations] = useState<SpherexObservation[]>([])
  const [observationsLoading, setObservationsLoading] = useState(true)
  const [observationsError, setObservationsError] = useState<string | null>(null)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  // 3D body (from the AR/VR app) shown in the viewport instead of the sky targets
  const model = parseModel(searchParams.get('model'), searchParams.has('target'))
  const solar = model === 'solar'
  const bodyModel = model === 'sky' || solar ? null : model
  const in3D = model !== 'sky'
  const [viewKey, setViewKey] = useState(0)
  const caps = useDeviceCaps()
  const bodyContent = useBodyContent(bodyModel)
  const pinsOn = useXRApp((s) => s.settings.pins)
  const hotspotId = useXRApp((s) => s.hotspotId)
  const shapeIsIllustration = useXRApp((s) => s.shapeIsIllustration)
  const rawHotspot = bodyContent?.hotspots.find((h) => h.id === hotspotId) ?? null
  const hotspot = localHotspot(rawHotspot, 'en')
  const xrIntent: 'vr' | 'ar' | null = caps.vr ? 'vr' : caps.ar ? 'ar' : null
  // NASA image layers of the body (e.g. Mars colour / MOLA elevation), shared with the XR scene
  const bodyLayers = layersFor(bodyModel)
  const activeLayerId = useXRApp((s) => (bodyModel ? s.layer[bodyModel] : undefined))
  const bodyLayer = bodyLayers.find((l) => l.id === activeLayerId) ?? bodyLayers[0] ?? null
  const dataLayerOn = !!bodyLayer && bodyLayer.id !== bodyLayers[0]?.id

  // Solar System chart: tapping a planet opens that body here, in the same viewport
  useEffect(() => {
    if (!in3D) return
    useXRApp.setState({ bodyId: null, siteId: null })
    return useXRApp.subscribe((state) => {
      const picked = state.bodyId
      if (!picked) return
      useXRApp.setState({ bodyId: null, hoveredId: null })
      document.body.style.cursor = ''
      if (!isViewerBody(picked)) return
      const params = new URLSearchParams(window.location.search)
      params.set('model', picked)
      setSearchParams(params)
    })
  }, [in3D, setSearchParams])

  const illustrative = selectedId === 'rcw-36' ? null : ILLUSTRATIVE_TARGETS[selectedId]
  const chosenObservation = observations.find((item) => item.observation_id === searchParams.get('obs')) ?? observations[0]
  const currentName = selectedId === 'rcw-36' ? target?.name || 'RCW 36 Emission Nebula' : illustrative?.name || 'Illustrative target'
  const currentType = selectedId === 'rcw-36' ? target?.type || 'Emission nebula' : illustrative?.type || 'Illustration'
  const currentDescription =
    selectedId === 'rcw-36'
      ? target?.description || 'Load the verified object catalog entry to see target details.'
      : illustrative?.description || 'Illustrative content only.'
  const targetTag =
    selectedId === 'rcw-36'
      ? { label: '● CATALOG', tone: 'fact' }
      : selectedId === 'candidate-02'
        ? { label: '● CANDIDATE', tone: 'candidate' }
        : { label: '● ILLUSTRATION', tone: 'demo' }

  useEffect(() => {
    let active = true
    setTarget(null)
    setTargetLoading(true)
    setTargetError(null)
    setObservations([])
    setObservationsLoading(selectedId === 'rcw-36')
    setObservationsError(null)

    if (selectedId !== 'rcw-36') {
      setTargetLoading(false)
      return () => {
        active = false
      }
    }

    fetchObjectInfo(selectedId).then((result) => {
      if (!active) return
      setTargetLoading(false)
      if (!result.ok) {
        setTargetError(result.error)
        setObservationsLoading(false)
        return
      }

      setTarget(result.data)
      if (result.data.ra === undefined || result.data.dec === undefined) {
        setObservationsLoading(false)
        setObservationsError('The object catalog entry has no query coordinates.')
        return
      }

      searchSpherexObservations(result.data.ra, result.data.dec).then((observationsResult) => {
        if (!active) return
        setObservationsLoading(false)
        if (observationsResult.ok) {
          cacheObservations(observationsResult.data.observations)
          setObservations(observationsResult.data.observations)
          setObservationsError(null)
        } else {
          setObservationsError(observationsResult.error)
        }
      })
    })

    return () => {
      active = false
    }
  }, [selectedId])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2800)
  }

  const selectTarget = (id: MarkerId) => {
    const next = new URLSearchParams(searchParams)
    next.set('target', id)
    next.delete('obs')
    next.delete('band')
    setSearchParams(next)
  }

  const cycleModel = () => {
    const params = new URLSearchParams(searchParams)
    const at = MODEL_ORDER.indexOf(model)
    const target = MODEL_ORDER[(at + 1) % MODEL_ORDER.length]
    if (target === 'solar') params.delete('model')
    else params.set('model', target)
    params.delete('target')
    setSearchParams(params, { replace: true })
    notify(target === 'solar' ? 'Solar System.' : `3D model: ${labelOf(target)}.`)
  }

  const resetView = (message: string) => {
    if (in3D) {
      useXRApp.getState().selectHotspot(null)
      setViewKey((key) => key + 1)
    } else {
      setRotation({ x: 0, y: 0 })
      setScale(1)
    }
    notify(message)
  }

  const togglePins = () => {
    const next = !useXRApp.getState().settings.pins
    useXRApp.getState().setSetting('pins', next)
    if (!next) useXRApp.getState().selectHotspot(null)
    notify(next ? 'Hotspots shown.' : 'Hotspots hidden.')
  }

  const cycleLayer = () => {
    if (!bodyModel || bodyLayers.length < 2) return
    const index = bodyLayers.findIndex((l) => l.id === bodyLayer?.id)
    const next = bodyLayers[(index + 1) % bodyLayers.length]
    useXRApp.getState().setLayer(bodyModel, next.id)
    notify(`NASA image layer: ${next.label}.`)
  }

  /** Exits the currently opened planet (or sky target) and returns to the 3D Solar System Hub. */
  const exitPlanet = () => {
    useXRApp.getState().selectHotspot(null)
    const params = new URLSearchParams(searchParams)
    params.delete('model')
    params.delete('target')
    setSearchParams(params)
    notify('Solar System.')
  }

  /** Step back: if a hotspot is selected on a planet, close the hotspot first; otherwise exit the planet to the Solar System. */
  const handleBack = () => {
    if (bodyModel && hotspot) {
      useXRApp.getState().selectHotspot(null)
      notify(`Back to ${bodyContent?.name || labelOf(bodyModel)}.`)
      return
    }
    exitPlanet()
  }

  /** Starts an immersive WebXR VR/AR session directly on the inline 3D canvas. */
  const handleImmersive = () => {
    if (!in3D || !xrIntent) return
    enterImmersive(xrIntent).catch((err) => notify(xrErrorMessage(err, xrIntent)))
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (in3D) return // the 3D view has its own orbit controls
    if ((event.target as HTMLElement).closest('button')) return
    isDragging.current = true
    lastPos.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return
    const dx = event.clientX - lastPos.current.x
    const dy = event.clientY - lastPos.current.y
    lastPos.current = { x: event.clientX, y: event.clientY }
    setRotation((current) => ({
      x: Math.max(-40, Math.min(40, current.x + dy * 0.12)),
      y: current.y + dx * 0.18,
    }))
  }

  const handleAskGuide = () => {
    // 3D model mode: the guide gets the body (and the selected pin's own question) as context
    if (bodyModel) {
      if (window.matchMedia('(max-width: 767px)').matches) {
        navigate(`/guide/${bodyModel}`)
        return
      }
      if (rawHotspot) {
        askGuide({ body: bodyModel, hotspotId: rawHotspot.id, guidePrompt: hotspot?.guidePrompt ?? rawHotspot.guidePrompt })
        return
      }
      window.dispatchEvent(
        new CustomEvent('cosmic:open-guide', { detail: { objectId: bodyModel, objectName: bodyContent?.name || labelOf(bodyModel) } }),
      )
      return
    }
    if (window.matchMedia('(max-width: 767px)').matches) {
      navigate(`/guide/${selectedId}`)
      return
    }
    window.dispatchEvent(
      new CustomEvent('cosmic:open-guide', {
        detail: { objectId: selectedId, objectName: currentName },
      }),
    )
  }
  const handleCompare = () => {
    if (selectedId !== 'rcw-36') {
      notify('Comparison requires catalog-backed observation records. Switch to RCW 36 to compare.')
      return
    }
    const params = new URLSearchParams({ target: selectedId })
    if (chosenObservation) params.set('obs', chosenObservation.observation_id)
    navigate(`/comparison?${params}`)
  }
  const handleEnterXR = (event?: React.MouseEvent<HTMLButtonElement>) => {
    const origin = originOf(event?.currentTarget ?? null)
    if (chosenObservation && selectedId === 'rcw-36') {
      useXRApp.getState().setObservationData(chosenObservation, null)
    }
    if (solar) {
      cycleModel()
      return
    }
    void runWormhole(
      {
        origin,
        label: 'Opening the Solar System Hub…',
        waitForScene: false,
        minMs: 580,
      },
      () => {
        useXRApp.getState().selectHotspot(null)
        const next = new URLSearchParams(searchParams)
        next.delete('model')
        next.delete('target')
        setSearchParams(next)
      },
    )
  }

  // Agentic voice-over of the open body: the Mission Liaison Agent's summary, spoken, with a replay toggle on the card
  const narration = useAgentNarration({
    objectId: bodyModel ?? '',
    objectName: bodyContent?.name ?? (bodyModel ? labelOf(bodyModel) : ''),
    objectType: bodyContent?.type ?? '',
    contentReady: !!bodyModel && bodyContent !== undefined,
    localDescription: bodyContent?.description?.en ?? '',
  })
  const voiceLabel =
    narration.speechStatus === 'loading'
      ? 'Preparing AI voice…'
      : narration.speechStatus === 'playing'
        ? 'AI voice playing'
        : narration.speechStatus === 'ready'
          ? narration.engine === 'browser'
            ? 'Replay voice (browser)'
            : 'Replay AI voice'
          : narration.speechStatus === 'error'
            ? 'AI voice unavailable'
            : 'No narration available'
  const voicePlaying = narration.speechStatus === 'playing'

  // Honest labels for the 3D mode: the selected pin's own Fact / Illustration / Candidate kind,
  // otherwise "3D model" (or "Illustration" when an asteroid falls back to the procedural placeholder).
  const bodyTag = solar
    ? { label: '● ILLUSTRATION', tone: 'demo' }
    : !bodyModel
    ? null
    : hotspot
      ? {
          label: `● ${KIND_LABEL[hotspot.kind].toUpperCase()}`,
          tone: hotspot.kind === 'fact' ? 'fact' : hotspot.kind === 'candidate' ? 'candidate' : 'demo',
        }
      : shapeIsIllustration
        ? { label: '● ILLUSTRATION', tone: 'demo' }
        : { label: '● 3D MODEL', tone: 'fact' }
  const headTag = bodyTag ?? targetTag
  const headLoading = solar ? false : bodyModel ? bodyContent === undefined : targetLoading || observationsLoading
  const bodyCredit = bodyContent ? [bodyContent.textureCredit, bodyContent.modelCredit].filter(Boolean).join(' · ') || 'NASA' : 'NASA'
  const nextModel = MODEL_ORDER[(MODEL_ORDER.indexOf(model) + 1) % MODEL_ORDER.length]
  const viewName = solar ? 'Solar System' : bodyModel ? bodyContent?.name || labelOf(bodyModel) : ''

  return (
    <div className="fe-app">
      <ParticleField count={140} />
      <TopBar />

      <main className="fe-explorer" id="explorer">
        {/* Bottom rising star particles with linear fade */}
        <div className="fe-particle-bottom-stream" aria-hidden="true">
          <ParticleField count={70} variant="bottom" />
        </div>

        <div
          className="fe-viewport"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => {
            isDragging.current = false
          }}
          onPointerCancel={() => {
            isDragging.current = false
          }}
          onWheel={(event) => {
            if (in3D) return
            setScale((value) => Math.max(0.75, Math.min(1.35, value - event.deltaY * 0.0006)))
          }}
        >
          {in3D ? (
            <ModelViewer3D bodyId={bodyModel ?? 'solar'} resetKey={viewKey} />
          ) : (
            <SkyScene3D selectedId={selectedId} onSelect={selectTarget} rotation={rotation} scale={scale} />
          )}
          <div className="fe-sky-title">
            <div className="fe-eyebrow">
              <span className="fe-pulse-dot" aria-hidden="true" />
              <span>{solar ? '3D chart · not to scale' : bodyModel ? '3D model · NASA data' : 'All-sky explorer · IRSA SPHEREx field'}</span>
            </div>
            <h2>{in3D ? viewName : selectedId === 'rcw-36' ? 'Vela Molecular Ridge' : currentName}</h2>
            <p className="fe-sky-coords">
              {solar ? (
                <span className="fe-coord-pill">Tap a planet to open it</span>
              ) : bodyModel ? (
                <span className="fe-coord-pill">
                  {bodyContent === undefined
                    ? 'Loading model…'
                    : `${bodyContent?.hotspots.length ?? 0} hotspots${pinsOn ? '' : ' · hidden'}`}
                </span>
              ) : selectedId === 'rcw-36' && target ? (
                <>
                  <span className="fe-coord-pill">RA {target.ra_hms || queryValue(target.ra)}</span>
                  <span className="fe-coord-dot">·</span>
                  <span className="fe-coord-pill">DEC {target.dec_dms || queryValue(target.dec)}</span>
                </>
              ) : (
                <span className="fe-coord-pill fe-coord-illustrative">Illustrative sky marker · no catalog coordinates</span>
              )}
            </p>
          </div>
          <div className="fe-toolbar">
            <button
              className="fe-icon-btn"
              onClick={() => resetView(in3D ? '3D view reset.' : 'Sky view orientation reset.')}
              aria-label="Reset view"
              title="Reset view"
            >
              ⌖
            </button>
            <button className="fe-icon-btn" onClick={() => (in3D ? resetView('View recentered.') : notify('View recentered to target.'))} aria-label="Recenter">
              ◎
            </button>
            <button
              className={`fe-icon-btn ${audioOn ? 'selected' : ''}`}
              onClick={() => {
                const next = toggleAudio()
                notify(next ? 'Ambient music enabled' : 'Ambient music muted')
              }}
              aria-label={audioOn ? 'Toggle audio off' : 'Toggle audio on'}
              title={audioOn ? 'Mute music' : 'Play music'}
            >
              ♫
            </button>
            <button
              className="fe-icon-btn cg-fab"
              onClick={handleAskGuide}
              aria-label="Open Cosmic Guide"
              title="Cosmic Guide"
            >
              <BotIcon />
            </button>
          </div>
          {/* New controls live in their own rail under the toolbar, so the four existing buttons never move.
              Round toggles only: one steps through the 3D bodies, the others act on the body that is shown. */}
          <div className="fe-model-rail" role="group" aria-label="3D model controls">
            <button
              type="button"
              className={`fe-icon-btn fe-model-toggle ${bodyModel ? 'selected' : ''}`}
              onClick={cycleModel}
              aria-pressed={!!bodyModel}
              aria-label={`3D models. Showing ${labelOf(model)}. Next: ${labelOf(nextModel)}`}
              title={`3D models · now ${labelOf(model)} · next ${labelOf(nextModel)}`}
            >
              3D
            </button>
            {!solar && (
              <button
                type="button"
                className="fe-icon-btn fe-back-toggle"
                onClick={handleBack}
                aria-label={hotspot ? `Back to ${bodyContent?.name || labelOf(model)}` : 'Back to Solar System'}
                title={hotspot ? `Back to ${bodyContent?.name || labelOf(model)}` : 'Back to Solar System'}
              >
                ←
              </button>
            )}
            {bodyModel && (
              <button
                type="button"
                className={`fe-icon-btn fe-pins-toggle ${pinsOn ? 'selected' : ''}`}
                onClick={togglePins}
                aria-pressed={pinsOn}
                aria-label={pinsOn ? 'Hide hotspots' : 'Show hotspots'}
                title={pinsOn ? 'Hide hotspots' : 'Show hotspots'}
              >
                ⦿
              </button>
            )}
            {bodyModel && bodyLayers.length > 1 && (
              <button
                type="button"
                className={`fe-icon-btn fe-layer-toggle ${dataLayerOn ? 'selected' : ''}`}
                onClick={cycleLayer}
                aria-pressed={dataLayerOn}
                aria-label={`NASA image layer: ${bodyLayer?.label ?? ''}. Switch layer`}
                title={`NASA image layer: ${bodyLayer?.label ?? ''}`}
              >
                ◐
              </button>
            )}
          </div>
          <div className="fe-view-hint">{in3D ? 'DRAG TO TURN · SCROLL TO ZOOM' : 'DRAG TO ROTATE SKY · SCROLL TO ZOOM'}</div>
        </div>

        <div className="fe-target-chip">
          <span className="fe-eyebrow">{solar ? '3D chart' : bodyModel ? (hotspot ? 'Hotspot selected' : '3D model') : 'Target selected'}</span>
          {headLoading && <WormholePulse decorative />}
          <span className={`fe-tag ${headTag.tone}`}>{headTag.label}</span>
        </div>

        <aside className="fe-hud" aria-live="polite">
          {solar && bodyTag ? (
            <>
              <div className="fe-hud-card fe-hud-object">
                <div className="fe-hud-head">
                  <span className="fe-eyebrow">3D chart</span>
                  <span className={`fe-tag ${bodyTag.tone}`}>{bodyTag.label}</span>
                </div>
                <h2>Solar System</h2>
                <p>Tap a planet to open its 3D model here. Planets sit at today's real direction from the Sun; sizes and distances are not to scale.</p>
                {xrIntent && (
                  <div className="fe-card-links">
                    <button type="button" className="fe-card-link" onClick={handleImmersive}>
                      <span>{xrIntent === 'vr' ? 'Enter VR' : 'Enter AR'}</span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="fe-hud-card fe-hud-telemetry">
                <div className="fe-data-grid">
                  <div className="fe-datum">
                    <span>Object ID</span>
                    <strong>solar-system</strong>
                  </div>
                  <div className="fe-datum">
                    <span>Classification</span>
                    <strong>Planetary system</strong>
                  </div>
                  <div className="fe-datum">
                    <span>Bodies</span>
                    <strong>{Object.keys(BODY_BY_ID).filter((id) => id !== 'spherex').length}</strong>
                  </div>
                  <div className="fe-datum">
                    <span>Label</span>
                    <strong>Illustration</strong>
                  </div>
                </div>
              </div>

              <div className="fe-hud-card fe-source-line">Source: JPL approximate planetary positions · NASA imagery</div>
            </>
          ) : bodyModel && bodyTag ? (
            <>
              <div className="fe-hud-card fe-hud-object">
                <div className="fe-hud-head">
                  <span className="fe-eyebrow">{hotspot ? 'Hotspot selected' : '3D model'}</span>
                  {headLoading && <WormholePulse decorative />}
                  <span className={`fe-tag ${bodyTag.tone}`}>{bodyTag.label}</span>
                </div>
                <h2>{hotspot ? hotspot.title : bodyContent?.name || labelOf(bodyModel)}</h2>
                <p>
                  {hotspot
                    ? hotspot.detail || hotspot.short
                    : bodyContent === undefined
                      ? 'Loading the 3D model and its hotspots.'
                      : bodyContent === null
                        ? 'No hotspot content is available for this body.'
                        : pinsOn
                          ? 'Drag to turn the model and tap a glowing pin to read about that place.'
                          : 'Hotspots are hidden. Use the ⦿ button to show them again.'}
                </p>
                {!hotspot && (
                  <div className="fe-voice">
                    {(narration.guideLoading || narration.guideAnswer) && (
                      <p className="fe-voice-text">{narration.guideLoading ? 'Cosmic Guide is preparing a summary…' : narration.guideAnswer?.replace(/[*_`#]/g, '')}</p>
                    )}
                    <div className="fe-voice-row">
                      <button
                        type="button"
                        className={`fe-icon-btn fe-voice-btn ${voicePlaying ? 'selected' : ''}`}
                        onClick={voicePlaying ? narration.stop : narration.replay}
                        disabled={!narration.canReplay}
                        aria-pressed={voicePlaying}
                        aria-label={voicePlaying ? 'Stop AI voice' : 'Play AI voice'}
                        title={voicePlaying ? 'Stop AI voice' : 'Play AI voice'}
                      >
                        <span aria-hidden="true">{voicePlaying ? '■' : '▶'}</span>
                      </button>
                      <span className="fe-voice-status" role="status">{voiceLabel}</span>
                    </div>
                  </div>
                )}
                <div className="fe-card-links">
                  {hotspot ? (
                    <button
                      type="button"
                      className="fe-card-link"
                      onClick={() => useXRApp.getState().selectHotspot(null)}
                    >
                      <span aria-hidden="true">←</span>
                      <span>Back to {bodyContent?.name || labelOf(bodyModel)}</span>
                    </button>
                  ) : (
                    <button type="button" className="fe-card-link" onClick={exitPlanet}>
                      <span aria-hidden="true">←</span>
                      <span>Back to Solar System</span>
                    </button>
                  )}
                  <button type="button" className="fe-card-link" onClick={exitPlanet}>
                    <span aria-hidden="true">✕</span>
                    <span>Exit planet</span>
                  </button>
                  {xrIntent && (
                    <button type="button" className="fe-card-link" onClick={handleImmersive}>
                      <span>{xrIntent === 'vr' ? 'Enter VR' : 'Enter AR'}</span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="fe-hud-card fe-hud-telemetry">
                <div className="fe-data-grid">
                  <div className="fe-datum">
                    <span>Object ID</span>
                    <strong>{bodyModel}</strong>
                  </div>
                  <div className="fe-datum">
                    <span>Classification</span>
                    <strong>{BODY_TYPE_LABEL[bodyContent?.type ?? ''] ?? 'Solar System body'}</strong>
                  </div>
                  <div className="fe-datum">
                    <span>Hotspots</span>
                    <strong>{bodyContent ? `${bodyContent.hotspots.length} · ${pinsOn ? 'shown' : 'hidden'}` : '—'}</strong>
                  </div>
                  <div className="fe-datum">
                    <span>Label</span>
                    <strong>{hotspot ? KIND_LABEL[hotspot.kind] : shapeIsIllustration ? 'Illustration' : 'NASA data'}</strong>
                  </div>
                  {bodyLayers.length > 1 && bodyLayer && (
                    <div className="fe-datum fe-datum-layer">
                      <span>NASA image layer</span>
                      <strong>{bodyLayer.label}</strong>
                      {bodyLayer.legend && (
                        <div className="fe-layer-legend" aria-label={`Colour scale from ${bodyLayer.legend.min} to ${bodyLayer.legend.max}`}>
                          <i style={{ background: `linear-gradient(90deg, ${bodyLayer.legend.stops.join(', ')})` }} />
                          <small>
                            <span>{bodyLayer.legend.min}</span>
                            <span>{bodyLayer.legend.max}</span>
                          </small>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="fe-hud-card fe-source-line">
                Source:{' '}
                {hotspot ? (
                  <a href={hotspot.source.url} target="_blank" rel="noopener noreferrer">
                    {hotspot.source.label}
                  </a>
                ) : dataLayerOn && bodyLayer ? (
                  bodyLayer.credit
                ) : (
                  bodyCredit
                )}
              </div>
            </>
          ) : (
          <>
          <div className="fe-hud-card fe-hud-object">
            <div className="fe-hud-head">
              <span className="fe-eyebrow">Target selected</span>
              {(targetLoading || observationsLoading) && <WormholePulse decorative />}
              <span className={`fe-tag ${targetTag.tone}`}>{targetTag.label}</span>
            </div>
            <h2>{targetLoading ? 'Loading catalog…' : currentName}</h2>
            <p>{targetLoading ? 'Fetching target information from the object catalog.' : currentDescription}</p>
            {targetError && <p className="fe-inline-error" role="alert">Catalog unavailable: {targetError}</p>}
            <div className="fe-card-links">
              <button type="button" className="fe-card-link" onClick={exitPlanet}>
                <span aria-hidden="true">←</span>
                <span>Back to Solar System</span>
              </button>
            </div>
          </div>

          <div className="fe-hud-card fe-hud-telemetry">
            <div className="fe-data-grid">
              <div className="fe-datum">
                <span>Object ID</span>
                <strong>{selectedId}</strong>
              </div>
              <div className="fe-datum">
                <span>Classification</span>
                <strong>{currentType}</strong>
              </div>
              <div className="fe-datum">
                <span>Right ascension</span>
                <strong>{selectedId === 'rcw-36' ? target?.ra_hms || queryValue(target?.ra) : 'Not cataloged'}</strong>
              </div>
              <div className="fe-datum">
                <span>Declination</span>
                <strong>{selectedId === 'rcw-36' ? target?.dec_dms || queryValue(target?.dec) : 'Not cataloged'}</strong>
              </div>
              <div className="fe-datum">
                <span>Observation</span>
                {observations.length > 1 ? (
                  <select
                    className="fe-obs-select"
                    value={chosenObservation?.observation_id || ''}
                    onChange={(e) => {
                      const next = new URLSearchParams(searchParams)
                      next.set('obs', e.target.value)
                      setSearchParams(next)
                    }}
                    aria-label="Select SPHEREx observation"
                  >
                    {observations.slice(0, 50).map((obs) => (
                      <option key={obs.observation_id} value={obs.observation_id}>
                        {obs.observation_id} ({obs.detector || 'D'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <strong>{observationsLoading ? 'Loading…' : chosenObservation?.observation_id || 'No record selected'}</strong>
                )}
              </div>
              <div className="fe-datum">
                <span>Observed at (UTC)</span>
                <strong>{chosenObservation?.observed_at_utc || 'Not available'}</strong>
              </div>
            </div>
            {observationsError && <p className="fe-inline-error" role="alert">Observation search failed: {observationsError}</p>}
            {!observationsLoading && !observationsError && selectedId === 'rcw-36' && observations.length === 0 && (
              <p className="fe-muted" role="status">No SPHEREx observation records were returned for this search.</p>
            )}
          </div>

          <div className="fe-hud-card fe-source-line">
            Source: {selectedId === 'rcw-36' ? target?.source || 'Object catalog and IRSA SIA2' : 'Illustrative interface marker; no catalog source'}
          </div>
          </>
          )}

          <div className="fe-hud-actions">
            <button className="fe-btn-primary" onClick={handleAskGuide}>
              <span>Ask the Guide</span><span aria-hidden="true">↗</span>
            </button>
            <button className="fe-btn-text" onClick={handleCompare}>
              <span>Compare observations</span><span aria-hidden="true">→</span>
            </button>
            <button className="fe-btn-text fe-btn-gold" onClick={handleEnterXR}>
              <span>Enter 3D Table (XR)</span><span aria-hidden="true">↗</span>
            </button>
          </div>

          <div className="fe-dock">
            <button
              onClick={(event) => {
                const origin = originOf(event.currentTarget)
                void runWormhole(
                  {
                    origin,
                    label: 'Returning to Gateway…',
                    waitForScene: false,
                    minMs: 400,
                  },
                  () => navigate('/')
                )
              }}
            >
              Exit to Gateway
            </button>
            <button
              onClick={(event) => {
                const origin = originOf(event.currentTarget)
                void runWormhole(
                  {
                    origin,
                    label: 'Opening the Solar System Hub…',
                    waitForScene: false,
                    minMs: 580,
                  },
                  () => {
                    useXRApp.getState().selectHotspot(null)
                    const next = new URLSearchParams(searchParams)
                    next.delete('model')
                    next.delete('target')
                    setSearchParams(next)
                  },
                )
              }}
            >
              Solar System Hub
            </button>
          </div>
        </aside>

      </main>

      {toast && <div className="fe-toast" role="status">{toast}</div>}
    </div>
  )
}
