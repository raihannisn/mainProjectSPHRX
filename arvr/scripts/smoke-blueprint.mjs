// Smoke test for the master design blueprint (docs/MASTER_DESIGN_OVERHAUL_PROMPT.md):
// no purple/pink anywhere, interactive 3D solar system on the Gateway, teal primary action, Dynamic
// Island border only while floating, navbar navigation through the wormhole.
// Needs the dev server:   cd arvr; $env:XR_HTTP='1'; npx vite --port 5173
//   node scripts/smoke-blueprint.mjs [--base=http://localhost:5173] [--no-shots]
// Screenshots go to docs/blueprint/ (desktop 1280x800, 390x844, 360x800).
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true'] }))
const base = args.base ?? 'http://localhost:5173'
const shots = args['no-shots'] !== 'true'
const outDir = resolve(here, '../../docs/blueprint')
if (shots) mkdirSync(outDir, { recursive: true })

let failed = 0
function check(name, ok, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

// ---- 1. static: no purple / magenta / pink colour left in the source ----
const FORBIDDEN = ['#b18cff', '#ef5b53', '#b72e59', '#9a5572', '#d889a8', '#ad83f1', '#8f7cff', '#7b61d9', '#6445ac', '#492e62', 'rgba(175, 140, 255', 'rgba(177, 140, 255', 'rgba(143, 124, 255', '150,120,255', '150, 120, 255']
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p] })
const sources = walk(resolve(here, '../src')).filter((p) => /\.(css|tsx?)$/.test(p))
const hits = []
for (const file of sources) {
  const text = readFileSync(file, 'utf8').toLowerCase()
  for (const color of FORBIDDEN) if (text.includes(color.toLowerCase())) hits.push(`${file.split('src')[1]}: ${color}`)
}
check('source has no purple / pink / magenta colour', hits.length === 0, hits.slice(0, 4).join(' | '))
const solarSrc = readFileSync(resolve(here, '../src/frontend/components/SolarSystem3D.tsx'), 'utf8')
check('starfield is one InstancedMesh draw call', /<instancedMesh/.test(solarSrc) && /STAR_COUNT = 750/.test(solarSrc))
check('solar system caps the pixel ratio at 1.5', /dpr=\{\[1, 1\.5\]\}/.test(solarSrc))
check('Saturn has a ring with a Cassini gap and 26.7 degree tilt', /Cassini/.test(solarSrc) && /0\.466/.test(solarSrc))

