# Android Auto — feasibility (stub, nothing shipped)

Date: 20 Oct 2026. Status: **research only. No Android Auto code is in the app and none should ship until it has been tested
in the Desktop Head Unit (DHU) and in a car.** Evidence: CoMaps manifest + public source (`docs/re/COMAPS_TEARDOWN.md` §2.9, §7)
and the Android for Cars App Library documentation (developer.android.com/training/cars).

## What a navigation app on Android Auto needs (observed in CoMaps)
| Requirement | CoMaps [A/S] | Bharat Map today |
|---|---|---|
| `CarAppService` with category `androidx.car.app.category.NAVIGATION`, intent `NAVIGATE` on `geo:` | ✅ | — |
| Permissions `androidx.car.app.ACCESS_SURFACE`, `androidx.car.app.NAVIGATION_TEMPLATES` | ✅ | — |
| `automotive_app_desc.xml` (`<uses name="template"/>`), `minCarApiLevel` meta-data | ✅ (level 5) | — |
| A map drawn natively into the car `Surface` (`SurfaceCallback` → renderer) | ✅ own C++ renderer (`car/renderer/SurfaceRenderer`) | ❌ map is MapLibre GL **JS** in a WebView, which cannot render into a car surface |
| Screens built only from car templates (NavigationTemplate, MapWithContent, PlaceList, Search, Message) | ✅ ~25 screens | ❌ |
| Turn-by-turn state (maneuver, distance, ETA, lanes) pushed to the car (`NavigationManager.updateTrip`) | ✅ | 🟡 computed in JS (`web/nav/*`); not exposed natively |
| Foreground location service while navigating | ✅ | ✅ `BackgroundNav` service (v0.4) |

## Options
1. **MapLibre Native Android on the car surface (recommended if pursued).** Add `org.maplibre.gl:android-sdk` (BSD-2) only for
   the car screen; reuse the same style JSON and the downloaded PMTiles via a local tile server or MapLibre's `pmtiles://`
   support (to be verified on Native). A Capacitor plugin (`CarBridge`) receives route geometry and the current maneuver from
   `web/nav/navigation.js` and forwards them to `NavigationManager`. Effort **L** (3–5 weeks) + Google review.
2. **Templates without a map** (PlaceList / Message only). Not allowed for the navigation category; would be rejected. ✗
3. **Fork CoMaps' car module.** Apache-2.0 permits it, but it is bound to CoMaps' `Framework` C++ API; porting means replacing
   every engine call. Not worth it compared with option 1.

## Risks and costs
- Google Play "Android Auto navigation app" review (driver-distraction rules, template limits, no keyboard while driving).
- APK grows by MapLibre Native (~10 MB per ABI, estimate — measure before deciding; conflicts with the 30–40 MB goal unless
  shipped as a dynamic feature module).
- Two renderers to keep visually consistent (web + native).

## Exit criteria before shipping anything
DHU run of: start navigation from the phone → car shows map + next maneuver + ETA; reroute; arrival; app killed on phone →
car session ends cleanly; night mode; no crash for 30 min. Then a real-car test. Until then this document is the deliverable.
