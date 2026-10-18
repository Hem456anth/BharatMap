// Verifies the standalone (serverless) demo build: in-browser backend, map-first shell, Shop flow
// (search → cart → order → tracking) and a category search. Build first:
//   LOCAL_VENDOR=1 OUT=web/demo-local.html node scripts/build-demo.mjs   (needs web/vendor/maplibre-gl-5.js)
import { chromium } from 'playwright-core';
import { installNetworkFixtures, SPEECH_STUB } from './e2e-net.mjs';
// Opened as a file:// page, exactly like a downloaded single-file demo (the API server's CSP header does not apply).
const URL_ = process.env.DEMO_URL || new URL('../web/demo-local.html', import.meta.url).href;
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await installNetworkFixtures(ctx, {}); await ctx.addInitScript(SPEECH_STUB);
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const out = [];
try {
  await p.goto(`${URL_}?q=${encodeURIComponent('LED TVs near me')}`);
  await p.waitForSelector('#results .card h3', { timeout: 25000 }); out.push('PASS demo: shell boots, Shop search renders');
  if (!(await p.textContent('#modeBadge')).includes('Demo mode')) throw new Error('not in demo mode'); out.push('PASS demo: in-browser backend active');
  await p.click('[data-add]:not([disabled])'); await p.click('#cartBtn'); await p.click('#placeBtn');
  await p.waitForSelector('#authDlg[open]'); await p.click('#authForm button.primary');
  await p.waitForFunction(() => !document.querySelector('#authDlg').open);
  await p.click('#cartBtn'); await p.click('#placeBtn');
  await p.waitForSelector('#tracking .card', { timeout: 15000 }); out.push('PASS demo: order placed');
  await p.waitForFunction(() => /Out for delivery|Delivered/.test(document.querySelector('#tracking').textContent), null, { timeout: 60000 }); out.push('PASS demo: tracking progresses');
  await p.screenshot({ path: 'docs/screenshots/v03-demo-tracking.png' });
  await p.evaluate(() => window.__bm.ctx.views.show('home'));
  await p.click('#cats [data-cat=fuel]');
  await p.waitForFunction(() => document.querySelectorAll('#poiList [data-poi]').length >= 10, null, { timeout: 15000 }); out.push('PASS demo: category search (Overpass fixture)');
} catch (e) { out.push(`FAIL demo: ${e.message.split('\n')[0]}`); }
out.push(`${errs.length ? 'WARN' : 'PASS'} demo: page errors ${errs.length} ${errs.slice(0, 2).join(' | ')}`);
await b.close(); console.log(out.join('\n'));
import('node:fs').then((fs) => fs.writeFileSync('docs/e2e-demo-results.txt', `${out.join('\n')}\n`));
process.exitCode = out.some((l) => l.startsWith('FAIL')) ? 1 : 0;
