import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  fetchObjectInfo,
  requestGuideReply,
  toApiUrl,
  type ObjectInfo,
  type SpherexObservation,
} from '../api'
import { TopBar } from './TopBar'
import { ParticleField } from './ParticleField'
import { WormholePulse } from './WormholeOverlay'
import { originOf, runWormhole } from '../wormhole'
import { cacheObservations, useXRApp } from '../../xr/store'

type CompareMode = 'wipe' | 'blink' | 'side'

// Verified default SPHEREx multi-epoch observation pair for RCW 36
const DEFAULT_OBS_T1: SpherexObservation = {
  observation_id: '2025W22_2B_0536_1',
  release: 'SPHEREx DR1',
  collection: 'all',
  processing_version: 'l2b-v27-2026-200',
  calib_level: 2,
  detector: 'SPHEREx-D4',
  observed_at_utc: '2025-05-28T14:12:08Z',
  effective_wavelength_at_target: '2.4489 µm',
  bandwidth_at_target: '0.0602 µm',
  visualization_wavelength: '2.4474 µm',
  visualization_bandwidth: '0.0611 µm',
  spectral_calibration_source: 'Known RCW36 WCS-WAVE / CWAVE',
  quality_flag: 2097152,
  quality_flag_meaning: 'Bit 21 (SOURCE detected), defects 0-20 clear',
  provenance_badge: 'CATALOG',
  preview_url: toApiUrl('/api/image/t1'),
  fits_url:
    'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W22_2B/l2b-v27-2026-200/4/level2_2025W22_2B_0536_1D4_spx_l2b-v27-2026-200.fits',
}

const DEFAULT_OBS_T2: SpherexObservation = {
  observation_id: '2026W23_2A_0030_2',
  release: 'SPHEREx QR3',
  collection: 'all',
  processing_version: 'l2b-v27-2026-200',
  calib_level: 2,
  detector: 'SPHEREx-D4',
  observed_at_utc: '2026-06-04T09:30:45Z',
  effective_wavelength_at_target: '2.4679 µm',
  bandwidth_at_target: '0.0691 µm',
  visualization_wavelength: '2.4679 µm',
  visualization_bandwidth: '0.0710 µm',
  spectral_calibration_source: 'Known RCW36 WCS-WAVE / CWAVE',
  quality_flag: 2097152,
  quality_flag_meaning: 'Bit 21 (SOURCE detected), defects 0-20 clear',
  provenance_badge: 'CATALOG',
  preview_url: toApiUrl('/api/image/t2'),
  fits_url:
    'https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/level2/2026W23_2A/l2b-v27-2026-200/4/level2_2026W23_2A_0030_2D4_spx_l2b-v27-2026-200.fits',
}

function formatUtc(value: string | null | undefined) {
  return value ? value.replace('T', ' ').replace(/Z$/, ' UTC') : 'Timestamp unavailable'
}

