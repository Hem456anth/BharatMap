# Android app (Capacitor 7)

**Status: implemented (v0.3).** `android/` is a native Android project (Capacitor 7, compileSdk/targetSdk 35, minSdk 23 —
Android 6.0+, package `com.indiamapos.app`, app name **Bharat Map**). The APK is built by GitHub Actions
(`.github/workflows/ci.yml`) on every push to `main` and attached to a GitHub Release tagged `v0.3.<run>` as
`bharat-map-0.3.<run>-debug.apk` (versionName `0.3.<run>`, versionCode = CI run number).

## What is native
| Capability | How |
|---|---|
| Launcher icon, adaptive icon, splash | `scripts/android-icons.mjs` renders them into `android/app/src/main/res` |
| GPS "near me" + navigation | `@capacitor/geolocation` — one-shot fix for locate, `watchPosition` for follow mode and turn-by-turn (runtime permission prompt) |
| Share a place (v0.3) | `@capacitor/share` → Android share sheet (falls back to Web Share, then copy-to-clipboard) |
| Back button (v0.3) | `@capacitor/app` `backButton` listener: ends navigation → closes dialogs → goes back one panel → lowers the sheet to peek; exits the app only when none apply |
| Voice guidance (v0.3) | `@capacitor-community/text-to-speech` 6.1.0 (the Android WebView has no `speechSynthesis`); speaks en-IN / hi-IN / te-IN using the phone's TTS engine. If the plugin is absent or the language is not installed, the app falls back to Web Speech / on-screen instructions |
| Notifications | `@capacitor/local-notifications` + channel "Orders & delivery"; POST_NOTIFICATIONS prompt on Android 13+ |
| Offline maps | Visakhapatnam (z0–15, 4.1 MB) and Hyderabad (z0–14, 9.3 MB) PMTiles + fonts + sprites bundled in the APK |
| Backend | Any Bharat Map server over HTTPS; URL set at build time (`MAPOS_API_BASE`) or in-app ⚙ Settings |
| On-device mode | With no backend configured, the full flow runs locally on fictional demo data (clearly badged) |

## Permissions (AndroidManifest.xml)
| Permission | Why | When asked |
|---|---|---|
| `INTERNET` | map tiles, places, routing, backend | install-time (normal) |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | locate, directions from you, navigation | runtime prompt on first locate / navigation; the app works without it (search and pick a start point) |
| `POST_NOTIFICATIONS` | order and delivery updates | runtime prompt on Android 13+ when notifications are first used |
| `<queries>` `android.intent.action.TTS_SERVICE` | lets the TTS plugin find the installed speech engine on Android 11+ package visibility | none (not a permission) |

No background-location, camera, microphone or contacts permission is requested. Location is used only while the app is in the foreground.

## Build locally (x86_64 Linux/macOS/Windows with JDK 21 + Android SDK 35)
```bash
npm ci
MAPOS_API_BASE=https://your-api.example.in node scripts/build-www.mjs   # omit for on-device mode
npx cap sync android
cd android && ./gradlew assembleDebug        # → app/build/outputs/apk/debug/app-debug.apk
```

## Release signing (Play Store)
Create a keystore (`keytool -genkeypair -v -keystore release.keystore -alias mapos -keyalg RSA -keysize 2048 -validity 10000`)
and add repository secrets `ANDROID_KEYSTORE_BASE64` (base64 of the file), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`. CI then also produces `bharat-map-0.3.<run>-release.apk`. Without them CI ships a **debug-signed** APK
(installable by sideloading, not accepted by Play).

## Install the APK
1. On the phone, open the repository's **Releases** page (`https://github.com/Hem456anth/BharatMap/releases`) and tap the
   latest `v0.3.<n>` → `bharat-map-0.3.<n>-debug.apk`.
2. Open the downloaded file. Android asks to allow **Install unknown apps** for your browser or Files app — allow it once.
3. Tap **Install**. If an older v0.2 build ("India MapOS") is installed with a different signature, uninstall it first.
4. Open **Bharat Map**, allow location when you tap locate, and allow notifications if you use Shop orders.
5. For voice guidance in Hindi/Telugu, make sure the phone's speech engine has that language (Settings → System →
   Languages → Text-to-speech → Google speech engine → Install voice data).

Sideloading via USB: `adb install -r bharat-map-0.3.<n>-debug.apk`.

## Known limits
- Navigation stops guiding when the app is backgrounded / screen off (no foreground service yet).
- Native plugins are compiled in CI but not covered by automated device/emulator tests.
- Push while the app is fully closed needs Firebase Cloud Messaging (project + `google-services.json` + server key). Not configured.
- Rider background GPS (foreground service) is not built; rider movement remains simulated along the real road route.
- Offline map labels: English/Hindi via Protomaps flavour; Telugu and other Indic labels fall back to the default OSM name. MapLibre does not shape complex Indic scripts.
- Razorpay Checkout runs inside the WebView; UPI-intent app switching may need the Razorpay Android SDK for best conversion.
