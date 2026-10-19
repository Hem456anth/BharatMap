# Bharat Map: UI/UX spec v2, place-card service panels

Date: 20 Oct 2026. Extends `docs/re/UI_UX_SPEC.md` §5 (place card anatomy) and keeps its design language (Deccan dusk tokens, type scale, 4 dp grid, 48 dp targets). Research basis: `docs/re/APPLE_MAPS_V2_TEARDOWN.md` §5.4 and §10, `OPPORTUNITIES.md` (D7, D10, D12, D15), `GMAPS_HERE_TEARDOWN.md`. All layout, wording and icons here are original to Bharat Map (clean-room); no Apple, Google or HERE copy or assets.

Goal: one place card that goes **place → service → book/order → track**, and tells the truth at every step about where each value comes from and how fresh it is.

---

## 1. Honesty labels
Every value that is not a plain fact from the map (name, address, OSM tag) carries exactly one label. The label sits next to the value or at the top of its panel when it applies to the whole panel.

| Label | Meaning (must be true) | Example | Visual |
|---|---|---|---|
| **Live** | From a partner or operator feed fetched within its freshness window (default ≤ 2 min for vehicles and departures, ≤ 15 min for stock/availability, ≤ 5 min for charger status). Shows "updated N min ago" on tap or long-press | live charger status from Open Charge Map, rider position in an order | `action.harit` dot + "Live"; text `text.primary` |
| **Scheduled** | From a published timetable or opening-hours data, not from a real-time feed | HMRL GTFS departures, `opening_hours` open/closed | outlined clock glyph + "Scheduled"; `brand.neel` |
| **Estimate** | Computed by Bharat from models or free-flow routing, with no live input | drive time without traffic, two-wheeler on the car graph, walk-to-platform time | existing `status.warning.text` badge style ("Estimate") |
| **Link-out** | The action leaves Bharat Map for a named external site or app; Bharat does not see prices, availability or the result | "Book on <site>", "Open in <app>", IRCTC | arrow-out glyph + destination host shown before leaving |
| **Unavailable** | Bharat has no source for this right now: no integration, no data mapped, or offline. Never hidden silently when the user would expect it (for example departures on a station) | "Live arrivals: Unavailable (no operator feed)" | `text.secondary` + dash glyph |

Rules:
1. Never upgrade a label. If a Live feed goes stale past its window, the value becomes **Unavailable** (or falls back to **Scheduled** if a timetable exists) and the panel says so.
2. **Prices** are shown only when Live from a partner quote or catalogue. Otherwise "Price on <site>" (Link-out). No "approx ₹" unless a documented, labelled Estimate model exists.
3. Two provenance qualifiers sit in the panel footer, not as labels: **Demo** (fictional Shop data: "Demo data — not a real seller") and **Community** (Bharat user reports, existing "Community report, not verified" wording). A Demo panel can never show Live.
4. Colour is never the only signal: every label has a glyph and a word; TalkBack reads "Scheduled: 10:42, Blue line to Raidurg".
5. Labels are translated (`shared/i18n` keys `label_live`, `label_scheduled`, `label_estimate`, `label_linkout`, `label_unavailable`, `prov_demo`, `prov_community`); English fallbacks are allowed but logged.

## 2. Card anatomy with a service panel
Half detent (summary):
1. **Header:** name (`title`), category · locality · distance; **parent chip** when the place is inside a mall, campus, station or market (tap opens the parent card).
2. **Status ribbon** (one line, scrollable chips): open state with label (Scheduled), price band only if mapped, `payment:upi` → "UPI", wheelchair, "Also here: N" when children exist.
3. **Action row:** Directions (primary, Harit) · Call · Save · Share; the 4th slot becomes the panel's **primary service action** (Order, Book, Tickets, Ride, Charge) when one exists, and Share moves to More.
4. **Service panel (compact):** at most 2 rows (next departure, next showtime, charger free count, "Order from here").

