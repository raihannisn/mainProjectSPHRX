import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Billboard, Text, useGLTF, useTexture } from '@react-three/drei'
import { AdditiveBlending, BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, MeshStandardMaterial, ShaderMaterial, SRGBColorSpace, SphereGeometry, Vector2, Vector3, type Group, type Material, type Mesh } from 'three'
import { useBodyContent, useSitesForBody } from './content'
import { BODY_BY_ID } from './bodies'
import { makeLumpyGeometry } from './geo'
import { useXRApp } from './store'
import { useDwellOccluder } from './dwell'
import { Hotspots } from './Hotspots'
import { InfoCard3D } from './InfoCard'
import { Button3D } from './Button3D'
import { ErrorBoundary } from './ErrorBoundary'
import { withBVH } from './bvh'
import { FONT, FONT_BOLD } from './font'
import { useQuality } from './quality'
import { Atmosphere } from './space'
import { BennuEjecta } from './surface/particles'
import { SceneReady } from './smooth'
import { useMaterialFadeIn } from './fade'
import { t as tr, useT } from './i18n'
import { HOLO, HoloOrbit, NOISE } from './holo'
import { layersFor, type DataLayer } from './layers'
import { Choice3D, Label, UI, roundedRect, uiMat } from './ui3d'
import { manipulation, useBodyManipulation } from './BodyManipulator'
import { CatalogObjectCard3D } from './CatalogObjectCard3D'

/** The body blocks pointer rays and gaze, so pins on the far side cannot be picked through it. */
const block = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.stopPropagation()

function BodyMesh({ geometry, material, children }: { geometry: BufferGeometry; material?: Material; children?: React.ReactNode }) {
  const ref = useRef<Mesh>(null)
  useDwellOccluder(ref)
  return (
    <mesh ref={ref} geometry={geometry} material={material} onPointerOver={block} onClick={block}>
      {children}
    </mesh>
  )
}

const sphere = withBVH(new SphereGeometry(1, 96, 64))

/**
 * Saturn's rings from the NASA NSSDC Saturnian Rings Fact Sheet (radii in Saturn equatorial radii, 60,268 km):
 * C 1.239-1.526, B 1.526-1.950, Cassini Division 1.950-2.030, A 2.030-2.270, Encke Gap at 2.214. Opacity follows
 * the optical depth (alpha = 1 - e^-tau with a typical tau per ring), brightness follows the albedo. The look
 * is a drawing: no photograph of the rings is applied, which is why Saturn is labelled an illustration.
 */
const RING_INNER = 1.239
const RING_OUTER = 2.27
const RING_AXIAL_TILT = (26.73 * Math.PI) / 180 // NASA Saturn Fact Sheet: obliquity to orbit

function makeRingTexture(): CanvasTexture {
  const w = 1024
  const c = document.createElement('canvas')
  c.width = w
  c.height = 4
  const g = c.getContext('2d')!
  const at = (r: number) => ((r - RING_INNER) / (RING_OUTER - RING_INNER)) * w
  const band = (from: number, to: number, tau: number, albedo: number) => {
    const alpha = 1 - Math.exp(-tau)
    const v = Math.round(255 * Math.min(1, 0.45 + albedo * 0.9))
    g.fillStyle = `rgba(${v}, ${Math.round(v * 0.93)}, ${Math.round(v * 0.78)}, ${alpha.toFixed(3)})`
    g.fillRect(at(from), 0, at(to) - at(from), 4)
  }
  band(1.239, 1.526, 0.2, 0.2) // C ring
  band(1.526, 1.95, 1.4, 0.5) // B ring
  band(1.95, 2.03, 0.05, 0.3) // Cassini Division
  band(2.03, 2.27, 0.7, 0.5) // A ring
  g.clearRect(at(2.212), 0, at(2.2165) - at(2.212), 4) // Encke Gap
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

/** A flat ring whose u coordinate runs from the inner to the outer edge, so the strip texture maps by radius. */
function makeRingGeometry(inner: number, outer: number, segments = 128): BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const cos = Math.cos(a), sin = Math.sin(a)
    pos.push(cos * inner, 0, sin * inner, cos * outer, 0, sin * outer)
    uv.push(0, 0.5, 1, 0.5)
    if (i < segments) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

function SaturnRings() {
  const geometry = useMemo(() => makeRingGeometry(RING_INNER, RING_OUTER), [])
  const texture = useMemo(() => makeRingTexture(), [])
  useEffect(() => () => { geometry.dispose(); texture.dispose() }, [geometry, texture])
  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshBasicMaterial map={texture} side={DoubleSide} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

const URANUS_RING_INNER = 1.45
const URANUS_RING_OUTER = 2.05
const URANUS_AXIAL_TILT = (97.77 * Math.PI) / 180 // NASA Uranus Fact Sheet: 97.77° obliquity to orbit
const EARTH_AXIAL_TILT = (23.44 * Math.PI) / 180 // Earth obliquity: 23.44°

function makeUranusRingTexture(): CanvasTexture {
  const w = 2048
  const c = document.createElement('canvas')
  c.width = w
  c.height = 4
  const g = c.getContext('2d')!
  g.clearRect(0, 0, w, 4)
  const at = (r: number) => ((r - URANUS_RING_INNER) / (URANUS_RING_OUTER - URANUS_RING_INNER)) * w
  const band = (from: number, to: number, color: string) => {
    g.fillStyle = color
    const x0 = at(from)
    const x1 = at(to)
    g.fillRect(x0, 0, Math.max(1, x1 - x0), 4)
  }
  // Scientifically proportioned, delicate, semi-transparent icy rings (Voyager 2 / JWST):
  // Faint inner diffuse sheet (Zeta ring: 1.465 - 1.505)
  band(1.465, 1.505, 'rgba(155, 205, 222, 0.045)')
  // Narrow, tenuous dark ringlets (6, 5, 4)
  band(1.528, 1.534, 'rgba(165, 212, 230, 0.11)') // 6
  band(1.552, 1.558, 'rgba(168, 215, 232, 0.12)') // 5
  band(1.579, 1.586, 'rgba(170, 218, 235, 0.13)') // 4
  // Classical narrow ribbon rings with crisp gaps
  band(1.642, 1.651, 'rgba(175, 222, 240, 0.17)') // Alpha
  band(1.685, 1.695, 'rgba(178, 225, 242, 0.19)') // Beta
  band(1.730, 1.738, 'rgba(172, 218, 236, 0.15)') // Eta
  band(1.782, 1.792, 'rgba(180, 228, 245, 0.21)') // Gamma
  band(1.825, 1.838, 'rgba(184, 232, 248, 0.24)') // Delta
  // Faint dusty Lambda ring
  band(1.910, 1.918, 'rgba(160, 208, 226, 0.065)')
  // Outermost prominent Epsilon ring: densest, most reflective, with smooth icy gradient
  band(1.976, 1.986, 'rgba(190, 232, 248, 0.22)')
  band(1.986, 2.022, 'rgba(215, 245, 255, 0.46)') // Epsilon bright core
  band(2.022, 2.034, 'rgba(190, 232, 248, 0.20)')
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function UranusRings() {
  const meshRef = useRef<Mesh>(null)
  const geometry = useMemo(() => makeRingGeometry(URANUS_RING_INNER, URANUS_RING_OUTER, 256), [])
  const texture = useMemo(() => makeUranusRingTexture(), [])
  
  const uniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uSunDir: { value: new Vector3(5, 2, 4).normalize() },
      uPlanetCenter: { value: new Vector3(0, 0, 0) },
    }),
    [texture],
  )

  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vWorld;
          void main() {
            vUv = uv;
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform vec3 uSunDir;
          uniform vec3 uPlanetCenter;
          varying vec2 vUv;
          varying vec3 vWorld;
          void main() {
            vec4 tex = texture2D(uMap, vUv);
            if (tex.a < 0.002) discard;

            // Soft shadow when rings pass behind the planet
            vec3 V = vWorld - uPlanetCenter;
            vec3 L = normalize(uSunDir);
            float d = dot(V, -L);
            float shadowFactor = 1.0;
            if (d > 0.0) {
              vec3 perp = V - (-L * d);
              float perpDist = length(perp);
              // Planet radius is 1.0; penumbra soft gradient between 0.96 and 1.06
              float shadow = smoothstep(0.96, 1.06, perpDist);
              shadowFactor = mix(0.08, 1.0, shadow);
            }

            // Subtle forward and back scattering for icy dust rings
            vec3 viewDir = normalize(cameraPosition - vWorld);
            float cosTheta = dot(viewDir, L);
            float scattering = 0.84 + 0.32 * pow(max(cosTheta, 0.0), 3.0) + 0.12 * pow(max(-cosTheta, 0.0), 2.0);

            vec3 col = tex.rgb * shadowFactor * scattering;
            float alpha = tex.a * (0.35 + 0.65 * shadowFactor);
            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    [uniforms],
  )

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.getWorldPosition(uniforms.uPlanetCenter.value)
    }
  })

  useEffect(() => () => {
    geometry.dispose()
    texture.dispose()
    material.dispose()
  }, [geometry, texture, material])

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} renderOrder={1} />
  )
}

