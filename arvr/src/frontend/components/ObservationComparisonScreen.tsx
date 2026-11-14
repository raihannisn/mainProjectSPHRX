import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchObjectInfo, searchSpherexObservations, type ObjectInfo, type SpherexObservation } from '../api'
import { TopBar } from './TopBar'
import { ParticleField } from './ParticleField'
import { cacheObservations, useXRApp } from '../../xr/store'

type CompareMode = 'blink' | 'side' | 'wipe'

function choosePair(observations: SpherexObservation[], requestedId: string | null) {
  if (observations.length < 2) return null
  const firstIndex = observations.findIndex((item) => item.observation_id === requestedId)
  const indexA = firstIndex >= 0 ? firstIndex : 0
  const first = observations[indexA]
  const second = observations.find((item, index) => index > indexA && item.observation_id !== first.observation_id)
    || observations.find((item) => item.observation_id !== first.observation_id)
  return second ? [first, second] as const : null
}

function formatUtc(value: string | null | undefined) {
  return value ? value.replace('T', ' ').replace(/Z$/, ' UTC') : 'Timestamp unavailable'
}

export function ObservationComparisonScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const targetId = searchParams.get('target') || 'rcw-36'
  const [mode, setMode] = useState<CompareMode>('blink')
  const [blinkEpoch, setBlinkEpoch] = useState<'A' | 'B'>('A')
  const [blinkPlaying, setBlinkPlaying] = useState(true)
  const [wipePos, setWipePos] = useState(50)
  const [object, setObject] = useState<ObjectInfo | null>(null)
  const [observations, setObservations] = useState<SpherexObservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setObject(null)
    setObservations([])
    setImageErrors({})

    if (targetId !== 'rcw-36') {
      setLoading(false)
      setError(`Target "${targetId}" is an illustrative marker without archive observation records. Switch to RCW 36 for live SPHEREx comparison.`)
      return () => {
        active = false
      }
    }

    fetchObjectInfo(targetId).then((objectResult) => {
      if (!active) return
      if (!objectResult.ok) {
        setLoading(false)
        setError(`Could not load target "${targetId}": ${objectResult.error}`)
        return
      }

      setObject(objectResult.data)
      const { ra, dec } = objectResult.data
      if (ra === undefined || dec === undefined) {
        setLoading(false)
        setError('This catalog target does not provide coordinates for an observation search.')
        return
      }

      searchSpherexObservations(ra, dec).then((result) => {
        if (!active) return
        setLoading(false)
        if (result.ok) {
          cacheObservations(result.data.observations)
          setObservations(result.data.observations)
        } else {
          setError(`Observation search failed: ${result.error}`)
        }
      })
    })

    return () => {
      active = false
    }
  }, [targetId])

  useEffect(() => {
    if (mode !== 'blink' || !blinkPlaying) return
    const timer = window.setInterval(() => setBlinkEpoch((current) => current === 'A' ? 'B' : 'A'), 1100)
    return () => window.clearInterval(timer)
  }, [mode, blinkPlaying])

  const pair = choosePair(observations, searchParams.get('obs'))
  const activeObservation = pair ? pair[blinkEpoch === 'A' ? 0 : 1] : null
  const enterXR = () => {
    const params = new URLSearchParams({ target: targetId })
    if (pair) {
      params.set('obs', pair[0].observation_id)
      params.set('obs2', pair[1].observation_id)
      if (pair[0].effective_wavelength_at_target) params.set('band', pair[0].effective_wavelength_at_target)
      useXRApp.getState().setObservationData(pair[0], pair[1])
    }
    navigate(`/xr/body/spherex?${params}`)
  }

  const markImageError = (observation: SpherexObservation) => {
    setImageErrors((current) => ({ ...current, [observation.observation_id]: true }))
  }

  const renderImage = (observation: SpherexObservation, label: string) => {
    if (imageErrors[observation.observation_id]) {
      return <div className="fe-image-unavailable" role="status">Preview unavailable for {observation.observation_id}</div>
    }
    return (
      <img
        src={observation.preview_url}
        alt={`${label}: SPHEREx observation ${observation.observation_id}`}
        onError={() => markImageError(observation)}
      />
    )
  }

  return (
    <div className="fe-app">
      <ParticleField />
      <TopBar />
      <main className="fe-compare">
        <div className="fe-compare-top">
          <div>
            <div className="fe-eyebrow">Observation comparison · Target: {targetId.toUpperCase()}</div>
            <h1>{object?.name || (loading ? 'Loading target…' : 'Observation comparison')}</h1>
            <p className="fe-compare-sub">
              Compare separate SPHEREx archive records. The visualization does not represent continuous motion.
            </p>
          </div>
          <div className="fe-compare-nav">
            <button className="fe-btn-text" onClick={() => navigate(`/explorer?target=${encodeURIComponent(targetId)}`)}>
              ← Sky Explorer
            </button>
            <button className="fe-btn-primary fe-btn-gold" onClick={enterXR}>
              Inspect in 3D Table ↗
            </button>
          </div>
        </div>

        {loading && <div className="fe-data-message" role="status">Searching the IRSA SPHEREx archive…</div>}
        {error && <div className="fe-data-message fe-data-error" role="alert">{error}</div>}
        {!loading && !error && !pair && (
          <div className="fe-data-message" role="status">
            {observations.length === 0
              ? 'No SPHEREx observation records were returned for this target.'
              : 'At least two distinct observation records are required for comparison. Only one record was returned.'}
          </div>
        )}

        {pair && (
          <>
            <div className="fe-epoch-row">
              {pair.map((observation, index) => (
                <article className="fe-epoch-card" key={observation.observation_id}>
                  <div>
                    <h3>OBSERVATION {index === 0 ? 'A' : 'B'} · {observation.release || 'SPHEREx archive'}</h3>
                    <p>{formatUtc(observation.observed_at_utc)}</p>
                    <small className="fe-muted">{observation.detector || 'Detector unavailable'}</small>
                  </div>
                  <span className="band">
                    {observation.observation_id}
                    <br />
                    {observation.effective_wavelength_at_target || 'Wavelength unavailable'}
                  </span>
                </article>
              ))}
            </div>

            <div className="fe-compare-controls">
              <div className="fe-tabs" role="tablist" aria-label="Comparison mode">
                <button className={`fe-tab ${mode === 'blink' ? 'active' : ''}`} onClick={() => setMode('blink')}>Blink comparator</button>
                <button className={`fe-tab ${mode === 'side' ? 'active' : ''}`} onClick={() => setMode('side')}>Side-by-side</button>
                <button className={`fe-tab ${mode === 'wipe' ? 'active' : ''}`} onClick={() => setMode('wipe')}>Wipe slider</button>
              </div>
              <div className="fe-honesty">! &nbsp; Two separate archive snapshots — not continuous motion video</div>
            </div>

            <div className="fe-comparison-view">
              {mode === 'blink' && activeObservation && (
                <div className="fe-compare-single">
                  <span className={`fe-image-label ${blinkEpoch === 'A' ? 'left' : 'right'}`}>
                    Observation {blinkEpoch} · {activeObservation.observation_id}
                  </span>
                  {renderImage(activeObservation, `Observation ${blinkEpoch}`)}
                  <div className="fe-compare-buttons">
                    <button className="fe-btn-text" onClick={() => setBlinkPlaying((value) => !value)}>
                      {blinkPlaying ? '⏸ Pause' : '▶ Play'}
                    </button>
                    <button className="fe-btn-text" onClick={() => {
                      setBlinkPlaying(false)
                      setBlinkEpoch((current) => current === 'A' ? 'B' : 'A')
                    }}>
                      Flip ({blinkEpoch})
                    </button>
                  </div>
                </div>
              )}
              {mode === 'side' && (
                <div className="fe-compare-sides">
                  {pair.map((observation, index) => (
                    <div className="fe-comparison-pane" key={observation.observation_id}>
                      <span className={`fe-image-label ${index === 0 ? 'left' : 'right'}`}>
                        Observation {index === 0 ? 'A' : 'B'} · {observation.observation_id}
                      </span>
                      {renderImage(observation, `Observation ${index === 0 ? 'A' : 'B'}`)}
                    </div>
                  ))}
                </div>
              )}
              {mode === 'wipe' && (
                <div className="fe-wipe-container" style={{ '--wipe-pos': `${wipePos}%` } as React.CSSProperties}>
                  <span className="fe-image-label left">A · {pair[0].observation_id}</span>
                  <span className="fe-image-label right">B · {pair[1].observation_id}</span>
                  <div className="fe-wipe-layer">{renderImage(pair[1], 'Observation B')}</div>
                  <div className="fe-wipe-layer top">{renderImage(pair[0], 'Observation A')}</div>
                  <input
                    type="range"
                    className="fe-wipe-range"
                    min="10"
                    max="90"
                    value={wipePos}
                    onChange={(event) => setWipePos(Number(event.target.value))}
                    aria-label="Wipe comparison divider position"
                  />
                </div>
              )}
            </div>

            <div className="fe-compare-foot">
              <span>SPHEREx archive previews · Visual comparison only</span>
              <span className="fe-mono">
                {mode === 'blink'
                  ? `SHOWING ${blinkEpoch} · ${blinkPlaying ? 'AUTO 1.1S' : 'PAUSED'}`
                  : mode === 'wipe' ? `WIPE SPLIT: ${wipePos}%` : 'SIDE-BY-SIDE DUAL VIEW'}
              </span>
            </div>

            <div className="fe-epoch-downloads">
              {pair.map((observation, index) => (
                <a key={observation.observation_id} href={observation.fits_url} target="_blank" rel="noopener noreferrer">
                  Download observation {index === 0 ? 'A' : 'B'} FITS ↗
                </a>
              ))}
            </div>

            <div className="fe-scientific-notes" style={{ margin: '18px 0 0', padding: '14px 18px', background: 'rgba(7,11,31,0.7)', border: '1px solid rgba(79,227,214,0.2)', borderRadius: '4px', fontSize: '0.82rem', color: '#c7cde6', lineHeight: 1.55 }}>
              <strong style={{ color: '#4fe3d6', display: 'block', marginBottom: '6px' }}>Scientific Integrity Disclosures</strong>
              <p style={{ margin: '0 0 6px' }}>
                • <strong>Photometric Notice</strong>: Visual preview only; not calibrated for quantitative photometry. Validated astrophysical variability or proper motion requires PSF aperture photometry on unresampled Level 2 images.
              </p>
              <p style={{ margin: '0 0 6px' }}>
                • <strong>Bandpass Overlap</strong>: Geometric bandpass overlap is derived from authoritative CWAVE/CBAND parameters (75.8% narrower filter, 54.6% IoU). WCS-WAVE serves as visualization fallback (74.6% narrower filter, 52.6% IoU).
              </p>
              <p style={{ margin: 0 }}>
                • <strong>Quality Flag</strong>: Level 2 quality flag status applies to the sampled pixel only. Bit 21 (SOURCE) indicates detected source presence without asserting detector-wide flag absence.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
