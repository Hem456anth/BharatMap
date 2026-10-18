# Android app (Capacitor 7)

**Status: implemented.** `android/` is a native Android project (Capacitor 7, compileSdk/targetSdk 35, minSdk 23,
package `com.indiamapos.app`). The APK is built by GitHub Actions (`.github/workflows/ci.yml`) on every push to `main`
and attached to a GitHub Release (`v0.2.<run>`).

## What is native
| Capability | How |
|---|---|
| Launcher icon, adaptive icon, splash | `scripts/android-icons.mjs` renders them into `android/app/src/main/res` |
| GPS "near me" | `@capacitor/geolocation` (runtime permission prompt; fine + coarse location in the manifest) |
| Notifications | `@capacitor/local-notifications` + channel "Orders & delivery"; POST_NOTIFICATIONS prompt on Android 13+ |
| Offline maps | Visakhapatnam (z0–15, 4.1 MB) and Hyderabad (z0–14, 9.3 MB) PMTiles + fonts + sprites bundled in the APK |
| Backend | Any Bharat Map server over HTTPS; URL set at build time (`MAPOS_API_BASE`) or in-app ⚙ Settings |
| On-device mode | With no backend configured, the full flow runs locally on fictional demo data (clearly badged) |

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
`ANDROID_KEY_PASSWORD`. CI then also produces `india-mapos-…-release.apk`. Without them CI ships a **debug-signed** APK
(installable by sideloading, not accepted by Play).

## Install the APK
Download it from the GitHub Release on your phone → open → allow "Install unknown apps" for your browser/files app → Install.

## Known limits
- Push while the app is fully closed needs Firebase Cloud Messaging (project + `google-services.json` + server key). Not configured.
- Rider background GPS (foreground service) is not built; rider movement remains simulated along the real road route.
- Offline map labels: English/Hindi via Protomaps flavour; Telugu and other Indic labels fall back to the default OSM name. MapLibre does not shape complex Indic scripts.
- Razorpay Checkout runs inside the WebView; UPI-intent app switching may need the Razorpay Android SDK for best conversion.
