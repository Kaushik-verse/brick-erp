package com.brickworks.erp;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

import org.json.JSONObject;

/** "Today" home-screen widget (2x2). Drawing is in WidgetRenderer. */
public class TodayWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        JSONObject data = WidgetRenderer.saved(ctx);
        for (int id : ids) mgr.updateAppWidget(id, WidgetRenderer.today(ctx, data));
    }
}
