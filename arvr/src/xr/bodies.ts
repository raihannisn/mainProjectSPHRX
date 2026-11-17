/**
 * Solar System chart. Real data in, one honest compression out:
 *  - `au`: mean distance from the Sun (semi-major axis; NASA JPL approximate elements, Bennu from the JPL SBDB)
 *  - `radiusKm`: volumetric mean radius (NASA Planetary Fact Sheet; Bennu from OSIRIS-REx)
 * The true scale cannot be drawn on one screen (Neptune is 30 AU out, Earth is 0.00004 AU wide), so both are
 * compressed with a power law. Order, and which body is bigger or farther, stay true; the ratios shrink.
 */
export interface BodyInfo {
  id: string
  name: string
  kind: 'star' | 'planet' | 'asteroid'
  color: string
  /** mean distance from the Sun in AU (0 for the Sun and for moons) */
  au: number
  /** mean radius in km */
  radiusKm: number
  /** orbit radius in hub units (derived from `au`) */
  orbit: number
  /** display radius in hub units (derived from `radiusKm`) */
  size: number
  rings?: boolean
  /** a moon: drawn next to its planet instead of on its own orbit */
  parent?: string
}

/** Hub radius of Neptune's orbit, and the exponents of the two compressions. */
export const HUB_RADIUS = 3.15
export const DISTANCE_EXPONENT = 1 / 3
export const SIZE_EXPONENT = 0.45
const NEPTUNE_AU = 30.06992276
const EARTH_RADIUS_KM = 6371
/** display radius of Earth in hub units */
const EARTH_SIZE = 0.045
/** below this a body would be a single pixel on a phone (Bennu is 490 m across) */
const MIN_SIZE = 0.02

export const hubOrbit = (au: number) => (au <= 0 ? 0 : HUB_RADIUS * Math.pow(au / NEPTUNE_AU, DISTANCE_EXPONENT))
export const hubSize = (radiusKm: number) => Math.max(MIN_SIZE, EARTH_SIZE * Math.pow(radiusKm / EARTH_RADIUS_KM, SIZE_EXPONENT))

type BodySeed = Omit<BodyInfo, 'orbit' | 'size'>
const body = (b: BodySeed): BodyInfo => ({ ...b, orbit: hubOrbit(b.au), size: hubSize(b.radiusKm) })

// kept as one literal list: scripts/check-content.mjs reads the body IDs from it
export const BODIES: BodyInfo[] = [
  body({ id: 'sun', name: 'Sun', kind: 'star', color: '#ffcc55', au: 0, radiusKm: 695700 }),
  body({ id: 'mercury', name: 'Mercury', kind: 'planet', color: '#a9a39b', au: 0.38709927, radiusKm: 2439.7 }),
  body({ id: 'venus', name: 'Venus', kind: 'planet', color: '#e8c48a', au: 0.72333566, radiusKm: 6051.8 }),
  body({ id: 'earth', name: 'Earth', kind: 'planet', color: '#3d7bd9', au: 1.00000261, radiusKm: 6371 }),
  body({ id: 'moon', name: 'Moon', kind: 'planet', color: '#bdb8b0', au: 0, radiusKm: 1737.4, parent: 'earth' }),
  body({ id: 'bennu', name: 'Bennu', kind: 'asteroid', color: '#8a847c', au: 1.1264, radiusKm: 0.245 }),
  body({ id: 'mars', name: 'Mars', kind: 'planet', color: '#c1440e', au: 1.52371034, radiusKm: 3389.5 }),
  body({ id: 'jupiter', name: 'Jupiter', kind: 'planet', color: '#d6a26b', au: 5.202887, radiusKm: 69911 }),
  body({ id: 'saturn', name: 'Saturn', kind: 'planet', color: '#e3cf8f', au: 9.53667594, radiusKm: 58232, rings: true }),
  body({ id: 'uranus', name: 'Uranus', kind: 'planet', color: '#8fd4e0', au: 19.18916464, radiusKm: 25362 }),
  body({ id: 'neptune', name: 'Neptune', kind: 'planet', color: '#4a6fe0', au: 30.06992276, radiusKm: 24622 }),
]

export const BODY_BY_ID = Object.fromEntries(BODIES.map((b) => [b.id, b])) as Record<string, BodyInfo>
/** Not a body: the SPHEREx sky-on-a-table scene, reached like one (/xr/body/spherex). */
BODY_BY_ID.spherex = { id: 'spherex', name: 'SPHEREx sky', kind: 'planet', color: '#4fe3d6', au: 0, radiusKm: 0, orbit: 0, size: 0 }

export const KIND_COLORS = {
  fact: '#4fd1ff',
  illustration: '#38bdf8',
  candidate: '#ffb347',
} as const
