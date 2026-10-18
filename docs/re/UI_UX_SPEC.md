# Bharat Maps: UI/UX specification (v0.3)

This is an **original** design for Bharat Maps.
- It borrows *behavioural* lessons from the teardown (`REVERSE_ENGINEERING_REPORT.md` Part C), not visual identity.
- No Apple or AMap colours, icons, glyph shapes, sounds or copy are used.
- **Platform:** Android first (Capacitor WebView + MapLibre GL JS). Units are **dp** (1 dp = 1 CSS px at DPR 1). Type sizes are in **sp**, mapped to CSS `rem` so user font scaling is respected.

**Design principles**
1. **Map first, calm home.** The map is the hero. Commerce and services sit behind clear entry points. This avoids AMap's "control room" clutter.
2. **One sheet, three heights.** Everything contextual lives in a single bottom sheet. The map stays visible.
3. **Landmarks before street names.** Indian wayfinding is landmark-led. Instructions and addresses lead with the nearest known landmark.
4. **Honest data.** Anything estimated, simulated or without live traffic says so in plain words ("ETA without live traffic", "Toll estimate").
5. **Private by default.** No login is needed to search, navigate or save. Recents and saved places live on-device.

---

## 1. Design language

### 1.1 Identity: "Deccan dusk"
The three accents are:
- **Neel** (indigo): the brand and route colour
- **Harit** (green): the primary action, kept from v0.2's `#0F6E56`
- **Kesar** (saffron): your location and highlights

Surfaces are warm off-white "paper" rather than pure grey, and the map style tint is a muted warm sand. The location puck is a **saffron dot with an indigo ring and an indigo heading cone**. This deliberately avoids the blue-dot convention both reference apps use.

Signature shape: **squircle-free rounded rectangles**, with 16 dp corners on cards and 28 dp on the sheet. A small **notch chevron** replaces the classic grabber pill. It is a 32×4 dp bar with 2 dp end-caps angled 20°, and it reads as "Bharat Maps".

### 1.2 Colour tokens
All contrast values were computed with the WCAG 2.1 formula. Text tokens are ≥ 4.5:1 on their intended surface.

| Token | Light | Dark | Use / contrast |
|---|---|---|---|
| `surface.base` | `#FFFFFF` | `#0F1117` | App background |
| `surface.paper` | `#F5F3EE` | `#171A23` | Chips, list rows, offline cards |
| `surface.sheet` | `#FFFFFF` | `#1C202B` | Bottom sheet, dialogs |
| `surface.scrim` | `#14182B` @ 40% | `#000000` @ 55% | Behind full sheet / dialogs |
| `text.primary` | `#1B1D2A` (16.7:1 on white) | `#ECEDF2` (13.9:1 on sheet) | Body, titles |
| `text.secondary` | `#545869` (7.05:1; 6.36:1 on paper) | `#A9ADBD` (7.28:1) | Meta, captions |
| `text.tertiary` | `#6E7283` (4.78:1) | `#8D91A3` | Hints only (never essential info) |
| `brand.neel` | `#2F3A8F` (9.9:1 on white) | `#8E9BFF` (6.4:1 on sheet) | Links, selected tab, primary route line |
| `action.harit` | `#0F6E56` (white text 6.2:1) | `#3CC79A` (ink text 8.8:1) | Primary buttons ("Start", "Directions") |
| `accent.kesar` | `#E07A10` (ink text 5.5:1; vs white 3.0:1 = graphics only) | `#FFA94D` (ink 9.9:1) | Location puck, active chip ring, highlights |
| `route.alt` | `#8C90A6` | `#6B6F82` | Alternative route lines (4 dp, 70% opacity) |
| `route.casing` | `#FFFFFF` | `#0F1117` | 2 dp casing under route lines |
| `traffic.free` / `slow` / `jam` / `closed` | `#1E8E5A` / `#E0A100` / `#C62828` / `#6B1A1A` | same, +10% lightness | Only shown when a 💰 traffic feed is on |
| `status.danger` | `#B3261E` (6.5:1) | `#FFB4AB` (9.6:1) | Errors, closures |
| `status.warning.text` | `#8A5A00` (5.9:1) | `#FFCC66` | "Estimate", "No live traffic" badges |
| `focus.ring` | `#2F3A8F` 3 dp + 2 dp white gap | `#8E9BFF` 3 dp + 2 dp `#0F1117` gap | Keyboard / switch access focus |

