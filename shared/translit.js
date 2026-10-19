// Latin ↔ Indic transliteration for search (original, rule-based; no external data).
// All Brahmic scripts in Unicode share the ISCII-derived layout: the same offset inside each block is the same
// letter (క U+0C15 = क U+0915 = ka). One offset table therefore covers Devanagari (hi/mr), Bengali, Gurmukhi,
// Gujarati, Odia, Tamil, Telugu, Kannada and Malayalam.
//   toLatin('సింహాచలం')  → 'simhaacalam'   (readable romanisation, ISO-like without diacritics)
//   phoneticKey('Simhachalam') === phoneticKey('సింహాచలం') === phoneticKey('सिंहाचलम')  → 'snhclm'
// The phonetic key is deliberately loose (aspiration, vowel length, retroflex/dental, v/w, nasal before a
// consonant, doubled letters and inner vowels are folded) so that Latin spellings people actually type match
// native-script names and vice versa. Ranking (shared/search-index.js) then prefers the closer spellings.

export const SCRIPT_BLOCKS = { deva: 0x0900, beng: 0x0980, guru: 0x0a00, gujr: 0x0a80, orya: 0x0b00, taml: 0x0b80, telu: 0x0c00, knda: 0x0c80, mlym: 0x0d00 };
export const LANG_SCRIPT = { hi: 'deva', mr: 'deva', bn: 'beng', pa: 'guru', gu: 'gujr', or: 'orya', ta: 'taml', te: 'telu', kn: 'knda', ml: 'mlym' };

// offset → [kind, latin]   kind: v = independent vowel, c = consonant, m = vowel sign (matra), x = virama,
// n = nasal/visarga modifier, d = digit, s = skip
const T = {};
const put = (kind, list) => { for (const [o, l] of list) T[o] = [kind, l]; };
put('n', [[0x01, 'n'], [0x02, 'm'], [0x03, 'h']]);
put('v', [[0x04, 'a'], [0x05, 'a'], [0x06, 'aa'], [0x07, 'i'], [0x08, 'ii'], [0x09, 'u'], [0x0a, 'uu'], [0x0b, 'ru'], [0x0c, 'lu'], [0x0d, 'e'], [0x0e, 'e'], [0x0f, 'e'], [0x10, 'ai'], [0x11, 'o'], [0x12, 'o'], [0x13, 'o'], [0x14, 'au'], [0x60, 'ruu'], [0x61, 'luu']]);
put('c', [[0x15, 'k'], [0x16, 'kh'], [0x17, 'g'], [0x18, 'gh'], [0x19, 'ng'], [0x1a, 'ch'], [0x1b, 'chh'], [0x1c, 'j'], [0x1d, 'jh'], [0x1e, 'ny'],
  [0x1f, 't'], [0x20, 'th'], [0x21, 'd'], [0x22, 'dh'], [0x23, 'n'], [0x24, 't'], [0x25, 'th'], [0x26, 'd'], [0x27, 'dh'], [0x28, 'n'], [0x29, 'n'],
  [0x2a, 'p'], [0x2b, 'ph'], [0x2c, 'b'], [0x2d, 'bh'], [0x2e, 'm'], [0x2f, 'y'], [0x30, 'r'], [0x31, 'r'], [0x32, 'l'], [0x33, 'l'], [0x34, 'zh'],
  [0x35, 'v'], [0x36, 'sh'], [0x37, 'sh'], [0x38, 's'], [0x39, 'h'],
  [0x58, 'q'], [0x59, 'kh'], [0x5a, 'g'], [0x5b, 'z'], [0x5c, 'r'], [0x5d, 'rh'], [0x5e, 'f'], [0x5f, 'y']]);
