// v0.7.18 before/after screenshots for the UI/UX pass (A1–A7, A15).
// Usage: BASE=http://localhost:8080 TAG=after node scripts/shots-v0718.mjs   (TAG=before against the v0.7.17 build)
// Third-party services are answered from the E2E fixtures (tests/e2e-net.mjs); nothing reaches the internet.
// The "rich place" below is a SYNTHETIC demo place (made-up tags) used only to show the ribbon / good-to-know blocks.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { installNetworkFixtures } from '../tests/e2e-net.mjs';

const BASE = process.env.BASE || 'http://localhost:8080';
const TAG = process.env.TAG || 'after';
const OUT = process.env.OUT || 'docs/screenshots/v0718';
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const RICH = { id: 'demo:rich', name: 'Sea View Tiffins', lat: 17.7142, lng: 83.3239, address: 'Beach Road, Visakhapatnam 530017', kind: 'poi', category: 'restaurant',
  tags: { amenity: 'restaurant', opening_hours: 'Mo-Su 06:30-22:30', phone: '+91 891 000 0000', 'payment:upi': 'yes', 'payment:cash': 'yes', 'diet:vegetarian': 'only', wheelchair: 'limited', air_conditioning: 'yes', 'name:te': 'సీ వ్యూ టిఫిన్స్', description: 'SYNTHETIC demo place for screenshots: idli, dosa and filter coffee near the beach.' } };

