import { Routes, Route, Navigate } from 'react-router-dom'
import { SkyExplorerScreen } from './frontend/components/SkyExplorerScreen'
import { GatewayScreen } from './frontend/components/GatewayScreen'
import { ObservationComparisonScreen } from './frontend/components/ObservationComparisonScreen'
import { CosmicGuideScreen } from './frontend/components/CosmicGuideScreen'
import { CosmicGuideWindow } from './frontend/components/CosmicGuideWindow'
import { WormholeOverlay } from './frontend/components/WormholeOverlay'
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
    <>
      <Routes>
        {/* SPHEREx Cosmic Expedition Screens (Solar System Hub & 3D bodies live in /explorer) */}
        <Route path="/" element={<GatewayScreen />} />
        <Route path="/explorer" element={<SkyExplorerScreen />} />
        <Route path="/comparison" element={<ObservationComparisonScreen />} />
        <Route path="/guide" element={<CosmicGuideScreen />} />
        <Route path="/guide/:objectId" element={<CosmicGuideScreen />} />

        {/* AR/VR experience: Solar System hub, body explorer and walkable surface */}
        <Route path="/xr" element={<XRApp />} />
        <Route path="/xr/body/:id" element={<XRApp />} />
        <Route path="/xr/surface/:siteId" element={<XRApp />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* Full-screen wormhole transition overlay; stays mounted so it can close itself. */}
      <WormholeOverlay />
      <CosmicGuideWindow />
    </>
  )
}

