// Design-migration QA: responsive + accessibility evidence for the React screens.
// Usage (dev server running, e.g. `npm run dev -- --port 5180` from arvr/):
//   node scripts/design-migration-qa.mjs --phase=before
//   node scripts/design-migration-qa.mjs --phase=after --stub
// Saves screenshots and report.json under docs/design-migration/<phase>/.
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=')
    return [key, value ?? 'true']
  }),
)
const base = args.base ?? 'http://localhost:5180'
const phase = args.phase ?? 'before'
const stub = args.stub === 'true'
const outDir = resolve(here, '../../docs/design-migration', phase)
mkdirSync(outDir, { recursive: true })

const VIEWPORTS = [
  { name: '320x640', width: 320, height: 640, touch: true },
  { name: '390x844', width: 390, height: 844, touch: true },
  { name: '768x1024', width: 768, height: 1024, touch: true },
  { name: '1280x800', width: 1280, height: 800, touch: false },
  { name: '1440x900', width: 1440, height: 900, touch: false },
  { name: '844x390-landscape', width: 844, height: 390, touch: true },
]

const ROUTES = [
  { name: 'gateway', path: '/' },
  { name: 'explorer', path: '/explorer?target=rcw-36' },
  { name: 'comparison', path: '/comparison?target=rcw-36' },
  { name: 'guide', path: '/guide/rcw-36' },
]

