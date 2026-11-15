// Smoke test for the unified look: the 3D/AR/VR scenes wear the same design language and brand as the
// 2D screens (src/xr/theme.css), and the Gateway is the only front door (no automatic title card).
// Needs the dev server:   cd arvr; $env:XR_HTTP='1'; npx vite --port 5173
//   node scripts/smoke-unified-xr.mjs [--base=http://localhost:5173] [--no-shots]
// Screenshots go to docs/unified-experience/ (desktop 1280x800, 390x844, 360x800).
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
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
const outDir = resolve(here, '../../docs/unified-experience')
if (shots) mkdirSync(outDir, { recursive: true })

const VIEWPORTS = [
  { name: 'desktop-1280x800', width: 1280, height: 800, touch: false },
  { name: '390x844', width: 390, height: 844, touch: true },
  { name: '360x800', width: 360, height: 800, touch: true },
]
const SCENES = [
  { name: 'hub', path: '/xr' },
  { name: 'mars', path: '/xr/body/mars' },
  { name: 'spherex', path: '/xr/body/spherex' },
  { name: 'jezero', path: '/xr/surface/jezero' },
]
const OLD_BRAND = 'AR Cosmic Expedition'

let failed = 0
function check(name, ok, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL ?? 'msedge',
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--ignore-certificate-errors'],
})

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, deviceScaleFactor: 1 })
  // the "Ways to explore" sheet opens by itself once per session at the hub; mark it seen so the bar is visible
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('cosmic-xr-modes-seen', '1')
    } catch {
      /* private mode */
    }
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  // no backend needed: status and catalog calls answer with a QA stub (never shown as live NASA data)
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', engine: 'stub', message: 'QA fixture', observations: [] }) }))

  for (const scene of SCENES) {
    const tag = `[${vp.name}] ${scene.name}`
    await page.goto(base + scene.path, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.hud__bar', { timeout: 30000 })
    // close the explore sheet if this build still opened it
    await page.evaluate(() => document.querySelector('.mode-backdrop')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await page.waitForTimeout(scene.name === 'jezero' ? 6000 : 3500)

    const info = await page.evaluate((oldBrand) => {
      const style = (sel) => {
        const el = document.querySelector(sel)
        return el ? getComputedStyle(el) : null
      }
      const rect = (el) => el.getBoundingClientRect()
      const bar = document.querySelector('.hud__bar')
      const items = bar ? [...bar.querySelectorAll('.hud__title > *, .hud__modes > *')].filter((el) => rect(el).width > 0) : []
      const overlaps = []
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) {
          const a = rect(items[i])
          const b = rect(items[j])
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (w > 1 && h > 1) overlaps.push(`${items[i].className}×${items[j].className}`)
        }
      const btns = [...document.querySelectorAll('.hud__bar .btn')].filter((el) => rect(el).width > 0)
      const crumb = document.querySelector('.crumb')
      const brand = document.querySelector('.xr-brand')
      return {
        font: style('.hud')?.fontFamily ?? '',
        btnFont: style('.hud .btn')?.fontFamily ?? '',
        btnRadius: parseFloat(style('.hud .btn')?.borderTopLeftRadius ?? '0'),
        minBtnHeight: btns.length ? Math.min(...btns.map((el) => rect(el).height)) : 0,
        offscreen: btns.filter((el) => rect(el).right > innerWidth + 1 || rect(el).left < -1).map((el) => el.textContent.trim()),
        overlaps,
        oldBrand: document.body.innerText.includes(oldBrand),
        intro: !!document.querySelector('.intro'),
        brandHref: brand?.getAttribute('href') ?? null,
        brandVisible: brand ? rect(brand).width > 0 : false,
        crumbClipped: crumb ? crumb.scrollWidth > crumb.clientWidth + 1 : false,
        crumbText: crumb?.textContent ?? '',
        overflowX: document.documentElement.scrollWidth - innerWidth,
        backLink: document.querySelector('.hud__modes a')?.getAttribute('href') ?? null,
      }
    }, OLD_BRAND)

    check(`${tag} HUD uses the shared typeface`, /^"?Poppins/.test(info.font) && /^"?Poppins/.test(info.btnFont), info.font.split(',')[0])
    check(`${tag} buttons are pills`, info.btnRadius >= 20, `${info.btnRadius}px`)
    if (vp.touch) check(`${tag} bar buttons are at least 44px tall`, info.minBtnHeight >= 44, `${Math.round(info.minBtnHeight)}px`)
    check(`${tag} top bar items do not overlap`, info.overlaps.length === 0, info.overlaps.join(', '))
    check(`${tag} no bar button off screen`, info.offscreen.length === 0, info.offscreen.join(', '))
    check(`${tag} old brand name is gone`, !info.oldBrand)
    check(`${tag} no automatic title card`, !info.intro)
    check(`${tag} keeps a link back to the 2D screens`, typeof info.backLink === 'string' && info.backLink.startsWith('/'), String(info.backLink))
    if (scene.name === 'hub') check(`${tag} brand mark links to the Gateway`, info.brandHref === '/' && info.brandVisible, String(info.brandHref))
    else check(`${tag} place name is not clipped`, !info.crumbClipped, info.crumbText)
    check(`${tag} no horizontal page scroll`, info.overflowX <= 0, `${info.overflowX}px`)
    if (shots) await page.screenshot({ path: resolve(outDir, `xr-${scene.name}-${vp.name}.png`) })
  }

  // the title card is opt-in and carries the shared brand
  await page.goto(`${base}/xr?intro`, { waitUntil: 'domcontentloaded' })
  const title = await page.waitForSelector('.intro__title', { timeout: 15000 }).then((el) => el.getAttribute('aria-label')).catch(() => null)
  check(`[${vp.name}] ?intro shows the title card with the shared brand`, title === 'SPHEREx Cosmic Expedition', String(title))

  check(`[${vp.name}] no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
console.log(`\n${failed === 0 ? 'All checks passed' : `${failed} check(s) FAILED`}`)
process.exit(failed ? 1 : 0)
