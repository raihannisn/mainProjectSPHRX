import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useXRApp } from '../../xr/store'

interface PlanetConfig {
  id: string
  name: { en: string; id: string }
  desc: { en: string; id: string }
  orbitRadius: number
  size: number
  speed: number // Keplerian relative speed (Mercury fastest, Neptune slowest)
  rotationSpeed: number // axial spin speed
  textureType: 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune'
  trailColor: string // Saturated neon comic speedline trail color
  hasRings?: boolean
  tilt?: number // axial tilt in radians
  hasMoon?: boolean
}

// Stylized / Cartoon CGI Planet Configurations (Spider-Verse / Anime Palette)
const PLANETS: PlanetConfig[] = [
  {
    id: 'mercury',
    name: { en: 'Mercury', id: 'Merkurius' },
    desc: { en: '0.39 AU · Terrestrial Cratered World', id: '0.39 AU · Planet Terestrial Berbatu' },
    orbitRadius: 2.6,
    size: 0.24,
    speed: 3.2,
    rotationSpeed: 0.015,
    textureType: 'mercury',
    trailColor: '#94a3b8',
    tilt: 0.03,
  },
  {
    id: 'venus',
    name: { en: 'Venus', id: 'Venus' },
    desc: { en: '0.72 AU · Dense Sulfuric Atmosphere', id: '0.72 AU · Atmosfer Tebal & Panas' },
    orbitRadius: 3.8,
    size: 0.38,
    speed: 2.1,
    rotationSpeed: -0.008,
    textureType: 'venus',
    trailColor: '#facc15', // Vibrant golden-yellow
    tilt: 3.1,
  },
  {
    id: 'earth',
    name: { en: 'Earth & Moon', id: 'Bumi & Bulan' },
    desc: { en: '1.00 AU · Habitable Zone & Oceans', id: '1.00 AU · Zona Layak Huni & Lautan' },
    orbitRadius: 5.2,
    size: 0.42,
    speed: 1.5,
    rotationSpeed: 0.02,
    textureType: 'earth',
    trailColor: '#38bdf8', // Electric sky-blue
    hasMoon: true,
    tilt: 0.41,
  },
  {
    id: 'mars',
    name: { en: 'Mars', id: 'Mars' },
    desc: { en: '1.52 AU · Iron Oxide Crust & Polar Caps', id: '1.52 AU · Kerak Oksida Besi & Es Kutub' },
    orbitRadius: 6.6,
    size: 0.32,
    speed: 1.15,
    rotationSpeed: 0.018,
    textureType: 'mars',
    trailColor: '#ef4444', // Fiery cartoon red
    tilt: 0.44,
  },
  {
    id: 'jupiter',
    name: { en: 'Jupiter', id: 'Jupiter' },
    desc: { en: '5.20 AU · Largest Gas Giant & Storms', id: '5.20 AU · Raksasa Gas Terbesar' },
    orbitRadius: 8.6,
    size: 1.05, // Distinctly largest planet
    speed: 0.68,
    rotationSpeed: 0.035,
    textureType: 'jupiter',
    trailColor: '#f97316', // Vibrant comic orange
    tilt: 0.05,
  },
  {
    id: 'saturn',
    name: { en: 'Saturn', id: 'Saturnus' },
    desc: { en: '9.58 AU · Ice & Rock Ring System', id: '9.58 AU · Sistem Cincin Es & Batuan' },
    orbitRadius: 11.0,
    size: 0.86, // Second largest planet with rings
    speed: 0.48,
    rotationSpeed: 0.03,
    textureType: 'saturn',
    trailColor: '#fde047', // Glowing anime gold
    hasRings: true,
    tilt: 0.47,
  },
  {
    id: 'uranus',
    name: { en: 'Uranus', id: 'Uranus' },
    desc: { en: '19.2 AU · Aquamarine Ice Giant', id: '19.2 AU · Raksasa Es Akwamarin' },
    orbitRadius: 13.2,
    size: 0.54,
    speed: 0.34,
    rotationSpeed: -0.02,
    textureType: 'uranus',
    trailColor: '#2dd4bf', // Luminous mint-cyan
    tilt: 1.7,
  },
  {
    id: 'neptune',
    name: { en: 'Neptune', id: 'Neptunus' },
    desc: { en: '30.1 AU · Deep Azure Supersonic Winds', id: '30.1 AU · Raksasa Es Terluar' },
    orbitRadius: 15.2,
    size: 0.52,
    speed: 0.24, // Slowest
    rotationSpeed: 0.022,
    textureType: 'neptune',
    trailColor: '#3b82f6', // Electric anime sapphire blue
    tilt: 0.5,
  },
]

