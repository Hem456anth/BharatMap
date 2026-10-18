// /api/v1 community endpoints (v0.5): incident reports and live location sharing. Mounted by api-v1.js.
// Incidents are unverified community reports: they expire after 2 hours, carry a confidence from votes, and every
// response says so. Clients are identified only by a salted hash (IP + User-Agent) used for rate limits and one
// vote per incident; no IP address is stored.
import crypto from 'node:crypto';
import { validateIncident, INCIDENT_TTL_MS, confidence, minutesLeft } from '../shared/community.js';
import { inIndia } from '../shared/geo.js';

const SALT = process.env.COMMUNITY_SALT || crypto.randomBytes(16).toString('hex');
const clientHash = (req) => crypto.createHash('sha256').update(`${SALT}|${req.ip}|${req.get('user-agent') || ''}`).digest('hex').slice(0, 24);
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const LABEL = 'Community report, not verified';

export function mountCommunity(r, { db, now = () => Date.now() }) {
  const bad = (res, error, code = 400) => res.status(code).json({ error });
  const view = (i, t) => ({ id: i.id, type: i.type, lat: i.lat, lng: i.lng, note: i.note, created_ms: i.created_ms, expires_ms: i.expires_ms, up: i.up, down: i.down,
    confidence: confidence(i.up, i.down), minutes_left: minutesLeft(i, t), verified: false, label: LABEL });
  const purge = (t) => { db.prepare('DELETE FROM incidents WHERE expires_ms <= ?').run(t); db.prepare('DELETE FROM live_shares WHERE expires_ms <= ?').run(t); };

  r.get('/incidents', (req, res) => {
    const b = String(req.query.bbox || '').split(',').map(Number);
    if (b.length !== 4 || b.some((x) => !Number.isFinite(x)) || b[2] - b[0] > 2 || b[3] - b[1] > 2) return bad(res, 'invalid_bbox');
    const t = now(); purge(t);
    const rows = db.prepare('SELECT * FROM incidents WHERE lng BETWEEN ? AND ? AND lat BETWEEN ? AND ? AND expires_ms > ? ORDER BY created_ms DESC LIMIT 200').all(b[0], b[2], b[1], b[3], t);
    res.json({ label: LABEL, ttl_ms: INCIDENT_TTL_MS, incidents: rows.map((i) => view(i, t)) });
  });
  r.post('/incidents', (req, res) => {
    const v = validateIncident(req.body); if (v.error) return bad(res, v.error);
    if (!inIndia(v.value)) return bad(res, 'outside_india');
    const t = now(); const who = clientHash(req);
    const n = db.prepare('SELECT COUNT(*) c FROM incidents WHERE reporter = ? AND created_ms > ?').get(who, t - 3600_000).c;
    if (n >= 10) return bad(res, 'too_many_reports', 429);
    const id = `inc_${crypto.randomBytes(6).toString('hex')}`;
    db.prepare('INSERT INTO incidents(id,type,lat,lng,note,created_ms,expires_ms,reporter) VALUES (?,?,?,?,?,?,?,?)').run(id, v.value.type, v.value.lat, v.value.lng, v.value.note, t, t + INCIDENT_TTL_MS, who);
    res.status(201).json(view(db.prepare('SELECT * FROM incidents WHERE id = ?').get(id), t));
  });
  r.post('/incidents/:id/vote', (req, res) => {
    const vote = req.body?.vote === 'up' ? 1 : req.body?.vote === 'down' ? -1 : 0;
    if (!vote) return bad(res, 'invalid_vote');
    const t = now(); const i = db.prepare('SELECT * FROM incidents WHERE id = ? AND expires_ms > ?').get(String(req.params.id), t);
    if (!i) return bad(res, 'not_found', 404);
    const who = clientHash(req);
    if (who === i.reporter) return bad(res, 'own_report', 409);
    const prev = db.prepare('SELECT vote FROM incident_votes WHERE incident_id = ? AND voter = ?').get(i.id, who);
    if (prev) return bad(res, 'already_voted', 409);
    db.prepare('INSERT INTO incident_votes(incident_id,voter,vote) VALUES (?,?,?)').run(i.id, who, vote);
    // "Still there" extends the report by 30 minutes (capped at 2 h from now); "gone" twice removes it.
    if (vote > 0) db.prepare('UPDATE incidents SET up = up + 1, expires_ms = MIN(? , expires_ms + 1800000) WHERE id = ?').run(t + INCIDENT_TTL_MS, i.id);
    else db.prepare('UPDATE incidents SET down = down + 1, expires_ms = CASE WHEN down + 1 >= up + 2 THEN ? ELSE expires_ms END WHERE id = ?').run(t, i.id);
    const u = db.prepare('SELECT * FROM incidents WHERE id = ?').get(i.id);
    res.json(u.expires_ms <= t ? { id: i.id, removed: true } : view(u, t));
  });

  // ---- live location sharing: the sharer gets an id + secret; viewers poll GET /live/:id ----
  r.post('/live', (req, res) => {
    const t = now(); purge(t);
    const ttlMin = Math.max(5, Math.min(240, Number(req.body?.ttl_min) || 60));
    const id = crypto.randomBytes(9).toString('base64url'); const secret = crypto.randomBytes(18).toString('base64url');
    const name = String(req.body?.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
    db.prepare('INSERT INTO live_shares(id,secret_hash,name,created_ms,expires_ms) VALUES (?,?,?,?,?)').run(id, sha(secret), name, t, t + ttlMin * 60_000);
    res.status(201).json({ id, secret, expires_ms: t + ttlMin * 60_000 });
  });
  const own = (req) => { const s = db.prepare('SELECT * FROM live_shares WHERE id = ?').get(String(req.params.id)); return s && s.secret_hash === sha(req.body?.secret || '') ? s : null; };
  r.put('/live/:id', (req, res) => {
    const s = own(req); const t = now();
    if (!s || s.expires_ms <= t) return bad(res, 'not_found', 404);
    const lat = Number(req.body.lat), lng = Number(req.body.lng);
    if (!inIndia({ lat, lng })) return bad(res, 'invalid_point');
    const h = Number(req.body.heading);
    db.prepare('UPDATE live_shares SET lat = ?, lng = ?, heading = ?, updated_ms = ? WHERE id = ?').run(lat, lng, Number.isFinite(h) ? h : null, t, s.id);
    res.json({ ok: true, expires_ms: s.expires_ms });
  });
  r.delete('/live/:id', (req, res) => { const s = own(req); if (!s) return bad(res, 'not_found', 404); db.prepare('DELETE FROM live_shares WHERE id = ?').run(s.id); res.json({ ok: true }); });
  r.get('/live/:id', (req, res) => {
    const t = now(); const s = db.prepare('SELECT * FROM live_shares WHERE id = ?').get(String(req.params.id));
    if (!s || s.expires_ms <= t) return bad(res, 'not_found', 404);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, heading: s.heading, updated_ms: s.updated_ms, expires_ms: s.expires_ms, active: s.lat != null });
  });
}
