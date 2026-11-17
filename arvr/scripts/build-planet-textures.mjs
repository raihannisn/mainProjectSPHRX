// Builds the planet colour textures from NASA sources into public/textures/<id>.jpg (equirectangular, 2:1)
// and records where every pixel came from in public/textures/provenance.json.
//
//   node scripts/build-planet-textures.mjs            all bodies below
//   node scripts/build-planet-textures.mjs venus      only these
//
// Sources (all NASA; see docs/PLANET_TEXTURES_AND_ORBITS_PLAN.md, section 3):
//   mercury  NASA Mercury Trek, MESSENGER MDIS BDR global mosaic 166 m (WMTS tiles, monochrome)
//   venus    NASA 3D Resources Venus.jpg (Magellan radar, gaps filled)
//   earth    NASA GIBS Blue Marble Next Generation (WMTS tiles)
//   jupiter  NASA Photojournal PIA07782, Cassini ISS cylindrical map
//   saturn   NASA 3D Resources Saturn.jpg   } illustrations: NASA's own pages call them fictional, so they are
//   neptune  NASA 3D Resources Neptune.jpg  } recorded with kind "illustration" and never shown as mission data
// The script fails loudly if a tile or file cannot be fetched: nothing is patched over silently.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'textures')
const WIDTH = 2048
const HEIGHT = 1024
const MAX_BYTES = 700 * 1024

const sha = (buf) => createHash('sha256').update(buf).digest('hex')

async function get(url, tries = 4) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 600 * (i + 1)))
    }
  }
  throw new Error(`${url}: ${last?.message ?? last}`)
}

/** Fetch a cols x rows grid of tiles (limited concurrency) and stitch them into one image. */
async function stitch(cols, rows, tile, urlOf) {
  const jobs = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) jobs.push({ r, c, url: urlOf(r, c) })
  const out = []
  let next = 0
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < jobs.length) {
        const j = jobs[next++]
        const buf = await get(j.url)
        const img = sharp(buf)
        const meta = await img.metadata()
        if (meta.width !== tile || meta.height !== tile) throw new Error(`${j.url}: tile is ${meta.width}x${meta.height}, expected ${tile}`)
        out.push({ ...j, buf: await img.removeAlpha().toColourspace('srgb').raw().toBuffer(), hash: sha(buf) })
      }
    }),
  )
  out.sort((a, b) => a.r - b.r || a.c - b.c)
  const w = cols * tile
  const h = rows * tile
  const raw = Buffer.alloc(w * h * 3)
  for (const t of out) {
    for (let y = 0; y < tile; y++) t.buf.copy(raw, ((t.r * tile + y) * w + t.c * tile) * 3, y * tile * 3, (y + 1) * tile * 3)
  }
  return { raw, w, h, urls: out.map((t) => t.url), tilesHash: sha(Buffer.from(out.map((t) => t.hash).join(''))) }
}

const TREK = 'https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m/1.0.0//default/default028mm'
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_NextGeneration/default/500m'