Full detent adds, in order:
5. **Service panel (full)**: sections per type (§4).
6. **Good to know:** amenities from OSM tags that are present; nothing invented.
7. **Photos / About** (Wikidata/Commons/Wikipedia, licence + author on each image).
8. **Ratings & reviews** (open provider, source named) or nothing.
9. **Also here** (children: shops, gates, toilets, platforms, parking).
10. **Details:** address + copy, DIGIPIN + copy, phone, website, hours table.
11. **Suggest an edit / Report** (OSM note; for sellers, notify owner).
12. **Provenance footer:** one line per source with label and time ("Departures: HMRL timetable, Scheduled, feed of 03 Jul 2026"; "Map data © OpenStreetMap contributors").

Panel selection: the first matching rule in §4 wins, by OSM tags, then by Bharat's own catalogue (Shop seller id), then by category chip. A place can show one service panel; secondary services go in "More services" at the end of the panel.

## 3. Panel states (all types)
| State | When | What the panel shows | Primary action |
|---|---|---|---|
| **Loading** | fetching a source | skeleton rows matching the final layout (no spinners over the map); 300 ms delay before showing the skeleton; total timeout 8 s | disabled with "Checking…" |
| **Ready** | data present | sections with labels | enabled |
| **Partial** | some sources failed | ready sections + one "Some details unavailable" row naming what failed | enabled for what works |
| **No integration** | Bharat has no partner for this service here | one honest row: "<Service> isn't connected in Bharat Map yet." + best Link-out if a public URL exists (OSM `website`, `reservation:url`, operator site) | Link-out or none |
| **Offline** | no network | cached sections keep their label and add "saved <time>"; Live values become Unavailable; Scheduled timetables bundled on device still work | actions needing network are disabled with "Needs internet"; Directions and Call still work |
| **Error** | source returned an error | "Couldn't load <thing>." + Retry (manual, never automatic loops) | Retry |
| **Stale** | cached value past its window | value greyed + "as of 14:05" + label downgraded per §1 rule 1 | Refresh |

Accessibility for all states: panel is a `region` with a heading; loading uses `aria-busy`; state changes announce once via `aria-live="polite"`; 48 dp targets; works at 1.3× font scale and 360 dp width.

## 4. Service panels by place type
Each entry: **match** (OSM tags or source) → **sections** → **actions** → **labels and sources** → **type-specific states**.

### 4.1 Restaurant / café / sweets / tiffin
- **Match:** `amenity=restaurant|cafe|fast_food|food_court`, `shop=confectionery|pastry`, or a Shop seller with food category.
- **Sections:** Open now (Scheduled); cuisine (`cuisine=*`), diet (`diet:vegetarian`, `diet:vegan`, `diet:jain` when tagged); takeaway/delivery/dine-in from `takeaway`, `delivery`, `outdoor_seating`; payment chips; menu (only from the seller catalogue or a `website:menu` Link-out).
- **Actions:** **Order** (Bharat Shop demo today → ONDC food later), **Reserve** (Link-out to `reservation:url` or website), Call.
- **Labels:** menu prices Live only from a seller catalogue; delivery time is Estimate (distance-based) unless the partner quotes it.
- **No integration:** "Ordering isn't connected for this place." + Call + website Link-out.

### 4.2 Cinema / theatre
- **Match:** `amenity=cinema|theatre`.
- **Sections:** screens (`screen=*` if tagged), facilities (wheelchair, parking, AC), showtimes.
- **Actions:** **Tickets** → Link-out to the operator's site from OSM `website`, or a ticketing partner if one is integrated later.
- **Labels:** showtimes are Unavailable unless a partner feed exists (no scraping); with a partner they are Live.
- **No integration (default):** "Showtimes aren't available in Bharat Map. Check on <host>." (Link-out).

### 4.3 Station / stop (metro, rail, bus, MMTS)
- **Match:** `public_transport=station|stop_position|platform`, `railway=station|halt`, `highway=bus_stop`, or a GTFS stop within 50 m and same name.
- **Sections:** **Departures** with operator/line pills (colour only where the data licence allows; otherwise neutral pills with line names), next 3 per direction: line, headsign, time, platform if in GTFS; service exceptions from `calendar_dates` ("No service today"); entrances/exits (`railway=subway_entrance`), lifts, toilets; first/last train; walking time from you (Estimate).
- **Actions:** Directions to the nearest entrance; **Plan a trip from here**; Tickets → official operator/IRCTC Link-out; Save stop.
- **Labels:** HMRL now = **Scheduled** with "Contains data provided by Hyderabad Metro Rail Ltd."; Live only from GTFS-RT; Indian Railways = Link-out to official enquiry unless an open feed is licensed.
- **States:** Offline: bundled HMRL timetable keeps working (Scheduled). No feed (most bus stops): "Departures: Unavailable for this operator" + nearest routes from OSM `route=bus` relations as plain facts.

