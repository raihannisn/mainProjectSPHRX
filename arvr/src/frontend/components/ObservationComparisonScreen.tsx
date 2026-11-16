import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  fetchObjectCatalog,
  requestGuideReply,
  type ObjectInfo,
  type SpherexObservation,
  searchSpherexObservations,
} from '../api'
import { TopBar } from './TopBar'
import { ParticleField } from './ParticleField'
import { WormholePulse } from './WormholeOverlay'
import { originOf, runWormhole } from '../wormhole'
import { cacheObservations, useXRApp } from '../../xr/store'

type CompareMode = 'wipe' | 'blink' | 'side'

function parseUtcTimestamp(value: string) {
  const withTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`
  return Date.parse(withTimezone)
}

function selectComparisonPair(observations: SpherexObservation[], preferredObservationId?: string | null) {
  const byDetector = new Map<string, Map<string, SpherexObservation>>()

  for (const observation of observations) {
    const detector = observation.detector?.trim()
    const timestamp = observation.observed_at_utc ? parseUtcTimestamp(observation.observed_at_utc) : NaN
    if (!detector || !Number.isFinite(timestamp)) continue

    const detectorObservations = byDetector.get(detector) ?? new Map<string, SpherexObservation>()
    const previous = detectorObservations.get(observation.observation_id)
    if (
      !previous ||
      (observation.release?.includes('QR3') && !previous.release?.includes('QR3'))
    ) {
      detectorObservations.set(observation.observation_id, observation)
    }
    byDetector.set(detector, detectorObservations)
  }

  const candidates = Array.from(byDetector.entries())
    .map(([detector, records]) => {
      const sorted = Array.from(records.values()).sort(
        (a, b) => parseUtcTimestamp(a.observed_at_utc!) - parseUtcTimestamp(b.observed_at_utc!),
      )
      return { detector, sorted, span: sorted.length > 1
        ? parseUtcTimestamp(sorted[sorted.length - 1].observed_at_utc!) - parseUtcTimestamp(sorted[0].observed_at_utc!)
        : 0 }
    })
    .filter((candidate) => candidate.sorted.length > 1 && candidate.span > 0)
    .sort((a, b) => b.span - a.span || b.sorted.length - a.sorted.length || a.detector.localeCompare(b.detector))

  if (preferredObservationId) {
    const preferredGroup = candidates.find((candidate) =>
      candidate.sorted.some((observation) => observation.observation_id === preferredObservationId),
    )
    const preferred = preferredGroup?.sorted.find(
      (observation) => observation.observation_id === preferredObservationId,
    )
    if (preferred && preferredGroup) {
      const preferredTime = parseUtcTimestamp(preferred.observed_at_utc!)
      const other = preferredGroup.sorted
        .filter((observation) => observation.observation_id !== preferredObservationId)
        .sort(
          (a, b) =>
            Math.abs(parseUtcTimestamp(b.observed_at_utc!) - preferredTime) -
            Math.abs(parseUtcTimestamp(a.observed_at_utc!) - preferredTime),
        )[0]
      if (other) {
        return parseUtcTimestamp(preferred.observed_at_utc!) < parseUtcTimestamp(other.observed_at_utc!)
          ? [preferred, other] as const
          : [other, preferred] as const
      }
    }
  }

  const selected = candidates[0]?.sorted
  return selected ? ([selected[0], selected[selected.length - 1]] as const) : null
}

function formatUtc(value: string | null | undefined) {
  if (!value) return 'Timestamp unavailable'
  const timestamp = parseUtcTimestamp(value)
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return 'Timestamp unavailable'
  return `${new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date)} UTC`
}

function formatEpochDate(value: string | null | undefined) {
  if (!value) return 'Time unavailable'
  const timestamp = parseUtcTimestamp(value)
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return 'Time unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatCoordinate(value: number | undefined, sexagesimal: string | undefined) {
  if (sexagesimal) return sexagesimal
  return value === undefined ? 'Unavailable' : `${value.toFixed(4)}°`
}

export function ObservationComparisonScreen() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const targetId = searchParams.get('target') || 'rcw-36'
  const selectedObservationId = searchParams.get('obs')

  // Comparison mode & wiper state
  const [mode, setMode] = useState<CompareMode>('wipe')
  const [sliderPos, setSliderPos] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const sliderContainerRef = useRef<HTMLDivElement | null>(null)

  // Blink comparator state
  const [blinkEpoch, setBlinkEpoch] = useState<'A' | 'B'>('A')
  const [blinkPlaying, setBlinkPlaying] = useState(true)
  const [blinkSpeed, setBlinkSpeed] = useState<'normal' | 'fast'>('normal')

  // Target info & data pair
  const [catalog, setCatalog] = useState<ObjectInfo[]>([])
  const [object, setObject] = useState<ObjectInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [pair, setPair] = useState<readonly [SpherexObservation, SpherexObservation] | null>(null)

  // Fallback states for images
  const [imgError, setImgError] = useState<{ t1: boolean; t2: boolean }>({
    t1: false,
    t2: false,
  })

  // Cosmic Guide AI state
  const [aiPrompt, setAiPrompt] = useState('')
  const [lastQuestion, setLastQuestion] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiFullText, setAiFullText] = useState<string | null>(null)
  const [aiDisplayedText, setAiDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [copied, setCopied] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Fetch catalog object metadata
  useEffect(() => {
    let active = true
    setLoading(true)
    setObject(null)
    setPair(null)
    setDataError(null)
    setImgError({ t1: false, t2: false })

    fetchObjectCatalog().then((catalogResult) => {
      if (!active) return
      if (!catalogResult.ok) {
        setCatalog([])
        setLoading(false)
        const rawErr = catalogResult.error || ''
        const is502OrHtml =
          rawErr.includes('502') ||
          rawErr.includes('<html') ||
          rawErr.includes('<!DOCTYPE') ||
          rawErr.toLowerCase().includes('bad gateway') ||
          rawErr.toLowerCase().includes('proxy error') ||
          rawErr.includes('arsip NASA sedang sibuk')
        if (is502OrHtml) {
          setDataError('Server arsip NASA sedang sibuk. Silakan coba beberapa saat lagi.')
        } else {
          setDataError(`Could not load the object catalog: ${rawErr}`)
        }
        return
      }

      setCatalog(catalogResult.data)
      const selectedObject = catalogResult.data.find((entry) => entry.id === targetId)
      if (!selectedObject) {
        setLoading(false)
        setDataError('This target is not in the object catalog. Choose a catalog target to compare.')
        return
      }

      setObject(selectedObject)
      if (
        selectedObject.ra === undefined ||
        selectedObject.dec === undefined
      ) {
        setLoading(false)
        setDataError('This catalog entry has no sky coordinates for an archive search. Choose a target with coordinates.')
        return
      }

      searchSpherexObservations(selectedObject.ra, selectedObject.dec).then((observationsResult) => {
        if (!active) return
        setLoading(false)
        if (!observationsResult.ok) {
          const rawErr = observationsResult.error || ''
          const is502OrHtml =
            rawErr.includes('502') ||
            rawErr.includes('<html') ||
            rawErr.includes('<!DOCTYPE') ||
            rawErr.toLowerCase().includes('bad gateway') ||
            rawErr.toLowerCase().includes('proxy error') ||
            rawErr.includes('arsip NASA sedang sibuk')
          if (is502OrHtml) {
            setDataError('Server arsip NASA sedang sibuk. Silakan coba beberapa saat lagi.')
          } else {
            setDataError(`Could not search SPHEREx observations: ${rawErr}`)
          }
          return
        }

        const selectedPair = selectComparisonPair(
          observationsResult.data.observations,
          selectedObservationId,
        )
        if (!selectedPair) {
          setDataError('Fewer than two timestamped observations from the same detector are available for this target.')
          return
        }

        setPair(selectedPair)
        cacheObservations([...selectedPair])
      })
    })

    return () => {
      active = false
    }
  }, [targetId, selectedObservationId, retryCount])

  const comparisonTargets = catalog.filter(
    (entry) => entry.id && entry.ra !== undefined && entry.dec !== undefined,
  )

  const handleTargetChange = (nextTargetId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('target', nextTargetId)
    next.delete('obs')
    next.delete('band')
    setSearchParams(next)
  }

  // Typewriter effect for Cosmic Guide AI
  useEffect(() => {
    if (!aiFullText) {
      setAiDisplayedText('')
      setIsTyping(false)
      return
    }

    setIsTyping(true)
    let currIdx = 0
    const textLength = aiFullText.length
    const step = 2
    const intervalMs = 18

    const timer = window.setInterval(() => {
      currIdx = Math.min(currIdx + step, textLength)
      setAiDisplayedText(aiFullText.slice(0, currIdx))
      if (currIdx >= textLength) {
        setIsTyping(false)
        clearInterval(timer)
      }
    }, intervalMs)

    return () => clearInterval(timer)
  }, [aiFullText])

  // Smooth cadence loop for Blink Comparator
  useEffect(() => {
    if (mode !== 'blink' || !blinkPlaying) return
    const intervalMs = blinkSpeed === 'fast' ? 450 : 850
    const timer = window.setInterval(() => {
      setBlinkEpoch((curr) => (curr === 'A' ? 'B' : 'A'))
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [mode, blinkPlaying, blinkSpeed])

  // Wiper slider pointer drag handler
  const updateSliderPos = useCallback((clientX: number) => {
    if (!sliderContainerRef.current) return
    const rect = sliderContainerRef.current.getBoundingClientRect()
    const rawPos = ((clientX - rect.left) / rect.width) * 100
    const clamped = Math.max(0, Math.min(100, Math.round(rawPos * 10) / 10))
    setSliderPos(clamped)
  }, [])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true)
    updateSliderPos(e.clientX)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    updateSliderPos(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore capture release error
      }
    }
  }

  const renderImage = (obs: SpherexObservation, key: 't1' | 't2') => {
    if (imgError[key]) {
      return (
        <div className="fe-image-placeholder" role="img" aria-label={`Citra ${key.toUpperCase()}`}>
          <div className="fe-placeholder-icon">✦</div>
          <div className="fe-placeholder-title">Citra Observasi {key.toUpperCase()}</div>
          <div className="fe-placeholder-desc">{object?.name || targetId} · {obs.observation_id}</div>
          <span className="fe-placeholder-badge">{obs.effective_wavelength_at_target || 'Wavelength unavailable'}</span>
        </div>
      )
    }

    return (
      <img
        src={obs.preview_url}
        alt={`Observasi ${key.toUpperCase()}: ${obs.observation_id}`}
        onError={() => setImgError((previous) => ({ ...previous, [key]: true }))}
        draggable={false}
      />
    )
  }

  // Ask AI inquiry handler
  const handleAskAi = async (customQuestion?: string) => {
    const question = (customQuestion || aiPrompt).trim()
    if (!question) return
    setLastQuestion(question)
    setAiLoading(true)
    setAiError(null)
    setAiFullText(null)
    setAiDisplayedText('')

    try {
      const res = await requestGuideReply({
        objectId: object?.id || targetId,
        objectName: object?.name || targetId,
        question,
        lang: 'en',
      })
      if (!res.ok) {
        setAiError(res.error)
      } else if (res.text) {
        setAiFullText(res.text)
      } else {
        setAiError('The Agent returned an empty response.')
      }
    } catch (error: unknown) {
      setAiError(error instanceof Error ? error.message : String(error))
    } finally {
      setAiLoading(false)
    }
  }

  // Copy AI response to clipboard
  const handleCopyAi = () => {
    const textToCopy = aiFullText || aiDisplayedText
    if (!textToCopy) return
    void navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Navigation handlers with wormhole
  const handleNav3DExplorer = (e: React.MouseEvent<HTMLButtonElement>) => {
    const origin = originOf(e.currentTarget)
    void runWormhole({ origin, minMs: 380 }, () =>
      navigate('/explorer')
    )
  }

  const enterXR = (event?: React.MouseEvent<HTMLButtonElement>) => {
    if (!pair) return
    const origin = originOf(event?.currentTarget ?? null)
    useXRApp.getState().setObservationData(pair[0], pair[1])
    void runWormhole({ origin, waitForScene: false, minMs: 580 }, () =>
      navigate('/explorer')
    )
  }

  return (
    <div className="fe-app">
      {/* Floating stardust particle field matching Gateway and Sky Explorer */}
      <ParticleField count={140} />
      <div className="fe-particle-bottom-stream" aria-hidden="true">
        <ParticleField count={70} variant="bottom" />
      </div>
      <TopBar />

      <main className="fe-compare">
        {/* ── HEADER: Clean Title & Action Buttons ── */}
        <header className="fe-compare-top">
          <div className="fe-compare-hero-block">
            <div className="fe-eyebrow">
              <span>Multi-epoch comparison · SPHEREx infrared archive</span>
            </div>
            <h1 className="fe-compare-hero-title">
              {object?.name || (loading ? 'Loading target…' : 'Choose a catalog target')}
            </h1>
            <div className="fe-compare-meta-pill">
              <span>RA {formatCoordinate(object?.ra, object?.ra_hms)}</span>
              <span className="fe-coord-dot">·</span>
              <span>DEC {formatCoordinate(object?.dec, object?.dec_dms)}</span>
              {object?.constellation && (
                <>
                  <span className="fe-coord-dot">·</span>
                  <span>{object.constellation}</span>
                </>
              )}
              {object?.distance && (
                <>
                  <span className="fe-coord-dot">·</span>
                  <span>{object.distance}</span>
                </>
              )}
            </div>
            <label className="fe-compare-target-picker">
              <span>Comparison target</span>
              <select
                className="fe-obs-select"
                value={targetId}
                onChange={(event) => handleTargetChange(event.currentTarget.value)}
                aria-label="Choose a catalog target for comparison"
              >
                {!comparisonTargets.some((entry) => entry.id === targetId) && (
                  <option value={targetId} disabled>
                    {object?.name || targetId} — archive coordinates unavailable
                  </option>
                )}
                {comparisonTargets.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} · {entry.type}
                  </option>
                ))}
              </select>
              {object?.coordinate_provenance === 'project_search_position' && (
                <small>Using a nominal search position, not a physical centroid.</small>
              )}
            </label>
          </div>

          <div className="fe-compare-nav">
            <button
              type="button"
              className="fe-btn-text fe-btn-with-gold"
              onClick={handleNav3DExplorer}
            >
              <span>← 3D Explorer</span>
            </button>
            <button
              type="button"
              className="fe-btn-gold"
              onClick={enterXR}
              disabled={!pair}
            >
              <span>Enter 3D Table (XR)</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </header>

        {/* Loading Indicator */}
        {loading && (
          <div className="fe-data-message" role="status">
            <WormholePulse decorative /> Searching the catalog and SPHEREx archive…
          </div>
        )}
        {!loading && dataError && (
          <div className="fe-data-message fe-data-message-error" role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
            <span>{dataError}</span>
            <button
              type="button"
              className="fe-pill-button"
              style={{
                cursor: 'pointer',
                background: 'rgba(79, 227, 214, 0.15)',
                border: '1px solid rgba(79, 227, 214, 0.4)',
                color: '#4fe3d6',
                padding: '0.5rem 1.25rem',
                borderRadius: '999px',
                fontWeight: 600,
                fontSize: '0.875rem',
                transition: 'all 0.2s ease',
              }}
              onClick={() => setRetryCount((prev) => prev + 1)}
            >
              🔄 Coba Lagi
            </button>
          </div>
        )}

        {/* ── MAIN DASHBOARD: 2 Balanced Columns Matching Sky Explorer ── */}
        {pair && (
        <div className="fe-compare-dashboard">
          {/* ── LEFT COLUMN: Interactive Viewport Instrument & Astrometry Profile ── */}
          <div className="fe-instrument-column">
            {/* The Visual Comparison Instrument */}
            <section className="fe-hud-card fe-instrument-card">
              <div className="fe-compare-controls">
                <div className="fe-tabs" role="tablist" aria-label="Mode perbandingan observasi">
                  <button
                    type="button"
                    className={`fe-tab ${mode === 'wipe' ? 'active' : ''}`}
                    onClick={() => setMode('wipe')}
                  >
                    ↔ Slider Pembanding
                  </button>
                  <button
                    type="button"
                    className={`fe-tab ${mode === 'blink' ? 'active' : ''}`}
                    onClick={() => setMode('blink')}
                  >
                    ✦ Kedipan (Blink)
                  </button>
                  <button
                    type="button"
                    className={`fe-tab ${mode === 'side' ? 'active' : ''}`}
                    onClick={() => setMode('side')}
                  >
                    ◫ Berdampingan
                  </button>
                </div>

                <span className="fe-tag fe-tag-gold">
                  IRSA · {pair[0].detector || 'SAME DETECTOR'}
                </span>
              </div>

              {/* Viewport Stages */}
              <div className="fe-comparison-view-container">
                {/* 1. SLIDER / WIPER MODE */}
                {mode === 'wipe' && (
                  <div
                    ref={sliderContainerRef}
                    className="fe-wipe-container fe-slider-interactive"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    style={{ '--wipe-pos': `${sliderPos}%` } as React.CSSProperties}
                  >
                    {/* Layer B (T2 - QR3) */}
                    <div className="fe-wipe-layer">
                      {renderImage(pair[1], 't2')}
                    </div>

                    {/* Layer A (T1 - DR1 - Clipped by slider position) */}
                    <div
                      className="fe-wipe-layer top"
                      style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
                    >
                      {renderImage(pair[0], 't1')}
                    </div>

                    {/* Badges */}
                    <span className="fe-image-badge left">
                      <span className="fe-badge-full">T1 · {formatEpochDate(pair[0].observed_at_utc)} · {pair[0].effective_wavelength_at_target || 'Wavelength unavailable'}</span>
                      <span className="fe-badge-short">T1 · {pair[0].effective_wavelength_at_target || 'Wavelength unavailable'}</span>
                    </span>
                    <span className="fe-image-badge right">
                      <span className="fe-badge-full">T2 · {formatEpochDate(pair[1].observed_at_utc)} · {pair[1].effective_wavelength_at_target || 'Wavelength unavailable'}</span>
                      <span className="fe-badge-short">T2 · {pair[1].effective_wavelength_at_target || 'Wavelength unavailable'}</span>
                    </span>

                    {/* Wiper Handle (Gold Ring + Chevrons) */}
                    <div
                      className="fe-wipe-handle"
                      style={{ left: `${sliderPos}%` }}
                      aria-hidden="true"
                    >
                      <div className="fe-wipe-line" />
                      <div className="fe-wipe-circle">
                        <span>◀</span>
                        <span>❚</span>
                        <span>▶</span>
                      </div>
                    </div>

                    {/* Ratio Pill */}
                    <div className="fe-wipe-pill" aria-hidden="true">
                      T1: {Math.round(sliderPos)}% &nbsp;│&nbsp; T2: {Math.round(100 - sliderPos)}%
                    </div>
                  </div>
                )}

                {/* 2. BLINK COMPARATOR MODE */}
                {mode === 'blink' && (
                  <div className="fe-compare-single fe-blink-stage">
                    <span className={`fe-image-badge ${blinkEpoch === 'A' ? 'left' : 'right'}`}>
                      <span className="fe-badge-full">
                        {blinkEpoch === 'A'
                          ? `T1 · ${pair[0].release || 'Release unavailable'} · ${pair[0].effective_wavelength_at_target || 'Wavelength unavailable'}`
                          : `T2 · ${pair[1].release || 'Release unavailable'} · ${pair[1].effective_wavelength_at_target || 'Wavelength unavailable'}`}
                      </span>
                      <span className="fe-badge-short">
                        {blinkEpoch === 'A'
                          ? `T1 · ${pair[0].effective_wavelength_at_target || 'Wavelength unavailable'}`
                          : `T2 · ${pair[1].effective_wavelength_at_target || 'Wavelength unavailable'}`}
                      </span>
                    </span>

                    <div className="fe-blink-image-wrap">
                      <div
                        className="fe-blink-layer"
                        style={{
                          opacity: blinkEpoch === 'A' ? 1 : 0,
                          transition: 'opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        {renderImage(pair[0], 't1')}
                      </div>
                      <div
                        className="fe-blink-layer"
                        style={{
                          opacity: blinkEpoch === 'B' ? 1 : 0,
                          transition: 'opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        {renderImage(pair[1], 't2')}
                      </div>
                    </div>

                    {/* Blink Floating Dock */}
                    <div className="fe-blink-dock">
                      <button
                        type="button"
                        className="fe-btn-dock"
                        onClick={() => setBlinkPlaying((v) => !v)}
                      >
                        {blinkPlaying ? '⏸ Jeda' : '▶ Putar'}
                      </button>
                      <button
                        type="button"
                        className="fe-btn-dock"
                        onClick={() => setBlinkSpeed((s) => (s === 'fast' ? 'normal' : 'fast'))}
                      >
                        {blinkSpeed === 'fast' ? '⚡ Cepat (450ms)' : '🐢 Cadence (850ms)'}
                      </button>
                      <button
                        type="button"
                        className="fe-btn-dock"
                        onClick={() => {
                          setBlinkPlaying(false)
                          setBlinkEpoch((e) => (e === 'A' ? 'B' : 'A'))
                        }}
                      >
                        Kedipkan ({blinkEpoch === 'A' ? 'T1 ➔ T2' : 'T2 ➔ T1'})
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. SIDE BY SIDE MODE */}
                {mode === 'side' && (
                  <div className="fe-compare-sides">
                    <div className="fe-comparison-pane">
                      <span className="fe-image-badge left">
                        <span className="fe-badge-full">T1 · {formatEpochDate(pair[0].observed_at_utc)} · {pair[0].effective_wavelength_at_target || 'Wavelength unavailable'}</span>
                        <span className="fe-badge-short">T1 · {pair[0].effective_wavelength_at_target || 'Wavelength unavailable'}</span>
                      </span>
                      {renderImage(pair[0], 't1')}
                    </div>
                    <div className="fe-comparison-pane">
                      <span className="fe-image-badge right">
                        <span className="fe-badge-full">T2 · {formatEpochDate(pair[1].observed_at_utc)} · {pair[1].effective_wavelength_at_target || 'Wavelength unavailable'}</span>
                        <span className="fe-badge-short">T2 · {pair[1].effective_wavelength_at_target || 'Wavelength unavailable'}</span>
                      </span>
                      {renderImage(pair[1], 't2')}
                    </div>
                  </div>
                )}
              </div>

              {/* Intuitive Wiper Usage Hint */}
              <div className="fe-compare-hint">
                DRAG THE SLIDER TO COMPARE T1 AND T2 IMAGES · SELECT BLINK FOR AUTOMATIC SWITCHING
              </div>
            </section>

            {/* Target Astrometry Card */}
            <section className="fe-hud-card fe-target-astrometry-card">
              <div className="fe-card-head">
                <span className="fe-tag fe-tag-gold">CATALOG TARGET</span>
                <span className="fe-card-date">{object?.distance || 'Distance unavailable'}</span>
              </div>
              <h3 className="fe-card-title">{object?.name || targetId}</h3>
              <p className="fe-card-desc">
                {object?.description || 'Description unavailable in the object catalog.'}
              </p>

              <div className="fe-data-grid">
                <div className="fe-datum">
                  <span>Object ID</span>
                  <strong>{object?.id || targetId}</strong>
                </div>
                <div className="fe-datum">
                  <span>Classification</span>
                  <strong>{object?.type || 'Unavailable'}</strong>
                </div>
                <div className="fe-datum">
                  <span>Right Ascension</span>
                  <strong>RA {formatCoordinate(object?.ra, object?.ra_hms)}</strong>
                </div>
                <div className="fe-datum">
                  <span>Declination</span>
                  <strong>DEC {formatCoordinate(object?.dec, object?.dec_dms)}</strong>
                </div>
                <div className="fe-datum">
                  <span>Shared detector</span>
                  <strong>{pair[0].detector || 'Unavailable'}</strong>
                </div>
                <div className="fe-datum">
                  <span>Catalog Source</span>
                  <strong>{object?.source || 'Unavailable'}</strong>
                </div>
              </div>
            </section>
          </div>

          {/* ── RIGHT COLUMN: 2 Epoch Telemetry Cards & Cosmic AI Guide ── */}
          <div className="fe-telemetry-column">
            {/* Epoch T1 Observation Card */}
            <article className="fe-epoch-card fe-epoch-card-t1 fe-hud-card">
              <div className="fe-card-head">
                <span className="fe-tag fe-tag-cyan">OBSERVATION T1 ({pair[0].release || 'RELEASE UNKNOWN'})</span>
                <span className="fe-card-date">{formatUtc(pair[0].observed_at_utc)}</span>
              </div>
              <h3 className="fe-card-title">{pair[0].observation_id}</h3>

              <div className="fe-data-grid">
                <div className="fe-datum">
                  <span>Panjang Gelombang (λ)</span>
                  <strong style={{ color: '#4fe3d6' }}>{pair[0].effective_wavelength_at_target || 'Unavailable'}</strong>
                </div>
                <div className="fe-datum">
                  <span>Bandwidth</span>
                  <strong>{pair[0].bandwidth_at_target || 'Unavailable'}</strong>
                </div>
                <div className="fe-datum">
                  <span>Detektor</span>
                  <strong>{pair[0].detector || 'Unavailable'}</strong>
                </div>
                <div className="fe-datum">
                  <span>Quality Flag</span>
                  <strong>{pair[0].quality_flag_meaning || pair[0].quality_flag?.toString() || 'Unavailable'}</strong>
                </div>
              </div>

              <div className="fe-epoch-downloads">
                <a
                  href={pair[0].fits_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fe-btn-gold"
                >
                  <span>↓ Unduh FITS (Level 2)</span>
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </article>

            {/* Epoch T2 Observation Card */}
            <article className="fe-epoch-card fe-epoch-card-t2 fe-hud-card">
              <div className="fe-card-head">
                <span className="fe-tag fe-tag-blue">OBSERVATION T2 ({pair[1].release || 'RELEASE UNKNOWN'})</span>
                <span className="fe-card-date">{formatUtc(pair[1].observed_at_utc)}</span>
              </div>
              <h3 className="fe-card-title">{pair[1].observation_id}</h3>

              <div className="fe-data-grid">
                <div className="fe-datum">
                  <span>Panjang Gelombang (λ)</span>
                  <strong style={{ color: '#38bdf8' }}>{pair[1].effective_wavelength_at_target || 'Unavailable'}</strong>
                </div>
                <div className="fe-datum">
                  <span>Bandwidth</span>
                  <strong>{pair[1].bandwidth_at_target || 'Unavailable'}</strong>
                </div>
                <div className="fe-datum">
                  <span>Detektor</span>
                  <strong>{pair[1].detector || 'Unavailable'}</strong>
                </div>
                <div className="fe-datum">
                  <span>Quality Flag</span>
                  <strong>{pair[1].quality_flag_meaning || pair[1].quality_flag?.toString() || 'Unavailable'}</strong>
                </div>
              </div>

              <div className="fe-epoch-downloads">
                <a
                  href={pair[1].fits_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fe-btn-gold"
                >
                  <span>↓ Unduh FITS (Level 2)</span>
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </article>

            {/* Cosmic Guide AI Assistant Card */}
            <article className="fe-hud-card fe-ai-assistant-card">
              <div className="fe-card-head">
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#f4e8c6', fontFamily: 'var(--sans)', fontSize: '0.9rem' }}>
                  ✦ Cosmic Guide AI Assistant
                </span>
                <span className="fe-tag fe-tag-gold">LIVE GEMINI</span>
              </div>

              {/* Quick Inquiry Chips */}
              <div className="fe-ai-chips">
                <button
                  type="button"
                  className="fe-ai-chip"
                  onClick={() =>
                    void handleAskAi(`Apa yang berbeda antara epoch T1 dan T2 untuk ${object?.name || targetId}?`)
                  }
                >
                  Beda T1 vs T2?
                </button>
                <button
                  type="button"
                  className="fe-ai-chip"
                  onClick={() =>
                    void handleAskAi(`Bagaimana perbedaan panjang gelombang memengaruhi perbandingan ${object?.name || targetId}?`)
                  }
                >
                  Konteks panjang gelombang
                </button>
                <button
                  type="button"
                  className="fe-ai-chip"
                  onClick={() =>
                    void handleAskAi(`Apa yang diketahui dari katalog tentang ${object?.name || targetId}?`)
                  }
                >
                  Tentang target
                </button>
              </div>

              {/* Input Wrap */}
              <div className="fe-ai-input-wrap">
                <input
                  type="text"
                  className="fe-ai-input"
                  placeholder="Ask about spectral variability or astrophysics..."
                  value={aiPrompt}
                  maxLength={500}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleAskAi(aiPrompt)
                  }}
                />
                <button
                  type="button"
                  className="fe-btn-gold"
                  style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}
                  disabled={aiLoading || !aiPrompt.trim()}
                  onClick={() => void handleAskAi(aiPrompt)}
                >
                  {aiLoading ? 'Answering…' : 'Send ↗'}
                </button>
              </div>

              {aiError && <p className="fe-inline-error" role="alert">{aiError}</p>}

              {/* Response Box with Typewriter & Markdown */}
              {aiDisplayedText && !aiLoading && (
                <div className="fe-ai-reply-box">
                  <div className="fe-ai-reply-head">
                    <span className="fe-ai-badge">✦ Sintesis Astrofisika</span>
                    <div className="fe-ai-reply-actions">
                      <button
                        type="button"
                        className="fe-ai-btn-copy"
                        onClick={handleCopyAi}
                        title="Salin analisis ke clipboard"
                      >
                        {copied ? 'Tersalin ✓' : '📋 Salin'}
                      </button>
                      {isTyping && (
                        <button
                          type="button"
                          className="fe-ai-btn-copy"
                          onClick={() => {
                            if (aiFullText) setAiDisplayedText(aiFullText)
                            setIsTyping(false)
                          }}
                        >
                          Lewati ⏭
                        </button>
                      )}
                      <button
                        type="button"
                        className="fe-ai-btn-copy"
                        onClick={() => {
                          setAiFullText(null)
                          setAiDisplayedText('')
                          setLastQuestion(null)
                          setAiError(null)
                        }}
                        title="Tutup"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="fe-ai-reply-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {aiDisplayedText}
                    </ReactMarkdown>
                    {isTyping && <span className="fe-typewriter-cursor">|</span>}
                  </div>
                </div>
              )}
            </article>
          </div>
        </div>
        )}

        {/* ── SCIENTIFIC INTEGRITY DISCLOSURES (Compact, Muted Bottom Card) ── */}
        <section className="fe-scientific-notes fe-hud-card">
          <div className="fe-sci-head">
            <span style={{ color: '#e5c07b' }}>⚖</span>
            <strong className="fe-sci-title">Scientific Integrity Disclosures</strong>
          </div>
          <div className="fe-sci-text">
            <p>
              <strong>Photometric Notice</strong>: Visual preview only; not calibrated for
              quantitative photometry. Validated astrophysical variability or proper motion requires
              PSF aperture photometry on unresampled Level 2 images.
            </p>
            <p>
              <strong>Epoch pairing</strong>: When available, the displayed pair uses the same
              detector and the earliest/latest valid UTC timestamps returned for the selected target.
              Wavelengths can differ; check each epoch’s metadata before interpreting visual changes.
            </p>
            <p>
              <strong>Quality flags</strong>: Values shown come from each archive record. A visual
              comparison is not registered, normalized, or calibrated for quantitative photometry.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
