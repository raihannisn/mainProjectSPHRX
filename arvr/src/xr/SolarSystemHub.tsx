import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, IcosahedronGeometry, MeshBasicMaterial, SphereGeometry, Vector3, type Group, type Mesh } from 'three'
import { BODIES, BODY_BY_ID, type BodyInfo } from './bodies'
import { hasContent } from './content'
import { useXRApp } from './store'
import { useDwellTarget } from './dwell'
import { FONT, FONT_BOLD } from './font'
import { SceneReady } from './smooth'
import { useT } from './i18n'
import { useQuality } from './quality'
import { unlockAgentSpeech } from './agentSpeech'
import { currentDate, PLAY_DAYS_PER_SECOND, useTime } from './timeMachine'
import { helioPosition, moonOffset, moonPath, orbitPathAU } from './ephemeris'
import { HOLO, HOLO_STYLES, HoloMotes, HoloOrbitPath, HoloSun, holoUniforms, makeHoloPlanetMaterial } from './holo'

/** Earth-Moon distance on the chart: just clear of Earth (the real 0.0026 AU would sit inside the globe) */
const MOON_DISTANCE = 0.095

/**
 * Every body sits on its REAL orbit (JPL elements, ./ephemeris): an ellipse with the Sun at a focus, tilted by
 * the real inclination, traversed at the real relative speed (fast at perihelion, slow at aphelion). The chart
 * runs a clock SIM_DAYS_PER_SECOND faster than real time, so Mercury laps the Sun in about 13 s while Neptune
 * barely moves. Each orbit is scaled by ONE factor (`orbitScale`) that compresses its size like ./bodies does
 * for distance, so its shape (eccentricity, direction of perihelion, tilt) is exactly NASA's.
 * Ecliptic (x, y, z) maps to hub (x, z, -y): y is up, longitude grows counter-clockwise seen from above.
 */
const SIM_DAYS_PER_SECOND = 7
/** Saturn's rings are tilted 26.7 degrees to its orbit */
const SATURN_TILT = (26.73 * Math.PI) / 180
/** hub-unit factor that turns an orbit in AU into its compressed size on the chart (1 for bodies without one) */
const orbitScale = (b: BodyInfo) => (b.au > 0 ? b.orbit / b.au : 1)