const previewSvg = (label) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#123049"/><stop offset="1" stop-color="#2a1b3f"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/><circle cx="320" cy="240" r="120" fill="#4fe3d633" stroke="#4fe3d6" stroke-opacity=".4"/><text x="320" y="248" fill="#c7cde6" font-family="monospace" font-size="20" text-anchor="middle">${label}</text></svg>`,
  )}`


const observation = (id, detector, observedAt, wavelength, label) => ({
  observation_id: id,
  release: 'SPHEREx Data Release 1',
  detector,
  observed_at_utc: observedAt,
  effective_wavelength_at_target: wavelength,
  bandwidth_at_target: '0.11 μm',
  preview_url: previewSvg(label),
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
    total_results: 3,
    observations: [
      observation('SPHEREx_SPX_L2B_QA0001', 'D1', '2025-03-14T02:11:08Z', '1.65 μm', 'QA preview A'),
      observation('SPHEREx_SPX_L2B_QA0002', 'D2', '2025-04-02T18:45:31Z', '2.31 μm', 'QA preview B'),
      observation('SPHEREx_SPX_L2B_QA0003', 'D3', '2025-05-19T07:02:44Z', '3.08 μm', 'QA preview C'),
    ],
  },
  '/api/nasa/apod': {
    status: 'ok',
    fallback: false,
    title: 'QA fixture APOD',
    date: '2025-06-01',
    explanation: 'QA fixture used to exercise the APOD dialog layout.',
    media_type: 'image',
    image_url: previewSvg('QA APOD'),
    article_url: 'https://science.nasa.gov',
    alt: 'QA fixture APOD',
    credit: 'NASA (QA fixture)',
  },
}

async function installStubs(page) {
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    const body = fixtures[pathname]
    if (!body) return route.fulfill({ status: 404, body: '{}' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

// UI blocks that must never collide. Canvas-like backdrops and anything that is
// deliberately layered on top of them (image labels, flip buttons) are excluded.
const OVERLAP_SELECTORS = [
  '.fe-gateway h1',
  '.fe-gateway .fe-lead',
  '.fe-gateway .fe-button-row',
  '.fe-capabilities',
  '.fe-steps',
  '.fe-sky-art',
  '.fe-sky-title',
  '.fe-toolbar',
  '.fe-hud-object',
  '.fe-hud-telemetry',
  '.fe-source-line',
  '.fe-hud-actions',
  '.fe-dock',
  '.fe-compare-top',
  '.fe-compare-nav',
  '.fe-epoch-row',
  '.fe-compare-controls',
  '.fe-tabs',
  '.fe-honesty',
  '.fe-comparison-view',
  '.fe-compare-foot',
  '.fe-epoch-downloads',
  '.fe-scientific-notes',
  '.fe-guide-head',
  '.fe-guide-chips',
  '.fe-guide-chat',
  '.fe-guide-form',
  '.fe-cap-card',
]

const LAYERED_ANCESTORS = ['.fe-viewport', '.fe-comparison-view', '.fe-topbar']

async function measure(page) {
  return page.evaluate(
    ({ overlapSelectors, layeredAncestors }) => {
      const doc = document.documentElement
      const app = document.querySelector('.fe-app')
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const visible = (el) => {
        const style = getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }
      const isLayered = (el) =>
        layeredAncestors.some((selector) => el.closest(selector) && !el.matches(selector))

      const nodes = []
      for (const selector of overlapSelectors) {
        for (const el of document.querySelectorAll(selector)) {
          if (!visible(el)) continue
          const rect = el.getBoundingClientRect()
          if (rect.bottom < 0 || rect.top > window.innerHeight) continue
          nodes.push({
            selector,
            layered: isLayered(el),
            rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
            el,
          })
        }
      }

      const overlaps = []
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i]
          const b = nodes[j]
          if (a.selector === b.selector) continue
          if (a.layered || b.layered) continue
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue
          const overlapX = Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w) - Math.max(a.rect.x, b.rect.x)
          const overlapY = Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h) - Math.max(a.rect.y, b.rect.y)
          if (overlapX > 4 && overlapY > 4) {
            overlaps.push({ a: a.selector, b: b.selector, overlapX: Math.round(overlapX), overlapY: Math.round(overlapY) })
          }
        }
      }

      const truncations = []
      const textSelector = '.fe-app h1, .fe-app h2, .fe-app h3, .fe-app p, .fe-app span, .fe-app strong, .fe-app button, .fe-app a'
      for (const el of document.querySelectorAll(textSelector)) {
        if (!visible(el) || el.children.length > 0) continue
        const style = getComputedStyle(el)
        if (style.overflow === 'visible') continue
        if (el.scrollWidth > el.clientWidth + 2) {
          truncations.push({
            text: (el.textContent || '').trim().slice(0, 60),
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          })
        }
      }

      const island = document.querySelector('.fe-island')
      const islandRect = island ? island.getBoundingClientRect() : null
      const obstructed = []
      const smallTargets = []
      const interactive = '.fe-app button, .fe-app a[href], .fe-app input, .fe-app select'
      for (const el of document.querySelectorAll(interactive)) {
        if (!visible(el) || el.closest('.fe-topbar')) continue
        const rect = el.getBoundingClientRect()
        if (rect.width < 44 || rect.height < 44) {
          smallTargets.push({
            label: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          })
        }
        if (!islandRect || rect.bottom < 0 || rect.top > window.innerHeight) continue
        const overlapX = Math.min(rect.right, islandRect.right) - Math.max(rect.left, islandRect.left)
        const overlapY = Math.min(rect.bottom, islandRect.bottom) - Math.max(rect.top, islandRect.top)
        if (overlapX > 2 && overlapY > 2) {
          obstructed.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 60))
        }
      }

      const firstContent = document.querySelector('.fe-gateway h1, .fe-sky-title, .fe-compare h1, .fe-guide-head')
      return {
        viewport,
        docScrollWidth: doc.scrollWidth,
        appScrollWidth: app ? app.scrollWidth : null,
        appClientWidth: app ? app.clientWidth : null,
        horizontalOverflow: doc.scrollWidth > viewport.width + 1 || (app ? app.scrollWidth > app.clientWidth + 1 : false),
        overlaps,
        truncations,
        obstructed,
        smallTargets,
        islandState: document.querySelector('.fe-topbar')?.getAttribute('data-state') ?? null,
        islandRect: islandRect
          ? { x: Math.round(islandRect.x), y: Math.round(islandRect.y), w: Math.round(islandRect.width), h: Math.round(islandRect.height) }
          : null,
        firstContentTop: firstContent ? Math.round(firstContent.getBoundingClientRect().top) : null,
      }
    },
    { overlapSelectors: OVERLAP_SELECTORS, layeredAncestors: LAYERED_ANCESTORS },
  )
}

async function tabWalk(page, steps = 14) {
  const results = []
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(60)
    const snapshot = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return {
        tag: el.tagName,
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
        focusVisible: el.matches(':focus-visible'),
        insideViewport: rect.top >= -1 && rect.bottom <= window.innerHeight + 1,
        outline: `${style.outlineStyle} ${style.outlineWidth}`,
        top: Math.round(rect.top),
      }
    })
    if (!snapshot) break
    results.push(snapshot)
  }
  return results
}

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL ?? 'msedge',
  args: ['--ignore-certificate-errors'],
})

const report = { base, phase, stub, generatedAt: new Date().toISOString(), screens: [] }

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
      isMobile: vp.width < 768,
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
    })
    const page = await context.newPage()
    const consoleIssues = []
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        consoleIssues.push(`${message.type()}: ${message.text()}`)
      }
    })
    page.on('pageerror', (error) => consoleIssues.push(`pageerror: ${error.message}`))
    if (stub) await installStubs(page)

    const slug = `${route.name}-${vp.name}`
    const entry = { route: route.path, name: slug, viewport: vp.name }

    await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1400)

    entry.top = await measure(page)
    await page.screenshot({ path: resolve(outDir, `${slug}-top.png`) })

    if (!vp.touch) {
      entry.tabWalk = await tabWalk(page)
      await page.evaluate(() => {
        document.querySelector('.fe-app')?.scrollTo(0, 0)
        window.scrollTo(0, 0)
      })
      await page.waitForTimeout(400)
    }

    // Move past the Dynamic Island threshold, then confirm the first content
    // block only moves by the scroll amount (no navbar reflow).
    await page.evaluate(() => {
      const app = document.querySelector('.fe-app')
      if (app) app.scrollTop = 260
      window.scrollTo(0, 260)
    })
    await page.waitForTimeout(500)
    entry.scrolled = await measure(page)
    entry.firstContentShift =
      entry.top.firstContentTop != null && entry.scrolled.firstContentTop != null
        ? entry.top.firstContentTop - entry.scrolled.firstContentTop
        : null
    await page.screenshot({ path: resolve(outDir, `${slug}-scrolled.png`) })

    if (vp.width <= 700) {
      const menuButton = page.locator('.fe-menu-btn')
      if (await menuButton.isVisible().catch(() => false)) {
        await page.evaluate(() => {
          document.querySelector('.fe-app')?.scrollTo(0, 0)
          window.scrollTo(0, 0)
        })
        await page.waitForTimeout(300)
        await menuButton.click()
        await page.waitForTimeout(400)
        entry.menuOpen = await page.evaluate(() => {
          const panel = document.querySelector('.fe-island-menu')
          const island = document.querySelector('.fe-island')
          const rect = panel?.getBoundingClientRect()
          return {
            state: document.querySelector('.fe-topbar')?.getAttribute('data-state'),
            expanded: document.querySelector('.fe-menu-btn')?.getAttribute('aria-expanded'),
            panelVisible: Boolean(rect && rect.height > 0),
            panelWidth: rect ? Math.round(rect.width) : null,
            islandBottom: island ? Math.round(island.getBoundingClientRect().bottom) : null,
            viewportWidth: window.innerWidth,
            overflow: rect ? rect.right > window.innerWidth + 1 || rect.left < -1 : false,
          }
        })
        await page.screenshot({ path: resolve(outDir, `${slug}-menu.png`) })
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
        entry.menuClosedByEscape = await page.evaluate(() => ({
          state: document.querySelector('.fe-topbar')?.getAttribute('data-state'),
          focusOnMenuButton: document.activeElement?.classList.contains('fe-menu-btn') ?? false,
        }))
      }
    }

    entry.consoleIssues = [...new Set(consoleIssues)]
    report.screens.push(entry)
    await context.close()
  }
}

await browser.close()
writeFileSync(resolve(outDir, 'report.json'), JSON.stringify(report, null, 2))

console.table(
  report.screens.map((screen) => ({
    screen: screen.name,
    overflow: screen.top.horizontalOverflow || screen.scrolled.horizontalOverflow,
    overlaps: screen.top.overlaps.length + screen.scrolled.overlaps.length,
    truncated: screen.top.truncations.length,
    obstructed: screen.top.obstructed.length,
    smallTargets: screen.top.smallTargets.length,
    console: screen.consoleIssues.length,
    shift: screen.firstContentShift,
    menuOverflow: screen.menuOpen ? screen.menuOpen.overflow : null,
  })),
)
console.log(`report: ${resolve(outDir, 'report.json')}`)

