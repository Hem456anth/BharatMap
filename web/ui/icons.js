// Original line-icon set for Bharat Map (drawn for this project; 24×24 grid, 1.8 stroke, currentColor).
const P = {
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>',
  flag: '<path d="M6 21V4M6 4.5h11l-2.2 4 2.2 4H6"/>',
  alert: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.2" r=".9" fill="currentColor"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  live: '<circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  brand: '<path d="M12 21.5s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0c0 5-6.5 11.2-6.5 11.2z" fill="currentColor" stroke="none"/><path d="M8.6 10.3h6.8M12 6.9v6.8" stroke="var(--on-brand,#fff)" stroke-width="1.6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  menu: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.6 3.8-5.4 7-5.4s5.8 1.8 7 5.4"/>',
  locate: '<circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="12" cy="12" r="7.2"/><path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3"/>',
  heading: '<path d="M12 3.5 18 19l-6-3.4L6 19z" fill="currentColor"/>',
  compass: '<path d="M12 3.2 15.2 12H8.8z" fill="#C62828" stroke="none"/><path d="M12 20.8 8.8 12h6.4z" fill="currentColor" stroke="none" opacity=".55"/><circle cx="12" cy="12" r="1.2" fill="var(--surface,#fff)" stroke="none"/>',
  layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.3 12 20.8l8.5-4.5"/>',
  bag: '<path d="M5.5 8.5h13l-1 11.5h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  download: '<path d="M12 4v10m-4.5-4.5L12 14l4.5-4.5M5 19.5h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>',
  home: '<path d="M4.5 11 12 4.5l7.5 6.5"/><path d="M6.5 9.5V19.5h11V9.5"/><path d="M10.2 19.5v-5h3.6v5"/>',
  work: '<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M4 13h16"/>',
  star: '<path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z"/>',
  starfill: '<path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z" fill="currentColor"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="5" cy="7" r=".9" fill="currentColor"/><circle cx="5" cy="12" r=".9" fill="currentColor"/><circle cx="5" cy="17" r=".9" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  pin: '<path d="M12 21s-6-5.8-6-10.5a6 6 0 0 1 12 0C18 15.2 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
  directions: '<path d="M12 2.8 21.2 12 12 21.2 2.8 12z"/><path d="M9.5 14.5v-3h5M12.5 9l2 2.5-2 2.5"/>',
  share: '<path d="M12 15V4M8 7.5 12 3.5l4 4"/><path d="M6 11v8.5h12V11"/>',
  phone: '<path d="M7 3.8h3l1.4 4-2 1.4a10 10 0 0 0 5.4 5.4l1.4-2 4 1.4v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 5 6a2 2 0 0 1 2-2.2z"/>',
  globe: '<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4M12 3.8c2.3 2.4 3.4 5.1 3.4 8.2s-1.1 5.8-3.4 8.2c-2.3-2.4-3.4-5.1-3.4-8.2S9.7 6.2 12 3.8z"/>',
  wheelchair: '<circle cx="11" cy="4.8" r="1.6"/><path d="M11 7.5v6h5l2.5 5"/><path d="M8 10.5a5 5 0 1 0 6.8 6.5"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15.5V6a1 1 0 0 1 1-1h9.5"/>',
  swap: '<path d="M8 4v15m-3.5-3.5L8 19l3.5-3.5M16 20V5m3.5 3.5L16 5l-3.5 3.5"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16"/>',
  volume: '<path d="M4.5 9.5h3.5L13 5.5v13l-5-4H4.5z"/><path d="M16.5 9a4.2 4.2 0 0 1 0 6M19 6.5a7.8 7.8 0 0 1 0 11"/>',
  mute: '<path d="M4.5 9.5h3.5L13 5.5v13l-5-4H4.5z"/><path d="m16.5 9.5 5 5m0-5-5 5"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5h4"/>',
  car: '<path d="M5 16.5v-4l1.8-5h10.4l1.8 5v4z"/><path d="M5 12.5h14"/><circle cx="8" cy="16.5" r="1.6" fill="currentColor"/><circle cx="16" cy="16.5" r="1.6" fill="currentColor"/>',
  scooter: '<circle cx="6.5" cy="17" r="2.3"/><circle cx="17.5" cy="17" r="2.3"/><path d="M6.5 17h7l2-8h2.5M15.5 9 14 5.5h-2.5M8.5 13.5h5"/>',
  cycle: '<circle cx="6" cy="16" r="3.4"/><circle cx="18" cy="16" r="3.4"/><path d="M6 16l3.5-7h5L18 16M9.5 9 12 16h-6M13 6.5h2.5"/>',
  walk: '<circle cx="13" cy="4.6" r="1.7"/><path d="m10 21 2.2-6.5L14.5 17v4M12.2 14.5 13 8.5l-3.2 1.7-1.3 3.3M13 8.5l2.2 3.2 2.8.8"/>',
  transit: '<rect x="6" y="3.5" width="12" height="13" rx="3"/><path d="M6 10.5h12M9 20.5l1.5-4M15 20.5l-1.5-4"/><circle cx="9.3" cy="13.5" r=".9" fill="currentColor"/><circle cx="14.7" cy="13.5" r=".9" fill="currentColor"/>',
  // categories
  fuel: '<rect x="5" y="4.5" width="9" height="15" rx="1.5"/><path d="M5 10h9M14 8.5l3.5 2.2V17a1.5 1.5 0 0 0 3 0v-6.5L18 8"/>',
  ev: '<path d="M13.5 3.5 6.5 13h5l-1 7.5 7-9.5h-5z"/>',
  atm: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M9.5 9.2h5M9.5 11.2h5M12.3 9.2c1.5 0 1.5 2 0 2H9.6l3.6 3.6"/>',
  metro: '<circle cx="12" cy="12" r="8.2"/><path d="M8 16V8.5l4 4.5 4-4.5V16"/>',
  bus: '<rect x="5.5" y="4" width="13" height="14" rx="2.5"/><path d="M5.5 11h13M8 20.5V18M16 20.5V18"/><circle cx="8.8" cy="14.5" r=".9" fill="currentColor"/><circle cx="15.2" cy="14.5" r=".9" fill="currentColor"/>',
  rail: '<path d="M8 3.5h8a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-9a2 2 0 0 1 2-2zM6 10h12M8.5 21l1.5-3.5M15.5 21 14 17.5"/>',
  hospital: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8v8M8 12h8"/>',
  pharmacy: '<rect x="3.6" y="8.6" width="16.8" height="6.8" rx="3.4" transform="rotate(-40 12 12)"/><path d="m9.4 9 5.2 6"/>',
  restaurant: '<path d="M7 3.5V11a2 2 0 0 0 2 2v7.5M11 3.5V11a2 2 0 0 1-2 2M9 3.5V9M16.5 20.5V3.5c-2 1-3 3.6-3 7.5h3"/>',
  grocery: '<path d="M3.5 5h2.5l2 10h10l2-7H7"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/>',
  parking: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M9.5 17V7.5H13a3 3 0 0 1 0 6H9.5"/>',
  airport: '<path d="M21 15.5v-2l-7.5-4.5V4.2a1.5 1.5 0 0 0-3 0V9L3 13.5v2l7.5-2.2v4.8l-2 1.5V21l3.5-1 3.5 1v-1.4l-2-1.5v-4.8z"/>',
  toll: '<path d="M4 20V9l8-5 8 5v11M4 12h16M9 20v-5h6v5"/>',
  plug: '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/>',
  toilets: '<circle cx="8" cy="5.5" r="1.6"/><circle cx="16" cy="5.5" r="1.6"/><path d="M6.5 20v-6H5.5l1.2-5.5h2.6L10.5 14H9.5v6M14.5 20v-11h3v11M12 3v18"/>',
  // maneuvers (arrow glyphs)
  left: '<path d="M17 20v-7a3 3 0 0 0-3-3H6m4-4-4 4 4 4"/>',
  right: '<path d="M7 20v-7a3 3 0 0 1 3-3h8m-4-4 4 4-4 4"/>',
  'slight-left': '<path d="M15 20v-6.5L9 7.5M8.5 12V7h5"/>',
  'slight-right': '<path d="M9 20v-6.5l6-6M15.5 12V7h-5"/>',
  'sharp-left': '<path d="M16 4v8L7.5 18.5M7 13.5v5.5h5.5"/>',
  'sharp-right': '<path d="M8 4v8l8.5 6.5M17 13.5v5.5h-5.5"/>',
  straight: '<path d="M12 20V5m-4.5 4.5L12 5l4.5 4.5"/>',
  uturn: '<path d="M8 20V9a4 4 0 0 1 8 0v6m-4-3.5 4 4 4-4"/>',
  'keep-left': '<path d="M14 20v-6l-5-5M9 13V9h4M17 20v-8"/>',
  'keep-right': '<path d="M10 20v-6l5-5M15 13V9h-4M7 20v-8"/>',
  roundabout: '<circle cx="12" cy="10" r="4"/><path d="M12 20v-6M16 10h4.5m-2-2 2 2-2 2"/>',
  depart: '<circle cx="12" cy="17" r="2.5"/><path d="M12 14.5V4.5M8.5 8 12 4.5 15.5 8"/>',
  arrive: '<path d="M7 21V4h10l-2.5 3.5L17 11H7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
};

export function icon(name, { size = 24, label = '' } = {}) {
  const body = P[name] || P.pin;
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="ic ic-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`;
}
export const hasIcon = (n) => n in P;
/** Fill every [data-icon] element inside root with its SVG (prepends, keeps text). */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    if (el.querySelector(':scope > svg.ic')) continue;
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  }
}
