package com.brickworks.erp;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

@CapacitorPlugin(name = "WidgetPlugin")
public class WidgetPlugin extends Plugin {

    private static final String TAG = "WidgetPlugin";
    private static final String PREFS_NAME = "WidgetData";
    private static final String KEY_KPIS = "kpis";

    @PluginMethod
    public void syncKpis(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            Log.e(TAG, "syncKpis called with null/empty data");
            call.reject("Must provide data string");
            return;
        }

        Log.d(TAG, "syncKpis received: " + data.substring(0, Math.min(data.length(), 200)));

        // Validate it's valid JSON before saving
        JSONObject kpis;
        try {
            kpis = new JSONObject(data);
        } catch (Exception e) {
            Log.e(TAG, "Invalid JSON received", e);
            call.reject("Invalid JSON data");
            return;
        }

        // Persist to SharedPreferences synchronously
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean saved = prefs.edit().putString(KEY_KPIS, data).commit();
        Log.d(TAG, "SharedPreferences commit result: " + saved);

        // Immediately push to all widget types
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);

        pushToProvider(ctx, mgr, kpis, SummaryWidgetProvider.class);
        pushToProvider(ctx, mgr, kpis, DashboardWidgetProvider.class);
        pushToProvider(ctx, mgr, kpis, StockWidgetProvider.class);

        call.resolve();
    }

    private void pushToProvider(Context ctx, AppWidgetManager mgr, JSONObject kpis, Class<?> cls) {
        try {
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, cls));
            if (ids == null || ids.length == 0) {
                Log.d(TAG, cls.getSimpleName() + ": no widgets placed on homescreen");
                return;
            }
            Log.d(TAG, cls.getSimpleName() + ": updating " + ids.length + " widget(s)");

            for (int id : ids) {
                if (cls == SummaryWidgetProvider.class) {
                    SummaryWidgetProvider.updateAppWidget(ctx, mgr, id, kpis);
                } else if (cls == DashboardWidgetProvider.class) {
                    DashboardWidgetProvider.updateAppWidget(ctx, mgr, id, kpis);
                } else if (cls == StockWidgetProvider.class) {
                    StockWidgetProvider.updateAppWidget(ctx, mgr, id, kpis);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error pushing to " + cls.getSimpleName(), e);
        }
    }
}
