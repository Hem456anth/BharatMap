# India MapOS — Product Requirements Document (v0.1, Oct 2026)

## 1. Vision
One intelligent map that connects **places → businesses → products → transport → delivery** for India.
Where Google Maps answers "where is it?", MapOS answers "who near me has it in stock, at what price, and how fast can it reach me?" — in the user's language, with Indian addresses that actually resolve.

## 2. Problem
- Local commerce in India is discoverable on maps but not *shoppable*: inventory and prices live in WhatsApp, phone calls and walk-ins.
- Indian addresses are landmark-based ("opp. temple, behind bus stand"); geocoders fail, causing failed deliveries and support cost.
- Quick-commerce apps cover dark-store catalogues only; neighbourhood shops, wholesalers and manufacturers are invisible.
- Mobility info (metro, rail, EV charging, tolls, parking) is fragmented across apps.

## 3. Users & jobs-to-be-done
| Persona | Job | Success |
|---|---|---|
| Consumer (Tier 1–3 city) | "Find an LED TV near me, compare, get it today" | Order placed in < 2 min, delivered same day |
| Small retailer / kirana | "Sell my stock to people nearby without building an app" | Listing live in < 10 min, orders with zero commission in pilot |
| Wholesaler / manufacturer | "Find retailers/buyers in my area; quote bulk prices" | Wholesale tier pricing, B2B enquiries |
| Rider / fleet operator | "Get nearby jobs, efficient routes" | Assignment < 30 s, optimised multi-stop routes |
| Commuter | "Nearest metro / EV charger / parking and how to get there" | One-tap directions |

## 4. Scope
### 4.1 MVP (this release) — two cities: Visakhapatnam & Hyderabad
| # | Capability | Requirement | Status |
|---|---|---|---|
| F1 | India-first map | Vector map (OSM), local-language labels where OSM has them, 3D tilt + building extrusion (style), zoom/scale/locate | Implemented |
| F2 | Marketplace | Business profiles (shop, wholesaler, manufacturer, restaurant, service), verified badge, ratings, hours, delivery/pickup flags, catalogue with price, MRP, stock, wholesale tiers | Implemented (demo data) |
| F3 | Killer flow | Search → ranked sellers on map with price markers → product → cart → checkout → rider assignment → live tracking | Implemented |
| F4 | Quick commerce | Nearby inventory, price range, in-stock-first, cheapest sort, size & price filters, local pickup, wholesale purchasing | Implemented |
| F5 | AI assistant | NL intents: product search, supplier discovery, route, mobility, geocode; multilingual; optional LLM rewrite | Implemented (rules) + optional LLM hook |
| F6 | Logistics | Delivery fee rules, bulky handling, vehicle selection, nearest-rider assignment, road routing, multi-stop optimisation API, SSE live tracking | Implemented; rider GPS simulated |
| F7 | Mobility | Metro, rail, bus, airport, EV, parking, toll POIs; live OSM EV/parking via Overpass | Sample data + live OSM; traffic/tolls live = external |
| F8 | Address intelligence | Landmark/relation/locality/pincode/DIGIPIN parsing with confidence and precision; DIGIPIN encode/decode; Nominatim fallback | Implemented |
| F9 | Multilingual | UI in en, hi, te, ta, kn, ml, bn, mr, gu, pa, or; native-script query understanding | Implemented (needs native review) |
| F10 | Accounts & roles | Customer, seller, rider, admin; JWT; seller dashboard (KPIs, price/stock edit, add product); admin verification & fleet | Implemented (rider app = API only) |
| F11 | ONDC | Beckn-shaped `/ondc/search → on_search` catalogue | Prototype (unsigned, not registered) |

### 4.2 Out of scope for MVP
Real payments (UPI/PSP), real rider app with GPS, live traffic, turn-by-turn voice navigation, offline region downloads, seller KYC/GSTIN verification workflow, reviews, returns, native Android build, nationwide coverage.

## 5. Key user flow (killer feature)
1. User opens app → location (GPS or picked) → types "LED TVs near me" / "టీవీ దగ్గర".
2. Results: sellers within radius, ranked by relevance × verified × rating × in-stock − distance; map shows price pins; list shows product, price, MRP/discount, stock, wholesale tier, distance, delivery ETA.
3. Add to cart (single-seller cart) → choose delivery/pickup → drop location via landmark address, pincode, DIGIPIN or draggable pin → quote (subtotal, delivery fee, bulky handling) → payment (COD / UPI simulated).
4. Place order → atomic stock reservation → rider selected by vehicle suitability & distance → road route computed.
5. Live tracking: placed → seller packing → picked up → out for delivery (rider moves along route) → delivered; ETA countdown; seller sees order in dashboard.

## 6. Functional rules
- **Ranking**: `2×match + 0.4×verified + rating/10 + 0.5×inStock − 0.08×km` (relevance); price sort when "cheap/cheapest/budget".
- **Strict category**: if any product matches the category/tag exactly ("tv"), accessories/services that only mention it are excluded.
- **Delivery fee**: free ≥ ₹999; else ₹25 + ₹8/km beyond 2 km. **Bulky handling** ₹299 (TVs ≥ 43" or wholesale quantities). Max delivery radius 25 km.
- **Wholesale**: tier price applies automatically when qty ≥ min wholesale qty.
- **Vehicle policy**: bulky ×5+ → mini-truck/truck; single bulky → mini-truck preferred, 2-wheeler allowed; else bike/EV preferred. Riders > 12 km from pickup are not assigned.
- **Cancellation**: customer may cancel while placed/accepted; stock restored, rider released. Seller may reject in the same window.

## 7. Non-functional requirements
| Area | Target (MVP) | Target (scale) |
|---|---|---|
| Search latency | p95 < 150 ms server | p95 < 200 ms at 5k rps (PostGIS + cache) |
| Availability | 99.5% | 99.9% multi-AZ |
| Security | OWASP ASVS L1 controls | ASVS L2, DPDP Act 2023 compliance, pen-test |
| Accessibility | WCAG 2.1 AA intent (keyboard, labels, contrast, reduced motion) | Audited AA |
| Localisation | 11 languages UI | Product names i18n, voice input |
| Data legality | OSM/ODbL only; no Google/Mappls content stored | Survey of India boundaries in tiles |

## 8. Metrics
Search→order conversion, order→delivered rate, address resolution confidence ≥ 0.8 share, failed-delivery rate, seller activation (listing live within 24 h), median delivery minutes, assistant intent accuracy.

## 9. Rollout
Phase 1 (this): Vizag + Hyderabad pilot, 50–200 onboarded sellers, own riders/3PL. Phase 2: 5–8 metros, ONDC buyer app, Valhalla trucks, PostGIS, real rider app, UPI. Phase 3: nationwide, offline maps, B2B API, tolls & live traffic via licensed feeds. (Details: `RESEARCH.md §5`.)

## 10. Risks
Map boundary compliance (use Survey of India boundaries), OSM data gaps in Tier-3 towns, seller inventory freshness, rider supply, public demo service limits (self-host), regulatory (DPDP, e-commerce rules, FDI marketplace rules).
