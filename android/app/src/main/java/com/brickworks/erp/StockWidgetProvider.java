package com.brickworks.erp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Locale;

public class StockWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String kpisStr = prefs.getString("kpis", "{}");
        JSONObject kpis;
        try {
            kpis = new JSONObject(kpisStr);
        } catch (JSONException e) {
            kpis = new JSONObject();
        }

        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId, kpis);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId, JSONObject kpis) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_stock);

        try {
            double sales = kpis.optDouble("totalSales", 0);
            double produced = kpis.optDouble("totalProduced", 0);
            double receivables = kpis.optDouble("receivables", 0);
            double payables = kpis.optDouble("payables", 0);
            double stock = kpis.optDouble("finishedStockValue", 0);

            NumberFormat format = NumberFormat.getCurrencyInstance(new Locale("en", "IN"));
            format.setMaximumFractionDigits(0);
            
            NumberFormat numFormat = NumberFormat.getNumberInstance(new Locale("en", "IN"));
            numFormat.setMaximumFractionDigits(0);

            views.setTextViewText(R.id.val_sales, format.format(sales));
            views.setTextViewText(R.id.val_produced, numFormat.format(produced));
            views.setTextViewText(R.id.val_receivables, format.format(receivables));
            views.setTextViewText(R.id.val_payables, format.format(payables));
            views.setTextViewText(R.id.val_stock, format.format(stock));

        } catch (Exception e) {
            e.printStackTrace();
        }

        // Tap to open app
        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
