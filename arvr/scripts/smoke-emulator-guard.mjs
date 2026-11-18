// Smoke test: the simulated Quest 3 (?emulate) must never take over a real headset.
//   - desktop, ?emulate=1         -> simulation installed (for no-headset testing)
//   - desktop, ?emulate=0 / none  -> no simulation
//   - Quest browser (user agent), ?emulate=1 -> no simulation
//   - browser that natively supports immersive VR (a PC-VR headset), ?emulate=1 -> no simulation, native XR untouched
// Needs a dev server (dev build exposes window.__xrDevice):   cd arvr; $env:XR_HTTP='1'; npx vite --port 5173
//   node scripts/smoke-emulator-guard.mjs [--base=http://localhost:5173]
import { chromium } from 'playwright-core'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true'] }))
const base = args.base ?? 'http://localhost:5173'
let failed = 0
function check(name, ok, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--use-gl=angle', '--ignore-gpu-blocklist'] })

async function open(query, { userAgent, nativeVr } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }))
  if (nativeVr) {
    // a browser that already has a real immersive-vr runtime
    await ctx.addInitScript(() => {
      const xr = { isSessionSupported: async (mode) => mode === 'immersive-vr', addEventListener() {}, removeEventListener() {} }
      Object.defineProperty(navigator, 'xr', { value: xr, configurable: true })
      window.__nativeXr = xr
    })
  }
  await page.goto(`${base}/explorer${query}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.fe-island', { timeout: 40000 })
  await page.waitForTimeout(2500)
  const state = await page.evaluate(() => ({ emulated: !!window.__xrDevice, panel: !!document.querySelector('[class*="iwer"], #iwer-devui, devui'), nativeKept: window.__nativeXr ? navigator.xr === window.__nativeXr : null }))
  await ctx.close()
  return { ...state, errors }
}

const a = await open('?emulate=1')
check('desktop, ?emulate=1: the simulated Quest is installed', a.emulated)
const b = await open('?emulate')
check('desktop, ?emulate: the simulated Quest is installed', b.emulated)
const c = await open('?emulate=0')
check('desktop, ?emulate=0: no simulation', !c.emulated)
const d = await open('')
check('desktop, no parameter: no simulation', !d.emulated)
const e = await open('?emulate=1', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.0.0.0.60 Chrome/126.0.0.0 VR Safari/537.36' })
check('Quest browser, ?emulate=1: no simulation', !e.emulated)
const f = await open('?emulate=1', { nativeVr: true })
check('browser with a real immersive-vr runtime, ?emulate=1: no simulation', !f.emulated)
check('... and the real navigator.xr is left alone', f.nativeKept === true)
const errors = [a, b, c, d, e, f].flatMap((x) => x.errors)
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
console.log(`\n${failed === 0 ? 'All checks passed' : `${failed} check(s) FAILED`}`)
process.exit(failed ? 1 : 0)
