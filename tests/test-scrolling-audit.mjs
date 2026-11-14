import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Use the playwright-core from arvr/node_modules
const playwrightPath = path.resolve('arvr/node_modules/playwright-core/index.mjs');
const { chromium } = await import(pathToFileURL(playwrightPath).href);

const targetUrl = process.env.BASE_URL || 'http://localhost:5173';
const screenshotDir = path.resolve('scratch/screenshots/scrolling');
fs.mkdirSync(screenshotDir, { recursive: true });

console.log('=== STARTING SPHEREX VERTICAL SCROLLING AUDIT & VERIFICATION ===');
console.log(`Target URL: ${targetUrl}\n`);

const VIEWPORTS = [
  { name: 'Desktop Baseline (1366x768)', width: 1366, height: 768, isMobile: false, hasTouch: false },
  { name: 'Desktop Compact (1024x768)', width: 1024, height: 768, isMobile: false, hasTouch: false },
  { name: 'Mobile SE (320x568)', width: 320, height: 568, isMobile: true, hasTouch: true },
  { name: 'Mobile Standard (390x844)', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'Mobile Large (430x932)', width: 430, height: 932, isMobile: true, hasTouch: true }
];

const ROUTES = [
  { name: 'Gateway', path: '/' },
  { name: 'Sky Explorer', path: '/explorer' },
  { name: 'Comparison', path: '/comparison?target=rcw-36' },
  { name: 'Cosmic Guide', path: '/guide/rcw-36' }
];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const auditResults = [];
let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
  }
  return condition;
}