Rules:
- Saffron is never used for text on white.
- The route line is never green, so it can't be confused with traffic-free green.
- Map style follows the theme: light basemap with a sand tint `#F2EEE6`, or dark basemap with a navy tint `#141826`.
- Dark mode switches automatically with the system and can be overridden in Settings.

### 1.3 Type
- **Family:** Noto Sans plus the matching Noto Sans {Devanagari, Telugu, Tamil, Kannada, Malayalam, Bengali, Gujarati, Gurmukhi, Oriya} (OFL). Bundle subsets for the offline build.
- **Numerals:** tabular figures for ETA, distance and price.

| Style | Size / line | Weight | Use |
|---|---|---|---|
| `display` | 34 / 40 sp | 700 | Maneuver distance ("300 m") |
| `headline` | 24 / 30 sp | 600 | Maneuver instruction, place name in full sheet |
| `title` | 20 / 26 sp | 600 | Place name in half sheet, screen titles |
| `body.lg` | 17 / 24 sp | 400 | Search input, list primary text |
| `body` | 15 / 22 sp | 400 | Default |
| `label` | 14 / 18 sp | 500 | Buttons, chips |
| `caption` | 12 / 16 sp | 400 | Meta lines, attribution (minimum size anywhere) |

- Indic scripts get **+2 sp** and line height ×1.15 at every step, because conjuncts need vertical room.
- Never truncate an instruction mid-word. Wrap to 2 lines, then shrink one step.

### 1.4 Spacing, shape, elevation
- **Spacing:** 4 dp grid. Common steps are 4/8/12/16/24/32.
- **Corners:** sheet 28 dp (top only), cards 16, chips 999 (pill), FABs 16 (rounded square, not circles).
- **Elevation:** map controls use a 1 dp `#1B1D2A`@12% stroke + y=2/blur=8 shadow @16% for contrast on any map. The sheet uses y=-2/blur=16 @18%.

---

## 2. Bottom sheet (3 detents)

**Detents** (H = viewport height minus system bars):
| Detent | Height | Content |
|---|---|---|
| **Peek** | 112 dp (search field + one row of chips) + safe-area | Search bar, category chips |
| **Half** | 0.5 H (min 320 dp) | Recents / results list / place summary / route options |
| **Full** | H − 16 dp | Full place card, full results, settings pages |

**Behaviour**
- **Drag:** the sheet follows the finger 1:1. On release it snaps to the nearest detent, adjusted by velocity:
  - fling > 1,000 dp/s moves one detent in the fling direction
  - fling > 2,500 dp/s jumps to the extreme
- **Tap the grabber** to cycle peek → half → full → half. Announced to TalkBack as "Sheet, half height. Double-tap to expand." This follows the "tappable grabber" lesson (A2).
- **Inner scroll:**
  - content scrolls only at Full
  - at Half, an upward drag expands the sheet first
  - at Full with content scrolled to top, a downward drag collapses the sheet
- **Map interaction:**
  - at Peek and Half the map stays fully interactive (non-modal sheet)
  - at Full a 40% scrim covers the map, and tapping the scrim returns to Half
- **Context-driven detent:**
  - tapping a POI opens the place summary at Half
  - search submit shows results at Half, with pins fitted to the visible map area above the sheet
  - "Directions" opens route options at Half
