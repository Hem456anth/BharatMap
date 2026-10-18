// Navigation sounds, synthesised in code with WebAudio (no audio files): reroute, arrival, overspeed, GPS lost /
// regained and "approaching maneuver". Each cue is a short sequence of soft sine/triangle notes with a gentle
// envelope. Respects the navigation mute toggle. SOUND_CUES is pure data (unit-tested).

/** Cue → notes [frequency Hz, start s, duration s, type]. Designed for Bharat Map; quiet, short (< 0.7 s). */
export const SOUND_CUES = {
  approach: [[880, 0, 0.09, 'sine'], [1175, 0.11, 0.12, 'sine']],
  reroute: [[660, 0, 0.12, 'triangle'], [550, 0.14, 0.12, 'triangle'], [660, 0.28, 0.16, 'triangle']],
  arrival: [[523, 0, 0.16, 'sine'], [659, 0.16, 0.16, 'sine'], [784, 0.32, 0.3, 'sine']],
  overspeed: [[988, 0, 0.1, 'sine'], [988, 0.18, 0.1, 'sine']],
  gps_lost: [[440, 0, 0.18, 'triangle'], [330, 0.2, 0.26, 'triangle']],
  gps_back: [[330, 0, 0.14, 'triangle'], [494, 0.16, 0.2, 'triangle']],
};
export function cueDuration(name) { const c = SOUND_CUES[name]; return c ? Math.max(...c.map(([, s, d]) => s + d)) : 0; }

export function createSounds({ isMuted = () => false } = {}) {
  let ac = null;
  const log = []; // for tests / debugging: names of cues played
  function context() {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    if (!ac) { try { ac = new AC(); } catch { return null; } }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  function play(name, { volume = 0.18 } = {}) {
    if (isMuted() || !SOUND_CUES[name]) return false;
    log.push(name); log.splice(0, log.length - 30);
    const a = context(); if (!a) return true;
    const t0 = a.currentTime + 0.02;
    for (const [f, s, d, type] of SOUND_CUES[name]) {
      const o = a.createOscillator(); const g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0 + s);
      g.gain.setValueAtTime(0.0001, t0 + s);
      g.gain.exponentialRampToValueAtTime(volume, t0 + s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + s + d);
      o.connect(g).connect(a.destination); o.start(t0 + s); o.stop(t0 + s + d + 0.05);
    }
    return true;
  }
  return { play, log, unlock: () => context() };
}
