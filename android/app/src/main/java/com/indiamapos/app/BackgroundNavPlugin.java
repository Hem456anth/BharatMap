package com.indiamapos.app;

import android.Manifest;
import android.content.Intent;
import android.location.Location;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Bharat Map background navigation: starts/stops NavLocationService (a foreground service of type "location"
 * with a persistent notification) while turn-by-turn navigation is active, and forwards its fixes to JS as
 * "location" events. ACCESS_BACKGROUND_LOCATION is requested only via requestBackgroundPermission(), which the
 * app calls when the user taps the optional "Allow location all the time" button in Settings.
 */
@CapacitorPlugin(
    name = "BackgroundNav",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "background", strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION })
    }
)
public class BackgroundNavPlugin extends Plugin {
    private static BackgroundNavPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermsCallback");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void locationPermsCallback(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            startService(call);
        } else {
            call.reject("Location permission denied", "location_denied");
        }
    }

    private void startService(PluginCall call) {
        Intent intent = new Intent(getContext(), NavLocationService.class);
        intent.putExtra("title", call.getString("title", "Bharat Map"));
        intent.putExtra("text", call.getString("text", "Navigating"));
        intent.putExtra("intervalMs", call.getInt("intervalMs", 1000));
        try {
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not start navigation service: " + e.getMessage(), "service_failed");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), NavLocationService.class));
        call.resolve();
    }

    @PluginMethod
    public void requestBackgroundPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            JSObject r = new JSObject();
            r.put("background", "granted");
            call.resolve(r);
            return;
        }
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Grant location while using the app first", "foreground_first");
            return;
        }
        requestPermissionForAlias("background", call, "backgroundPermsCallback");
    }

    @PermissionCallback
    private void backgroundPermsCallback(PluginCall call) {
        JSObject r = new JSObject();
        r.put("background", getPermissionState("background").toString());
        call.resolve(r);
    }

    static void emit(Location l) {
        BackgroundNavPlugin p = instance;
        if (p == null || l == null) return;
        JSObject o = new JSObject();
        o.put("latitude", l.getLatitude());
        o.put("longitude", l.getLongitude());
        if (l.hasAccuracy()) o.put("accuracy", (double) l.getAccuracy());
        if (l.hasBearing()) o.put("bearing", (double) l.getBearing());
        if (l.hasSpeed()) o.put("speed", (double) l.getSpeed());
        o.put("time", l.getTime());
        o.put("provider", l.getProvider());
        p.notifyListeners("location", o, true);
    }
}
