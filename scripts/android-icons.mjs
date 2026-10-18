// Renders the launcher icons (legacy, round, adaptive foreground) from SVG with headless Chromium.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const R = 'android/app/src/main/res';
const icon = fs.readFileSync('web/icon.svg', 'utf8');
const round = icon.replace('rx="14"', 'rx="32"');
const fg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><path fill="#fff" d="M54 30c-10 0-18 8-18 18 0 13.5 18 31 18 31s18-17.5 18-31c0-10-8-18-18-18z"/><circle cx="54" cy="48" r="7" fill="#ffb400"/></svg>';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox'] });
const p = await b.newPage();
const shot = async (svg, size, out) => {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: out, omitBackground: true });
};
for (const [d, s, f] of [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]]) {
  await shot(icon, s, `${R}/mipmap-${d}/ic_launcher.png`);
  await shot(round, s, `${R}/mipmap-${d}/ic_launcher_round.png`);
  await shot(fg, f, `${R}/mipmap-${d}/ic_launcher_foreground.png`);
}
// Splash: brand pin centred on brand green
const splash = `<div style="width:100vw;height:100vh;background:#0f6e56;display:flex;align-items:center;justify-content:center">${fg.replace('<svg ', '<svg width="40%" ')}</div>`;
for (const dir of fs.readdirSync(R).filter((x) => x.startsWith('drawable'))) {
  const f = `${R}/${dir}/splash.png`; if (!fs.existsSync(f)) continue;
  const { width, height } = await (async () => { const buf = fs.readFileSync(f); return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }; })();
  await p.setViewportSize({ width, height }); await p.setContent(`<html><body style="margin:0">${splash}</body></html>`); await p.screenshot({ path: f });
}
await b.close();
console.log('icons + splash rendered');
