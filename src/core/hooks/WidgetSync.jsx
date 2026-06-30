import { useEffect, useRef } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { db } from '../db/schema';
import { monthRange } from '../utils/format';

const WidgetPlugin = registerPlugin('WidgetPlugin');

/**
 * Directly query Dexie and push KPIs to the native Android widget.
 * This is NOT a hook — it's a plain async function that talks to the DB
 * directly, bypassing all React lifecycle complexity.
 */
async function syncWidgetData() {
  if (!Capacitor.isNativePlatform()) {
    console.log('[WidgetSync] Not native, skipping');
    return;
  }

  console.log('[WidgetSync] Starting direct DB query...');
  
  const { start: rangeStart, end: rangeEnd } = monthRange();
  console.log('[WidgetSync] Date range:', rangeStart, 'to', rangeEnd);

  try {
    const [sales, purchases, expenses, production, customers, suppliers, finishedStock, customerCollections, supplierPayments] =
      await Promise.all([
        db.salesLog.where('date').between(rangeStart, rangeEnd, true, true).toArray(),
        db.purchaseLog.where('date').between(rangeStart, rangeEnd, true, true).toArray(),
        db.expenses.where('date').between(rangeStart, rangeEnd, true, true).toArray(),
        db.productionLog.where('date').between(rangeStart, rangeEnd, true, true).toArray(),
        db.customers.toArray(),
        db.suppliers.toArray(),
        db.finishedStock.toArray(),
        db.customerCollections.where('date').between(rangeStart, rangeEnd, true, true).toArray(),
        db.supplierPayments.where('date').between(rangeStart, rangeEnd, true, true).toArray(),
      ]);

    const totalSales = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const collectionsTotal = customerCollections.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalCollected = sales.reduce((sum, s) => sum + (s.amountPaid || 0), 0) + collectionsTotal;
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalProduced = production.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalProductionCost = production.reduce((sum, p) => sum + (p.totalCost || 0), 0);
    const receivables = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
    const payables = suppliers.reduce((sum, s) => sum + (s.outstandingBalance || 0), 0);
    const finishedStockValue = finishedStock.reduce((sum, f) => sum + (f.currentStock || 0) * (f.costPrice || 0), 0);

    const cashIn = sales.filter(s => s.paymentChannel === 'cash').reduce((sum, s) => sum + (s.amountPaid || 0), 0)
      + customerCollections.filter(c => c.paymentChannel === 'cash').reduce((sum, c) => sum + (c.amount || 0), 0);
    const cashOut = expenses.filter(e => e.paymentChannel === 'cash').reduce((sum, e) => sum + (e.amount || 0), 0)
      + purchases.filter(p => p.paymentChannel === 'cash').reduce((sum, p) => sum + (p.amountPaid || 0), 0)
      + supplierPayments.filter(p => p.paymentChannel === 'cash').reduce((sum, p) => sum + (p.amount || 0), 0);

    const kpiData = {
      totalSales,
      totalCollected,
      totalPurchases,
      totalExpenses,
      totalProduced,
      totalProductionCost,
      receivables,
      payables,
      finishedStockValue,
      cashIn,
      cashOut,
      netCashPosition: cashIn - cashOut,
      grossMargin: totalSales - totalProductionCost,
      salesCount: sales.length,
      productionRuns: production.length,
    };

    const jsonStr = JSON.stringify(kpiData);
    console.log('[WidgetSync] KPI data:', jsonStr);

    await WidgetPlugin.syncKpis({ data: jsonStr });
    console.log('[WidgetSync] SUCCESS — pushed to native widgets');
  } catch (err) {
    console.error('[WidgetSync] FAILED:', err);
  }
}

/**
 * WidgetSync — invisible React component.
 * Runs the sync on mount and every 60 seconds while the app is open.
 */
export default function WidgetSync() {
  const intervalRef = useRef(null);

  useEffect(() => {
    // Run immediately on mount (with a small delay for DB to be ready)
    const timeout = setTimeout(() => {
      syncWidgetData();
    }, 2000);

    // Then run every 60 seconds while app is open
    intervalRef.current = setInterval(() => {
      syncWidgetData();
    }, 60000);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return null;
}