function SunAtmosphere() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    [],
  )

  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms,
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vWorld;
          varying vec3 vPosition;
          void main() {
            vNormal = normalize(mat3(modelMatrix) * normal);
            vPosition = position;
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec3 vNormal;
          varying vec3 vWorld;
          varying vec3 vPosition;
          ${NOISE}
          void main() {
            vec3 V = normalize(cameraPosition - vWorld);
            float vDotN = max(dot(normalize(vNormal), V), 0.0);
            float rim = 1.0 - vDotN;

            // Chromosphere warm plasma emission
            float pulse = 0.95 + 0.05 * sin(uTime * 2.2);
            float chromo = pow(rim, 2.6) * 1.15 * pulse;

            // Solar Prominences (lidah api / magnetic loops): undulating arches at the limb
            vec3 np = normalize(vPosition);
            float loopNoise1 = n3(np * 22.0 + vec3(uTime * 0.22, -uTime * 0.15, 0.0));
            float loopNoise2 = n3(np * 44.0 - vec3(0.0, uTime * 0.28, uTime * 0.18));
            // Filamentary arches: narrow ridged turbulence
            float arch = 1.0 - abs(loopNoise1 * 2.0 - 1.0);
            arch = pow(arch, 2.6);
            float prominence = arch * smoothstep(0.48, 0.85, loopNoise2) * pow(rim, 3.0) * 3.2;

            // Smooth exponential fade towards boundary to eliminate any hard geometry line
            float edgeFade = smoothstep(0.0, 0.22, vDotN);
            float alpha = (chromo + prominence) * edgeFade;

            // Glowing warm chromosphere & prominence colors
            vec3 colChromo = vec3(2.2, 0.68, 0.12);
            vec3 colProm = vec3(2.8, 1.15, 0.28);
            vec3 col = mix(colChromo, colProm, clamp(prominence / (chromo + prominence + 0.001), 0.0, 1.0));

            gl_FragColor = vec4(col * alpha, alpha);
          }
        `,
      }),
    [uniforms],
  )

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
  })

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh material={material} scale={1.038} renderOrder={2}>
      <sphereGeometry args={[1, 64, 48]} />
    </mesh>
  )
}

function SunCorona() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    [],
  )

  // Camera-facing wide coronal ray streamers disk (zero geometry border in space)
  const billboardMaterial = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          ${NOISE}
          void main() {
            vec2 p = vUv - 0.5;
            float r = length(p) * 2.0; // 0 at center, 1.0 at outer quad boundary
            float rSun = 1.0 / 3.4;   // Sun surface radius relative to quad
            if (r < rSun * 0.9) discard;

            // Normalized distance from Sun limb outwards into space (0.0 to 1.0)
            float d = clamp((r - rSun) / (1.0 - rSun), 0.0, 1.0);

            // Ultra-smooth radial falloff fading to exactly 0.0 at quad boundary
            float falloff = exp(-d * 3.6) * pow(1.0 - smoothstep(0.65, 1.0, d), 2.0);

            // Coronal magnetic streamers (radial rays)
            float angle = atan(p.y, p.x);
            float s1 = sin(angle * 7.0 + uTime * 0.07) * 0.5 + 0.5;
            float s2 = sin(angle * 13.0 - uTime * 0.05) * 0.5 + 0.5;
            float s3 = sin(angle * 25.0 + uTime * 0.09) * 0.5 + 0.5;
            float streamers = 0.72 + 0.28 * (s1 * 0.5 + s2 * 0.3 + s3 * 0.2);

            // Whispy turbulence noise
            float micro = n3(vec3(p * 5.0, uTime * 0.05)) * 0.25 + 0.88;
            float intensity = falloff * streamers * micro;

            // Coronal temperature color gradient
            vec3 cInner = vec3(2.6, 2.1, 1.4);
            vec3 cMid = vec3(2.0, 0.9, 0.22);
            vec3 cOuter = vec3(1.2, 0.32, 0.05);
            vec3 col = mix(cInner, cMid, smoothstep(0.0, 0.28, d));
            col = mix(col, cOuter, smoothstep(0.28, 0.75, d));

            float alpha = intensity * 0.85;
            gl_FragColor = vec4(col * alpha, alpha);
          }
        `,
      }),
    [uniforms],
  )

  // Soft spherical volumetric inner halo (scale 1.20) with smooth edge fade
  const sphereMaterial = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms,
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vWorld;
          void main() {
            vNormal = normalize(mat3(modelMatrix) * normal);
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec3 vNormal;
          varying vec3 vWorld;
          void main() {
            vec3 V = normalize(cameraPosition - vWorld);
            float vDotN = max(dot(normalize(vNormal), V), 0.0);
            float edgeFade = smoothstep(0.0, 0.25, vDotN);
            float rim = 1.0 - vDotN;
            float pulse = 0.94 + 0.06 * sin(uTime * 1.5);
            float alpha = pow(rim, 2.6) * edgeFade * 0.7 * pulse;
            vec3 col = mix(vec3(2.0, 1.0, 0.3), vec3(1.3, 0.38, 0.07), rim);
            gl_FragColor = vec4(col * alpha, alpha);
          }
        `,
      }),
    [uniforms],
  )

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
  })

  useEffect(
    () => () => {
      billboardMaterial.dispose()
      sphereMaterial.dispose()
    },
    [billboardMaterial, sphereMaterial],
  )

  return (
    <>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh material={billboardMaterial} renderOrder={3}>
          <planeGeometry args={[6.8, 6.8]} />
        </mesh>
      </Billboard>
      <mesh material={sphereMaterial} scale={1.20} renderOrder={3}>
        <sphereGeometry args={[1, 64, 48]} />
      </mesh>
    </>
  )
}

function SunSphere({ url }: { url: string }) {
  const map = useTexture(url)
  map.colorSpace = SRGBColorSpace

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uTime: { value: 0 },
    }),
    [map],
  )

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vWorld;
          varying vec3 vPosition;
          void main() {
            vUv = uv;
            vPosition = position;
            vNormal = normalize(mat3(modelMatrix) * normal);
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform float uTime;
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vWorld;
          varying vec3 vPosition;
          ${NOISE}
          void main() {
            vec3 V = normalize(cameraPosition - vWorld);
            float vDotN = max(dot(normalize(vNormal), V), 0.0);
            vec4 tex = texture2D(uMap, vUv);
            vec3 p = normalize(vPosition);

            // High-contrast plasma convection cells (granulation)
            float n1 = n3(p * 16.0 + vec3(0.0, uTime * 0.05, 0.0));
            float n2 = n3(p * 32.0 - vec3(uTime * 0.07, 0.0, uTime * 0.04));
            float n3Cell = n3(p * 64.0 + vec3(uTime * 0.03, uTime * 0.05, -uTime * 0.02));
            float cellPattern = abs(n1 - 0.5) * 2.0;
            float fineGranules = n2 * 0.6 + n3Cell * 0.4;
            float plasma = cellPattern * 0.45 + fineGranules * 0.55;

            // Small, realistic sunspots in active magnetic latitudes
            float lat = abs(p.y);
            float activeBelt = smoothstep(0.08, 0.22, lat) * smoothstep(0.65, 0.42, lat);
            float spotField = n3(p * 18.0 + vec3(2.3, 5.7, 1.2));
            float spotMicro = n3(p * 36.0 + vec3(0.0, uTime * 0.012, 0.0));
            float spotTotal = spotField * 0.75 + spotMicro * 0.25;

            float hasSpot = smoothstep(0.18, 0.13, spotTotal) * activeBelt;
            float umbra = smoothstep(0.14, 0.10, spotTotal) * activeBelt;
            float penumbraFilaments = n3(p * 56.0) * 0.3 + 0.7;
            vec3 spotColor = mix(vec3(0.48, 0.20, 0.04) * penumbraFilaments, vec3(0.14, 0.05, 0.01), umbra);

            // Balanced exposure: deep golden-orange to amber limb
            float limb = pow(vDotN, 0.50);
            vec3 fieryLimb = vec3(1.15, 0.42, 0.06); // deep amber-orange limb
            vec3 hotCore = vec3(1.18, 0.92, 0.38);   // golden core with clear granulation
            vec3 solarGlow = mix(fieryLimb, hotCore, limb);

            vec3 baseColor = tex.rgb * 0.92;
            vec3 photosphere = baseColor * (0.75 + plasma * 0.38) + solarGlow * 0.30;
            photosphere += vec3(0.24, 0.15, 0.03) * pow(plasma, 2.0);

            vec3 finalColor = mix(photosphere, spotColor, hasSpot);
            gl_FragColor = vec4(finalColor, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [uniforms],
  )

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
  })

  useEffect(() => () => material.dispose(), [material])

  return (
    <>
      <BodyMesh geometry={sphere} material={material} />
      <SunAtmosphere />
      <SunCorona />
      <pointLight color="#fff0cc" intensity={3.5} distance={30} decay={1} />
    </>
  )
}

function UranusAtmosphere() {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color('#64e5f8') },
      uSun: { value: new Vector3(5, 2, 4).normalize() },
      uIntensity: { value: 1.25 },
    }),
    [],
  )

  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms,
        vertexShader: /* glsl */ `
          varying vec3 vN;
          varying vec3 vV;
          varying vec3 vWN;
          void main() {
            vN = normalize(normalMatrix * normal);
            vWN = normalize(mat3(modelMatrix) * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform vec3 uSun;
          uniform float uIntensity;
          varying vec3 vN;
          varying vec3 vV;
          varying vec3 vWN;
          void main() {
            float d = max(dot(normalize(vN), normalize(vV)), 0.0);
            float rim = pow(1.0 - d, 3.2);
            // Smooth radial fade towards edge to eliminate harsh sphere boundary
            float edgeFade = smoothstep(0.01, 0.22, d);
            float lit = clamp(dot(normalize(vWN), uSun) * 0.75 + 0.35, 0.05, 1.0);
            gl_FragColor = vec4(uColor * rim * lit * edgeFade * uIntensity, 1.0);
          }
        `,
      }),
    [uniforms],
  )

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh material={material} scale={1.032} renderOrder={1}>
      <sphereGeometry args={[1, 64, 48]} />
    </mesh>
  )
}

function UranusSphere({ url, color }: { url: string; color: string }) {
  const map = useTexture(url)
  map.colorSpace = SRGBColorSpace

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uSunDir: { value: new Vector3(5, 2, 4).normalize() },
      uTime: { value: 0 },
    }),
    [map],
  )

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vWorld;
          varying vec3 vPosition;
          void main() {
            vUv = uv;
            vPosition = position;
            vNormal = normalize(mat3(modelMatrix) * normal);
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform vec3 uSunDir;
          uniform float uTime;
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vWorld;
          varying vec3 vPosition;
          ${NOISE}
          void main() {
            vec3 V = normalize(cameraPosition - vWorld);
            vec3 N = normalize(vNormal);
            vec3 L = normalize(uSunDir);

            vec4 tex = texture2D(uMap, vUv);

            // Subtle atmospheric methane cloud bands along latitude
            float lat = vPosition.y;

            // Bright polar collar / hood (Voyager 2 / JWST observations)
            float polarHood = smoothstep(0.55, 0.88, abs(lat)) * 0.14;
            // Mid-latitude temperate belts
            float tempBand1 = exp(-pow((abs(lat) - 0.42) * 9.0, 2.0)) * 0.07;
            float tempBand2 = exp(-pow((abs(lat) - 0.22) * 11.0, 2.0)) * -0.04;
            float eqHaze = exp(-pow(lat * 8.0, 2.0)) * 0.05;

            // Subtle harmonic zonal waves
            float zonalWaves = sin(lat * 32.0) * 0.02 + sin(lat * 58.0) * 0.012;

            // Fine animated atmospheric turbulence / cloud streaks
            float cloudStreaks = n3(vec3(vPosition.x * 2.5, lat * 26.0, vPosition.z * 2.5 + uTime * 0.03)) * 0.035;

            float bandTotal = polarHood + tempBand1 + tempBand2 + eqHaze + zonalWaves + cloudStreaks;

            // Pale cyan methane haze overlay
            vec3 paleCyanHaze = vec3(0.58, 0.94, 0.98);
            vec3 surfaceCol = mix(tex.rgb, paleCyanHaze, bandTotal + 0.04);

            // Planetary illumination with soft atmospheric terminator
            float NdotL = dot(N, L);
            float diff = smoothstep(-0.25, 0.8, NdotL);
            float lit = 0.07 + 0.93 * diff;

            // Soft cyan limb glow (methane Rayleigh scattering)
            float vDotN = max(dot(N, V), 0.0);
            float limbGlow = pow(1.0 - vDotN, 3.2);
            vec3 limbCol = vec3(0.42, 0.92, 0.98);

            vec3 finalCol = surfaceCol * lit + limbCol * limbGlow * 0.45 * (0.35 + 0.65 * max(NdotL, 0.0));

            gl_FragColor = vec4(finalCol, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [uniforms],
  )

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
  })

  useEffect(() => () => material.dispose(), [material])

  return (
    <>
      <mesh geometry={sphere} scale={0.996}>
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <BodyMesh geometry={sphere} material={material} />
    </>
  )
}

function EarthAtmosphere() {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color('#3ea8ff') },
      uSun: { value: new Vector3(5, 2, 4).normalize() },
      uIntensity: { value: 1.15 },
    }),
    [],
  )

  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms,
        vertexShader: /* glsl */ `
          varying vec3 vN;
          varying vec3 vV;
          varying vec3 vWN;
          void main() {
            vN = normalize(normalMatrix * normal);
            vWN = normalize(mat3(modelMatrix) * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform vec3 uSun;
          uniform float uIntensity;
          varying vec3 vN;
          varying vec3 vV;
          varying vec3 vWN;
          void main() {
            float d = max(dot(normalize(vN), normalize(vV)), 0.0);
            float rim = pow(1.0 - d, 3.2);
            // Smooth exponential fade towards edge to eliminate harsh sphere boundary
            float edgeFade = smoothstep(0.01, 0.22, d);
            float lit = clamp(dot(normalize(vWN), uSun) * 0.75 + 0.35, 0.05, 1.0);
            gl_FragColor = vec4(uColor * rim * lit * edgeFade * uIntensity, 1.0);
          }
        `,
      }),
    [uniforms],
  )

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh material={material} scale={1.032} renderOrder={3}>
      <sphereGeometry args={[1, 64, 48]} />
    </mesh>
  )
}

function EarthClouds() {
  const map = useTexture('/textures/earth_clouds.jpg')
  map.colorSpace = SRGBColorSpace

  const ref = useRef<Mesh>(null)

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uSunDir: { value: new Vector3(5, 2, 4).normalize() },
    }),
    [map],
  )

  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vWorld;
          void main() {
            vUv = uv;
            vNormal = normalize(mat3(modelMatrix) * normal);
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform vec3 uSunDir;
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vWorld;
          void main() {
            vec3 N = normalize(vNormal);
            vec3 L = normalize(uSunDir);
            vec3 V = normalize(cameraPosition - vWorld);

            vec4 tex = texture2D(uMap, vUv);
            float cloudVal = tex.r;
            if (cloudVal < 0.02) discard;

            // Day / night illumination on clouds
            float NdotL = dot(N, L);
            float sunLit = smoothstep(-0.25, 0.45, NdotL);

            // Forward scattering on cloud wisps towards sun
            float vDotL = dot(-V, L);
            float scatter = 1.0 + 0.35 * pow(max(vDotL, 0.0), 3.0);

            // Pure realistic white cloud color lit by sun
            vec3 cloudCol = vec3(1.0, 1.0, 1.0) * (0.05 + 0.95 * sunLit) * scatter;

            // Fade dark on night side so city lights shine clearly below
            float nightFade = smoothstep(-0.22, 0.22, NdotL);
            float alpha = smoothstep(0.05, 0.65, cloudVal) * 0.82 * (0.12 + 0.88 * nightFade);

            gl_FragColor = vec4(cloudCol, alpha);
            #include <colorspace_fragment>
          }
        `,
      }),
    [uniforms],
  )

  useFrame((_, dt) => {
    // Differential cloud rotation (clouds drift slightly faster)
    if (ref.current) {
      ref.current.rotation.y += dt * 0.04
    }
  })

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh ref={ref} geometry={sphere} material={material} scale={1.012} renderOrder={2} />
  )
}

