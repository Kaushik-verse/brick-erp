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
        editor.apply();

        // Broadcast to all widgets to update
        updateWidget(context, SummaryWidgetProvider.class);
        updateWidget(context, DashboardWidgetProvider.class);
        updateWidget(context, StockWidgetProvider.class);

        call.resolve();
    }

    private void updateWidget(Context context, Class<?> widgetClass) {
        Intent intent = new Intent(context, widgetClass);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        int[] ids = AppWidgetManager.getInstance(context)
                .getAppWidgetIds(new ComponentName(context, widgetClass));
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(intent);
    }
}
