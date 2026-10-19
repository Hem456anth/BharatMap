// Honesty labels for place-card service panels (docs/re/UI_UX_SPEC_V2.md §1, §6).
// Every value that is not a plain map fact carries exactly ONE label. The UI renders labels only from a PanelValue's
// `label` field (never hard-coded in components), and these helpers are the single place where labels are decided:
//   live         from a partner/operator feed fetched within its freshness window
//   scheduled    from a published timetable / opening hours, not a real-time feed
//   estimate     computed by Bharat (free-flow routing, distance models), no live input
//   linkout      the action leaves Bharat Map for a named external site/app; Bharat sees no price/result
//   unavailable  no source right now (no integration, nothing mapped, offline)
// Provenance qualifiers (panel footer, not labels): demo (fictional Shop data), community (user reports).
// Rules enforced here (unit-tested in tests/v07.test.js):
//   R1 never upgrade a label; a Live value past its window becomes Scheduled (if a timetable fallback exists) or Unavailable
//   R2 prices only when Live from a partner quote / seller catalogue — otherwise no amount at all
//   R3 a Demo value can never be Live (it is downgraded to Unavailable, or Scheduled/Estimate if it carries one)
//   R4 a fare is shown only with a Live partner quote ("no fare without a quote")

export const LABELS = ['live', 'scheduled', 'estimate', 'linkout', 'unavailable'];
export const PROVENANCE = ['demo', 'community', null];
/** Default freshness windows (seconds) per kind of live value (spec §1). */
export const FRESH_FOR = { vehicle: 120, departure: 120, stock: 900, availability: 900, charger: 300, quote: 300, traffic: 300, default: 120 };
/** Glyph + i18n key per label: colour is never the only signal (spec §1 rule 4). */
export const LABEL_META = {
  live: { glyph: '●', key: 'label_live', cls: 'hl-live' },
  scheduled: { glyph: '◷', key: 'label_scheduled', cls: 'hl-sched' },
  estimate: { glyph: '≈', key: 'label_estimate', cls: 'hl-est' },
  linkout: { glyph: '↗', key: 'label_linkout', cls: 'hl-link' },
  unavailable: { glyph: '–', key: 'label_unavailable', cls: 'hl-na' },
};

/** Build a PanelValue. `label` is required and validated. */
export function pv(value, label, { source = '', fetchedAt = null, freshForSec = null, provenance = null, kind = null, fallback = null, price = null, fare = null, note = '' } = {}) {
  if (!LABELS.includes(label)) throw new Error(`invalid_label:${label}`);
  if (!PROVENANCE.includes(provenance)) throw new Error(`invalid_provenance:${provenance}`);
  const v = { value, label, source, fetchedAt, freshForSec, provenance };
  if (kind) v.kind = kind;
  if (fallback) v.fallback = fallback; // { value, label: 'scheduled' } used when a live value goes stale
  if (price != null) v.price = price;
  if (fare != null) v.fare = fare;
  if (note) v.note = note;
  return v;
}

/**
 * The label a value may display at `now` (ms). Applies R1 (staleness downgrade) and R3 (Demo ≠ Live).
 * Returns { label, value, stale, reason } — the value may be replaced by its fallback or by null.
 */
export function effectiveLabel(v, now = Date.now()) {
  if (!v || !LABELS.includes(v.label)) return { label: 'unavailable', value: null, stale: false, reason: 'invalid' };
  let { label, value } = v;
  let stale = false, reason = '';
  if (label === 'live') {
    if (v.provenance === 'demo') return v.fallback && v.fallback.label !== 'live' ? { label: v.fallback.label, value: v.fallback.value, stale: false, reason: 'demo_never_live' } : { label: 'unavailable', value: null, stale: false, reason: 'demo_never_live' };
    const window = Number(v.freshForSec ?? FRESH_FOR[v.kind] ?? FRESH_FOR.default);
    const at = typeof v.fetchedAt === 'number' ? v.fetchedAt : Date.parse(v.fetchedAt || '');
    if (!Number.isFinite(at)) return v.fallback ? { label: v.fallback.label, value: v.fallback.value, stale: true, reason: 'no_timestamp' } : { label: 'unavailable', value: null, stale: true, reason: 'no_timestamp' };
    if (now - at > window * 1000) {
      stale = true; reason = 'stale';
      if (v.fallback && v.fallback.label === 'scheduled') ({ label, value } = v.fallback);
      else { label = 'unavailable'; value = null; }
    }
  }
  return { label, value, stale, reason };
}

/** R2/R4: a price or fare may be displayed only for a Live, non-demo, fresh value from a quote/catalogue. */
export function mayShowAmount(v, now = Date.now()) {
  if (!v || (v.price == null && v.fare == null)) return false;
  const e = effectiveLabel(v, now);
  return e.label === 'live' && !e.stale && v.provenance !== 'demo' && !!v.source;
}

/**
 * Validate a whole panel (unit test + server self-check). Returns a list of violations (empty = honest).
 * Checks: every row has exactly one valid label; Demo rows never Live; amounts only with mayShowAmount;
 * link-outs name a host; a Demo panel shows the Demo footer.
 */
export function panelViolations(panel, now = Date.now()) {
  const out = [];
  const rows = [...(panel.sections || []).flatMap((s) => s.rows || []), ...(panel.compact || [])];
  for (const r of rows) {
    if (r.fact) {
      if (r.label) out.push(`row ${r.id}: fact rows carry no label`);
      if (r.price != null || r.fare != null || (typeof r.value === 'string' && /₹\s?\d/.test(r.value))) out.push(`row ${r.id}: amount in a fact row`);
      continue;
    }
    if (!LABELS.includes(r.label)) out.push(`row ${r.id || r.value}: invalid label ${r.label}`);
    if (r.label === 'live' && (r.provenance === 'demo' || panel.provenance === 'demo')) out.push(`row ${r.id || r.value}: demo value labelled live`);
    if ((r.price != null || r.fare != null) && !mayShowAmount({ ...r, provenance: r.provenance || panel.provenance }, now)) out.push(`row ${r.id || r.value}: amount without a live quote`);
    if (typeof r.value === 'string' && /₹\s?\d/.test(r.value) && !mayShowAmount({ ...r, provenance: r.provenance || panel.provenance, price: r.price ?? r.fare ?? 0 }, now)) out.push(`row ${r.id || r.value}: rupee amount in text without a live quote`);
  }
  for (const a of panel.actions || []) {
    if (a.kind === 'linkout' && !a.host) out.push(`action ${a.id}: link-out without host`);
    if (a.label && !LABELS.includes(a.label)) out.push(`action ${a.id}: invalid label`);
  }
  if (panel.provenance === 'demo' && !panel.footer?.some((f) => f.provenance === 'demo')) out.push('demo panel without demo footer');
  return out;
}

/** Render-time decision for one row: the label to show and the value (after R1/R3). */
export function displayRow(r, now = Date.now()) {
  if (r.fact) return { ...r, label: null, stale: false, reason: '' };
  const e = effectiveLabel(r, now);
  const amountOk = r.price == null && r.fare == null ? true : mayShowAmount(r, now);
  return { ...r, label: e.label, value: amountOk ? e.value : null, stale: e.stale, reason: e.reason || (amountOk ? '' : 'amount_hidden') };
}