### 4.4 Grocery / kirana / supermarket
- **Match:** `shop=supermarket|convenience|greengrocer|kirana(*)|general|dairy`, or a Shop seller.
- **Sections:** Open now; "Order from here" with catalogue search (seller catalogue only); delivery area (seller-defined); payment (`payment:upi`, COD).
- **Actions:** **Order** → existing Shop cart → order → rider tracking; ONDC retail as the real path.
- **Labels:** stock and price Live only from the seller dashboard within 15 min, else "Check with store"; Demo footer for fictional sellers.
- **No integration:** "This store isn't on Bharat Map yet." + Call + "Are you the owner? List your store" (seller onboarding).

(*) `shop=kirana` is not a standard OSM value; match on name/`shop=convenience|general` and the Bharat seller category, never invent tags.

### 4.5 Ride (auto / cab / bike taxi), from any card or a dropped pin
- **Match:** always available as a secondary service; primary on `amenity=taxi` stands and auto stands.
- **Sections:** pickup (your location or this place) and drop; route preview with time (Estimate) and distance; providers list.
- **Actions:** **Ride** → ONDC mobility quote (Live fare when a provider returns one) or **Open in <installed app>** with pickup/drop prefilled through the app's documented links (Link-out). Track: driver position Live from the provider, else the shared live-location link.
- **Labels:** never show a fare unless quoted Live; "Fare shown in <app>" otherwise.
- **No integration:** list only apps that are installed and that publish a deep-link format; if none, "Ride booking isn't connected yet."

### 4.6 Hotel / lodge / guest house / dharamshala
- **Match:** `tourism=hotel|guest_house|hostel|motel|apartment`, `amenity=dharamshala` (if tagged by the community; otherwise `tourism=guest_house` + name).
- **Sections:** stars (`stars=*`) only if tagged; check-in/out if tagged; amenities (`internet_access`, `air_conditioning`, `wheelchair`, parking).
- **Actions:** **Book** → a picker of Link-outs: the hotel's own site (OSM `website`) first, then any integrated partner. Each row names the host. Call.
- **Labels:** room prices and availability Unavailable unless a partner API returns them (Live).
- **No integration:** "Rates aren't shown in Bharat Map." + website Link-out + Call.

### 4.7 Fuel / EV charging
- **Match:** `amenity=fuel`, `amenity=charging_station`.
- **Sections (fuel):** fuels (`fuel:diesel`, `fuel:octane_*`, `fuel:cng`, `fuel:lpg`), brand/operator, 24/7, air/toilets; fuel prices Unavailable (no open feed).
- **Sections (EV):** connectors, power, points, operator (existing EV details), status per connector (Live from OCM when keyed, else Unavailable), payment/app required.
- **Actions:** Directions; **Charge** → operator app Link-out if `website`/network known; Add as a stop to the current route.
- **States:** OCM key missing on the server → status Unavailable with "Live status needs Open Charge Map" in the footer (developer-facing text only in debug builds).

### 4.8 Parking
- **Match:** `amenity=parking|motorcycle_parking|bicycle_parking`.
- **Sections:** type (surface, multi-storey, underground), fee (`fee=*`, `charge=*`), capacity (+ two-wheeler capacity), max stay, access hours (Scheduled), covered.
- **Actions:** Directions; **Pay** → operator Link-out if tagged; "Remember where I parked" (on device).
- **Labels:** free spaces Unavailable unless an operator feed exists (Live).