put('m', [[0x3e, 'aa'], [0x3f, 'i'], [0x40, 'ii'], [0x41, 'u'], [0x42, 'uu'], [0x43, 'ru'], [0x44, 'ruu'], [0x45, 'e'], [0x46, 'e'], [0x47, 'e'], [0x48, 'ai'],
  [0x49, 'o'], [0x4a, 'o'], [0x4b, 'o'], [0x4c, 'au'], [0x4e, 'e'], [0x4f, 'aw'], [0x56, 'ai'], [0x57, 'au'], [0x62, 'lu'], [0x63, 'luu']]);
put('x', [[0x4d, '']]);
put('s', [[0x00, ''], [0x3c, ''], [0x3d, ''], [0x55, ''], [0x70, ''], [0x71, ''], [0x64, ' '], [0x65, ' ']]);
for (let i = 0; i < 10; i++) T[0x66 + i] = ['d', String(i)];
// Script-specific extras (absolute code points).
const EXTRA = { 0x09ce: ['c', 't'], 0x0a70: ['n', 'n'], 0x0a71: ['s', ''], 0x0a72: ['v', ''], 0x0a73: ['v', ''], 0x0c58: ['c', 'ts'], 0x0c59: ['c', 'dz'],
  0x0d7a: ['c', 'n'], 0x0d7b: ['c', 'n'], 0x0d7c: ['c', 'r'], 0x0d7d: ['c', 'l'], 0x0d7e: ['c', 'l'], 0x0d7f: ['c', 'k'], 0x0b83: ['n', 'h'] };
const CHILLU = new Set([0x09ce, 0x0d7a, 0x0d7b, 0x0d7c, 0x0d7d, 0x0d7e, 0x0d7f]); // dead consonants: no inherent vowel

/** Script id of a code point (deva, telu, …) or null. */
export function scriptOf(cp) {
  if (cp < 0x0900 || cp > 0x0d7f) return null;
  for (const [id, base] of Object.entries(SCRIPT_BLOCKS)) if (cp >= base && cp < base + 0x80) return id;
  return null;
}
/** True when the string contains any Brahmic (Indic) letter. */
export function hasIndic(s) { return /[\u0900-\u0d7f]/.test(String(s || '')); }

/** Indic (any of the 9 Brahmic blocks, mixed allowed) → plain Latin. Non-Indic characters pass through. */
export function toLatin(input) {
  const s = String(input || '').normalize('NFC');
  let out = ''; let pending = false; // a consonant that still carries its inherent 'a'
  const flush = () => { if (pending) { out += 'a'; pending = false; } };
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === 0x200c || cp === 0x200d) continue; // ZWNJ / ZWJ
    const sc = scriptOf(cp);
    if (!sc) { flush(); out += ch; continue; }
    const e = EXTRA[cp] || T[cp - SCRIPT_BLOCKS[sc]];
    if (!e) { flush(); continue; }
    const [kind, lat] = e;
    if (kind === 'c') { flush(); out += lat; pending = !CHILLU.has(cp); }
    else if (kind === 'm') { pending = false; out += lat; }
    else if (kind === 'x') { pending = false; }
    else if (kind === 'n') { flush(); out += lat; }
    else if (kind === 'v' || kind === 'd') { flush(); out += lat; }
    else { if (lat === ' ') { flush(); out += ' '; } }
  }
  flush();
  return out;
}

