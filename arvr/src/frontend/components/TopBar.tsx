import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchSystemStatus, type SystemStatus } from '../api'
import { useXRApp } from '../../xr/store'
import { originOf, runWormhole } from '../wormhole'

type NavState = 'top' | 'island' | 'island-open'

const NAV_ITEMS = [
  { to: '/', label: 'Gateway' },
  { to: '/explorer', label: 'Sky Explorer' },
  { to: '/comparison', label: 'Comparison' },
  { to: '/guide', label: 'Cosmic Guide' },
]

const NAV_LABELS: Record<string, string> = {
  '/': 'Opening Gateway…',
  '/explorer': 'Opening Sky Explorer…',
  '/comparison': 'Opening Spectral Comparison…',
  '/guide': 'Opening Cosmic Guide…',
  '/xr': 'Opening wormhole — preparing the 3D scene…',
}

function routeLabel(pathname: string) {
  if (pathname.startsWith('/explorer')) return 'Sky Explorer'
  if (pathname.startsWith('/comparison')) return 'Comparison'
  if (pathname.startsWith('/guide')) return 'Cosmic Guide'
  return 'Gateway'
}

export function TopBar() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [online, setOnline] = useState<boolean>(true)
  const [scrolled, setScrolled] = useState(false)
  const [instant, setInstant] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const lang = useXRApp((s) => s.settings.lang)
  const location = useLocation()

  const headerRef = useRef<HTMLElement>(null)
  const islandRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let mounted = true
    fetchSystemStatus().then((res) => {
      if (!mounted) return
      if (res.ok && res.data) {
        setStatus(res.data)
        setOnline(true)
      } else {
        setOnline(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  // The app shell locks body overflow, so `.fe-app` is the real scroll
  // container. Window stays as a fallback for document-scrolling layouts.
  const readScrollTop = useCallback(() => {
    const host = headerRef.current?.closest('.fe-app') as HTMLElement | null
    return Math.max(host?.scrollTop ?? 0, window.scrollY || 0)
  }, [])

  useLayoutEffect(() => {
    if (readScrollTop() > 24) setScrolled(true)
    // The first paint must not morph: enable transitions on the next frame.
    const frame = requestAnimationFrame(() => setInstant(false))
    return () => cancelAnimationFrame(frame)
  }, [readScrollTop])

  useEffect(() => {
    const host = headerRef.current?.closest('.fe-app') as HTMLElement | null
    let frame = 0

    const apply = () => {
      frame = 0
      const y = readScrollTop()
      setScrolled((prev) => {
        if (!prev && y > 24) return true
        if (prev && y <= 8) return false
        return prev
      })
    }
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(apply)
    }

    host?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    // Covers a scroll that lands between commit and passive-effect attach.
    apply()
    return () => {
      if (frame) cancelAnimationFrame(frame)
      host?.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [readScrollTop])

  // The compact menu belongs to small screens only.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)')
    const onChange = () => {
      if (desktop.matches) setMenuOpen(false)
    }
    desktop.addEventListener('change', onChange)
    return () => desktop.removeEventListener('change', onChange)
  }, [])

  // Route changes always close the panel; the scroll state is re-read on the
  // next frame because the recycled `.fe-app` node clamps its scrollTop to 0
  // only after the new screen lays out.
  useEffect(() => {
    setMenuOpen(false)
    const frame = requestAnimationFrame(() => {
      const y = readScrollTop()
      setScrolled((prev) => (prev ? y > 8 : y > 24))
    })
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, readScrollTop])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (islandRef.current && !islandRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuBtnRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const state: NavState = menuOpen ? 'island-open' : scrolled ? 'island' : 'top'
  const copy = { open: 'Open menu', close: 'Close menu', nav: 'Main Navigation', panel: 'Menu Navigation' }
  const statusLabel = online ? (status?.engine ? 'BACKEND LIVE' : 'DEMO READY') : 'OFFLINE MODE'

  const handleNav = (
    event: React.MouseEvent<HTMLElement>,
    to: string,
    onClose?: () => void,
  ) => {
    if (to === '/guide' && window.matchMedia('(min-width: 768px)').matches) {
      event.preventDefault()
      onClose?.()
      window.dispatchEvent(
        new CustomEvent('cosmic:open-guide', {
          detail: { returnFocus: event.currentTarget },
        }),
      )
      return
    }

    const isCurrent = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
    if (isCurrent) {
      event.preventDefault()
      onClose?.()
      return
    }

    event.preventDefault()
    onClose?.()
    const origin = originOf(event.currentTarget)
    const isToXR = to.startsWith('/xr')
    const label = NAV_LABELS[to] || 'Loading page…'

    void runWormhole(
      {
        origin,
        label,
        waitForScene: isToXR,
        minMs: isToXR ? 650 : 380,
      },
      () => navigate(to),
    )
  }

  const navLinks = (variant: 'bar' | 'panel') =>
    NAV_ITEMS.map((item) => (
      <NavLink
        key={`${variant}-${item.to}`}
        to={item.to}
        end={item.to === '/'}
        className={({ isActive }) => `fe-nav-link ${isActive ? 'active' : ''}`}
        onClick={(event) => {
          handleNav(event, item.to, () => {
            if (variant === 'panel') setMenuOpen(false)
          })
        }}
      >
        {item.label}
      </NavLink>
    ))

  const connection = (
    <div
      className="fe-connection"
      role="status"
      aria-live="polite"
      aria-label={statusLabel}
      title={status?.message ?? (online ? 'API Online' : 'API Unavailable')}
    >
      <i className={`fe-dot ${online ? '' : 'offline'}`} aria-hidden="true" />
      <span>{statusLabel}</span>
    </div>
  )

  return (
    <>
      <header className="fe-topbar" data-state={state} data-instant={instant ? 'true' : 'false'} ref={headerRef}>
        <div className="fe-island" ref={islandRef}>
          <div className="fe-island-bar">
            <div className="fe-brand">
              <Link
                to="/"
                className="fe-brand-link"
                onClick={(event) => {
                  handleNav(event, '/', () => setMenuOpen(false))
                }}
              >
                <span className="fe-brand-mark">S</span>
                <span className="fe-brand-text">
                  SPHEREx <span className="fe-brand-sep fe-muted">/</span>{' '}
                  <span className="fe-brand-sub">COSMIC EXPEDITION</span>
                </span>
              </Link>
              <nav className="fe-nav-links fe-nav-links--bar" aria-label={copy.nav}>
                {navLinks('bar')}
              </nav>
            </div>

            <span className="fe-route-chip" aria-hidden="true">
              {routeLabel(location.pathname)}
            </span>

            <div className="fe-top-actions" />

            <button
              type="button"
              className="fe-menu-btn"
              ref={menuBtnRef}
              aria-expanded={menuOpen}
              aria-controls="fe-island-menu"
              aria-label={menuOpen ? copy.close : copy.open}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
            </button>
          </div>

          <div className="fe-island-menu" id="fe-island-menu" aria-hidden={!menuOpen} aria-label={copy.panel}>
            <nav className="fe-nav-links fe-nav-links--panel" aria-label={copy.panel}>
              {navLinks('panel')}
            </nav>
          </div>
        </div>
      </header>
      <div className="fe-topbar-spacer" aria-hidden="true" />
    </>
  )
}
