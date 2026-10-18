// Sunrise / sunset for a place and date — NOAA Solar Calculator algorithm (Jean Meeus, "Astronomical Algorithms"),
// as published by NOAA's Global Monitoring Laboratory (https://gml.noaa.gov/grad/solcalc/calcdetails.html).
// Pure (unit-tested); used to switch the navigation style between day and night. Accuracy ≈ 1 minute for India.
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

/** Julian day number at 00:00 UTC of the given UTC calendar date. */
export function julianDay(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function solarParams(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T) + Math.sin(rad(3 * M)) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));
  const y = Math.tan(rad(eps / 2)) ** 2;
  const eqTime = 4 * deg(y * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M)) + 4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) - 0.5 * y * y * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)));
  return { decl, eqTime };
}

/**
 * Sunrise and sunset (UTC Date objects) for lat/lng on the UTC calendar day containing `date`.
 * zenith 90.833° = geometric horizon + refraction + solar radius (official sunrise/sunset).
 * Returns { sunrise, sunset, solarNoon, polar: null | 'day' | 'night' }.
 */
export function sunTimes(date, lat, lng, { zenith = 90.833 } = {}) {
  const d = new Date(date);
  const jd0 = julianDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  const calc = (rise, guessMin) => {
    // Iterate once with the solar parameters at the event time for ~1 minute accuracy.
    let t = guessMin;
    for (let i = 0; i < 2; i++) {
      const { decl, eqTime } = solarParams(jd0 + t / 1440);
      const cosH = (Math.cos(rad(zenith)) / (Math.cos(rad(lat)) * Math.cos(rad(decl)))) - Math.tan(rad(lat)) * Math.tan(rad(decl));
      if (cosH > 1) return { polar: 'night' };
      if (cosH < -1) return { polar: 'day' };
      const H = deg(Math.acos(cosH));
      t = 720 - 4 * (lng + (rise ? H : -H)) - eqTime;
    }
    return { min: t };
  };
  const noonP = solarParams(jd0 + (720 - 4 * lng) / 1440);
  const noonMin = 720 - 4 * lng - noonP.eqTime;
  const r = calc(true, noonMin - 360), s = calc(false, noonMin + 360);
  const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const at = (m) => new Date(base + Math.round(m * 60000));
  if (r.polar || s.polar) return { sunrise: null, sunset: null, solarNoon: at(noonMin), polar: r.polar || s.polar };
  return { sunrise: at(r.min), sunset: at(s.min), solarNoon: at(noonMin), polar: null };
}

/** Is it daytime at lat/lng at instant `date`? (between sunrise and sunset of the local solar day) */
export function isDaytime(date, lat, lng) {
  const t = new Date(date).getTime();
  // Use the solar day centred on local noon: shift by longitude so evening UTC dates map to the right day.
  const local = new Date(t + (lng / 15) * 3600_000);
  const st = sunTimes(local, lat, lng);
  if (st.polar) return st.polar === 'day';
  return t >= st.sunrise.getTime() && t < st.sunset.getTime();
}

/** Navigation style decision: pref 'auto' | 'day' | 'night'. */
export function navStyleFor(pref, date, lat, lng) {
  if (pref === 'day' || pref === 'night') return pref;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'day';
  return isDaytime(date, lat, lng) ? 'day' : 'night';
}
