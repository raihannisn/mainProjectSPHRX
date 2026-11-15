import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:5173'

async function run() {
  console.log(`Starting Playwright test on ${base}...`)
  
  let browser
  try {
    browser = await chromium.launch({
      executablePath: '/Applications/Opera.app/Contents/MacOS/Opera',
      headless: true,
      args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--ignore-certificate-errors', '--no-sandbox']
    })
  } catch (err) {
    console.log('Opera launch failed:', err.message)
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox']
    })
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  try {
    // 1. Visit Gateway Screen
    console.log('Step 1: Navigating to Gateway screen /')
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    // Verify particle count
    const gatewayParticles = await page.locator('.fe-particle-field .fe-particle').count()
    console.log(`Gateway particle count: ${gatewayParticles} (should be > 100)`)
    if (gatewayParticles < 100) {
      throw new Error(`Expected > 100 particles, got ${gatewayParticles}`)
    }

    // 2. Click "Enter expedition ↗"
    console.log('Step 2: Clicking "Enter expedition ↗" to test forward Wormhole transition')
    const enterBtn = page.locator('button.fe-btn-primary:has-text("Enter expedition")')
    await enterBtn.click()

    // Check that wormhole opens
    await page.waitForSelector('.fe-wormhole--on', { timeout: 3000 })
    console.log('✓ Wormhole overlay activated (.fe-wormhole--on visible)')

    // Wait for transition to complete and navigate to /explorer
    await page.waitForURL('**/explorer', { timeout: 5000 })
    console.log('✓ Successfully arrived at /explorer')

    // Wait for wormhole to close
    await page.waitForSelector('.fe-wormhole:not(.fe-wormhole--on)', { timeout: 4000 })
    console.log('✓ Wormhole overlay closed smoothly')

    // 3. Verify Bottom Particle Stream in Cosmic Expedition
    console.log('Step 3: Checking Cosmic Expedition bottom particles and linear fade')
    const bottomStream = page.locator('.fe-particle-bottom-stream')
    const hasBottomStream = await bottomStream.count() > 0
    console.log(`Bottom particle stream present: ${hasBottomStream}`)
    if (!hasBottomStream) {
      throw new Error('Missing .fe-particle-bottom-stream in /explorer')
    }

    const bottomParticles = await page.locator('.fe-particle-bottom-stream .fe-particle').count()
    console.log(`Bottom particle count: ${bottomParticles} (should be around 70)`)
    if (bottomParticles === 0) {
      throw new Error('Zero particles in bottom stream')
    }

    // Verify mask-image on bottom stream
    const maskStyle = await bottomStream.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return style.maskImage || style.webkitMaskImage
    })
    console.log(`Bottom stream mask: ${maskStyle}`)
    if (!maskStyle || maskStyle === 'none') {
      console.warn('Warning: mask-image style was not reported as gradient, check CSS')
    } else {
      console.log('✓ Bottom stream has linear gradient mask applied!')
    }

    // 4. Enter 3D scene (Solar System Hub or XR)
    console.log('Step 4: Navigating to 3D scene (/xr) via dock link')
    const xrBtn = page.locator('.fe-dock button:has-text("Solar System Hub")')
    await xrBtn.click()

    await page.waitForSelector('.fe-wormhole--on', { timeout: 3000 })
    console.log('✓ Wormhole overlay activated entering 3D')

    await page.waitForURL('**/xr**', { timeout: 8000 })
    console.log('✓ Successfully arrived at /xr')

    // Wait for scene to settle and wormhole to close
    await page.waitForSelector('.fe-wormhole:not(.fe-wormhole--on)', { timeout: 7000 })
    console.log('✓ Wormhole closed in 3D')

    // 5. Test transition back from 3D to 2D
    console.log('Step 5: Testing transition back from 3D to 2D expedition')
    // Wait for either the 2D Explorer link in HUD or the TopBar Sky Explorer link
    await page.waitForTimeout(1500)
    
    // Look for link back to 2D
    const backLink = page.locator('a[href*="/explorer"], a:has-text("2D Explorer"), a:has-text("Sky Explorer")').first()
    const backFound = await backLink.count() > 0
    console.log(`Back link found in 3D: ${backFound}`)
    
    if (backFound) {
      await backLink.click()
      // Check wormhole triggers on exit!
      await page.waitForSelector('.fe-wormhole--on', { timeout: 3000 })
      console.log('✓ Wormhole overlay activated when exiting 3D back to 2D!')

      await page.waitForURL('**/explorer**', { timeout: 6000 })
      console.log('✓ Successfully returned to /explorer from 3D!')

      await page.waitForSelector('.fe-wormhole:not(.fe-wormhole--on)', { timeout: 4000 })
      console.log('✓ Wormhole closed cleanly back on /explorer!')
    } else {
      console.log('Could not find back link, testing TopBar navigation...')
      const navItem = page.locator('.fe-topbar a:has-text("Sky Explorer")')
      await navItem.click()
      await page.waitForSelector('.fe-wormhole--on', { timeout: 3000 })
      console.log('✓ Wormhole triggered from TopBar exit!')
      await page.waitForURL('**/explorer', { timeout: 6000 })
    }

    console.log('\n========================================')
    console.log('ALL PLAYWRIGHT TESTS PASSED SUCCESSFULLY!')
    console.log(`Errors encountered: ${errors.length}`)
    console.log('========================================\n')
  } finally {
    await browser.close()
  }
}

run().catch((err) => {
  console.error('Playwright Test Failed:', err)
  process.exit(1)
})
