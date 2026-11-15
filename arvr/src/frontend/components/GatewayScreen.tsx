import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchApod, type ApodData } from '../api'
import { TopBar } from './TopBar'
import { ParticleField } from './ParticleField'
import { SolarSystem3D } from './SolarSystem3D'
import { originOf, runWormhole } from '../wormhole'
import { useXRApp } from '../../xr/store'

type DeviceCaps = { ar: boolean; vr: boolean }

export function GatewayScreen() {
  const navigate = useNavigate()
  const lang = useXRApp((s) => s.settings.lang)
  const [caps, setCaps] = useState<DeviceCaps>({ ar: false, vr: false })
  const capabilitiesRef = useRef<HTMLDivElement | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [apodOpen, setApodOpen] = useState(false)
  const [apodLoading, setApodLoading] = useState(false)
  const [apod, setApod] = useState<ApodData | null>(null)
  const [apodError, setApodError] = useState<string | null>(null)

  useEffect(() => {
    if (!apodOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setApodOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [apodOpen])

  useEffect(() => {
    let active = true
    const xrNavigator = navigator as Navigator & {
      xr?: { isSessionSupported: (mode: 'immersive-vr' | 'immersive-ar') => Promise<boolean> }
    }

    if (!xrNavigator.xr) return
    Promise.all([
      xrNavigator.xr.isSessionSupported('immersive-ar'),
      xrNavigator.xr.isSessionSupported('immersive-vr'),
    ])
      .then(([ar, vr]) => {
        if (active) setCaps({ ar, vr })
      })
      .catch(() => {
        if (active) setCaps({ ar: false, vr: false })
      })

    return () => {
      active = false
    }
  }, [])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  const handleCapabilities = () => {
    capabilitiesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    capabilitiesRef.current?.focus({ preventScroll: true })
    notify('Desktop 3D is available. Immersive modes (WebXR VR/AR) activate automatically on supported headsets and mobile devices.')
  }

  const openApod = async () => {
    setApodOpen(true)
    setApodLoading(true)
    setApod(null)
    setApodError(null)
    try {
      const result = await fetchApod()
      setApodLoading(false)
      if (!result.ok) {
        setApodError('NASA APOD sedang tidak tersedia. Silakan coba lagi.')
        return
      }
      setApod(result.data)
    } catch {
      setApodLoading(false)
      setApodError('NASA APOD sedang tidak tersedia. Silakan coba lagi.')
    }
  }

  return (
    <div className="fe-app">
      <ParticleField />
      <TopBar />

      <main className="fe-screen fe-gateway" aria-label="Cosmic Gateway">
        <div className="fe-hero-copy">
          <svg className="fe-gw-curve" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="fe-gw-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4fe3d6" stopOpacity=".9" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity=".85" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity=".8" />
              </linearGradient>
              <linearGradient id="fe-gw-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity=".75" />
                <stop offset="45%" stopColor="#4fe3d6" stopOpacity=".8" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity=".7" />
              </linearGradient>
              <linearGradient id="fe-gw-grad-3" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity=".5" />
                <stop offset="60%" stopColor="#0ea5e9" stopOpacity=".6" />
                <stop offset="100%" stopColor="#4fe3d6" stopOpacity=".5" />
              </linearGradient>
            </defs>
            <path className="fe-gw-glow" d="M 0 220 C 200 140, 340 380, 560 260 S 820 180, 1000 320" />
            <path className="fe-gw-core fe-gw-flow-1" d="M 0 220 C 200 140, 340 380, 560 260 S 820 180, 1000 320" />
            <path className="fe-gw-secondary fe-gw-flow-2" d="M 0 380 C 160 460, 360 210, 620 340 S 860 440, 1000 220" />
            <path className="fe-gw-fine fe-gw-flow-1" d="M 0 160 C 220 280, 410 120, 680 230 S 900 360, 1000 180" />
          </svg>

          <div className="fe-eyebrow">NASA · Infrared sky survey</div>
          <h1>
            Journey through <span>96</span> infrared colors.
          </h1>
          <p className="fe-lead">
            Explore the changing infrared sky through SPHEREx observations. Navigate a celestial field, inspect targets,
            and compare distinct observation records.
          </p>

          <div className="fe-button-row">
            <button
              className="fe-btn-primary"
              onClick={(event) => {
                const origin = originOf(event.currentTarget)
                void runWormhole(
                  {
                    origin,
                    label: lang === 'id' ? 'Menuju Cosmic Expedition…' : 'Entering Cosmic Expedition…',
                    waitForScene: false,
                    minMs: 450,
                  },
                  () => navigate('/explorer')
                )
              }}
            >
              Enter expedition <span aria-hidden="true">↗</span>
            </button>
            <button className="fe-btn-text" onClick={handleCapabilities}>
              Explore capabilities
            </button>
            <button className="fe-btn-text" onClick={openApod} title="Astronomy Picture of the Day from NASA">
              NASA APOD Highlight ✦
            </button>
          </div>
        </div>

        <div className="fe-sky-art" aria-label="Illustrative 3D solar system with 8 planets orbiting a glowing sun">
          <SolarSystem3D />
        </div>

        <div className="fe-steps">
          <div className="fe-step">
            <em>01</em>
            <b>Navigate sky</b>
            <span>Find a region of interest</span>
          </div>
          <div className="fe-step">
            <em>02</em>
            <b>Select observation</b>
            <span>Inspect a catalog target</span>
          </div>
          <div className="fe-step">
            <em>03</em>
            <b>Compare records</b>
            <span>Review distinct observations</span>
          </div>
        </div>

        <div className="fe-capabilities" id="fe-gateway-capabilities" ref={capabilitiesRef} tabIndex={-1} aria-label="Explore in 3D, AR, or VR">
          <button
            type="button"
            className="fe-cap"
            onClick={(event) => {
              const origin = originOf(event.currentTarget)
              void runWormhole(
                {
                  origin,
                  label: lang === 'id' ? 'Membuka Solar System Hub…' : 'Opening the Solar System Hub…',
                  waitForScene: false,
                  minMs: 450,
                },
                () => navigate('/explorer')
              )
            }}
          >
            <b>Desktop 3D</b>
            <small>AVAILABLE · WEBGL</small>
            <span>Explore the interactive 3D sky in the browser.</span>
            <span className="fe-cap-action">Open 3D Explorer <span aria-hidden="true">↗</span></span>
          </button>
          <button
            type="button"
            className="fe-cap"
            onClick={(event) => {
              const origin = originOf(event.currentTarget)
              void runWormhole({ origin }, () => navigate('/xr?intent=ar'))
            }}
          >
            <b>WebXR AR</b>
            <small>{caps.ar ? 'SUPPORTED ON THIS DEVICE' : 'REQUIRES AR-CAPABLE DEVICE'}</small>
            <span>Place the tabletop observatory in your own room.</span>
            <span className="fe-cap-action">Explore AR <span aria-hidden="true">↗</span></span>
          </button>
          <button
            type="button"
            className="fe-cap"
            onClick={(event) => {
              const origin = originOf(event.currentTarget)
              void runWormhole({ origin }, () => navigate('/xr?intent=vr'))
            }}
          >
            <b>WebXR VR</b>
            <small>{caps.vr ? 'SUPPORTED ON THIS DEVICE' : 'REQUIRES VR HEADSET'}</small>
            <span>Enter the immersive six-degrees-of-freedom sky view.</span>
            <span className="fe-cap-action">Explore VR <span aria-hidden="true">↗</span></span>
          </button>
        </div>
      </main>

      {toast && (
        <div className="fe-toast" role="status">
          {toast}
        </div>
      )}

      {apodOpen && (
        <div
          className="fe-apod-backdrop"
          onClick={() => setApodOpen(false)}
          role="presentation"
        >
          <section
            className="fe-apod-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fe-apod-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="fe-modal-close"
              onClick={() => setApodOpen(false)}
              aria-label={lang === 'id' ? 'Tutup dialog APOD' : 'Close APOD dialog'}
            >
              ×
            </button>
            <div className="fe-eyebrow">NASA · Astronomy Picture of the Day</div>
            <h2 id="fe-apod-title">
              {apodLoading
                ? (lang === 'id' ? 'Memuat NASA APOD…' : 'Loading NASA APOD…')
                : apod?.title || 'NASA APOD Highlight'}
            </h2>

            {apodLoading && (
              <div className="fe-apod-loading" role="status">
                <div className="fe-apod-spinner" aria-hidden="true" />
                <p>{lang === 'id' ? 'Mengambil sorotan terbaru dari NASA…' : 'Fetching the latest feature from NASA…'}</p>
              </div>
            )}

            {apodError && (
              <div className="fe-apod-error-box" role="alert">
                <div className="fe-apod-error-icon" aria-hidden="true">✦</div>
                <div className="fe-apod-error-body">
                  <p className="fe-apod-error-message">NASA APOD sedang tidak tersedia. Silakan coba lagi.</p>
                  <p className="fe-apod-error-hint">
                    {lang === 'id'
                      ? 'Layanan NASA sedang sibuk atau offline. Anda dapat mencoba kembali beberapa saat lagi.'
                      : 'NASA upstream service is temporarily busy or unreachable. You can try again in a moment.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="fe-btn-primary fe-apod-retry-btn"
                  onClick={() => void openApod()}
                >
                  {lang === 'id' ? 'Coba Lagi ↻' : 'Try Again ↻'}
                </button>
              </div>
            )}

            {!apodLoading && !apodError && apod && (
              <>
                <div className="fe-apod-meta">
                  {apod.date && (
                    <span className="fe-apod-date">
                      <span aria-hidden="true">📅</span> {apod.date}
                    </span>
                  )}
                  {apod.fallback ? (
                    <span className="fe-apod-badge fe-apod-badge--offline">
                      {lang === 'id' ? '● Mode Offline' : '● Offline Mode'}
                    </span>
                  ) : (
                    <span className="fe-apod-badge">
                      {apod.media_type === 'video' ? '● NASA Video' : '● Live NASA APOD'}
                    </span>
                  )}
                  {(apod.credit || apod.copyright) && (
                    <span className="fe-apod-source">
                      © {apod.credit || apod.copyright}
                    </span>
                  )}
                </div>

                {apod.fallback && (
                  <div className="fe-apod-offline-note">
                    <span className="fe-apod-offline-icon" aria-hidden="true">✦</span>
                    <p>
                      {lang === 'id'
                        ? 'Layanan upstream NASA APOD saat ini sedang tidak tersedia (Error 500). Menampilkan arsip offline observasi Vela Molecular Ridge Nebula dari SPHEREx.'
                        : 'NASA APOD upstream service is temporarily offline (Error 500). Displaying offline SPHEREx observation archive for the Vela Molecular Ridge Nebula.'}
                    </p>
                  </div>
                )}

                {(apod.image_url || apod.thumbnail_url) && (
                  <div className="fe-apod-image-container">
                    <img
                      className="fe-apod-image"
                      src={apod.image_url || apod.thumbnail_url || ''}
                      alt={apod.alt || apod.title || 'NASA APOD'}
                      loading="lazy"
                    />
                  </div>
                )}

                {apod.explanation && (
                  <p className="fe-apod-explanation">{apod.explanation}</p>
                )}

                <div className="fe-apod-actions">
                  {apod.article_url && (
                    <a
                      className="fe-btn-primary"
                      href={apod.article_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {lang === 'id' ? 'Buka di NASA Science ↗' : 'Read on NASA Science ↗'}
                    </a>
                  )}
                  <button
                    type="button"
                    className="fe-btn-text"
                    onClick={() => setApodOpen(false)}
                  >
                    {lang === 'id' ? 'Tutup' : 'Close'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
