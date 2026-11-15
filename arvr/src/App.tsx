import { Routes, Route, Navigate } from 'react-router-dom'
import { SkyExplorerScreen } from './frontend/components/SkyExplorerScreen'
import { GatewayScreen } from './frontend/components/GatewayScreen'
import { ObservationComparisonScreen } from './frontend/components/ObservationComparisonScreen'
import { CosmicGuideScreen } from './frontend/components/CosmicGuideScreen'
import { CosmicGuideWindow } from './frontend/components/CosmicGuideWindow'
import { WormholeOverlay } from './frontend/components/WormholeOverlay'
import './frontend/styles/frontend.css'

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

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* Full-screen wormhole transition overlay; stays mounted so it can close itself. */}
      <WormholeOverlay />
      <CosmicGuideWindow />
    </>
  )
}

