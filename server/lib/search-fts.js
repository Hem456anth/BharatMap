// Server-side offline search over the v2 index with SQLite FTS5 (node:sqlite). FTS5 does the candidate retrieval
// (prefix queries on Latin, native-script and phonetic token columns); ranking is shared with the app
// (shared/search-index.js rankCandidates) so the server and the APK return the same order.
import fs from 'node:fs';
import { placeTokens, queryParts, rankCandidates, lookupDigipin, lookupPincode, PIN_RE } from '../../shared/search-index.js';

let sqlite = null;
async function loadSqlite() { if (sqlite === null) { try { sqlite = await import('node:sqlite'); } catch { sqlite = false; } } return sqlite; }
const sqliteSync = () => { try { return globalThis.process?.getBuiltinModule?.('node:sqlite') || null; } catch { return null; } };

/** Build data/search.db from an index object. Returns { rows }. Throws when FTS5 is unavailable. */
export function buildFtsDb(ix, file) {
  const mod = sqliteSync(); if (!mod) throw new Error('node:sqlite unavailable');
  const tmp = `${file}.${process.pid}.tmp`;
  for (const f of [tmp, `${tmp}-wal`, `${tmp}-shm`, `${tmp}-journal`]) fs.rmSync(f, { force: true });
  const db = new mod.DatabaseSync(tmp);
  db.exec("CREATE VIRTUAL TABLE places USING fts5(latin, native, phon, tokenize='unicode61 remove_diacritics 2')");
  const ins = db.prepare('INSERT INTO places(rowid, latin, native, phon) VALUES (?, ?, ?, ?)');
  db.exec('BEGIN');
  ix.places.forEach((row, id) => {
    const toks = [...placeTokens([row[0], row[6] || '', ...Object.values(row[5] || {})])];
    const pick = (c) => toks.filter((t) => t[0] === c).map((t) => t.slice(1)).join(' ');
    ins.run(id + 1, pick('l'), pick('n'), pick('p'));
  });
  db.exec('COMMIT');
  db.close();
  for (const f of [`${file}-wal`, `${file}-shm`, `${file}-journal`]) fs.rmSync(f, { force: true });
  fs.renameSync(tmp, file); // atomic swap: a running server keeps its open handle to the old file
  return { rows: ix.places.length };
}

const ftsWord = (w) => `"${w.replace(/"/g, '')}"`;
/** FTS5 MATCH expression: every word as a prefix in any column; whole-query phonetic as an alternative. */
export function ftsQuery(raw) {
  const { lws, nws, keys, qKey } = queryParts(raw);
  if (!lws.length) return null;
  const words = lws.map((w, i) => {
    const alts = [`latin:${ftsWord(w)}*`];
    if (nws[i]) alts.push(`native:${ftsWord(nws[i])}*`);
    if (keys[i]) alts.push(keys[i].length >= 3 ? `phon:${ftsWord(keys[i])}*` : `phon:${ftsWord(keys[i])}`);
    return `(${alts.join(' OR ')})`;
  });
  const all = words.join(' AND ');
  return qKey.length >= 4 ? `(${all}) OR phon:${ftsWord(qKey)}*` : all;
}

/** Create the server search service. Lazily builds the FTS db next to the JSON index when missing. */
export function createFtsSearch({ indexFile, dbFile }) {
  let ix = null; let db = null; let mode = null;
  async function init() {
    if (ix) return;
    ix = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    const mod = await loadSqlite();
    if (mod) {
      try {
        if (!fs.existsSync(dbFile) || fs.statSync(dbFile).mtimeMs < fs.statSync(indexFile).mtimeMs) buildFtsDb(ix, dbFile);
        db = new mod.DatabaseSync(dbFile, { readOnly: true }); mode = 'fts5';
      } catch { db = null; }
    }
    if (!db) mode = 'token-index';
  }
  return {
    get mode() { return mode; },
    async search(q, { near = null, limit = 10 } = {}) {
      await init();
      const raw = String(q || '').trim();
      if (raw.length < 2) return [];
      const dig = lookupDigipin(raw); if (dig) return [dig];
      if (PIN_RE.test(raw.replace(/\s+/g, ''))) { const p = lookupPincode(ix, raw); return p ? [p] : []; }
      if (!db) { const { searchOffline } = await import('../../shared/search-index.js'); return searchOffline(ix, raw, { near, limit }); }
      const m = ftsQuery(raw); if (!m) return [];
      const rows = db.prepare('SELECT rowid, bm25(places) AS r FROM places WHERE places MATCH ? ORDER BY r LIMIT 600').all(m);
      const cand = new Map(rows.map((x, i) => [Number(x.rowid) - 1, Math.max(1.5, 4 - i / 150)]));
      const out = []; const pinTok = raw.match(/(?:^|\s)([1-9]\d{5})(?:\s|$)/);
      if (pinTok) { const p = lookupPincode(ix, pinTok[1]); if (p) out.push(p); }
      return rankCandidates(ix, raw, cand, { near, limit, out });
    },
  };
}
