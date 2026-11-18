// Test: a spot pinned on a table stays on that spot in the camera picture while the phone moves.
// Frames are rendered from a known camera path over a textured table, so where the spot really is, is known.
//   node scripts/test-visual-tracker.mjs
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dir = mkdtempSync(join(tmpdir(), 'vt-'))
const out = join(dir, 'tracker.mjs')
await build({ entryPoints: [join(here, '../src/xr/visualTracker.ts')], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' })
const { createTracker } = await import(pathToFileURL(out).href)

let failed = 0
function check(name, ok, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

// ---- a textured table ----
function hash(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967295
}
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z)
  const fx = x - ix, fz = z - iz
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz)
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1)
  return (a * (1 - sx) + b * sx) * (1 - sz) + (c * (1 - sx) + d * sx) * sz
}
const table = (x, z) => 40 + 175 * (0.45 * noise(x / 0.05, z / 0.05) + 0.35 * noise(x / 0.13, z / 0.13) + 0.2 * noise(x / 0.4, z / 0.4))

// ---- a pinhole camera over the table ----
const W = 96
const H = 128
const F_TRUE = 100
const PLANE_Y = -0.5
function rotation(yaw, pitchDown) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw)
  const cp = Math.cos(-pitchDown), sp = Math.sin(-pitchDown)
  const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy]
  const Rx = [1, 0, 0, 0, cp, -sp, 0, sp, cp]
  const C = new Array(9).fill(0)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) C[i * 3 + j] += Ry[i * 3 + k] * Rx[k * 3 + j]
  return Float64Array.from(C)
}
function render(pos, R, texture = table) {
  const img = new Uint8Array(W * H)
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const u = (i + 0.5 - W / 2) / F_TRUE
      const v = -(j + 0.5 - H / 2) / F_TRUE
      const dx = R[0] * u + R[1] * v - R[2], dy = R[3] * u + R[4] * v - R[5], dz = R[6] * u + R[7] * v - R[8]
      if (dy > -0.03) { img[j * W + i] = 235; continue }
      const s = (PLANE_Y - pos[1]) / dy
      img[j * W + i] = texture(pos[0] + s * dx, pos[2] + s * dz)
    }
  }
  return img
}
/** where a world point appears in the picture */
function project(P, pos, R) {
  const d = [P[0] - pos[0], P[1] - pos[1], P[2] - pos[2]]
  const x = R[0] * d[0] + R[3] * d[1] + R[6] * d[2]
  const y = R[1] * d[0] + R[4] * d[1] + R[7] * d[2]
  const z = R[2] * d[0] + R[5] * d[1] + R[8] * d[2]
  return { x: W / 2 + (F_TRUE * x) / -z, y: H / 2 - (F_TRUE * y) / -z, size: 1 / -z }
}

const PITCH = (40 * Math.PI) / 180
// a spot on the table where the phone points to start with (40 degrees down, 0.5 m above the table)
const SPOT = [0, PLANE_Y, -(0.5 / Math.tan(PITCH))]

function run({ path, fGuess, texture, gyroNoise = 0 }) {
  const tracker = createTracker(W, H, fGuess)
  let seed = 11
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5 }
  let worst = 0
  let end = 0
  let size0 = null
  let sizeNow = null
  for (let i = 0; i < path.length; i++) {
    const { pos, yaw, pitch } = path[i]
    const Rtrue = rotation(yaw, pitch)
    const Rgyro = rotation(yaw + gyroNoise * rnd(), pitch + gyroNoise * rnd())
    tracker.update(render(pos, Rtrue, texture), Rgyro)
    const truth = project(SPOT, pos, Rtrue)
    if (i === 0) {
      tracker.place(truth.x, truth.y)
      size0 = truth.size
    } else if (tracker.anchor.valid) {
      const e = Math.hypot(tracker.anchor.x - truth.x, tracker.anchor.y - truth.y)
      worst = Math.max(worst, e)
      end = e
      sizeNow = truth.size
    }
  }
  return { tracker, worst, end, zoomTrue: sizeNow / size0 }
}

const N = 110
const slide = Array.from({ length: N }, (_, i) => ({ pos: [0.0036 * i, 0, 0], yaw: 0.45 * Math.sin(i / 14), pitch: PITCH }))
{
  const r = run({ path: slide, fGuess: 0.7 * F_TRUE })
  check('slide 0.4 m sideways while turning: the spot stays on the table (focal length guessed 30% too low)', r.end < 5 && r.worst < 6, `end ${r.end.toFixed(1)} px, worst ${r.worst.toFixed(1)} px of a ${W}x${H} picture`)
  check('... followed by the picture, not only by the sensors', r.tracker.mode === 'picture' && r.tracker.inliers >= 12, `mode ${r.tracker.mode}, ${r.tracker.inliers} patches agree`)
}
{
  const r = run({ path: slide, fGuess: 1.25 * F_TRUE })
  check('same with the focal length guessed 25% too high', r.end < 5 && r.worst < 6, `end ${r.end.toFixed(1)} px, worst ${r.worst.toFixed(1)} px`)
}
{
  // for comparison: the same slide followed by the sensors alone (a blank-picture run does exactly that)
  const r = run({ path: slide, fGuess: F_TRUE, texture: () => 128 })
  check('for comparison, the sensors alone slide off the spot by far more', r.end > 20, `end ${r.end.toFixed(1)} px`)
}
const walk = Array.from({ length: N }, (_, i) => ({ pos: [0, 0, -0.003 * i], yaw: 0.2 * Math.sin(i / 20), pitch: PITCH }))
{
  const r = run({ path: walk, fGuess: F_TRUE })
  check('walk 0.33 m towards the spot: it stays on the table', r.end < 3.5 && r.worst < 5, `end ${r.end.toFixed(1)} px, worst ${r.worst.toFixed(1)} px`)
  check('... and the table looks bigger by about the right amount', Math.abs(r.tracker.anchor.scale - r.zoomTrue) / r.zoomTrue < 0.2, `zoom ${r.tracker.anchor.scale.toFixed(2)}, true ${r.zoomTrue.toFixed(2)}`)
}
{
  const r = run({ path: slide, fGuess: F_TRUE, gyroNoise: 0.004 })
  check('with a noisy gyroscope the spot still stays on the table', r.end < 5 && r.worst < 6, `end ${r.end.toFixed(1)} px, worst ${r.worst.toFixed(1)} px`)
}
const spin = Array.from({ length: 80 }, (_, i) => ({ pos: [0, 0, 0], yaw: 0.6 * Math.sin(i / 12), pitch: PITCH + 0.15 * Math.sin(i / 17) }))
{
  const r = run({ path: spin, fGuess: F_TRUE })
  check('turning the phone on the spot: the spot stays on the table', r.end < 2.5 && r.worst < 4, `end ${r.end.toFixed(1)} px, worst ${r.worst.toFixed(1)} px`)
}
{
  // a blank wall: nothing to follow, so the sensors' turning has to carry it (with the right focal length)
  const r = run({ path: spin, fGuess: F_TRUE, texture: () => 128 })
  check('a blank picture: falls back to the sensors and still follows the turning', r.tracker.mode === 'gyro' && r.end < 2.5, `mode ${r.tracker.mode}, end ${r.end.toFixed(1)} px`)
}

console.log(`\n${failed === 0 ? 'All checks passed' : `${failed} check(s) FAILED`}`)
process.exit(failed ? 1 : 0)
