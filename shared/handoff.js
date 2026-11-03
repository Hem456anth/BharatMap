// v0.7.20 (G9) precise pickup / drop hand-off (pure, unit-tested). Ride and delivery apps re-geocode a typed address
// and drivers end up at the wrong gate (Namma Yatri review, LinkedIn note — GAPS_RANKED.md G9). Bharat Map always
// hands over the exact pin (6 decimals ≈ 0.1 m), its DIGIPIN (India Post, ~4 m cell) and the nearest landmark:
//   • in the provider link where its DOCUMENTED format has fields for it (Uber universal link: pickup[latitude],
//     pickup[longitude], pickup[nickname], pickup[formatted_address]); Ola only with an affiliate token;
//   • otherwise (Rapido, Namma Yatri, Bharat Taxi, Yatri Sathi, Ola without token — no documented pickup parameter)
//     the same text is copied to the clipboard before the app opens, with a toast saying so.
import { encodeDigipin } from './geo.js';

const f6 = (x) => (Math.round(x * 1e6) / 1e6).toFixed(6);
/** Providers whose documented link carries the pickup point (G9). */
export const PREFILL_PROVIDERS = new Set(['uber']);

/** A point described for a driver: { lat6, lng6, digipin, landmark, name, osmUrl, geoUri, line }. */
export function describePoint(p, { landmark = null, name = '' } = {}) {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) throw new Error('invalid_point');
  const digipin = encodeDigipin(p.lat, p.lng);
  const lm = landmark?.name ? (landmark.distance_m != null && landmark.distance_m > 15 ? `${landmark.name} (${landmark.distance_m} m)` : landmark.name) : '';
  const lat6 = f6(p.lat), lng6 = f6(p.lng);
  return { lat6, lng6, digipin, landmark: lm, name: String(name || p.name || '').slice(0, 80),
    osmUrl: `https://www.openstreetmap.org/?mlat=${lat6}&mlon=${lng6}#map=19/${lat6}/${lng6}`, geoUri: `geo:${lat6},${lng6}`,
    line: [digipin ? `DIGIPIN ${digipin}` : '', lm ? `near ${lm}` : ''].filter(Boolean).join(' · ') };
}

/** WhatsApp-ready text for a driver / rider (English, numbers are script-neutral). */
export function pickupText({ pickup, dropoff = null, pickupLandmark = null, dropLandmark = null } = {}) {
  const a = describePoint(pickup, { landmark: pickupLandmark, name: pickup?.name });
  const lines = [`Pickup: ${a.name || 'my pin'}`, `${a.lat6}, ${a.lng6}`];
  if (a.digipin) lines.push(`DIGIPIN: ${a.digipin}`);
  if (a.landmark) lines.push(`Landmark: near ${a.landmark}`);
  lines.push(a.osmUrl);
  if (dropoff) {
    const b = describePoint(dropoff, { landmark: dropLandmark, name: dropoff.name });
    lines.push('', `Drop: ${b.name || 'pin'}`, `${b.lat6}, ${b.lng6}`);
    if (b.digipin) lines.push(`DIGIPIN: ${b.digipin}`);
    if (b.landmark) lines.push(`Landmark: near ${b.landmark}`);
    lines.push(b.osmUrl);
  }
  return lines.join('\n');
}

/**
 * Hand-off plan for one provider action: { mode: 'link' | 'clipboard', text } — 'link' when the documented link
 * already carries the exact pickup (still offers the text), 'clipboard' otherwise.
 */
export function handoffPlan(provider, { pickup, dropoff, pickupLandmark, dropLandmark, olaToken = false } = {}) {
  if (!pickup || !Number.isFinite(pickup.lat)) return null;
  const text = pickupText({ pickup, dropoff, pickupLandmark, dropLandmark });
  const inLink = PREFILL_PROVIDERS.has(provider) || (provider === 'ola' && olaToken);
  return { mode: inLink ? 'link' : 'clipboard', text, digipin: encodeDigipin(pickup.lat, pickup.lng) };
}
