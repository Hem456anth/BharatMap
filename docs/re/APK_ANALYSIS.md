# AMap (高德地图) Android APK — static analysis, v17.01.0.2012

Date: 18 Oct 2026 · Method: REA-style observe → understand (https://github.com/morluto/rea), static and read-only.
Companion files: `FEATURE_COMPARISON.md` (section "AMap Global APK findings"), `OPPORTUNITIES.md` (ranked actions for Bharat Map).

## 0. Scope, boundary, legend

**Artifact.** User-supplied file `files/uploads/amap-global-17-01-0-2012-8ba7bfdec515.apk` (194,442,841 bytes, 5,288 zip entries).

**What was done.** Zip listing, file-magic reads (first 8 bytes), `aapt dump badging`, `apktool d -s` (resources and manifest only, no smali), and a small parser that reads class *names* from the dex type tables. Tools: OpenJDK 21, aapt, apktool 2.7.0 (Debian packages).

**What was not done.**
- The app was not run and no AMap server was contacted.
- No code was decompiled into source.
- No obfuscation, encryption, anti-tamper or the proprietary AJX bundle format was opened or bypassed.
- No keys, tokens, certificates or credentials were recorded. Embedded keys exist (manifest `meta-data` entries for map/push/SDK app keys, BKS trust stores and a public-key file in `assets/`), but their values are deliberately not reproduced anywhere.
- No AMap code, images, icons, sounds or text was copied. Identifiers below (package, class, resource and file names) are cited only as evidence. UI strings are paraphrased.
- The `rea-agents` CLI was not tried (time budget). Standard tools were enough for a static pass.

**Legend.**

| Tag | Meaning |
|---|---|
| **[O]** | Observed directly in the APK (manifest, resource, file name, file magic, class name) |
| **[I]** | Inferred from observed names or structure, but not proven (no runtime check) |
| **[U]** | Unknown / could not be determined statically |

**Important caveat on "Global".** The package is `com.autonavi.minimap` and the application label is the Chinese brand name. The native resources ship only Chinese and English. [O] So this APK looks like the single main AMap build, with English/international modes inside it, not a separate international app. [I] Most user-facing UI lives in a 92 MB proprietary script bundle that this analysis did not open (see §3.4). So native resources understate the feature set, and they say nothing reliable about the 15-language claim in `REVERSE_ENGINEERING_REPORT.md` B4. [U]

---

## 1. Package identity [O]

| Field | Value |
|---|---|
| Package | `com.autonavi.minimap` |
| Version | versionName `17.01.0.2012`, versionCode `170100` |
| SDK | minSdk 21 (Android 5.0), targetSdk 35 (Android 15), compileSdk 34 |
| ABIs | `arm64-v8a` only (no 32-bit, no x86) |
| Signing | v1 (JAR: `META-INF/MINIMAP_.SF/.RSA`), v2 block (`0x7109871a`) and v3 block (`0xf05368c0`) all present, plus verity padding. No v3.1/v4 block in the APK. |
| Application class | `com.autonavi.minimap.lite.NewMapApplication` |
| Component factory | `com.amap.bundle.pluginframework.components.AMapComponentFactory` (custom `appComponentFactory`, i.e. its own plugin framework) |
| Launcher/main activity | `com.autonavi.map.activity.NewMapActivity` (singleTask, portrait, handles nearly all config changes itself) |
| Screen | supports small → xlarge, `resizeableActivity=false`, `largeHeap=true` |
| Locales in `resources.arsc` | default (zh), `en`, `zh-CN`, `zh-HK`, `zh-TW` |

### 1.1 Size breakdown [O]

| Part | Files | Compressed in APK | Uncompressed |
|---|---|---|---|
| `assets/` | 523 | 108.3 MB | 116.6 MB |
| `lib/arm64-v8a/*.so` | 72 | 48.7 MB | 121.1 MB |
| `classes*.dex` (8 dex) | 8 | 27.8 MB | 94.7 MB |
| `res/` | 4,557 | 5.0 MB | 7.1 MB |
| `resources.arsc` | 1 | 3.3 MB | 3.3 MB |
| `META-INF/` | 99 | 0.5 MB | 1.2 MB |
| other | 28 | 0.1 MB | 0.3 MB |
| **Total** | 5,288 | **194.4 MB** | **344.3 MB** |

Notes:
- `assets/ajx.bundle/bundles.oajx` alone is 92.3 MB, about 47% of the download. [O]
- `extractNativeLibs=true` means about 121 MB of `.so` is copied out at install, on top of the APK. [O]
- The dex holds **72,804 classes**. [O]
- The APK ships `assets/dexopt/baseline.prof`/`.profm` (ART baseline profile) and `ajx.bundle/baseline2.bin` + `baseline_diff.bin`. [O] The latter suggests a base-plus-diff update scheme for the script bundle. [I]

---

## 2. Manifest

Counts [O]:
- 156 activities, 1 activity-alias, 99 services, 63 receivers, 16 providers
- 124 `uses-permission` entries

### 2.1 Permissions (grouped) [O]

| Group | Permissions (short names) |
|---|---|
| Location | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, **`ACCESS_BACKGROUND_LOCATION`**, `ACCESS_LOCATION_EXTRA_COMMANDS`, `ACCESS_MEDIA_LOCATION`, own `com.autonavi.permission.ACCESS_LOCATION`, Huawei LBS bind, vivo garage-location |
| Foreground services | `FOREGROUND_SERVICE`, `_LOCATION`, `_MICROPHONE`, `_MEDIA_PROJECTION`, `_MEDIA_PLAYBACK`. A malformed entry `Manifest.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION` is also declared (a literal-string bug, harmless). |
| Notifications / alarms | `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `VIBRATE`, OEM badge permissions (Samsung, HTC, Sony, Huawei, vivo, …) |
| Camera / mic / sensors | `CAMERA`, `FLASHLIGHT`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `ACTIVITY_RECOGNITION`, MIUI/vivo/ZUI step-count providers |
| Bluetooth / Wi-Fi | `BLUETOOTH`, `_ADMIN`, `_SCAN`, `_CONNECT`, **`_ADVERTISE`**, `ACCESS/CHANGE_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`, `CHANGE_NETWORK_STATE` |
| Network | `INTERNET`, `ACCESS_NETWORK_STATE` |
| Storage / media | `READ/WRITE_EXTERNAL_STORAGE` (read maxSdk 32), `READ_MEDIA_IMAGES/VIDEO/AUDIO`, `READ_MEDIA_VISUAL_USER_SELECTED`, `MOUNT_UNMOUNT_FILESYSTEMS`, `requestLegacyExternalStorage`/`preserveLegacyExternalStorage` |
| Personal data | `READ_CONTACTS`, `WRITE_CALENDAR` |
| Device / app inventory | **`QUERY_ALL_PACKAGES`**, `com.android.permission.GET_INSTALLED_APPS`, `GET_TASKS`, `REORDER_TASKS`, `READ_LOGS` (signature-level; no effect for a store app), `com.google.android.gms.permission.AD_ID`, OEM device-ID permissions (ASUS MSA supplementary DID) |
| System UI | `SYSTEM_ALERT_WINDOW`, `SYSTEM_OVERLAY_WINDOW`, `WRITE_SETTINGS`, `CHANGE_CONFIGURATION`, launcher shortcut install/uninstall (Google, Huawei, OPPO, HTC, Meizu …) |
| Install / billing | `REQUEST_INSTALL_PACKAGES` (self-update; the `appupgrade` bundle exists), `com.android.vending.BILLING` |
| Battery | `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` |
| Satellite messaging | BeiDou and Tiantong satellite SMS send/receive, Honor satellite business |
| Car / wearables | Huawei HiCar, UCar, Honor Auto car state, vivo car connect, Huawei WearEngine |
| Push | MiPush, OPPO/HeyTap MCS, vivo, Honor push |
| Identity | `cn.cyberidentity.certification.AUTH` (China national online-ID), Huawei account auth |

### 2.2 Components by area [O names, I roles]

| Area | Evidence (component names) |
|---|---|
| Map shell / entry | `NewMapActivity`, `SchemeHandleActivity`, `QuickSplashActivity`, `MagicTextSplashActivity`, `SafeModeActivity`, `CpuArchErrorActivity` (blocks unsupported ABIs) |
| Navigation | `com.autonavi.navigation.service.CarNaviService`, `routecommon.cruise.BackgroundCruiseService` (FGS location; free-drive "cruise" mode), `routecommon.trafficlight.TrafficLightNewService` (FGS location), `ExtraScreenNotifyServiceImpl` (FGS location), `minimap.route.FootNaviService`, `BusRideRemindService`, `immersenavi.AMapImmerseNaviService`, `drive.AutoNaviFloatViewWidgetService` (floating overlay) |
| Location | `amap.bundle.location.AmapLocationSubService` (own `:locationservice` process with 14 components), `perfopt…LocationAliveForegroundService` and `MainAliveForegroundService` (keep-alive FGS) |
| Offline / download | `minimap.offline.KoalaDownloadService`, `assets/common/OfflineDbV6.db` (SQLite), `com.amap.bundle.offline`, `com.autonavi.jni.offlinesdk` |
| Push | Taobao ACCS/Agoo (`ChannelService`, `AgooService`, `TaobaoIntentService`), Xiaomi `XMPushService`, HMS `HmsMsgService`, HeyTap, vivo `CommandClientService`, Honor `HonorPushMessageService`, own `PushAidlService` |
| Car / devices | HiCar/UCar splash and map activities, `UCarMapAppService`, `HicarOperationService`, `HiHonorAutoOperationService`, `carhandoff.AMapCarHandOffCarService`, `amapcartransfer.AMapCarTransferService`, `yunos.carkitservice.CarKitService`, `wearable.AmapLinkService` |
| Family / sharing | `watchfamily.WatchmenService` (FGS location), `sharetrip.SharetripExtraScreenNotifyServiceImpl` (FGS location) |
| Voice / AI | `info.aicall.AiCallKeepAliveService` (FGS microphone), `shenma.speechrecognition.ShenmaRecognitionService`, `AMapMagicTextService` |
| Screen recording | `screenrecorder.api.ScreenRecorderFGService` (FGS mediaProjection) |
| Widgets | 44 components in a `:widgetProvider` process. 32 `desktopwidget_dynamic` providers: commute, real-time bus, taxi, petrol, EV charging, fuel discount, footprint ×5, sport/run/ride, truck, member, rank list, toolbox, plus vivo/Honor/OPPO "HiBoard" card providers |
| Mini-programs / H5 | Alipay Nebula/NebulaX/XRiver/Ariver activities in `:lite1`–`:lite5` processes, UC WebView |
| Payments / login | Alipay SDK, UnionPay, Douyin Pay, WeChat (`wxapi`), QQ, Weibo, DingTalk share, Taobao/Alibaba OAuth, Google Sign-In, Huawei ID |
| Identity / KYC | `com.dtf.face` (face liveness), `alibaba.security.realidentity`, `oshield…IdentityVerifyActivity` |
| Media | Tencent QQ Music player service + process (FGS mediaPlayback) |
| Crash | `autonavi.crash.dumpcrash.DumpCrashService` (`:dumpcrashservice`) |

### 2.3 Foreground-service types [O]
Fourteen services declare `foregroundServiceType`:
- `location` ×11: cruise, traffic light, share-trip, watch-family, desktop widget, two keep-alive services, quick-app channel, extra-screen notify, home notify (which is `location|microphone`)
- `microphone`: AI call
- `mediaProjection`: screen recorder
- `mediaPlayback`: QQ Music ×2

### 2.4 Deep links / intent filters (shapes only) [O]
- Custom schemes:
  - `androidamap://<action>?…` (24 filters). Actions include `navi`, `route`, `poi`, `viewMap`, `myLocation`, `keywordNavi`, `viewGeo`, `viewReGeo`, `viewPOIDetail`, `arroundpoi`, `bus`, `multiPointShow`, `showTraffic`, `indoorMap`, `rootmap`, `openFeature`, `shorturl`, `navi2SpecialDest`, and commerce hosts (hotels, movies, group-buy).
  - Car and quick-app variants: `amapuri`, `amapuriucar`, `amapurihicar`, `amapuricruise`, `amapquickuri`.
  - Others: `navi`, `wechatnav`, `pois`.
- Standard `geo:` scheme.
- `http(s)` links on several `amap.com` subdomains, and an `amap.onelink.me` deep-link domain. Two filters use `autoVerify` (Android App Links).
- **Intercepts for Google Maps URLs**: `maps.google.com`, `ditu.google.cn/.com`, `maps.google.cn`. So the app offers itself when a user taps a Google Maps link. [O]
- Release-hygiene oddities left in the release manifest: a test short-URL domain (`surl.test.…`) and a private RFC-1918 IP literal as an intent-filter host. [O]

### 2.5 Exported components (security-posture note) [O]
**83 components** are `exported="true"` with no manifest-level `android:permission`:

| Kind | Count | Notes |
|---|---|---|
| App-widget receivers | 35 | Expected: widgets must be exported to receive `APPWIDGET_UPDATE` |
| Services with intent filters | 18 | Car, wearable, push, AIDL "AmapService", task transfer |
| Activities with intent filters | 14 | Deep-link entry points, OAuth callbacks |
| Receivers with intent filters | 6 | Push / wake-up |
| Activities without filters | 5 | |
| Services without filters | 1 | |
| Providers | 3 | `HiBoardCardProvider`, `HonorContentProvider`, `OppoContentProvider`: exported with no read/write permission attribute; any caller checks would be in code [U] |
| Activity-alias with filter | 1 | |

This is not a vulnerability finding. Many of these components may check callers at runtime. But it is a large IPC attack surface. [I]

---

## 3. Architecture and tech inventory

### 3.1 Native libraries (arm64, uncompressed size) [O names, I roles]

| Library | Size | Inferred role |
|---|---|---|
| `libamapr.so` | 29.2 MB | Core map engine / renderer (largest; paired with `com.autonavi.jni.ae.*`, `jni.vmap`, `map_assets/` styles and shaders) [I] |
| `libamaptbt.so` | 16.3 MB | Turn-by-turn navigation and route guidance engine (TBT = turn-by-turn) [I] |
| `libamaphorus.so` | 14.9 MB | "Horus" engine with `horusAssets.pack` and `C1TemplateAssets/horuscloudres.pack` (both start with an `AMAP` header). Role unknown: possibly an immersive / 3D lane-level render layer (`immersiverender`, `pnarender` packages) [U/I] |
| `libamaploc.so`, `libloc_base.so`, `liblocation_kit.so`, `libamaplocus.so` | 8.7 + 2.2 + 0.1 + 0.2 MB | Positioning engine: GNSS/Wi-Fi/cell/sensor fusion. Ships on-device models: `assets/loc_model/RF/model0..19.dot` (random-forest trees, text format) and `loc_model/hd/RModel.dot` [O files, I purpose] |
| `libnui.so` | 7.3 MB | Alibaba NUI speech SDK (ASR, wake word). `mandarin/kws.bin` (keyword spotting) and `mandarin/vad` (voice activity detection) [I] |
| `libamaptts.so`, `libGNaviVoice.so` | 3.6 MB | Offline TTS. `assets/tts/languagedata_embedded.bin`, a text front-end in `amaptts/front_asset/` (pinyin, segmentation dictionaries, HMM prosody) [O files] |
| `libOSL_MNN.so` | 2.3 MB | Alibaba MNN on-device inference. Used by `voicesqure/default_voice_ip/*/*.mnn` (encoder/decoder, f0, DDSP-GAN vocoder), i.e. a neural celebrity/custom voice pack [O file names, I use] |
| `libajx.so`, `libajxbiz2.so`, `libyoga.so` | 3.0 + 1.4 + 0.1 MB | AJX3: AMap's own JS-driven native UI runtime with Yoga flexbox layout (`com.autonavi.minimap.ajx3`, 1,386 classes; `raw/workerjs_v8.js` hints at V8) [I] |
| `libamapdsl.so`, `libamap_AGenUI.so` | 3.7 + 1.1 MB | DSL / generated-UI renderer (`com.amap.agenui`, 305 classes; `assets/agenui`) [I] |
| `libmap_kit.so`, `libnavi_kit.so`, `libassembly_kit.so`, `libasset_kit.so` | ~3 MB | Kit layer between the app and the engines [I] |
| `libsgmain*.so`, `libsecuritydefence.so`, `libAPSE_1.1.5.so`, `libappintegrity.so`, `libentryexpro.so`, `libap_sec_store.so`, `libserverkey.so`, `libmpaas_crypto.so` | ~8 MB | Alibaba Security Guard / anti-tamper / app integrity / secure storage. Not inspected (protection) [I] |
| `libopenssl.so`, `libxquic.so`, `libtnet.so`, `libXcdnEngine.so` | 2.1 + 0.6 + 0.4 + 0.8 MB | TLS. XQUIC (Alibaba's open-source QUIC/HTTP3). Taobao "tnet" transport. A CDN/acceleration engine [I] |
| `libALBiometricsJni.so` | 0.7 MB | Face liveness for identity verification [I] |
| `libamapcrash.so`, `libamapcrash_exec.so`, `libamaplog.so` | 0.6 MB | Native crash capture and logging [I] |
| `libmmkv.so`, `libzstd.so`, `libfreetype.so`, `libgif.so`, `libcJSON.so`, `libspeex.so`, `libiksemel.so` | small | MMKV key-value store, zstd (styles are zstd-compressed, see §3.5), FreeType glyph rendering, Speex audio, iksemel XMPP parser [O names] |
| `libpanorama_glues.so` | tiny | Panorama viewer glue (`com.panoramagl`) [I] |
| `libamapml.so`, `libamapvcs.so`, `libamapnsq.so`, `libamaprsq.so`, `libamapbadge.so`, `libamapaccount.so`, `libamapstore.so`, `libamapsync.so`, `libamapkvd.so`, `libamapsharetrip.so`, `libqking2.so`, `libcycloneuc.so`, `libcro_python_kit.so`, `libwukong_native.so`, `libdecode…so` | — | ML, voice control, badges, account, storage, sync, share-trip; several unknown [U] |

### 3.2 Third-party SDKs and frameworks (by package names) [O]
Class counts are from the dex type tables.

| Category | SDKs |
|---|---|
| UI containers / cross-platform | **No Flutter, React Native or Weex** (0 classes each). Uses:<br>• own **AJX3** runtime<br>• Alibaba **DinamicX** server-driven templates (`com.taobao.android.dinamicx`, 1,274 classes; `.dx` assets)<br>• **Alipay mPaaS mini-program containers** (Nebula / NebulaX / Ariver / XRiver)<br>• **UC WebView** core<br>• quick-app runtime (`org.hapjs`) |
| Maps / AR | ARCore (`com.google.ar.core`), Huawei AR Engine (`com.huawei.hiar`), **EasyAR** (`cn.easyar`, 285 classes), PanoramaGL, AR-walk JNI (`com.autonavi.jni.arwalk`) |
| Media | AndroidX Media3 (ExoPlayer, Transformer, Effect; the GLSL shaders in `assets/shaders/` are Media3 effect shaders), ijkplayer (`tv.danmaku.ijk`), Lottie (`com.airbnb.lottie`; about 100 Lottie JSONs in `assets/lottie`), WebRTC (`org.webrtc.mozi`), DingRTC |
| Analytics / IDs / ads | Alibaba UT (`com.ut.mini`), `com.alibaba.analytics`, UTDID (`com.ta.utdid2`), own device ID (`adiu` provider), `alimama` (Alibaba ad network) packages, an overseas-ads service interface, Google `AD_ID`, `com.sijla` (269 classes; unidentified third-party SDK [U]), behavior tracker / impression reporter bundles |
| Push | Taobao ACCS/Agoo, Xiaomi, Huawei HMS, Honor, OPPO HeyTap, vivo |
| Login / pay / share | Alipay, Taobao/Alibaba user SDK, carrier one-tap login (`com.mobile.auth` [I]), WeChat, QQ, Weibo, DingTalk, Douyin pay, UnionPay, Bank of Communications, Google Sign-In / Credentials, Huawei ID |
| Device / health | Huawei Health Kit, Huawei WearEngine, HiCar SDK, UCar, MIUI/vivo step providers, AltBeacon (`org.altbeacon`, BLE beacons) |
| Networking / data | OkHttp3, Taobao ANet / mtop, protobuf, Gson, fastjson, Guava, MMKV, Room, WorkManager, commonmark (Markdown, likely for the AI chat surfaces [I]), zxing + Alipay scan engine (QR) |
| AI | `com.autonavi.bundle.ainative`, `agent_vui`, `com.amap.bundle.vui`; assets `ainative/amaporb`, `ainative/voiceagentglass` [I: voice-agent UI] |
| Security | Alibaba wireless security (`com.alibaba.wireless.security`), `oshield`, Xiaomi XSOF, Honor threat detection |

### 3.3 Modularization [O/I]
- Custom plugin framework (`com.amap.bundle.pluginframework`, `AMapComponentFactory`). [O]
- About 250 feature "bundles" under `com.amap.bundle.*` and `com.autonavi.bundle.*`. Examples: `amaphome`, `searchservice`, `drive`, `routecommon`, `route`, `routecommute`, `vui`, `ainative`, `planhome`, `basemap`, `wearable`, `pna`, `immersiverender`, `account`, `audio`, `watchfamily`, `perfopt`, `offline`, `desktopwidget`, `screenrecorder`, `sharetrip`, `publictransport`, `footnavi`, `ridenavi`, `busnavi`, `trafficevent`, `feedback`, `ugc`, `scenicarea`, `tourvideo`, `weather`, `favorites`, `cloudsync`. [O]
- Multi-process layout: main (220 components), `:widgetProvider` (44), `:locationservice` (14), `:lite1`–`:lite5` (9 each, mini-programs), `:pushservice` (4), `:QQPlayerProcess` (4), `:dumpcrashservice`. [O]
- **No Play Feature Delivery**: single APK, no `com.google.android.play.core` classes, no split configs. The dynamic parts are the script bundles (AJX/DinamicX/mini-programs) and cloud resource packs (`cloudres`, `cloudconfig`, `config/default_config.json`). [O] Server-driven feature delivery happens through these. [I]

### 3.4 The AJX bundle [O/U]
`assets/ajx.bundle/bundles.oajx` is 92.3 MB of a proprietary container with a short text header, plus a `baseline2.bin` and `baseline_diff.bin`. The native `res/` has 904 layouts. Names such as `ajx_car_navi_layout`, `ajx_route_car_result_map_page`, `page_ajx3_loading` show that the main pages (route results, navigation, search results) are hosts for AJX views. [O] The real screen inventory and most strings are inside the bundle, which this analysis deliberately did not unpack. [U]

### 3.5 Asset types (listing + magic only) [O]

| Asset | Format evidence | Meaning |
|---|---|---|
| `map_assets/style_*` | zstd frames (`28 b5 2f fd`) | Map style sheets, versioned with timestamps in the file name. Families:<br>• `MainStd` Std D/N (standard day/night)<br>• `MainPub` (public-transport style) D/N<br>• `DrvNavS` D/N (a dedicated **driving-navigation style** for day and night)<br>• `m31/m32 Uni` variants<br>• `sh`/`sl`/`_l`/`_m` suffixes (size/LOD variants [I]) |
| `map_assets/icons_*` | zstd | Icon atlases by category ID |
| `map_assets/laneprofile_{low,mid,travel}`, `mapprofile_*`, `usertraceprofile_*`, `mapfeatureprofile_*` | zstd | Device-tier rendering profiles (low/mid) and lane-level render profiles [I] |
| `map_assets/3d_sky_*`, `bktile*`, `lineround` | PNG / PVR3 textures | Sky boxes and background tiles for 3D/navigation (day/night) |
| `map_assets/anscii.fnt` + PNG | BMFont | Bitmap font for on-map numerals [I] |
| `navi/*.bin`, `navi/zh-Hans/*` | proprietary header `74 9e 33 01` | Guidance config per mode: car common, lane navigation, lane sound, bus, walk, bike, e-bike, sports run/walk/bike, indoor run, road; custom voice scripts for walk/ride/bus/e-bike; a 1 MB cloud base config |
| `tts/`, `amaptts/` | binary + UTF-8 dictionaries | Embedded offline TTS (Mandarin front-end) |
| `voicesqure/default_voice_ip/*.mnn` | MNN models | Neural voice pack |
| `loc_model/` | text decision trees | On-device location classification |
| `vmap/default_gps_model.zip`, `vmap_business_*_sprite.png` | zip, PNG | GPS model; favourites sprites (light/dark) |
| `common/OfflineDbV6.db` | SQLite | Offline data catalogue [I] |
| `font/` | TrueType | Custom numeric face for distances/speeds (`AmapNumber` Medium/Bold), Alibaba Sans variants, a Eurostile oblique (speed display [I]); `tinyfont/iconfont.ttf` and `h5iconfont/*.ttf` are icon fonts |
| `lottie/` (permission, loading, slide, flip, shake, bus navigation) | JSON | Onboarding / permission-guide and gesture-hint animations |
| `res/raw/` | MP3/OGG/WAV | Navigation earcons by event: reroute, camera, overspeed, off-route (`navi_yaw`), traffic event, front traffic light, intersection alert, radar, route exit, voice wake rings |
| `C1TemplateAssets/`, `horusAssets/` | `AMAP` header | Proprietary packs [U] |

---

## 4. UI / UX structure from resources

### 4.1 Screens and layout families [O]
- 904 layouts in `layout/`, plus `layout-v22` (72), `layout-w600dp-v13` (12 tablet/foldable variants) and `layout-v21` (4).
- Prefix families: `view_` (83), `au_` (83, a design-system component kit: search bar, permission dialogs, protocol view [I]), `layout_` (62), `card_` (57, launcher widget cards with OEM-specific variants for Honor/vivo/Xiaomi), `map_` (31: compass, zoom, scale, zoom-in/out tips, nearby search, route traffic, recommend tags), `h5_` (27), `search_` (15), `drive_` (16), `traffic_` (8), `poi_` (4), `navi_` (4), `route_` (4).
- Key screens inferred from names:
  - **Home**: `maphome_searchbar(_v2)`, `amaphome_searchpage_preloadview`, toolbox card
  - **Search / suggest**: `search_sugg_*`, `search_history_*`, `search_no_history_tip_*` (separate empty state for real-time bus), `search_listview_error_and_city_suggest_header` (did-you-mean + city suggestion), `drive_search_*` (search during driving, voice window), `search_menu_filter_text` (filter menu)
  - **POI detail**: `v4_poi_detail`, `poi_detail_sliding_view_layout` (sliding sheet), `layout_poi_detail_native_view`, `poi_photo_update_success_fragment`, `elipsized_child_poi_layout` (child POIs such as gates)
  - **Point picking**: `fragment_map_select_point`, `fragment_map_select_fixpoint`, `choose_fixpoint_*`, `map_select_point_mapinteractive_layout`
  - **Route**: `ajx_route_car_result_map_page`, `layout_route_preference_widget`, `layout_route_tips`, `layout_path_recommend`, `route_loading_view`, `clip_board_in_route_alert_view` (offers a route to an address found in the clipboard)
  - **Navigation**: `ajx_car_navi_layout`, `ajx_foot_navi_layout`, `ajx_ride_navi_layout`, `drive_navi_type_choose_*` (vehicle-type chooser), disclaimers `navi_declare`, `navi_truck_declare`, `navi_motorbike_declare`, `navi_energy_declare`, `share_bike_tip_in_navi_layout`, `navigation_tts_mic_animation_view`
  - **Voice packs**: `navigation_voice_list_fragment`, `navigation_voice_record_fragment` (record your own voice pack [I])
  - **Traffic UGC**: `traffic_report_submit_fragment`, `traffic_report_img_and_poi`, `traffic_report_pic_item`, `item_traffic_report_toggle_label`, `traffic_report_result_dialog`, `layout_traffic_event_{loading,error,expired}`
  - **Transit UGC**: `ugc_bus_navi_review_layout` (rate a bus journey)
  - **Privacy / permission**: `privacy_permission_page`, `layout_permission_page`, `au_permission_protocol_view`, `au_permission_bottom_dialog`, `scene_permission_guide`, `permission_guide_bottom_float`, `tiny_permission_dialog` (mini-program scoped permissions)
  - **Widgets**: `route_commute_widget_layout_v2`, `vivo_routecommute_{bus,drive,taxi}_widget_*`, `toolbox_widget_layout`

### 4.2 Locales, dark mode, form factors [O]
- **Locales**: `values` (zh), `values-en`, `values-zh-rCN`, `values-zh-rHK`, `values-zh-rTW`. String counts: 9,827 default, 8,400 en, 8,209 HK, 8,163 TW. English is about 85% of the default set at the native layer.
- **Dark mode**: `values-night` and `values-night-v29` exist, but override only **68 colours of 1,332**; 91 night drawables. So native dark theming is thin. The map has its own day/night styles (`_D_`/`_N_`), and navigation has its own day/night style plus a day/night mode setting (string names `mode_day_night`, `navi_daynightmode_selection`).
- **Width buckets**: `values-sw340/360/390/411/600/800/933dp` and `h566dp`, so dimensions are tuned for the common Android phone widths.

### 4.3 Design signals [O]
- **Motion**: 104 view animations and 6 animators.

  | Duration | Uses |
  |---|---|
  | 300 ms (dominant) | 49 |
  | 200 ms | 21 |
  | 500 ms | 12 |
  | 350 ms | 8 |
  | 250 ms | 6 |

  Interpolators: platform accelerate / linear / decelerate, and a "fast-out-extra-slow-in" curve used for fragment transitions (8). Anticipate/overshoot only for photo preview.
- **Dimensions**: 1,862 dimens.
- **Typography**: a stepped text-size ramp of roughly 10, 12, 13, 14, 16, 17.3, 18.7, 20, 21.3, 22.6, 24, 26.7, 28, 31, 32 sp. The fractional values suggest it was converted from a px-based design at a 1.33 ratio. [I]
- **Numerals**: dedicated numeric fonts (`AmapNumber` Medium/Bold) for distances, speeds and ETAs.

### 4.4 Accessibility [O]
- 239 `contentDescription` attributes across 904 layouts. 786 layouts have none, against about 1,500 `ImageView`/`ImageButton` elements, so about 16% of image views are labelled at most.
- 7 `importantForAccessibility="no"`.
- String names show an accessibility tip in broadcast/voice settings, and a **barrier-free contribution** flow (photo, wheelchair-access questions).
- No evidence of systematic TalkBack hints at the native layer. AJX views are unknown. [U]

### 4.5 Feature themes from English string resources [O names; paraphrased]
Counts are English strings whose text matches a keyword. They are indicative only. Many string names are obfuscated `O<id>_<n>` keys.

| Theme | ≈ strings | Evidence (resource names) |
|---|---|---|
| Route planning | 251 | `O105240_dx_route`, `route_*` (398 names prefixed `route`) |
| Transit / bus / subway | 182 | `bus*`, `busline_*`, `O105229_*` |
| Report / feedback | 155 | `feedback_*` (136), `O105240_dx_feedback`, `feedback_road_unreached` |
| Search | 123 | `O105240_dx_nearby_search`, `O105240_dx_no_result_modify_condition` |
| Traffic | 123 | `traffic_*` (154 names) |
| Offline maps | 119 | `offline_*` (87), `O105246_*` |
| Walking navigation | 114 | `foot_*` (140 names), `onfoot_declare_msg` |
| Reviews / ratings | 69 | `O105240_dx_rating`, `comment` package |
| Cycling / e-bike | 69 | `ride_*`, `sharebike_*`, `elebike_config` |
| Favourites | 64 | `add_favorites_failed`, `fav_*`, `Title_save` |
| Privacy / consent | 46 | `permission_*` (72 names), `action_authorize` |
| Running / sports | 43 | `running_*`, sport widgets |
| Toll / ETC | 42 | `alipay_etc_free_tip`, `O475_62` |
| Ride-hailing / taxi | 39 | `taxi_*` (184 names) |
| Truck | 38 | `autonavi_truck_online_prompt`, `action_log_type_truck` |
| Speed cameras ("e-dog") | 36 | `edog_*` (33 names), `raw/edog_dingdong`, `raw/speedover` |
| Indoor maps | 26 | `button_text_indoormap`, `indoor2d_*` |
| EV charging | 26 | `charge`, `desktopwidget_dynamic_widget_charge_station` |
| Voice packs | 25 | `O539_*`, `voice_*` |
| Commute | 20 | `commute_no_usual_way_detail`, `bus_commute_distance_long_toast` |
| Real-time bus | 20 | `O105229_real_time_bus_widget_title`, `bus_real_time_around_tips_top` |
| Lane guidance | 18 | `broadcast_setting_details_tip`, `navi/zh-Hans/lane_*` |
| Fuel / petrol | 15 | fuel-discount widget strings |
| Parking | 13 | `O105240_dx_parking_total_num_slots`, `car_scene_parking` |
| Motorbike | 10 | `autonavi_motorbike_online_prompt`, `action_log_type_motor` |
| Footprint (places-visited log) | 10 | `desktopwidget_dynamic_footprint_*` |
| Weather | 7 | `weather_effect_switch` (weather effects on the map) |
| Hotel / tickets | 3–7 | `hotel_order_title`, `flights_order_title` |
| Group location sharing | 7 | `agroup_*` (team join, team status) |
| AR walking | 4 | camera-permission rationale and on-foot disclaimer strings; `arwalk` packages |
| Translation | (AI call only) | no general translation feature at the native layer [U] |

---

## 5. Flows inferred

| Flow | Steps | Evidence |
|---|---|---|
| **Home → search** | Home map with floating search bar and toolbox. Tap → search page, preloaded for speed → history and suggestions → result list with did-you-mean and city suggestions | [O] `maphome_searchbar`, `amaphome_searchpage_preloadview`, `search_sugg_*`, `search_history_*`, `search_listview_error_and_city_suggest_header` |
| **Result → POI detail** | Sliding detail sheet, child POIs (gates, entrances), photo upload, ratings, nearby actions | [O] `poi_detail_sliding_view_layout`, `v4_poi_detail`, `elipsized_child_poi_layout`, `poi_photo_update_success_fragment`; [I] ordering |
| **Route planning** | Choose mode (car / truck / motorbike / e-bike / walk / bus / taxi), preference widget (avoid tolls, highways etc. [I]), route tips, recommended path, traffic on route | [O] `drive_navi_type_choose_*`, `layout_route_preference_widget`, `layout_path_recommend`, `map_widget_route_traffic_layout` |
| **Pre-navigation** | A mode-specific disclaimer is shown before truck, motorbike, EV and walking navigation | [O] `navi_*_declare`, `onfoot_declare_msg*` |
| **Navigation** | Mode-specific nav page, voice with earcons, lane guidance, speed cameras and overspeed, traffic-light alerts, off-route → reroute, floating overlay when backgrounded, foreground service keeps location alive | [O] `ajx_*_navi_layout`, `raw/*`, `navi/zh-Hans/lane_*`, FGS list §2.3; [I] runtime order |
| **Arrival** | End-of-trip handling (parking, journey review for bus) | [I] `car_scene_parking`, `ugc_bus_navi_review_layout`; [U] exact arrival card |
| **Offline map download** | City catalogue (bundled SQLite) → download service → offline data used by search/route | [O] `OfflineDbV6.db`, `KoalaDownloadService`, `offline_*` strings; [I] flow |
| **Privacy / permission gating** | First-run privacy protocol page; scene-specific permission guides (location, camera for AR, mic for voice) with Lottie illustrations; bottom-float reminder when a permission is missing; separate scoped permission dialogs for mini-programs | [O] `privacy_permission_page`, `au_permission_protocol_view`, `scene_permission_guide`, `permission_guide_bottom_float`, `lottie/permission/*`, `tiny_permission_dialog`; [I] that the privacy page gates first use |
| **Crowd reporting** | Report a traffic event with photo + POI + labels → result dialog; event cards can be loading / error / expired | [O] `traffic_report_*`, `layout_traffic_event_*` |
| **Widgets** | Commute ETA, real-time bus and toolbox on the home screen; launcher shortcuts | [O] widget providers, shortcut permissions |

---

## 6. Privacy / security posture

| Item | Finding |
|---|---|
| Background location | `ACCESS_BACKGROUND_LOCATION` is declared, with 11 location-type foreground services, 2 of them generic "keep-alive" services. Battery-optimisation exemption is requested, plus boot-completed and exact-alarm permissions. [O] Location can persist well beyond active navigation (cruise mode, family watch, widgets, share-trip). [I] |
| Tracking / ad SDKs | Alibaba UT analytics, UTDID, own ADIU device ID, Alimama ad packages, Google AD_ID, an overseas ads service interface, the unidentified `com.sijla` SDK, behaviour tracker and impression reporter, a full-link tracker. `QUERY_ALL_PACKAGES` + `GET_INSTALLED_APPS` allow installed-app inventory. AltBeacon and `BLUETOOTH_SCAN/ADVERTISE` allow proximity sensing. [O] |
| Cleartext traffic | `network_security_config` sets `base-config cleartextTrafficPermitted="true"` globally, with no domain-specific restriction seen. [O] |
| Certificate pinning | Not visible in `network_security_config` (no pin-set). BKS trust stores ship in assets for HMS. Any pinning would be in code. [U] |
| Debuggable | Not debuggable (no `android:debuggable`). [O] |
| Backup | `allowBackup="false"`. [O] |
| Other flags | `usesNonSdkApi="true"`, `requestLegacyExternalStorage`, `allowNativeHeapPointerTagging="false"` (opts out of an Android memory-safety mitigation). [O] |
| Exported components | 83 exported with no manifest permission (see §2.5), including 3 content providers with no read/write permission attributes. [O] |
| Release hygiene | A test domain and a private IP host remain in release intent filters. A Google Maps URL interception is declared. [O] |
| Sensitive permissions | Contacts, calendar write, microphone (with an always-on AI-call FGS), camera, activity recognition, screen capture, install packages, overlay window. [O] |
| Identity | Face liveness and national-ID SDKs for KYC flows (payments / ride-hailing). [O names, I purpose] |
| Embedded secrets | App keys and SDK identifiers exist in manifest metadata and assets. Values not recorded by policy. [O existence] |

---

## 7. What could not be determined
- Anything inside `ajx.bundle/bundles.oajx` (most page layouts, flows, copy, multi-language strings), `horus*`/`C1TemplateAssets` packs and the `navi/*.bin` formats. These are proprietary or opaque and were deliberately not decoded.
- Runtime behaviour: real flow order, which permissions are requested when, the actual network endpoints, the data sent to analytics, and whether background location is used outside user-started features.
- Whether the "international" experience differs in code paths or only in resources.
- The identity of the `com.sijla` SDK and several native libs (§3.1 [U] rows).
- Certificate pinning and runtime caller checks on exported components.

---

## 8. Takeaways for Bharat Map (detail in `OPPORTUNITIES.md`)
1. **Size**: AMap is a 194 MB arm64-only super-app (≈ 344 MB unpacked, plus 121 MB of extracted libs). Bharat's 29 MB APK is a competitive asset. Hold a budget and move optional regions and fonts out of the base APK.
2. **Navigation craft is in the data and the small details**, not only the engine:
   - per-mode guidance configs
   - a separate driving-navigation map style for day and night
   - numeric fonts
   - an earcon for each event
   - disclaimers before each mode
   - lane and sound configs
   Most of these have open equivalents.
3. **Permission UX is a first-class surface** in AMap: scene-specific guides, a bottom reminder, and a protocol page. Bharat can match the clarity while asking for far less.
4. **Crowd feedback is a big surface** (feedback, traffic reports, barrier-free contributions, bus-journey reviews). For an OSM-based app this is the cheapest route to accuracy.
5. **Bharat can lead on privacy and accessibility.** AMap ships global cleartext, background location, an installed-app inventory, several trackers, and image views that are about 16% labelled.