const BODIES = {
  mercury: {
    kind: 'data',
    credit: 'NASA MESSENGER MDIS global mosaic, 166 m, monochrome (NASA Mercury Trek)',
    async fetch() {
      // zoom 3 of the 2:1 global matrix = 16 x 8 tiles of 256 px = 4096 x 2048
      const s = await stitch(16, 8, 256, (r, c) => `${TREK}/3/${r}/${c}.jpg`)
      return { image: sharp(s.raw, { raw: { width: s.w, height: s.h, channels: 3 } }), source: s.urls[0].replace(/\/0\/0\.jpg$/, '/{row}/{col}.jpg') + ` (${s.urls.length} tiles)`, inputHash: s.tilesHash }
    },
  },
  earth: {
    kind: 'data',
    credit: 'NASA Blue Marble Next Generation (MODIS), via NASA GIBS',
    async fetch() {
      // zoom 3 of the EPSG:4326 set = 10 x 5 tiles of 512 px = 5120 x 2560, exactly 360 x 180 degrees
      const s = await stitch(10, 5, 512, (r, c) => `${GIBS}/3/${r}/${c}.jpeg`)
      return { image: sharp(s.raw, { raw: { width: s.w, height: s.h, channels: 3 } }), source: `${GIBS}/3/{row}/{col}.jpeg (${s.urls.length} tiles)`, inputHash: s.tilesHash }
    },
  },
  venus: {
    kind: 'data',
    credit: 'NASA/JPL-Caltech: Magellan radar mosaic with gaps filled; radar has no visible colour, so the orange tint is artificial (NASA 3D Resources)',
    async fetch() {
      const url = 'https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/venus/Venus.jpg'
      const buf = await get(url)
      return { image: sharp(buf), source: url, inputHash: sha(buf) }
    },
    keepSize: true, // 1440 x 720 already: do not upscale
  },
  jupiter: {
    kind: 'data',
    credit: 'NASA/JPL/Space Science Institute: Cassini ISS cylindrical map of Jupiter (PIA07782)',
    async fetch() {
      const url = 'https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia07/pia07782/PIA07782.jpg'
      const buf = await get(url)
      return { image: sharp(buf), source: url, inputHash: sha(buf) }
    },
  },
  saturn: {
    kind: 'illustration',
    credit: 'Illustration, not mission data: NASA/JPL-Caltech planetary map from NASA 3D Resources (NASA labels it fictional); ring geometry from the NASA NSSDC Saturnian Rings Fact Sheet',
    async fetch() {
      const url = 'https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/saturn/Saturn.jpg'
      const buf = await get(url)
      return { image: sharp(buf), source: url, inputHash: sha(buf) }
    },
    keepSize: true, // 720 x 360 already: do not upscale
  },
  neptune: {
    kind: 'illustration',
    credit: 'Illustration, not mission data: texture by Don Davis with JPL/Caltech cloud features (NASA 3D Resources; NASA labels it fictional)',
    async fetch() {
      const url = 'https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/neptune/Neptune.jpg'
      const buf = await get(url)
      return { image: sharp(buf), source: url, inputHash: sha(buf) }
    },
    keepSize: true,
  },
}

const wanted = process.argv.slice(2)
const ids = wanted.length ? wanted : Object.keys(BODIES)
for (const id of ids) if (!BODIES[id]) throw new Error(`unknown body "${id}" (known: ${Object.keys(BODIES).join(', ')})`)

mkdirSync(outDir, { recursive: true })
const provPath = join(outDir, 'provenance.json')
let provenance = {}
try {
  provenance = JSON.parse(readFileSync(provPath, 'utf8'))
} catch {
  /* first run */
}

for (const id of ids) {
  const b = BODIES[id]
  process.stdout.write(`${id}: fetching… `)
  const { image, source, inputHash } = await b.fetch()
  const meta = await image.clone().metadata()
  if (!meta.width || !meta.height || Math.abs(meta.width / meta.height - 2) > 0.01) throw new Error(`${id}: source is ${meta.width}x${meta.height}, not 2:1 equirectangular`)
  const w = b.keepSize ? meta.width : Math.min(WIDTH, meta.width)
  const h = Math.round(w / 2)
  let buf
  for (const quality of [86, 82, 78, 74, 70]) {
    buf = await image.clone().resize(w, h, { kernel: 'lanczos3' }).removeAlpha().toColourspace('srgb').jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer()
    if (buf.length <= MAX_BYTES) break
  }
  if (buf.length > MAX_BYTES) throw new Error(`${id}: ${buf.length} bytes is over the ${MAX_BYTES} budget even at quality 70`)
  const file = join(outDir, `${id}.jpg`)
  writeFileSync(file, buf)
  provenance[id] = {
    file: `textures/${id}.jpg`,
    kind: b.kind,
    credit: b.credit,
    source,
    sourceSha256: inputHash,
    retrieved: new Date().toISOString().slice(0, 10),
    width: w,
    height: h,
    bytes: statSync(file).size,
    sha256: sha(buf),
  }
  console.log(`${w}x${h}, ${(buf.length / 1024).toFixed(0)} KB`)
}
const sorted = Object.fromEntries(Object.entries(provenance).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(provPath, JSON.stringify(sorted, null, 2) + '\n')
console.log(`wrote ${provPath}`)