/** Body picker, drawn as a mission-control chart of the real Solar System on a compressed scale. */
export function SolarSystemHub({ tilt = 0 }: { tilt?: number }) {
  const t = useT()
  const q = useQuality()
  const root = useRef<Group>(null)
  const hovered = useXRApp((s) => s.hoveredId)
  const groups = useRef<Record<string, Group | null>>({})
  // shown position per body, easing toward the real one so scrubbing the date glides instead of jumping
  const shown = useRef<Record<string, Vector3>>({})
  const scratch = useMemo(() => new Vector3(), [])
  const orbitElapsed = useRef(0)
  // the real orbits, drawn once (planet elements drift by arcseconds per year: today's are fine)
  const paths = useMemo(() => {
    const now = Date.now()
    return BODIES.filter((b) => b.orbit > 0 && !b.parent).map((b) => {
      const au = orbitPathAU(b.id, now) ?? []
      const k = orbitScale(b)
      const points: number[] = []
      for (let i = 0; i < au.length; i += 3) points.push(au[i] * k, au[i + 2] * k, -au[i + 1] * k)
      return { id: b.id, points }
    })
  }, [])
  const moonLoop = useMemo(() => {
    const m = moonPath()
    const points: number[] = []
    for (let i = 0; i < m.length; i += 3) points.push(m[i] * MOON_DISTANCE, m[i + 2] * MOON_DISTANCE, -m[i + 1] * MOON_DISTANCE)
    return points
  }, [])

  useFrame(({ clock }, dt) => {
    // the Sun sits at the hub centre: planets are lit from there
    root.current?.getWorldPosition(holoUniforms.uSun.value)
    holoUniforms.uTime.value = clock.elapsedTime
    const time = useTime.getState()
    if (time.playing && time.date !== null) time.setDate(time.date + Math.min(dt, 0.1) * PLAY_DAYS_PER_SECOND * 86400000)
    const hoverSlow = hovered?.startsWith('hub:') ? 0.2 : 1
    orbitElapsed.current += Math.min(dt, 0.1) * hoverSlow
    // real orbital motion, sped up: every body is asked where it is `simDays` after the chosen date
    const date = currentDate() + orbitElapsed.current * SIM_DAYS_PER_SECOND * 86400000
    BODIES.forEach((b) => {
      const g = groups.current[b.id]
      if (!g || b.parent || b.orbit === 0) return
      const au = helioPosition(b.id, date)
      if (!au) return
      const k = orbitScale(b)
      scratch.set(au[0] * k, au[2] * k, -au[1] * k)
      let cur = shown.current[b.id]
      if (!cur) cur = shown.current[b.id] = scratch.clone()
      else if (time.playing || time.date === null) cur.copy(scratch)
      else cur.lerp(scratch, Math.min(1, dt * 6))
      g.position.copy(cur)
    })
    void clock
    for (const b of BODIES) {
      const g = groups.current[b.id]
      const p = b.parent ? groups.current[b.parent] : null
      if (g && p) {
        const m = moonOffset(date / 86400000)
        g.position.set(p.position.x + m[0] * MOON_DISTANCE, p.position.y + m[2] * MOON_DISTANCE, p.position.z - m[1] * MOON_DISTANCE)
      }
    }
  })

  return (
    <group ref={root} rotation={[tilt, 0, 0]}>
      <SceneReady />
      <CosmicStarfield />
      <ZodiacConstellations />
      <ShootingMeteors />
      {paths.map((o) => {
        const b = BODY_BY_ID[o.id]
        return <HoloOrbitPath key={`orbit-${o.id}`} points={o.points} color={b.kind === 'asteroid' ? HOLO.amber : hasContent(b.id) ? HOLO.teal : HOLO.violet} active={hovered === `hub:${o.id}`} />
      })}
      <HoloMotes q={q} />
      <MessagePulse groups={groups} />
      {BODIES.map((b, i) => (
        <group key={b.id} ref={(g) => void (groups.current[b.id] = g)}>
          <HubBody b={b} order={i} />
          {b.id === 'earth' && <HoloOrbitPath points={moonLoop} color={HOLO.teal} active={hovered === 'hub:moon'} />}
        </group>
      ))}
      <Billboard position={[0, 0.95, 0]}>
        <Text font={FONT_BOLD} fontSize={0.2} letterSpacing={0.04} color="#ffffff" anchorY="bottom" outlineWidth={0.004} outlineColor="#000">
          {t('Choose a destination')}
        </Text>
        <Text font={FONT} position={[0, -0.04, 0]} fontSize={0.085} color={HOLO.amber} anchorY="top">
          {t('Real orbits (JPL elements) · distances and sizes compressed')}
        </Text>
      </Billboard>
    </group>
  )
}

/** 1. 3D Cosmic Starfield: twinkling points spanning the deep background */
function CosmicStarfield() {
  const pointsRef = useRef<any>(null)
  const { positions, colors } = useMemo(() => {
    const count = 1200
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const palette = [
      new Color('#e0f2fe'),
      new Color('#ffffff'),
      new Color('#fef08a'),
      new Color('#a5f3fc'),
      new Color('#e9d5ff'),
    ]

    for (let i = 0; i < count; i++) {
      const u = Math.random()
      const v = Math.random()
      const theta = u * 2.0 * Math.PI
      const phi = Math.acos(2.0 * v - 1.0)
      const r = 28 + Math.random() * 26

      const sinPhi = Math.sin(phi)
      pos[i * 3] = r * sinPhi * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.78
      pos[i * 3 + 2] = r * sinPhi * Math.sin(theta)

      const c = palette[i % palette.length]
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    return { positions: pos, colors: col }
  }, [])

  const geometry = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    geo.setAttribute('color', new BufferAttribute(colors, 3))
    return geo
  }, [positions, colors])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.elapsedTime * 0.0012
    }
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.15}
        vertexColors
        transparent
        opacity={0.8}
        depthWrite={false}
        blending={AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}

