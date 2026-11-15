import { Routes, Route, Navigate } from 'react-router-dom'
import { GatewayScreen } from './frontend/components/GatewayScreen'
import { SkyExplorerScreen } from './frontend/components/SkyExplorerScreen'
import { ObservationComparisonScreen } from './frontend/components/ObservationComparisonScreen'
import { CosmicGuideScreen } from './frontend/components/CosmicGuideScreen'
import { RouteSync, XRRoot } from './xr'
import './frontend/styles/frontend.css'

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
    <Routes>
      {/* 2D SPHEREx Frontend Screens */}
      <Route path="/" element={<GatewayScreen />} />
      <Route path="/explorer" element={<SkyExplorerScreen />} />
      <Route path="/comparison" element={<ObservationComparisonScreen />} />
      <Route path="/guide" element={<CosmicGuideScreen />} />
      <Route path="/guide/:objectId" element={<CosmicGuideScreen />} />

      {/* 3D WebXR Scenes */}
      <Route path="/xr" element={<XRApp />} />
      <Route path="/xr/body/:id" element={<XRApp />} />
      <Route path="/xr/surface/:siteId" element={<XRApp />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

