import { useMemo } from 'react'

export function ParticleField() {
  const particles = useMemo(() => {
    return Array.from({ length: 54 }).map((_, i) => ({
      id: i,
      x: `${Math.random() * 100}%`,
      y: `${Math.random() * 110 + 10}%`,
      size: `${Math.random() * 2 + 1}px`,
      duration: `${Math.random() * 18 + 15}s`,
      delay: `${-Math.random() * 32}s`,
      drift: `${Math.random() * 100 - 50}px`,
    }))
  }, [])

  return (
    <div className="fe-particle-field" aria-hidden="true">
      {particles.map((p) => (
        <i
          key={p.id}
          className="fe-particle"
          style={
            {
              '--x': p.x,
              '--y': p.y,
              '--size': p.size,
              '--duration': p.duration,
              '--delay': p.delay,
              '--drift': p.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