function EarthSphere({ url, color }: { url: string; color: string }) {
  const [map, lightsMap, specMap, cloudsMap] = useTexture([
    url,
    '/textures/earth_lights.jpg',
    '/textures/earth_specular.jpg',
    '/textures/earth_clouds.jpg',
  ])
  map.colorSpace = SRGBColorSpace
  lightsMap.colorSpace = SRGBColorSpace

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uLights: { value: lightsMap },
      uSpecular: { value: specMap },
      uClouds: { value: cloudsMap },
      uSunDir: { value: new Vector3(5, 2, 4).normalize() },
      uCloudOffset: { value: 0 },
    }),
    [map, lightsMap, specMap, cloudsMap],
  )

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vWorld;
          varying vec3 vPosition;
          void main() {
            vUv = uv;
            vPosition = position;
            vNormal = normalize(mat3(modelMatrix) * normal);
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform sampler2D uLights;
          uniform sampler2D uSpecular;
          uniform sampler2D uClouds;
          uniform vec3 uSunDir;
          uniform float uCloudOffset;
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vWorld;
          varying vec3 vPosition;

          void main() {
            vec3 V = normalize(cameraPosition - vWorld);
            vec3 N = normalize(vNormal);
            vec3 L = normalize(uSunDir);
            float NdotL = dot(N, L);

            vec4 dayTex = texture2D(uMap, vUv);
            vec3 nightTex = texture2D(uLights, vUv).rgb;
            float oceanMask = texture2D(uSpecular, vUv).r; // 1.0 on water, 0.0 on land

            // Soft shadow cast by clouds on land and ocean
            float cloudDensity = texture2D(uClouds, vec2(vUv.x - uCloudOffset, vUv.y)).r;
            float shadowFactor = mix(1.0, 0.58, smoothstep(0.12, 0.70, cloudDensity) * smoothstep(-0.05, 0.35, NdotL));

            // Day / night illumination mask
            float dayFactor = smoothstep(-0.15, 0.25, NdotL);
            float nightFactor = smoothstep(0.15, -0.15, NdotL);

            // Ambient / fill light on night side so oceans and terrain aren't pitch-black
            float ambient = 0.07;
            vec3 dayColor = dayTex.rgb * (ambient + (1.0 - ambient) * dayFactor * shadowFactor);

            // Ocean specular reflection (Blinn-Phong) - tight, bright, and realistic water glint
            vec3 H = normalize(L + V);
            float NdotH = max(dot(N, H), 0.0);
            float oceanSpecular = pow(NdotH, 128.0) * oceanMask * smoothstep(0.0, 0.25, NdotL);
            vec3 sunGlint = vec3(2.2, 2.1, 1.9) * oceanSpecular * 2.5;

            // Deep ocean subtle fresnel reflection at glancing angles
            float vDotN = max(dot(N, V), 0.0);
            float oceanFresnel = pow(1.0 - vDotN, 4.0) * oceanMask * dayFactor * 0.25;
            vec3 waterShine = vec3(0.3, 0.6, 1.0) * oceanFresnel;

            // Vibrant warm golden city lights on night side
            vec3 cityLights = nightTex * vec3(2.2, 1.6, 0.7) * nightFactor * 4.0;

            // Atmospheric limb scattering (Rayleigh horizon glow)
            float rim = pow(1.0 - vDotN, 3.5);
            vec3 atmosphereRim = vec3(0.25, 0.65, 1.0) * rim * 0.55 * (0.2 + 0.8 * smoothstep(-0.2, 0.4, NdotL));

            vec3 finalColor = dayColor + sunGlint + waterShine + cityLights + atmosphereRim;
            gl_FragColor = vec4(finalColor, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [uniforms],
  )

  useFrame((state) => {
    // Match cloud shadow movement to differential cloud drift
    uniforms.uCloudOffset.value = state.clock.elapsedTime * 0.002
  })

  useEffect(() => () => material.dispose(), [material])

  return (
    <>
      <mesh geometry={sphere} scale={0.996}>
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <BodyMesh geometry={sphere} material={material} />
      <EarthClouds />
    </>
  )
}

function JupiterSphere({ url, color }: { url: string; color: string }) {
  const map = useTexture(url)
  map.colorSpace = SRGBColorSpace
  map.anisotropy = 8

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uSunDir: { value: new Vector3(5, 2, 4).normalize() },
      uTime: { value: 0 },
    }),
    [map],
  )

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vWorld;
          varying vec3 vPosition;
          void main() {
            vUv = uv;
            vPosition = position;
            vNormal = normalize(mat3(modelMatrix) * normal);
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform vec3 uSunDir;
          uniform float uTime;
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vWorld;
          varying vec3 vPosition;
          ${NOISE}
          void main() {
            vec3 V = normalize(cameraPosition - vWorld);
            vec3 N = normalize(vNormal);
            vec3 L = normalize(uSunDir);

            float lat = vPosition.y;

            // Zonal jet streams: differential cloud drift along latitude
            float eqJet = exp(-pow(lat * 3.5, 2.0)) * 0.003 * sin(uTime * 0.04);
            float tempJet = exp(-pow((abs(lat) - 0.45) * 6.0, 2.0)) * -0.0025 * sin(uTime * 0.035);
            vec2 uv = vec2(fract(vUv.x + eqJet + tempJet), vUv.y);

            vec4 tex = texture2D(uMap, uv);

            // Subtle atmospheric micro-eddies on Jovian cloud belts
            float eddies = n3(vec3(vPosition.x * 5.0, lat * 22.0, vPosition.z * 5.0 + uTime * 0.015)) * 0.03;
            vec3 cloudColor = tex.rgb * (1.0 + eddies);

            // Minnaert limb darkening for dense gas giant atmosphere
            float vDotN = max(dot(N, V), 0.0);
            float NdotL = max(dot(N, L), 0.0);
            float minnaert = pow(max(NdotL * vDotN, 0.0), 0.78) * 1.38;

            // Ambient fill on night side (deep Jovian midnight tones)
            float ambient = 0.06;
            vec3 dayColor = cloudColor * (ambient + minnaert * 0.94);

            // Jovian atmospheric Rayleigh rim haze (cyan at polar zones, amber at equator)
            float rim = pow(1.0 - vDotN, 3.8);
            vec3 polarHaze = vec3(0.45, 0.82, 1.0) * smoothstep(0.22, 0.85, abs(lat));
            vec3 eqHaze = vec3(0.95, 0.78, 0.48) * (1.0 - smoothstep(0.22, 0.85, abs(lat)));
            vec3 limbHaze = (polarHaze + eqHaze) * rim * 0.65 * smoothstep(-0.25, 0.35, dot(N, L));

            vec3 finalColor = dayColor + limbHaze;
            gl_FragColor = vec4(finalColor, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [uniforms],
  )

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
  })

  useEffect(() => () => material.dispose(), [material])

  return (
    <group scale={[1.055, 0.985, 1.055]}>
      <mesh geometry={sphere} scale={0.996}>
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <BodyMesh geometry={sphere} material={material} />
    </group>
  )
}

