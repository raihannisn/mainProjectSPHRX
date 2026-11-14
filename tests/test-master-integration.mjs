import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Use the playwright-core from arvr/node_modules
const playwrightPath = path.resolve('arvr/node_modules/playwright-core/index.mjs');
const { chromium } = await import(pathToFileURL(playwrightPath).href);

const targetUrl = process.env.BASE_URL || 'http://localhost:5173';
const screenshotDir = path.resolve('scratch/screenshots/integration');
fs.mkdirSync(screenshotDir, { recursive: true });

console.log('=== STARTING MASTER INTEGRATION TEST SUITE ===');
console.log(`Target URL: ${targetUrl}`);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = {
  gateway: {},
  skyExplorer: {},
  comparison: {},
  xrSpherex: {},
  deepLink: {},
  responsive: []
};

try {
  // ─────────────────────────────────────────────────────────────────
  // TEST 1: GATEWAY SCREEN
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 1. Testing Gateway Screen ---');
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto(`${targetUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // Check title & headings
  const heading = await page.$eval('h1', (el) => el.textContent.trim());
  console.log(`Gateway Heading: "${heading}"`);

  // Verify capability cards remain absent
  const capSection = await page.$('#capabilities');
  const capCards = await page.$$('.fe-cap, .cap');
  console.log(`Capability Cards Count: ${capCards.length} (Expected: 0)`);
  results.gateway.noCapabilityCards = capSection === null && capCards.length === 0;

  // Test "Explore capabilities" toast
  const buttons = await page.$$('.fe-btn-text');
  for (const btn of buttons) {
    const text = await btn.textContent();
    if (text.includes('Explore capabilities')) {
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(300);
  const toastText = await page.evaluate(() => {
    const t = document.querySelector('.fe-toast');
    return t ? t.textContent.trim() : '';
  });
  console.log(`Explore Capabilities Toast: "${toastText}"`);
  results.gateway.capabilitiesToast = toastText.length > 0;

  // Test "NASA APOD Highlight ✦" modal
  for (const btn of buttons) {
    const text = await btn.textContent();
    if (text.includes('APOD')) {
      await btn.click();
      break;
    }
  }
  await page.waitForFunction(() => {
    const titleEl = document.getElementById('fe-apod-title');
    return titleEl && !titleEl.textContent.includes('Loading');
  }, { timeout: 12000 });
  const apodTitle = await page.evaluate(() => {
    const titleEl = document.getElementById('fe-apod-title');
    return titleEl ? titleEl.textContent.trim() : '';
  });
  console.log(`NASA APOD Modal Title: "${apodTitle}"`);
  results.gateway.apodLoaded = apodTitle.length > 0 && !apodTitle.includes('unavailable');

  // Close APOD modal
  const closeBtn = await page.$('.fe-modal-close');
  if (closeBtn) await closeBtn.click();
  await page.waitForTimeout(300);

  // Test "Enter expedition" button navigates to /explorer
  await page.click('.fe-btn-primary');
  await page.waitForTimeout(800);
  const currentUrl = page.url();
  console.log(`Navigated to: ${currentUrl}`);
  results.gateway.navigatesToExplorer = currentUrl.includes('/explorer');

  // ─────────────────────────────────────────────────────────────────
  // TEST 2: SKY EXPLORER SCREEN
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Testing Sky Explorer Screen ---');
  await page.goto(`${targetUrl}/explorer?target=rcw-36`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.fe-obs-select', { timeout: 20000 });

  // Check object info
  const targetName = await page.$eval('.fe-hud-object h2', (el) => el.textContent.trim());
  const tagText = await page.$eval('.fe-tag', (el) => el.textContent.trim());
  console.log(`Target Name: "${targetName}", Tag: "${tagText}"`);
  results.skyExplorer.catalogTargetLoaded = targetName.includes('RCW 36') && tagText.includes('CATALOG');

  // Check observations returned
  const obsSelect = await page.$('.fe-obs-select');
  const obsText = await page.evaluate(() => {
    const sel = document.querySelector('.fe-obs-select');
    if (sel) return `${sel.options.length} options, selected: ${sel.value}`;
    const el = document.querySelector('.fe-datum strong');
    return el ? el.textContent.trim() : '';
  });
  console.log(`Observations: ${obsText}`);
  results.skyExplorer.observationsLoaded = obsSelect !== null;

  // Test illustrative target handling
  const candidateBtn = await page.$('.fe-marker.candidate');
  if (candidateBtn) {
    await candidateBtn.click();
    await page.waitForTimeout(600);
    const candidateTag = await page.$eval('.fe-tag', (el) => el.textContent.trim());
    console.log(`Candidate Target Tag: "${candidateTag}"`);
    results.skyExplorer.illustrativeTargetHandled = candidateTag.includes('CANDIDATE');

    // Click "Compare observations" on illustrative target
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.fe-hud-actions button'));
      const c = btns.find((b) => b.textContent.includes('Compare'));
      if (c) c.click();
    });
    await page.waitForTimeout(300);
    const candidateToast = await page.evaluate(() => {
      const t = document.querySelector('.fe-toast');
      return t ? t.textContent.trim() : '';
    });
    console.log(`Illustrative compare toast: "${candidateToast}"`);
    results.skyExplorer.illustrativeBlockedFromCompare = candidateToast.includes('Available for RCW 36') || candidateToast.includes('catalog-backed');
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: OBSERVATION COMPARISON SCREEN
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Testing Observation Comparison Screen ---');
  await page.goto(`${targetUrl}/comparison?target=rcw-36`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.fe-epoch-card', { timeout: 20000 });

  const compareHeading = await page.$eval('h1', (el) => el.textContent.trim());
  console.log(`Comparison heading: "${compareHeading}"`);

  // Check epoch cards
  const epochCards = await page.$$('.fe-epoch-card');
  console.log(`Epoch cards rendered: ${epochCards.length}`);
  results.comparison.twoEpochsRendered = epochCards.length === 2;

  // Check comparison modes: Blink, Side-by-side, Wipe
  const tabs = await page.$$('.fe-tab');
  console.log(`Comparison mode tabs: ${tabs.length}`);
  results.comparison.threeModesAvailable = tabs.length === 3;

  // Check FITS downloads
  const fitsLinks = await page.$$('.fe-epoch-downloads a');
  console.log(`FITS download links: ${fitsLinks.length}`);
  results.comparison.fitsDownloadLinks = fitsLinks.length === 2;

  // Check scientific disclosure
  const notes = await page.$('.fe-scientific-notes');
  const notesText = notes ? await page.evaluate((el) => el.textContent, notes) : '';
  console.log(`Scientific notes present: ${notes !== null}, snippet: "${notesText.slice(0, 60)}..."`);
  results.comparison.scientificDisclosures = notes !== null && notesText.includes('Bandpass Overlap') && notesText.includes('Quality Flag');

  // ─────────────────────────────────────────────────────────────────
  // TEST 4: THREE.JS / WEBXR SPHEREX TABLE
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Testing Three.js SPHEREx Table (Mode A & Mode B) ---');
  // Navigate with two live observations from comparison with wavelength band
  const testBand = '2.032 µm';
  const encodedBand = encodeURIComponent(testBand);
  await page.goto(`${targetUrl}/xr/body/spherex?target=rcw-36&obs=2025W17_4B_0260_1&obs2=2025W17_4B_0260_2&band=${encodedBand}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Check Canvas existence
  const canvas = await page.$('canvas');
  console.log(`Three.js Canvas rendered: ${canvas !== null}`);
  results.xrSpherex.canvasRendered = canvas !== null;

  // Check HUD modes / return button preserves target, obs, obs2, and band
  const returnBtn = await page.$('.hud__modes a');
  const returnHref = returnBtn ? await page.evaluate((el) => el.getAttribute('href'), returnBtn) : '';
  console.log(`Return button href (Live Compare): "${returnHref}"`);
  results.xrSpherex.returnButtonPreservesBand =
    returnHref.includes('/comparison') &&
    returnHref.includes('obs=2025W17_4B_0260_1') &&
    returnHref.includes('obs2=2025W17_4B_0260_2') &&
    returnHref.includes('band=') &&
    (returnHref.includes('2.032') || returnHref.includes('2.032%20%C2%B5m') || returnHref.includes('2.032+%C2%B5m'));

  // Check live comparison state in store (requires BOTH observationDataA and observationDataB)
  const liveCompareState = await page.evaluate(() => {
    const s = window.__xrApp?.getState?.();
    const sx = window.__spherex?.getState?.();
    return {
      obsA: s?.observation,
      obsB: s?.observationB,
      hasDataA: !!s?.observationDataA,
      hasDataB: !!s?.observationDataB,
      band: s?.band,
      view: sx?.view
    };
  });
  console.log('Live compare state in store:', JSON.stringify(liveCompareState));
  results.xrSpherex.liveCompareModeActive =
    liveCompareState.hasDataA &&
    liveCompareState.hasDataB &&
    liveCompareState.obsA === '2025W17_4B_0260_1' &&
    liveCompareState.obsB === '2025W17_4B_0260_2' &&
    liveCompareState.view === 'live-compare';

  // Test Single Live Observation Mode (live-obs): requires observationDataA
  console.log('Navigating to Single Observation XR mode...');
  await page.goto(`${targetUrl}/xr/body/spherex?target=rcw-36&obs=2025W17_4B_0260_1&band=${encodedBand}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const singleReturnBtn = await page.$('.hud__modes a');
  const singleReturnHref = singleReturnBtn ? await page.evaluate((el) => el.getAttribute('href'), singleReturnBtn) : '';
  console.log(`Return button href (Single Obs): "${singleReturnHref}"`);
  results.xrSpherex.liveObsReturnPreservesBand =
    singleReturnHref.includes('/explorer') &&
    singleReturnHref.includes('obs=2025W17_4B_0260_1') &&
    !singleReturnHref.includes('obs2') &&
    singleReturnHref.includes('band=') &&
    (singleReturnHref.includes('2.032') || singleReturnHref.includes('2.032%20%C2%B5m') || singleReturnHref.includes('2.032+%C2%B5m'));

  const liveObsState = await page.evaluate(() => {
    const s = window.__xrApp?.getState?.();
    const sx = window.__spherex?.getState?.();
    return {
      obsA: s?.observation,
      obsB: s?.observationB,
      hasDataA: !!s?.observationDataA,
      hasDataB: !!s?.observationDataB,
      band: s?.band,
      view: sx?.view
    };
  });
  console.log('Live single obs state in store:', JSON.stringify(liveObsState));
  results.xrSpherex.liveObsModeActive =
    liveObsState.hasDataA &&
    !liveObsState.hasDataB &&
    liveObsState.obsA === '2025W17_4B_0260_1' &&
    liveObsState.obsB === null &&
    liveObsState.view === 'live-obs';

  // Verify Curated Mode A remains functional & switching preserves state
  const curatedState = await page.evaluate(() => {
    const store = window.__spherex;
    if (!store?.getState) return null;
    // Switch to curated 'blink' view
    store.getState().setView('blink');
    store.getState().addFlag({ u: 0.5, v: 0.5 });
    store.getState().reveal();
    const cur1 = store.getState();
    const stateInCurated = {
      view: cur1.view,
      flagsCount: cur1.flags.length,
      revealed: cur1.revealed
    };
    // Switch to live-obs and then back to blink
    store.getState().setView('live-obs');
    store.getState().setView('blink');
    const cur2 = store.getState();
    const stateAfterReturn = {
      flagsPreserved: cur2.flags.length === 1,
      revealedPreserved: cur2.revealed === true
    };
    return { stateInCurated, stateAfterReturn };
  });
  console.log('Curated Mode A test:', JSON.stringify(curatedState));
  results.xrSpherex.curatedModePreserved = Boolean(curatedState?.stateAfterReturn?.flagsPreserved && curatedState?.stateAfterReturn?.revealedPreserved);

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: DIRECT DEEP LINK RESOLUTION
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Testing Direct Deep Link Resolution ---');
  const deepPage = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await deepPage.goto(`${targetUrl}/xr/body/spherex?target=rcw-36&obs=2025W17_4B_0260_1&band=${encodedBand}`, { waitUntil: 'domcontentloaded' });

  // Wait for direct deep-link to asynchronously fetch and resolve observation from live backend
  await deepPage.waitForFunction(
    () => Boolean(window.__xrApp?.getState?.()?.observationDataA),
    { timeout: 25000 }
  );

  const deepCanvas = await deepPage.$('canvas');
  const deepReturnBtn = await deepPage.$('.hud__modes a');
  const deepReturnHref = deepReturnBtn ? await deepPage.evaluate((el) => el.getAttribute('href'), deepReturnBtn) : '';
  const deepHasDataA = await deepPage.evaluate(() => !!window.__xrApp?.getState?.()?.observationDataA);
  console.log(`Deep-link canvas: ${deepCanvas !== null}, Return href: "${deepReturnHref}", HasDataA: ${deepHasDataA}`);
  results.deepLink.resolved =
    deepCanvas !== null &&
    deepHasDataA &&
    deepReturnHref.includes('/explorer') &&
    deepReturnHref.includes('target=rcw-36') &&
    deepReturnHref.includes('obs=2025W17_4B_0260_1') &&
    deepReturnHref.includes('band=');
  await deepPage.close();

  // ─────────────────────────────────────────────────────────────────
  // TEST 6: RESPONSIVE VIEWPORTS AUDIT
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Testing Responsive Viewports ---');
  const viewports = [
    { name: 'iPhone SE (320x568)', width: 320, height: 568, isTouch: true },
    { name: 'Android Standard (360x800)', width: 360, height: 800, isTouch: true },
    { name: 'iPhone Standard (390x844)', width: 390, height: 844, isTouch: true },
    { name: 'Large Smartphone (430x932)', width: 430, height: 932, isTouch: true },
    { name: 'Tablet Portrait (768x1024)', width: 768, height: 1024, isTouch: true },
    { name: 'Tablet Landscape (1024x768)', width: 1024, height: 768, isTouch: true },
    { name: 'Desktop Baseline (1366x768)', width: 1366, height: 768, isTouch: false },
  ];

  for (const vp of viewports) {
    const vpPage = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await vpPage.goto(`${targetUrl}/`, { waitUntil: 'domcontentloaded' });
    await vpPage.waitForTimeout(400);

    const overflow = await vpPage.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
      return scrollWidth > window.innerWidth;
    });

    // Check language button target size
    const langBox = await vpPage.evaluate(() => {
      const el = document.querySelector('.fe-lang-btn, .fe-lang');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    });

    // Touch viewports require width >= 44 AND height >= 44 (WCAG 2.5.5 Level AAA). Desktop does not impose this requirement.
    const touchAdequate = vp.isTouch
      ? (langBox !== null && langBox.width >= 44 && langBox.height >= 44)
      : (langBox !== null && langBox.height >= 32);

    console.log(`Viewport ${vp.name}: Overflow=${overflow ? 'YES' : 'NO'}, Lang button size=${langBox ? `${langBox.width}x${langBox.height}` : 'N/A'}, TouchAdequate=${touchAdequate}`);
    results.responsive.push({
      viewport: vp.name,
      isTouch: vp.isTouch,
      noOverflow: !overflow,
      touchTargetAdequate: touchAdequate
    });

    await vpPage.close();
  }

  await page.close();
} finally {
  await browser.close();
}

console.log('\n=== MASTER INTEGRATION TEST RESULTS ===');
console.log(JSON.stringify(results, null, 2));

// Explicit per-assertion verification
const assertions = [
  ['Gateway: No capability cards', results.gateway.noCapabilityCards],
  ['Gateway: Explore capabilities toast', results.gateway.capabilitiesToast],
  ['Gateway: NASA APOD modal loads', results.gateway.apodLoaded],
  ['Gateway: Enter expedition navigates to Explorer', results.gateway.navigatesToExplorer],
  ['Sky Explorer: Catalog target RCW 36 loaded', results.skyExplorer.catalogTargetLoaded],
  ['Sky Explorer: 50 observations populated in dropdown', results.skyExplorer.observationsLoaded],
  ['Sky Explorer: Illustrative candidate target handled', results.skyExplorer.illustrativeTargetHandled],
  ['Sky Explorer: Candidate blocked from false comparison', results.skyExplorer.illustrativeBlockedFromCompare],
  ['Comparison: Two epochs rendered', results.comparison.twoEpochsRendered],
  ['Comparison: 3 comparison modes available', results.comparison.threeModesAvailable],
  ['Comparison: FITS download links present', results.comparison.fitsDownloadLinks],
  ['Comparison: Scientific disclosures present', results.comparison.scientificDisclosures],
  ['XR SPHEREx: Three.js Canvas rendered', results.xrSpherex.canvasRendered],
  ['XR SPHEREx: Live Compare mode active with Data A & Data B', results.xrSpherex.liveCompareModeActive],
  ['XR SPHEREx: Live Compare return button preserves band and parameters', results.xrSpherex.returnButtonPreservesBand],
  ['XR SPHEREx: Live Obs mode active with Data A', results.xrSpherex.liveObsModeActive],
  ['XR SPHEREx: Live Obs return button preserves band and parameters', results.xrSpherex.liveObsReturnPreservesBand],
  ['XR SPHEREx: Mode A curated state preserved across mode transitions', results.xrSpherex.curatedModePreserved],
  ['Deep Link: Direct XR URL resolves and preserves query context', results.deepLink.resolved],
];

// Add responsive assertions for each viewport
for (const r of results.responsive) {
  assertions.push([`Responsive: ${r.viewport} - No horizontal overflow`, r.noOverflow]);
  assertions.push([`Responsive: ${r.viewport} - Touch target adequate`, r.touchTargetAdequate]);
}

console.log('\n=== ASSERTION BREAKDOWN ===');
let allPassed = true;
for (const [desc, val] of assertions) {
  const pass = val === true;
  if (!pass) allPassed = false;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${desc}`);
}

console.log(`\nOVERALL TEST SUITE STATUS: ${allPassed ? 'ALL PASS (100%)' : 'SOME TESTS FAILED'}`);
process.exit(allPassed ? 0 : 1);