/** 2. 13 Zodiac Constellations: subtle star lines & markers along the ecliptic band */
interface ZodiacDef {
  name: string
  pts: [number, number][]
  edges: [number, number][]
}

const ZODIAC_13: ZodiacDef[] = [
  {
    name: 'Aries',
    pts: [[-0.9, 0.4], [-0.2, 0.55], [0.5, 0.25], [1.1, -0.2]],
    edges: [[0, 1], [1, 2], [2, 3]],
  },
  {
    name: 'Taurus',
    pts: [[0, 0], [-0.5, 0.45], [0.5, 0.45], [-1.0, 1.1], [1.1, 1.2], [-0.3, -0.6]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [0, 5]],
  },
  {
    name: 'Gemini',
    pts: [[-0.6, 1.1], [-0.6, 0.3], [-0.7, -0.7], [0.6, 1.0], [0.6, 0.2], [0.7, -0.7]],
    edges: [[0, 1], [1, 2], [3, 4], [4, 5], [1, 4]],
  },
  {
    name: 'Cancer',
    pts: [[0, 0.2], [-0.7, 0.7], [0.7, 0.7], [0, -0.8]],
    edges: [[0, 1], [0, 2], [0, 3]],
  },
  {
    name: 'Leo',
    pts: [[0.8, 0.6], [1.1, 0.9], [0.9, 1.3], [0.4, 1.2], [0.3, 0.6], [0.3, 0], [-0.6, -0.2], [-1.2, 0.3], [-0.6, -0.7]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [6, 8], [5, 8]],
  },
  {
    name: 'Virgo',
    pts: [[0, 1.2], [0.5, 0.6], [-0.5, 0.5], [0, 0], [0.8, -0.6], [-0.7, -0.8], [0, -1.2]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6]],
  },
  {
    name: 'Libra',
    pts: [[0, 0.8], [-0.9, 0.2], [0.9, 0.2], [-0.9, -0.6], [0.9, -0.6]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [1, 2]],
  },
  {
    name: 'Scorpius',
    pts: [[0.9, 0.8], [0.5, 0.6], [0.2, 0.2], [-0.1, -0.3], [-0.4, -0.8], [-0.8, -1.0], [-1.1, -0.6], [-0.9, -0.2]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
  },
  {
    name: 'Ophiuchus',
    pts: [[0, 1.2], [-0.8, 0.5], [0.8, 0.5], [-0.9, -0.7], [0.9, -0.7], [-1.4, 0], [1.4, 0]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [1, 5], [2, 6]],
  },
  {
    name: 'Sagittarius',
    pts: [[-0.2, 0.7], [-0.6, 0.2], [0.2, 0.2], [-0.8, -0.5], [0.4, -0.5], [0.9, -0.1], [-1.2, 0.1]],
    edges: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4], [2, 5], [4, 5], [1, 6], [3, 6]],
  },
  {
    name: 'Capricornus',
    pts: [[-1.1, 0.6], [-0.3, 0.4], [0.8, 0.7], [1.1, 0.2], [0.3, -0.7], [-0.8, -0.5]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 4]],
  },
  {
    name: 'Aquarius',
    pts: [[-0.8, 0.8], [-0.3, 0.7], [0.3, 0.9], [0.8, 0.7], [-0.7, 0.1], [-0.1, -0.1], [0.5, 0.1], [1.0, -0.1], [-0.5, -0.6], [0.1, -0.8], [0.7, -0.6]],
    edges: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [8, 9], [9, 10], [1, 4], [5, 8]],
  },
  {
    name: 'Pisces',
    pts: [[0, -0.9], [-0.7, -0.2], [-1.1, 0.6], [-0.7, 1.0], [-1.3, 1.0], [0.6, -0.1], [0.9, 0.6], [1.3, 0.8], [0.9, 1.1]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 2], [0, 5], [5, 6], [6, 7], [7, 8], [8, 6]],
  },
]

