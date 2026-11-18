/**
 * Keeps a spot on the table fixed in the camera picture while the phone moves.
 *
 * A phone's motion sensors know how the phone TURNS but not where it MOVES, so a model pinned with the sensors alone
 * slides over the table as soon as you walk or lean. The camera picture knows both: this follows a grid of small
 * patches from frame to frame (Lucas-Kanade, started from where the gyroscope says they went), fits how the table
 * moved in the picture (a shift, a turn and a zoom), and carries the pinned spot along with it. If too little of the
 * table can be followed (a blank wall, a very fast pan), the gyroscope's turning carries the spot instead.
 *
 * Image pixels: origin top-left, y down. Camera space: x right, y up, looking down -z (three.js).
 * Pure functions on gray images, so it runs (and is tested) without a browser.
 */

export interface Anchor {
  /** the pinned spot, in pixels of the tracked frame */
  x: number
  y: number
  /** how much bigger the table looks than when it was pinned (the phone came closer: > 1) */
  scale: number
  valid: boolean
}

export interface Tracker {
  anchor: Anchor
  /** how the last frame was followed */
  mode: 'picture' | 'gyro' | 'idle'
  /** patches followed in the last frame, and how many of them agreed on how the table moved */
  tracked: number
  inliers: number
  /** pin the spot at this pixel */
  place: (x: number, y: number) => void
  clear: () => void
  update: (gray: Uint8Array, R: ArrayLike<number>) => void
}

/** Rotation matrices are row-major 3x3, camera -> world. */
export function rotationFromQuaternion(q: { x: number; y: number; z: number; w: number }, out: Float64Array = new Float64Array(9)) {
  const { x, y, z, w } = q
  out[0] = 1 - 2 * (y * y + z * z)
  out[1] = 2 * (x * y - z * w)
  out[2] = 2 * (x * z + y * w)
  out[3] = 2 * (x * y + z * w)
  out[4] = 1 - 2 * (x * x + z * z)
  out[5] = 2 * (y * z - x * w)
  out[6] = 2 * (x * z - y * w)
  out[7] = 2 * (y * z + x * w)
  out[8] = 1 - 2 * (x * x + y * y)
  return out
}

const HALF = 5 // a patch is 11 x 11 pixels
const ITER = 5
const MIN_TEXTURE = 6 // smallest eigenvalue of the patch's gradient matrix, per pixel
const MAX_STEP = 12 // a patch may land this far from where the turning says it should
const MIN_INLIERS = 12

function sample(img: Uint8Array, w: number, h: number, x: number, y: number) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  if (x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h) return -1
  const fx = x - x0
  const fy = y - y0
  const i = y0 * w + x0
  return (img[i] * (1 - fx) + img[i + 1] * fx) * (1 - fy) + (img[i + w] * (1 - fx) + img[i + w + 1] * fx) * fy
}

/** Solves the n x n system A x = b by Gaussian elimination with pivoting; null when singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    if (Math.abs(M[p][c]) < 1e-9) return null
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = c + 1; r < n; r++) {
      const k = M[r][c] / M[c][c]
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n]
    for (let j = r + 1; j < n; j++) s -= M[r][j] * x[j]
    x[r] = s / M[r][r]
  }
  return x
}

/**
 * @param fPx focal length of the tracked frame, in its pixels. Only the gyroscope's guess of where a patch went
 * depends on it (the pictures themselves do not), so a rough value is fine.
 */