function SaturnSphere({ url, color }: { url: string; color: string }) {
  const map = useTexture(url)
  map.colorSpace = SRGBColorSpace
  map.anisotropy = 8

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uSunDir: { value: new Vector3(5, 2, 4).normalize() },
      uTime: { value: 0 },
    }),
    [map],
  )

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vWorld;
          varying vec3 vPosition;
          void main() {
            vUv = uv;
            vPosition = position;
            vNormal = normalize(mat3(modelMatrix) * normal);
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform vec3 uSunDir;
          uniform float uTime;
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vWorld;
          varying vec3 vPosition;
          ${NOISE}
          void main() {
            vec3 V = normalize(cameraPosition - vWorld);
            vec3 N = normalize(vNormal);
            vec3 L = normalize(uSunDir);

            vec4 tex = texture2D(uMap, vUv);

            // Minnaert limb darkening for Saturn's deep ammonia-haze atmosphere
            float vDotN = max(dot(N, V), 0.0);
            float NdotL = max(dot(N, L), 0.0);
            float minnaert = pow(max(NdotL * vDotN, 0.0), 0.80) * 1.36;

            float ambient = 0.06;
            vec3 dayColor = tex.rgb * (ambient + minnaert * 0.94);

            // Soft golden-butterscotch rim glow
            float rim = pow(1.0 - vDotN, 3.8);
            vec3 haze = vec3(0.98, 0.85, 0.58) * rim * 0.55 * smoothstep(-0.25, 0.35, dot(N, L));

            vec3 finalColor = dayColor + haze;
            gl_FragColor = vec4(finalColor, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [uniforms],
  )

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
  })

  useEffect(() => () => material.dispose(), [material])

  return (
    <group scale={[1.08, 0.965, 1.08]}>
      <mesh geometry={sphere} scale={0.996}>
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <BodyMesh geometry={sphere} material={material} />
    </group>
  )
}