- **Camera padding:** whenever the sheet height changes, set MapLibre `padding.bottom = sheetHeight` (240 ms ease). The selected pin stays in the visible area. This follows HIG's "keep the location visible" (A1).
- **Back button (Android):** goes to the previous content state first, then collapses the detent, then exits. It never closes the app from Half or Full.
- **Attribution** "© OpenStreetMap contributors" is pinned 8 dp above the sheet's *lowest* resting height (Peek). It does not move with drags and stays visible except at Full.

---

## 3. Floating map controls

The controls are a right-edge column, 16 dp from the edge. They sit above the sheet at Peek and Half and hide at Full. All targets are **48 × 48 dp**, with icons 24 dp.

| Control | Behaviour |
|---|---|
| **Locate** | Tap 1 centres on you (zoom 16). Tap 2 enters follow-heading mode (icon gains a cone). Tap 3 returns to north-up. Long-press: "Share my location". First tap triggers the permission flow (§13). |
| **Compass** | Appears only when bearing ≠ 0 or pitch > 0. It rotates with the map. Tap resets bearing and pitch (400 ms). |
| **2D / 3D** | Toggles pitch 0° ↔ 55° (55° is easier on low-end GPUs than 60°). The label shows the *target* state ("3D"). |
| **Layers** | Opens the Layers sheet at Half (see below). |

**Layers sheet**
- **Base:** Standard / Dark / Offline (only when a region is downloaded)
- **Overlays:** Transit lines, EV chargers, Petrol, Toll plazas, Traffic (greyed "Needs live traffic service" until a 💰 provider is configured)
- **Labels:** language picker, with an "English + local script" option

Controls fade out (120 ms) during active pan/zoom and fade back in 600 ms after the gesture ends. With reduced motion they stay visible.

---

## 4. Search

**Peek state:** a search field ("Search places, shops, addresses, DIGIPIN") with a mic button, plus a horizontally scrolling row of chips.

**Category chips** (India set, in this order, each with an original line icon):
| Chip | Query (OSM tags / own catalogue) |
|---|---|
| Petrol | `amenity=fuel` |
| EV charge | Open Charge Map + `amenity=charging_station` |
| ATM | `amenity=atm`, `amenity=bank`+`atm=yes` |
| Metro | `railway=station`+`station=subway` / `public_transport=station` + HMRL GTFS stops |
| Bus stop | `highway=bus_stop` + TGSRTC GTFS stops |
| Railway | `railway=station` (not subway) |
| Hospital | `amenity=hospital`, `amenity=clinic` |
| Pharmacy | `amenity=pharmacy`, `healthcare=pharmacy` |
| Chai / Tiffin | `amenity=cafe`/`fast_food`/`restaurant` with `cuisine~tea|indian|south_indian|breakfast` + name match "tiffin", "tea", "chai" |
| Kirana | `shop=convenience`/`supermarket`/`general` + own seller catalogue |

The chip label is localised. Long-press a chip to see its definition ("Shows places tagged as fuel stations on OpenStreetMap").

**Focus state** (Full detent, keyboard up):
1. **Recents:** the last 10 queries and places. On-device only, swipe to delete, and "Clear all" in the header.
2. **Saved shortcuts:** Home, Work, plus the first 3 lists.
3. **Suggestions as you type** (debounce 200 ms, after 2 characters). Order: own catalogue → Photon (biased to map centre) → address parser (landmark / pincode / DIGIPIN). Each row shows an icon, name, a secondary line (locality + distance) and a source tag only for DIGIPIN/pincode.

**Results**
- Half detent shows a list. Pins are clustered.
- A **"Search this area"** pill appears top-centre after the map moves more than 30% of the viewport.
- **Filters row:** Open now · Distance · Rating (own data only) · In stock (commerce).

**Empty / offline**
- No results: "No places found here. Try a nearby landmark or a pincode." plus a chip "Search all of {city}".
- Offline: search covers bundled POIs only, with a banner "Offline: showing saved and downloaded places."

---

## 5. Place card anatomy