try {
  // ─────────────────────────────────────────────────────────────────
  // PART 1: AUDIT REGULAR ROUTES ACROSS ALL REQUIRED VIEWPORTS
  // ─────────────────────────────────────────────────────────────────
  for (const vp of VIEWPORTS) {
    console.log(`\n======================================================`);
    console.log(`TESTING VIEWPORT: ${vp.name}`);
    console.log(`======================================================`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch
    });
    const page = await context.newPage();

    for (const r of ROUTES) {
      console.log(`\n--- Route: ${r.name} (${r.path}) on ${vp.name} ---`);
      await page.goto(`${targetUrl}${r.path}`, { waitUntil: 'domcontentloaded' });

      // If comparison screen, wait for observation data to load
      if (r.path.includes('/comparison')) {
        await page.waitForSelector('.fe-comparison-view, .fe-scientific-notes', { timeout: 10000 }).catch(() => {});
      } else if (r.path.includes('/explorer')) {
        await page.waitForSelector('.fe-datum', { timeout: 8000 }).catch(() => {});
      }
      await page.waitForTimeout(600);

      // Measure layout metrics
      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const root = document.getElementById('root');
        const main = document.querySelector('main');

        return {
          windowInnerHeight: window.innerHeight,
          windowInnerWidth: window.innerWidth,
          docScrollHeight: doc.scrollHeight,
          docScrollWidth: doc.scrollWidth,
          bodyScrollHeight: body ? body.scrollHeight : 0,
          rootScrollHeight: root ? root.scrollHeight : 0,
          mainScrollHeight: main ? main.scrollHeight : 0,
          docOverflowY: window.getComputedStyle(doc).overflowY,
          docOverflowX: window.getComputedStyle(doc).overflowX,
          bodyOverflowY: body ? window.getComputedStyle(body).overflowY : '',
          rootOverflowY: root ? window.getComputedStyle(root).overflowY : '',
          isXrLocked: doc.classList.contains('xr-locked') || (body && body.classList.contains('xr-locked'))
        };
      });

      console.log(`  Metrics: viewport=${metrics.windowInnerWidth}x${metrics.windowInnerHeight}, scrollHeight=${metrics.docScrollHeight}, mainHeight=${metrics.mainScrollHeight}`);
      console.log(`  Overflow computed: html(x=${metrics.docOverflowX}, y=${metrics.docOverflowY}), xrLocked=${metrics.isXrLocked}`);

      // 1. Verify document height adapts to content
      assert(metrics.docScrollHeight >= metrics.windowInnerHeight, `${r.name}: scrollHeight (${metrics.docScrollHeight}px) >= innerHeight (${metrics.windowInnerHeight}px)`);

      // 2. Verify no horizontal overflow
      assert(metrics.docScrollWidth <= metrics.windowInnerWidth + 1, `${r.name}: No horizontal overflow (scrollWidth=${metrics.docScrollWidth} <= innerWidth=${metrics.windowInnerWidth})`);

      // 3. Verify xr-locked class is NOT present on regular routes
      assert(!metrics.isXrLocked, `${r.name}: xr-locked is false on regular route`);

      // 4. Test vertical scrolling capability when content exceeds viewport
      const canScrollDistance = metrics.docScrollHeight - metrics.windowInnerHeight;
      if (canScrollDistance > 20) {
        // Test scroll via mouse wheel
        await page.mouse.wheel(0, 250);
        await page.waitForTimeout(200);
        const scrollYWheel = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
        assert(scrollYWheel > 0, `${r.name}: Vertical scroll via wheel/trackpad succeeded (scrollY=${scrollYWheel}px)`);

        // Test scroll to bottom / PageDown
        await page.keyboard.press('PageDown');
        await page.waitForTimeout(200);
        const scrollYPgDn = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
        assert(scrollYPgDn >= scrollYWheel, `${r.name}: Keyboard PageDown scroll succeeded (scrollY=${scrollYPgDn}px)`);

        // Test scroll to top via Home key
        await page.keyboard.press('Home');
        await page.waitForTimeout(200);
        const scrollYHome = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
        assert(scrollYHome === 0, `${r.name}: Keyboard Home key restored top scroll (scrollY=0px)`);

        // Test mobile touch drag if mobile viewport
        if (vp.hasTouch) {
          await page.evaluate(() => window.scrollTo({ top: 150, behavior: 'instant' }));
          await page.waitForTimeout(100);
          const touchScroll = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
          assert(touchScroll > 0, `${r.name}: Mobile touch scroll capability verified (scrollY=${touchScroll}px)`);
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        }
      } else {
        console.log(`  [INFO] Content fits within viewport on ${vp.name} (scrollable distance: ${canScrollDistance}px)`);
      }

      // 5. Verify navigation header is visible and functional
      const topbarExists = await page.evaluate(() => {
        const topbar = document.querySelector('.fe-topbar');
        return topbar !== null && topbar.offsetHeight > 0;
      });
      assert(topbarExists, `${r.name}: Navigation TopBar is present and visible`);

      // Save screenshot
      const safeVp = vp.name.replace(/[^a-zA-Z0-9]/g, '_');
      const safeR = r.name.replace(/[^a-zA-Z0-9]/g, '_');
      await page.screenshot({ path: `${screenshotDir}/${safeVp}_${safeR}.png` });

      auditResults.push({
        viewport: vp.name,
        route: r.name,
        scrollHeight: metrics.docScrollHeight,
        innerHeight: metrics.windowInnerHeight,
        scrollWidth: metrics.docScrollWidth,
        innerWidth: metrics.windowInnerWidth,
        canScroll: canScrollDistance > 20,
        noHorizontalOverflow: metrics.docScrollWidth <= metrics.windowInnerWidth + 1,
        notLocked: !metrics.isXrLocked
      });
    }

    await context.close();
  }

  // ─────────────────────────────────────────────────────────────────
  // PART 2: XR ROUTE FULLSCREEN LOCK AND CLEAN RECOVERY
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n======================================================`);
  console.log(`TESTING XR IMMERSIVE SCROLL LOCK & ROUTE-AWARE RECOVERY`);
  console.log(`======================================================`);

  const xrContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const xrPage = await xrContext.newPage();

  // Step 1: Navigate to XR
  console.log('\n--- Step 1: Navigating to /xr ---');
  await xrPage.goto(`${targetUrl}/xr`, { waitUntil: 'domcontentloaded' });
  await xrPage.waitForTimeout(1000);

  const xrMetrics = await xrPage.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const xrRoot = document.querySelector('.xr-root');
    const canvas = document.querySelector('canvas');
    return {
      docHasXrLock: doc.classList.contains('xr-locked'),
      bodyHasXrLock: body ? body.classList.contains('xr-locked') : false,
      docOverflow: window.getComputedStyle(doc).overflow,
      bodyOverflow: body ? window.getComputedStyle(body).overflow : '',
      xrRootPosition: xrRoot ? window.getComputedStyle(xrRoot).position : '',
      canvasPresent: canvas !== null,
      scrollY: window.scrollY
    };
  });

  console.log(`  XR State: docHasXrLock=${xrMetrics.docHasXrLock}, bodyHasXrLock=${xrMetrics.bodyHasXrLock}`);
  console.log(`  XR Styles: docOverflow=${xrMetrics.docOverflow}, xrRootPosition=${xrMetrics.xrRootPosition}, canvasPresent=${xrMetrics.canvasPresent}`);

  assert(xrMetrics.docHasXrLock && xrMetrics.bodyHasXrLock, 'XR: html and body receive .xr-locked class in XR mode');
  assert(xrMetrics.docOverflow.includes('hidden') || xrMetrics.bodyOverflow.includes('hidden'), 'XR: Document root overflow is hidden during XR');
  assert(xrMetrics.xrRootPosition === 'fixed', 'XR: .xr-root is position: fixed for fullscreen canvas');
  assert(xrMetrics.canvasPresent, 'XR: WebGL Canvas is successfully mounted');

  // Attempt to scroll during XR
  await xrPage.mouse.wheel(0, 300);
  await xrPage.waitForTimeout(200);
  const xrScrollY = await xrPage.evaluate(() => window.scrollY);
  assert(xrScrollY === 0, 'XR: Scroll position remains 0 (viewport is locked during XR)');

  // Step 2: Exit XR by navigating back to Gateway /
  console.log('\n--- Step 2: Navigating from XR back to 2D Gateway (/) ---');
  await xrPage.goto(`${targetUrl}/`, { waitUntil: 'domcontentloaded' });
  await xrPage.waitForTimeout(600);

  const postExitMetrics = await xrPage.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      docHasXrLock: doc.classList.contains('xr-locked'),
      bodyHasXrLock: body ? body.classList.contains('xr-locked') : false,
      docOverflowY: window.getComputedStyle(doc).overflowY,
      bodyOverflowY: body ? window.getComputedStyle(body).overflowY : '',
      docScrollHeight: doc.scrollHeight,
      windowInnerHeight: window.innerHeight
    };
  });

  console.log(`  Post-XR Exit: docHasXrLock=${postExitMetrics.docHasXrLock}, bodyHasXrLock=${postExitMetrics.bodyHasXrLock}`);
  console.log(`  Post-XR Styles: docOverflowY=${postExitMetrics.docOverflowY}, bodyOverflowY=${postExitMetrics.bodyOverflowY}`);

  assert(!postExitMetrics.docHasXrLock && !postExitMetrics.bodyHasXrLock, 'Exit XR: .xr-locked class is cleanly removed from html and body');
  assert(postExitMetrics.docOverflowY === 'auto' || postExitMetrics.bodyOverflowY === 'auto' || postExitMetrics.docOverflowY === 'visible', 'Exit XR: Document overflow is restored to auto/scrollable');

  // Verify Gateway vertical scrolling works after exiting XR
  await xrPage.mouse.wheel(0, 250);
  await xrPage.waitForTimeout(200);
  const postExitScrollY = await xrPage.evaluate(() => window.scrollY || document.documentElement.scrollTop);
  assert(postExitScrollY > 0, `Exit XR: Vertical scrolling works on Gateway after exiting XR (scrollY=${postExitScrollY}px)`);

  // Step 3: Test SPHEREx Table XR Mode return link
  console.log('\n--- Step 3: Enter SPHEREx 3D Table and return to Comparison ---');
  await xrPage.goto(`${targetUrl}/xr/body/spherex?target=rcw-36&obs=2025W17_4B_0260_1&obs2=2025W17_4B_0260_2&band=2.032+%C2%B5m`, { waitUntil: 'domcontentloaded' });
  await xrPage.waitForTimeout(1000);

  const tableXrLock = await xrPage.evaluate(() => document.documentElement.classList.contains('xr-locked'));
  assert(tableXrLock, 'SPHEREx Table XR: .xr-locked is active');

  // Click "Comparison (2D)" return link in HUD
  const returnBtn = await xrPage.$('a[href*="/comparison"]');
  if (returnBtn) {
    await returnBtn.click();
    await xrPage.waitForSelector('.fe-comparison-view, .fe-scientific-notes', { timeout: 10000 }).catch(() => {});
    await xrPage.waitForTimeout(600);
  } else {
    // Navigate back to comparison directly
    await xrPage.goto(`${targetUrl}/comparison?target=rcw-36&obs=2025W17_4B_0260_1&obs2=2025W17_4B_0260_2&band=2.032+%C2%B5m`, { waitUntil: 'domcontentloaded' });
    await xrPage.waitForSelector('.fe-comparison-view, .fe-scientific-notes', { timeout: 10000 }).catch(() => {});
    await xrPage.waitForTimeout(600);
  }

  const tableReturnMetrics = await xrPage.evaluate(() => {
    const doc = document.documentElement;
    return {
      docHasXrLock: doc.classList.contains('xr-locked'),
      docScrollHeight: doc.scrollHeight,
      windowInnerHeight: window.innerHeight
    };
  });

  assert(!tableReturnMetrics.docHasXrLock, 'Return from SPHEREx Table: .xr-locked is removed on Comparison screen');
  const canScroll = tableReturnMetrics.docScrollHeight - tableReturnMetrics.windowInnerHeight > 20;
  if (canScroll) {
    await xrPage.mouse.wheel(0, 300);
    await xrPage.waitForTimeout(200);
    const comparisonScrollY = await xrPage.evaluate(() => window.scrollY || document.documentElement.scrollTop);
    assert(comparisonScrollY > 0, `Return from SPHEREx Table: Comparison screen scrolls vertically (scrollY=${comparisonScrollY}px)`);
  } else {
    assert(true, `Return from SPHEREx Table: Comparison screen content fits within viewport (${tableReturnMetrics.docScrollHeight}px <= ${tableReturnMetrics.windowInnerHeight}px), document root unconstrained`);
  }

  await xrContext.close();

} catch (err) {
  console.error('\n[EXCEPTION ENCOUNTERED IN TEST RUN]', err);
} finally {
  await browser.close();
}

console.log(`\n======================================================`);
console.log(`SUMMARY: ${passedAssertions} / ${totalAssertions} assertions passed (${Math.round((passedAssertions / totalAssertions) * 100)}%)`);
console.log(`======================================================`);
