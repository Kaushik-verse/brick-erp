package com.brickworks.erp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Draws both home-screen widgets from the figures the app saved (see WidgetSync.jsx).
 *
 *  - "Today" (2x2):            today's sales, money received, bricks made
 *  - "Factory overview" (4x2): the same three, bricks ready per size, money to collect / to pay
 *
 * Today's figures are only shown on the day they were saved. On a later day the
 * widget shows "—" and asks to open the app, instead of yesterday's numbers.
 */
final class WidgetRenderer {

    private static final String TAG = "WidgetRenderer";
    static final String PREFS = "WidgetData";
    static final String KEY = "kpis";

    private WidgetRenderer() {}

    static JSONObject saved(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            return new JSONObject(prefs.getString(KEY, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /** Redraws every placed widget of both kinds. */
    static void updateAll(Context ctx, JSONObject data) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        for (int id : mgr.getAppWidgetIds(new ComponentName(ctx, TodayWidgetProvider.class))) {
            mgr.updateAppWidget(id, today(ctx, data));
        }
        for (int id : mgr.getAppWidgetIds(new ComponentName(ctx, OverviewWidgetProvider.class))) {
            mgr.updateAppWidget(id, overview(ctx, data));
        }
    }

    static RemoteViews today(Context ctx, JSONObject d) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_today);
        try {
            fillCommon(v, d, "today");
        } catch (Exception e) {
            Log.e(TAG, "today widget", e);
        }
        v.setOnClickPendingIntent(R.id.widget_container, openApp(ctx));
        return v;
    }

    static RemoteViews overview(Context ctx, JSONObject d) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_overview);
        try {
            fillCommon(v, d, "overview");
            JSONObject L = labels(d);
            v.setTextViewText(R.id.lbl_ready, L.optString("ready", "Bricks ready"));
            v.setTextViewText(R.id.val_collect, L.optString("toCollect", "To collect") + "  " + money(d.optDouble("receivables", 0)));
            v.setTextViewText(R.id.val_pay, L.optString("toPay", "To pay") + "  " + money(d.optDouble("payables", 0)));

            int[] chips = {R.id.chip_1, R.id.chip_2, R.id.chip_3};
            JSONArray stock = d.optJSONArray("stock");
            for (int i = 0; i < chips.length; i++) {
                JSONObject s = stock != null ? stock.optJSONObject(i) : null;
                if (s == null) {
                    v.setViewVisibility(chips[i], View.GONE);
                } else {
                    v.setTextViewText(chips[i], s.optString("size") + "  " + count(s.optDouble("qty", 0)));
                    v.setViewVisibility(chips[i], View.VISIBLE);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "overview widget", e);
        }
        v.setOnClickPendingIntent(R.id.widget_container, openApp(ctx));
        return v;
    }

    /** Title, today's three figures, the time line and the low-stock warning. */
    private static void fillCommon(RemoteViews v, JSONObject d, String kind) {
        JSONObject L = labels(d);
        boolean hasData = d.has("date");
        boolean fresh = hasData && todayIso().equals(d.optString("date"));

        v.setTextViewText(R.id.lbl_title, L.optString(kind, "today".equals(kind) ? "Today" : "Factory today"));
        v.setTextViewText(R.id.lbl_sales, L.optString("sales", "Sales"));
        v.setTextViewText(R.id.lbl_received, L.optString("received", "Received"));
        v.setTextViewText(R.id.lbl_bricks, L.optString("bricks", "Bricks made"));

        v.setTextViewText(R.id.val_sales, fresh ? money(d.optDouble("todaySales", 0)) : "—");
        v.setTextViewText(R.id.val_received, fresh ? money(d.optDouble("todayReceived", 0)) : "—");
        v.setTextViewText(R.id.val_bricks, fresh ? count(d.optDouble("todayBricks", 0)) : "—");

        String alert = d.optString("alert", "");
        v.setTextViewText(R.id.val_alert, alert);
        v.setViewVisibility(R.id.val_alert, alert.isEmpty() ? View.GONE : View.VISIBLE);

        String time = !hasData ? "" : fresh ? d.optString("timeText", "") : L.optString("stale", "Open app to update");
        v.setTextViewText(R.id.val_time, time);
        // Each widget has room for only one of the two: the warning wins over the time.
        v.setViewVisibility(R.id.val_time, alert.isEmpty() ? View.VISIBLE : View.GONE);
    }

    private static JSONObject labels(JSONObject d) {
        JSONObject L = d.optJSONObject("labels");
        return L != null ? L : new JSONObject();
    }

    private static PendingIntent openApp(Context ctx) {
        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String todayIso() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static String money(double n) {
        NumberFormat f = NumberFormat.getCurrencyInstance(new Locale("en", "IN"));
        f.setMaximumFractionDigits(0);
        return f.format(Math.round(n));
    }

    private static String count(double n) {
        NumberFormat f = NumberFormat.getNumberInstance(new Locale("en", "IN"));
        f.setMaximumFractionDigits(0);
        return f.format(Math.round(n));
    }
}
