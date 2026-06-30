import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { calculateAgingDays } from '../db/ledgerEngine';
import { registerPlugin, Capacitor } from '@capacitor/core';

const WidgetPlugin = registerPlugin('WidgetPlugin');

/** All customers, sorted by name. */
export function useCustomers() {
  return useLiveQuery(() => db.customers.orderBy('name').toArray(), [], []);
}

/** All suppliers, sorted by name. */
export function useSuppliers() {
  return useLiveQuery(() => db.suppliers.orderBy('name').toArray(), [], []);
}

/** Live raw material inventory. */
export function useRawMaterials() {
  return useLiveQuery(() => db.rawMaterials.toArray(), [], []);
}

/** Live finished brick stock (4", 8", 9"). */
export function useFinishedStock() {
  return useLiveQuery(() => db.finishedStock.toArray(), [], []);
}

/** Production log, most recent first, optionally limited. */
export function useProductionLog(limit = 50) {
  return useLiveQuery(
    () => db.productionLog.orderBy('createdAt').reverse().limit(limit).toArray(),
    [limit],
    []
  );
}

/** Sales log, most recent first, optionally limited. */
export function useSalesLog(limit = 100) {
  return useLiveQuery(
    () => db.salesLog.orderBy('createdAt').reverse().limit(limit).toArray(),
    [limit],
    []
  );
}

/** Purchase log, most recent first, optionally limited. */
export function usePurchaseLog(limit = 100) {
  return useLiveQuery(
    () => db.purchaseLog.orderBy('createdAt').reverse().limit(limit).toArray(),
    [limit],
    []
  );
}

/** Expenses log, most recent first, optionally limited. */
export function useExpenses(limit = 100) {
  return useLiveQuery(
    () => db.expenses.orderBy('createdAt').reverse().limit(limit).toArray(),
    [limit],
    []
  );
}

/** Today's expenses only — used on the Expenses quick-entry screen. */
export function useTodayExpenses() {
  const today = new Date().toISOString().slice(0, 10);
  return useLiveQuery(
    () => db.expenses.where('date').equals(today).reverse().sortBy('createdAt'),
    [today],
    []
  );
}

/** Outstanding (balance > 0) sales, enriched with aging info, for receivables view. */
export function useOutstandingSales() {
  return useLiveQuery(async () => {
    const sales = await db.salesLog.where('balanceDue').above(0).toArray();
    const customers = await db.customers.toArray();
    const byId = Object.fromEntries(customers.map((c) => [c.id, c]));
    return sales
      .map((s) => ({
        ...s,
        customerName: byId[s.customerId]?.name || 'Unknown',
        customerPhone: byId[s.customerId]?.phone || '',
        agingDays: calculateAgingDays(s.date),
      }))
      .sort((a, b) => b.agingDays - a.agingDays);
  }, [], []);
}

/** Outstanding (balance > 0) purchases, enriched with aging info, for payables view. */
export function useOutstandingPurchases() {
  return useLiveQuery(async () => {
    const purchases = await db.purchaseLog.where('balanceDue').above(0).toArray();
    const suppliers = await db.suppliers.toArray();
    const byId = Object.fromEntries(suppliers.map((s) => [s.id, s]));
    return purchases
      .map((p) => ({
        ...p,
        supplierName: byId[p.supplierId]?.name || 'Unknown',
        supplierPhone: byId[p.supplierId]?.phone || '',
        agingDays: calculateAgingDays(p.date),
      }))
      .sort((a, b) => b.agingDays - a.agingDays);
  }, [], []);
}

/** Aggregated dashboard KPIs for a given date range (defaults to current month). */
export function useDashboardKPIs(rangeStart, rangeEnd) {
  return useLiveQuery(async () => {
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

    const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    
    const collectionsTotal = customerCollections.reduce((sum, c) => sum + c.amount, 0);
    const totalCollected = sales.reduce((sum, s) => sum + s.amountPaid, 0) + collectionsTotal;
    
    const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalProduced = production.reduce((sum, p) => sum + p.quantity, 0);
    const totalProductionCost = production.reduce((sum, p) => sum + p.totalCost, 0);
    const receivables = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
    const payables = suppliers.reduce((sum, s) => sum + (s.outstandingBalance || 0), 0);
    const finishedStockValue = finishedStock.reduce(
      (sum, f) => sum + f.currentStock * f.costPrice,
      0
    );

    const cashIn = sales
      .filter((s) => s.paymentChannel === 'cash')
      .reduce((sum, s) => sum + s.amountPaid, 0) + customerCollections.filter(c => c.paymentChannel === 'cash').reduce((sum, c) => sum + c.amount, 0);
    const bankIn = sales
      .filter((s) => s.paymentChannel === 'bank')
      .reduce((sum, s) => sum + s.amountPaid, 0) + customerCollections.filter(c => c.paymentChannel === 'bank').reduce((sum, c) => sum + c.amount, 0);
      
    const cashOut =
      expenses.filter((e) => e.paymentChannel === 'cash').reduce((sum, e) => sum + e.amount, 0) +
      purchases
        .filter((p) => p.paymentChannel === 'cash')
        .reduce((sum, p) => sum + p.amountPaid, 0) +
      supplierPayments.filter(p => p.paymentChannel === 'cash').reduce((sum, p) => sum + p.amount, 0);

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
      bankIn,
      cashOut,
      netCashPosition: cashIn - cashOut,
      grossMargin: totalSales - totalProductionCost,
      salesCount: sales.length,
      productionRuns: production.length,
    };

    return kpiData;
  }, [rangeStart, rangeEnd], null);

  useEffect(() => {
    if (kpis && Capacitor.isNativePlatform()) {
      WidgetPlugin.syncKpis({ data: JSON.stringify(kpis) }).catch(console.error);
    }
  }, [kpis]);

  return kpis;
}

/** Invoice settings map (key -> value) */
export function useInvoiceSettings() {
  return useLiveQuery(async () => {
    const settingsArr = await db.invoiceSettings.toArray();
    const map = {};
    for (const s of settingsArr) {
      map[s.key] = s.value;
    }
    return map;
  }, [], {});
}
