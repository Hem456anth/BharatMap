// localStorage that degrades to memory (sandboxed iframes / privacy modes throw on access).
const mem = new Map();
let ls = null;
try { ls = window.localStorage; ls.setItem('__t', '1'); ls.removeItem('__t'); } catch { ls = null; }
export const store = {
  getItem: (k) => (ls ? ls.getItem(k) : mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => (ls ? ls.setItem(k, v) : mem.set(k, String(v))),
  removeItem: (k) => (ls ? ls.removeItem(k) : mem.delete(k)),
};
