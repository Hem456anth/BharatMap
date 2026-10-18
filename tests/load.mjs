// Minimal load test (no deps): N concurrent clients hammering search + geocode.
// Run: BASE=http://localhost:8080 node tests/load.mjs
const BASE = process.env.BASE || 'http://localhost:8080';
const CONC = Number(process.env.CONC || 50), DURATION = Number(process.env.SECS || 15) * 1000;
const paths = ['/api/search?q=LED%20TVs%20near%20me&lat=17.7289&lng=83.3050', '/api/search?q=cheapest%2043%20inch%20tv%20under%2030k&lat=17.7289&lng=83.3050', '/api/geocode?q=opp%20CMR%20Central%20MVP%20Colony%20Vizag', '/api/search?q=biryani&lat=17.44&lng=78.49'];
const lat = []; let ok = 0, fail = 0; const end = Date.now() + DURATION;
async function worker(i) {
  while (Date.now() < end) {
    const t = performance.now();
    try { const r = await fetch(BASE + paths[(i + ok) % paths.length], { headers: { 'x-forwarded-for': `10.0.0.${i}` } }); await r.arrayBuffer(); r.ok ? ok++ : fail++; } catch { fail++; }
    lat.push(performance.now() - t);
  }
}
await Promise.all(Array.from({ length: CONC }, (_, i) => worker(i)));
lat.sort((a, b) => a - b);
const q = (p) => lat[Math.min(lat.length - 1, Math.floor(p * lat.length))].toFixed(1);
console.log(`concurrency=${CONC} duration=${DURATION / 1000}s requests=${ok + fail} ok=${ok} non2xx/err=${fail} rps=${(lat.length / (DURATION / 1000)).toFixed(0)} p50=${q(0.5)}ms p95=${q(0.95)}ms p99=${q(0.99)}ms`);
