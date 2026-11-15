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

type MarkerId = 'rcw-36' | 'candidate-02' | 'demo-tile-01'

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

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
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
          onWheel={(event) => setScale((value) => Math.max(0.75, Math.min(1.35, value - event.deltaY * 0.0006)))}
        >
          <SkyScene3D selectedId={selectedId} onSelect={selectTarget} rotation={rotation} scale={scale} />
          <div className="fe-sky-title">
            <div className="fe-eyebrow">
              <span className="fe-pulse-dot" aria-hidden="true" />
              <span>All-sky explorer · IRSA SPHEREx field</span>
            </div>
            <h2>{selectedId === 'rcw-36' ? 'Vela Molecular Ridge' : currentName}</h2>
            <p className="fe-sky-coords">
              {selectedId === 'rcw-36' && target ? (
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
              onClick={() => {
                setRotation({ x: 0, y: 0 })
                setScale(1)
                notify('Sky view orientation reset.')
              }}
              aria-label="Reset view"
              title="Reset view"
            >
              ⌖
            </button>
            <button className="fe-icon-btn" onClick={() => notify('View recentered to target.')} aria-label="Recenter">
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
          <div className="fe-view-hint">DRAG TO ROTATE SKY · SCROLL TO ZOOM</div>
        </div>

        <div className="fe-target-chip">
          <span className="fe-eyebrow">Target selected</span>
          {(targetLoading || observationsLoading) && <WormholePulse decorative />}
          <span className={`fe-tag ${targetTag.tone}`}>{targetTag.label}</span>
        </div>

        <aside className="fe-hud" aria-live="polite">
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