// Stylized / Cartoon CGI Texture Generators (Clean, Vibrant, Graphic Pop)
function createSunTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  // Vibrant comic gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#fffbeb')
  grad.addColorStop(0.2, '#fde047')
  grad.addColorStop(0.5, '#f59e0b')
  grad.addColorStop(0.8, '#ea580c')
  grad.addColorStop(1, '#fffbeb')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 512, 256)

  // Graphic stylized sun spots / solar energy pulses
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * 512
    const y = Math.random() * 256
    const r = 8 + Math.random() * 24
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

function createSunGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, 'rgba(255, 255, 240, 1)')
  grad.addColorStop(0.2, 'rgba(253, 224, 71, 0.85)')
  grad.addColorStop(0.48, 'rgba(249, 115, 22, 0.35)')
  grad.addColorStop(0.8, 'rgba(234, 88, 12, 0.08)')
  grad.addColorStop(1, 'rgba(234, 88, 12, 0)')

  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 256)

  return new THREE.CanvasTexture(canvas)
}

function createSaturnRingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 16
  const ctx = canvas.getContext('2d')!

  // Saturated cartoon comic ring bands
  const grad = ctx.createLinearGradient(0, 0, 256, 0)
  grad.addColorStop(0, 'rgba(250, 204, 21, 0.15)')
  grad.addColorStop(0.12, 'rgba(254, 240, 138, 0.95)')
  grad.addColorStop(0.35, 'rgba(250, 204, 21, 0.95)')
  grad.addColorStop(0.58, 'rgba(245, 158, 11, 0.9)')
  // Cassini Division: crisp dark cartoon dividing gap
  grad.addColorStop(0.68, 'rgba(15, 23, 42, 0.15)')
  grad.addColorStop(0.72, 'rgba(15, 23, 42, 0.15)')
  // Outer luminous ring band
  grad.addColorStop(0.78, 'rgba(253, 224, 71, 0.85)')
  grad.addColorStop(0.95, 'rgba(245, 158, 11, 0.6)')
  grad.addColorStop(1, 'rgba(245, 158, 11, 0)')

  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 16)

  return new THREE.CanvasTexture(canvas)
}

