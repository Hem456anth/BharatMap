// Clipboard helper (v0.7.20, G9): navigator.clipboard → execCommand fallback. Records the last copy for E2E checks.
export async function copyText(text) {
  window.__BM_LAST_COPY__ = String(text || '');
  try { await navigator.clipboard.writeText(String(text || '')); return true; } catch { /* permission / insecure context */ }
  try {
    const ta = document.createElement('textarea'); ta.value = String(text || ''); ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
