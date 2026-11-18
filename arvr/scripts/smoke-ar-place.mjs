// Smoke test: AR puts the model on a surface, in ONE place that you can place, pick up and reset.
//  - Camera AR (phone camera behind the scene, motion sensors): the model rests on an assumed surface (a table is
//    0.5 m under the phone) where the middle of the screen points; a tap on the screen, or "Place here", pins it there;
//    it stays put while the phone turns; "Pick up" lets it follow again; "Reset" brings it back and re-centres
//  - passthrough / WebXR AR (emulated Meta Quest 3, ?emulate&nodevui): placed in front at a comfortable size,
//    pinned after a moment
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
const flat = (p) => Math.hypot(p.x, p.z)

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })

// ------------------------------------------------------------------ Camera AR on a phone
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, permissions: ['camera'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  // an iPhone asks for motion access when you tap; the emulated phone grants it
  await page.addInitScript(() => { if (window.DeviceOrientationEvent) DeviceOrientationEvent.requestPermission = async () => 'granted'; window.__arNoTrack = true /* this part moves the sensors without moving the picture */ })
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }))
  await page.goto(`${base}/explorer`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.model3d canvas', { timeout: 40000 })
  await page.waitForTimeout(3000)
  // a phone's motion sensor reports continuously: emulate that. Held up (beta 90) it looks straight ahead; tipped
  // towards a table (beta 50) it looks 40 degrees down. "Turning the phone" changes the heading (alpha).
  await page.evaluate(() => {
    window.__alpha = 10
    window.__beta = 50
    setInterval(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: window.__alpha, beta: window.__beta, gamma: 0, absolute: false })), 20)
  })
  const turn = (alpha) => page.evaluate((a) => { window.__alpha = a }, alpha)
  const info = () =>
    page.evaluate(() => {
      const g = window.__arAnchor.group.current
      const cam = g.__r3f.root.getState().camera
      const q = cam.quaternion
      return { pos: { x: g.position.x, y: g.position.y, z: g.position.z }, scale: g.scale.x, locked: window.__arAnchor.locked, fwd: { x: -2 * (q.x * q.z + q.w * q.y), z: -(1 - 2 * (q.x * q.x + q.y * q.y)) } }
    })
  await page.locator('[title="View in AR with your camera"], [aria-label="View in AR with your camera"]').first().click()
  await page.waitForSelector('.ar-controls', { timeout: 15000 })
  await page.waitForFunction(() => !!window.__arAnchor?.group?.current, null, { timeout: 15000 })
  await page.waitForTimeout(1500)
  check('AR shows the aiming reticle and the Place / Reset / surface controls', (await page.locator('.ar-reticle').count()) === 1 && (await page.locator('.ar-btn').count()) === 3)
  check('the hint says to aim at the table and tap', /Aim at your table, then tap the screen/.test((await page.textContent('.ar-hint')) ?? ''))
  const a0 = await info()
  check('the model rests on the table plane, 0.5 m under the phone (not floating at head height)', a0.pos.y < -0.3 && a0.pos.y > -0.6, `y=${a0.pos.y.toFixed(2)} m`)
  check('it is close: within arm-and-a-half of the phone, where the phone points', flat(a0.pos) > 0.4 && flat(a0.pos) < 1.6, `${flat(a0.pos).toFixed(2)} m away`)
  check('it is scaled to a comfortable size', a0.scale > 0.02 && a0.scale < 0.3, `scale ${a0.scale.toFixed(3)}`)

  // unlocked: follows where the phone points
  await turn(80)
  await page.waitForTimeout(1500)
  const a1 = await info()
  check('before placing, it follows your aim when the phone turns', dist(a0.pos, a1.pos) > 0.4, `moved ${dist(a0.pos, a1.pos).toFixed(2)} m`)
  await turn(10)
  await page.waitForTimeout(1500)

  // tap the screen: the model goes on the table at the tapped point. A higher tap is farther away.
  const canvasBox = await page.evaluate(() => { const r = document.querySelector('.model3d canvas').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height } })
  const tapAt = (yFrac) => page.touchscreen.tap(canvasBox.l + canvasBox.w * 0.5, canvasBox.t + canvasBox.h * yFrac)
  await tapAt(0.2)
  await page.waitForTimeout(500)
  const far = await info()
  check('tapping the screen places it and pins it', far.locked === true && (await page.locator('.ar-reticle').count()) === 0)
  check('a tapped point lands on the table plane', far.pos.y < -0.3 && far.pos.y > -0.6, `y=${far.pos.y.toFixed(2)} m`)
  await page.click('.ar-btn >> nth=0') // Pick up
  await page.waitForTimeout(600)
  await tapAt(0.45)
  await page.waitForTimeout(500)
  const near = await info()
  check('tapping lower on the screen puts it nearer, higher puts it farther', flat(far.pos) > flat(near.pos) + 0.05, `high tap ${flat(far.pos).toFixed(2)} m, low tap ${flat(near.pos).toFixed(2)} m`)
  check('it is pinned at the new spot', near.locked === true)

  // pinned: stays while the phone turns
  await turn(150)
  await page.waitForTimeout(1500)
  const a2 = await info()
  check('placed: it stays in its spot while the phone turns away', dist(near.pos, a2.pos) < 0.02, `moved ${dist(near.pos, a2.pos).toFixed(3)} m`)
  check('... and the camera really did turn', Math.hypot(a2.fwd.x - a1.fwd.x, a2.fwd.z - a1.fwd.z) > 0.5)
  check('a tap while it is pinned does not move it', await (async () => { await page.touchscreen.tap(canvasBox.l + canvasBox.w * 0.3, canvasBox.t + canvasBox.h * 0.25); await page.waitForTimeout(500); return dist((await info()).pos, a2.pos) < 0.02 })())

  // pick up and the "Place here" button
  await page.click('.ar-btn >> nth=0')
  await page.waitForTimeout(1500)
  const a3 = await info()
  check('"Pick up" lets it follow your aim again', a3.locked === false && dist(a2.pos, a3.pos) > 0.4, `moved ${dist(a2.pos, a3.pos).toFixed(2)} m`)
  await page.click('.ar-btn >> nth=0') // Place here
  await page.waitForTimeout(400)
  check('"Place here" pins it where it floats', (await info()).locked === true)

  // table vs floor: the floor is farther below the phone
  await page.click('.ar-btn >> nth=0') // pick up
  await page.click('.ar-surface')
  await page.waitForTimeout(1500)
  const onFloor = await info()
  check('"Floor" puts the model on a plane 1.35 m under the phone', onFloor.pos.y < -1.0 && onFloor.pos.y > -1.5, `y=${onFloor.pos.y.toFixed(2)} m`)
  await page.click('.ar-surface')
  await page.waitForTimeout(800)

  // reset
  await page.click('.ar-btn >> nth=0') // pin it
  await turn(200)
  await page.waitForTimeout(800)
  await page.click('.ar-btn >> nth=1') // Reset
  await page.waitForTimeout(1500)
  const r = await info()
  check('"Reset" un-pins it and brings it back where you are aiming', r.locked === false && flat(r.pos) > 0.4 && flat(r.pos) < 1.6, `${flat(r.pos).toFixed(2)} m`)
  check('"Reset" re-centres the compass: forward is straight ahead again', r.fwd.z < -0.6 && Math.abs(r.fwd.x) < 0.2, `fwd (${r.fwd.x.toFixed(2)}, ${r.fwd.z.toFixed(2)})`)
  check('the buttons are at least 44px tall on a phone', await page.evaluate(() => [...document.querySelectorAll('.ar-btn')].every((b) => b.getBoundingClientRect().height >= 44)))
  check('the controls do not sit on the toolbar, the title or the object card', await page.evaluate(() => {
    const c = document.querySelector('.ar-controls').getBoundingClientRect()
    const hit = (sel) => [...document.querySelectorAll(sel)].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && c.left < r.right && r.left < c.right && c.top < r.bottom && r.top < c.bottom })
    return !hit('.fe-toolbar') && !hit('.fe-sky-title') && !hit('.fe-hud-card') && !hit('.fe-hud-actions')
  }))
  check('the controls fit inside the phone screen', await page.evaluate(() => { const c = document.querySelector('.ar-controls').getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth && c.bottom <= innerHeight }))
  check('no page errors (camera AR)', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

// ------------------------------------------------------------------ pinned model follows the camera PICTURE
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, permissions: ['camera'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    if (window.DeviceOrientationEvent) DeviceOrientationEvent.requestPermission = async () => 'granted'
    // a camera that films a textured table which we can slide: window.__shift is how far it has moved, in picture pixels
    window.__shift = 0
    const pattern = document.createElement('canvas')
    pattern.width = 1200
    pattern.height = 640
    const pc = pattern.getContext('2d')
    let seed = 5
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    pc.fillStyle = '#777'
    pc.fillRect(0, 0, 1200, 640)
    for (let i = 0; i < 2200; i++) {
      const g = Math.floor(30 + rnd() * 200)
      pc.fillStyle = `rgb(${g},${g},${g})`
      const r = 4 + rnd() * 18
      pc.beginPath(); pc.arc(rnd() * 1200, rnd() * 640, r, 0, 6.3); pc.fill()
    }
    const cam = document.createElement('canvas')
    cam.width = 360
    cam.height = 640
    const cc = cam.getContext('2d')
    const draw = () => { cc.drawImage(pattern, 420 - window.__shift, 0, 360, 640, 0, 0, 360, 640) }
    draw()
    cam.style.cssText = 'position:fixed;left:0;top:0;width:90px;height:160px;opacity:0.02;pointer-events:none;z-index:-1'
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(cam))
    setInterval(draw, 33)
    window.__arFrameSource = cam // stands in for the camera picture the page reads (the real video element still plays the fake device)
  })
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }))
  await page.goto(`${base}/explorer`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.model3d canvas', { timeout: 40000 })
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    window.__alpha = 10
    window.__beta = 50
    setInterval(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: window.__alpha, beta: window.__beta, gamma: 0, absolute: false })), 20)
  })
  await page.locator('[title="View in AR with your camera"]').first().click()
  await page.waitForSelector('.ar-controls', { timeout: 15000 })
  await page.waitForFunction(() => !!window.__arAnchor?.group?.current, null, { timeout: 15000 })
  await page.waitForTimeout(2500)
  const screenX = () =>
    page.evaluate(() => {
      const g = window.__arAnchor.group.current
      const st = g.__r3f.root.getState()
      const v = g.position.clone().project(st.camera)
      const r = st.gl.domElement.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    })
  const box = await page.evaluate(() => { const r = document.querySelector('.model3d canvas').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height } })
  await page.touchscreen.tap(box.l + box.w * 0.5, box.t + box.h * 0.42)
  await page.waitForTimeout(1500)
  check('pinned (picture-following test)', (await page.evaluate(() => window.__xrApp.getState().arLocked)) === true)
  const p0 = await screenX()
  // slide the table 110 picture pixels to the right, smoothly, as if the phone moved left
  await page.evaluate(() => new Promise((res) => { let n = 0; const t = setInterval(() => { window.__shift += 3.6; if (++n >= 30) { clearInterval(t); res() } }, 40) }))
  await page.waitForTimeout(1200)
  const p1 = await screenX()
  const s = Math.max(box.w / 360, box.h / 640)
  const expected = 110 * s
  check('pinned: when the table slides in the picture, the model slides with it', Math.abs(p1.x - p0.x - expected) < Math.abs(expected) * 0.35, `moved ${(p1.x - p0.x).toFixed(0)} px, the table moved ${expected.toFixed(0)} px`)
  // and back again: no drift
  await page.evaluate(() => new Promise((res) => { let n = 0; const t = setInterval(() => { window.__shift -= 3.6; if (++n >= 30) { clearInterval(t); res() } }, 40) }))
  await page.waitForTimeout(1200)
  const p2 = await screenX()
  check('... and back to where it was when the table slides back', Math.abs(p2.x - p0.x) < 40 && Math.abs(p2.y - p0.y) < 40, `off by ${(p2.x - p0.x).toFixed(0)}, ${(p2.y - p0.y).toFixed(0)} px`)
  check('no page errors (picture tracking)', errors.length === 0, errors.slice(0, 3).join(' | '))
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
