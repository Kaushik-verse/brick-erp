package com.brickworks.erp;

import android.content.Context;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

/** Receives the widget figures from the app (WidgetSync.jsx), saves them and redraws the widgets. */
@CapacitorPlugin(name = "WidgetPlugin")
public class WidgetPlugin extends Plugin {

    private static final String TAG = "WidgetPlugin";

    @PluginMethod
    public void syncKpis(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("Must provide data string");
            return;
        }
        JSONObject parsed;
        try {
            parsed = new JSONObject(data);
        } catch (Exception e) {
            call.reject("Invalid JSON data");
            return;
        }
        Context ctx = getContext();
        ctx.getSharedPreferences(WidgetRenderer.PREFS, Context.MODE_PRIVATE).edit().putString(WidgetRenderer.KEY, data).commit();
        try {
            WidgetRenderer.updateAll(ctx, parsed);
        } catch (Exception e) {
            Log.e(TAG, "Widget update failed", e);
        }
        call.resolve();
    }
}
