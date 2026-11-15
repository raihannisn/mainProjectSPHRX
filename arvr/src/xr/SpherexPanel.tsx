import { useEffect, useState } from 'react'
import { useXRApp } from './store'
import { isHit, loadBlinkMeta, movedArcsec, useSpherex } from './spherexState'
import { SPHEREX_IMAGES, revealBlink } from './SpherexTable'
import { t } from './i18n'
import { runWormhole } from '../frontend/wormhole'

/** True on a phone held upright, where the 3D console would be too small to read. */
function useNarrow() {
  const q = '(max-width: 639px) and (orientation: portrait)'
  const [narrow, set] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q)
    const on = () => set(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return narrow
}

/** On-screen controls for the SPHEREx table on phones (same game state as the 3D console). */
export function SpherexPanel() {
  const narrow = useNarrow()
  const session = useXRApp((s) => s.mode !== 'desktop')
  const {
    view,
    blinking,
    flags,
    revealed,
    meta,
    liveFrame,
    liveBlinking,
    setView,
    setBlinking,
    flipLive,
    setLiveBlinking,
    reset,
  } = useSpherex()

  const obsIdA = useXRApp((s) => s.observation)
  const obsIdB = useXRApp((s) => s.observationB)
  const obsDataA = useXRApp((s) => s.observationDataA)
  const obsDataB = useXRApp((s) => s.observationDataB)
  const target = useXRApp((s) => s.target)
  const band = useXRApp((s) => s.band)

  useEffect(() => void loadBlinkMeta(), [])
  if (!narrow || session) return null

  const images = SPHEREX_IMAGES()
  const image = images.find((i) => i.id === view)
  const found = meta ? flags.some((f) => isHit(f, meta)) : false

  const viewsList: { id: string; label: string }[] = []
  if (obsIdB) viewsList.push({ id: 'live-compare', label: `● ${t('Live Comp')}` })
  if (obsIdA) viewsList.push({ id: 'live-obs', label: `● ${t('Live Obs')}` })
  viewsList.push({ id: 'blink', label: `${t('Spot what moved')}` })
  for (const img of images) {
    viewsList.push({ id: img.id, label: t(img.label) })
  }

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
    } else {
      const sp = new URLSearchParams()
      if (target) sp.set('target', target)
      if (obsIdA) sp.set('obs', obsIdA)
      if (band) sp.set('band', band)
      void runWormhole({ label: 'Returning to Cosmic Expedition…', waitForScene: false, minMs: 380 }, () => {
        window.location.href = `/explorer?${sp}`
      })
    }
  }

  const liveActiveObs = liveFrame === 0 ? obsDataA : obsDataB
  const liveActiveId = liveFrame === 0 ? obsIdA : obsIdB

  return (
    <section className="spherex-panel" aria-label={t('SPHEREx table experience')}>
      <div className="segmented spherex-panel__views" role="radiogroup">
        {viewsList.map((o) => (
          <button key={o.id} role="radio" aria-checked={view === o.id} className={view === o.id ? 'on' : ''} onClick={() => setView(o.id)}>
            {o.label}
          </button>
        ))}
      </div>

      {view === 'blink' ? (
        <>
          <p className={revealed && found ? 'good' : ''}>
            {revealed
              ? found
                ? t('You found it! That dot is asteroid {x}: it moved {n}″ in {h} hours.', { x: meta?.target.name ?? '', n: Math.round(meta ? movedArcsec(meta) : 0), h: meta?.gapHours ?? '' })
                : t('The moving dot is asteroid {x} (known, from NASA JPL). Your other flags stay unverified.', { x: meta?.target.name ?? '' })
              : t('Two real SPHEREx images of the same sky, 1.8 hours apart. Stars stay put. Tap the dot that jumps.')}
          </p>
          <div className="spherex-panel__actions">
            <button className="chip-btn" onClick={() => setBlinking(!blinking)}>
              {blinking ? `❚❚ ${t('Pause blink')}` : `▶ ${t('Blink')}`}
            </button>
            <button className="chip-btn primary" disabled={revealed} onClick={revealBlink}>
              ✓ {t('Reveal')}
            </button>
            <button className="chip-btn" onClick={reset}>
              ↺ {t('Start over')}
            </button>
          </div>
        </>
      ) : view === 'live-compare' ? (
        <>
          <p>
            <strong>{`● Epoch ${liveFrame === 0 ? 'A' : 'B'}`}:</strong> {liveActiveId} · {liveActiveObs?.detector || 'D'} · {liveActiveObs?.effective_wavelength_at_target || ''}
          </p>
          <div className="spherex-panel__actions">
            <button className="chip-btn" onClick={() => setLiveBlinking(!liveBlinking)}>
              {liveBlinking ? `❚❚ ${t('Pause blink')}` : `▶ ${t('Blink')}`}
            </button>
            <button className="chip-btn primary" onClick={flipLive}>
              ⇄ {`Flip (${liveFrame === 0 ? 'A' : 'B'})`}
            </button>
            <button className="chip-btn" onClick={handleReturnTo2D}>
              ◂ {t('Comparison (2D)')}
            </button>
          </div>
        </>
      ) : view === 'live-obs' ? (
        <>
          <p>
            <strong>● LIVE:</strong> {obsDataA?.observation_id || obsIdA} · {obsDataA?.detector || ''} · {obsDataA?.observed_at_utc?.slice(0, 10) || ''}
            <br />
            <small style={{ color: '#9ba8bf' }}>{obsDataA?.effective_wavelength_at_target || 'Nominal band'} · {obsDataA?.quality_flag_meaning || 'Unflagged'}</small>
          </p>
          <div className="spherex-panel__actions">
            <button className="chip-btn primary" onClick={handleReturnTo2D}>
              ◂ {t('2D Explorer')}
            </button>
          </div>
        </>
      ) : (
        <p>{t('NASA’s released SPHEREx images to explore. Only NASA-identified objects are marked.')}</p>
      )}

      <small>
        {view === 'live-obs' || view === 'live-compare'
          ? t('NASA IRSA SPHEREx live archive · Visual preview only')
          : t(view === 'blink' ? (meta?.credit ?? '') : (image?.credit ?? ''))}
      </small>
    </section>
  )
}