**Half detent (summary)**
1. Name (`title`), category · locality · distance from you.
2. Status line: "Open · closes 9:30 pm" (from `opening_hours`) or "Hours not listed".
3. **Action row:** four 48 dp buttons with labels: **Directions** (primary, Harit), **Call**, **Save**, **Share**. Commerce sellers swap Share for **Shop**.
4. Landmark line: "Near Jagadamba Junction" (nearest named landmark within 300 m).

**Full detent (detail)** adds, in order:
5. Photos strip (seller-supplied only; OSM has none). Hidden when empty, with no placeholder art.
6. Details: address with a copy button, DIGIPIN with a copy button, phone, website, hours table, payment (`payment:upi=yes` → "UPI accepted"), wheelchair access.
7. Catalogue (sellers): price, MRP, stock, "Add to cart".
8. Ratings (own platform) with count; "Rate this place" (requires sign-in).
9. "Suggest an edit": for OSM places, deep-link to OSM note creation; for sellers, notify the owner.
10. Source and attribution footer: "Data © OpenStreetMap contributors" or "Listed by seller", plus a last-updated date.

**Dropped pin** (long-press) shows the same layout with "Dropped pin", the reverse-geocoded address, DIGIPIN, and the actions Directions · Save · Share · Download area.

---

## 6. Route planner

**Entry:** Directions from a place, from a pin, or from a saved shortcut. Origin defaults to "Your location".

**Header:** origin / destination fields with a swap button. "+ Add stop" allows up to 10 stops, with drag to reorder.

**Mode tabs** (segmented, 48 dp):
| Mode | Engine profile | Notes |
|---|---|---|
| **Drive** | car | Avoid tolls / highways toggles |
| **2-Wheeler** | Valhalla `motor_scooter` (fallback: car with "2-wheeler estimate" badge) | Default for users who pick it at onboarding |
| **Walk** | foot | Steps typed: stairs / foot over-bridge / subway, where OSM tags exist |
| **Transit** | GTFS planner | Hyderabad only in v0.3. Elsewhere: "Transit coming to {city}" |

**Route options** (Half detent):
- Up to 3 cards, sorted by time. Each card shows:
  - ETA and duration (`display`/`title`)
  - distance
  - **"via {major road}"**
  - badges: Fastest · Shortest · Toll ₹{est} · No tolls
- The selected card's route draws in `brand.neel` 6 dp with casing. The others draw in `route.alt` 4 dp. Tapping a line on the map selects it.
- Footer line: **"ETA without live traffic"** (warning colour) unless a traffic provider is configured.
- **Options:** Avoid tolls · Avoid highways · Avoid ferries.
- **Primary button:** "Start" (Harit, full width).

**Errors**
- Router unreachable: "Couldn't get directions. Showing straight-line distance." The polyline is dashed. Retry.

---

## 7. Navigation screen

**Layout** (portrait):
- **Maneuver banner** (top, `brand.neel` background, white text, 16 dp radius):
  - left: turn glyph, 56 dp
  - centre: distance (`display`) above the instruction (`headline`), max 2 lines
  - right: mute/voice toggle (48 dp)
- **Next-turn strip** under the banner (`surface.paper`, 40 dp): "Then ↱ Right onto VIP Road" when the next maneuver is under 300 m after this one.
- **Lane row** (when lane data exists): lane arrows in white, recommended lanes in full opacity, others at 35%. Shown from 500 m before the maneuver.
- **Map:** follow-heading, pitch 45°, zoom 17 urban / 15 highway (auto by speed). The route ahead is in Neel and the travelled part is greyed.
- **Speed bubble** (bottom-left, 64 dp circle): current speed (GPS). Above it, a speed-limit roundel (red ring) only where OSM `maxspeed` is known. The bubble turns `status.danger` when the limit is exceeded by more than 10%.
- **ETA strip** (bottom sheet locked at Peek, 96 dp):
  - arrival time · remaining time · remaining km
  - buttons: **Overview** (fit route), **Report** (incident sheet), **End** (with confirm)
  - tap the strip to open the steps list at Half

