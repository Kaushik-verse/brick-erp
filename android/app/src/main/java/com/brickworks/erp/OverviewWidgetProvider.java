package com.brickworks.erp;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

import org.json.JSONObject;

/** "Factory overview" home-screen widget (4x2). Drawing is in WidgetRenderer. */
public class OverviewWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        JSONObject data = WidgetRenderer.saved(ctx);
        for (int id : ids) mgr.updateAppWidget(id, WidgetRenderer.overview(ctx, data));
    }
}
