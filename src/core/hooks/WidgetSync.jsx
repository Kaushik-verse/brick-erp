import { useEffect, useRef } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { monthRange } from '../utils/format';
import { computeKpis } from '../db/kpis';
import { onDataChanged } from '../db/schema';

const WidgetPlugin = registerPlugin('WidgetPlugin');

/**
 * Directly query Dexie and push KPIs to the native Android widget.
 * This is NOT a hook — it's a plain async function that talks to the DB
 * directly, bypassing all React lifecycle complexity.
 */
async function syncWidgetData() {
  if (!Capacitor.isNativePlatform()) return;

  const { start: rangeStart, end: rangeEnd } = monthRange();

  try {
    const k = await computeKpis(rangeStart, rangeEnd);
    // Keep the payload shape the native widgets already understand.
    const kpiData = {
      totalSales: k.totalSales,
      totalCollected: k.totalCollected,
      totalPurchases: k.totalPurchases,
      totalExpenses: k.totalExpenses,
      totalProduced: k.totalProduced,
      totalProductionCost: k.totalProductionCost,
      receivables: k.receivables,
      payables: k.payables,
      finishedStockValue: k.finishedStockValue,
      cashIn: k.cashIn,
      cashOut: k.cashOut,
      bankIn: k.bankIn,
      bankOut: k.bankOut,
      netCashPosition: k.netCashPosition,
      grossMargin: k.grossMargin,
      salesCount: k.salesCount,
      productionRuns: k.productionRuns,
    };

    const jsonStr = JSON.stringify(kpiData);

    await WidgetPlugin.syncKpis({ data: jsonStr });

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
    intervalRef.current = setInterval(() => {
      syncWidgetData();
    }, 5 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      clearTimeout(debounce);
      unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return null;
}