function TexturedPlanet({ url, relief, color }: { url: string; relief?: string; color: string }) {
  // colour map + (Mars) MOLA relief normal map arrive together, then fade in over the plain-colour globe
  const textureOrMaps = useTexture(relief ? [url, relief] : url)
  const material = useMemo(() => {
    const map = Array.isArray(textureOrMaps) ? textureOrMaps[0] : textureOrMaps
    const normalMap = Array.isArray(textureOrMaps) ? textureOrMaps[1] : null
    map.colorSpace = SRGBColorSpace
    map.anisotropy = 8
    if (normalMap) normalMap.anisotropy = 8
    return new MeshStandardMaterial({ map, normalMap: normalMap ?? null, normalScale: new Vector2(1.2, 1.2), roughness: normalMap ? 0.95 : 1, metalness: 0 })
  }, [textureOrMaps])
  useEffect(() => () => material.dispose(), [material])
  useMaterialFadeIn(material)
  return (
    <>
      <mesh geometry={sphere} scale={0.996}>
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <BodyMesh geometry={sphere} material={material} />
    </>
  )
}

function PlainPlanet({ color }: { color: string }) {
  return (
    <BodyMesh geometry={sphere}>
      <meshStandardMaterial color={color} roughness={1} />
    </BodyMesh>
  )
}

