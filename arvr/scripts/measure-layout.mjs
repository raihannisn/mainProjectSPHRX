// Layout fingerprint: bounding boxes of the structural elements of the Gateway, Sky Explorer and Comparison
// at eight screen sizes, as JSON. Run it before and after a change and diff the two files to show what moved.
//   node scripts/measure-layout.mjs --base=http://localhost:5173 --out=layout-before.json
//   node scripts/measure-layout.mjs --base=http://localhost:5173 --out=layout-after.json
//   node scripts/measure-layout.mjs --diff=layout-before.json,layout-after.json
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || 'true'] }))

if (args.diff) {
  const [a, b] = args.diff.split(',').map((f) => JSON.parse(readFileSync(f, 'utf8')))
  let moved = 0, same = 0
  const added = []
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(key in a)) { added.push(key); continue }
    if (!(key in b)) { console.log(`REMOVED  ${key}`); moved++; continue }
    if (JSON.stringify(a[key]) === JSON.stringify(b[key])) same++
    else { moved++; console.log(`MOVED    ${key}\n   before ${JSON.stringify(a[key])}\n   after  ${JSON.stringify(b[key])}`) }
  }
  for (const key of added) console.log(`ADDED    ${key}  ${JSON.stringify(b[key])}`)
  console.log(`\n${same} elements identical, ${moved} moved or removed, ${added.length} added`)
  process.exit(0)
}

const base = args.base ?? 'http://localhost:5173'
const VIEWPORTS = [[320, 640], [360, 800], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [844, 390]]
const PAGES = {
  gateway: { path: '/', sel: ['.fe-island', '.fe-nav-link', '.fe-hero-copy h1', '.fe-lead', '.fe-button-row > *', '.fe-sky-art', '.fe-step', '.fe-cap'] },
  explorer: {
    path: '/explorer',
    sel: ['.fe-island', '.fe-nav-link', '.fe-viewport', '.fe-sky-title', '.fe-toolbar', '.fe-view-hint', '.fe-target-chip', '.fe-hud', '.fe-hud-card', '.fe-hud-actions > *', '.fe-dock', '.fe-dock button'],
  },
  comparison: { path: '/comparison', sel: ['.fe-island', '.fe-nav-link', 'main > *'] },
}
const rcw = { id: 'rcw-36', name: 'RCW 36 Emission Nebula', type: 'Emission nebula', description: 'A compact H II star-forming region.', ra: 130.0367, dec: -43.0931, ra_hms: '08h 40m 08.8s', dec_dms: '-43° 05′ 35″', source: 'Object catalog and IRSA SIA2 (QA fixture)' }
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--use-gl=angle', '--ignore-gpu-blocklist'] })
const out = {}
for (const [w, h] of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.route('**/api/**', (r) => {
    const url = new URL(r.request().url())
    const body = url.pathname === '/api/objects/rcw-36' ? rcw : url.pathname === '/api/spherex/observations' ? { query: {}, source: 'QA', total_results: 0, observations: [] } : { status: 'ok', engine: 'stub' }
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  for (const [name, def] of Object.entries(PAGES)) {
    await page.goto(base + def.path, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.fe-island', { timeout: 30000 })
    await page.waitForTimeout(3500)
    const boxes = await page.evaluate((sels) => {
      const res = {}
      for (const sel of sels) {
        document.querySelectorAll(sel).forEach((el, i) => {
          const b = el.getBoundingClientRect()
          const label = el.getAttribute('aria-label') || (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)
          res[`${sel}#${i}:${label}`] = [Math.round(b.left), Math.round(b.top + scrollY), Math.round(b.width), Math.round(b.height)]
        })
      }
      return res
    }, def.sel)
    for (const [k, v] of Object.entries(boxes)) out[`${name}@${w}x${h} ${k}`] = v
  }
  await context.close()
}
await browser.close()
writeFileSync(args.out ?? 'layout.json', JSON.stringify(out, null, 1))
console.log(`wrote ${Object.keys(out).length} boxes to ${args.out ?? 'layout.json'}`)
