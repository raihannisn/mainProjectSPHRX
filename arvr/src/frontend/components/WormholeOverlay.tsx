import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLoading } from '../../xr/loading'
import { useXRApp } from '../../xr/store'
import { originOf, registerWormhole, type WormholeOptions, type WormholeRunner, type WormholeTask } from '../wormhole'

const COPY = {
  en: {
    entering: 'Opening wormhole — preparing the 3D scene…',
    ambience: 'Ambience',
  },
} as const

type Phase = 'idle' | 'in' | 'hold' | 'out'
type Star = { a: number; z: number; h: number; w: number }
type Shock = { x: number; y: number; t: number; d: number; a: number }

const AMBIENCE_KEY = 'spherex.wormhole.ambience'
const AMBIENCE_VOLUME = 0.28

function readAmbience() {
  try {
    return window.localStorage.getItem(AMBIENCE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function WormholeOverlay() {
  const navigate = useNavigate()
  const location = useLocation()
  const inXR = location.pathname.startsWith('/xr')
  const copy = COPY.en

  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const runRef = useRef<WormholeRunner | null>(null)
  const copyRef = useRef(copy)
  const ambienceRef = useRef(true)
  const [ambience, setAmbience] = useState(readAmbience)

  useEffect(() => {
    copyRef.current = copy
  }, [copy])

  useEffect(() => {
    ambienceRef.current = ambience
    try {
      window.localStorage.setItem(AMBIENCE_KEY, ambience ? 'on' : 'off')
    } catch {
      /* storage can be blocked; the toggle still works for this session */
    }
  }, [ambience])

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!root || !canvas || !ctx) return

    const state = {
      W: 0,
      H: 0,
      cx: 0,
      cy: 0,
      t: 0,
      last: 0,
      raf: 0,
      speed: 0.3,
      tgt: 0.3,
      flash: 0,
      phase: 'idle' as Phase,
      still: false,
    }
    let stars: Star[] = []
    let shocks: Shock[] = []
    let fadeTimer = 0
    let busy: Promise<void> | null = null

    const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms) })

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      state.W = window.innerWidth
      state.H = window.innerHeight
      canvas.width = Math.round(state.W * dpr)
      canvas.height = Math.round(state.H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = state.W < 700 ? 130 : 260
      if (stars.length !== count) {
        stars = Array.from({ length: count }, () => ({
          a: Math.random() * Math.PI * 2,
          z: Math.random(),
          h: [172, 208, 222, 42, 262][Math.floor(Math.random() * 5)] + Math.random() * 14,
          w: Math.random(),
        }))
      }
    }

    /* Canvas painting ported from the ax- wormhole module: nebula, petals, star streaks,
       swirling rings, white core + shockwaves. No demo UI, no progress fakery. */
    const draw = (dt: number) => {
      const { W, H, cx, cy, t, speed, still, flash } = state
      const M = Math.min(W, H)
      const R = Math.hypot(W, H) * 0.55

      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = `rgba(6,16,32,${still ? 1 : 0.32})`
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'

      const cols = ['50,100,230', '79,227,214', '150,120,255', '212,175,55']
      const weights = [1.3, 0.55, 0.8, 0.45]
      for (let i = 0; i < 4; i += 1) {
        const angle = t * 0.05 * (i % 2 ? -1 : 1) + i * 1.57
        const rr = R * (0.35 + 0.12 * Math.sin(t * 0.4 + i))
        const nx = cx + Math.cos(angle) * rr
        const ny = cy + Math.sin(angle) * rr
        const nr = M * 0.7
        const gradient = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr)
        gradient.addColorStop(0, `rgba(${cols[i]},${(still ? 0.4 : 0.06) * weights[i]})`)
        gradient.addColorStop(1, `rgba(${cols[i]},0)`)
        ctx.fillStyle = gradient
        ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2)
      }

      for (let i = 0; i < 9; i += 1) {
        const ph = (t * 0.16 * (0.6 + speed * 0.8) + i / 9) % 1
        const a = i * 0.698 + t * 0.12 + ph * 1.2
        const r0 = R * 0.12 + ph * R * 0.25
        const r1 = r0 + R * (0.25 + 0.5 * ph)
        const w = (4 + ph * 22) * (M / 900)
        const alpha = Math.sin(ph * Math.PI) * 0.5
        const ca = Math.cos(a)
        const sa = Math.sin(a)
        const cm = Math.cos(a + 0.12)
        const sm = Math.sin(a + 0.12)
        const rm = (r0 + r1) / 2
        const mx = cx + cm * rm
        const my = cy + sm * rm
        const nxv = -sm * w
        const nyv = cm * w
        const tone = i % 3 === 2 ? 'rgba(229,192,123,' : i % 3 ? 'rgba(79,200,255,' : 'rgba(120,130,255,'
        ctx.fillStyle = `${tone}${i % 3 === 2 ? alpha * 0.7 : alpha})`
        ctx.beginPath()
        ctx.moveTo(cx + ca * r0, cy + sa * r0)
        ctx.quadraticCurveTo(mx + nxv, my + nyv, cx + Math.cos(a + 0.35) * r1, cy + Math.sin(a + 0.35) * r1)
        ctx.quadraticCurveTo(mx - nxv, my - nyv, cx + ca * r0, cy + sa * r0)
        ctx.fill()
      }

      ctx.lineCap = 'round'
      const twist = 0.9 + speed * 0.5
      const vz = 0.12 + 0.55 * speed
      for (const star of stars) {
        const v = dt * vz * (0.6 + star.w * 0.8)
        star.z -= v
        if (star.z < 0.015) {
          star.z = 1
          star.a = Math.random() * Math.PI * 2
        }
        const k0 = 1 - star.z
        const k1 = Math.max(0, 1 - Math.min(1, star.z + v * (2 + speed * 3)))
        const q0 = R * Math.pow(k0, 2.1) + 4
        const q1 = R * Math.pow(k1, 2.1) + 4
        const a0 = star.a + k0 * twist
        const a1 = star.a + k1 * twist
        ctx.strokeStyle = `hsla(${star.h},90%,${60 + k0 * 30}%,${0.15 + k0 * 0.8})`
        ctx.lineWidth = 0.6 + k0 * 2.2 * (0.5 + star.w)
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a1) * q1, cy + Math.sin(a1) * q1)
        ctx.lineTo(cx + Math.cos(a0) * q0, cy + Math.sin(a0) * q0)
        ctx.stroke()
      }

      for (let i = 0; i < 14; i += 1) {
        const d = (i / 14 + t * 0.09 * (0.5 + speed)) % 1
        const r = R * (0.04 + Math.pow(d, 2.2) * 0.9)
        const rot = i * 0.5 + t * (0.7 - d * 0.4) * (0.6 + speed * 0.4)
        ctx.lineWidth = 0.8 + d * 3.2
        ctx.strokeStyle = `hsla(${44 + d * d * 165},90%,${82 - d * 22}%,${Math.sin(d * Math.PI) * 0.5})`
        ctx.beginPath()
        for (let j = 0; j <= 44; j += 1) {
          const th = (j / 44) * Math.PI * 2
          const wave = 1 + 0.07 * Math.sin(th * 3 + t * 2.2 + i) + 0.04 * Math.sin(th * 5 - t * 1.6)
          const x = cx + Math.cos(th + rot) * r * wave
          const y = cy + Math.sin(th + rot) * r * wave
          if (j) ctx.lineTo(x, y)
          else ctx.moveTo(x, y)
        }
        ctx.stroke()
      }

      const hr = M * 0.3 * (1 + flash * 6)
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, hr)
      halo.addColorStop(0, 'rgba(255,255,255,.95)')
      halo.addColorStop(0.12, 'rgba(255,224,160,.55)')
      halo.addColorStop(0.45, 'rgba(79,227,214,.14)')
      halo.addColorStop(1, 'rgba(79,227,214,0)')
      ctx.fillStyle = halo
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'source-over'

      const cr = M * (0.035 + 0.01 * Math.sin(t * 3)) * (1 + flash * 16)
      ctx.lineWidth = 2
      ctx.strokeStyle = `rgba(229,192,123,${0.45 * (1 - flash)})`
      ctx.beginPath()
      ctx.arc(cx, cy, cr * 1.9, 0, Math.PI * 2)
      ctx.stroke()

      for (let i = shocks.length - 1; i >= 0; i -= 1) {
        const shock = shocks[i]
        const k = (t - shock.t) / shock.d
        if (k < 0) continue
        if (k >= 1) {
          shocks.splice(i, 1)
          continue
        }
        ctx.lineWidth = 1 + (1 - k) * 5
        ctx.strokeStyle = `rgba(229,192,123,${(1 - k) * (shock.a || 0.8)})`
        ctx.beginPath()
        ctx.arc(shock.x, shock.y, k * R * 1.1, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.fillStyle = '#fffaf0'
      ctx.beginPath()
      ctx.arc(cx, cy, cr, 0, Math.PI * 2)
      ctx.fill()

      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash * flash})`
        ctx.fillRect(0, 0, W, H)
      }
    }

    const frame = (now: number) => {
      state.raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - state.last) / 1000 || 0.016)
      state.last = now
      state.t += dt
      state.speed += (state.tgt - state.speed) * Math.min(1, dt * 3)
      if (state.phase === 'in' || state.phase === 'hold') {
        const ease = Math.min(1, dt * 2.4)
        state.cx += (state.W / 2 - state.cx) * ease
        state.cy += (state.H / 2 - state.cy) * ease
      }
      if (state.phase === 'out') state.flash = Math.min(1, state.flash + dt / 0.32)
      draw(dt)
    }

    const fadeTo = (target: number, ms: number) => {
      const el = audioRef.current
      if (!el) return
      window.clearInterval(fadeTimer)
      const from = el.volume
      const steps = Math.max(1, Math.round(ms / 40))
      let step = 0
      fadeTimer = window.setInterval(() => {
        step += 1
        el.volume = Math.min(1, Math.max(0, from + (target - from) * (step / steps)))
        if (step >= steps) {
          window.clearInterval(fadeTimer)
          if (target === 0) el.pause()
        }
      }, 40)
    }

    const startAudio = () => {
      const el = audioRef.current
      if (!el || !ambienceRef.current) return
      el.volume = 0
      const attempt = el.play()
      // Autoplay policy: a transition is always user-initiated, but the promise can still reject.
      if (attempt && typeof attempt.then === 'function') {
        attempt.then(() => fadeTo(AMBIENCE_VOLUME, 900)).catch(() => {})
      }
    }

    const stopAudio = () => {
      const el = audioRef.current
      if (!el) return
      window.clearInterval(fadeTimer)
      if (el.paused) return
      fadeTo(0, 500)
    }

    /** Real work: the XR scene reports when its textures/models/manual tasks settle. */
    const waitForScene = () => new Promise<void>((resolve) => {
      const started = performance.now()
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        unsubscribe()
        window.clearInterval(poll)
        window.clearTimeout(limit)
        resolve()
      }
      const check = () => {
        if (performance.now() - started < 700) return
        if (!useLoading.getState().active) finish()
      }
      const unsubscribe = useLoading.subscribe(check)
      const poll = window.setInterval(check, 120)
      const limit = window.setTimeout(finish, 5000)
    })

    const hide = async () => {
      if (state.phase === 'idle' || state.phase === 'out') return
      const still = state.still
      state.phase = 'out'
      state.tgt = 2.6
      state.flash = still ? 1 : 0
      if (!still) shocks.push({ x: state.cx, y: state.cy, t: state.t, d: 0.75, a: 1 })
      const duration = still ? 120 : 480
      if (!still) await wait(320)
      root.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`
      root.style.opacity = '0'
      root.style.transform = still ? 'none' : 'scale(1.06)'
      stopAudio()
      await wait(duration + 40)
      if (state.raf) cancelAnimationFrame(state.raf)
      state.raf = 0
      state.phase = 'idle'
      root.classList.remove('fe-wormhole--on')
      root.setAttribute('aria-hidden', 'true')
      root.style.transition = 'none'
      root.style.transform = 'none'
      root.style.opacity = '1'
      root.style.clipPath = 'circle(0px at 50% 50%)'
      // Never leave focus inside the now-hidden overlay.
      if (root.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }

    const run: WormholeRunner = (options: WormholeOptions = {}, task?: WormholeTask) => {
      if (busy) return busy
      const started = performance.now()
      const still = false
      const label = options.label || copyRef.current.entering
      if (labelRef.current) labelRef.current.textContent = label
      resize()
      const x = options.origin?.x ?? state.W / 2
      const y = options.origin?.y ?? state.H / 2
      state.still = still
      state.cx = x
      state.cy = y
      state.flash = 0
      state.speed = 0.3
      state.tgt = 1.5
      state.phase = 'in'
      shocks = still ? [] : [{ x, y, t: state.t, d: 0.9, a: 1 }]
      if (barRef.current) barRef.current.style.width = ''
      root.classList.add('fe-wormhole--on')
      root.setAttribute('aria-hidden', 'false')
      const radius = Math.hypot(Math.max(x, state.W - x), Math.max(y, state.H - y)) + 12
      root.style.transition = 'none'
      root.style.opacity = '1'
      root.style.transform = 'none'
      root.style.clipPath = `circle(0px at ${x}px ${y}px)`
      void root.offsetWidth
      root.style.transition = still ? 'none' : 'clip-path 680ms cubic-bezier(.55,0,.15,1)'
      root.style.clipPath = `circle(${radius}px at ${x}px ${y}px)`
      if (still) {
        state.t += 1.4
        draw(0)
      } else {
        state.last = performance.now()
        state.raf = requestAnimationFrame(frame)
      }
      startAudio()

      busy = (async () => {
        try {
          if (!still) await wait(200)
          await task?.()
          if (!still) await waitForScene()
          // Animation floor only — long enough to read the label, no invented progress.
          const floor = options.minMs ?? (still ? 260 : 900)
          const rest = floor - (performance.now() - started)
          if (rest > 0) await wait(rest)
        } finally {
          await hide()
          busy = null
        }
      })()
      return busy
    }

    runRef.current = run
    const unregister = registerWormhole(run)

    const onResize = () => {
      if (state.phase !== 'idle') resize()
    }
    window.addEventListener('resize', onResize)

    return () => {
      unregister()
      runRef.current = null
      window.removeEventListener('resize', onResize)
      window.clearInterval(fadeTimer)
      if (state.raf) cancelAnimationFrame(state.raf)
      const el = audioRef.current
      if (el) {
        el.pause()
        el.volume = 0
      }
    }
  }, [])

  // XR links live in components we must not touch (TopBar's Dynamic Island). Intercept them
  // here so the portal opens from the link the user actually pressed.
  useEffect(() => {
    if (inXR) return
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(target instanceof HTMLAnchorElement)) return
      if (target.target && target.target !== '_self') return
      const href = target.getAttribute('href')
      if (!href || !href.startsWith('/xr')) return
      const run = runRef.current
      event.preventDefault()
      if (!run) {
        navigate(href)
        return
      }
      void run({ origin: originOf(target) }, () => navigate(href))
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [inXR, navigate])

  return (
    <div
      className="fe-wormhole"
      ref={rootRef}
      role="status"
      aria-live="polite"
      aria-hidden="true"
    >
      <canvas className="fe-wormhole__canvas" ref={canvasRef} aria-hidden="true" />
      <div className="fe-wormhole__label">
        <span className="fe-wormhole__text" ref={labelRef} />
        <i className="fe-wormhole__bar" aria-hidden="true"><b ref={barRef} /></i>
        <button
          type="button"
          className="fe-wormhole__ambience"
          aria-pressed={ambience}
          onClick={() => setAmbience((value) => !value)}
        >
          <span aria-hidden="true">{ambience ? '♪' : '♪̸'}</span>
          <span>{copy.ambience} · {ambience ? 'ON' : 'OFF'}</span>
        </button>
      </div>
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/wormhole-ambience.mp3`} loop preload="none" />
    </div>
  )
}

/** Compact, local version of the wormhole for Explorer/Comparison requests (never full-screen). */
export function WormholePulse({ label, decorative = false }: { label?: string; decorative?: boolean }) {
  if (decorative) {
    return (
      <span className="fe-wormhole-pulse" aria-hidden="true">
        <i className="fe-wormhole-pulse__ring" />
      </span>
    )
  }
  return (
    <span className="fe-wormhole-pulse" role="status" aria-live="polite">
      <i className="fe-wormhole-pulse__ring" aria-hidden="true" />
      {label ? <span className="fe-wormhole-pulse__label">{label}</span> : null}
    </span>
  )
}