function GltfAsteroid({ url, onGeometry }: { url: string; onGeometry: (g: BufferGeometry) => void }) {
  const { scene } = useGLTF(url)
  const geometry = useMemo(() => {
    let g: BufferGeometry | null = null
    scene.traverse((o) => {
      if (!g && (o as Mesh).isMesh) g = (o as Mesh).geometry
    })
    return g ? withBVH(g as BufferGeometry) : null
  }, [scene])
  useEffect(() => {
    if (geometry) onGeometry(geometry)
  }, [geometry, onGeometry])
  if (!geometry) return null
  return (
    <BodyMesh geometry={geometry}>
      <meshStandardMaterial color="#7a746c" roughness={1} metalness={0} />
    </BodyMesh>
  )
}

function LumpyAsteroid({ onGeometry }: { onGeometry: (g: BufferGeometry) => void }) {
  const geometry = useMemo(() => withBVH(makeLumpyGeometry(3)), [])
  useEffect(() => onGeometry(geometry), [geometry, onGeometry])
  return (
    <BodyMesh geometry={geometry}>
      <meshStandardMaterial color="#6f6a64" roughness={1} flatShading />
    </BodyMesh>
  )
}

/** Uses the GLB when the file really exists (Vite's SPA fallback returns HTML for missing files). */
function useModelAvailable(url?: string): boolean | null {
  const [ok, setOk] = useState<boolean | null>(url ? null : false)
  useEffect(() => {
    if (!url) return setOk(false)
    let alive = true
    const base = import.meta.env.BASE_URL ?? '/xr/'
    const targetUrl = url.startsWith('/') && !url.startsWith(base) ? base.replace(/\/$/, '') + url : url
    fetch(targetUrl, { method: 'HEAD' })
      .then((r) => alive && setOk(r.ok && !(r.headers.get('content-type') ?? '').includes('text/html')))
      .catch(() => alive && setOk(false))
    return () => {
      alive = false
    }
  }, [url])
  return ok
}

