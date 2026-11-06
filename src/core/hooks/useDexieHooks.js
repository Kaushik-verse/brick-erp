import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';

import { computeKpis } from '../db/kpis';

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

/** Aggregated dashboard KPIs for a given date range (defaults to current month). */
export function useDashboardKPIs(rangeStart, rangeEnd) {
  return useLiveQuery(() => computeKpis(rangeStart, rangeEnd), [rangeStart, rangeEnd], null);
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
