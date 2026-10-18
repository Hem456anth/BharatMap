// End-to-end UI test of the killer flow in real Chromium. Run: BASE=http://localhost:8080 node tests/e2e.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.env.SHOTS || 'docs/screenshots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const results = [];
const step = async (name, fn) => { const t = Date.now(); try { await fn(); results.push(`PASS ${name} (${Date.now() - t} ms)`); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); } };
for (const vp of [{ name: 'desktop', width: 1366, height: 820 }, { name: 'mobile', width: 390, height: 844, isMobile: true }]) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.isMobile, geolocation: { latitude: 17.7289, longitude: 83.305 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const url = vp.name === 'mobile' && process.env.DEMO_URL ? process.env.DEMO_URL : BASE;
  await step(`${vp.name}: loads and auto-searches "LED TVs near me"`, async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.card h3', { timeout: 20000 });
    const n = await page.$$eval('.card', (c) => c.length);
    if (n < 3) throw new Error(`only ${n} results`);
  });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/${vp.name}-1-search.png` });
  await step(`${vp.name}: price markers on map`, async () => { const n = await page.$$eval('.mk', (m) => m.length); if (n < 3) throw new Error(`markers ${n}`); });
  await step(`${vp.name}: Telugu UI + native query`, async () => {
    await page.selectOption('#lang', 'te');
    const ph = await page.getAttribute('#q', 'placeholder'); if (!ph.includes('వెతకండి')) throw new Error(ph);
    await page.fill('#q', 'టీవీ దగ్గర'); await page.press('#q', 'Enter');
    await page.waitForFunction(() => document.querySelectorAll('.card').length >= 3);
    await page.selectOption('#lang', 'en');
  });
  await step(`${vp.name}: add to cart → sign in → place order`, async () => {
    await page.fill('#q', 'LED TVs near me'); await page.press('#q', 'Enter');
    await page.waitForSelector('[data-add]:not([disabled])');
    await page.click('[data-add]:not([disabled])');
    await page.click('#cartBtn');
    await page.waitForSelector('#cartDlg[open]');
    await page.fill('#dropAddr', 'near RTC Complex, Dwaraka Nagar, Vizag'); await page.click('#dropLocate');
    await page.waitForFunction(() => /landmark/.test(document.querySelector('#dropInfo').textContent));
    await page.screenshot({ path: `${OUT}/${vp.name}-2-cart.png` });
    await page.click('#placeBtn');
    await page.waitForSelector('#authDlg[open]');
    await page.click('#authForm button.primary');
    await page.waitForFunction(() => !document.querySelector('#authDlg').open);
    await page.click('#cartBtn'); await page.waitForSelector('#cartDlg[open]'); await page.click('#placeBtn');
    await page.waitForSelector('#tracking .card', { timeout: 15000 });
  });
  await step(`${vp.name}: live tracking reaches "Out for delivery"/"Delivered"`, async () => {
    await page.waitForFunction(() => /Out for delivery|Delivered/.test(document.querySelector('#tracking').textContent), null, { timeout: 90000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${vp.name}-3-tracking.png` });
  });
  await step(`${vp.name}: assistant supplier discovery`, async () => {
    await page.click('[data-tab=assistant]');
    await page.fill('#chatIn', 'Find LED TV suppliers in Gajuwaka for bulk'); await page.press('#chatIn', 'Enter');
    await page.waitForFunction(() => /wholesale/.test(document.querySelector('#chat').textContent), null, { timeout: 15000 });
    await page.screenshot({ path: `${OUT}/${vp.name}-4-assistant.png` });
  });
  if (vp.name === 'desktop') {
    await step('desktop: seller dashboard edit', async () => {
      await page.click('#authBtn'); // sign out
      await page.click('[data-tab=seller]');
      await page.click('#demoSeller'); await page.waitForSelector('#authDlg[open]'); await page.fill('#pw', 'demo1234'); await page.click('#authForm button.primary');
      await page.waitForSelector('.kpis', { timeout: 10000 });
      await page.screenshot({ path: `${OUT}/desktop-5-seller.png` });
    });
    await step('desktop: mobility + address intelligence', async () => {
      await page.click('[data-tab=mobility]');
      await page.click('[data-kind=ev]'); await page.waitForSelector('#mobList .card');
      await page.fill('#geoIn', 'Shop 4, opp. CMR Central, MVP Colony, Vizag 530017'); await page.press('#geoIn', 'Enter');
      await page.waitForFunction(() => /DIGIPIN/.test(document.querySelector('#geoOut').textContent));
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/desktop-6-mobility.png` });
    });
    await step('desktop: 3D toggle', async () => { await page.click('#tdBtn'); await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/desktop-7-3d.png` }); await page.click('#tdBtn'); });
    await step('desktop: offline map renders bundled PMTiles (no network tiles)', async () => {
      let tileHits = 0; page.on('request', (r) => { if (/openfreemap|\/map\/ofm\//.test(r.url())) tileHits++; });
      await page.click('#offBtn');
      await page.waitForFunction(() => document.querySelector('#offBtn').getAttribute('aria-pressed') === 'true', null, { timeout: 20000 });
      await page.waitForFunction(() => /Offline map/.test(document.querySelector('#modeBadge').textContent));
      tileHits = 0; await page.waitForTimeout(4000);
      if (tileHits) throw new Error(`fetched ${tileHits} online tiles while offline map active`);
      await page.screenshot({ path: `${OUT}/desktop-8-offline-map.png` });
      await page.click('#offBtn'); await page.waitForTimeout(800);
    });
    await step('desktop: admin dashboard (KPIs, verify seller, hide product, users, CSV)', async () => {
      await page.click('#authBtn'); // sign out seller
      await page.click('#authBtn'); await page.waitForSelector('#authDlg[open]');
      await page.fill('#email', 'admin@mapos.demo'); await page.fill('#pw', 'demo1234'); await page.click('#authForm button.primary');
      await page.waitForSelector('#adminTab:not([hidden])');
      await page.waitForSelector('#adminBody .kpis', { timeout: 10000 });
      await page.screenshot({ path: `${OUT}/desktop-9-admin.png` });
      await page.click('[data-asec=businesses]'); await page.waitForSelector('[data-verify]');
      const before = await page.$$eval('[data-verify][data-v="1"]', (b) => b.length);
      if (before) { await page.click('[data-verify][data-v="1"]'); await page.waitForFunction((n) => document.querySelectorAll('[data-verify][data-v="1"]').length === n - 1, before); }
      await page.click('[data-asec=products]'); await page.waitForSelector('[data-pactive]');
      await page.click('[data-asec=users]'); await page.waitForSelector('[data-urole]');
      await page.click('[data-asec=audit]'); await page.waitForFunction(() => /business\.update/.test(document.querySelector('#adminBody').textContent) || !document.querySelector('[data-verify]'));
      await page.click('[data-asec=overview]'); await page.waitForSelector('[data-csv]');
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('[data-csv]')]);
      const path = await dl.path(); const head = fs.readFileSync(path, 'utf8').split('\n')[0];
      if (!head.startsWith('id,created_at')) throw new Error(head);
    });
    await step('desktop: notifications bell shows order updates', async () => {
      await page.click('#authBtn'); await page.click('#authBtn'); await page.waitForSelector('#authDlg[open]');
      await page.fill('#email', 'customer@mapos.demo'); await page.fill('#pw', 'demo1234'); await page.click('#authForm button.primary');
      await page.waitForSelector('#bellBtn:not([hidden])', { timeout: 10000 });
      await page.click('#bellBtn'); await page.waitForSelector('#notifDlg[open] .card');
      await page.screenshot({ path: `${OUT}/desktop-10-notifications.png` });
      await page.click('#notifDlg button');
    });
    await step('desktop: settings dialog validates backend URL', async () => {
      await page.click('#setBtn'); await page.waitForSelector('#setDlg[open]');
      await page.fill('#apiUrl', 'ftp://bad'); await page.click('#setForm button.primary');
      await page.waitForFunction(() => /https/.test(document.querySelector('#setInfo').textContent));
      await page.click('#setClose');
    });
  }
  const relevant = errors.filter((e) => !/WebGL|GPU|tiles|Failed to load resource/i.test(e));
  results.push(`${relevant.length ? 'WARN' : 'PASS'} ${vp.name}: console errors ${relevant.length}${relevant.length ? ' → ' + relevant.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
console.log(results.join('\n'));
fs.writeFileSync('docs/e2e-results.txt', results.join('\n') + '\n');
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