export function createTracker(width: number, height: number, fPx: number): Tracker {
  const w = width
  const h = height
  const cx = w / 2
  const cy = h / 2
  const cols = 10
  const rows = Math.max(6, Math.round((cols * h) / w))
  const margin = HALF + 3
  const grid: { x: number; y: number }[] = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      grid.push({ x: Math.round(margin + ((w - 2 * margin) * (i + 0.5)) / cols), y: Math.round(margin + ((h - 2 * margin) * (j + 0.5)) / rows) })
    }
  }
  let prev: Uint8Array | null = null
  const prevR = new Float64Array(9)

  /** where the turning alone (camera R_prev -> R_cur) carries pixel (x, y); null when it leaves the picture */
  function turned(x: number, y: number, R: ArrayLike<number>): [number, number] | null {
    const rx = (x - cx) / fPx
    const ry = -(y - cy) / fPx
    const dx = prevR[0] * rx + prevR[1] * ry - prevR[2]
    const dy = prevR[3] * rx + prevR[4] * ry - prevR[5]
    const dz = prevR[6] * rx + prevR[7] * ry - prevR[8]
    const ax = R[0] * dx + R[3] * dy + R[6] * dz
    const ay = R[1] * dx + R[4] * dy + R[7] * dz
    const az = R[2] * dx + R[5] * dy + R[8] * dz
    if (az > -0.15) return null
    return [cx + (fPx * ax) / -az, cy - (fPx * ay) / -az]
  }

  const tracker: Tracker = {
    anchor: { x: cx, y: cy, scale: 1, valid: false },
    mode: 'idle',
    tracked: 0,
    inliers: 0,
    place(x, y) {
      tracker.anchor = { x, y, scale: 1, valid: true }
    },
    clear() {
      tracker.anchor.valid = false
      prev = null
    },
    update(gray, R) {
      if (!prev) {
        prev = gray.slice()
        prevR.set(R as ArrayLike<number> as Float64Array)
        tracker.mode = 'idle'
        return
      }
      const pts: { x: number; y: number; qx: number; qy: number }[] = []
      for (const p of grid) {
        const guess = turned(p.x, p.y, R)
        if (!guess) continue
        const [q0x, q0y] = guess
        if (q0x < margin || q0y < margin || q0x > w - margin || q0y > h - margin) continue
        // Lucas-Kanade on the patch around (p.x, p.y) of the previous picture
        let g11 = 0
        let g12 = 0
        let g22 = 0
        const gxs: number[] = []
        const gys: number[] = []
        const vals: number[] = []
        for (let oy = -HALF; oy <= HALF; oy++) {
          for (let ox = -HALF; ox <= HALF; ox++) {
            const i = (p.y + oy) * w + (p.x + ox)
            const gx = (prev[i + 1] - prev[i - 1]) / 2
            const gy = (prev[i + w] - prev[i - w]) / 2
            gxs.push(gx)
            gys.push(gy)
            vals.push(prev[i])
            g11 += gx * gx
            g12 += gx * gy
            g22 += gy * gy
          }
        }
        const n = gxs.length
        const tr = g11 + g22
        const det = g11 * g22 - g12 * g12
        const minEig = (tr - Math.sqrt(Math.max(0, tr * tr - 4 * det))) / 2 / n
        if (minEig < MIN_TEXTURE) continue
        let qx = q0x
        let qy = q0y
        let ok = true
        for (let it = 0; it < ITER && ok; it++) {
          let b1 = 0
          let b2 = 0
          let k = 0
          for (let oy = -HALF; oy <= HALF && ok; oy++) {
            for (let ox = -HALF; ox <= HALF; ox++, k++) {
              const c = sample(gray, w, h, qx + ox, qy + oy)
              if (c < 0) {
                ok = false
                break
              }
              const d = vals[k] - c
              b1 += gxs[k] * d
              b2 += gys[k] * d
            }
          }
          if (!ok) break
          const sx = (g22 * b1 - g12 * b2) / det
          const sy = (-g12 * b1 + g11 * b2) / det
          qx += sx
          qy += sy
          if (Math.hypot(qx - q0x, qy - q0y) > MAX_STEP) ok = false
          else if (Math.abs(sx) + Math.abs(sy) < 0.02) break
        }
        if (ok) pts.push({ x: p.x, y: p.y, qx, qy })
      }
      tracker.tracked = pts.length

      // how the table moved in the picture around the pinned spot: a shift, a turn, a zoom and a squeeze (an affine
      // fit, weighted towards the patches near the spot, because a table seen at an angle moves faster near you
      // than far away), with the odd one out ignored
      let moved = false
      tracker.inliers = 0
      if (pts.length >= MIN_INLIERS) {
        const ax = tracker.anchor.x
        const ay = tracker.anchor.y
        const sigmaNear = Math.max(22, 0.28 * Math.max(w, h))
        const near = pts.map((p) => Math.exp(-((p.x - ax) ** 2 + (p.y - ay) ** 2) / (2 * sigmaNear * sigmaNear)))
        let robust = new Float64Array(pts.length).fill(1)
        let sol: { M: number[]; t: number[] } | null = null
        for (let round = 0; round < 4; round++) {
          // q - anchor = M (p - anchor) + t, one 3-unknown least squares for each coordinate
          const A = [0, 0, 0].map(() => [0, 0, 0])
          const bx = [0, 0, 0]
          const by = [0, 0, 0]
          pts.forEach((p, i) => {
            const wt = near[i] * robust[i]
            const row = [p.x - ax, p.y - ay, 1]
            for (let a = 0; a < 3; a++) {
              bx[a] += wt * row[a] * (p.qx - ax)
              by[a] += wt * row[a] * (p.qy - ay)
              for (let b = 0; b < 3; b++) A[a][b] += wt * row[a] * row[b]
            }
          })
          // a tiny pull towards "no change" keeps the fit sane when the patches are bunched
          for (let a = 0; a < 2; a++) A[a][a] += 1e-3
          const sx = solve(A, bx)
          const sy = solve(A, by)
          if (!sx || !sy) break
          sol = { M: [sx[0], sx[1], sy[0], sy[1]], t: [sx[2], sy[2]] }
          const errs = pts.map((p) => Math.hypot(p.qx - ax - (sx[0] * (p.x - ax) + sx[1] * (p.y - ay) + sx[2]), p.qy - ay - (sy[0] * (p.x - ax) + sy[1] * (p.y - ay) + sy[2])))
          const sorted = [...errs].sort((a, b) => a - b)
          const sigma = Math.max(0.7, 1.8 * sorted[Math.floor(sorted.length / 2)])
          robust = Float64Array.from(errs, (e) => 1 / (1 + (e / sigma) * (e / sigma)))
          tracker.inliers = errs.filter((e) => e < sigma * 1.5).length
        }
        if (sol && tracker.inliers >= MIN_INLIERS) {
          const det = sol.M[0] * sol.M[3] - sol.M[1] * sol.M[2]
          const s = Math.sqrt(Math.abs(det))
          if (det > 0 && s > 0.8 && s < 1.25 && Math.hypot(sol.t[0], sol.t[1]) < 60) {
            tracker.anchor.x = ax + sol.t[0]
            tracker.anchor.y = ay + sol.t[1]
            tracker.anchor.scale = Math.max(0.3, Math.min(4, tracker.anchor.scale * s))
            moved = true
          }
        }
      }
      tracker.mode = moved ? 'picture' : 'gyro'
      if (!moved && tracker.anchor.valid) {
        // too little to follow: let the turning carry the spot (what the sensors alone would do)
        const t = turned(tracker.anchor.x, tracker.anchor.y, R)
        if (t) {
          tracker.anchor.x = t[0]
          tracker.anchor.y = t[1]
        }
      }
      prev = gray.slice()
      prevR.set(R as ArrayLike<number> as Float64Array)
    },
  }
  return tracker
}