**Landmark-based instructions**
- For each maneuver, find the best anchor within 60 m of the maneuver point, in this priority order:
  1. named junction / circle (`junction=*`/`name`, `highway=traffic_signals` + name, `place=square`)
  2. metro or rail station
  3. major POI with a well-known name (temple, mosque, church, hospital, mall, college, petrol bunk with brand)
  4. bus stop name
- Use a template per language, for example:
  - en: "Turn left **after** Jagadamba Junction"
  - hi: "जगदंबा जंक्शन **के बाद** बाएँ मुड़ें"
  - te: "జగదాంబ జంక్షన్ **దాటిన తర్వాత** ఎడమకు తిరగండి"
- before/after/at is chosen from the anchor's position along the route relative to the maneuver.
- Fall back to the street name, then to a plain direction: "Turn left in 200 m".
- Never use more than one landmark per instruction.

**Voice**
- Prompts at 1 km (highway) or 500 m (urban), at 150 m, and at the maneuver.
- Uses system TTS in the selected language. If that language's TTS voice is missing, fall back to English and show a one-time toast.
- Toggle states: On, Alerts only, Off.

**Rerouting**
- Off-route when more than 40 m from the route for 3 consecutive fixes (or 6 s).
- Banner shows "Finding a new route…" in Kesar. Request a new route from the current position with the current heading.
- Throttle to 1 reroute per 10 s.

**Arrival**
- Within 30 m: the banner shows "You've arrived · {name}" with "Destination on your left/right" from the side-of-street calculation.
- The sheet rises to Half with actions: Save parking spot (on-device) · Rate place · Done.

**Background**
- Android foreground service notification: "Navigating to {name} · {ETA}".
- The screen stays on while navigating, unless the user turns that off.

---

## 8. Saved places
- **Shortcuts:** Home, Work (always first; "Set" if empty), then user lists.
- **Lists:** create, rename, emoji or colour tag from 6 accent swatches, add a note per place. Stored on-device (IndexedDB / Capacitor Preferences). Optional sign-in sync is planned later.
- **Share a list** as a link (encoded place IDs + names). The recipient can open it without an account.
- **Recently viewed:** the last 20 places, auto-pruned after 30 days.

---

## 9. Offline regions screen
- **Entry:** Profile → Offline maps, the Layers sheet, or the dropped-pin action.
- **List:** each region card shows name, size (MB), last updated, status (Ready / Update available / Downloading x% / Error), and actions Update · Rename · Delete.
- **Add region:** the map shows a resizable rectangle with corner handles 48 dp. Live text shows "≈ 38 MB · covers Visakhapatnam city". Download is disabled above 250 MB. A "Wi-Fi only" toggle defaults to on.
- **Storage bar** at the bottom: "Bharat Maps offline data 52 MB · Free on phone 3.1 GB".
- **Content clarity** under the button: "Offline: map, search of places in this area. Directions offline: straight-line estimate only."
- Bundled v0.2 regions (Vizag, Hyderabad) appear as "Included with app" and can't be deleted.

---

## 10. Settings
- **Language** (UI and map labels separately)
- **Units** (km / mi)
- **Theme** (System / Light / Dark)
- **Default travel mode**
- **Voice** (language, volume boost, prompts)
- **Avoid by default** (tolls, highways)
- **Location** (permission status, precise location)
- **Privacy:**
  - clear recents
  - clear history
  - "Coarsen stored locations after 24 h" (on by default)
  - delete all on-device data
- **Offline maps**
- **About and data sources** (OSM, OpenFreeMap/Protomaps, GTFS attributions, Open Charge Map provider attributions)
- **Server URL** (dev builds only)

---

