// File export / import for GPX and KML (v0.8).
// Export: in the Android app the file is written to the app cache (Capacitor Filesystem) and handed to the system share
// sheet (Capacitor Share), so the user picks Drive, Files, WhatsApp or another maps app; on the web it downloads.
// Import: the standard file picker (<input type=file>), which the Capacitor WebView supports natively.
const cap = () => window.Capacitor;
const plugin = (n) => (cap()?.isNativePlatform?.() ? cap().Plugins?.[n] : null);

/** Save or share a text file. Returns 'shared' | 'downloaded'. */
export async function exportTextFile(filename, mime, text, { title = filename } = {}) {
  const FS = plugin('Filesystem'), SH = plugin('Share');
  if (FS && SH) {
    const r = await FS.writeFile({ path: filename, data: text, directory: 'CACHE', encoding: 'utf8' });
    await SH.share({ title, files: [r.uri], dialogTitle: title });
    return 'shared';
  }
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'downloaded';
}

/** Open the file picker for GPX/KML. Resolves { name, text } or null when cancelled. Rejects Error('too_large'). */
export function pickTextFile({ accept = '.gpx,.kml,.kmz,application/gpx+xml,application/vnd.google-earth.kml+xml', maxBytes = 8 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept; input.id = 'bmFilePick'; input.hidden = true;
    input.addEventListener('change', async () => {
      const f = input.files?.[0]; input.remove();
      if (!f) return resolve(null);
      if (f.size > maxBytes) return reject(new Error('too_large'));
      try { resolve({ name: f.name, text: /\.kmz$/i.test(f.name) ? '' : await f.text() }); } catch (e) { reject(e); }
    });
    input.addEventListener('cancel', () => { input.remove(); resolve(null); });
    document.body.appendChild(input);
    input.click();
  });
}
