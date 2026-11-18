// Smoke test: AR keeps the model in ONE place that you can place, pick up and reset.
//  - Camera AR (phone camera behind the scene, motion sensors): floats in front of the aim until "Place here", then
//    stays put while the phone turns; "Reset" brings it back in front of the new heading and re-centres the compass
//  - passthrough / WebXR AR (emulated Meta Quest 3, ?emulate&nodevui): placed in front at a comfortable size,
//    pinned after a moment, "Pick up" and "Reset" work
// Needs a dev server (dev build exposes window.__arAnchor):   cd arvr; $env:XR_HTTP='1'; npx vite --port 5173
//   node scripts/smoke-ar-place.mjs [--base=http://localhost:5173]
import { chromium } from 'playwright-core'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true'] }))
const base = args.base ?? 'http://localhost:5173'
let failed = 0
function check(name, ok, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })

// ------------------------------------------------------------------ Camera AR on a phone
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, permissions: ['camera'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  // an iPhone asks for motion access when you tap; the emulated phone grants it
  await page.addInitScript(() => { if (window.DeviceOrientationEvent) DeviceOrientationEvent.requestPermission = async () => 'granted' })
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }))
  await page.goto(`${base}/explorer`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.model3d canvas', { timeout: 40000 })
  await page.waitForTimeout(3000)
  // a phone's motion sensor reports continuously: emulate that, and "turn the phone" by changing the heading
  await page.evaluate(() => {
    window.__alpha = 10
    setInterval(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: window.__alpha, beta: 90, gamma: 0, absolute: false })), 20)
  })
  const turn = (alpha) => page.evaluate((a) => { window.__alpha = a }, alpha)
  const info = () =>
    page.evaluate(() => {
      const a = window.__arAnchor
      const g = a.group.current
      const cam = g.__r3f.root.getState().camera
      const f = { x: 0, y: 0, z: -1 }
      const q = cam.quaternion
      // forward = q * (0,0,-1)
      const x = 2 * (q.x * q.z + q.w * q.y) * -1
      const z = (1 - 2 * (q.x * q.x + q.y * q.y)) * -1
      void f
      return { pos: { x: g.position.x, y: g.position.y, z: g.position.z }, scale: g.scale.x, locked: window.__arAnchor.locked, fwd: { x, z } }
    })
  const startAr = page.locator('[title="View in AR with your camera"], [aria-label="View in AR with your camera"]').first()
  await startAr.click()
  await turn(10)
  await page.waitForSelector('.ar-controls', { timeout: 15000 })
  await page.waitForFunction(() => !!window.__arAnchor?.group?.current, null, { timeout: 15000 })
  await turn(10)
  await page.waitForTimeout(1200)
  check('AR shows the aiming reticle and the Place / Reset controls', (await page.locator('.ar-reticle').count()) === 1 && (await page.locator('.ar-btn').count()) === 2)
  check('the hint asks you to aim and place', /Aim at a spot/.test((await page.textContent('.ar-hint')) ?? ''))
  const a0 = await info()
  check('the model floats in front of you at a close, comfortable distance (not far away)', a0.pos.z < -0.9 && a0.pos.z > -1.8 && Math.abs(a0.pos.x) < 0.3, `z=${a0.pos.z.toFixed(2)} m`)
  check('it is scaled to a small, steady size', a0.scale > 0.04 && a0.scale < 0.4, `scale ${a0.scale.toFixed(3)}`)

  // unlocked: it follows where the phone points
  await turn(70)
  await page.waitForTimeout(1500)
  const a1 = await info()
  check('before placing, it follows your aim when the phone turns', dist(a0.pos, a1.pos) > 0.6, `moved ${dist(a0.pos, a1.pos).toFixed(2)} m`)

  // place: pinned
  await page.click('.ar-btn >> nth=0')
  await page.waitForTimeout(400)
  const placed = await info()
  check('"Place here" pins it', placed.locked === true && (await page.getAttribute('.ar-btn >> nth=0', 'aria-pressed')) === 'true')
  check('the reticle disappears once it is placed', (await page.locator('.ar-reticle').count()) === 0)
  await turn(150)
  await page.waitForTimeout(1500)
  const a2 = await info()
  check('placed: it stays in its spot while the phone turns away', dist(placed.pos, a2.pos) < 0.02, `moved ${dist(placed.pos, a2.pos).toFixed(3)} m`)
  check('... and the camera really did turn', Math.hypot(a2.fwd.x - a1.fwd.x, a2.fwd.z - a1.fwd.z) > 0.5)

  // pick up: follows again
  await page.click('.ar-btn >> nth=0')
  await page.waitForTimeout(1500)
  const a3 = await info()
  check('"Pick up" lets it follow your aim again', a3.locked === false && dist(a2.pos, a3.pos) > 0.6, `moved ${dist(a2.pos, a3.pos).toFixed(2)} m`)

  // reset: in front of the new heading, unpinned, compass re-centred
  await page.click('.ar-btn >> nth=0') // pin it somewhere first
  await turn(200)
  await page.waitForTimeout(800)
  await page.click('.ar-btn >> nth=1') // Reset
  await page.waitForTimeout(1500)
  const r = await info()
  check('"Reset" un-pins it and brings it back in front of you', r.locked === false && r.pos.z < -0.9 && Math.abs(r.pos.x) < 0.35, `pos (${r.pos.x.toFixed(2)}, ${r.pos.z.toFixed(2)})`)
  check('"Reset" re-centres the compass: forward is straight ahead again', r.fwd.z < -0.9 && Math.abs(r.fwd.x) < 0.2, `fwd (${r.fwd.x.toFixed(2)}, ${r.fwd.z.toFixed(2)})`)
  check('Place / Reset are at least 44px tall on a phone', await page.evaluate(() => [...document.querySelectorAll('.ar-btn')].every((b) => b.getBoundingClientRect().height >= 44)))
  check('the controls do not sit on the toolbar, the title or the object card', await page.evaluate(() => {
    const c = document.querySelector('.ar-controls').getBoundingClientRect()
    const hit = (sel) => [...document.querySelectorAll(sel)].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && c.left < r.right && r.left < c.right && c.top < r.bottom && r.top < c.bottom })
    return !hit('.fe-toolbar') && !hit('.fe-sky-title') && !hit('.fe-hud-card') && !hit('.fe-hud-actions')
  }))
  check('the controls fit inside the phone screen', await page.evaluate(() => { const c = document.querySelector('.ar-controls').getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth && c.bottom <= innerHeight }))
  check('no page errors (camera AR)', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

// ------------------------------------------------------------------ passthrough AR in a headset (emulated Quest 3)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }))
  await page.goto(`${base}/explorer?emulate&nodevui`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.model3d canvas', { timeout: 40000 })
  await page.waitForFunction(() => !!window.__xrStore, null, { timeout: 20000 })
  await page.waitForTimeout(2500)
  await page.evaluate(() => window.__xrStore.enterAR())
  await page.waitForFunction(() => window.__xrStore.getState().session && window.__arAnchor?.group?.current, null, { timeout: 30000 })
  check('passthrough AR (immersive-ar) started', (await page.evaluate(() => window.__xrStore.getState().mode)) === 'immersive-ar')
  await page.waitForTimeout(2500)
  const q = () => page.evaluate(() => { const g = window.__arAnchor.group.current; return { x: g.position.x, y: g.position.y, z: g.position.z, scale: g.scale.x, locked: window.__arAnchor.locked } })
  const h = await q()
  check('in passthrough the model is placed in front of you, at a comfortable size', h.z < -0.5 && h.z > -1.5 && h.scale < 0.2, `z=${h.z.toFixed(2)} m, scale ${h.scale.toFixed(3)}`)
  await page.waitForTimeout(1500)
  const pinned = await page.evaluate(() => window.__xrApp?.getState?.().arLocked ?? window.__arAnchor.locked)
  check('it pins itself after a moment, so it stays where it first appeared', pinned === true)
  // turn the headset (the emulated head) 90 degrees: a pinned model must not follow
  const before = await q()
  await page.evaluate(() => { const d = window.__xrDevice; const a = Math.PI / 2; d.quaternion.set(0, Math.sin(a / 2), 0, Math.cos(a / 2)) })
  await page.waitForTimeout(1500)
  const after = await q()
  check('pinned: turning your head does not carry it along', dist(before, after) < 0.02, `moved ${dist(before, after).toFixed(3)} m`)
  await page.evaluate(() => window.__xrStore.getState().session?.end())
  check('no page errors (passthrough AR)', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

await browser.close()
console.log(`\n${failed === 0 ? 'All checks passed' : `${failed} check(s) FAILED`}`)
process.exit(failed ? 1 : 0)