## 11. Accessibility
- **Targets:** ≥ 48 × 48 dp, with ≥ 8 dp between adjacent targets. Map pins are 48 dp hit areas even when drawn at 24 dp.
- **TalkBack:**
  - every control has a role, label and state
  - the sheet announces its detent changes
  - the map canvas exposes "Map. Double-tap and hold to drop a pin. Results list available below."
  - results and pins are mirrored in the list
  - navigation instructions go through an `aria-live="assertive"` region, de-duplicated
- **Custom actions** on place rows: "Directions", "Save".
- **Contrast:** text ≥ 4.5:1, large text and graphics ≥ 3:1 (tokens in §1.2). Route lines have a casing so they read on both basemaps. Information is never conveyed by colour alone: traffic and route-selection states also change line width and pattern.
- **Text scaling:** up to 200% without loss. The banner wraps to 3 lines before shrinking.
- **Reduced motion** (OS setting or in-app):
  - camera `flyTo` becomes `jumpTo`
  - sheet snaps use a 0 ms spring with a 100 ms crossfade
  - no auto-tilt in navigation
  - pulsing puck becomes static
- **Haptics:** a light tick on detent snap and a medium tick 150 m before a maneuver. Can be switched off.
- **Keyboard / switch access:** a logical focus order (search → chips → controls → sheet content), with a visible 3 dp focus ring.

---

## 12. Motion
| Interaction | Duration | Easing |
|---|---|---|
| Chip / button press | 100 ms | `cubic-bezier(0.2, 0, 0, 1)` (standard) |
| Control fade in/out | 120 / 200 ms | linear opacity |
| Sheet snap | spring, stiffness 400, damping 0.85 (≈ 280 ms); fallback 280 ms `cubic-bezier(0.05, 0.7, 0.1, 1)` | emphasised decelerate |
| Sheet content swap | 180 ms crossfade + 8 dp slide | standard |
| Camera to a POI | `flyTo` 600 ms, curve 1.2 | MapLibre default ease |
| Camera fit route | `fitBounds` 800 ms | ease-out |
| 2D ↔ 3D | 500 ms | ease-in-out |
| Reroute banner | 200 ms in, holds, 200 ms out | standard |
| Location puck pulse | 2,000 ms loop, opacity 0.35 → 0 | ease-out (disabled with reduced motion) |

Never animate more than one camera property sequence at once. Cancel any in-flight camera animation when a gesture starts.

---

## 13. Location permission and privacy UX
1. **Pre-permission card:** "Bharat Maps uses your location to show where you are and guide you. It stays on your phone unless you place an order." Actions: Continue / Not now.
2. Request **while-in-use** location (Android `ACCESS_FINE_LOCATION` with coarse fallback). **Background** location is requested only when the user starts navigation with the screen off, and is explained separately.
3. If denied, the app still works. Locate shows a "Location off" state, and search is biased to the selected city.
4. **No account required** except for orders, ratings and sync. Telemetry uses a random install ID, rotated every 30 days, and never contains precise traces. Saved places and recents are never uploaded unless sync is on.

---

## 14. Acceptance checklist (verify phase)
- [ ] Sheet snaps to 3 detents by drag, fling and grabber tap. TalkBack announces each.
- [ ] Pins and route remain visible above the sheet at every detent.
- [ ] Controls are 48 dp, hide at Full, and fade during gestures (not with reduced motion).
- [ ] All 10 chips return results in Vizag and Hyderabad from OSM / own data.
- [ ] Route planner shows ≥ 2 alternatives where the engine returns them, toll badge, and the "without live traffic" label.
- [ ] Navigation: banner, next-turn strip, voice in en/hi/te, reroute in under 10 s, arrival card.
- [ ] A landmark instruction appears for at least 1 maneuver on the Vizag test route (RTC Complex → Jagadamba Junction).
- [ ] Offline regions: size is shown before download, delete frees storage, and bundled regions are protected.
- [ ] Dark mode passes the contrast table. Text scales to 200%.
