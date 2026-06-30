package com.brickworks.erp;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetPlugin")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void syncKpis(PluginCall call) {
        String kpiData = call.getString("data");
        if (kpiData == null) {
            call.reject("Must provide data string");
            return;
        }

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString("kpis", kpiData);
        editor.commit();

        updateWidget(context, SummaryWidgetProvider.class, kpiData);
        updateWidget(context, DashboardWidgetProvider.class, kpiData);
        updateWidget(context, StockWidgetProvider.class, kpiData);

        call.resolve();
    }

    private void updateWidget(Context context, Class<?> widgetClass, String kpiData) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(new ComponentName(context, widgetClass));
        if (ids != null && ids.length > 0) {
            org.json.JSONObject kpis = new org.json.JSONObject();
            try { kpis = new org.json.JSONObject(kpiData); } catch (Exception e) {}

            if (widgetClass == DashboardWidgetProvider.class) {
                for (int id : ids) DashboardWidgetProvider.updateAppWidget(context, appWidgetManager, id, kpis);
            } else if (widgetClass == StockWidgetProvider.class) {
                for (int id : ids) StockWidgetProvider.updateAppWidget(context, appWidgetManager, id, kpis);
            } else if (widgetClass == SummaryWidgetProvider.class) {
                for (int id : ids) SummaryWidgetProvider.updateAppWidget(context, appWidgetManager, id, kpis);
            }
        }
    }
}