function ZodiacConstellations() {
  const R = 36
  const scale = 2.2

  const { linePositions, starPositions, labelCenters } = useMemo(() => {
    const lPos: number[] = []
    const sPos: number[] = []
    const centers: Array<{ name: string; pos: [number, number, number] }> = []

    const N = ZODIAC_13.length
    for (let i = 0; i < N; i++) {
      const z = ZODIAC_13[i]
      const angle = (i / N) * Math.PI * 2
      const cx = Math.cos(angle) * R
      const cy = Math.sin(angle * 2.0) * 3.2
      const cz = Math.sin(angle) * R

      const tangent = [-Math.sin(angle), 0, Math.cos(angle)]
      const up = [0, 1, 0]

      const transformedPts: Array<[number, number, number]> = z.pts.map(([u, v]) => [
        cx + tangent[0] * u * scale + up[0] * v * scale,
        cy + tangent[1] * u * scale + up[1] * v * scale,
        cz + tangent[2] * u * scale + up[2] * v * scale,
      ])

      transformedPts.forEach(([x, y, zCoord]) => sPos.push(x, y, zCoord))

      z.edges.forEach(([idxA, idxB]) => {
        const a = transformedPts[idxA]
        const b = transformedPts[idxB]
        if (a && b) {
          lPos.push(a[0], a[1], a[2], b[0], b[1], b[2])
        }
      })

      centers.push({
        name: z.name,
        pos: [cx + up[0] * 3.2, cy + up[1] * 3.2, cz + up[2] * 3.2],
      })
    }

    return {
      linePositions: new Float32Array(lPos),
      starPositions: new Float32Array(sPos),
      labelCenters: centers,
    }
  }, [R, scale])

  const lineGeo = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(linePositions, 3))
    return g
  }, [linePositions])

  const starGeo = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(starPositions, 3))
    return g
  }, [starPositions])

  useEffect(() => () => {
    lineGeo.dispose()
    starGeo.dispose()
  }, [lineGeo, starGeo])

  return (
    <group>
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.18} depthWrite={false} blending={AdditiveBlending} />
      </lineSegments>
      <points geometry={starGeo}>
        <pointsMaterial size={0.24} color="#a5f3fc" transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} sizeAttenuation />
      </points>
      {labelCenters.map((lbl, idx) => (
        <Billboard key={idx} position={lbl.pos}>
          <Text font={FONT} fontSize={0.28} letterSpacing={0.06} color="#7dd3fc" fillOpacity={0.28} anchorY="middle">
            {lbl.name.toUpperCase()}
          </Text>
        </Billboard>
      ))}
    </group>
  )
}

/** 3. Shooting Meteors: fast animated streaks occasionally traversing the sky */
function ShootingMeteors() {
  const meteors = useRef([
    { pos: new Vector3(-24, 12, -18), dir: new Vector3(1, -0.4, 0.7).normalize(), speed: 24, life: 0, maxLife: 1.1, delay: 1 },
    { pos: new Vector3(18, 15, -24), dir: new Vector3(-0.9, -0.5, 0.5).normalize(), speed: 26, life: 0, maxLife: 0.95, delay: 5 },
  ])

  const positions = useMemo(() => new Float32Array(meteors.current.length * 6), [])
  const geom = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    return g
  }, [positions])

  useEffect(() => () => geom.dispose(), [geom])

  useFrame((_, dt) => {
    const p = positions
    meteors.current.forEach((m, idx) => {
      m.delay -= dt
      if (m.delay <= 0) {
        m.life += dt
        if (m.life >= m.maxLife) {
          m.life = 0
          m.delay = 3.5 + Math.random() * 5.5
          const angle = Math.random() * Math.PI * 2
          m.pos.set(Math.cos(angle) * 32, 9 + Math.random() * 12, Math.sin(angle) * 32)
          m.dir.set(-Math.cos(angle) * 0.7 + (Math.random() - 0.5), -0.5 - Math.random() * 0.4, -Math.sin(angle) * 0.7 + (Math.random() - 0.5)).normalize()
          m.speed = 22 + Math.random() * 8
        } else {
          m.pos.addScaledVector(m.dir, m.speed * dt)
        }
      }

      const active = m.delay <= 0 && m.life < m.maxLife
      const head = m.pos
      const tailLen = active ? 2.8 : 0
      const tail = head.clone().addScaledVector(m.dir, -tailLen)

      p[idx * 6] = head.x
      p[idx * 6 + 1] = head.y
      p[idx * 6 + 2] = head.z
      p[idx * 6 + 3] = tail.x
      p[idx * 6 + 4] = tail.y
      p[idx * 6 + 5] = tail.z
    })
    geom.attributes.position.needsUpdate = true
  })

  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.65} depthWrite={false} blending={AdditiveBlending} />
    </lineSegments>
  )
}

