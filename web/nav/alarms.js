// v0.7.20 (G7) arrival / get-off alarms — foreground. One active alarm at a time (destination, or a metro/bus stop of a
// transit itinerary). Fixes come from navigation (ctx.nav feeds every fix) or, outside navigation, from a foreground
// position watch started when the alarm is set and stopped when it fires or is cancelled. Firing: banner + vibration +
// spoken line (unless voice is muted) + a device notification (Capacitor LocalNotifications / Web Notification) when
// the user allowed notifications. No background geofence: the limitation is stated in the UI (al_foreground).
import { createProximityAlarm, ALARM_RADIUS_M } from '../shared/alarms.js';
import { watchPosition, deviceNotify } from '../native.js';
import { formatDistance } from './maneuver.js';

export function initAlarms(ctx) {
  const $ = (id) => document.getElementById(id);
  let alarm = null, stopWatch = null; const log = [];

  function banner(state, title, text) {
    const b = $('alarmBanner');
    if (!state) { b.hidden = true; return; }
    b.dataset.state = state; $('alarmTitle').textContent = title; $('alarmText').textContent = text;
    $('alarmDismiss').textContent = ctx.t(state === 'armed' ? 'al_cancel' : 'al_dismiss');
    $('alarmCancel').hidden = true;
    b.hidden = ctx.nav?.active && alarm?.kind === 'destination' && state === 'armed'; // during navigation the nav chip shows it
  }
  async function startWatch() {
    if (stopWatch || ctx.nav?.active) return;
    try { const stop = await watchPosition((fix) => feed(fix), () => {}); if (alarm && !alarm.fired && !ctx.nav?.active) stopWatch = stop; else stop(); } catch { /* no location: the alarm stays armed for navigation fixes */ }
  }
  function stopWatching() { stopWatch?.(); stopWatch = null; }

  /** Arm an alarm: { target:{lat,lng}, label, kind: 'destination'|'metro'|'bus'|'rail'|'stop', radiusM }. */
  function set({ target, label = '', kind = 'destination', radiusM } = {}) {
    clear({ silent: true });
    alarm = createProximityAlarm({ target, label, kind, radiusM: radiusM || ALARM_RADIUS_M[kind] || 500 });
    banner('armed', ctx.tf('al_on', { d: formatDistance(alarm.radiusM), name: label || ctx.t('to') }), ctx.t('al_foreground'));
    ctx.emit('alarm', { state: 'armed', id: alarm.id, kind, radiusM: alarm.radiusM, label });
    startWatch();
    return alarm;
  }
  function clear({ silent = false } = {}) {
    if (!alarm) return;
    alarm.cancel(); const id = alarm.id; alarm = null; stopWatching(); banner(null);
    if (!silent) { ctx.toast(ctx.t('al_off')); ctx.emit('alarm', { state: 'cancelled', id }); }
  }
  function feed(fix) {
    if (!alarm || alarm.fired) return;
    const r = alarm.update(fix);
    if (!r.fire) return;
    const a = alarm; stopWatching();
    const text = a.kind === 'destination' ? ctx.tf('al_fire_dest', { d: formatDistance(r.distanceM), name: a.label || ctx.t('to') }) : ctx.tf('al_fire_stop', { name: a.label });
    banner('fired', ctx.t('al_fire_t'), text);
    log.push({ id: a.id, kind: a.kind, distanceM: r.distanceM, at: Date.now() });
    try { navigator.vibrate?.([400, 150, 400, 150, 600]); } catch { /* no vibration */ }
    if (ctx.nav?.voice && !ctx.nav.voice.muted) ctx.nav.voice.speak(text, { fallbackText: text }).catch?.(() => {});
    deviceNotify(ctx.t('al_fire_t'), text).catch(() => {});
    ctx.emit('alarm', { state: 'fired', id: a.id, kind: a.kind, distanceM: r.distanceM });
  }
  $('alarmDismiss').addEventListener('click', () => { if (alarm && !alarm.fired) clear(); else { alarm = null; banner(null); } });
  ctx.on('nav', ({ active }) => { if (active) stopWatching(); else if (alarm && !alarm.fired) startWatch(); });
  return { set, clear, feed, get active() { return alarm; }, log };
}
