// Smoke test for the 3D model viewport in the Sky Explorer (feat/3d-observation).
// Needs the dev server (the hotspot step uses the dev-only window.__xrApp handle):
//   cd arvr; $env:XR_HTTP='1'; npx vite --port 5173
//   node scripts/smoke-observation-3d.mjs [--base=http://localhost:5173] [--no-shots]
// API calls are stubbed with the same fixtures style as design-migration-qa.mjs, so no backend is needed.
// Screenshots go to docs/observation-3d/ (desktop 1280x800, 390x844, 360x800).
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=')
    return [key, value ?? 'true']
  }),
)
const base = args.base ?? 'http://localhost:5173'
const shots = args['no-shots'] !== 'true'
const outDir = resolve(here, '../../docs/observation-3d')
if (shots) mkdirSync(outDir, { recursive: true })

const VIEWPORTS = [
  { name: 'desktop-1280x800', width: 1280, height: 800, touch: false },
  { name: '390x844', width: 390, height: 844, touch: true },
  { name: '360x800', width: 360, height: 800, touch: true },
]
const BODIES = ['mars', 'moon', 'bennu']
const hotspotCount = Object.fromEntries(
  BODIES.map((id) => [id, JSON.parse(readFileSync(resolve(here, `../content/bodies/${id}.json`), 'utf8')).hotspots.length]),
)

// Featured walkable site per body (ids must match DEFAULT_SITE in SkyExplorerScreen.tsx); names come from the site content
const siteName = (id) => JSON.parse(readFileSync(resolve(here, `../content/sites/${id}.json`), 'utf8')).name
const SURFACE = {
  mars: { id: 'jezero', name: siteName('jezero') },
  moon: { id: 'apollo11', name: siteName('apollo11') },
  bennu: { id: 'bennu-nightingale', name: siteName('bennu-nightingale') },
}
const sitePin = JSON.parse(readFileSync(resolve(here, '../content/bodies/mars.json'), 'utf8')).hotspots.find((h) => h.site && h.site !== SURFACE.mars.id) ?? null

// Same observation shape as the design-migration-qa.mjs fixtures (QA data, never shown as live NASA data).
const observation = (id, detector, observedAt, wavelength) => ({
  observation_id: id,
  release: 'SPHEREx Data Release 1',
  detector,
  observed_at_utc: observedAt,
  effective_wavelength_at_target: wavelength,
  bandwidth_at_target: '0.11 μm',
  preview_url: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="#123049"/></svg>')}`,
  fits_url: 'https://example.invalid/QA.fits',
})

const fixtures = {
  '/api/status': { status: 'ok', data_source: 'QA fixture', engine: 'stub', message: 'QA fixture' },
  '/api/objects/rcw-36': {
    id: 'rcw-36',
    name: 'RCW 36 Emission Nebula',
    type: 'Emission nebula',
    description: 'A compact H II star-forming region in the Vela Molecular Ridge.',
    ra: 130.0367,
    dec: -43.0931,
    ra_hms: '08h 40m 08.8s',
    dec_dms: '-43° 05′ 35″',
    source: 'Object catalog and IRSA SIA2 (QA fixture)',
  },
  '/api/spherex/observations': {
    query: { ra: 130.0367, dec: -43.0931, radius: 0.05, collection: 'all' },
    source: 'IRSA SIA2 (QA fixture)',
    total_results: 2,
    observations: [
      observation('SPHEREx_SPX_L2B_QA0001', 'D1', '2025-03-14T02:11:08Z', '1.65 μm'),
      observation('SPHEREx_SPX_L2B_QA0002', 'D2', '2025-04-02T18:45:31Z', '2.31 μm'),
    ],
  },
}

let failed = 0
const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL ?? 'msedge',
  args: ['--use-gl=angle', '--ignore-gpu-blocklist'],
})