/** Lower-case Latin, accents stripped, only letters/digits/spaces (Indic transliterated first). */
export function latinFold(s) {
  return toLatin(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const VOWEL = /[aeiouy]/; // y treated as vowel-ish for skeletons ("Vijay" ~ "Vijai")
/**
 * Loose phonetic key of ONE word (Latin or Indic). Rules, in order:
 *  aspirates kh gh ch(h) jh th dh ph bh sh → k g c j t d p b s · c (not ch) → k · q → k · x → ks · f → p · w → v · z → j
 *  n/m before a consonant → n (anusvara spelled m or n) · drop vowels except a leading one · collapse doubled letters
 */
export function phoneticKey(word) {
  let s = latinFold(word).replace(/\s+/g, '');
  if (!s) return '';
  s = s.replace(/ck/g, 'k').replace(/chh|ch/g, 'C').replace(/c/g, 'k').replace(/C/g, 'c')
    .replace(/([kgjtdpbs])h/g, '$1').replace(/q/g, 'k').replace(/x/g, 'ks').replace(/f/g, 'p').replace(/w/g, 'v').replace(/z/g, 'j');
  // ee/ii/oo/uu/aa → single vowels before vowel removal does not matter; but nasal rule needs vowel context
  s = s.replace(/[nm](?=[^aeiouy\d])(?!$)/g, 'n');
  const head = s[0];
  const body = s.slice(1).replace(/[aeiouy]/g, '');
  s = (head + body).replace(/(.)\1+/g, '$1');
  // a word that is only vowels ("ee") keeps itself
  return s;
}
/** Phonetic keys of every word in a name/query. */
export function phoneticWords(s) { return latinFold(s).split(' ').filter(Boolean).map(phoneticKey).filter(Boolean); }

// ---- Latin → Indic (best effort, for display of a query in the user's script and for tests) ----
const L2I = [
  ['aa', 0x3e, 0x06], ['ai', 0x48, 0x10], ['au', 0x4c, 0x14], ['ee', 0x40, 0x08], ['ii', 0x40, 0x08], ['oo', 0x4b, 0x13], ['uu', 0x42, 0x0a],
  ['a', null, 0x05], ['i', 0x3f, 0x07], ['u', 0x41, 0x09], ['e', 0x47, 0x0f], ['o', 0x4b, 0x13],
];
const L2C = [['chh', 0x1b], ['kh', 0x16], ['gh', 0x18], ['ch', 0x1a], ['jh', 0x1d], ['th', 0x24], ['dh', 0x26], ['ph', 0x2b], ['bh', 0x2d], ['sh', 0x36],
  ['k', 0x15], ['g', 0x17], ['c', 0x15], ['j', 0x1c], ['t', 0x24], ['d', 0x26], ['n', 0x28], ['p', 0x2a], ['b', 0x2c], ['m', 0x2e], ['y', 0x2f],
  ['r', 0x30], ['l', 0x32], ['v', 0x35], ['w', 0x35], ['s', 0x38], ['h', 0x39], ['f', 0x2b], ['z', 0x1c], ['q', 0x15], ['x', 0x15]];
/** Latin → script (lang: te, hi, ta, …). Word-final 'm' after a vowel becomes anusvara (Telugu/Kannada/Malayalam style). */
export function fromLatin(input, lang = 'te') {
  const base = SCRIPT_BLOCKS[LANG_SCRIPT[lang] || 'telu'];
  const ch = (o) => String.fromCodePoint(base + o);
  const s = String(input || '').toLowerCase();
  let out = ''; let i = 0; let prevCons = false;
  const anusvaraFinal = ['te', 'kn', 'ml'].includes(lang);
  while (i < s.length) {
    const rest = s.slice(i);
    if (!/[a-z]/.test(s[i])) { if (prevCons) out += ch(0x4d); prevCons = false; out += s[i]; i++; continue; }
    const v = L2I.find(([l]) => rest.startsWith(l));
    if (v) { const [l, matra, ind] = v; out += prevCons ? (matra ? ch(matra) : '') : ch(ind); prevCons = false; i += l.length; continue; }
    const c = L2C.find(([l]) => rest.startsWith(l));
    if (c) {
      const [l, o] = c;
      const nextIsEnd = !/[a-z]/.test(s[i + l.length] || '');
      if ((l === 'm' || l === 'n') && (nextIsEnd ? anusvaraFinal && !prevCons : !/[aeiou]/.test(s[i + l.length]) && !prevCons) && out) { out += ch(0x02); i += l.length; continue; }
      if (prevCons) out += ch(0x4d);
      out += ch(o); prevCons = true; i += l.length; continue;
    }
    i++;
  }
  if (prevCons) out += ch(0x4d);
  return out;
}