const VIEWPORTS = [
  { name: 'desktop-1280x800', width: 1280, height: 800, touch: false },
  { name: '390x844', width: 390, height: 844, touch: true },
  { name: '360x800', width: 360, height: 800, touch: true },
]
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--use-gl=angle', '--ignore-gpu-blocklist'] })

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', engine: 'stub', message: 'QA fixture' }) }))
  const tag = `[${vp.name}]`

  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.solar3d-canvas', { timeout: 20000 })
  await page.waitForTimeout(2500)

  // ---- 2. Gateway solar system ----
  const canvas = await page.$eval('.solar3d-canvas canvas', (el) => ({ w: el.width, cssW: el.getBoundingClientRect().width }))
  check(`${tag} 3D solar system canvas renders`, canvas.w > 0)
  check(`${tag} pixel ratio is capped at 1.5`, canvas.w / canvas.cssW <= 1.51, `${(canvas.w / canvas.cssW).toFixed(2)}`)
  check(`${tag} no CSS-art fallback is showing`, (await page.$('.fe-solar-system')) === null)
  check(`${tag} labelled illustrative / not to scale`, (await page.textContent('.solar3d-note')).includes('NOT TO SCALE'))

  const box = await page.$eval('.solar3d-canvas', (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })
  const scan = []
  for (let y = box.y + box.h * 0.2; y < box.y + box.h * 0.9; y += 16) for (let x = box.x + 6; x < box.x + box.w - 6; x += 16) scan.push([x, y])
  let pill = null
  for (const [x, y] of scan) {
    await page.mouse.move(x, y)
    const el = await page.$('.solar3d-pill.active')
    if (el) { pill = await el.textContent(); break }
  }
  check(`${tag} hovering a planet shows its name and distance in AU`, !!pill && /AU from the Sun/.test(pill), String(pill))
  if (shots) await page.screenshot({ path: resolve(outDir, `gateway-${vp.name}.png`) })
  if (pill && vp.name.startsWith('desktop')) {
    await page.click('.solar3d-pill.active')
    const went = await page.waitForURL(/\/xr(\/body\/mars)?(\?|$)/, { timeout: 20000 }).then(() => true).catch(() => false)
    check(`${tag} pill opens the 3D scene through the wormhole`, went, page.url())
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.solar3d-canvas', { timeout: 20000 })
  }

  // ---- 3. teal primary action ----
  const primary = await page.$eval('.fe-btn-primary', (el) => { const s = getComputedStyle(el); return { img: s.backgroundImage, color: s.color } })
  check(`${tag} primary button is the teal capsule`, /rgb\(79, 227, 214\)/.test(primary.img) && /rgb\(14, 165, 233\)/.test(primary.img), primary.img.slice(0, 80))

  // ---- 4. Dynamic Island: flowing border only while floating ----
  const islandAnim = () => page.$eval('.fe-island', (el) => getComputedStyle(el).animationName)
  const state = () => page.$eval('.fe-topbar', (el) => el.getAttribute('data-state'))
  check(`${tag} island at the top has no border animation`, (await state()) === 'top' && (await islandAnim()) === 'none', `${await state()} / ${await islandAnim()}`)
  await page.evaluate(() => { document.querySelector('.fe-app')?.scrollTo(0, 400); window.scrollTo(0, 400) })
  await page.waitForTimeout(700)
  check(`${tag} floating island has the flowing border`, (await state()) === 'island' && (await islandAnim()) === 'fe-island-border-flow', `${await state()} / ${await islandAnim()}`)
  await page.evaluate(() => { document.querySelector('.fe-app')?.scrollTo(0, 0); window.scrollTo(0, 0) })
  await page.waitForTimeout(700)
  check(`${tag} border animation stops again at the top`, (await state()) === 'top' && (await islandAnim()) === 'none')

  // ---- 5. navbar navigation goes through the wormhole (desktop links) ----
  if (!vp.touch) {
    await page.evaluate(() => { window.__wormholeSeen = false; const root = document.querySelector('.fe-wormhole'); if (root) new MutationObserver(() => { if (root.classList.contains('fe-wormhole--on')) window.__wormholeSeen = true }).observe(root, { attributes: true, attributeFilter: ['class'] }) })
    await page.click('.fe-nav-links--bar >> text=Sky Explorer')
    const arrived = await page.waitForURL('**/explorer', { timeout: 15000 }).then(() => true).catch(() => false)
    const seen = await page.evaluate(() => window.__wormholeSeen)
    check(`${tag} navbar link opens the Sky Explorer`, arrived)
    check(`${tag} the wormhole portal played on the way`, seen === true)
  }

  // ---- 6. glass recipe on the HUD cards (Sky Explorer) ----
  await page.goto(`${base}/explorer`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.fe-hud-card', { timeout: 20000 })
  const glass = await page.$eval('.fe-hud-card', (el) => { const s = getComputedStyle(el); return { blur: s.backdropFilter, border: s.borderTopColor, shadow: s.boxShadow } })
  check(`${tag} HUD card uses the frosted-glass recipe`, /blur\(28px\)/.test(glass.blur) && /saturate\(1\.9|saturate\(190%/.test(glass.blur) && /inset/.test(glass.shadow), glass.blur)

  check(`${tag} no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

await browser.close()
console.log(`\n${failed === 0 ? 'All checks passed' : `${failed} check(s) FAILED`}`)
process.exit(failed ? 1 : 0)
