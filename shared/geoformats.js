// GPX 1.1 and KML 2.2 import / export for saved lists and recorded tracks (v0.8, CoMaps-inspired; original code).
// Pure and dependency-free (unit-tested in Node and used in the browser). Both are open formats:
//   GPX 1.1  https://www.topografix.com/GPX/1/1/        KML 2.2  OGC 07-147r2 (https://www.ogc.org/standard/kml/)
// Safety: a tiny non-validating XML reader is used instead of DOMParser so the same code runs in Node. It never expands
// DTDs or external entities (a <!DOCTYPE> or <!ENTITY> is rejected outright), only the five XML entities and numeric
// character references are decoded, and input size / element counts are capped.

export const GEO_LIMITS = { maxBytes: 8 * 1024 * 1024, maxWaypoints: 2000, maxTracks: 50, maxTrackPoints: 100000, maxElements: 400000 };
export const GEO_MIME = { gpx: 'application/gpx+xml', kml: 'application/vnd.google-earth.kml+xml' };

const XML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
/** Escape text for XML content/attributes and drop characters XML 1.0 forbids. */
export function escXml(s) {
  // eslint-disable-next-line no-control-regex
  return String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '').replace(/[&<>"']/g, (c) => XML_ESC[c]);
}
const okLat = (x) => Number.isFinite(x) && Math.abs(x) <= 90;
const okLng = (x) => Number.isFinite(x) && Math.abs(x) <= 180;
const coord = (x) => (+x).toFixed(6).replace(/\.?0+$/, '');
const isoTime = (t) => { const d = new Date(t); return Number.isFinite(d.getTime()) ? d.toISOString() : null; };

// ---------------------------------------------------------------- export
/**
 * GPX 1.1 document.
 * doc = { name?, desc?, time?, waypoints: [{ name, lat, lng, desc?, note?, category?, time? }], tracks: [{ name, desc?, segments?: [[pt]] | points: [pt] }] }
 * pt = { lat, lng, ele?, time? (ms or ISO) }
 */
export function toGPX(doc = {}, { creator = 'Bharat Map' } = {}) {
  const out = ['<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="${escXml(creator)}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`];
  const meta = [];
  if (doc.name) meta.push(`<name>${escXml(doc.name)}</name>`);
  if (doc.desc) meta.push(`<desc>${escXml(doc.desc)}</desc>`);
  const mt = doc.time != null ? isoTime(doc.time) : null; if (mt) meta.push(`<time>${mt}</time>`);
  if (meta.length) out.push(`  <metadata>${meta.join('')}</metadata>`);
  for (const w of doc.waypoints || []) {
    if (!okLat(w.lat) || !okLng(w.lng)) continue;
    const parts = [];
    const t = w.time != null ? isoTime(w.time) : null; if (t) parts.push(`<time>${t}</time>`);
    if (w.name) parts.push(`<name>${escXml(w.name)}</name>`);
    const desc = [w.desc, w.note].filter(Boolean).join('\n');
    if (desc) parts.push(`<desc>${escXml(desc)}</desc>`);
    if (w.category) parts.push(`<type>${escXml(w.category)}</type>`);
    out.push(`  <wpt lat="${coord(w.lat)}" lon="${coord(w.lng)}">${parts.join('')}</wpt>`);
  }
  for (const tr of doc.tracks || []) {
    const segs = (tr.segments || [tr.points || []]).map((s) => s.filter((p) => okLat(p.lat) && okLng(p.lng))).filter((s) => s.length);
    if (!segs.length) continue;
    out.push(`  <trk>${tr.name ? `<name>${escXml(tr.name)}</name>` : ''}${tr.desc ? `<desc>${escXml(tr.desc)}</desc>` : ''}`);
    for (const s of segs) {
      out.push('    <trkseg>');
      for (const p of s) {
        const t = p.time != null ? isoTime(p.time) : null;
        out.push(`      <trkpt lat="${coord(p.lat)}" lon="${coord(p.lng)}">${Number.isFinite(p.ele) ? `<ele>${(+p.ele).toFixed(1)}</ele>` : ''}${t ? `<time>${t}</time>` : ''}</trkpt>`);
      }
      out.push('    </trkseg>');
    }
    out.push('  </trk>');
  }
  out.push('</gpx>');
  return `${out.join('\n')}\n`;
}

/** KML 2.2 document: waypoints → Point placemarks, tracks → LineString placemarks (one per segment, 3-D when elevations exist). */
export function toKML(doc = {}) {
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<kml xmlns="http://www.opengis.net/kml/2.2">', '<Document>'];
  if (doc.name) out.push(`  <name>${escXml(doc.name)}</name>`);
  if (doc.desc) out.push(`  <description>${escXml(doc.desc)}</description>`);
  for (const w of doc.waypoints || []) {
    if (!okLat(w.lat) || !okLng(w.lng)) continue;
    const desc = [w.desc, w.note].filter(Boolean).join('\n');
    const t = w.time != null ? isoTime(w.time) : null;
    out.push(`  <Placemark>${w.name ? `<name>${escXml(w.name)}</name>` : ''}${desc ? `<description>${escXml(desc)}</description>` : ''}${t ? `<TimeStamp><when>${t}</when></TimeStamp>` : ''}${w.category ? `<ExtendedData><Data name="category"><value>${escXml(w.category)}</value></Data></ExtendedData>` : ''}<Point><coordinates>${coord(w.lng)},${coord(w.lat)}</coordinates></Point></Placemark>`);
  }
  for (const tr of doc.tracks || []) {
    const segs = (tr.segments || [tr.points || []]).map((s) => s.filter((p) => okLat(p.lat) && okLng(p.lng))).filter((s) => s.length >= 2);
    segs.forEach((s, i) => {
      const has3d = s.every((p) => Number.isFinite(p.ele));
      const cs = s.map((p) => `${coord(p.lng)},${coord(p.lat)}${has3d ? `,${(+p.ele).toFixed(1)}` : ''}`).join(' ');
      const nm = tr.name ? `${tr.name}${segs.length > 1 ? ` (${i + 1})` : ''}` : '';
      out.push(`  <Placemark>${nm ? `<name>${escXml(nm)}</name>` : ''}${tr.desc ? `<description>${escXml(tr.desc)}</description>` : ''}<LineString><tessellate>1</tessellate>${has3d ? '<altitudeMode>absolute</altitudeMode>' : ''}<coordinates>${cs}</coordinates></LineString></Placemark>`);
    });
  }
  out.push('</Document>', '</kml>');
  return `${out.join('\n')}\n`;
}

// ---------------------------------------------------------------- tiny XML reader
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
    return ENT[e] ?? m; // unknown named entity: left as text, never expanded
  });
}
const local = (name) => name.slice(name.indexOf(':') + 1).toLowerCase();

