// Fails (exit 1) if body narration coverage or hotspot content is incomplete or invalid.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const root = join(appRoot, 'content')
const dir = join(root, 'bodies')
const siteDir = join(root, 'sites')
const siteIds = new Set(readdirSync(siteDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)))
const bodiesModule = readFileSync(join(appRoot, 'src', 'xr', 'bodies.ts'), 'utf8')
const bodiesMatch = bodiesModule.match(/export const BODIES: BodyInfo\[\] = \[([\s\S]*?)\n\]/)
const KINDS = new Set(['fact', 'illustration', 'candidate'])
let provenance = {}
try {
  provenance = JSON.parse(readFileSync(join(appRoot, 'public', 'textures', 'provenance.json'), 'utf8'))
} catch {
  /* no generated textures yet */
}
const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length
const errors = []
const bodyRecords = new Map()
let count = 0

if (!bodiesMatch) errors.push('src/xr/bodies.ts: could not read the BODIES list')
const narrationBodyIds = [...(bodiesMatch?.[1] ?? '').matchAll(/\bid:\s*'([^']+)'/g)].map(([, id]) => id)
if (!narrationBodyIds.length) errors.push('src/xr/bodies.ts: the BODIES list has no readable body IDs')

const files = [
  ...readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ file: f, path: join(dir, f), site: false })),
  ...readdirSync(siteDir).filter((f) => f.endsWith('.json')).map((f) => ({ file: 'sites/' + f, path: join(siteDir, f), site: true })),
]
for (const { file, path, site } of files) {
  let body
  try {
    body = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    errors.push(`${file}: invalid JSON (${e.message})`)
    continue
  }
  if (!site && typeof body.id === 'string') bodyRecords.set(body.id, body)
  if (!site && body.texture) {
    const textureFile = join(appRoot, 'public', body.texture.replace(/^\//, ''))
    if (!existsSync(textureFile)) errors.push(`${file}: texture ${body.texture} is not in public/`)
    if (!String(body.textureCredit ?? '').trim()) errors.push(`${file}: texture needs a textureCredit that names the NASA source`)
    const kind = body.textureKind ?? 'data'
    if (kind !== 'data' && kind !== 'illustration') errors.push(`${file}: textureKind must be data|illustration`)
    if (kind === 'illustration' && !/illustration/i.test(String(body.textureCredit ?? ''))) errors.push(`${file}: an illustration texture must say so in textureCredit`)
    const recorded = provenance[body.id]
    if (recorded && recorded.kind !== kind) errors.push(`${file}: textureKind ${kind} differs from provenance kind ${recorded.kind}`)
    if (recorded && recorded.credit !== body.textureCredit) errors.push(`${file}: textureCredit differs from public/textures/provenance.json`)
  }
  const ids = new Set()
  for (const [i, h] of (body.hotspots ?? []).entries()) {
    const at = `${file} hotspot[${i}] ${h.id ?? '(no id)'}`
    count++
    if (!h.id) errors.push(`${at}: missing id`)
    else if (ids.has(h.id)) errors.push(`${at}: duplicate id`)
    ids.add(h.id)
    const owner = site ? body.body : body.id
    if (h.body !== owner) errors.push(`${at}: body "${h.body}" does not match "${owner}"`)
    if (h.site !== undefined && !siteIds.has(h.site)) errors.push(`${at}: site "${h.site}" has no content/sites/${h.site}.json`)
    if (!h.source || !h.source.label || !/^https?:\/\//.test(h.source.url ?? '')) errors.push(`${at}: missing source {label,url}`)
    if (!h.title) errors.push(`${at}: missing title`)
    if (!h.short || words(h.short) > 25) errors.push(`${at}: short must be 1-25 words (has ${words(h.short)})`)
    if (!h.detail || words(h.detail) > 80) errors.push(`${at}: detail must be 1-80 words (has ${words(h.detail)})`)
    if (!KINDS.has(h.kind)) errors.push(`${at}: kind must be fact|illustration|candidate`)
    if (!h.guidePrompt) errors.push(`${at}: missing guidePrompt`)
    const a = h.anchor ?? {}
    if (a.type === 'latlon') {
      if (typeof a.lat !== 'number' || typeof a.lon !== 'number') errors.push(`${at}: latlon anchor needs numeric lat/lon`)
    } else if (a.type === 'mesh') {
      if (!Array.isArray(a.point) || a.point.length !== 3) errors.push(`${at}: mesh anchor needs point [x,y,z]`)
    } else if (a.type === 'site') {
      if (!site) errors.push(`${at}: site anchors are only allowed in content/sites`)
      if (typeof a.x !== 'number' || typeof a.z !== 'number') errors.push(`${at}: site anchor needs numeric x/z (metres)`)
    } else errors.push(`${at}: anchor.type must be latlon|mesh|site`)
  }
}

for (const id of narrationBodyIds) {
  const body = bodyRecords.get(id)
  if (!body) {
    errors.push(`bodies/${id}.json: required body content is missing`)
    continue
  }
  if (typeof body.description?.en !== 'string' || !body.description.en.trim()) {
    errors.push(`bodies/${id}.json: English narration description is required`)
  }
  if (typeof body.description?.id !== 'string' || !body.description.id.trim()) {
    errors.push(`bodies/${id}.json: Indonesian description is required`)
  }
  if (!body.source?.label || !/^https?:\/\//.test(body.source.url ?? '')) {
    errors.push(`bodies/${id}.json: source {label,url} is required`)
  }
}

if (errors.length) {
  console.error(`check-content: ${errors.length} problem(s)\n  ` + errors.join('\n  '))
  process.exit(1)
}
console.log(`check-content: ${count} hotspots OK`)