function createPlanetTexture(type: PlanetConfig['textureType']): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!

  if (type === 'mercury') {
    // Saturated slate-silver with clean cartoon polygon craters
    ctx.fillStyle = '#94a3b8'
    ctx.fillRect(0, 0, 256, 128)
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#64748b' : '#cbd5e1'
      ctx.beginPath()
      ctx.arc(Math.random() * 256, Math.random() * 128, 3 + Math.random() * 8, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (type === 'venus') {
    // Saturated sunny butter-yellow with graphic warm amber ribbons
    ctx.fillStyle = '#fef08a'
    ctx.fillRect(0, 0, 256, 128)
    ctx.fillStyle = '#facc15'
    for (let y = 12; y < 120; y += 22) {
      ctx.fillRect(0, y, 256, 9)
    }
    ctx.fillStyle = '#f59e0b'
    for (let y = 28; y < 110; y += 32) {
      ctx.fillRect(0, y, 256, 4)
    }
  } else if (type === 'earth') {
    // Vibrant cartoon azure ocean, bright emerald continents, crisp cloud arcs
    ctx.fillStyle = '#0ea5e9' // Pop blue ocean
    ctx.fillRect(0, 0, 256, 128)

    // Bold green continents
    ctx.fillStyle = '#22c55e'
    const continents = [
      { x: 50, y: 45, r: 26 },
      { x: 75, y: 80, r: 22 },
      { x: 145, y: 40, r: 30 },
      { x: 175, y: 60, r: 24 },
      { x: 205, y: 85, r: 20 },
    ]
    for (const c of continents) {
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Crisp stylized white comic cloud arcs
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.ellipse(30 + i * 50, 25 + (i % 2) * 55, 36, 6, 0.15, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (type === 'mars') {
    // Saturated fiery cartoon red with crimson volcanic patches and white ice cap
    ctx.fillStyle = '#ef4444' // Vivid red
    ctx.fillRect(0, 0, 256, 128)
    ctx.fillStyle = '#b91c1c' // Deep crimson shadow bands
    for (let i = 0; i < 10; i++) {
      ctx.beginPath()
      ctx.ellipse(Math.random() * 256, 30 + Math.random() * 68, 30, 14, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // Crisp white polar ice caps
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 256, 10)
    ctx.fillRect(0, 118, 256, 10)
  } else if (type === 'jupiter') {
    // Saturated comic bands in tangerine, yellow, cream, deep rust
    const bands = [
      '#fffbeb', '#f97316', '#fde047', '#c2410c', '#fef08a',
      '#ea580c', '#fffbeb', '#fb923c', '#eab308',
    ]
    const step = 128 / bands.length
    bands.forEach((color, i) => {
      ctx.fillStyle = color
      ctx.fillRect(0, i * step, 256, step + 1)
    })
    // Iconic comic Great Red Spot
    ctx.fillStyle = '#dc2626'
    ctx.beginPath()
    ctx.ellipse(170, 78, 20, 11, -0.05, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(170, 78, 6, 3, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (type === 'saturn') {
    // Saturated golden honey cartoon stripes
    const bands = ['#fef08a', '#facc15', '#fde047', '#eab308', '#fef9c3', '#ca8a04', '#facc15']
    const step = 128 / bands.length
    bands.forEach((color, i) => {
      ctx.fillStyle = color
      ctx.fillRect(0, i * step, 256, step + 1)
    })
  } else if (type === 'uranus') {
    // Saturated cartoon mint/aquamarine with soft cyan stripes
    ctx.fillStyle = '#2dd4bf'
    ctx.fillRect(0, 0, 256, 128)
    ctx.fillStyle = '#5eead4'
    for (let y = 18; y < 120; y += 26) {
      ctx.fillRect(0, y, 256, 8)
    }
  } else if (type === 'neptune') {
    // Electric anime royal sapphire blue with vivid sky-blue storm streaks
    ctx.fillStyle = '#2563eb'
    ctx.fillRect(0, 0, 256, 128)
    ctx.fillStyle = '#1d4ed8'
    for (let y = 22; y < 115; y += 30) {
      ctx.fillRect(0, y, 256, 10)
    }
    // Neon electric storm streaks
    ctx.fillStyle = '#38bdf8'
    ctx.fillRect(35, 48, 80, 5)
    ctx.fillRect(145, 78, 65, 4)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  return tex
}

export function SolarSystem3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const hudTitleRef = useRef<HTMLSpanElement>(null)
  const hudDescRef = useRef<HTMLSpanElement>(null)
  const lang = useXRApp((s) => s.settings.lang)
  const langRef = useRef(lang)

  useEffect(() => {
    langRef.current = lang
  }, [lang])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let width = container.clientWidth || 500
    let height = container.clientHeight || 500

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x030712, 0.01)

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 250)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(width, height)
    // Requirement 5: limit pixel ratio so FPS stays rock-solid at 60 FPS
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.25 // Vibrant, bright comic exposure
    container.appendChild(renderer.domElement)

    // Master group tilted slightly for dramatic orbital presentation
    const solarGroup = new THREE.Group()
    solarGroup.rotation.x = 0.26
    solarGroup.rotation.z = -0.04
    solarGroup.scale.set(0.92, 0.92, 0.92)
    scene.add(solarGroup)

    // 2. Background Starfield (Requirement 4: Background Tetap)
    const STAR_COUNT = 750
    const starGeometry = new THREE.SphereGeometry(0.048, 5, 5)
    const starMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
    })
    const starfield = new THREE.InstancedMesh(starGeometry, starMaterial, STAR_COUNT)

    const dummy = new THREE.Object3D()
    const colorWhite = new THREE.Color(0xffffff)
    const colorCyan = new THREE.Color(0x38bdf8) // Electric sky-blue
    const colorGold = new THREE.Color(0xfde047) // Warm gold
    const colorIce = new THREE.Color(0xbae6fd)

    for (let i = 0; i < STAR_COUNT; i++) {
      const r = 26 + Math.random() * 50
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      dummy.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      )

      const scale = 0.6 + Math.random() * 1.6
      dummy.scale.set(scale, scale, scale)
      dummy.updateMatrix()
      starfield.setMatrixAt(i, dummy.matrix)

      const roll = Math.random()
      if (roll < 0.55) {
        starfield.setColorAt(i, colorWhite)
      } else if (roll < 0.78) {
        starfield.setColorAt(i, colorIce)
      } else if (roll < 0.9) {
        starfield.setColorAt(i, colorCyan)
      } else {
        starfield.setColorAt(i, colorGold)
      }
    }
    starfield.instanceMatrix.needsUpdate = true
    if (starfield.instanceColor) starfield.instanceColor.needsUpdate = true
    scene.add(starfield)

    // 3. Central Stylized Sun & Corona
    const sunGroup = new THREE.Group()
    solarGroup.add(sunGroup)

    const sunGeo = new THREE.SphereGeometry(1.35, 36, 36)
    const sunTex = createSunTexture()
    const sunMat = new THREE.MeshBasicMaterial({
      map: sunTex,
      color: 0xffffff,
    })
    const sunMesh = new THREE.Mesh(sunGeo, sunMat)
    sunMesh.userData = { isSun: true }
    sunGroup.add(sunMesh)

    // Sun Stylized Glow / Corona Halo Sprites
    const glowTex = createSunGlowTexture()
    const glowMat1 = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xfacc15,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.75,
      depthWrite: false,
    })
    const glowSprite1 = new THREE.Sprite(glowMat1)
    glowSprite1.scale.set(5.2, 5.2, 1)
    sunGroup.add(glowSprite1)

    const glowMat2 = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xf97316,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.38,
      depthWrite: false,
    })
    const glowSprite2 = new THREE.Sprite(glowMat2)
    glowSprite2.scale.set(8.2, 8.2, 1)
    sunGroup.add(glowSprite2)

    // Requirement 2: Pencahayaan Terang (Anti-Gelap)
    // High-intensity AmbientLight so all planets have bright, solid cartoon colors
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.45)
    scene.add(ambientLight)

    // Bright PointLight from the Sun for brilliant celestial radiance
    const sunLight = new THREE.PointLight(0xfffae6, 6.5, 120, 0.1)
    sunGroup.add(sunLight)

    // Directional light from camera angle to ensure front surfaces pop with vibrant contrast
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.65)
    dirLight.position.set(5, 25, 35)
    scene.add(dirLight)

    // 4. Planets, Orbits & Glowing Speedline Trails (Requirements 1 & 3)
    type PlanetRuntime = {
      config: PlanetConfig
      orbitPivot: THREE.Group
      planetMesh: THREE.Mesh
      hitMesh: THREE.Mesh
      ringMesh?: THREE.Mesh
      moonPivot?: THREE.Group
    }

    const planetRuntimes: PlanetRuntime[] = []
    const interactiveMeshes: THREE.Mesh[] = [sunMesh]
    const sphereGeoCache = new Map<number, THREE.SphereGeometry>()

    function getSphereGeo(size: number): THREE.SphereGeometry {
      const key = Math.round(size * 100)
      if (!sphereGeoCache.has(key)) {
        sphereGeoCache.set(key, new THREE.SphereGeometry(size, 32, 24))
      }
      return sphereGeoCache.get(key)!
    }

    const ringTex = createSaturnRingTexture()

    PLANETS.forEach((cfg, index) => {
      // 4A. Subtle Full Orbit Path Guide Ring
      const segments = 120
      const orbitPoints: THREE.Vector3[] = []
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2
        orbitPoints.push(new THREE.Vector3(Math.cos(theta) * cfg.orbitRadius, 0, Math.sin(theta) * cfg.orbitRadius))
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints)
      const orbitMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(cfg.trailColor),
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
      })
      const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat)
      solarGroup.add(orbitLine)

      // 4B. Orbit Pivot (Rotates around Sun)
      const pivot = new THREE.Group()
      pivot.rotation.y = (index * (Math.PI * 2)) / PLANETS.length + (index * 0.45)
      solarGroup.add(pivot)

      // 4C. Requirement 3: Glowing Orbit Trail / Comic Speedline attached behind planet
      // Trails back ~100 degrees behind the planet's head
      const TRAIL_SEGMENTS = 48
      const TRAIL_ANGLE = Math.PI * 0.55 // ~100 degrees trailing arc
      const trailPositions: number[] = []
      const trailColors: number[] = []
      const headColor = new THREE.Color(cfg.trailColor)

      for (let i = 0; i <= TRAIL_SEGMENTS; i++) {
        const fraction = i / TRAIL_SEGMENTS // 0 at planet head, 1 at tail tip
        const angle = -fraction * TRAIL_ANGLE
        const x = Math.cos(angle) * cfg.orbitRadius
        const z = Math.sin(angle) * cfg.orbitRadius
        trailPositions.push(x, 0, z)

        // Comic speedline punchy falloff: bright at head, tapering smoothly to zero
        const alpha = Math.pow(1 - fraction, 1.8)
        const c = headColor.clone().multiplyScalar(alpha)
        trailColors.push(c.r, c.g, c.b)
      }

      const trailGeo = new THREE.BufferGeometry()
      trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(trailPositions, 3))
      trailGeo.setAttribute('color', new THREE.Float32BufferAttribute(trailColors, 3))

      const trailMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const trailLine = new THREE.Line(trailGeo, trailMat)
      pivot.add(trailLine)

      // Dual trail glow for comic thickness
      const trailGlowMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const trailGlow1 = new THREE.Line(trailGeo, trailGlowMat)
      trailGlow1.position.y = 0.015
      pivot.add(trailGlow1)

      const trailGlow2 = new THREE.Line(trailGeo, trailGlowMat)
      trailGlow2.position.y = -0.015
      pivot.add(trailGlow2)

      // 4D. Saturated & Solid Planet Mesh (Requirement 1)
      const pTex = createPlanetTexture(cfg.textureType)
      const pMat = new THREE.MeshStandardMaterial({
        map: pTex,
        roughness: 0.35, // Smooth cartoon sheen
        metalness: 0.0,
        emissive: new THREE.Color(cfg.trailColor).multiplyScalar(0.12), // Subtle emissive cartoon pop
      })
      const pGeo = getSphereGeo(cfg.size)
      const pMesh = new THREE.Mesh(pGeo, pMat)
      pMesh.position.set(cfg.orbitRadius, 0, 0)
      if (cfg.tilt) pMesh.rotation.z = cfg.tilt
      pivot.add(pMesh)

      // Invisible hit target for hover
      const hitGeo = getSphereGeo(Math.max(cfg.size * 1.5, 0.48))
      const hitMat = new THREE.MeshBasicMaterial({ visible: false })
      const hitMesh = new THREE.Mesh(hitGeo, hitMat)
      hitMesh.position.set(cfg.orbitRadius, 0, 0)
      hitMesh.userData = { config: cfg }
      pivot.add(hitMesh)
      interactiveMeshes.push(hitMesh)

      // Saturn's Stylized Rings (Requirement 1)
      let ringMesh: THREE.Mesh | undefined
      if (cfg.hasRings) {
        const innerRadius = cfg.size * 1.35
        const outerRadius = cfg.size * 2.35
        const ringGeo = new THREE.RingGeometry(innerRadius, outerRadius, 64)
        const pos = ringGeo.attributes.position
        const uvs = ringGeo.attributes.uv
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i)
          const vy = pos.getY(i)
          const dist = Math.sqrt(vx * vx + vy * vy)
          const u = (dist - innerRadius) / (outerRadius - innerRadius)
          uvs.setXY(i, u, 0.5)
        }
        uvs.needsUpdate = true

        const ringMat = new THREE.MeshStandardMaterial({
          map: ringTex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
          roughness: 0.3,
          metalness: 0.0,
          emissive: new THREE.Color(0xfacc15).multiplyScalar(0.15),
        })
        ringMesh = new THREE.Mesh(ringGeo, ringMat)
        ringMesh.rotation.x = Math.PI / 2
        pMesh.add(ringMesh)
      }

      // Earth's Moon (Stylized white sphere)
      let moonPivot: THREE.Group | undefined
      if (cfg.hasMoon) {
        moonPivot = new THREE.Group()
        pMesh.add(moonPivot)

        const moonGeo = new THREE.SphereGeometry(cfg.size * 0.28, 16, 12)
        const moonMat = new THREE.MeshStandardMaterial({
          color: 0xf1f5f9,
          roughness: 0.4,
          emissive: new THREE.Color(0xffffff).multiplyScalar(0.1),
        })
        const moonMesh = new THREE.Mesh(moonGeo, moonMat)
        moonMesh.position.set(cfg.size * 1.8, 0, 0)
        moonPivot.add(moonMesh)
      }

      planetRuntimes.push({
        config: cfg,
        orbitPivot: pivot,
        planetMesh: pMesh,
        hitMesh,
        ringMesh,
        moonPivot,
      })
    })

    // 5. Dynamic Camera Framing (Requirement 5: Anti-Kepotong across all device aspect ratios)
    const baseCameraPos = { x: 0, y: 24, z: 34 }

    const updateCameraFraming = (w: number, h: number) => {
      const aspect = w / h
      camera.aspect = aspect
      camera.updateProjectionMatrix()

      // Neptune orbit (~15.2 * 0.92 scale ≈ 14.0) + planet radius (~0.52 * 0.92 ≈ 0.48) + safety margin
      const targetHalfSpan = 15.6
      const halfFovRad = (camera.fov * Math.PI) / 360
      const tanHalfFov = Math.tan(halfFovRad)

      // On narrow/portrait screens (aspect < 1), horizontal FOV shrinks, so camera pulls back dynamically
      // On wide screens (aspect >= 1), camera moves in for a heroic perspective
      const effectiveAspect = Math.max(0.46, Math.min(aspect, 1.45))
      const distH = targetHalfSpan / (tanHalfFov * effectiveAspect)
      const distV = 10.2 / tanHalfFov
      const targetDist = Math.max(distH, distV) * 1.14 // 14% safety padding so Neptune is NEVER cut off

      baseCameraPos.y = targetDist * 0.58
      baseCameraPos.z = targetDist * 0.81
      baseCameraPos.x = 0
    }

    updateCameraFraming(width, height)

    // 6. Interactive Raycasting & Mouse Parallax
    const targetMouse = { x: 0, y: 0 }
    const currentMouse = { x: 0, y: 0 }
    const pointerRay = new THREE.Vector2(-999, -999)
    const raycaster = new THREE.Raycaster()

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      targetMouse.x = nx
      targetMouse.y = ny

      pointerRay.x = nx
      pointerRay.y = -ny
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const rect = container.getBoundingClientRect()
        const touch = e.touches[0]
        const nx = ((touch.clientX - rect.left) / rect.width) * 2 - 1
        const ny = ((touch.clientY - rect.top) / rect.height) * 2 - 1
        targetMouse.x = nx
        targetMouse.y = ny
        pointerRay.x = nx
        pointerRay.y = -ny
      }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })

    // 7. Smooth Animation Loop
    let animationFrameId = 0
    let lastTime = performance.now()
    let lastHitId = ''

    const defaultTitle = { en: 'Solar System', id: 'Tata Surya' }
    const defaultDesc = {
      en: '8 Planetary Orbits · Real-time Simulation',
      id: '8 Orbit Planet · Simulasi Real-Time',
    }

    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate)

      const dt = Math.min((now - lastTime) / 1000, 0.1)
      lastTime = now

      // Smooth mouse lerp
      currentMouse.x += (targetMouse.x - currentMouse.x) * (dt * 3.5)
      currentMouse.y += (targetMouse.y - currentMouse.y) * (dt * 3.5)

      // Responsive camera position with gentle parallax
      camera.position.x = baseCameraPos.x + currentMouse.x * 2.0
      camera.position.y = baseCameraPos.y + currentMouse.y * 1.5
      camera.position.z = baseCameraPos.z
      camera.lookAt(0, 0, 0)

      // Sun self-rotation and stylized corona pulse
      sunMesh.rotation.y += dt * 0.14
      const pulse = 1 + Math.sin(now * 0.002) * 0.045
      glowSprite1.scale.set(5.2 * pulse, 5.2 * pulse, 1)
      glowSprite2.scale.set(8.2 * (2 - pulse), 8.2 * (2 - pulse), 1)

      // Starfield subtle rotation
      starfield.rotation.y += dt * 0.015

      // Planet orbital revolutions & axial spins (Keplerian speeds)
      planetRuntimes.forEach(({ config, orbitPivot, planetMesh, moonPivot }) => {
        // Orbit revolution: Mercury fastest, Neptune slowest
        const orbitDelta = dt * 0.24 * config.speed
        orbitPivot.rotation.y += orbitDelta

        // Axial spin on planet's own axis
        planetMesh.rotation.y += dt * config.rotationSpeed * 10

        // Moon orbit around Earth
        if (moonPivot) {
          moonPivot.rotation.y += dt * 1.2
        }
      })

      // Raycasting for interactive hover HUD
      raycaster.setFromCamera(pointerRay, camera)
      const intersects = raycaster.intersectObjects(interactiveMeshes, false)
      const isIndo = langRef.current === 'id'

      if (intersects.length > 0) {
        const top = intersects[0].object
        if (top.userData.isSun) {
          if (lastHitId !== 'sun') {
            lastHitId = 'sun'
            if (hudTitleRef.current) hudTitleRef.current.textContent = isIndo ? 'Matahari (Sol)' : 'The Sun (Sol)'
            if (hudDescRef.current) {
              hudDescRef.current.textContent = isIndo
                ? 'Bintang Deret Utama Tipe-G · Inti Surya'
                : 'G-Type Main-Sequence Star · Solar Core'
            }
          }
        } else if (top.userData.config) {
          const cfg = top.userData.config as PlanetConfig
          if (lastHitId !== cfg.id) {
            lastHitId = cfg.id
            if (hudTitleRef.current) hudTitleRef.current.textContent = isIndo ? cfg.name.id : cfg.name.en
            if (hudDescRef.current) hudDescRef.current.textContent = isIndo ? cfg.desc.id : cfg.desc.en
          }
        }
      } else {
        if (lastHitId !== '') {
          lastHitId = ''
          if (hudTitleRef.current) hudTitleRef.current.textContent = isIndo ? defaultTitle.id : defaultTitle.en
          if (hudDescRef.current) hudDescRef.current.textContent = isIndo ? defaultDesc.id : defaultDesc.en
        }
      }

      renderer.render(scene, camera)
    }

    animationFrameId = requestAnimationFrame(animate)

    // 8. Responsive Resize Observer (Requirement 5)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect
        if (newW > 0 && newH > 0 && (newW !== width || newH !== height)) {
          width = newW
          height = newH
          updateCameraFraming(width, height)
          renderer.setSize(width, height)
        }
      }
    })
    resizeObserver.observe(container)

    // 9. Proper Cleanup on Unmount (Requirement 5)
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('touchmove', onTouchMove)
      resizeObserver.disconnect()

      // Dispose Geometries and Materials
      starGeometry.dispose()
      starMaterial.dispose()
      sunGeo.dispose()
      sunMat.dispose()
      glowMat1.dispose()
      glowMat2.dispose()
      ringTex.dispose()
      sunTex.dispose()
      glowTex.dispose()

      sphereGeoCache.forEach((geo) => geo.dispose())
      sphereGeoCache.clear()

      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  const isIndo = lang === 'id'

  return (
    <div
      ref={containerRef}
      className="fe-solar-system-3d"
      aria-label="Stylized Cartoon CGI 3D Solar System with 8 orbiting planets and glowing speedline trails"
    >
      <div className="fe-solar-hud" aria-live="polite">
        <span className="fe-solar-hud-title" ref={hudTitleRef}>
          {isIndo ? 'Tata Surya' : 'Solar System'}
        </span>
        <span className="fe-solar-hud-sep" aria-hidden="true">·</span>
        <span className="fe-solar-hud-desc" ref={hudDescRef}>
          {isIndo ? '8 Orbit Planet · Simulasi Real-Time' : '8 Planetary Orbits · Real-time Simulation'}
        </span>
      </div>
    </div>
  )
}