const unitSphere = new SphereGeometry(1, 48, 32)
/** Bennu as a faceted little rubble pile, so it reads as an asteroid at a glance. */
const facetRock = (() => {
  const g = new IcosahedronGeometry(1, 1).toNonIndexed()
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const k = 0.85 + 0.15 * Math.sin(x * 5.1 + y * 3.7 + z * 4.3)
    p.setXYZ(i, x * k, y * k * 0.92, z * k)
  }
  g.computeVertexNormals()
  return g
})()

/** Rotating dashed ring: "you can go here". */
function ExploreMarker({ radius }: { radius: number }) {
  const ref = useRef<Group>(null)
  const geom = useMemo(() => {
    const pts: number[] = []
    const N = 24
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 0.55) / N) * Math.PI * 2
      pts.push(Math.cos(a0) * radius, 0, Math.sin(a0) * radius, Math.cos(a1) * radius, 0, Math.sin(a1) * radius)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3))
    return g
  }, [radius])
  useEffect(() => () => geom.dispose(), [geom])
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.5
  })
  return (
    <group ref={ref} rotation={[0.25, 0, 0]}>
      <lineSegments geometry={geom}>
        <lineBasicMaterial color={HOLO.teal} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </lineSegments>
    </group>
  )
}

/** easeOutBack: a little overshoot, so bodies "pop" into place */
const backOut = (x: number) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2)
const REDUCED = false

