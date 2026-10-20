package com.indiamapos.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Opens a link-out after the in-app interstitial (web/ui/linkout.js).
 *  - https:  ACTION_VIEW + CATEGORY_BROWSABLE, so a verified Android App Link opens the provider's app when installed
 *            and the browser otherwise.
 *  - intent: an intent URL built by shared/services/deeplinks.js (package + declared scheme + https browser_fallback_url),
 *            or a Google Play Store intent (market://details?id=PKG, package com.android.vending, play.google.com fallback).
 *            Parsed with URI_INTENT_SCHEME and hardened like Chrome does (no component, no selector, BROWSABLE only,
 *            package must be in the allow-list); if the app is not installed the https fallback opens instead.
 * Payment schemes (upi:, ppe:, phonepe:, tez:, gpay: …) are refused outright.
 */
@CapacitorPlugin(name = "ExternalApp")
public class ExternalAppPlugin extends Plugin {
    // Must match APPS in shared/services/deeplinks.js for packages with a declared (custom-scheme) entry point,
    // plus the Play Store for store links (scheme market, host details only).
    private static final String PLAY = "com.android.vending";
    private static final Set<String> INTENT_PACKAGES = new HashSet<>(Arrays.asList("com.rapido.passenger", PLAY));
    private static final Set<String> FORBIDDEN = new HashSet<>(Arrays.asList(
        "upi", "upiglobal", "ppe", "phonepe", "paytmmp", "tez", "gpay", "bbps", "bharatconnect", "upimeta", "javascript", "data", "file", "content"));

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url", "");
        JSObject ret = new JSObject();
        try {
            if (url.startsWith("intent:")) {
                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                String pkg = intent.getPackage();
                Uri data = intent.getData();
                String scheme = data != null ? data.getScheme() : null;
                String fallback = intent.getStringExtra("browser_fallback_url");
                if (pkg == null || !INTENT_PACKAGES.contains(pkg) || scheme == null || FORBIDDEN.contains(scheme.toLowerCase())
                        || fallback == null || !fallback.startsWith("https://")) {
                    call.reject("blocked_intent");
                    return;
                }
                if (PLAY.equals(pkg) && (!"market".equals(scheme) || !"details".equals(data.getHost())
                        || data.getQueryParameter("id") == null || !fallback.startsWith("https://play.google.com/store/apps/details?id="))) {
                    call.reject("blocked_intent");
                    return;
                }
                intent.setComponent(null);
                intent.setSelector(null);
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                intent.removeExtra("browser_fallback_url");
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    getActivity().startActivity(intent);
                    ret.put("opened", "app");
                } catch (ActivityNotFoundException e) {
                    view(fallback);
                    ret.put("opened", "fallback");
                }
                call.resolve(ret);
                return;
            }
            if (url.startsWith("https://") || url.startsWith("http://")) {
                view(url);
                ret.put("opened", "view");
                call.resolve(ret);
                return;
            }
            call.reject("blocked_scheme");
        } catch (URISyntaxException e) {
            call.reject("bad_intent");
        } catch (ActivityNotFoundException e) {
            call.reject("no_handler");
        }
    }

    private void view(String url) {
        Intent v = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        v.addCategory(Intent.CATEGORY_BROWSABLE);
        v.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(v);
    }
}
