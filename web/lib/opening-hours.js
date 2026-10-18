// Minimal OSM opening_hours evaluator for the common, simple forms:
//   "24/7" · "09:00-21:00" · "Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off"
//   "Mo,We,Fr 10:00-13:00,16:00-20:00" · "Mo-Su 18:00-02:00" (past midnight)
// Anything else (PH, months, week numbers, sunrise, comments, "||", "+") returns
// status 'unknown' and the UI shows the raw string. Pure function — times are evaluated
// in Asia/Kolkata (all pilot places are in India) unless a Date-like {day, minutes} is given.

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

function parseDays(spec) {
  const set = new Set();
  for (const part of spec.split(',')) {
    const m = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/.exec(part.trim());
    if (!m) return null;
    const a = DAYS.indexOf(m[1]); const b = m[2] ? DAYS.indexOf(m[2]) : a;
    for (let i = a; ; i = (i + 1) % 7) { set.add(i); if (i === b) break; }
  }
  return set;
}
function parseTimes(spec) {
  const out = [];
  for (const part of spec.split(',')) {
    const m = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(part.trim());
    if (!m) return null;
    let s = toMin(m[1]); let e = toMin(m[2]);
    if (s > 24 * 60 || e > 48 * 60) return null;
    if (e <= s) e += 24 * 60; // runs past midnight
    out.push([s, e]);
  }
  return out;
}

/** Parse into rules [{days:Set, ranges:[[s,e]] | 'off'}] or null if unsupported. */
export function parseOpeningHours(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s === '24/7') return [{ days: new Set([0, 1, 2, 3, 4, 5, 6]), ranges: [[0, 24 * 60]] }];
  const rules = [];
  for (const chunk of s.split(';').map((x) => x.trim()).filter(Boolean)) {
    let m = /^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(.+)$/.exec(chunk);
    let days, rest;
    if (m) { days = parseDays(m[1]); rest = m[2].trim(); } else { days = new Set([0, 1, 2, 3, 4, 5, 6]); rest = chunk; }
    if (!days) return null;
    if (/^(off|closed)$/i.test(rest)) { rules.push({ days, ranges: 'off' }); continue; }
    const ranges = parseTimes(rest);
    if (!ranges) return null;
    rules.push({ days, ranges });
  }
  return rules.length ? rules : null;
}

/** Current IST weekday (0=Mo) and minutes since midnight. */
export function istNow(date = new Date()) {
  const ist = new Date(date.getTime() + (330 + date.getTimezoneOffset()) * 60_000);
  return { day: (ist.getDay() + 6) % 7, minutes: ist.getHours() * 60 + ist.getMinutes() };
}

const fmt = (min) => { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/**
 * Evaluate opening hours at `when` ({day, minutes} or Date).
 * Returns { status: 'open'|'closed'|'unknown', raw, until?, opensAt? }.
 * Later rules override earlier ones for the days they name (OSM semantics).
 */
export function openingStatus(raw, when = new Date()) {
  const rules = parseOpeningHours(raw);
  if (!rules) return { status: 'unknown', raw: raw || '' };
  const now = when instanceof Date ? istNow(when) : when;
  // Effective ranges for each weekday after overrides.
  const eff = Array.from({ length: 7 }, () => []);
  for (const r of rules) for (const d of r.days) eff[d] = r.ranges === 'off' ? [] : r.ranges;
  // Check today's ranges and yesterday's overnight spill.
  const y = (now.day + 6) % 7;
  for (const [s, e] of eff[now.day]) if (now.minutes >= s && now.minutes < e) return { status: 'open', raw, until: fmt(e) === '00:00' && e === 1440 && s === 0 ? null : fmt(e) };
  for (const [s, e] of eff[y]) if (e > 1440 && now.minutes < e - 1440) return { status: 'open', raw, until: fmt(e) };
  // Next opening within 7 days.
  for (let k = 0; k < 8; k++) {
    const d = (now.day + k) % 7;
    const next = eff[d].map(([s]) => s).filter((s) => k > 0 || s > now.minutes).sort((a, b) => a - b)[0];
    if (next != null) return { status: 'closed', raw, opensAt: fmt(next), opensDay: k === 0 ? 'today' : k === 1 ? 'tomorrow' : DAYS[d] };
  }
  return { status: 'closed', raw };
}