async function page(vp, { dark = false, init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.isMobile, colorScheme: dark ? 'dark' : 'light', geolocation: { latitude: 17.7289, longitude: 83.305 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  await installNetworkFixtures(ctx, { log: [] });
  await ctx.addInitScript(`window.__BM_NOW__ = 'Wed 2026-10-21 9:45 PM IST (UTC+05:30)';`);
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__bm?.ctx && document.querySelectorAll('#cats [data-cat]').length >= 13, null, { timeout: 30000 }).catch(() => {});
  await p.waitForFunction(() => window.__bm?.ctx.map.isStyleLoaded(), null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2500);
  return { ctx, p };
}
const shot = (p, name) => p.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
const run = async (name, fn) => { if (ONLY && !ONLY.test(name)) return; try { await fn(); console.log('ok', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); } };

for (const vp of [{ name: 'desktop', width: 1366, height: 820 }, { name: 'mobile', width: 390, height: 844, isMobile: true }]) {
  const V = vp.name;
  const { ctx, p } = await page(vp);
  await run(`${V} home`, async () => { await shot(p, `${V}-01-home`); });
  await run(`${V} autocomplete`, async () => {
    await p.evaluate(() => import('/lib/offline-search.js').then((m) => m.loadSearchIndex()).catch(() => {}));
    await p.click('#q'); await p.type('#q', 'simhachalam', { delay: 15 });
    await p.waitForFunction(() => document.querySelectorAll('#suggest li').length >= 1, null, { timeout: 10000 });
    await p.waitForTimeout(800); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200);
    await shot(p, `${V}-02-autocomplete`);
    await p.keyboard.press('Escape'); await p.fill('#q', '');
  });
  await run(`${V} no match`, async () => {
    // Geocoders answer "nothing" for this nonsense query (the default fixtures return Kailasagiri for anything).
    const empty = (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: /photon/.test(r.request().url()) ? '{"type":"FeatureCollection","features":[]}' : '[]' });
    await ctx.route(/^https:\/\/(photon\.komoot\.io|nominatim\.openstreetmap\.org\/search)/, (r) => (/xqzvbk/i.test(r.request().url()) ? empty(r) : r.fallback()));
    await p.click('#q'); await p.type('#q', 'xqzvbk', { delay: 15 }); await p.waitForTimeout(2000);
    await shot(p, `${V}-03-autocomplete-nomatch`);
    await p.keyboard.press('Escape');
    await p.evaluate(() => window.__bm.ctx.search.submit('xqzvbk')); await p.waitForTimeout(2500);
    await shot(p, `${V}-04-search-nomatch`);
  });
  await run(`${V} category list`, async () => {
    await p.evaluate(() => window.__bm.ctx.views.show('home', { detent: 'half' }));
    await p.evaluate(() => window.__bm.ctx.map.jumpTo({ center: [83.305, 17.7289], zoom: 14 }));
    await p.click('#cats [data-cat=fuel]');
    await p.waitForFunction(() => document.querySelectorAll('#poiList [data-poi]').length >= 5, null, { timeout: 15000 });
    await p.waitForTimeout(1200); await shot(p, `${V}-05-category-results`);
  });
  await run(`${V} place card`, async () => {
    await p.click('#poiList [data-poi="0"]'); await p.waitForSelector('#pcDir');
    await p.waitForTimeout(1500); await shot(p, `${V}-06-place-card`);
  });
  await run(`${V} rich place`, async () => {
    await p.evaluate((r) => window.__bm.ctx.place.open(r), RICH); await p.waitForSelector('#pcDir');
    await p.waitForTimeout(1500); await shot(p, `${V}-07-place-rich`);
    if (V === 'mobile') { await p.evaluate(() => window.__bm.ctx.sheet.set('full')); await p.waitForTimeout(600); await shot(p, `${V}-07b-place-rich-full`); }
  });
  await run(`${V} directions`, async () => {
    await p.evaluate(() => window.__bm.ctx.directions.open({ lat: 17.7142, lng: 83.3239, name: 'RK Beach' }, { mode: 'drive', from: { lat: 17.7289, lng: 83.305, name: 'Dwaraka Nagar' } }));
    await p.waitForSelector('#dirStart', { timeout: 20000 }); await p.waitForTimeout(2000);
    await shot(p, `${V}-08-directions`);
  });
  await run(`${V} transit unavailable`, async () => {
    await p.evaluate(() => window.__bm.ctx.directions.open({ lat: 17.7142, lng: 83.3239, name: 'RK Beach' }, { mode: 'transit', from: { lat: 17.7289, lng: 83.305, name: 'Dwaraka Nagar' } }));
    await p.waitForFunction(() => /timetables aren/.test(document.querySelector('#dirRoutes')?.textContent || ''), null, { timeout: 20000 });
    await p.waitForTimeout(1200); await shot(p, `${V}-09-transit-unavailable`);
  });
  await run(`${V} all categories`, async () => {
    await p.evaluate(() => window.__bm.ctx.views.show('home', { detent: 'half' }));
    if (!(await p.$('#allCatsBtn'))) return;
    await p.click('#allCatsBtn'); await p.waitForTimeout(800); await shot(p, `${V}-10-all-categories`);
  });
  await ctx.close();
  // dark
  const d = await page(vp, { dark: true });
  await run(`${V} dark home`, async () => { await shot(d.p, `${V}-11-dark-home`); });
  await run(`${V} dark place`, async () => {
    await d.p.evaluate((r) => window.__bm.ctx.place.open(r), RICH); await d.p.waitForSelector('#pcDir'); await d.p.waitForTimeout(1500); await shot(d.p, `${V}-12-dark-place`);
  });
  await run(`${V} dark directions`, async () => {
    await d.p.evaluate(() => window.__bm.ctx.directions.open({ lat: 17.7142, lng: 83.3239, name: 'RK Beach' }, { mode: 'drive', from: { lat: 17.7289, lng: 83.305, name: 'Dwaraka Nagar' } }));
    await d.p.waitForSelector('#dirStart', { timeout: 20000 }); await d.p.waitForTimeout(2000); await shot(d.p, `${V}-13-dark-directions`);
  });
  await d.ctx.close();
  // map failure: online tiles and the bundled offline map both unreachable
  await run(`${V} map failure`, async () => {
    const ctx2 = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.isMobile, serviceWorkers: 'block' });
    await installNetworkFixtures(ctx2, { log: [], fail: { tiles: true } });
    await ctx2.route(/\/offline\/.*\.(pmtiles|json)$/, (r) => r.abort('internetdisconnected'));
    const p2 = await ctx2.newPage(); await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
    await p2.waitForFunction(() => document.getElementById('mapFail') && !document.getElementById('mapFail').hidden, null, { timeout: 40000 }).catch(() => {});
    await p2.waitForTimeout(1000); await shot(p2, `${V}-14-map-failure`);
    await ctx2.close();
  });
}
await browser.close();