function Asteroid({ model, onGeometry, onIllustration }: { model?: string; onGeometry: (g: BufferGeometry) => void; onIllustration: (v: boolean) => void }) {
  const available = useModelAvailable(model)
  useEffect(() => {
    if (available !== null) onIllustration(!available)
  }, [available, onIllustration])
  if (available === null) return null
  if (!available || !model) return <LumpyAsteroid onGeometry={onGeometry} />
  return (
    <ErrorBoundary fallback={<LumpyAsteroid onGeometry={onGeometry} />}>
      <Suspense fallback={null}>
        <GltfAsteroid url={model} onGeometry={onGeometry} />
      </Suspense>
    </ErrorBoundary>
  )
}

/**
 * Generic explorer for one body: loads content/bodies/<id>.json, shows a textured sphere (planets)
 * or a GLB / procedural placeholder (asteroids), hotspots, and (in VR) the in-world info card.
 */
export function BodyExplorer({
  id,
  vr,
  showTitle = true,
  showObjectCard = true,
  hideObjectCard = false,
}: {
  id: string
  vr: boolean
  /** false when a 2D HUD already shows the name (inline viewer) */
  showTitle?: boolean
  /** false when a 2D HUD card already carries the object summary (inline viewer) */
  showObjectCard?: boolean
  /** keep the card's voice-over but do not draw it (inline 2D viewer) */
  hideObjectCard?: boolean
}) {
  const content = useBodyContent(id)
  const q = useQuality()
  const sites = useSitesForBody(vr ? id : null)
  const info = BODY_BY_ID[id]
  const spin = useRef<Group>(null)
  const manip = useRef<Group>(null)
  useBodyManipulation(manip)
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null)
  const [illustration, setIllustration] = useState(false)
  const paused = useXRApp((s) => s.hotspotId !== null || s.hoveredId !== null)
  const t = useT()
  const layers = layersFor(id)
  const layerId = useXRApp((s) => s.layer[id] ?? layers[0]?.id)
  const layer = layers.find((l) => l.id === layerId)
  const layerUrl = layer?.url
  const isAsteroid = content?.type === 'asteroid' || info?.kind === 'asteroid'
  const plainSphereIsIllustration =
    content !== undefined && content !== null && !isAsteroid && (!content.texture || content.textureKind === 'illustration')
  useEffect(() => {
    useXRApp.setState({ shapeIsIllustration: illustration || plainSphereIsIllustration })
  }, [illustration, plainSphereIsIllustration])

  useFrame((_, dt) => {
    if (spin.current && !paused && !manipulation.active) spin.current.rotation.y += dt * 0.06
  })

  const name = content?.name ?? info?.name ?? id
  const color = info?.color ?? '#888888'
  const subtitle =
    content === undefined
      ? t('Loading…')
      : illustration
        ? t('Shape is an illustration (no model available)')
        : content === null
          ? t('No hotspots for this body yet')
          : content.hotspots.length === 0
            ? t('Overview and narration available; no mapped hotspots')
            : t('{n} hotspots, point, tap or look to explore', { n: content.hotspots.length })

  return (
    <group>
      <group rotation={[0, 0, id === 'saturn' ? RING_AXIAL_TILT : id === 'uranus' ? URANUS_AXIAL_TILT : id === 'earth' ? EARTH_AXIAL_TILT : 0]}>
      <group ref={manip}>
      <group ref={spin}>
        {id === 'sun' ? (
          <ErrorBoundary fallback={<PlainPlanet color={color} />}>
            <Suspense fallback={<PlainPlanet color={color} />}>
              <SunSphere url={layerUrl ?? content?.texture ?? '/textures/sun.jpg'} />
            </Suspense>
          </ErrorBoundary>
        ) : id === 'uranus' ? (
          <ErrorBoundary fallback={<PlainPlanet color={color} />}>
            <Suspense fallback={<PlainPlanet color={color} />}>
              <UranusSphere url={layerUrl ?? content?.texture ?? '/textures/uranus.jpg'} color={color} />
            </Suspense>
          </ErrorBoundary>
        ) : id === 'earth' ? (
          <ErrorBoundary fallback={<PlainPlanet color={color} />}>
            <Suspense fallback={<PlainPlanet color={color} />}>
              <EarthSphere url={layerUrl ?? content?.texture ?? '/textures/earth.jpg'} color={color} />
            </Suspense>
          </ErrorBoundary>
        ) : id === 'jupiter' ? (
          <ErrorBoundary fallback={<PlainPlanet color={color} />}>
            <Suspense fallback={<PlainPlanet color={color} />}>
              <JupiterSphere url={layerUrl ?? content?.texture ?? '/textures/jupiter.jpg'} color={color} />
            </Suspense>
          </ErrorBoundary>
        ) : id === 'saturn' ? (
          <ErrorBoundary fallback={<PlainPlanet color={color} />}>
            <Suspense fallback={<PlainPlanet color={color} />}>
              <SaturnSphere url={layerUrl ?? content?.texture ?? '/textures/saturn.jpg'} color={color} />
            </Suspense>
          </ErrorBoundary>
        ) : isAsteroid ? (
          // wait for the content file: mounting without its model URL briefly reported "illustration"
          content !== undefined && <Asteroid model={content?.model} onGeometry={setGeometry} onIllustration={setIllustration} />
        ) : content?.texture ? (
          <ErrorBoundary fallback={<PlainPlanet color={color} />}>
            <Suspense fallback={<PlainPlanet color={color} />}>
              <TexturedPlanet url={layerUrl ?? content.texture} color={color} relief={id === 'mars' && q.marsRelief ? `/textures/mars_normal_${q.marsRelief}.png` : undefined} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          content !== undefined && <PlainPlanet color={color} />
        )}
        {content && <Hotspots content={content} geometry={geometry} />}
        {id === 'bennu' && q.bursts && <BennuEjecta surface={geometry ? (geometry.attributes.position.array as Float32Array) : null} />}
      </group>
      {id === 'saturn' && <SaturnRings />}
      {id === 'uranus' && <UranusRings />}
      </group>
      </group>

      {showObjectCard && (
        <CatalogObjectCard3D
          objectId={id}
          objectName={content?.name ?? info?.name ?? id}
          objectType={content?.type ?? info?.kind ?? ''}
          contentReady={content !== undefined}
          localDescription={content?.description?.en ?? ''}
          narrationDescription={content?.description?.en ?? ''}
          hidden={hideObjectCard}
        />
      )}

      {content !== undefined && <SceneReady />}
      {/* the Solar System chart's language: a faint orbit ring with ticks around the body */}
      {id !== 'saturn' && id !== 'sun' && id !== 'uranus' && id !== 'earth' && id !== 'jupiter' && (
        <group rotation={[0.22, 0, 0]}>
          <HoloOrbit radius={1.55} color={HOLO.teal} />
        </group>
      )}
      {id === 'mars' && <Atmosphere color="#e3a07a" intensity={0.9} />}
      {id === 'uranus' && <UranusAtmosphere />}
      {id === 'earth' && <EarthAtmosphere />}
      {showTitle && (
        <Billboard position={[0, 1.38, 0]}>
          <Text font={FONT_BOLD} fontSize={0.16} color="#ffffff" anchorY="bottom" outlineWidth={0.006} outlineColor="#000">
            {name}
          </Text>
          <Text font={FONT} position={[0, -0.03, 0]} fontSize={0.06} color={illustration ? '#38bdf8' : '#aab4cc'} anchorY="top">
            {subtitle}
          </Text>
        </Billboard>
      )}

      {vr && (
        <>
          <InfoCard3D />
          {layers.length > 1 && <LayerPicker3D body={id} layers={layers} active={layerId} />}
          <Button3D label={t('Solar System')} icon="back" position={[0, -1.35, 0.2]} width={0.6} height={0.13} onClick={() => useXRApp.getState().selectBody(null)} />
          {sites.map((s, i) => (
            <Button3D key={s.id} icon="walk" label={t('Stand at {x}', { x: s.name })} position={[-1.55, 0.3 - i * 0.18, 0.3]} width={0.95} height={0.13} color="#b5562b" onClick={() => useXRApp.getState().selectSite(s.id, s.body)} />
          ))}
        </>
      )}
    </group>
  )
}

