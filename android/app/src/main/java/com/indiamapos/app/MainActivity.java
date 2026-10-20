package com.indiamapos.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before the bridge starts.
        registerPlugin(BackgroundNavPlugin.class);
        registerPlugin(ExternalAppPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
