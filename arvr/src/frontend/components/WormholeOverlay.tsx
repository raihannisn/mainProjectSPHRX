import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLoading } from '../../xr/loading'
import { useXRApp } from '../../xr/store'
import { originOf, registerWormhole, type WormholeOptions, type WormholeRunner, type WormholeTask } from '../wormhole'
import { ambientAudio, useAmbientAudio } from '../audio/ambientAudio'

const COPY = {
  en: {
    entering: 'Opening wormhole — preparing the 3D scene…',
    returning: 'Returning to Cosmic Expedition…',
    ambience: 'Ambience',
  },
  id: {
    entering: 'Membuka wormhole — menyiapkan scene 3D…',
    returning: 'Kembali ke Cosmic Expedition…',
    ambience: 'Ambience',
  },
} as const

type Phase = 'idle' | 'in' | 'hold' | 'out'
type Star = { a: number; z: number; colorIdx: number; w: number }

const STAR_COLORS = [
  'rgba(79, 227, 214, ',  // cyan
  'rgba(90, 160, 255, ',  // blue
  'rgba(140, 190, 255, ', // light blue
  'rgba(229, 192, 123, ', // gold
  'rgba(56, 189, 248, ',  // electric sky-blue
]

function createNebulaSprite(color: string, size = 128): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const cx = c.getContext('2d')
  if (!cx) return c
  const half = size / 2
  const grad = cx.createRadialGradient(half, half, 0, half, half, half)
  grad.addColorStop(0, `rgba(${color}, 1)`)
  grad.addColorStop(0.45, `rgba(${color}, 0.35)`)
  grad.addColorStop(1, `rgba(${color}, 0)`)
  cx.fillStyle = grad
  cx.fillRect(0, 0, size, size)
  return c
}

function createHaloSprite(size = 256): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const cx = c.getContext('2d')
  if (!cx) return c
  const half = size / 2
  const halo = cx.createRadialGradient(half, half, 0, half, half, half)
  halo.addColorStop(0, 'rgba(255,255,255,0.95)')
  halo.addColorStop(0.12, 'rgba(255,224,160,0.55)')
  halo.addColorStop(0.45, 'rgba(79,227,214,0.14)')
  halo.addColorStop(1, 'rgba(79,227,214,0)')
  cx.fillStyle = halo
  cx.fillRect(0, 0, size, size)
  return c
}

