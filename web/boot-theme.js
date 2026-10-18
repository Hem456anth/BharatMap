// Applies the saved/auto theme before first paint (external file: the CSP forbids inline scripts).
(function () {
  var pref = 'auto';
  try { pref = localStorage.getItem('bm-theme') || 'auto'; } catch (e) { /* storage blocked */ }
  var dark = pref === 'dark' || (pref === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
