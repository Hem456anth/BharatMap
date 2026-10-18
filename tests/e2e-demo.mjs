// Note: uses dispatchEvent clicks because headless Chromium without network keeps the
// WebGL map busy (no tiles), which starves Playwright's rAF-based actionability checks.
// Verifies the standalone (serverless) demo build: in-browser backend, search, order, tracking.
import { chromium } from 'playwright-core';
const URL_ = process.env.DEMO_URL || 'http://localhost:8080/demo-local.html';
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const out = [];
try {
  await p.goto(URL_); await p.waitForSelector('.card h3', { timeout: 20000 }); await p.waitForTimeout(1500); out.push('PASS demo: search renders');
  if (!(await p.textContent('#modeBadge')).includes('Demo mode')) throw new Error('not in demo mode'); out.push('PASS demo: in-browser backend active');
  let stage = 'add';
  try {
    await p.locator('[data-add]:not([disabled])').first().dispatchEvent('click'); stage = 'cart'; await p.locator('#cartBtn').first().dispatchEvent('click'); stage = 'place'; await p.locator('#placeBtn').first().dispatchEvent('click');
    stage = 'auth'; await p.waitForSelector('#authDlg[open]'); await p.locator('#authForm button.primary').first().dispatchEvent('click');
    await p.waitForFunction(() => !document.querySelector('#authDlg').open);
    stage = 'cart2'; await p.locator('#cartBtn').first().dispatchEvent('click'); stage = 'place2'; await p.locator('#placeBtn').first().dispatchEvent('click');
  } catch (e) { throw new Error(`${stage}: ${e.message.split('\n')[0]} | toast=${await p.textContent('#toast')}`); }
  await p.waitForSelector('#tracking .card', { timeout: 15000 }); out.push('PASS demo: order placed');
  await p.waitForFunction(() => /Out for delivery|Delivered/.test(document.querySelector('#tracking').textContent), null, { timeout: 60000 }); out.push('PASS demo: tracking progresses');
  await p.screenshot({ path: 'docs/screenshots/mobile-demo-tracking.png' });
} catch (e) { out.push(`FAIL demo: ${e.message.split('\n')[0]}`); }
out.push(`${errs.length ? 'WARN' : 'PASS'} demo: page errors ${errs.length} ${errs.slice(0, 2).join(' | ')}`);
await b.close(); console.log(out.join('\n'));
