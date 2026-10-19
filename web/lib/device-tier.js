// Device tiers (pure, unit-tested): pick low / mid / high from what the browser/WebView reports, with a manual
// override in Settings. Signals: navigator.deviceMemory (GB, Chromium/Android WebView; bucketed 0.25…8),
// navigator.hardwareConcurrency (CPU threads), navigator.connection.effectiveType / saveData.
//   low  → no 3D buildings or terrain, fewer labels, no tile/route prefetch, low-bandwidth mode on
//   mid  → 3D allowed, slightly thinner labels, route prefetch on unmetered/4G only (bandwidth policy decides)
//   high → everything on
// Unknown signals never push a device down on their own (desktop Firefox/Safari report no deviceMemory).

export const TIERS = ['low', 'mid', 'high'];

/** Read the signals safely (works in Node tests with a fake navigator). */
export function readDeviceSignals(nav = globalThis.navigator) {
  const c = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
  const num = (v) => (Number.isFinite(v) && v > 0 ? v : null);
  return { memoryGb: num(nav?.deviceMemory), cores: num(nav?.hardwareConcurrency), effectiveType: c?.effectiveType || '', saveData: !!c?.saveData };
}

/**
 * Detect the tier. Returns { tier, reasons[] }.
 *  low  if memory ≤ 2 GB, or cores ≤ 2, or (memory ≤ 3 GB and cores ≤ 4), or a 2G connection, or Save-Data with ≤ 4 GB
 *  high if memory ≥ 6 GB and cores ≥ 6 (or memory unknown and cores ≥ 8) and the connection is not slow
 *  mid  otherwise
 */
export function detectTier({ memoryGb = null, cores = null, effectiveType = '', saveData = false } = {}) {
  const reasons = [];
  if (memoryGb != null && memoryGb <= 2) reasons.push(`memory ${memoryGb} GB`);
  if (cores != null && cores <= 2) reasons.push(`${cores} CPU cores`);
  if (memoryGb != null && cores != null && memoryGb <= 3 && cores <= 4 && memoryGb > 2 && cores > 2) reasons.push(`memory ${memoryGb} GB + ${cores} cores`);
  if (/^(slow-2g|2g)$/.test(effectiveType)) reasons.push(`${effectiveType} network`);
  if (saveData && (memoryGb == null || memoryGb <= 4)) reasons.push('Save-Data');
  if (reasons.length) return { tier: 'low', reasons };
  const slow = effectiveType === '3g';
  if (!slow && ((memoryGb != null && memoryGb >= 6 && (cores == null || cores >= 6)) || (memoryGb == null && cores != null && cores >= 8))) return { tier: 'high', reasons: [memoryGb != null ? `memory ${memoryGb} GB` : `${cores} CPU cores`] };
  return { tier: 'mid', reasons: [slow ? '3g network' : memoryGb == null && cores == null ? 'no device signals' : `memory ${memoryGb ?? '?'} GB, ${cores ?? '?'} cores`] };
}

/** What each tier allows. labelDensity scales symbol spacing/visibility (1 = full). */
export function tierPolicy(tier) {
  switch (tier) {
    case 'low': return { tier, allow3D: false, allowTerrain: false, labelDensity: 0.5, prefetch: false, forceLowBandwidth: true, maxPitch: 0, fadeDuration: 0 };
    case 'mid': return { tier, allow3D: true, allowTerrain: false, labelDensity: 0.8, prefetch: true, forceLowBandwidth: false, maxPitch: 60, fadeDuration: 150 };
    default: return { tier: 'high', allow3D: true, allowTerrain: true, labelDensity: 1, prefetch: true, forceLowBandwidth: false, maxPitch: 70, fadeDuration: 300 };
  }
}

/** Resolve the effective tier: manual override ('low'|'mid'|'high') wins over 'auto'. */
export function resolveTier(signals, manual = 'auto') {
  const detected = detectTier(signals);
  const tier = TIERS.includes(manual) ? manual : detected.tier;
  return { ...tierPolicy(tier), detected: detected.tier, reasons: detected.reasons, manual: TIERS.includes(manual) ? manual : 'auto' };
}

/** Bandwidth manual setting implied by the tier: low tier turns low-bandwidth mode on unless the user turned it off. */
export function bandwidthManualFor(policy, bwManual = 'auto') {
  if (bwManual === 'off' || bwManual === 'on') return bwManual;
  return policy.forceLowBandwidth ? 'on' : 'auto';
}

/** Minimum zoom shift for label layers at a given density (0.5 → labels appear ~1 zoom later). */
export function labelMinzoomShift(labelDensity) { return labelDensity >= 1 ? 0 : labelDensity >= 0.8 ? 0.5 : 1; }
