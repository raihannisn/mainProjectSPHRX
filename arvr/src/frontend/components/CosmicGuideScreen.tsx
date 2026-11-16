import { useNavigate, useParams } from 'react-router-dom'
import { TopBar } from './TopBar'
import { ParticleField } from './ParticleField'
import { CosmicGuideWindow } from './CosmicGuideWindow'

export function CosmicGuideScreen() {
  const { objectId } = useParams<{ objectId?: string }>()
  const navigate = useNavigate()

  // Return to wherever the Guide was opened from; fall back to the Sky Explorer on a direct visit.
  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/explorer')
  }

  return (
    <div className="fe-app">
      <ParticleField />
      <TopBar />
      <main className="fe-guide-container">
        <CosmicGuideWindow fullPage initialObjectId={objectId} onBack={goBack} />
      </main>
    </div>
  )
}
