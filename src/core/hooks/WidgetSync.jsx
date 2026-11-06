import { useEffect, useRef } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { todayISO } from '../utils/format';
import { computeKpis } from '../db/kpis';
import { db, onDataChanged } from '../db/schema';
import { useLangStore, materialName } from '../i18n';

const WidgetPlugin = registerPlugin('WidgetPlugin');

/** Widget labels follow the app's language (the phone's fonts include Telugu). */
const LABELS = {
  en: {
    today: 'Today', overview: 'Factory today', sales: 'Sales', received: 'Received', bricks: 'Bricks made',
    ready: 'Bricks ready', toCollect: 'To collect', toPay: 'To pay', updated: 'Updated', stale: 'Open app to update',
    low: 'Low stock: {m}',
  },
  te: {
    today: 'ఈరోజు', overview: 'ఈరోజు ఫ్యాక్టరీ', sales: 'అమ్మకాలు', received: 'వచ్చిన డబ్బు', bricks: 'ఇటుకలు',
    ready: 'సిద్ధంగా ఉన్న ఇటుకలు', toCollect: 'రావాలి', toPay: 'ఇవ్వాలి', updated: 'అప్‌డేట్', stale: 'యాప్ తెరవండి',
    low: '{m} తక్కువగా ఉంది',
  },
};

/**
 * Builds what the two home-screen widgets show and hands it to the native side.
 * Everything is TODAY's figures plus what is outstanding right now; the date is
 * sent along so the widget can tell when the numbers are from an earlier day.
 */
async function syncWidgetData() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const today = todayISO();
    const lang = useLangStore.getState().lang === 'te' ? 'te' : 'en';
    const L = LABELS[lang];
    const [k, stock, materials] = await Promise.all([
      computeKpis(today, today),
      db.finishedStock.toArray(),
      db.rawMaterials.toArray(),
    ]);
    const sizes = stock
      .filter((f) => f.isActive !== 0)
      .slice(0, 3)
      .map((f) => ({ size: String(f.brickSize).replace('-inch', '″'), qty: Math.max(0, Math.round(f.currentStock || 0)) }));
    const low = materials.find((m) => m.isActive !== 0 && (m.reorderLevel || 0) > 0 && (m.currentStock || 0) < m.reorderLevel);

    const payload = {
      date: today,
      timeText: `${L.updated} ${new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`,
      todaySales: k.totalSales || 0,
      todayReceived: k.totalCollected || 0,
      todayBricks: k.totalProduced || 0,
      receivables: k.receivables || 0,
      payables: k.payables || 0,
      stock: sizes,
      alert: low ? L.low.replace('{m}', materialName(lang, low.name)) : '',
      labels: L,
    };
    await WidgetPlugin.syncKpis({ data: JSON.stringify(payload) });
  } catch (err) {
    console.error('[WidgetSync] FAILED:', err);
  }
}

/**
 * WidgetSync — invisible React component.
 * Runs on mount, a few seconds after any data change, and every 5 minutes.
 */
export default function WidgetSync() {
  const intervalRef = useRef(null);

  useEffect(() => {
    // Run immediately on mount (with a small delay for DB to be ready)
    const timeout = setTimeout(() => {
      syncWidgetData();
    }, 2000);

    // Refresh a few seconds after any data change, plus a slow safety interval.
    let debounce = null;
    const unsubscribe = onDataChanged(() => {
      clearTimeout(debounce);
      debounce = setTimeout(syncWidgetData, 3000);
    });
    // Switching English / Telugu re-labels the widgets straight away.
    const unsubscribeLang = useLangStore.subscribe(() => syncWidgetData());
    intervalRef.current = setInterval(() => {
      syncWidgetData();
    }, 5 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      clearTimeout(debounce);
      unsubscribe();
      unsubscribeLang();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return null;
}
