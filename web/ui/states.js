// v0.7.18 (A4): empty / unavailable states always carry at least one action (UX_SPEC §10). The markup comes from the
// pure, unit-tested emptyStateHtml(); this binds each action button to a handler.
import { emptyStateHtml } from '../lib/ux.js';
import { icon } from './icons.js';

export function renderState(el, spec, handlers = {}) {
  el.innerHTML = emptyStateHtml(spec, (name) => icon(name, { size: 20 }));
  el.querySelectorAll('[data-state-act]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); handlers[b.dataset.stateAct]?.(b.dataset.arg); }; });
  return el;
}
