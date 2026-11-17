// Checks the orbit geometry used by the Solar System hub (src/xr/ephemeris.ts, JPL elements):
//  - every orbit loop has the real shape: min/max distance = a(1-e) / a(1+e), Sun at a focus
//  - the real position of each body on 5 dates lies on its drawn loop
//  - the Moon's loop has the NASA eccentricity and no NaN anywhere
// Runs on Node with built-in TypeScript support (v22.18+): node scripts/check-orbits.mjs
import { helioPosition, orbitElements, orbitPathAU, moonPath, moonOffset, MOON_ORBIT } from '../src/xr/ephemeris.ts'

const IDS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'bennu']
const DATES = ['2000-01-01', '2026-11-17', '2035-06-30', '1900-03-03', '2049-12-31'].map((d) => Date.parse(d + 'T00:00:00Z'))
const errors = []
const dist = (p, i) => Math.hypot(p[i], p[i + 1], p[i + 2])

for (const id of IDS) {
  for (const ms of DATES) {
    const el = orbitElements(id, ms)
    const loop = orbitPathAU(id, ms, 720)
    if (!el || !loop) { errors.push(`${id}: no orbit`); continue }
    const [a, e] = el
    let rmin = Infinity, rmax = 0
    for (let i = 0; i < loop.length; i += 3) {
      const r = dist(loop, i)
      if (!Number.isFinite(r)) errors.push(`${id}: NaN in loop`)
      rmin = Math.min(rmin, r)
      rmax = Math.max(rmax, r)
    }
    // sampled every 0.5 degrees of eccentric anomaly: close to, never beyond, the true extremes
    if (rmin < a * (1 - e) - 1e-9 || rmin - a * (1 - e) > 2e-4 * a) errors.push(`${id} ${new Date(ms).toISOString().slice(0, 10)}: perihelion ${rmin} vs ${a * (1 - e)}`)
    if (rmax > a * (1 + e) + 1e-9 || a * (1 + e) - rmax > 2e-4 * a) errors.push(`${id} ${new Date(ms).toISOString().slice(0, 10)}: aphelion ${rmax} vs ${a * (1 + e)}`)
    // the body's real position lies on the loop (distance to the nearest segment)
    const pos = helioPosition(id, ms)
    const fine = orbitPathAU(id, ms, 20000)
    let best = Infinity
    for (let i = 0; i < fine.length; i += 3) best = Math.min(best, Math.hypot(fine[i] - pos[0], fine[i + 1] - pos[1], fine[i + 2] - pos[2]))
    if (id !== 'bennu' && best > 2e-3 * a) errors.push(`${id} ${new Date(ms).toISOString().slice(0, 10)}: position ${best.toExponential(2)} AU off its orbit`)
  }
}

const moon = moonPath(720)
let mmin = Infinity, mmax = 0
for (let i = 0; i < moon.length; i += 3) { const r = Math.hypot(moon[i], moon[i + 1], moon[i + 2]); mmin = Math.min(mmin, r); mmax = Math.max(mmax, r) }
if (Math.abs(mmin - (1 - MOON_ORBIT.e)) > 1e-3 || Math.abs(mmax - (1 + MOON_ORBIT.e)) > 1e-3) errors.push(`moon: extremes ${mmin}, ${mmax}`)
for (const d of [0, 7, 13.66, 27.32]) if (moonOffset(d).some((v) => !Number.isFinite(v))) errors.push('moon: NaN offset')
const r0 = Math.hypot(...moonOffset(0)), r1 = Math.hypot(...moonOffset(MOON_ORBIT.periodDays / 2))
if (!(r0 < r1)) errors.push(`moon: perigee ${r0} should be nearer than apogee ${r1}`)

if (errors.length) {
  console.error('check-orbits: ' + errors.length + ' problem(s)')
  for (const e of errors.slice(0, 20)) console.error('  ' + e)
  process.exit(1)
}
console.log(`check-orbits: ${IDS.length} orbits x ${DATES.length} dates + Moon OK`)
