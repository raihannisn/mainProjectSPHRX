import { useEffect } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { GatewayScreen } from './frontend/components/GatewayScreen'
import { SkyExplorerScreen } from './frontend/components/SkyExplorerScreen'
import { ObservationComparisonScreen } from './frontend/components/ObservationComparisonScreen'
import { CosmicGuideScreen } from './frontend/components/CosmicGuideScreen'
import { CosmicGuideWindow } from './frontend/components/CosmicGuideWindow'
import { WormholeOverlay } from './frontend/components/WormholeOverlay'
import { RouteSync, XRRoot } from './xr'
import './frontend/styles/frontend.css'

function XRLayout() {
  useEffect(() => {
    document.documentElement.classList.add('xr-locked')
    document.body.classList.add('xr-locked')
    return () => {
      document.documentElement.classList.remove('xr-locked')
      document.body.classList.remove('xr-locked')
    }
  }, [])
  return <Outlet />
}

function XRApp() {
  return (
    <>
      <RouteSync />
      <XRRoot />
    </>
  )
}

export function App() {
  return (
    <>
      <Routes>
        {/* 2D SPHEREx Frontend Screens */}
        <Route path="/" element={<GatewayScreen />} />
        <Route path="/explorer" element={<SkyExplorerScreen />} />
        <Route path="/comparison" element={<ObservationComparisonScreen />} />
        <Route path="/guide" element={<CosmicGuideScreen />} />
        <Route path="/guide/:objectId" element={<CosmicGuideScreen />} />

      {/* 3D WebXR Scenes */}
      <Route element={<XRLayout />}>
        <Route path="/xr" element={<XRApp />} />
        <Route path="/xr/body/:id" element={<XRApp />} />
        <Route path="/xr/surface/:siteId" element={<XRApp />} />
      </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* Full-screen wormhole for intentional XR entry; stays mounted so it can close itself. */}
      <WormholeOverlay />
      <CosmicGuideWindow />
    </>
  )
}

