// End-to-end UI tests in real Chromium (desktop 1366×820 + mobile 390×844).
// Run: BASE=http://localhost:8080 node tests/e2e.mjs   (server must be running; see scripts/dev-restart.sh)
// Third-party map services are answered from real captured fixtures (tests/e2e-net.mjs); the browser
// has no other network access. Screenshots: docs/screenshots/v03-*.png.
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
  if (ONLY && !ONLY.test(name) && !/map-first/.test(name)) return;
  const t = Date.now();
  try { await fn(); results.push(`PASS ${name} (${Date.now() - t} ms)`); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); console.log(`FAIL ${name}`, e.message.split('\n').slice(0, 3).join(' | ')); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

async function newPage(vp, { fail = {}, colorScheme = 'light' } = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.isMobile, geolocation: { latitude: 17.7289, longitude: 83.305, accuracy: 10 }, permissions: ['geolocation'], colorScheme, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
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
const detent = (page) => page.getAttribute('#sheet', 'data-detent');
const view = (page) => page.evaluate(() => window.__bm?.ctx.views.current);
const waitView = (page, v, timeout = 15000) => page.waitForFunction((x) => window.__bm?.ctx.views.current === x, v, { timeout });
async function home(page) { await page.evaluate(() => { window.__bm.ctx.views.show('home', { detent: 'half' }); }); await page.waitForTimeout(300); }
async function boot(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__bm?.ctx && document.querySelectorAll('#cats .chip').length === 12, null, { timeout: 25000 });
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

  await step(`${V}: modes — two-wheeler estimate label, walk uses foot profile, transit shows stops (no timetable)`, async () => {
    await page.click('[data-mode=two]');
    await page.waitForSelector('#dirRoutes .note.warn');
    assert(/Estimate: uses car routing/.test(await page.textContent('#dirRoutes')), 'two-wheeler estimate');
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
      await page.click('#navEnd');
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
      await page.click('#tdBtn');
      await page.waitForTimeout(1500);
      assert(await page.evaluate(() => window.__bm.ctx.map.getPitch()) > 40, 'pitched');
      assert(await page.isVisible('#compassBtn'), 'compass visible when tilted');
      await shot(page, 'desktop-13-layers-3d');
      await page.click('#compassBtn'); await page.waitForTimeout(900);
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

await browser.close();
console.log(results.join('\n'));
fs.writeFileSync('docs/e2e-results.txt', `${results.join('\n')}\n`);
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