### 4.9 Pharmacy / clinic / hospital / emergency
- **Match:** `amenity=pharmacy|clinic|doctors|hospital|dentist`, `healthcare=*`, `emergency=yes`.
- **Sections:** Open now with a clear **"24 hours" only when `opening_hours=24/7`**; emergency department (`emergency=yes`); speciality (`healthcare:speciality`); ambulance and 112.
- **Actions:** **Call 112** (dialer intent; user places the call) shown at the top for hospitals with `emergency=yes`; Call; Directions with the fastest mode preselected.
- **Labels:** stock of medicines Unavailable (never inferred); bed availability Unavailable.
- **States:** Offline: Call and 112 always enabled; open state from cached hours labelled Scheduled.
- **Safety copy:** "In an emergency call 112." is fixed text, always visible on emergency-capable cards; no medical advice.

### 4.10 Retail (electronics, clothing, hardware, mobile shops …)
- **Match:** other `shop=*`, or a Shop seller.
- **Sections:** Open now; categories sold (seller catalogue or `shop=*` value); product search within the store (seller catalogue); price comparison only across sellers in Bharat's catalogue, labelled.
- **Actions:** **Order** / Reserve for pickup (Shop flow; ONDC retail later); Call.
- **Labels:** price and stock Live from the seller dashboard within 15 min; Demo footer for fictional sellers.

### 4.11 Courier / post office
- **Match:** `amenity=post_office`, `office=courier`, `shop=courier`.
- **Sections:** services (speed post, parcel, banking if tagged), hours (Scheduled), pincode of the office and its DIGIPIN.
- **Actions:** **Track a parcel** → official tracking page Link-out with the number prefilled only if the operator documents such a URL; Call; Directions.
- **Labels:** delivery estimates Unavailable unless the operator API returns them.

### 4.12 Venue (temple, stadium, park, campus, mall, event hall)
- **Match:** `amenity=place_of_worship`, `leisure=stadium|park`, `amenity=university|college`, `shop=mall`, `amenity=events_venue|community_centre`, or any area polygon with ≥ 5 mapped children.
- **Sections:** gates/entrances (route to a chosen gate), toilets, drinking water, parking, shops inside by category (from children), timings (Scheduled; darshan/opening hours where tagged), dress code or footwear notes only if tagged.
- **Actions:** Directions to a gate; **Events/Tickets** → official Link-out; Save; Download area (offline).
- **Labels:** crowd levels Unavailable (no source); events Link-out only.

## 5. Order and track (shared flow)
1. **Order sheet** (full detent, opened from the panel's primary action): items, quantity, delivery or pickup, address with DIGIPIN, payment (COD; UPI via partner), total with label (Live price from the seller catalogue or Demo).
2. **Confirmation:** order id, seller, ETA (Estimate unless the seller/rider app reports Live), "Track" button.
3. **Tracking card** (persistent mini-card above the sheet and a notification): state timeline (placed → accepted → packed → out for delivery → delivered), rider position (Live with age, via existing SSE), call rider/seller (masked numbers when a partner supports them), cancel within the seller's window, help.
4. **After delivery:** rate the seller (own ratings, moderated), report a problem.
5. **States:** server not configured → the order button reads "Ordering needs a Bharat Map server" (Unavailable); offline → order sheet disabled, existing tracking shows last known state with time.

## 6. Data model notes (for implementers)
- `PlaceRef`: `{ id: "osm:node/123", alt: ["wd:Q…", "gers:…"], name, coord }`; panel cache keyed by `id`.
- `PanelValue`: `{ value, label: "live|scheduled|estimate|linkout|unavailable", source, fetchedAt, freshForSec, provenance: "demo|community|null" }`. The UI renders labels only from this field; components may not hard-code labels.
- Link-outs store `{ host, url, kind }` and show the host before leaving; never open a URL built by string guessing.

## 7. Acceptance checklist
- Every non-map value on every panel has exactly one label from §1 (unit test over panel renderers).
- A Live value older than its window renders as Unavailable or Scheduled (unit test with an injected clock).
- Demo sellers never render Live and always show the Demo footer (E2E).
- Each panel type has screenshots for Loading, Ready, No integration and Offline at 360 dp and 390 dp, light and dark (E2E).
- TalkBack reading order: header → status → actions → panel heading → rows; labels read with values (manual device pass).
- Emergency cards show 112 offline (E2E with network off).
- No price appears without a Live source (grep test on renderers + E2E fixture without prices).
