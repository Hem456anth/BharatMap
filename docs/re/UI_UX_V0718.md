# Bharat Map 0.7.18 — UI/UX pass (A1–A7, A15)

Date: 20 Oct 2026 (IST). Input: our own clean-room behaviour notes on a web map app (items A1–A18, kept outside this repo).
Nothing was copied from that product: no screenshots, icons, fonts, images, colours sampled as assets, or copy. All
glyphs are drawn for this project (`web/ui/icons.js`), the type is Noto Sans, and the palette is our "Deccan dusk"
identity (`docs/re/UI_UX_SPEC.md`): **neel** = selection, links, focus; **harit** = the single primary action;
**kesar** = location. CoMaps remains the main architectural blueprint (`docs/re/COMAPS_TEARDOWN.md`); this pass is
UI only.

Pure helpers: `web/lib/ux.js` (unit-tested in `tests/v0718.test.js`). Strings: `shared/i18n-v0718.js` (en complete;
hi/te written in-house, need native review; other languages fall back to English).

| Item | What changed | Status |
|---|---|---|
| **A1 Design tokens** | Type scale 24/22/20/17/15/11 (`--fs-title … --fs-label`), spacing 4–32, radii, motion, surfaces in `web/styles.css`. Warm light panel `--panel #FAF8F4` with white cards; **dark mode: grouped cards (#12151C) sit darker than the panel (#1A1E28)** as requested. Accent (`--accent` = neel) only for selection / links / focus; decorative icon tiles are neutral. ≥ 1280 px: the panel **docks full height at 420 px** with a divider (map padding follows its edge); 900–1279 px keeps the floating 400 px panel; phones keep the 3-detent sheet. Indic labels never uppercase. | ✅ for the map surfaces (home, results, place, directions, autocomplete, states). 🟡 Shop / admin / settings still use the older ad-hoc sizes. ⬜ rail and 600–899 px floating-sheet tier (A10) not done. |
| **A2 Place card** | Fixed block order: header (name, local-script name line, category hue + distance) → equal action tiles (Directions is the only filled tile; Call or Website or Shop as the 4th) → label/value **ribbon** (Hours · Pay · Distance) → About → Good to know (OSM amenity tags) → service panels → Also here → Details (hours, address + nearby landmark, phone, website, pincode, DIGIPIN + coordinates) → footer. A block renders only when it has data. Hours have 5 states: **Open, Closing soon, Closed, Opening soon** (amber `--soon`, always with text) and unknown. Lean cards (address only) show **"Help complete this place"** (opens the OSM note flow). | ✅. ⬜ photos and ratings blocks (no open-licence photo or rating source wired yet, so they are always dropped); weekly hours table; "More" overflow for > 4 actions. |
| **A3 Route options** | Header card with the selected route's **total time · distance · arrival** and **Start**; option cards (duration 22/750, `Arrive HH:MM · km`, "via …", descriptor Fastest / Shortest / Alternative / Estimate, badges only for facts we know: avoids tolls / highways when the engine applied it, 2-wheeler estimate, straight-line estimate, +N min vs fastest). **Selected card is filled neel** with white text (9.9:1). Totals also head the steps list and follow the selection. | ✅. ⬜ toll ₹ estimate and elevation badges (no fee / DEM data); steps remain an inline `<details>`, not a pushed view. |
| **A4 Empty / unavailable states** | One component (`emptyState()` refuses a state without an action): autocomplete no-match rows (Search around the map · Report a missing place), submitted-search no-match (Search the map area · Report missing place · Shop), geocoder error (Retry · Search on this device), category with no results (Zoom out and search again · Report), Overpass error (Retry · Low-bandwidth), straight-line route fallback (Retry · Try 2-wheeler), **transit with no timetable (Try 2-wheeler · Drive · Walk when ≤ 3 km)**, empty saved list (Find a place · Import GPX/KML). Geocoding stays bounded to India; we never jump country. | ✅ |
| **A5 Map-failure banner** | `web/ui/map-health.js` + pure `mapHealth()`: banner on the map when WebGL is unavailable, the style has not loaded after 15 s, or tiles keep failing and the bundled offline map is not available/also failing. Actions: Retry, Low-bandwidth mode (when not already on), Use offline map (when it can help); dismissible; search and lists keep working. No WebGL: a banner with Retry instead of a blank page (`app.js`). | ✅ web. 🟡 With no WebGL the rest of the app does not start (MapLibre needs WebGL); there is no raster fallback renderer. |
| **A6 Autocomplete** | 32 px glyph circle in the category hue (DIGIPIN and pincode rows have their own glyphs); **only the matched part bolded** (case/diacritic-insensitive, escaped); a **script badge** when the hit is in another script (e.g. "simhachalam" → సింహాచలం); **distance from the map centre**, right-aligned, tabular; arrow-key highlight with a 4 px neel bar. | ✅ |
| **A7 Category colours + India chip grid** | 16 hue tokens (`--cat-fuel … --cat-place`, all ≥ 3:1 with a white glyph; existing marker colours promoted); used by chips, result rows, markers, place header and autocomplete. Home: India-first order (Petrol, EV, ATM, Hospital, Pharmacy, Metro, …) as a 2-row horizontally scrolling grid on phones and a 2-up grid from 600 px, ending with **All categories** (grouped page: Getting around · Health · Daily needs). | ✅ |
| **A15 Interaction states** | Hover overlay 6 % only on pointer devices (`@media (hover:hover)`), press 12 % + scale .98 (off with reduced motion), 2 px focus-visible ring on tiles, chips, cards, route options, buttons (white inner ring on filled ones), selected-row bar. | ✅ |

**Deliberate deviation (owner's call):** the internal gap list advised against darker-than-panel dark cards for
sunlight legibility on low-end OLED phones. The owner asked for them, so they ship; text contrast on the darker cards
is still ≥ 8:1 for secondary text. Revisit after device testing.

**Not in this pass:** A8–A14, A16–A18; APK slimming (cities, fonts, R8) still awaits the owner.

Screenshots (our app only): `docs/screenshots/v0718/before-*.png` (v0.7.17 build) and `after-*.png` (this build),
desktop 1366×820 and mobile 390×844, light and dark, made by `scripts/shots-v0718.mjs` with the E2E network fixtures.
The "Sea View Tiffins" place in them is a SYNTHETIC demo place used only to show the ribbon / good-to-know blocks.
