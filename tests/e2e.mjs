// End-to-end UI tests in real Chromium (desktop 1366×820 + mobile 390×844).
// Run: BASE=http://localhost:8080 node tests/e2e.mjs   (server must be running; see scripts/dev-restart.sh)
// Third-party map services are answered from real captured fixtures (tests/e2e-net.mjs); the browser
// has no other network access. Screenshots: docs/screenshots/v03-*.png, v04-*.png, v05-*.png.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { installNetworkFixtures, SPEECH_STUB } from './e2e-net.mjs';

const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.env.SHOTS || 'docs/screenshots';
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const step = async (name, fn) => {
  if (ONLY && !ONLY.test(name) && !/map-first|performance/.test(name)) return;
  const t = Date.now();
  try { await fn(); results.push(`PASS ${name} (${Date.now() - t} ms)`); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); console.log(`FAIL ${name}`, e.message.split('\n').slice(0, 3).join(' | ')); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

async function newPage(vp, { fail = {}, colorScheme = 'light', blockSW = false } = {}) {
  const ctx = await browser.newContext({ ...(blockSW ? { serviceWorkers: 'block' } : {}), acceptDownloads: true, viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.isMobile, geolocation: { latitude: 17.7289, longitude: 83.305, accuracy: 10 }, permissions: ['geolocation'], colorScheme, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  const netLog = [];
  await installNetworkFixtures(ctx, { log: netLog, fail });
  await ctx.addInitScript(SPEECH_STUB);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page, errors, netLog };
}
const setLang = (page, l) => page.$eval('#lang', (el, v) => { el.value = v; el.dispatchEvent(new Event('change')); }, l);
const shot = (page, name) => page.screenshot({ path: `${OUT}/v03-${name}.png` });
const shot4 = (page, name) => page.screenshot({ path: `${OUT}/v04-${name}.png` });
const detent = (page) => page.getAttribute('#sheet', 'data-detent');
const view = (page) => page.evaluate(() => window.__bm?.ctx.views.current);
const waitView = (page, v, timeout = 15000) => page.waitForFunction((x) => window.__bm?.ctx.views.current === x, v, { timeout });
// Deterministic camera waits: the map's own state, not a fixed sleep (CI renders with SwiftShader and is slower).
const waitFlat = (page, timeout = 10000) => page.waitForFunction(() => { const m = window.__bm.ctx.map; return !m.isMoving() && m.getPitch() < 1 && Math.abs(m.getBearing()) < 1; }, null, { timeout });
async function home(page) { await page.evaluate(() => { window.__bm.ctx.views.show('home', { detent: 'half' }); }); await page.waitForTimeout(300); }
async function boot(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__bm?.ctx && document.querySelectorAll('#cats .chip').length === 13, null, { timeout: 25000 });
  await page.waitForFunction(() => window.__bm.ctx.map.isStyleLoaded() && window.__bm.ctx.map.getLayer('bm-route'), null, { timeout: 25000 });
  await page.waitForTimeout(1500);
}

for (const vp of [{ name: 'desktop', width: 1366, height: 820 }, { name: 'mobile', width: 390, height: 844, isMobile: true }]) {
  const { ctx, page, errors, netLog } = await newPage(vp);
  const V = vp.name;

  await step(`${V}: map-first home (search pill, 12 category chips, saved, recents)`, async () => {
    await boot(page);
    assert(await page.isVisible('#q'), 'search pill');
    assert((await view(page)) === 'home', 'home view');
    assert(await page.isVisible('#locBtn') && await page.isVisible('#layersBtn') && await page.isVisible('#tdBtn'), 'map controls');
    assert(await page.isHidden('#compassBtn'), 'compass hidden when north-up');
    await shot(page, `${V}-01-home`);
  });

  await step(`${V}: sheet detents (keyboard on grabber + drag + fling)`, async () => {
    await page.focus('#sheetHandle');
    await page.keyboard.press(V === 'mobile' ? 'ArrowUp' : 'ArrowDown');
    await page.waitForTimeout(400);
    assert((await detent(page)) === 'full', `expected full, got ${await detent(page)}`);
    if (V === 'mobile') await shot(page, 'mobile-02-sheet-full');
    await page.keyboard.press('End'); await page.waitForTimeout(400);
    assert((await detent(page)) === 'peek', 'End → peek');
    const label = await page.getAttribute('#sheetHandle', 'aria-label');
    assert(/collapsed/.test(label), `aria-label ${label}`);
    if (V === 'mobile') await shot(page, 'mobile-03-sheet-peek');
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    assert((await detent(page)) === 'half', 'tap/Enter peek → half');
    if (V === 'mobile') {
      // touch-like drag on the grabber: slow drag up → nearest (full), quick flick down → one detent down
      const box = await page.locator('#sheetHandle').boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 12; i++) { await page.mouse.move(x, y - i * 30); await page.waitForTimeout(30); } await page.waitForTimeout(150); await page.mouse.up();
      await page.waitForTimeout(450);
      assert((await detent(page)) === 'full', `slow drag up → full (got ${await detent(page)})`);
      const b2 = await page.locator('#sheetHandle').boundingBox();
      await page.mouse.move(x, b2.y + 10); await page.mouse.down(); for (let i = 1; i <= 4; i++) { await page.mouse.move(x, b2.y + 10 + i * 25); await page.waitForTimeout(20); } await page.mouse.up();
      await page.waitForTimeout(450);
      assert((await detent(page)) === 'half', `fling down from full → half (got ${await detent(page)})`);
    }
  });

  await step(`${V}: category "Petrol" → real OSM POIs (Overpass fixture) → list + markers`, async () => {
    await page.click('#cats [data-cat=fuel]');
    await waitView(page, 'results');
    await page.waitForFunction(() => document.querySelectorAll('#poiList [data-poi]').length >= 10, null, { timeout: 15000 });
    const n = await page.$$eval('.poi-mk', (m) => m.length);
    assert(n >= 10, `markers ${n}`);
    assert(netLog.some((l) => l.startsWith('overpass') && l.includes('fuel')), 'overpass called');
    assert(/Indian Oil|HP|Bharat|Hindustan/i.test(await page.textContent('#poiList')), 'real station names');
    await page.waitForTimeout(1200);
    await shot(page, `${V}-04-category-petrol`);
  });

  await step(`${V}: place card (category, distance, address, actions)`, async () => {
    await page.click('#poiList [data-poi="0"]');
    await waitView(page, 'place');
    await page.waitForSelector('#pcDir');
    const txt = await page.textContent('#placeCard');
    assert(/Petrol/.test(txt) && /from map centre|away/.test(txt), `card text ${txt.slice(0, 120)}`);
    assert(await page.isVisible('#pcSave') && await page.isVisible('#pcShare'), 'actions');
    await page.waitForFunction(() => !/Looking up/.test(document.querySelector('#pcAddr').textContent), null, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await shot(page, `${V}-05-place-card`);
  });

  await step(`${V}: save to Favourites + set Home → shown on home sheet`, async () => {
    await page.click('#pcSave');
    await page.waitForSelector('#listDlg[open]');
    await page.check('#listChoices [data-lc=favorites]');
    await page.click('#listDlgClose');
    await page.click('#pcHome');
    await home(page);
    const sc = await page.textContent('#shortcuts');
    assert(/Favourites\s*1 places/.test(sc.replace(/\s+/g, ' ')), `favourites: ${sc}`);
    assert(!/Set Home/.test(sc), 'home set');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bm-saved-v1')));
    assert(stored.home && stored.lists[0].items.length === 1, 'persisted');
    await shot(page, `${V}-06-saved-home`);
  });

  await step(`${V}: search "RK Beach" (local resolver) → directions with alternatives`, async () => {
    await page.fill('#q', 'RK Beach');
    await page.waitForFunction(() => /RK Beach/.test(document.querySelector('#suggest li')?.textContent || ''), null, { timeout: 8000 });
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await waitView(page, 'place');
    assert(/RK Beach/.test(await page.textContent('#placeTitle')), 'place title');
    await page.click('#pcDir');
    await waitView(page, 'directions');
    await page.waitForSelector('#dirRoutes [data-route]', { timeout: 15000 });
    const routes = await page.$$eval('#dirRoutes [data-route]', (b) => b.length);
    assert(routes >= 2 && routes <= 3, `alternatives ${routes}`);
    await page.click('#dirRoutes [data-route="1"]');
    assert((await page.getAttribute('#dirRoutes [data-route="1"]', 'aria-checked')) === 'true', 'select alt');
    const sel = await page.evaluate(() => window.__bm.ctx.style.routes.features.filter((f) => f.properties.selected).map((f) => f.properties.index));
    assert(sel.length === 1 && sel[0] === 1, `selected on map ${sel}`);
    await page.click('#dirRoutes [data-route="0"]');
    await page.click('#dirSteps summary');
    const steps = await page.textContent('#dirSteps');
    assert(/Turn (left|right)|Continue|Head out/.test(steps), 'step list');
    await page.waitForTimeout(1200);
    await shot(page, `${V}-07-directions`);
  });

  await step(`${V}: modes — two-wheeler via Valhalla motor_scooter (no estimate label), walk uses foot profile, transit shows stops (no timetable)`, async () => {
    await page.click('[data-mode=two]');
    await page.waitForFunction(() => /Valhalla/.test(document.querySelector('#dirRoutes')?.textContent || ''), null, { timeout: 15000 });
    assert(netLog.includes('valhalla motor_scooter'), 'valhalla motor_scooter requested');
    assert(!/Estimate: uses car routing/.test(await page.textContent('#dirRoutes')), 'real two-wheeler route is not an estimate');
    await page.click('[data-mode=walk]');
    await page.waitForFunction(() => /min/.test(document.querySelector('#dirRoutes .r-time')?.textContent || ''));
    assert(netLog.some((l) => l === 'osrm routed-foot'), 'foot profile requested');
    await page.click('[data-mode=transit]');
    await page.waitForFunction(() => /timetables aren/.test(document.querySelector('#dirRoutes')?.textContent || ''), null, { timeout: 15000 });
    await page.waitForFunction(() => document.querySelectorAll('#dirRoutes [data-stop]').length >= 1, null, { timeout: 15000 });
    if (V === 'mobile') await shot(page, 'mobile-08-transit');
    await page.click('[data-mode=drive]');
    await page.waitForSelector('#dirSim');
  });

  await step(`${V}: simulate drive → nav banner, voice (en-IN), mute toggle, arrival`, async () => {
    await page.click('#dirSim');
    await page.waitForSelector('#nav:not([hidden])');
    await page.waitForFunction(() => document.querySelector('#navDist').textContent.trim().length > 0, null, { timeout: 10000 });
    assert(await page.isVisible('#navSim'), 'simulation badge');
    assert(await page.isHidden('#sheet'), 'sheet hidden in nav');
    const instr = await page.textContent('#navInstr');
    assert(instr.length > 3, 'instruction');
    await page.waitForTimeout(1500);
    await shot(page, `${V}-09-navigation`);
    const spoken = await page.evaluate(() => window.__spoken);
    assert(spoken.length >= 1 && spoken.every((s) => s.lang === 'en-IN'), `spoken ${JSON.stringify(spoken).slice(0, 120)}`);
    assert((await page.textContent('#navLive')).length > 0, 'live region');
    await page.click('#navMute');
    assert((await page.getAttribute('#navMute', 'aria-pressed')) === 'true', 'muted');
    const before = (await page.evaluate(() => window.__spoken.length));
    await page.click('#simSpeed'); // ×4 → ×16
    await page.waitForTimeout(2500);
    assert((await page.evaluate(() => window.__spoken.length)) === before, 'no speech while muted');
    await page.click('#navMute');
    assert((await page.getAttribute('#navMute', 'aria-pressed')) === 'false', 'unmuted');
    await page.waitForFunction(() => /arrived/.test(document.querySelector('#navInstr').textContent), null, { timeout: 90000 });
    const last = await page.evaluate(() => window.__spoken.at(-1));
    assert(/arrived/.test(last.text), `arrival speech ${last.text}`);
    await shot(page, `${V}-10-arrived`);
    await page.click('#navEnd');
    await page.waitForSelector('#nav', { state: 'hidden' });
    assert(await page.isVisible('#sheet'), 'sheet back');
  });

  if (V === 'desktop') {
    await step('desktop: GPS navigation off-route (3 fixes > 50 m) → reroute request', async () => {
      await page.click('[data-mode=drive]');
      await page.waitForSelector('#dirStart');
      const n0 = netLog.filter((l) => l.startsWith('osrm')).length;
      await page.click('#dirStart');
      await page.waitForSelector('#nav:not([hidden])');
      await page.waitForFunction(() => window.__bm.ctx.nav.state, null, { timeout: 10000 });
      await page.evaluate(() => { for (let i = 0; i < 3; i++) window.__bm.ctx.nav.feed({ lat: 17.7400, lng: 83.2950, accuracy: 8 }); });
      await page.waitForTimeout(800);
      assert(netLog.filter((l) => l.startsWith('osrm')).length > n0, 'reroute requested');
      assert((await page.evaluate(() => window.__spoken.map((s) => s.text).join('|'))).includes('Rerouting'), 'rerouting announced');
      await page.click('#navEnd');
    });
    await step('desktop: landmark-enhanced + Telugu instructions in step list and voice', async () => {
      await setLang(page, 'te');
      await page.waitForFunction(() => /దశలు/.test(document.querySelector('#dirRoutes')?.textContent || ''), null, { timeout: 8000 });
      await page.evaluate(() => { document.querySelector('#dirSteps').open = true; });
      const steps = await page.textContent('#dirSteps');
      assert(/తిరగండి|కొనసాగండి|వెళ్ళండి/.test(steps), `telugu steps ${steps.slice(0, 80)}`);
      await page.click('#dirSim');
      await page.waitForFunction(() => window.__spoken.some((s) => s.lang === 'te-IN'), null, { timeout: 10000 });
      await shot(page, 'desktop-11-nav-telugu');
      // Regression (CI v0.5.9): another camera move right after navigation ends used to cut the reset short and
      // leave the map tilted. Interrupt the reset on purpose; the map must still end north-up and flat.
      await page.click('#navEnd');
      await page.evaluate(() => { const c = window.__bm.ctx; const ctr = c.map.getCenter(); c.cam.fly({ center: [ctr.lng + 0.002, ctr.lat], zoom: 15 }); });
      await waitFlat(page);
      await setLang(page, 'en');
    });
    await step('desktop: right-click drops a pin → reverse geocode (Nominatim fixture) → place card', async () => {
      await home(page);
      await page.mouse.click(900, 400, { button: 'right' });
      await waitView(page, 'place');
      await page.waitForFunction(() => /Visakhapatnam/.test(document.querySelector('#pcAddr').textContent), null, { timeout: 10000 });
      assert(netLog.includes('nominatim reverse'), 'reverse called');
      assert(/DIGIPIN/.test(await page.textContent('#placeCard')), 'digipin shown');
      await shot(page, 'desktop-12-dropped-pin');
    });
    await step('desktop: Photon type-ahead suggestions', async () => {
      await page.fill('#q', 'Kailasa');
      await page.waitForFunction(() => document.querySelectorAll('#suggest li').length >= 2, null, { timeout: 8000 });
      assert(netLog.includes('photon'), 'photon called');
      await page.keyboard.press('Escape');
    });
    await step('desktop: layers sheet (style, 3D buildings, transit, overlays, traffic disabled)', async () => {
      await page.click('#layersBtn');
      await waitView(page, 'layers');
      assert(await page.isDisabled('#lyrTraffic'), 'traffic disabled');
      assert(/licensed data partner/.test(await page.textContent('#layersBody')), 'traffic note');
      await page.check('#lyrTransit');
      assert(await page.evaluate(() => window.__bm.ctx.map.getLayoutProperty('bm-transit', 'visibility')) === 'visible', 'transit layer');
      await page.check('[data-ov=ev]');
      await page.waitForFunction(() => window.__bm.ctx.style.pois.features.length > 0, null, { timeout: 10000 });
      await waitFlat(page); // navigation ended earlier in this journey: the map is back to north-up and flat
      await page.click('#tdBtn');
      await page.waitForFunction(() => !window.__bm.ctx.map.isMoving() && window.__bm.ctx.map.getPitch() > 40, null, { timeout: 10000 }).catch(() => {});
      assert(await page.evaluate(() => window.__bm.ctx.map.getPitch()) > 40, 'pitched');
      assert(await page.isVisible('#compassBtn'), 'compass visible when tilted');
      await shot(page, 'desktop-13-layers-3d');
      await page.click('#compassBtn'); await waitFlat(page).catch(() => {});
      assert(await page.evaluate(() => window.__bm.ctx.map.getPitch()) < 1, 'compass reset');
      await page.uncheck('[data-ov=ev]'); await page.uncheck('#lyrTransit');
    });
    await step('desktop: offline maps screen lists bundled regions with sizes', async () => {
      await home(page);
      await page.click('#openOffline');
      await waitView(page, 'offline');
      const t = await page.textContent('#offlineBody');
      assert(/Visakhapatnam/.test(t) && /Hyderabad/.test(t) && /4\.1 MB/.test(t) && /9\.3 MB/.test(t), t.slice(0, 160));
    });
  }

  await step(`${V}: dark mode (settings toggle → dark map style + tokens)`, async () => {
    await home(page);
    await page.click('#menuBtn');
    await waitView(page, 'settings');
    await page.click('#themeSeg label:nth-child(3)');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    // dark basemap loaded: background layer luminance is low (OpenFreeMap "dark" online / Protomaps "dark" offline)
    await page.waitForFunction(() => { const m = window.__bm.ctx.map; if (!m.isStyleLoaded()) return false; const bg = m.getStyle().layers.find((l) => l.type === 'background'); const c = String(m.getPaintProperty(bg.id, 'background-color') || ''); const n = c.match(/[\d.]+/g)?.map(Number) || []; return n.length >= 3 && (n[0] < 1.01 && n.length === 4 && n[0] + n[1] + n[2] < 0.6 || n[0] + n[1] + n[2] < 150); }, null, { timeout: 20000 });
    await home(page);
    await page.evaluate(() => window.__bm.ctx.map.jumpTo({ center: [83.3050, 17.7230], zoom: 14, pitch: 0, bearing: 0 }));
    await page.waitForTimeout(3000);
    await shot(page, `${V}-14-dark`);
    await page.click('#cats [data-cat=fuel]');
    await page.waitForFunction(() => document.querySelectorAll('#poiList [data-poi]').length >= 10);
    await page.click('#poiList [data-poi="1"]');
    await waitView(page, 'place');
    await page.waitForTimeout(1500);
    await shot(page, `${V}-15-dark-place`);
    await page.click('#menuBtn'); await waitView(page, 'settings');
    await page.click('#themeSeg label:nth-child(2)');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await home(page);
  });

  // ---------------- Shop: existing commerce flow ----------------
  await step(`${V}: Shop → "LED TVs near me" → seller results + price markers`, async () => {
    await page.click('#openShop');
    await waitView(page, 'shop');
    await page.waitForSelector('#results .card h3', { timeout: 20000 });
    assert((await page.$$eval('#results .card', (c) => c.length)) >= 3, 'results');
    assert((await page.$$eval('.mk', (m) => m.length)) >= 3, 'price markers');
    await page.waitForTimeout(1500);
    await shot(page, `${V}-16-shop`);
  });
  await step(`${V}: Telugu UI + native product query`, async () => {
    await setLang(page, 'te');
    const ph = await page.getAttribute('#q', 'placeholder'); assert(ph.includes('వెతకండి'), ph);
    await page.fill('#shopQ', 'టీవీ దగ్గర'); await page.press('#shopQ', 'Enter');
    await page.waitForFunction(() => document.querySelectorAll('#results .card').length >= 3);
    await setLang(page, 'en');
  });
  await step(`${V}: add to cart → sign in → place order → live tracking`, async () => {
    await page.fill('#shopQ', 'LED TVs near me'); await page.press('#shopQ', 'Enter');
    await page.waitForSelector('[data-add]:not([disabled])');
    await page.click('[data-add]:not([disabled])');
    await page.click('#cartBtn');
    await page.waitForSelector('#cartDlg[open]');
    await page.fill('#dropAddr', 'near RTC Complex, Dwaraka Nagar, Vizag'); await page.click('#dropLocate');
    await page.waitForFunction(() => /landmark/.test(document.querySelector('#dropInfo').textContent));
    await page.click('#placeBtn');
    await page.waitForSelector('#authDlg[open]');
    await page.click('#authForm button.primary');
    await page.waitForFunction(() => !document.querySelector('#authDlg').open);
    await page.click('#cartBtn'); await page.waitForSelector('#cartDlg[open]'); await page.click('#placeBtn');
    await page.waitForSelector('#tracking .card', { timeout: 15000 });
    await page.waitForFunction(() => /Out for delivery|Delivered/.test(document.querySelector('#tracking').textContent), null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    await shot(page, `${V}-17-tracking`);
  });
  await step(`${V}: assistant supplier discovery`, async () => {
    await page.click('[data-tab=assistant]');
    await page.fill('#chatIn', 'Find LED TV suppliers in Gajuwaka for bulk'); await page.press('#chatIn', 'Enter');
    await page.waitForFunction(() => /wholesale/.test(document.querySelector('#chat').textContent), null, { timeout: 15000 });
  });

  if (V === 'desktop') {
    await step('desktop: saved places sync to server when signed in (PUT/GET /api/me/places)', async () => {
      const r = await page.evaluate(async () => { const t = localStorage.getItem('mapos-token'); const x = await fetch('/api/me/places', { headers: { Authorization: `Bearer ${t}` } }); return x.json(); });
      await page.waitForTimeout(1000);
      const r2 = await page.evaluate(async () => { const t = localStorage.getItem('mapos-token'); const x = await fetch('/api/me/places', { headers: { Authorization: `Bearer ${t}` } }); return x.json(); });
      assert((r2.data || r.data)?.lists?.[0]?.items?.length >= 1, `server copy ${JSON.stringify(r2).slice(0, 100)}`);
    });
    await step('desktop: seller dashboard edit', async () => {
      await page.click('#menuBtn'); await waitView(page, 'settings');
      await page.click('#authBtn'); // sign out
      await home(page); await page.click('#openShop');
      await page.click('[data-tab=seller]');
      await page.click('#demoSeller'); await page.waitForSelector('#authDlg[open]'); await page.fill('#pw', 'demo1234'); await page.click('#authForm button.primary');
      await page.waitForSelector('.kpis', { timeout: 10000 });
      await shot(page, 'desktop-18-seller');
    });
    await step('desktop: mobility tab + address intelligence', async () => {
      await page.click('[data-tab=mobility]');
      await page.click('[data-kind=ev]'); await page.waitForSelector('#mobList .card');
      await page.fill('#geoIn', 'Shop 4, opp. CMR Central, MVP Colony, Vizag 530017'); await page.press('#geoIn', 'Enter');
      await page.waitForFunction(() => /DIGIPIN/.test(document.querySelector('#geoOut').textContent));
    });
    await step('desktop: admin dashboard (KPIs, verify seller, products, users, audit, CSV)', async () => {
      await page.click('#menuBtn'); await waitView(page, 'settings');
      await page.click('#authBtn'); // sign out seller
      await page.click('#authBtn'); await page.waitForSelector('#authDlg[open]');
      await page.fill('#email', 'admin@mapos.demo'); await page.fill('#pw', 'demo1234'); await page.click('#authForm button.primary');
      await page.waitForSelector('#adminTab:not([hidden])');
      await page.waitForSelector('#adminBody .kpis', { timeout: 10000 });
      await shot(page, 'desktop-19-admin');
      await page.click('[data-asec=businesses]'); await page.waitForSelector('[data-verify]');
      const before = await page.$$eval('[data-verify][data-v="1"]', (b) => b.length);
      if (before) { await page.click('[data-verify][data-v="1"]'); await page.waitForFunction((n) => document.querySelectorAll('[data-verify][data-v="1"]').length === n - 1, before); }
      await page.click('[data-asec=products]'); await page.waitForSelector('[data-pactive]');
      await page.click('[data-asec=users]'); await page.waitForSelector('[data-urole]');
      await page.click('[data-asec=overview]'); await page.waitForSelector('[data-csv]');
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('[data-csv]')]);
      const head = fs.readFileSync(await dl.path(), 'utf8').split('\n')[0];
      assert(head.startsWith('id,created_at'), head);
    });
    await step('desktop: notifications bell shows order updates', async () => {
      await page.click('#menuBtn'); await waitView(page, 'settings');
      await page.click('#authBtn'); await page.click('#authBtn'); await page.waitForSelector('#authDlg[open]');
      await page.fill('#email', 'customer@mapos.demo'); await page.fill('#pw', 'demo1234'); await page.click('#authForm button.primary');
      await page.click('#menuBtn'); await waitView(page, 'settings');
      await page.waitForSelector('#bellBtn:not([hidden])', { timeout: 10000 });
      await page.click('#bellBtn'); await page.waitForSelector('#notifDlg[open] .card');
      await page.click('#notifDlg .row.end button');
    });
    await step('desktop: settings — backend URL validation + clear search history', async () => {
      await page.click('#setBtn'); await page.waitForSelector('#setDlg[open]');
      await page.fill('#apiUrl', 'ftp://bad'); await page.click('#setForm button.primary');
      await page.waitForFunction(() => /https/.test(document.querySelector('#setInfo').textContent));
      await page.click('#setClose');
      assert((await page.evaluate(() => JSON.parse(localStorage.getItem('bm-recents-v1') || '[]').length)) > 0, 'has recents');
      await page.click('#clearHistory');
      assert((await page.evaluate(() => JSON.parse(localStorage.getItem('bm-recents-v1')).length)) === 0, 'cleared');
      await shot(page, 'desktop-20-settings');
    });
  }
  if (V === 'mobile') {
    await step('mobile: long-press on the map drops a pin', async () => {
      await home(page);
      await page.evaluate(() => window.__bm.ctx.sheet.set('peek'));
      await page.waitForTimeout(400);
      await page.evaluate(async () => {
        const el = window.__bm.ctx.map.getCanvasContainer();
        const mk = (type, x, y) => { const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y }); el.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true })); };
        mk('touchstart', 200, 330); await new Promise((r) => setTimeout(r, 750)); mk('touchend', 200, 330);
      });
      await waitView(page, 'place');
      await page.waitForFunction(() => /Visakhapatnam/.test(document.querySelector('#pcAddr').textContent), null, { timeout: 10000 });
      await shot(page, 'mobile-12-dropped-pin');
    });
  }
  const relevant = errors.filter((e) => !/WebGL|GPU|Failed to load resource|ERR_BLOCKED_BY_CLIENT|net::ERR|AJAXError|Could not load image/i.test(e));
  results.push(`${relevant.length ? 'WARN' : 'PASS'} ${V}: console errors ${relevant.length}${relevant.length ? ` → ${relevant.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

// ---------------- offline fallback (network map + routing unreachable) ----------------
await step('mobile: offline fallback — network map fails → bundled PMTiles; routing fails → labelled estimate', async () => {
  const { ctx, page } = await newPage({ width: 390, height: 844, isMobile: true }, { fail: { tiles: true, routing: true } });
  let onlineTiles = 0;
  page.on('request', (r) => { if (/\/map\/ofm\//.test(r.url())) onlineTiles++; });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__bm?.ctx.style.offline === true, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__bm.ctx.map.isStyleLoaded() && window.__bm.ctx.map.getSource('protomaps'), null, { timeout: 30000 });
  assert(await page.isVisible('#offlineChip'), 'offline chip');
  await page.fill('#q', 'RK Beach'); await page.waitForFunction(() => /RK Beach/.test(document.querySelector('#suggest li')?.textContent || '')); await page.keyboard.press('Enter');
  await waitView(page, 'place');
  await page.click('#pcDir'); await waitView(page, 'directions');
  await page.waitForFunction(() => /Offline estimate/.test(document.querySelector('#dirRoutes')?.textContent || ''), null, { timeout: 20000 });
  onlineTiles = 0; await page.waitForTimeout(2500);
  assert(onlineTiles === 0, `online tile requests while offline: ${onlineTiles}`);
  await shot(page, 'mobile-18-offline-fallback');
  await ctx.close();
});
// ---------------- prefers-color-scheme: dark (auto theme) ----------------
await step('mobile: auto dark theme from prefers-color-scheme', async () => {
  const { ctx, page } = await newPage({ width: 390, height: 844, isMobile: true }, { colorScheme: 'dark' });
  await boot(page);
  assert((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'auto dark');
  await ctx.close();
});

// ======================= v0.4 =======================
const BG_STUB = `window.__BM_BG_PLUGIN__ = { addListener: async (n, cb) => { window.__bgcb = cb; return { remove() { window.__bgRemoved = true; } }; }, start: async (o) => { window.__bgStarted = o; }, stop: async () => { window.__bgStopped = true; }, requestBackgroundPermission: async () => ({ background: 'granted' }) };`;
const perf = {};
for (const vp of [{ name: 'desktop', width: 1366, height: 820 }, { name: 'mobile', width: 390, height: 844, isMobile: true }]) {
  const V = vp.name;
  // Service workers are blocked so Playwright can intercept the (mocked) region download.
  const { ctx, page, netLog, errors } = await newPage(vp, { blockSW: true });
  await ctx.addInitScript(BG_STUB);
  await step(`v04 ${V}: performance — load time, time to map idle, FPS during a camera animation`, async () => {
    const t0 = Date.now();
    await page.goto(BASE, { waitUntil: 'load' });
    const loadMs = Date.now() - t0;
    await page.waitForFunction(() => window.__bm?.ctx && window.__bm.ctx.map.isStyleLoaded() && window.__bm.ctx.map.getLayer('bm-route'), null, { timeout: 30000 });
    const idleMs = Date.now() - t0;
    await page.waitForTimeout(800);
    const fps = await page.evaluate(() => new Promise((res) => {
      const m = window.__bm.ctx.map; let frames = 0; const t = performance.now();
      const tick = () => { frames++; if (performance.now() - t < 2000) requestAnimationFrame(tick); else res(frames / ((performance.now() - t) / 1000)); };
      requestAnimationFrame(tick); m.easeTo({ center: [83.32, 17.72], zoom: 15, bearing: 30, duration: 2000 });
    }));
    const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
    const js = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => /\.m?js(\?|$)/.test(r.name)).reduce((a, r) => ({ n: a.n + 1, bytes: a.bytes + (r.decodedBodySize || 0) }), { n: 0, bytes: 0 }));
    const lazy = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => /admin\.js|mock-api\.js/.test(r.name)).map((r) => r.name.split('/').pop()));
    perf[V] = { load_ms: loadMs, map_ready_ms: idleMs, dom_content_loaded_ms: nav.dcl, load_event_ms: nav.load, fps_ease_2s: Math.round(fps * 10) / 10, js_files_loaded: js.n, js_decoded_bytes: js.bytes, lazy_modules_loaded_at_boot: lazy, renderer: 'headless Chromium, SwiftShader (software GL)' };
    assert(lazy.length === 0, `admin/mock-api should be lazy: ${lazy}`);
    await page.waitForFunction(() => document.querySelectorAll('#cats .chip').length === 13, null, { timeout: 10000 });
  });
  await step(`v04 ${V}: transit — scheduled Hyderabad Metro itinerary (HMRL GTFS), legs drawn, labelled not live`, async () => {
    await page.evaluate(() => { window.__BM_NOW__ = '2026-10-21T09:00:00+05:30'; window.__bm.ctx.directions.open({ lat: 17.4013, lng: 78.5602, name: 'Uppal' }, { mode: 'transit', from: { lat: 17.4966, lng: 78.3731, name: 'Miyapur' } }); });
    await page.waitForSelector('#dirRoutes [data-itin]', { timeout: 20000 });
    const t = await page.textContent('#dirRoutes');
    assert(/Scheduled times, not live/.test(t), 'scheduled label');
    assert(/Contains data provided by Hyderabad Metro Rail Ltd/.test(t), 'HMRL attribution');
    assert(/Red Line/.test(t) && /Blue Line/.test(t) && /Change at Ameerpet/.test(t), `itinerary text ${t.slice(0, 200)}`);
    assert(await page.evaluate(() => window.__bm.ctx.style.legs.features.some((f) => f.properties.kind === 'ride')), 'ride legs on map');
    await page.waitForTimeout(1500);
    await shot4(page, `${V}-01-transit-itinerary`);
  });
  await step(`v04 ${V}: tolls — Dwaraka Nagar → Anakapalli lists 2 OSM toll plazas (fees not available) and draws them`, async () => {
    await page.evaluate(() => { window.__bm.ctx.directions.open({ lat: 17.6913, lng: 83.0037, name: 'Anakapalli' }, { mode: 'drive', from: { lat: 17.7289, lng: 83.305, name: 'Dwaraka Nagar' } }); });
    await page.waitForFunction(() => /2 toll plaza/.test(document.querySelector('#tollCount')?.textContent || ''), null, { timeout: 20000 });
    const t = await page.textContent('#dirTolls');
    assert(/fees not available/.test(t) && /Aganampudi/.test(t), t.slice(0, 160));
    assert(!/₹/.test(t), 'no rupee amounts');
    assert(await page.evaluate(() => window.__bm.ctx.style.tolls.features.length) === 2, 'toll markers');
    assert(netLog.some((l) => l.startsWith('overpass') && l.includes('toll_booth')), 'overpass toll query');
    await page.check('#avoidTolls');
    await page.waitForFunction(() => /Valhalla/.test(document.querySelector('#dirRoutes')?.textContent || ''), null, { timeout: 15000 });
    assert(netLog.includes('valhalla auto'), 'avoid tolls → Valhalla auto');
    await page.uncheck('#avoidTolls');
    await page.waitForFunction(() => /2 toll plaza/.test(document.querySelector('#tollCount')?.textContent || ''), null, { timeout: 20000 });
    await page.evaluate(() => document.querySelector('#dirTolls').scrollIntoView());
    await page.waitForTimeout(1200);
    await shot4(page, `${V}-02-tolls`);
  });
  await step(`v04 ${V}: EV place card shows charging details (operator, points, connectors) from OSM`, async () => {
    await home(page);
    await page.evaluate(() => window.__bm.ctx.map.jumpTo({ center: [83.305, 17.7289], zoom: 14 }));
    await page.click('#cats [data-cat=ev]');
    await page.waitForFunction(() => document.querySelectorAll('#poiList [data-poi]').length >= 1, null, { timeout: 15000 });
    await page.click('#poiList [data-poi="0"]');
    await page.waitForSelector('#pcEv');
    const t = await page.textContent('#pcEv');
    assert(/Charging/.test(t) && /Connectors/.test(t) && /Operator/.test(t) && /Source: OpenStreetMap/.test(t), t.slice(0, 200));
    await page.waitForTimeout(800);
    await shot4(page, `${V}-03-ev-details`);
  });
  await step(`v04 ${V}: parking place card shows fee / capacity / type`, async () => {
    await home(page);
    await page.click('#cats [data-cat=parking]');
    await page.waitForFunction(() => document.querySelectorAll('#poiList [data-poi]').length >= 1, null, { timeout: 15000 });
    await page.click('#poiList [data-poi="0"]');
    await page.waitForSelector('#pcParking');
    assert(/Fee/.test(await page.textContent('#pcParking')) && /Capacity/.test(await page.textContent('#pcParking')), 'parking details');
  });
  await step(`v04 ${V}: airport + railway chips/overlays`, async () => {
    await home(page);
    assert(await page.isVisible('#cats [data-cat=airport]') || (await page.$('#cats [data-cat=airport]')), 'airport chip');
    await page.click('#layersBtn'); await waitView(page, 'layers');
    assert(await page.$('[data-ov=rail]') && await page.$('[data-ov=airport]'), 'rail + airport overlays');
    await page.check('[data-ov=rail]');
    await page.waitForFunction(() => window.__bm.ctx.style.pois.features.some((f) => f.properties.cat === 'rail'), null, { timeout: 15000 });
    await page.uncheck('[data-ov=rail]');
  });
  await step(`v04 ${V}: low-bandwidth toggle (Settings) → zoom cap, no 3D, smaller Overpass area`, async () => {
    await home(page);
    await page.click('#menuBtn'); await waitView(page, 'settings');
    await page.check('#lowBwSet');
    await page.waitForFunction(() => document.documentElement.classList.contains('low-bw'));
    const st = await page.evaluate(() => ({ max: window.__bm.ctx.map.getMaxZoom(), pol: window.__bm.ctx.bw.policy, td: document.querySelector('#tdBtn').disabled }));
    assert(st.max === 16 && st.pol.overpassMaxKm === 3 && !st.pol.allow3D && st.td, JSON.stringify(st));
    if (V === 'mobile') await shot4(page, `${V}-04-low-bandwidth-settings`);
    await page.uncheck('#lowBwSet');
    await page.waitForFunction(() => !document.documentElement.classList.contains('low-bw'));
    assert(await page.evaluate(() => window.__bm.ctx.map.getMaxZoom()) === 20, 'restored');
  });
  await step(`v04 ${V}: offline region download manager (mocked region host) — progress, downloaded, used offline, delete`, async () => {
    const bytes = fs.readFileSync('web/offline/vizag.pmtiles');
    await page.route(/\/api\/v1\/regions$/, async (route) => {
      const real = await (await route.fetch()).json();
      real.regions = real.regions.map((r) => (r.id === 'visakhapatnam' ? { ...r, available: true, size_bytes: bytes.length, url: '/regions/visakhapatnam.pmtiles' } : r));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(real) });
    });
    await page.route(/\/regions\/visakhapatnam\.pmtiles$/, (route) => route.fulfill({ status: 200, contentType: 'application/octet-stream', headers: { 'content-length': String(bytes.length) }, body: bytes }));
    await home(page);
    await page.click('#openOffline'); await waitView(page, 'offline');
    await page.waitForSelector('#dlList [data-dl=visakhapatnam]:not([disabled])', { timeout: 10000 });
    assert(await page.isDisabled('#dlList [data-dl=bengaluru]'), 'unhosted regions disabled');
    assert(/Not yet on the region host/.test(await page.textContent('#dlList')), 'honest availability');
    await page.click('#dlList [data-dl=visakhapatnam]');
    await page.waitForSelector('#dlList [data-dl-del=visakhapatnam]', { timeout: 20000 });
    assert(/Downloaded/.test(await page.textContent('[data-region-row=visakhapatnam]')), 'downloaded');
    const stored = await page.evaluate(async () => { const c = await caches.open('bm-regions-v1'); return (await c.keys()).length; });
    assert(stored === 1, `cache entries ${stored}`);
    await shot4(page, `${V}-05-offline-regions`);
    // the downloaded region is used by the offline map
    await page.evaluate(() => window.__bm.ctx.style.setForceOffline(true));
    await page.waitForFunction(() => window.__bm.ctx.style.offline && window.__bm.ctx.map.getStyle()?.sources?.protomaps?.url === 'pmtiles://dl-visakhapatnam.pmtiles', null, { timeout: 20000 });
    await page.evaluate(() => window.__bm.ctx.style.setForceOffline(false));
    await page.click('#dlList [data-dl-del=visakhapatnam]');
    await page.waitForSelector('#dlList [data-dl=visakhapatnam]', { timeout: 10000 });
    assert(await page.evaluate(async () => (await (await caches.open('bm-regions-v1')).keys()).length) === 0, 'deleted from cache');
  });
  await step(`v04 ${V}: background navigation — rationale dialog before first GPS navigation, foreground service started/stopped`, async () => {
    await page.evaluate(() => { localStorage.removeItem('bm-bg-rationale'); localStorage.removeItem('bm-bg-nav'); window.__bm.ctx.directions.open({ lat: 17.714, lng: 83.323, name: 'RK Beach' }, { mode: 'drive', from: { lat: 17.7289, lng: 83.305, name: 'Dwaraka Nagar' } }); });
    await page.waitForSelector('#dirStart', { timeout: 15000 });
    await page.click('#dirStart');
    await page.waitForSelector('#bgDlg[open]', { timeout: 10000 });
    assert(/notification/.test(await page.textContent('#bgBody')), 'rationale explains notification');
    await page.waitForTimeout(300);
    await shot4(page, `${V}-06-background-rationale`);
    await page.click('#bgYes');
    await page.waitForFunction(() => window.__bgStarted, null, { timeout: 5000 });
    assert(/Navigating to RK Beach/.test(await page.evaluate(() => window.__bgStarted.text)), 'notification text');
    await page.evaluate(() => window.__bgcb({ latitude: 17.7285, longitude: 83.3052, accuracy: 8, bearing: 180, time: Date.now() }));
    await page.waitForFunction(() => window.__bm.ctx.nav.state, null, { timeout: 5000 });
    await page.click('#navEnd');
    await page.waitForFunction(() => window.__bgStopped === true, null, { timeout: 5000 });
    assert((await page.evaluate(() => localStorage.getItem('bm-bg-rationale'))) === 'yes', 'rationale remembered');
    // Settings shows the toggle and the optional "allow all the time" button only where supported
    await home(page); await page.click('#menuBtn'); await waitView(page, 'settings');
    assert(await page.isVisible('#bgNavSet') || await page.isVisible('label:has(#bgNavSet)'), 'bg toggle');
    assert(await page.isVisible('#bgAlways'), 'allow-always button');
  });
  const relevant = errors.filter((e) => !/WebGL|GPU|Failed to load resource|ERR_BLOCKED_BY_CLIENT|net::ERR|AJAXError|Could not load image/i.test(e));
  results.push(`${relevant.length ? 'WARN' : 'PASS'} v04 ${V}: console errors ${relevant.length}${relevant.length ? ` → ${relevant.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}
await step('v04 mobile: low-bandwidth auto-detected from navigator.connection (Save-Data, 3G)', async () => {
  const { ctx, page } = await newPage({ width: 390, height: 844, isMobile: true });
  await ctx.addInitScript(`Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true, effectiveType: '3g', type: 'cellular', addEventListener() {} } });`);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__bm?.ctx?.bw, null, { timeout: 20000 });
  const pol = await page.evaluate(() => window.__bm.ctx.bw.policy);
  assert(pol.active && pol.reason === 'save-data', JSON.stringify(pol));
  assert(await page.evaluate(() => document.documentElement.classList.contains('low-bw')), 'low-bw class');
  await page.waitForFunction(() => window.__bm.ctx.map.isStyleLoaded() && window.__bm.ctx.map.getMaxZoom() === 16, null, { timeout: 20000 });
  await ctx.close();
});
if (Object.keys(perf).length === 2 && !ONLY) fs.writeFileSync('docs/perf-v04.json', `${JSON.stringify({ measured: new Date().toISOString(), ...perf }, null, 2)}\n`);

// ======================= v0.5 =======================
// Lanes + speed limit + overspeed + junction view (real Bengaluru route: OSRM lanes at the Hosur Road fork, Valhalla
// edge speed limits), night style, permission rationale, report a map problem (OSM Notes API mocked), community
// incidents (device + server), deep links, commute card, offline search, privacy dashboard, voice search, multi-stop,
// live location sharing. Screenshots: docs/screenshots/v05-*.png
const shot5 = (page, name) => page.screenshot({ path: `${OUT}/v05-${name}.png` });
const SILK = { lat: 12.9172, lng: 77.6228, name: 'Silk Board' }, ECITY = { lat: 12.8452, lng: 77.6602, name: 'Electronic City' };
async function startBlrSim(page, { startM, kmh = 95 }) {
  await page.evaluate(async ({ SILK, ECITY, startM, kmh }) => {
    const c = window.__bm.ctx; c.nav.end({ silent: true });
    await c.directions.open({ lat: ECITY.lat, lng: ECITY.lng, name: ECITY.name }, { mode: 'drive', from: SILK });
  }, { SILK, ECITY, startM, kmh });
  await page.waitForFunction(() => window.__bm.ctx.directions.state.result?.routes?.length, null, { timeout: 15000 });
  await page.evaluate(({ startM, kmh }) => { const c = window.__bm.ctx; c.nav.setSimSpeedKmh(kmh); const S = c.directions.state; c.nav.start(S.result.routes[0], { mode: 'drive', dest: S.to, simulate: true, simStartM: startM }); }, { startM, kmh });
  await page.waitForSelector('#nav:not([hidden])');
}
for (const vp of [{ name: 'desktop', width: 1366, height: 820 }, { name: 'mobile', width: 390, height: 844, isMobile: true }]) {
  const V = vp.name;
  const { ctx, page, netLog, errors } = await newPage(vp, { blockSW: true });
  await ctx.addInitScript(`window.__simMult = 1;`);
  await step(`v05 ${V}: boot + deep link ?lat&lon&name opens the place card`, async () => {
    await page.goto(`${BASE}/?simspeed=1&lat=17.714&lon=83.323&name=RK%20Beach`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__bm?.ctx?.map.isStyleLoaded() && window.__bm.ctx.map.getLayer('bm-route'), null, { timeout: 30000 });
    await waitView(page, 'place');
    assert(/RK Beach/.test(await page.textContent('#placeTitle')), 'place title');
  });
  await step(`v05 ${V}: speed limit (Valhalla edge.speed_limit) + overspeed chime + junction view at the fork`, async () => {
    await startBlrSim(page, { startM: 700, kmh: 95 });
    await page.waitForFunction(() => !document.getElementById('navLimit').hidden, null, { timeout: 15000 });
    const lim = Number(await page.textContent('#navLimit b'));
    assert([60, 80].includes(lim), `limit ${lim}`);
    assert(netLog.some((l) => l === 'valhalla trace_attributes'), 'trace_attributes requested');
    await page.waitForFunction(() => document.getElementById('navSpeed').classList.contains('over'), null, { timeout: 12000 });
    assert((await page.evaluate(() => window.__bm.ctx.nav.sounds.log)).includes('overspeed'), 'overspeed chime');
    await page.waitForFunction(() => !document.getElementById('navJunction').hidden, null, { timeout: 12000 });
    assert(await page.$('#navJunction svg.junction-svg path.jv-route'), 'junction svg');
    await page.waitForTimeout(600);
    await shot5(page, `${V}-01-speed-junction`);
  });
  await step(`v05 ${V}: lane guidance from OSRM intersections (2 valid of 3) in the nav banner`, async () => {
    await startBlrSim(page, { startM: 2700, kmh: 60 });
    await page.waitForFunction(() => !document.getElementById('navLanes').hidden, null, { timeout: 12000 });
    const n = await page.$$eval('#navLanes .lane', (x) => x.length); const ok = await page.$$eval('#navLanes .lane.ok', (x) => x.length);
    assert(n === 3 && ok === 2, `lanes ${n}/${ok}`);
    assert(/Lanes/.test(await page.getAttribute('#navLanes .lane-strip', 'aria-label')), 'lane aria');
    await page.waitForTimeout(400);
    await shot5(page, `${V}-02-lanes`);
  });
  await step(`v05 ${V}: speed limit never shown where unknown (8.2–9.9 km of the route)`, async () => {
    await startBlrSim(page, { startM: 8600, kmh: 40 });
    await page.waitForFunction(() => window.__bm.ctx.nav.state && window.__bm.ctx.nav.state.along > 8600, null, { timeout: 10000 });
    await page.waitForTimeout(1500);
    assert(await page.isHidden('#navLimit'), 'limit hidden when unknown');
    assert((await page.evaluate(() => window.__bm.ctx.nav.speed.limit)) == null, 'no limit');
  });
  await step(`v05 ${V}: night driving style (forced) → dark map, amber high-contrast route`, async () => {
    await page.evaluate(() => localStorage.setItem('bm-nav-style', 'night'));
    await startBlrSim(page, { startM: 900, kmh: 40 });
    await page.waitForFunction(() => document.documentElement.dataset.navTheme === 'night' && window.__bm.ctx.style.mapTheme() === 'dark', null, { timeout: 10000 });
    await page.waitForFunction(() => window.__bm.ctx.map.isStyleLoaded() && window.__bm.ctx.map.getLayer('bm-route') && window.__bm.ctx.map.getPaintProperty('bm-route', 'line-color') === '#FFC233', null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    await shot5(page, `${V}-03-night-nav`);
    await page.click('#navTheme'); // night → auto
    assert((await page.evaluate(() => localStorage.getItem('bm-nav-style'))) === 'auto', 'cycle to auto');
    await page.evaluate(() => window.__bm.ctx.nav.end());
    await page.waitForFunction(() => !document.documentElement.dataset.navTheme && !window.__bm.ctx.style.driving, null, { timeout: 5000 });
  });
  await step(`v05 ${V}: report a map problem → OpenStreetMap note (mocked API), rate limited`, async () => {
    await page.evaluate(() => { localStorage.removeItem('bm-notes-history'); window.__bm.ctx.links.handle('geo:0,0?q=17.714,83.323(RK Beach)'); });
    await waitView(page, 'place');
    await page.click('#pcReport');
    await page.waitForSelector('#reportDlg[open]');
    await page.check('[name=rcat][value=missing_place]');
    await page.fill('#reportText', 'Public toilet next to the beach entrance is not on the map');
    await shot5(page, `${V}-04-report-problem`);
    await page.click('#reportSend');
    await page.waitForFunction(() => /4242/.test(document.getElementById('reportStatus').textContent), null, { timeout: 8000 });
    const sent = netLog.filter((l) => l.startsWith('osmnote')).map((l) => l.replace(/\+/g, ' '));
    assert(sent.length === 1 && /lat=17\.714/.test(sent[0]) && /Missing place/.test(sent[0]), `note payload ${sent[0]}`);
    await page.waitForFunction(() => !document.getElementById('reportDlg').open, null, { timeout: 5000 });
    await page.click('#pcReport'); await page.fill('#reportText', 'Second report straight away'); await page.click('#reportSend');
    await page.waitForFunction(() => /wait/i.test(document.getElementById('reportStatus').textContent), null, { timeout: 5000 });
    assert(netLog.filter((l) => l.startsWith('osmnote')).length === 1, 'rate limited');
    await page.click('#reportCancel');
  });
  await step(`v05 ${V}: community incident (device-only, no server) → on the map, labelled unverified, expires in 2 h`, async () => {
    await page.click('#pcReport'); await page.click('[data-rtab=incident]');
    assert(/this device only/.test(await page.textContent('#incNote')), 'device-only note');
    await page.click('[data-inc=pothole]');
    await shot5(page, `${V}-05-incident-report`);
    await page.click('#reportSend');
    await page.waitForFunction(() => window.__bm.ctx.style.incidents.features.length >= 1, null, { timeout: 8000 });
    const inc = await page.evaluate(() => JSON.parse(localStorage.getItem('bm-incidents-local'))[0]);
    assert(inc.type === 'pothole' && inc.expires_ms - inc.created_ms === 7200000, 'expiry 2 h');
  });
  await step(`v05 ${V}: deep links — bharatmap://directions (walk), bharatmap://search, shared favourites list import`, async () => {
    await page.evaluate(() => window.__bm.ctx.links.handle('bharatmap://directions?lat=17.714&lon=83.323&name=RK%20Beach&mode=walk'));
    await waitView(page, 'directions');
    await page.waitForFunction(() => window.__bm.ctx.directions.state.mode === 'walk', null, { timeout: 5000 });
    page.once('dialog', (d) => d.accept());
    const link = await page.evaluate(async () => (await import('/shared/deeplink.js')).buildListLink({ name: 'Vizag beaches', items: [{ name: 'RK Beach', lat: 17.714, lng: 83.323 }, { name: 'Rushikonda Beach', lat: 17.7826, lng: 83.3849 }] }).app);
    await page.evaluate((l) => window.__bm.ctx.links.handle(l), link);
    await waitView(page, 'list');
    assert(/Vizag beaches/.test(await page.textContent('#listTitle')) && (await page.$$eval('#listItems li', (x) => x.length)) === 2, 'list imported');
    await shot5(page, `${V}-06-shared-list`);
  });
  if (V === 'desktop') {
    await step('v05 desktop: multi-stop route — stop row, OSRM request with 3 points', async () => {
      await page.evaluate(() => window.__bm.ctx.directions.open({ lat: 17.714, lng: 83.323, name: 'RK Beach' }, { mode: 'drive', from: { lat: 17.7289, lng: 83.305, name: 'Dwaraka Nagar' } }));
      await page.waitForSelector('#dirStart', { timeout: 15000 });
      await page.evaluate(() => window.__bm.ctx.directions.addStop({ lat: 17.7215, lng: 83.3155, name: 'Siripuram' }));
      await page.waitForFunction(() => document.querySelectorAll('.od-row.stop').length === 1 && document.getElementById('dirStart'), null, { timeout: 15000 });
      assert(netLog.some((l) => l.startsWith('osrm') && l.includes('routed-car')), 'osrm');
      const urls = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((u) => /routed-car.*;.*;/.test(u)));
      assert(urls.length >= 1, '3-point request');
      await shot5(page, 'desktop-07-multistop');
      await page.click('[data-rmstop="0"]');
      await page.waitForFunction(() => !document.querySelector('.od-row.stop'), null, { timeout: 5000 });
    });
    await step('v05 desktop: commute card (Home set + location) → drive ETA labelled no live traffic', async () => {
      await page.evaluate(() => { const c = window.__bm.ctx; c.myLoc = { lat: 17.7289, lng: 83.305, accuracy: 10, ts: Date.now() }; c.saved.setShortcut('home', { id: 'h', name: 'RK Beach', lat: 17.714, lng: 83.323 }); c.views.show('home', { detent: 'half' }); });
      await page.waitForFunction(() => /\d+ min/.test(document.getElementById('commute').textContent), null, { timeout: 15000 });
      assert(/No live traffic/.test(await page.textContent('#commute')), 'label');
      await shot5(page, 'desktop-08-commute');
    });
    await step('v05 desktop: launcher shortcut link (petrol nearby) + arrival summary with "report a problem on this trip"', async () => {
      await page.evaluate(() => { window.__bm.ctx.nav.end(); window.__bm.ctx.links.handle('bharatmap://category?id=fuel'); });
      await waitView(page, 'results');
      await page.evaluate(() => window.__bm.ctx.directions.open({ lat: 17.714, lng: 83.323, name: 'RK Beach' }, { mode: 'drive', from: { lat: 17.7289, lng: 83.305, name: 'Dwaraka Nagar' } }));
      await page.waitForSelector('#dirStart', { timeout: 15000 });
      await page.evaluate(() => { const c = window.__bm.ctx; const r = c.directions.state.result.routes[0]; c.nav.setSimSpeedKmh(60); c.nav.start(r, { mode: 'drive', dest: c.directions.state.to, simulate: true, simStartM: Math.max(0, r.distance_m - 600) }); });
      await page.waitForFunction(() => !document.getElementById('navArrival').hidden, null, { timeout: 30000 });
      await page.waitForTimeout(1500);
      assert(/arrived/.test(await page.textContent('#navInstr')) && await page.isHidden('#navNext'), 'banner shows arrival');
      assert(/Trip summary/.test(await page.textContent('#navArrival')) && /km\/h/.test(await page.textContent('#navArrival')), 'summary');
      assert((await page.evaluate(() => window.__bm.ctx.nav.sounds.log)).includes('arrival'), 'arrival sound');
      await shot5(page, 'desktop-15-arrival-summary');
      await page.click('#navReport'); await page.waitForSelector('#reportDlg[open]'); await page.click('#reportCancel');
      await page.click('#navEnd');
    });
    await step('v05 desktop: offline place index — suggestions from the bundled OSM index (works offline)', async () => {
      // The bundled index ships inside the app (Android assets); in the browser test it is loaded before going offline.
      await page.evaluate(async () => { const m = await import('/lib/offline-index.js'); const c = window.__bm.ctx.map.getCenter(); await m.indexFor({ lat: c.lat, lng: c.lng }); });
      await ctx.setOffline(true);
      await page.fill('#q', ''); await page.click('#q'); await page.type('#q', 'kailas', { delay: 30 });
      await page.waitForFunction(() => [...document.querySelectorAll('#suggest li')].some((li) => /On device/.test(li.textContent) && /Kailasagiri/.test(li.textContent)), null, { timeout: 10000 });
      await shot5(page, 'desktop-09-offline-search');
      await ctx.setOffline(false);
      await page.keyboard.press('Escape');
    });
    await step('v05 desktop: privacy dashboard — lists stored data, export JSON (no token), delete all', async () => {
      await page.evaluate(() => { localStorage.setItem('mapos-token', 'secret-test-token'); window.__bm.ctx.views.show('privacy', { detent: 'full' }); });
      await page.waitForFunction(() => /Saved places/.test(document.getElementById('privacyBody').textContent), null, { timeout: 8000 });
      assert(/Search history|Saved places/.test(await page.textContent('#privacyBody')), 'groups');
      await shot5(page, 'desktop-10-privacy');
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#privExport')]);
      const doc = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
      assert(doc.data['bm-saved-v1'] && !doc.data['mapos-token'], 'export has saved places, no token');
      page.once('dialog', (d) => d.accept());
      await page.click('#privDelete');
      await page.waitForFunction(() => !localStorage.getItem('bm-saved-v1') && !localStorage.getItem('mapos-token'), null, { timeout: 5000 });
    });
  }
  const relevant = errors.filter((e) => !/WebGL|GPU|Failed to load resource|ERR_BLOCKED_BY_CLIENT|net::ERR|AJAXError|Could not load image|ERR_INTERNET_DISCONNECTED/i.test(e));
  results.push(`${relevant.length ? 'WARN' : 'PASS'} v05 ${V}: console errors ${relevant.length}${relevant.length ? ` → ${relevant.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}
// Permission rationale before the OS prompt, and denial handling (no geolocation permission granted).
for (const vp of [{ name: 'desktop', width: 1366, height: 820 }, { name: 'mobile', width: 390, height: 844, isMobile: true }]) {
  const V = vp.name;
  await step(`v05 ${V}: location rationale before the OS prompt; "Not now" asks nothing; denial → settings help`, async () => {
    const c = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.isMobile, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
    await installNetworkFixtures(c, {}); await c.addInitScript(SPEECH_STUB);
    const p = await c.newPage();
    await p.goto(BASE, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__bm?.ctx?.perm && window.__bm.ctx.map.isStyleLoaded(), null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.click('#locBtn');
    await p.waitForSelector('#permDlg[open]', { timeout: 5000 });
    assert((await p.getAttribute('#permDlg', 'data-kind')) === 'location' && /location/i.test(await p.textContent('#permTitle')), 'location rationale');
    assert((await p.$$eval('#permPoints li', (x) => x.length)) === 3, 'three points');
    await p.waitForTimeout(300);
    await shot5(p, `${V}-11-permission-rationale`);
    await p.click('#permNo');
    await p.waitForFunction(() => document.getElementById('locBtn').getAttribute('aria-pressed') === 'false', null, { timeout: 3000 });
    assert(!(await p.evaluate(() => window.__bm.ctx.myLoc)), 'not now → nothing requested');
    // Simulate an OS denial: the browser reports "denied" → denial dialog explains how to re-enable.
    await c.addInitScript(() => {});
    await p.evaluate(() => { navigator.geolocation.watchPosition = (ok, err) => { setTimeout(() => err({ code: 1, message: 'denied' }), 50); return 1; }; navigator.geolocation.clearWatch = () => {}; });
    await p.click('#locBtn');
    await p.waitForSelector('#permDlg[open][data-mode=rationale]', { timeout: 5000 });
    await p.click('#permYes');
    await p.waitForSelector('#permDlg[open][data-mode=denied]', { timeout: 5000 });
    assert(/Permission is off/.test(await p.textContent('#permTitle')), 'denied title');
    await shot5(p, `${V}-12-permission-denied`);
    await p.click('#permYes');
    await c.close();
  });
}
// Voice search (Web Speech API stub) with the microphone rationale.
await step('v05 mobile: voice search — microphone rationale, recognised "petrol" → nearby petrol stations', async () => {
  const { ctx, page } = await newPage({ width: 390, height: 844, isMobile: true });
  await ctx.addInitScript(`{ const q = navigator.permissions.query.bind(navigator.permissions); navigator.permissions.query = (d) => (d?.name === 'microphone' ? Promise.resolve({ state: 'prompt' }) : q(d)); } window.SpeechRecognition = window.webkitSpeechRecognition = function () { const r = this; r.start = () => setTimeout(() => { window.__recLang = r.lang; r.onresult?.({ results: [[{ transcript: 'petrol' }]] }); r.onend?.(); }, 200); };`);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__bm?.ctx?.map.isStyleLoaded() && !document.getElementById('micBtn').hidden, null, { timeout: 30000 });
  await page.click('#micBtn');
  await page.waitForSelector('#permDlg[open][data-kind=microphone]', { timeout: 5000 });
  await page.click('#permYes');
  await waitView(page, 'results');
  await page.waitForFunction(() => document.querySelectorAll('#poiList [data-poi]').length >= 5, null, { timeout: 15000 });
  assert((await page.evaluate(() => window.__recLang)) === 'en-IN', 'recogniser language');
  await shot5(page, 'mobile-13-voice-search');
  await ctx.close();
});
// Server mode: community incidents shared via /api/v1/incidents and live location sharing via /api/v1/live.
await step('v05 desktop: server mode — incident stored on the server (label, confidence, expiry) + live location share → viewer marker', async () => {
  const { ctx, page } = await newPage({ width: 1366, height: 820 });
  await ctx.addInitScript(`localStorage.setItem('mapos-api', ${JSON.stringify(BASE)});`);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__bm?.ctx?.map.isStyleLoaded() && window.__bm.ctx.map.getLayer('bm-incidents'), null, { timeout: 30000 });
  const r = await page.evaluate(async () => (await import('/services/community.js')).reportIncident({ type: 'waterlogging', lat: 17.7262, lng: 83.3075 }));
  assert(r.id && r.verified === false && /not verified/.test(r.label) && r.minutes_left === 120, JSON.stringify(r));
  await page.evaluate(() => window.__bm.ctx.cam.fly({ center: [83.3075, 17.7262], zoom: 15 }));
  await page.waitForFunction(() => window.__bm.ctx.style.incidents.features.some((f) => f.properties.type === 'waterlogging'), null, { timeout: 10000 });
  await page.waitForTimeout(1200);
  await shot5(page, 'desktop-14-incidents-server');
  // live location: start sharing (fix from the browser geolocation), then view the share as a recipient
  const live = page.waitForFunction(() => window.__liveInfo, null, { timeout: 15000 });
  await page.evaluate(() => window.__bm.ctx.on('live', (x) => { window.__liveInfo = x; }));
  await page.evaluate(() => window.__bm.ctx.links.startLive());
  const info = await (await live).jsonValue();
  await page.waitForFunction(async (id) => (await (await fetch(`/api/v1/live/${id}`)).json()).active, info.id, { timeout: 15000 });
  await page.evaluate((id) => window.__bm.ctx.links.watchLive(id), info.id);
  await page.waitForSelector('.live-mk', { timeout: 10000 });
  await page.evaluate(() => window.__bm.ctx.links.stopLive());
  await ctx.close();
});

await browser.close();
console.log(results.join('\n'));
fs.writeFileSync('docs/e2e-results.txt', `${results.join('\n')}\n`);
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
