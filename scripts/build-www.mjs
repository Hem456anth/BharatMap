// Assembles the Android app's web bundle (www/): the same client as the server-hosted web app,
// with shared/ copied in (symlinks don't survive Gradle asset packaging), the bundled offline
// map regions, and a config.js carrying MAPOS_API_BASE (empty => on-device mode until set in Settings).
import fs from 'node:fs';
import { cspString } from '../shared/csp.js';
const out = 'www';
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync('web', out, { recursive: true, dereference: true, filter: (src) => !src.endsWith('sw.js') });
const api = (process.env.MAPOS_API_BASE || '').replace(/\/$/, '');
if (api && !/^https:\/\//.test(api)) throw new Error('MAPOS_API_BASE must be https://');
// The app shell's CSP must also allow the backend chosen at build time (MAPOS_API_BASE).
const html = fs.readFileSync(`${out}/index.html`, 'utf8');
const csp = cspString({ extraConnect: api ? [new URL(api).origin] : [] });
const patched = html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(")/, `$1${csp}$2`);
if (patched === html && api) throw new Error('CSP meta not found in index.html');
fs.writeFileSync(`${out}/index.html`, patched);
fs.writeFileSync(`${out}/config.js`, `window.__MAPOS_CONFIG__ = ${JSON.stringify({ apiBase: api, build: new Date().toISOString(), platform: 'android' })};\n`);
const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(`${d}/${e.name}`) : fs.statSync(`${d}/${e.name}`).size), 0);
console.log(`www/ built (${(size(out) / 1e6).toFixed(1)} MB), apiBase=${api || '(on-device mode)'}`);
