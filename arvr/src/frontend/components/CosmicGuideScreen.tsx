import { useParams } from 'react-router-dom'
import { TopBar } from './TopBar'
import { ParticleField } from './ParticleField'
import { CosmicGuideWindow } from './CosmicGuideWindow'

export function CosmicGuideScreen() {
  const { objectId } = useParams<{ objectId?: string }>()

  return (
    <div className="fe-app">
      <ParticleField />
      <TopBar />
      <main className="fe-guide-container">
        <CosmicGuideWindow fullPage initialObjectId={objectId} />
      </main>
    </div>
  )
}
