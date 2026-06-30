package com.brickworks.erp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Locale;

public class StockWidgetProvider extends AppWidgetProvider {

    private static final String TAG = "StockWidget";

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        String json = readKpiJson(context);
        for (int id : ids) {
            updateAppWidget(context, mgr, id, parseJson(json));
        }
    }

    static void updateAppWidget(Context ctx, AppWidgetManager mgr, int id, JSONObject kpis) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_stock);
        try {
            NumberFormat cur = NumberFormat.getCurrencyInstance(new Locale("en", "IN"));
            cur.setMaximumFractionDigits(0);

            NumberFormat num = NumberFormat.getNumberInstance(new Locale("en", "IN"));
            num.setMaximumFractionDigits(0);

            double stock    = kpis.optDouble("finishedStockValue", 0);
            double produced = kpis.optDouble("totalProduced", 0);

            views.setTextViewText(R.id.val_stock, cur.format(stock));
            views.setTextViewText(R.id.val_produced, num.format(produced));

            Log.d(TAG, "Updated: stock=" + stock + " produced=" + produced);
        } catch (Exception e) {
            Log.e(TAG, "Error updating widget", e);
        }

        // Tap to open app
        Intent intent = new Intent(ctx, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_container, pi);

        mgr.updateAppWidget(id, views);
    }

    private static String readKpiJson(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        return prefs.getString("kpis", "{}");
    }

    private static JSONObject parseJson(String s) {
        try { return new JSONObject(s); } catch (Exception e) { return new JSONObject(); }
    }
}
