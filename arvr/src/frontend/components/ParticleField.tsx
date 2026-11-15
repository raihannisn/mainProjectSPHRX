import { useMemo } from 'react'

export interface ParticleFieldProps {
  count?: number
  variant?: 'full' | 'bottom'
  className?: string
}

export function ParticleField({ count = 130, variant = 'full', className = '' }: ParticleFieldProps) {
  const particles = useMemo(() => {
    const isBottom = variant === 'bottom'
    return Array.from({ length: count }).map((_, i) => {
      // For bottom variant, cluster particles heavily at the bottom (y: 60% to 110%)
      const y = isBottom
        ? Math.random() * 55 + 55
        : Math.random() * 110 + 5

      // Varied colors: 0=cyan, 1=gold, 2=electric sky-blue, 3=white, 4=sapphire blue
      const colorTier = i % 5

      return {
        id: i,
        x: `${(Math.random() * 100).toFixed(2)}%`,
        y: `${y.toFixed(2)}%`,
        size: `${(Math.random() * 2.4 + 1.0).toFixed(1)}px`,
        duration: `${(Math.random() * 14 + (isBottom ? 9 : 14)).toFixed(1)}s`,
        delay: `${(-Math.random() * 28).toFixed(1)}s`,
        drift: `${(Math.random() * 80 - 40).toFixed(1)}px`,
        colorTier,
      }
    })
  }, [count, variant])

  const rootClass = [
    'fe-particle-field',
    variant === 'bottom' ? 'fe-particle-field--bottom' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClass} aria-hidden="true">
      {particles.map((p) => (
        <i
          key={p.id}
          className={`fe-particle fe-particle--c${p.colorTier}`}
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
