# "Apple Maps" APK check (Oct 20 2026)

Input: files/uploads/_Apple_Maps_16160807-14b672508e81.apk (33.2 MB). Static, read-only inspection; nothing executed.

## Findings (observed)
- Package `com.wAppleMaps_16160807`, versionName 1.0. This is not Apple's app; Apple publishes no Apple Maps app for Android.
- Built with AppsGeyser, a no-code WebView app generator: res/raw/configuration.xml (`<webWidget>`, widget id 16160807) and AppsGeyser endpoints in classes2.dex.
- Its only content tab loads a DuckDuckGo Maps search URL (duckduckgo.com/?...&iaxm=maps) inside a WebView. DuckDuckGo's map view is rendered by Apple MapKit JS on DuckDuckGo's site.
- Its 6 dex files contain no Apple Maps or MapKit code (0 matches for maps.apple.com / MapKit).
- Bundled ad and tracking SDKs: Pangle, AppLovin, ironSource, AdMob, Meta Audience, Criteo, Amazon, AdColony, BidMachine and OneSignal; full-screen and on-exit interstitials are enabled.
- Permissions include INSTALL_PACKAGES, SYSTEM_ALERT_WINDOW, CAMERA, NFC, Bluetooth, DUMP and RECEIVE_BOOT_COMPLETED, far beyond what a web-map wrapper needs. Do not install it on a personal device.

## Conclusion
The APK offers no Apple Maps engineering evidence. Legitimate Apple Maps sources are the maps.apple.com web app (observed behaviour), Apple's public MapKit / MapKit JS / Apple Maps Server API docs, and Apple's published feature pages. Bharat Map's earlier v0.3 teardown (docs/re/) already used public behaviour and documentation.
