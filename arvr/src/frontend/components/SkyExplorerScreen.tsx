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
import { ModelViewer3D, MODEL_BODIES, isModelBody, type ModelBodyId } from './ModelViewer3D'
import { useBodyContent, useSitesForBody } from '../../xr/content'
import { useDeviceCaps } from '../../xr/device'
import { KIND_LABEL } from '../../xr/InfoCard'
import { localHotspot } from '../../xr/i18n'
import { askGuide } from '../../xr/events'
import { layersFor } from '../../xr/layers'

type MarkerId = 'rcw-36' | 'candidate-02' | 'demo-tile-01'

/**
 * What the viewport shows: the SPHEREx sky (default, unchanged) or one of the AR/VR app's 3D bodies.
 * One round toggle in the model rail steps through Sky -> Mars -> Moon -> Bennu -> Sky, so the screen gains
 * a single control instead of a switcher. All 3D-mode text is English.
 */
type ViewportModel = 'sky' | ModelBodyId
const MODEL_ORDER: ViewportModel[] = ['sky', ...MODEL_BODIES]
const MODEL_LABELS: Record<ViewportModel, string> = { sky: 'Sky', mars: 'Mars', moon: 'Moon', bennu: 'Bennu' }
const BODY_TYPE_LABEL: Record<string, string> = { planet: 'Planet', moon: 'Moon', asteroid: 'Near-Earth asteroid', star: 'Star' }
/** Walkable site offered from a 3D body when no pin with its own site is selected (content/sites/<id>.json). */
const DEFAULT_SITE: Record<ModelBodyId, { id: string; name: string }> = {
  mars: { id: 'jezero', name: 'Jezero Crater' },
  moon: { id: 'apollo11', name: 'Apollo 11 site' },
  bennu: { id: 'bennu-nightingale', name: 'Bennu surface' },
}