function HubBody({ b, order }: { b: BodyInfo; order: number }) {
  const born = useRef(-1)
  const t = useT()
  const [hover, setHover] = useState(false)
  const labels = useXRApp((s) => s.settings.labels)
  const hit = useRef<Mesh>(null)
  const spin = useRef<Group>(null)
  const explorable = hasContent(b.id)
  const select = useCallback(() => useXRApp.getState().selectBody(b.id), [b.id])
  useDwellTarget(hit, select, b.id !== 'sun')
  const style = HOLO_STYLES[b.id]
  const material = useMemo(() => (style ? makeHoloPlanetMaterial(style) : null), [style])
  useEffect(() => () => material?.dispose(), [material])
  const scale = useRef(1)
  useFrame(({ clock }, dt) => {
    const s = spin.current
    if (!s) return
    if (born.current < 0) born.current = clock.elapsedTime
    s.rotation.y += dt * 0.3
    scale.current += ((hover ? 1.25 : 1) - scale.current) * Math.min(1, dt * 10)
    // staggered entrance (Sun first, then outward) and a gentle idle float
    const k = REDUCED ? 1 : Math.min(1, Math.max(0, (clock.elapsedTime - born.current - 0.15 - order * 0.07) / 0.55))
    s.scale.setScalar(scale.current * (k >= 1 ? 1 : Math.max(0.0001, backOut(k))))
    s.position.y = REDUCED ? 0 : Math.sin(clock.elapsedTime * 0.7 + order * 1.3) * 0.012
    if (material) material.uniforms.uHover.value += ((hover ? 1 : 0) - material.uniforms.uHover.value) * Math.min(1, dt * 8)
  })
  const r = Math.max(b.size, 0.03)
  const small = b.size < 0.06

  return (
    <group>
      {b.kind === 'star' && <HoloSun radius={b.size} />}
      <group ref={spin}>
        {material && <mesh geometry={style?.facets ? facetRock : unitSphere} material={material} scale={b.size} />}
        {b.rings && (
          <mesh rotation={[-Math.PI / 2 + SATURN_TILT, 0, 0]}>
            <ringGeometry args={[b.size * 1.24, b.size * 2.27, 64]} />
            <meshBasicMaterial color="#e8d3a0" side={DoubleSide} transparent opacity={0.45} toneMapped={false} />
          </mesh>
        )}
      </group>
      {explorable && <ExploreMarker radius={r * 1.7} />}
      <mesh
        ref={hit}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          useXRApp.getState().setHovered(`hub:${b.id}`)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          if (useXRApp.getState().hoveredId === `hub:${b.id}`) useXRApp.getState().setHovered(null)
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          e.stopPropagation()
          unlockAgentSpeech()
          select()
        }}
      >
        <sphereGeometry args={[Math.max(b.size * 1.5, 0.075), 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Billboard position={[0, -r - 0.035, 0]}>
        <Text
          font={FONT_BOLD}
          fillOpacity={hover ? 1 : labels}
          outlineOpacity={hover ? 1 : labels}
          visible={hover || labels > 0.02}
          fontSize={hover ? 0.1 : small ? 0.048 : 0.075}
          letterSpacing={0.08}
          color={explorable ? HOLO.teal : '#c7cde6'}
          anchorY="top"
          outlineWidth={0.004}
          outlineColor="#000"
        >
          {t(b.name).toUpperCase()}
        </Text>
        {explorable && (
          <Text font={FONT} position={[0, hover || !small ? -0.075 : -0.05, 0]} fillOpacity={hover ? 1 : labels * 0.85} visible={hover || labels > 0.02} fontSize={small && !hover ? 0.03 : 0.042} color="#e9f7f5" anchorY="top" outlineWidth={0.003} outlineColor="#000">
            {hover ? `▶ ${t('explore')}` : t('explore')}
          </Text>
        )}
      </Billboard>
    </group>
  )
}

/** "Send a message to Mars": a glowing pulse travels from Earth to Mars (shown 60× faster than light). */
function MessagePulse({ groups }: { groups: React.RefObject<Record<string, Group | null>> }) {
  const dot = useRef<Mesh>(null)
  const ring = useRef<Mesh>(null)
  const v = useMemo(() => new Vector3(), [])
  useFrame(() => {
    const m = useTime.getState().message
    const d = dot.current, r = ring.current
    if (!d || !r) return
    const earth = groups.current?.earth, mars = groups.current?.mars
    if (!m || !earth || !mars) {
      d.visible = r.visible = false
      return
    }
    const k = (performance.now() - m.sentAt) / m.durationMs
    d.visible = k < 1
    if (k < 1) d.position.copy(v.copy(earth.position).lerp(mars.position, k))
    // arrival flash on Mars, then clear
    r.visible = k >= 1 && k < 1.6
    if (r.visible) {
      r.position.copy(mars.position)
      r.scale.setScalar(0.05 + (k - 1) * 0.4)
      ;(r.material as MeshBasicMaterial).opacity = 1 - (k - 1) / 0.6
    }
    if (k >= 1.6) useTime.setState({ message: null })
  })
  return (
    <>
      <mesh ref={dot} visible={false}>
        <sphereGeometry args={[0.022, 12, 8]} />
        <meshBasicMaterial color={HOLO.teal} toneMapped={false} />
      </mesh>
      <mesh ref={ring} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1, 32]} />
        <meshBasicMaterial color={HOLO.teal} transparent toneMapped={false} depthWrite={false} side={DoubleSide} />
      </mesh>
    </>
  )
}