export function ObservationComparisonScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lang = useXRApp((s) => s.settings.lang)
  const targetId = searchParams.get('target') || 'rcw-36'

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
  const [object, setObject] = useState<ObjectInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [pair] = useState<readonly [SpherexObservation, SpherexObservation]>([
    DEFAULT_OBS_T1,
    DEFAULT_OBS_T2,
  ])

  // Fallback states for images
  const [imgFallback, setImgFallback] = useState<{ t1: boolean; t2: boolean }>({
    t1: false,
    t2: false,
  })
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

  // Fetch catalog object metadata
  useEffect(() => {
    let active = true
    setLoading(true)

    fetchObjectInfo(targetId)
      .then((res) => {
        if (!active) return
        setLoading(false)
        if (res.ok) {
          setObject(res.data)
        }
      })
      .catch(() => {
        if (!active) return
        setLoading(false)
      })

    cacheObservations([DEFAULT_OBS_T1, DEFAULT_OBS_T2])

    return () => {
      active = false
    }
  }, [targetId])

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

  // Fallback image rendering
  const handleImageError = (key: 't1' | 't2') => {
    if (!imgFallback[key]) {
      setImgFallback((prev) => ({ ...prev, [key]: true }))
    } else {
      setImgError((prev) => ({ ...prev, [key]: true }))
    }
  }

  const renderImage = (obs: SpherexObservation, key: 't1' | 't2') => {
    if (imgError[key]) {
      return (
        <div className="fe-image-placeholder" role="img" aria-label={`Citra ${key.toUpperCase()}`}>
          <div className="fe-placeholder-icon">✦</div>
          <div className="fe-placeholder-title">Citra Observasi {key.toUpperCase()}</div>
          <div className="fe-placeholder-desc">RCW 36 Emission Nebula · {obs.observation_id}</div>
          <span className="fe-placeholder-badge">{obs.effective_wavelength_at_target || '2.45 µm'}</span>
        </div>
      )
    }

    const src = imgFallback[key]
      ? key === 't1'
        ? '/spherex/blink-a.png'
        : '/spherex/blink-b.png'
      : obs.preview_url

    return (
      <img
        src={src}
        alt={`Observasi ${key.toUpperCase()}: ${obs.observation_id}`}
        onError={() => handleImageError(key)}
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
        objectId: targetId,
        objectName: object?.name || targetId,
        question,
        lang: lang === 'id' ? 'id' : 'en',
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
  const handleNavSky = (e: React.MouseEvent<HTMLButtonElement>) => {
    const origin = originOf(e.currentTarget)
    void runWormhole({ origin, minMs: 380 }, () =>
      navigate(`/explorer?target=${encodeURIComponent(targetId)}`)
    )
  }

  const enterXR = (event?: React.MouseEvent<HTMLButtonElement>) => {
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
              <span className="fe-pulse-dot" aria-hidden="true" />
              <span>Multi-epoch comparison · SPHEREx infrared archive</span>
            </div>
            <h1 className="fe-compare-hero-title">
              {object?.name || (loading ? 'Loading target…' : 'RCW 36 Emission Nebula')}
            </h1>
            <div className="fe-compare-meta-pill">
              <span>RA {object?.ra_hms || '08h 59m 29s'}</span>
              <span className="fe-coord-dot">·</span>
              <span>DEC {object?.dec_dms || '-43°45′12″'}</span>
              <span className="fe-coord-dot">·</span>
              <span>Cloud C Vela Molecular Ridge</span>
              <span className="fe-coord-dot">·</span>
              <span>Jarak ~700 pc (2.300 tc)</span>
            </div>
          </div>

          <div className="fe-compare-nav">
            <button
              type="button"
              className="fe-btn-text fe-btn-with-gold"
              onClick={handleNavSky}
            >
              <span>← Sky Explorer</span>
            </button>
            <button
              type="button"
              className="fe-btn-gold"
              onClick={enterXR}
            >
              <span>Enter 3D Table (XR)</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </header>

        {/* Loading Indicator */}
        {loading && (
          <div className="fe-data-message" role="status">
            <WormholePulse decorative /> Memuat data target observasi RCW 36…
          </div>
        )}

        {/* ── MAIN DASHBOARD: 2 Balanced Columns Matching Sky Explorer ── */}
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
                  ● LIVE ARCHIVE · 75.8% OVERLAP
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
                      <span className="fe-badge-full">● T1 · 28 Mei 2025 · {pair[0].effective_wavelength_at_target}</span>
                      <span className="fe-badge-short">● T1 · {pair[0].effective_wavelength_at_target}</span>
                    </span>
                    <span className="fe-image-badge right">
                      <span className="fe-badge-full">● T2 · 04 Jun 2026 · {pair[1].effective_wavelength_at_target}</span>
                      <span className="fe-badge-short">● T2 · {pair[1].effective_wavelength_at_target}</span>
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
                      <span className="fe-badge-full">{blinkEpoch === 'A' ? '● Observasi T1 (DR1) · 2.45 µm' : '● Observasi T2 (QR3) · 2.47 µm'}</span>
                      <span className="fe-badge-short">{blinkEpoch === 'A' ? '● T1 · 2.45 µm' : '● T2 · 2.47 µm'}</span>
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
                        <span className="fe-badge-full">● T1 · 28 Mei 2025 · {pair[0].effective_wavelength_at_target}</span>
                        <span className="fe-badge-short">● T1 · {pair[0].effective_wavelength_at_target}</span>
                      </span>
                      {renderImage(pair[0], 't1')}
                    </div>
                    <div className="fe-comparison-pane">
                      <span className="fe-image-badge right">
                        <span className="fe-badge-full">● T2 · 04 Jun 2026 · {pair[1].effective_wavelength_at_target}</span>
                        <span className="fe-badge-short">● T2 · {pair[1].effective_wavelength_at_target}</span>
                      </span>
                      {renderImage(pair[1], 't2')}
                    </div>
                  </div>
                )}
              </div>

              {/* Intuitive Wiper Usage Hint */}
              <div className="fe-compare-hint">
                GESER SLIDER UNTUK MEMBANDINGKAN CITRA T1 DAN T2 · TEKAN BLINK UNTUK KEDIPAN OTOMATIS
              </div>
            </section>

            {/* Target Astrometry Card */}
            <section className="fe-hud-card">
              <div className="fe-card-head">
                <span className="fe-tag fe-tag-gold">● CATALOG TARGET</span>
                <span className="fe-card-date">~700 pc (2.300 tc)</span>
              </div>
              <h3 className="fe-card-title">{object?.name || 'RCW 36 Emission Nebula'}</h3>
              <p className="fe-card-desc">
                {object?.description ||
                  'Nebula emisi H II kompak di Cloud C Vela Molecular Ridge. Terionisasi oleh bintang masif tipe O/B yang tertanam dan diamati SPHEREx pada 96 saluran inframerah.'}
              </p>

              <div className="fe-data-grid">
                <div className="fe-datum">
                  <span>Object ID</span>
                  <strong>rcw-36</strong>
                </div>
                <div className="fe-datum">
                  <span>Klasifikasi</span>
                  <strong>{object?.type || 'Nebula Emisi H II'}</strong>
                </div>
                <div className="fe-datum">
                  <span>Right Ascension</span>
                  <strong>RA {object?.ra_hms || '08h 59m 29s'}</strong>
                </div>
                <div className="fe-datum">
                  <span>Declination</span>
                  <strong>DEC {object?.dec_dms || '-43°45′12″'}</strong>
                </div>
                <div className="fe-datum">
                  <span>Bandpass Overlap</span>
                  <strong>75.8% (CWAVE/CBAND)</strong>
                </div>
                <div className="fe-datum">
                  <span>Sumber Katalog</span>
                  <strong>{object?.source || 'IPAC IRSA / SIMBAD'}</strong>
                </div>
              </div>
            </section>
          </div>

          {/* ── RIGHT COLUMN: 2 Epoch Telemetry Cards & Cosmic AI Guide ── */}
          <div className="fe-telemetry-column">
            {/* Epoch T1 Observation Card */}
            <article className="fe-epoch-card fe-hud-card">
              <div className="fe-card-head">
                <span className="fe-tag fe-tag-cyan">● OBSERVASI T1 (DR1)</span>
                <span className="fe-card-date">{formatUtc(pair[0].observed_at_utc)}</span>
              </div>
              <h3 className="fe-card-title">{pair[0].observation_id}</h3>

              <div className="fe-data-grid">
                <div className="fe-datum">
                  <span>Panjang Gelombang (λ)</span>
                  <strong style={{ color: '#4fe3d6' }}>{pair[0].effective_wavelength_at_target}</strong>
                </div>
                <div className="fe-datum">
                  <span>Bandwidth</span>
                  <strong>{pair[0].bandwidth_at_target}</strong>
                </div>
                <div className="fe-datum">
                  <span>Detektor</span>
                  <strong>{pair[0].detector}</strong>
                </div>
                <div className="fe-datum">
                  <span>Quality Flag</span>
                  <strong style={{ color: '#86efac' }}>Bit 21 (SOURCE Detected)</strong>
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
            <article className="fe-epoch-card fe-hud-card">
              <div className="fe-card-head">
                <span className="fe-tag fe-tag-blue">● OBSERVASI T2 (QR3)</span>
                <span className="fe-card-date">{formatUtc(pair[1].observed_at_utc)}</span>
              </div>
              <h3 className="fe-card-title">{pair[1].observation_id}</h3>

              <div className="fe-data-grid">
                <div className="fe-datum">
                  <span>Panjang Gelombang (λ)</span>
                  <strong style={{ color: '#38bdf8' }}>{pair[1].effective_wavelength_at_target}</strong>
                </div>
                <div className="fe-datum">
                  <span>Bandwidth</span>
                  <strong>{pair[1].bandwidth_at_target}</strong>
                </div>
                <div className="fe-datum">
                  <span>Detektor</span>
                  <strong>{pair[1].detector}</strong>
                </div>
                <div className="fe-datum">
                  <span>Quality Flag</span>
                  <strong style={{ color: '#86efac' }}>Bit 21 (SOURCE Detected)</strong>
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
                <span className="fe-tag fe-tag-gold">● LIVE GEMINI</span>
              </div>

              {/* Quick Inquiry Chips */}
              <div className="fe-ai-chips">
                <button
                  type="button"
                  className="fe-ai-chip"
                  onClick={() =>
                    void handleAskAi('Apa perbedaan observasi inframerah T1 vs T2 pada RCW 36?')
                  }
                >
                  Beda T1 vs T2?
                </button>
                <button
                  type="button"
                  className="fe-ai-chip"
                  onClick={() =>
                    void handleAskAi('Mengapa terjadi pergeseran filter antara 2.45 µm dan 2.47 µm?')
                  }
                >
                  Pergeseran Filter?
                </button>
                <button
                  type="button"
                  className="fe-ai-chip"
                  onClick={() =>
                    void handleAskAi('Jelaskan peran protobintang di nebula RCW 36.')
                  }
                >
                  Protobintang RCW 36?
                </button>
              </div>

              {/* Input Wrap */}
              <div className="fe-ai-input-wrap">
                <input
                  type="text"
                  className="fe-ai-input"
                  placeholder="Tanyakan variabilitas spektral atau astrofisika..."
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
                  {aiLoading ? 'Menjawab…' : 'Kirim ↗'}
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

        {/* ── SCIENTIFIC INTEGRITY DISCLOSURES (Compact, Muted Bottom Card) ── */}
        <section className="fe-scientific-notes fe-hud-card">
          <div className="fe-sci-head">
            <span style={{ color: '#e5c07b' }}>⚖</span>
            <strong className="fe-sci-title">Scientific Integrity Disclosures</strong>
          </div>
          <div className="fe-sci-text">
            <p>
              • <strong>Photometric Notice</strong>: Visual preview only; not calibrated for
              quantitative photometry. Validated astrophysical variability or proper motion requires
              PSF aperture photometry on unresampled Level 2 images.
            </p>
            <p>
              • <strong>Bandpass Overlap</strong>: Geometric bandpass overlap is derived from
              authoritative CWAVE/CBAND parameters (75.8% narrower filter, 54.6% IoU). WCS-WAVE
              serves as visualization fallback (74.6% narrower filter, 52.6% IoU).
            </p>
            <p>
              • <strong>Quality Flag</strong>: Level 2 quality flag status applies to the sampled
              pixel only. Bit 21 (SOURCE) indicates detected source presence without asserting
              detector-wide flag absence.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
