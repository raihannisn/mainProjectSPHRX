import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { fetchSystemStatus, type SystemStatus } from '../api'
import { useXRApp } from '../../xr/store'

export function TopBar() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [online, setOnline] = useState<boolean>(true)
  const lang = useXRApp((s) => s.settings.lang)

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

  const toggleLang = () => {
    const next = lang === 'en' ? 'id' : 'en'
    useXRApp.setState((s) => ({
      settings: { ...s.settings, lang: next },
    }))
  }

  return (
    <header className="fe-topbar">
      <div className="fe-brand">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="fe-brand-mark">S</span>
          <span>
            SPHEREx <span className="fe-muted">/</span> COSMIC EXPEDITION
          </span>
        </Link>
        <nav className="fe-nav-links" aria-label="Main Navigation">
          <NavLink to="/" end className={({ isActive }) => `fe-nav-link ${isActive ? 'active' : ''}`}>
            Gateway
          </NavLink>
          <NavLink to="/explorer" className={({ isActive }) => `fe-nav-link ${isActive ? 'active' : ''}`}>
            Sky Explorer
          </NavLink>
          <NavLink to="/comparison" className={({ isActive }) => `fe-nav-link ${isActive ? 'active' : ''}`}>
            Comparison
          </NavLink>
          <NavLink to="/guide" className={({ isActive }) => `fe-nav-link ${isActive ? 'active' : ''}`}>
            Cosmic Guide
          </NavLink>
        </nav>
      </div>

      <div className="fe-top-actions">
        <div className="fe-connection" title={status?.message ?? (online ? 'API Online' : 'API Unavailable')}>
          <i className={`fe-dot ${online ? '' : 'offline'}`} />
          <span>{online ? (status?.engine ? 'BACKEND LIVE' : 'DEMO READY') : 'OFFLINE MODE'}</span>
        </div>

        <button className="fe-lang-btn" onClick={toggleLang} aria-label="Toggle language">
          {lang === 'en' ? (
            <>
              <strong>EN</strong> / ID
            </>
          ) : (
            <>
              EN / <strong>ID</strong>
            </>
          )}
        </button>

        <Link to="/xr" className="fe-xr-badge-btn" title="Open Solar System & WebXR 3D Hub">
          <span>3D / WebXR</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </header>
  )
}