/** Parse XML into { name (local, lower-case), attrs, children, text }. Throws Error('bad_xml' | 'dtd_not_allowed' | 'too_large'). */
export function parseXml(text, { maxElements = GEO_LIMITS.maxElements } = {}) {
  const s = String(text);
  if (/<!DOCTYPE|<!ENTITY/i.test(s)) throw new Error('dtd_not_allowed');
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  let i = 0, count = 0;
  const re = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g;
  let m;
  while ((m = re.exec(s))) {
    const top = stack[stack.length - 1];
    if (m.index > i) { const seg = s.slice(i, m.index); if (seg.includes('<')) throw new Error('bad_xml'); top.text += decodeEntities(seg); }
    i = re.lastIndex;
    if (m[5] !== undefined) { top.text += m[5]; continue; }
    if (!m[2]) continue; // comment / processing instruction
    const name = local(m[2]);
    if (m[1]) { // closing tag
      if (stack.length < 2 || top.name !== name) throw new Error('bad_xml');
      stack.pop(); continue;
    }
    if (++count > maxElements) throw new Error('too_large');
    const attrs = {};
    for (const a of m[3].matchAll(/([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[local(a[1])] = decodeEntities(a[2] ?? a[3] ?? '');
    const el = { name, attrs, children: [], text: '' };
    top.children.push(el);
    if (!m[4]) stack.push(el);
  }
  if (stack.length !== 1) throw new Error('bad_xml');
  const rest = s.slice(i);
  if (/</.test(rest)) throw new Error('bad_xml'); // a stray / unterminated tag
  return root;
}
const kids = (el, name) => el.children.filter((c) => c.name === name);
const kid = (el, name) => el.children.find((c) => c.name === name);
const txt = (el, name) => { const c = kid(el, name); return c ? c.text.trim() : ''; };
function* walk(el) { for (const c of el.children) { yield c; yield* walk(c); } }

// ---------------------------------------------------------------- import
/** Detect the format from the file name and/or the root element. */
export function detectFormat(text, filename = '') {
  const ext = String(filename).toLowerCase().match(/\.(gpx|kml|kmz)$/)?.[1];
  if (ext === 'kmz') return 'kmz';
  const head = String(text).slice(0, 2048);
  if (/<gpx[\s>]/i.test(head)) return 'gpx';
  if (/<kml[\s>]/i.test(head)) return 'kml';
  return ext || null;
}

/**
 * Parse a GPX or KML file. Returns { format, name, waypoints:[{name,lat,lng,desc?,time?}], tracks:[{name, segments:[[{lat,lng,ele?,time?}]]}], warnings:[] }.
 * Throws Error('unsupported_format' | 'kmz_not_supported' | 'too_large' | 'bad_xml' | 'dtd_not_allowed' | 'empty').
 */
export function parseGeoFile(text, filename = '', limits = GEO_LIMITS) {
  const fmt = detectFormat(text, filename);
  if (fmt === 'kmz') throw new Error('kmz_not_supported');
  if (fmt !== 'gpx' && fmt !== 'kml') throw new Error('unsupported_format');
  if (String(text).length > limits.maxBytes) throw new Error('too_large');
  const root = parseXml(text, limits);
  const res = fmt === 'gpx' ? readGpx(root, limits) : readKml(root, limits);
  if (!res.waypoints.length && !res.tracks.length) throw new Error('empty');
  return { format: fmt, ...res };
}

function cap(arr, n, warnings, what) { if (arr.length > n) { warnings.push(`${what}_truncated`); arr.length = n; } return arr; }
function point(lat, lng, extra = {}) { const a = +lat, b = +lng; return okLat(a) && okLng(b) && !(a === 0 && b === 0) ? { lat: a, lng: b, ...extra } : null; }

function readGpx(root, L) {
  const gpx = kid(root, 'gpx'); if (!gpx) throw new Error('unsupported_format');
  const warnings = [];
  let dropped = 0;
  const meta = kid(gpx, 'metadata');
  const name = (meta && txt(meta, 'name')) || txt(gpx, 'name') || '';
  const waypoints = [];
  // <wpt> plus route points (<rte><rtept>) become waypoints; route order is kept.
  for (const w of [...kids(gpx, 'wpt'), ...kids(gpx, 'rte').flatMap((r) => kids(r, 'rtept'))]) {
    const p = point(w.attrs.lat, w.attrs.lon); if (!p) { dropped++; continue; }
    const desc = txt(w, 'desc') || txt(w, 'cmt');
    const t = txt(w, 'time'); const ms = t ? Date.parse(t) : NaN;
    waypoints.push({ ...p, name: txt(w, 'name').slice(0, 120), ...(desc ? { desc: desc.slice(0, 500) } : {}), ...(Number.isFinite(ms) ? { time: ms } : {}) });
  }
  cap(waypoints, L.maxWaypoints, warnings, 'waypoints');
  const tracks = []; let total = 0;
  for (const t of kids(gpx, 'trk')) {
    const segments = [];
    for (const sg of kids(t, 'trkseg')) {
      const pts = [];
      for (const tp of kids(sg, 'trkpt')) {
        if (total >= L.maxTrackPoints) { if (!warnings.includes('trackpoints_truncated')) warnings.push('trackpoints_truncated'); break; }
        const ele = parseFloat(txt(tp, 'ele')); const tm = Date.parse(txt(tp, 'time'));
        const p = point(tp.attrs.lat, tp.attrs.lon, { ...(Number.isFinite(ele) ? { ele } : {}), ...(Number.isFinite(tm) ? { time: tm } : {}) });
        if (p) { pts.push(p); total++; } else dropped++;
      }
      if (pts.length) segments.push(pts);
    }
    if (segments.length) tracks.push({ name: txt(t, 'name').slice(0, 120), segments });
  }
  cap(tracks, L.maxTracks, warnings, 'tracks');
  if (dropped) warnings.push(`invalid_points:${dropped}`);
  return { name: name.slice(0, 120), waypoints, tracks, warnings };
}

function parseCoords(s) {
  return String(s).trim().split(/\s+/).filter(Boolean).map((t) => {
    const [lng, lat, ele] = t.split(',').map(Number);
    return point(lat, lng, Number.isFinite(ele) && t.split(',').length > 2 ? { ele } : {});
  });
}
function readKml(root, L) {
  const kml = kid(root, 'kml'); if (!kml) throw new Error('unsupported_format');
  const warnings = []; let dropped = 0;
  const docEl = [...walk(kml)].find((e) => e.name === 'document' || e.name === 'folder');
  const name = docEl ? txt(docEl, 'name') : '';
  const waypoints = [], tracks = []; let total = 0;
  for (const pm of walk(kml)) {
    if (pm.name !== 'placemark') continue;
    const nm = txt(pm, 'name').slice(0, 120); const desc = txt(pm, 'description').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const when = (() => { const ts = kid(pm, 'timestamp'); const ms = ts ? Date.parse(txt(ts, 'when')) : NaN; return Number.isFinite(ms) ? ms : null; })();
    const geoms = [pm, ...walk(pm)];
    for (const g of geoms) {
      if (g.name === 'point') {
        const [p] = parseCoords(txt(g, 'coordinates'));
        if (p) waypoints.push({ lat: p.lat, lng: p.lng, name: nm, ...(desc ? { desc: desc.slice(0, 500) } : {}), ...(when != null ? { time: when } : {}) }); else dropped++;
      } else if (g.name === 'linestring') {
        const raw = parseCoords(txt(g, 'coordinates')); const pts = raw.filter(Boolean); dropped += raw.length - pts.length;
        const room = Math.max(0, L.maxTrackPoints - total);
        if (pts.length > room && !warnings.includes('trackpoints_truncated')) warnings.push('trackpoints_truncated');
        const keep = pts.slice(0, room); total += keep.length;
        if (keep.length >= 2) tracks.push({ name: nm, segments: [keep] });
      } else if (g.name === 'track') { // gx:Track: <when> + <gx:coord>lng lat ele</gx:coord>
        const whens = kids(g, 'when').map((w) => Date.parse(w.text.trim()));
        const pts = kids(g, 'coord').map((c, k) => { const [lng, lat, ele] = c.text.trim().split(/\s+/).map(Number); return point(lat, lng, { ...(Number.isFinite(ele) ? { ele } : {}), ...(Number.isFinite(whens[k]) ? { time: whens[k] } : {}) }); }).filter(Boolean);
        const keep = pts.slice(0, Math.max(0, L.maxTrackPoints - total)); total += keep.length;
        if (keep.length >= 2) tracks.push({ name: nm, segments: [keep] });
      }
    }
  }
  cap(waypoints, L.maxWaypoints, warnings, 'waypoints');
  cap(tracks, L.maxTracks, warnings, 'tracks');
  if (dropped) warnings.push(`invalid_points:${dropped}`);
  return { name: name.slice(0, 120), waypoints, tracks, warnings };
}

// ---------------------------------------------------------------- saved-list bridges
/** A saved list ({ name, items:[Place] }) → a GPX/KML document of waypoints (Place.note carried in the description). */
export function listToDoc(list, { title } = {}) {
  return { name: title || list.name || 'Bharat Map list', waypoints: (list.items || []).map((p) => ({ name: p.name || '', lat: p.lat, lng: p.lng, desc: p.address || '', note: p.note || '', category: p.category || '' })) };
}
/** Parsed file → list items (cleanPlace-compatible). Waypoints keep their order; ids are stable per coordinate. */
export function docToListItems(doc) {
  return (doc.waypoints || []).map((w) => ({ id: `pin:${w.lat.toFixed(5)},${w.lng.toFixed(5)}`, name: w.name || '', lat: w.lat, lng: w.lng, ...(w.desc ? { note: w.desc } : {}) }));
}
/** Safe download file name: letters, digits, Indic letters, dash and underscore. */
export function safeFileName(name, ext) {
  const base = String(name || 'bharat-map').normalize('NFC').replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'bharat-map';
  return `${base}.${ext}`;
}
