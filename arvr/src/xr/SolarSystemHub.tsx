import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, IcosahedronGeometry, MeshBasicMaterial, SphereGeometry, Vector3, type Group, type Mesh } from 'three'
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