function parseModel(value: string | null): ViewportModel {
  return isModelBody(value) ? value : 'sky'
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
  const lang = useXRApp((s) => s.settings.lang)
  const [target, setTarget] = useState<ObjectInfo | null>(null)
  const [targetLoading, setTargetLoading] = useState(true)
  const [targetError, setTargetError] = useState<string | null>(null)
  const [observations, setObservations] = useState<SpherexObservation[]>([])
  const [observationsLoading, setObservationsLoading] = useState(true)
  const [observationsError, setObservationsError] = useState<string | null>(null)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  // 3D body (from the AR/VR app) shown in the viewport instead of the sky targets
  const model = parseModel(searchParams.get('model'))
  const bodyModel = model === 'sky' ? null : model
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
  const bodySites = useSitesForBody(bodyModel)
  // walkable surface site: the selected pin's own site, else the body's featured one
  const surfaceSite = !bodyModel
    ? null
    : rawHotspot?.site
      ? { id: rawHotspot.site, name: bodySites.find((site) => site.id === rawHotspot.site)?.name ?? hotspot?.title ?? rawHotspot.title }
      : { ...DEFAULT_SITE[bodyModel], name: bodySites.find((site) => site.id === DEFAULT_SITE[bodyModel].id)?.name ?? DEFAULT_SITE[bodyModel].name }

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
    const next = MODEL_ORDER[(MODEL_ORDER.indexOf(model) + 1) % MODEL_ORDER.length]
    const params = new URLSearchParams(searchParams)
    if (next === 'sky') params.delete('model')
    else params.set('model', next)
    setSearchParams(params, { replace: true })
    notify(next === 'sky' ? 'Sky view.' : `3D model: ${MODEL_LABELS[next]}.`)
  }

  const resetView = (message: string) => {
    if (bodyModel) {
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

  /** Stand on the surface: the walkable NASA-elevation site in the 3D scene (screen, VR and AR). */
  const handleSurface = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!bodyModel || !surfaceSite) return
    const origin = originOf(event.currentTarget)
    void runWormhole({ origin }, () => navigate(`/xr/surface/${surfaceSite.id}`))
  }

  /** Opens the same body in the AR/VR scene with the mode picker up, so VR/AR starts from a real tap there. */
  const handleImmersive = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!bodyModel || !xrIntent) return
    const origin = originOf(event.currentTarget)
    void runWormhole({ origin }, () => navigate(`/xr/body/${bodyModel}?intent=${xrIntent}`))
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (bodyModel) return // the 3D model has its own orbit controls
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
        new CustomEvent('cosmic:open-guide', { detail: { objectId: bodyModel, objectName: bodyContent?.name || MODEL_LABELS[bodyModel] } }),
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
    if (bodyModel) {
      void runWormhole({ origin }, () => navigate(`/xr/body/${bodyModel}`))
      return
    }
    if (selectedId !== 'rcw-36') {
      void runWormhole({ origin }, () => navigate('/xr/body/spherex'))
      return
    }
    const params = new URLSearchParams({ target: selectedId })
    if (chosenObservation) {
      params.set('obs', chosenObservation.observation_id)
      const wavelength = chosenObservation.effective_wavelength_at_target
      if (wavelength) params.set('band', wavelength)
      useXRApp.getState().setObservationData(chosenObservation, null)
    }
    void runWormhole({ origin }, () => navigate(`/xr/body/spherex?${params}`))
  }

  // Honest labels for the 3D mode: the selected pin's own Fact / Illustration / Candidate kind,
  // otherwise "3D model" (or "Illustration" when an asteroid falls back to the procedural placeholder).
  const bodyTag = !bodyModel
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
  const headLoading = bodyModel ? bodyContent === undefined : targetLoading || observationsLoading
  const bodyCredit = bodyContent ? [bodyContent.textureCredit, bodyContent.modelCredit].filter(Boolean).join(' · ') || 'NASA' : 'NASA'
  const nextModel = MODEL_ORDER[(MODEL_ORDER.indexOf(model) + 1) % MODEL_ORDER.length]

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
            if (bodyModel) return
            setScale((value) => Math.max(0.75, Math.min(1.35, value - event.deltaY * 0.0006)))
          }}
        >
          {bodyModel ? (
            <ModelViewer3D bodyId={bodyModel} resetKey={viewKey} />
          ) : (
            <SkyScene3D selectedId={selectedId} onSelect={selectTarget} rotation={rotation} scale={scale} />
          )}
          <div className="fe-sky-title">
            <div className="fe-eyebrow">
              <span className="fe-pulse-dot" aria-hidden="true" />
              <span>{bodyModel ? '3D model · NASA data' : 'All-sky explorer · IRSA SPHEREx field'}</span>
            </div>
            <h2>{bodyModel ? bodyContent?.name || MODEL_LABELS[bodyModel] : selectedId === 'rcw-36' ? 'Vela Molecular Ridge' : currentName}</h2>
            <p className="fe-sky-coords">
              {bodyModel ? (
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
              onClick={() => resetView(bodyModel ? '3D model view reset.' : 'Sky view orientation reset.')}
              aria-label="Reset view"
              title="Reset view"
            >
              ⌖
            </button>
            <button className="fe-icon-btn" onClick={() => (bodyModel ? resetView('Model recentered.') : notify('View recentered to target.'))} aria-label="Recenter">
              ◎
            </button>
            <button
              className={`fe-icon-btn ${audioOn ? 'selected' : ''}`}
              onClick={() => {
                const next = toggleAudio()
                notify(next ? (lang === 'id' ? 'Musik latar aktif' : 'Ambient music enabled') : (lang === 'id' ? 'Musik latar nonaktif' : 'Ambient music muted'))
              }}
              aria-label={audioOn ? 'Toggle audio off' : 'Toggle audio on'}
              title={audioOn ? (lang === 'id' ? 'Matikan musik' : 'Mute music') : (lang === 'id' ? 'Nyalakan musik' : 'Play music')}
            >
              ♫
            </button>
            <button
              className="fe-icon-btn cg-fab"
              onClick={handleAskGuide}
              aria-label={lang === 'id' ? 'Buka Cosmic Guide' : 'Open Cosmic Guide'}
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
              aria-label={`3D models. Showing ${MODEL_LABELS[model]}. Next: ${MODEL_LABELS[nextModel]}`}
              title={`3D models · now ${MODEL_LABELS[model]} · next ${MODEL_LABELS[nextModel]}`}
            >
              3D
            </button>
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
          <div className="fe-view-hint">{bodyModel ? 'DRAG TO TURN · SCROLL TO ZOOM' : 'DRAG TO ROTATE SKY · SCROLL TO ZOOM'}</div>
        </div>

        <div className="fe-target-chip">
          <span className="fe-eyebrow">{bodyModel ? (hotspot ? 'Hotspot selected' : '3D model') : 'Target selected'}</span>
          {headLoading && <WormholePulse decorative />}
          <span className={`fe-tag ${headTag.tone}`}>{headTag.label}</span>
        </div>

        <aside className="fe-hud" aria-live="polite">
          {bodyModel && bodyTag ? (
            <>
              <div className="fe-hud-card fe-hud-object">
                <div className="fe-hud-head">
                  <span className="fe-eyebrow">{hotspot ? 'Hotspot selected' : '3D model'}</span>
                  {headLoading && <WormholePulse decorative />}
                  <span className={`fe-tag ${bodyTag.tone}`}>{bodyTag.label}</span>
                </div>
                <h2>{hotspot ? hotspot.title : bodyContent?.name || MODEL_LABELS[bodyModel]}</h2>
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
                {(surfaceSite || xrIntent) && (
                  <div className="fe-card-links">
                    {surfaceSite && (
                      <button type="button" className="fe-card-link" onClick={handleSurface}>
                        <span>Walk on {surfaceSite.name}</span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    )}
                    {xrIntent && (
                      <button type="button" className="fe-card-link" onClick={handleImmersive}>
                        <span>{xrIntent === 'vr' ? 'Enter VR' : 'Enter AR'}</span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    )}
                  </div>
                )}
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
                    label: lang === 'id' ? 'Kembali ke Gateway…' : 'Returning to Gateway…',
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
                void runWormhole({ origin }, () => navigate('/xr'))
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