async function openPage(vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.touch,
    isMobile: vp.touch,
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    const body = fixtures[pathname]
    if (!body) return route.fulfill({ status: 404, body: '{}' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return { page, context, errors }
}

const waitForModel = (page, id) =>
  page.waitForFunction(
    (n) => {
      const p = document.querySelector('.fe-sky-title p')
      return !!p && p.textContent.includes(`${n} hotspots`)
    },
    hotspotCount[id],
    { timeout: 20000 },
  )

/** Rectangles of UI chrome inside the viewport must not overlap each other. */
async function overlaps(page) {
  return page.evaluate(() => {
    const sel = ['.fe-sky-title', '.fe-toolbar', '.fe-model-switch', '.fe-view-hint']
    const boxes = sel
      .map((s) => [s, document.querySelector(s)?.getBoundingClientRect()])
      .filter(([, r]) => r && r.width && r.height)
    const hits = []
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, ra] = boxes[i]
        const [b, rb] = boxes[j]
        if (ra.left < rb.right - 1 && rb.left < ra.right - 1 && ra.top < rb.bottom - 1 && rb.top < ra.bottom - 1) hits.push(`${a}×${b}`)
      }
    return hits
  })
}

for (const vp of VIEWPORTS) {
  const { page, context, errors } = await openPage(vp)
  const tag = `[${vp.name}]`

  // 1. Default view keeps the SPHEREx sky targets and their HUD
  await page.goto(`${base}/explorer?target=rcw-36`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.sky3d-canvas', { timeout: 20000 })
  await page.waitForFunction(() => document.querySelector('.fe-hud-object h2')?.textContent.includes('RCW 36'), null, { timeout: 15000 })
  const radios = await page.$$eval('.fe-model-switch [role="radio"]', (els) => els.map((e) => [e.textContent.trim(), e.getAttribute('aria-checked')]))
  check(`${tag} model switch lists Sky/Mars/Moon/Bennu with Sky selected`, JSON.stringify(radios) === JSON.stringify([['Sky', 'true'], ['Mars', 'false'], ['Moon', 'false'], ['Bennu', 'false']]), JSON.stringify(radios))
  check(`${tag} sky view has no hotspot toggle`, (await page.$('.fe-pins-toggle')) === null)
  const skyOverlap = await overlaps(page)
  check(`${tag} sky view chrome does not overlap`, skyOverlap.length === 0, skyOverlap.join(', '))
  if (shots) await page.screenshot({ path: resolve(outDir, `explorer-sky-${vp.name}.png`) })

  // 2. Each 3D body model renders inline with its hotspots
  for (const id of BODIES) {
    await page.click(`.fe-model-switch [role="radio"]:has-text("${id[0].toUpperCase() + id.slice(1)}")`)
    const ok = await waitForModel(page, id).then(() => true).catch(() => false)
    check(`${tag} ${id}: 3D model loads with ${hotspotCount[id]} hotspots`, ok)
    check(`${tag} ${id}: URL carries ?model=${id}`, new URL(page.url()).searchParams.get('model') === id)
    check(`${tag} ${id}: canvas mounted, sky targets unmounted`, (await page.$('.model3d canvas')) !== null && (await page.$('.sky3d-canvas')) === null)
    const tagText = await page.textContent('.fe-hud-object .fe-tag')
    // all three bodies ship a real texture or NASA shape model (bennu.glb), so none may claim "illustration"
    check(`${tag} ${id}: HUD labels it a 3D model`, (tagText ?? '').includes('3D MODEL'), tagText ?? '')
    check(`${tag} ${id}: layer toggle only where the body has NASA image layers`, ((await page.$('.fe-layer-toggle')) !== null) === (id === 'mars'))
    const walkOk = await page
      .waitForFunction((label) => document.querySelector('.fe-hud-actions .fe-surface-btn')?.textContent.includes(label), `Walk on ${SURFACE[id].name}`, { timeout: 8000 })
      .then(() => true)
      .catch(() => false)
    check(`${tag} ${id}: HUD offers its walkable surface site`, walkOk, SURFACE[id].name)
    check(`${tag} ${id}: no sky-only Compare button in 3D mode`, !(await page.textContent('.fe-hud-actions')).includes('Compare observations'))
  }

  // 3. Hotspot toggle hides/shows pins (one compact button)
  await page.click('.fe-model-switch [role="radio"]:has-text("Mars")')
  await waitForModel(page, 'mars')
  await page.waitForTimeout(1500) // let textures fade in for the screenshot
  if (shots) await page.screenshot({ path: resolve(outDir, `explorer-mars-${vp.name}.png`) })
  const pinBtn = '.fe-pins-toggle'
  check(`${tag} hotspot toggle starts pressed`, (await page.getAttribute(pinBtn, 'aria-pressed')) === 'true')
  await page.click(pinBtn)
  check(`${tag} hotspot toggle hides pins`, (await page.getAttribute(pinBtn, 'aria-pressed')) === 'false' && (await page.textContent('.fe-sky-title p')).includes('hotspots hidden'))
  await page.click(pinBtn)
  check(`${tag} hotspot toggle shows pins again`, (await page.getAttribute(pinBtn, 'aria-pressed')) === 'true')
  // 3b. NASA image layer toggle (Mars: Viking colour <-> MOLA elevation), with legend and credit in the HUD
  const layerBtn = '.fe-layer-toggle'
  const layerText = () => page.textContent('.fe-datum-layer strong')
  check(`${tag} layer toggle starts on the colour mosaic`, (await page.getAttribute(layerBtn, 'aria-pressed')) === 'false' && (await layerText()).includes('Colour'))
  const elevation = page.waitForResponse((r) => r.url().includes('mars_elevation') && r.ok(), { timeout: 15000 }).then(() => true).catch(() => false)
  await page.click(layerBtn)
  check(`${tag} layer toggle switches to MOLA elevation`, (await page.getAttribute(layerBtn, 'aria-pressed')) === 'true' && (await layerText()).includes('Elevation'))
  check(`${tag} elevation layer shows its colour scale`, (await page.$('.fe-layer-legend i')) !== null)
  check(`${tag} elevation layer is credited in the Source line`, (await page.textContent('.fe-source-line')).includes('MOLA'))
  check(`${tag} elevation texture loads`, await elevation)
  await page.waitForFunction(() => !document.querySelector('.fe-toast'), null, { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(800)
  if (shots) await page.screenshot({ path: resolve(outDir, `explorer-mars-elevation-${vp.name}.png`) })
  await page.click(layerBtn)
  check(`${tag} layer toggle returns to the colour mosaic`, (await page.getAttribute(layerBtn, 'aria-pressed')) === 'false' && (await layerText()).includes('Colour'))
  const bodyOverlap = await overlaps(page)
  check(`${tag} 3D view chrome does not overlap`, bodyOverlap.length === 0, bodyOverlap.join(', '))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`${tag} no horizontal page scroll`, overflow <= 0, `${overflow}px`)

  // 4. Selecting a hotspot fills the HUD with its title, Fact/Illustration/Candidate label and source
  const first = JSON.parse(readFileSync(resolve(here, '../content/bodies/mars.json'), 'utf8')).hotspots[0]
  const devHandle = await page.evaluate(() => !!window.__xrApp)
  if (!devHandle) {
    console.log(`SKIP  ${tag} hotspot HUD + selection-cleanup checks (window.__xrApp exists only on the dev server)`)
  } else {
  await page.evaluate((hid) => window.__xrApp?.getState().selectHotspot(hid), first.id)
  const hudOk = await page
    .waitForFunction(
      (kind) => {
        const t = document.querySelector('.fe-hud-object .fe-tag')?.textContent ?? ''
        return t.includes(kind) && !!document.querySelector('.fe-source-line a')
      },
      { fact: 'FACT', illustration: 'ILLUSTRATION', candidate: 'CANDIDATE' }[first.kind],
      { timeout: 5000 },
    )
    .then(() => true)
    .catch(() => false)
  check(`${tag} selected hotspot shows label + source link in HUD`, hudOk, first.id)
  // a pin that has its own walkable site retargets the surface button
  if (sitePin) {
    await page.evaluate((hid) => window.__xrApp?.getState().selectHotspot(hid), sitePin.id)
    const retargeted = await page
      .waitForFunction((name) => document.querySelector('.fe-surface-btn')?.textContent.includes(`Walk on ${name}`), siteName(sitePin.site), { timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    check(`${tag} pin with a site retargets the surface button`, retargeted, `${sitePin.id} -> ${siteName(sitePin.site)}`)
    await page.evaluate((hid) => window.__xrApp?.getState().selectHotspot(hid), first.id)
  }
  await page.waitForFunction(() => !document.querySelector('.fe-toast'), null, { timeout: 5000 }).catch(() => {})
  if (shots && vp.name.startsWith('desktop')) await page.screenshot({ path: resolve(outDir, `explorer-mars-hotspot-${vp.name}.png`) })
  }

  // 5. Back to Sky restores the target workflow, and the pin selection is cleared
  await page.click('.fe-model-switch [role="radio"]:has-text("Sky")')
  await page.waitForSelector('.sky3d-canvas', { timeout: 15000 })
  check(`${tag} Sky restores RCW 36 HUD`, (await page.textContent('.fe-hud-object h2')).includes('RCW 36'))
  check(`${tag} Sky restores the Compare button`, (await page.textContent('.fe-hud-actions')).includes('Compare observations') && (await page.$('.fe-surface-btn')) === null)
  if (devHandle) check(`${tag} hotspot selection cleared on leave`, (await page.evaluate(() => window.__xrApp?.getState().hotspotId ?? null)) === null)

  check(`${tag} no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

// 5b. From the 3D model: Ask the Guide carries the body as context, and the surface button opens the walkable site
{
  const { page, context, errors } = await openPage(VIEWPORTS[0])
  await page.goto(`${base}/explorer?model=mars`, { waitUntil: 'domcontentloaded' })
  await waitForModel(page, 'mars')
  await page.click('.fe-hud-actions .fe-btn-primary')
  const guideContext = await page.waitForSelector('.cg-window .cg-sub', { timeout: 8000 }).then((el) => el.textContent()).catch(() => null)
  check('[guide] Ask the Guide opens with the 3D body as context', (guideContext ?? '').includes('Mars'), String(guideContext))
  await page.keyboard.press('Escape')
  await page.click('.fe-hud-actions .fe-surface-btn')
  const onSurface = await page.waitForURL(`**/xr/surface/${SURFACE.mars.id}`, { timeout: 20000 }).then(() => true).catch(() => false)
  check(`[surface] "Walk on ${SURFACE.mars.name}" opens /xr/surface/${SURFACE.mars.id}`, onSurface, page.url())
  const hud = await page.waitForSelector('.hud--surface .crumb', { timeout: 30000 }).then((el) => el.textContent()).catch(() => null)
  check('[surface] the walkable site loads its HUD', (hud ?? '').includes(SURFACE.mars.name), String(hud))
  check('[surface] no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

// 6. ?intent=vr opens the XR mode picker on a body scene (the VR/AR toggle's target)
{
  const { page, context, errors } = await openPage(VIEWPORTS[0])
  await page.goto(`${base}/xr/body/mars?intent=vr`, { waitUntil: 'domcontentloaded' })
  const picker = await page.waitForSelector('.mode-picker', { timeout: 20000 }).then(() => true).catch(() => false)
  check('[xr] /xr/body/mars?intent=vr opens the mode picker', picker)
  check('[xr] no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

await browser.close()
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
