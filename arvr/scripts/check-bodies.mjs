// QA for every body of the Solar System chart in the Sky Explorer, on a phone and a desktop viewport.
//   node scripts/check-bodies.mjs                          (dev server on https://localhost:5173)
//   node scripts/check-bodies.mjs --base=http://localhost:5173 --only=saturn,mars
//
// Per body and viewport it checks:
//  - the page raises no JavaScript error, and no texture, model or asset request fails
//  - the 3D canvas actually drew something (not an empty frame)
//  - a body with a texture requested it and got an image (200)
//  - the label matches the content: data textures and models say "NASA data", illustrations say so
//  - the NASA credit from content/bodies/<id>.json is on screen
//  - the page has no horizontal overflow
// It also prints the average and 95th percentile frame time as information (not a pass/fail gate: headless
// GPUs vary a lot). Backend calls (/api/...) may fail here, since the narration has bundled fallbacks.
import { chromium } from 'playwright-core'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || 'true'] }))
const base = args.base ?? 'https://localhost:5173'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bodiesDir = join(root, 'content', 'bodies')
const bodies = Object.fromEntries(readdirSync(bodiesDir).filter((f) => f.endsWith('.json')).map((f) => { const b = JSON.parse(readFileSync(join(bodiesDir, f), 'utf8')); return [b.id, b] }))
const ids = (args.only ? args.only.split(',') : ['hub', ...Object.keys(bodies)])
const VIEWPORTS = [{ name: 'phone 390x844', width: 390, height: 844, touch: true }, { name: 'desktop 1280x800', width: 1280, height: 800, touch: false }]

const failures = []
const fail = (where, what) => failures.push(`${where}: ${what}`)

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--use-gl=angle', '--ignore-gpu-blocklist'] })
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch, ignoreHTTPSErrors: true })
  for (const id of ids) {
    const where = `${id} @ ${vp.name}`
    const body = bodies[id]
    const page = await context.newPage()
    const requests = []
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(e.message))
    page.on('response', (r) => requests.push({ url: r.url(), status: r.status(), type: r.headers()['content-type'] ?? '' }))
    page.on('requestfailed', (r) => requests.push({ url: r.url(), status: 0, type: '' }))
    await page.goto(`${base}/explorer${id === 'hub' ? '' : `?model=${id}`}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.fe-viewport canvas', { timeout: 30000 }).catch(() => fail(where, 'no 3D canvas'))
    await page.waitForTimeout(id === 'hub' ? 4000 : 6000)

    for (const e of pageErrors) fail(where, `page error: ${e}`)
    for (const r of requests) {
      if (/\/api\//.test(r.url)) continue // backend: fallbacks are expected
      if (/\.(jpg|jpeg|png|glb|webp)(\?|$)/.test(r.url) && (r.status === 0 || r.status >= 400)) fail(where, `asset failed: ${r.url} (${r.status})`)
    }

    const state = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const canvas = document.querySelector('.fe-viewport canvas')
          const times = []
          let last = performance.now()
          let n = 0
          const tick = (now) => {
            times.push(now - last)
            last = now
            if (++n < 90) requestAnimationFrame(tick)
            else {
              let nonEmpty = 0
              if (canvas) {
                const t = document.createElement('canvas')
                t.width = 96
                t.height = 96
                const x = t.getContext('2d')
                x.drawImage(canvas, 0, 0, 96, 96)
                const d = x.getImageData(0, 0, 96, 96).data
                for (let i = 3; i < d.length; i += 4) if (d[i] > 0) nonEmpty++
              }
              const sorted = times.slice(1).sort((a, b) => a - b)
              resolve({
                nonEmpty,
                avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
                p95: sorted[Math.floor(sorted.length * 0.95)],
                eyebrow: document.querySelector('.fe-sky-title .fe-eyebrow')?.textContent ?? '',
                source: document.querySelector('.fe-source-line')?.textContent ?? '',
                label: [...document.querySelectorAll('.fe-datum')].map((d) => d.textContent).join(' | '),
                overflow: document.documentElement.scrollWidth - window.innerWidth,
              })
            }
          }
          requestAnimationFrame(tick)
        }),
    )

    if (!state.nonEmpty) fail(where, 'the 3D canvas drew nothing')
    if (state.overflow > 0) fail(where, `horizontal overflow of ${state.overflow}px`)
    if (body?.texture) {
      const hit = requests.find((r) => r.url.includes(body.texture))
      if (!hit) fail(where, `texture ${body.texture} was never requested`)
      else if (hit.status !== 200 || !/image\//.test(hit.type)) fail(where, `texture ${body.texture}: HTTP ${hit.status} ${hit.type}`)
      if (!state.source.includes(body.textureCredit)) fail(where, 'the textureCredit is not on screen')
    }
    if (body) {
      const illustration = body.textureKind === 'illustration' || (!body.texture && !body.model)
      const saysIllustration = /illustration/i.test(state.eyebrow) && /Label\s*Illustration/i.test(state.label)
      const saysData = /3D model/i.test(state.eyebrow) && /Label\s*NASA data/i.test(state.label)
      if (illustration && !saysIllustration) fail(where, `should be labelled an illustration (eyebrow "${state.eyebrow}", ${state.label})`)
      if (!illustration && !saysData) fail(where, `should be labelled NASA data (eyebrow "${state.eyebrow}", ${state.label})`)
    }
    console.log(`${where.padEnd(24)} canvas ${String(state.nonEmpty).padStart(5)} px  frame avg ${state.avg.toFixed(1)} ms p95 ${state.p95.toFixed(1)} ms  ${state.eyebrow}`)
    await page.close()
  }
  await context.close()
}
await browser.close()

if (failures.length) {
  console.error(`\ncheck-bodies: ${failures.length} problem(s)`)
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}
console.log(`\ncheck-bodies: ${ids.length} views x ${VIEWPORTS.length} viewports OK`)
