// Bundles the web client + in-browser backend into ONE self-contained HTML file
// (dist/india-mapos-demo.html) that runs with no server (static hosting / Page).
import { build } from 'esbuild';
import fs from 'node:fs';
// Standalone demo uses MapLibre 5.x UMD (classic script) because some static hosts reject ES modules.
const ML = '5.24.0';
const MLJS = process.env.LOCAL_VENDOR ? 'vendor/maplibre-gl-5.js' : `https://unpkg.com/maplibre-gl@${ML}/dist/maplibre-gl.js`;
const r = await build({ entryPoints: ['web/app.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020',
  plugins: [{ name: 'shared', setup(b) {
    b.onResolve({ filter: /^\.\/shared\// }, (a) => ({ path: new URL(`../shared/${a.path.slice(9)}`, import.meta.url).pathname }));
    // MapLibre v6 is ESM with a separate worker: keep it external (CDN, or ./vendor for local tests).
    // Hosts that forbid ES modules: MapLibre is loaded as a classic UMD <script> (window.maplibregl).
    b.onResolve({ filter: /^\.\/vendor\/maplibre-gl\.mjs$/ }, () => ({ path: 'maplibre-global', namespace: 'mlg' }));
    b.onLoad({ filter: /.*/, namespace: 'mlg' }, () => ({ contents: 'module.exports = window.maplibregl;', loader: 'js' }));
  } }] });
let html = fs.readFileSync('web/index.html', 'utf8');
const css = fs.readFileSync('web/styles.css', 'utf8');
const themeJs = fs.readFileSync('web/boot-theme.js', 'utf8');
const iconSvg = fs.readFileSync('web/icon.svg', 'utf8');
// The single-file demo inlines its scripts and loads MapLibre from a CDN, so the app shell's strict CSP
// <meta> (script-src 'self') is removed here; the real app (server or Android) keeps it.
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?\s*/, '')
  .replace('<script src="boot-theme.js"></script>', () => `<script>${themeJs}</script>`)
  .replace('href="icon.svg"', `href="data:image/svg+xml,${encodeURIComponent(iconSvg)}"`)
  .replace('<link rel="stylesheet" href="styles.css" />', `<style>${css}</style>`)
  .replace('<link rel="manifest" href="manifest.webmanifest" />', '').replace('<script src="config.js"></script>', '')
  .replace('<script type="module" src="app.js"></script>', () => `<script>window.__MAPOS_DEMO__=true</script><script src="${MLJS}"></script><script>${r.outputFiles[0].text.replace(/<\/script/g, '<\\/script')}</script>`);
// Standalone file loads MapLibre from a CDN (set LOCAL_VENDOR=1 to keep ./vendor paths for offline tests).
if (!process.env.LOCAL_VENDOR) html = html.replace('href="vendor/maplibre-gl.css"', `href="https://unpkg.com/maplibre-gl@${ML}/dist/maplibre-gl.css" crossorigin="anonymous"`)
fs.mkdirSync('dist', { recursive: true });
const out = process.env.OUT || 'dist/india-mapos-demo.html';
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0), 'KB');