export function WormholeOverlay() {
  const navigate = useNavigate()
  const location = useLocation()
  const lang = useXRApp((s) => s.settings.lang)
  const inXR = location.pathname.startsWith('/xr')
  const copy = COPY[lang === 'id' ? 'id' : 'en']
  const { isEnabled: ambience, toggle: toggleAmbience } = useAmbientAudio()

  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const runRef = useRef<WormholeRunner | null>(null)
  const copyRef = useRef(copy)

  useEffect(() => {
    copyRef.current = copy
  }, [copy])

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!root || !canvas || !ctx) return

    // Pre-render gradient sprites offscreen for maximum GPU rendering performance
    const nebulaCols = ['50,100,230', '79,227,214', '56,189,248', '212,175,55']
    const nebulaWeights = [1.2, 0.55, 0.8, 0.45]
    const nebulaSprites = nebulaCols.map((col) => createNebulaSprite(col, 128))
    const haloSprite = createHaloSprite(256)

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
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
      iris: 0,
      flash: 0,
      phase: 'idle' as Phase,
      still: false,
    }
    let stars: Star[] = []
    let busy: Promise<void> | null = null

    const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms) })

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25)
      state.W = window.innerWidth
      state.H = window.innerHeight
      canvas.width = Math.round(state.W * dpr)
      canvas.height = Math.round(state.H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = state.W < 700 ? 60 : 100
      if (stars.length !== count) {
        stars = Array.from({ length: count }, () => ({
          a: Math.random() * Math.PI * 2,
          z: Math.random(),
          colorIdx: Math.floor(Math.random() * STAR_COLORS.length),
          w: Math.random(),
        }))
      }
    }

    const draw = (dt: number) => {
      const { W, H, cx, cy, t, speed, still, flash, iris } = state
      const M = Math.min(W, H)
      const R = Math.hypot(W, H) * 0.55
      const maxRadius = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 20
      const currentR = still ? maxRadius : maxRadius * Math.min(1, Math.max(0.02, iris))

      ctx.clearRect(0, 0, W, H)
      ctx.save()

      // Hardware-accelerated circular portal mask inside canvas
      ctx.beginPath()
      ctx.arc(cx, cy, currentR, 0, Math.PI * 2)
      ctx.clip()

      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#061020'
      ctx.fillRect(0, 0, W, H)

      ctx.globalCompositeOperation = 'lighter'

      // 1. Nebula clouds drawn from pre-rendered GPU sprites
      for (let i = 0; i < 4; i += 1) {
        const angle = t * 0.05 * (i % 2 ? -1 : 1) + i * 1.57
        const rr = R * (0.35 + 0.12 * Math.sin(t * 0.4 + i))
        const nx = cx + Math.cos(angle) * rr
        const ny = cy + Math.sin(angle) * rr
        const nr = M * 0.7
        ctx.globalAlpha = (still ? 0.35 : 0.08) * nebulaWeights[i]
        ctx.drawImage(nebulaSprites[i], nx - nr, ny - nr, nr * 2, nr * 2)
      }
      ctx.globalAlpha = 1

      // 2. Star streaks batched by color
      const twist = 0.8 + speed * 0.5
      const vz = 0.14 + 0.6 * speed
      const starPaths: Array<Array<{ x0: number; y0: number; x1: number; y1: number }>> = [
        [], [], [], [], []
      ]

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
        starPaths[star.colorIdx].push({
          x0: cx + Math.cos(a0) * q0,
          y0: cy + Math.sin(a0) * q0,
          x1: cx + Math.cos(a1) * q1,
          y1: cy + Math.sin(a1) * q1,
        })
      }

      ctx.lineCap = 'round'
      for (let c = 0; c < STAR_COLORS.length; c += 1) {
        const list = starPaths[c]
        if (list.length === 0) continue
        ctx.strokeStyle = `${STAR_COLORS[c]}0.85)`
        ctx.lineWidth = 1.3
        ctx.beginPath()
        for (let j = 0; j < list.length; j += 1) {
          ctx.moveTo(list[j].x1, list[j].y1)
          ctx.lineTo(list[j].x0, list[j].y0)
        }
        ctx.stroke()
      }

      // 3. Concentric energy warp rings (5 rings)
      const RING_COUNT = 5
      for (let i = 0; i < RING_COUNT; i += 1) {
        const d = (i / RING_COUNT + t * 0.1 * (0.5 + speed)) % 1
        const r = R * (0.04 + Math.pow(d, 2.2) * 0.88)
        const rot = i * 0.6 + t * (0.6 - d * 0.3) * (0.6 + speed * 0.4)
        ctx.lineWidth = 0.8 + d * 2.8
        ctx.strokeStyle = `hsla(${44 + d * d * 165},90%,${80 - d * 20}%,${Math.sin(d * Math.PI) * 0.5})`
        ctx.beginPath()
        const STEPS = 28
        for (let j = 0; j <= STEPS; j += 1) {
          const th = (j / STEPS) * Math.PI * 2
          const wave = 1 + 0.06 * Math.sin(th * 3 + t * 2.2 + i)
          const x = cx + Math.cos(th + rot) * r * wave
          const y = cy + Math.sin(th + rot) * r * wave
          if (j === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // 4. Central halo sprite
      const hr = M * 0.28 * (1 + flash * 4)
      ctx.drawImage(haloSprite, cx - hr, cy - hr, hr * 2, hr * 2)

      ctx.globalCompositeOperation = 'source-over'

      // 5. Core singularity
      const cr = M * (0.035 + 0.01 * Math.sin(t * 3)) * (1 + flash * 12)
      ctx.fillStyle = '#fffaf0'
      ctx.beginPath()
      ctx.arc(cx, cy, cr, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()

      // 6. Glowing expanding boundary ring around portal iris
      if (currentR < maxRadius - 4) {
        ctx.lineWidth = 3
        ctx.strokeStyle = `rgba(79, 227, 214, ${Math.max(0, 0.95 - iris * 0.7)})`
        ctx.beginPath()
        ctx.arc(cx, cy, currentR, 0, Math.PI * 2)
        ctx.stroke()
      }

      // 7. Light flash on exit
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash * flash * 0.92})`
        ctx.fillRect(0, 0, W, H)
      }
    }

    const frame = (now: number) => {
      state.raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - state.last) / 1000 || 0.016)
      state.last = now
      state.t += dt
      state.speed += (state.tgt - state.speed) * Math.min(1, dt * 3.5)
      if (state.phase === 'in' || state.phase === 'hold') {
        const ease = Math.min(1, dt * 2.5)
        state.cx += (state.W / 2 - state.cx) * ease
        state.cy += (state.H / 2 - state.cy) * ease
        state.iris += (1 - state.iris) * Math.min(1, dt * 7.0)
      }
      if (state.phase === 'out') state.flash = Math.min(1, state.flash + dt / 0.22)
      draw(dt)
    }

    /** Real work: the XR scene reports when its textures/models/manual tasks settle. */
    const waitForScene = () => new Promise<void>((resolve) => {
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
        if (!useLoading.getState().active) finish()
      }
      const unsubscribe = useLoading.subscribe(check)
      const poll = window.setInterval(check, 80)
      const limit = window.setTimeout(finish, 4000)
      check()
    })

    const hide = async () => {
      if (state.phase === 'idle' || state.phase === 'out') return
      const still = state.still
      state.phase = 'out'
      state.tgt = 2.6
      state.flash = still ? 1 : 0
      const duration = still ? 80 : 240
      if (!still) await wait(120)
      root.style.transition = `opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`
      root.style.opacity = '0'
      await wait(duration + 20)
      if (state.raf) cancelAnimationFrame(state.raf)
      state.raf = 0
      state.phase = 'idle'
      root.classList.remove('fe-wormhole--on')
      root.setAttribute('aria-hidden', 'true')
      root.style.opacity = '0'
      if (root.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }

    const run: WormholeRunner = (options: WormholeOptions = {}, task?: WormholeTask) => {
      if (busy) return busy
      const started = performance.now()
      const still = reduce.matches
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
      state.tgt = 1.6
      state.iris = still ? 1 : 0.04
      state.phase = 'in'
      if (barRef.current) barRef.current.style.width = ''
      root.classList.add('fe-wormhole--on')
      root.setAttribute('aria-hidden', 'false')
      root.style.transition = 'opacity 0.22s ease'
      root.style.opacity = '1'

      if (still) {
        state.t += 1.4
        draw(0)
      } else {
        state.last = performance.now()
        state.raf = requestAnimationFrame(frame)
      }

      // Ensure ambient sound plays if enabled
      if (ambientAudio.isEnabled()) {
        ambientAudio.play()
      }

      busy = (async () => {
        try {
          if (!still) await wait(140)
          await task?.()
          if (!still && options.waitForScene) {
            await waitForScene()
          }
          const floor = options.minMs ?? (still ? 180 : (options.waitForScene ? 650 : 380))
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
      if (state.raf) cancelAnimationFrame(state.raf)
    }
  }, [])

  // Intercept navigation links for smooth wormhole transitions:
  // 1) 2D -> 3D (to /xr)
  // 2) 3D -> 2D (back to /explorer, /comparison, /guide, /)
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(target instanceof HTMLAnchorElement)) return
      if (target.target && target.target !== '_self') return
      const href = target.getAttribute('href')
      if (!href) return

      const isToXR = !inXR && href.startsWith('/xr')
      const isExitXR = inXR && (href.startsWith('/explorer') || href.startsWith('/comparison') || href.startsWith('/guide') || href === '/')

      if (!isToXR && !isExitXR) return

      const run = runRef.current
      event.preventDefault()
      if (!run) {
        navigate(href)
        return
      }

      const label = isExitXR
        ? (lang === 'id' ? COPY.id.returning : COPY.en.returning)
        : (lang === 'id' ? COPY.id.entering : COPY.en.entering)

      void run({ origin: originOf(target), label, waitForScene: isToXR, minMs: isExitXR ? 380 : 650 }, () => navigate(href))
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [inXR, lang, navigate])

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
          onClick={toggleAmbience}
        >
          <span aria-hidden="true">{ambience ? '♪' : '♪̸'}</span>
          <span>{copy.ambience} · {ambience ? 'ON' : 'OFF'}</span>
        </button>
      </div>
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