/** VR: switch NASA image layers on the globe, with the legend and credit of the one shown. */
function LayerPicker3D({ body, layers, active }: { body: string; layers: DataLayer[]; active?: string }) {
  const layer = layers.find((l) => l.id === active) ?? layers[0]
  return (
    <group position={[1.55, -0.85, 0.3]} rotation={[0, -0.45, 0]} scale={0.32}>
      <Choice3D label={tr('NASA image layer')} value={layer.id} options={layers.map((l) => ({ value: l.id, label: tr(l.label) }))} onChange={(v) => useXRApp.getState().setLayer(body, v)} position={[0, 0, 0]} width={2.4} />
      {layer.legend && (
        <group position={[0, -0.45, 0]}>
          {layer.legend.stops.map((c, i) => (
            <mesh key={c} geometry={roundedRect(2.4 / layer.legend!.stops.length, 0.09, 0.01)} material={uiMat(c)} position={[-1.2 + (2.4 / layer.legend!.stops.length) * (i + 0.5), 0, 0]} />
          ))}
          <Label text={layer.legend.min} position={[-1.2, -0.14, 0.005]} size={UI.type.tiny} />
          <Label text={layer.legend.max} position={[1.2, -0.14, 0.005]} size={UI.type.tiny} anchorX="right" />
        </group>
      )}
      <Label text={tr(layer.credit)} position={[-1.2, layer.legend ? -0.36 : -0.32, 0.005]} size={UI.type.tiny} color={UI.muted} maxWidth={2.4} />
    </group>
  )
}
