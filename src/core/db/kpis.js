import { db } from './schema';
import { isCashChannel, isBankChannel } from '../utils/format';

/**
 * kpis.js
 * --------
 * One shared KPI calculation for the dashboard AND the Android home-screen
 * widgets, so the two can never disagree.
 *
 * Money movement rules:
 *  • cash  → Cash In / Cash Out
 *  • bank, upi, cheque → Bank In / Bank Out
 *  • Passbook manual entries (deposits, withdrawals, transfers) are
 *    included; opening balances are NOT (they are not monthly movement).
 */
const sum = (rows, fn) => rows.reduce((s, r) => s + (Number(fn(r)) || 0), 0);

function manualMovement(mt) {
  const a = Number(mt.amount) || 0;
  switch (mt.type) {
    case 'Cash Deposit':
      return { cashIn: a };
    case 'Cash Withdrawal':
      return { cashOut: a };
    case 'Bank Deposit':
      return { bankIn: a };
    case 'Bank Withdrawal':
      return { bankOut: a };
    case 'Cash to Bank Transfer':
      return { cashOut: a, bankIn: a, transfer: true };
    case 'Bank to Cash Transfer':
      return { bankOut: a, cashIn: a, transfer: true };
    default:
      return {};
  }
}

export async function computeKpis(rangeStart, rangeEnd) {
  const inRange = (table) => table.where('date').between(rangeStart, rangeEnd, true, true).toArray();
  const [
    sales,
    purchases,
    expenses,
    production,
    customers,
    suppliers,
    finishedStock,
    rawMaterials,
    customerCollections,
    supplierPayments,
    manual,
  ] = await Promise.all([
    inRange(db.salesLog),
    inRange(db.purchaseLog),
    inRange(db.expenses),
    inRange(db.productionLog),
    db.customers.toArray(),
    db.suppliers.toArray(),
    db.finishedStock.toArray(),
    db.rawMaterials.toArray(),
    inRange(db.customerCollections),
    inRange(db.supplierPayments),
    inRange(db.manualTransactions),
  ]);

  const totalSales = sum(sales, (s) => s.totalAmount);
  const collectionsTotal = sum(customerCollections, (c) => c.amount);
  const totalCollected = sum(sales, (s) => s.amountPaid) + collectionsTotal;
  const totalPurchases = sum(purchases, (p) => p.totalAmount);
  const totalExpenses = sum(expenses, (e) => e.amount);
  const totalProduced = sum(production, (p) => p.quantity);
  const totalProductionCost = sum(production, (p) => p.totalCost);
  const receivables = sum(customers, (c) => Math.max(c.outstandingBalance || 0, 0));
  const payables = sum(suppliers, (s) => Math.max(s.outstandingBalance || 0, 0));
  const finishedStockValue = sum(finishedStock, (f) => (f.currentStock || 0) * (f.costPrice || 0));
  const rawStockValue = sum(rawMaterials, (m) => (m.currentStock || 0) * (m.avgRate || 0));

  const by = (rows, pred, fn) => sum(rows.filter(pred), fn);
  const cashCh = (r) => isCashChannel(r.paymentChannel);
  const bankCh = (r) => isBankChannel(r.paymentChannel);

  let cashIn =
    by(sales, cashCh, (s) => s.amountPaid) + by(customerCollections, cashCh, (c) => c.amount);
  let bankIn =
    by(sales, bankCh, (s) => s.amountPaid) + by(customerCollections, bankCh, (c) => c.amount);
  let cashOut =
    by(expenses, cashCh, (e) => e.amount) +
    by(purchases, cashCh, (p) => p.amountPaid) +
    by(supplierPayments, cashCh, (p) => p.amount);
  let bankOut =
    by(expenses, bankCh, (e) => e.amount) +
    by(purchases, bankCh, (p) => p.amountPaid) +
    by(supplierPayments, bankCh, (p) => p.amount);

  // Manual passbook movement. Transfers move money between cash and bank,
  // so they change the split but not the total.
  for (const mt of manual) {
    const m = manualMovement(mt);
    cashIn += m.cashIn || 0;
    cashOut += m.cashOut || 0;
    bankIn += m.bankIn || 0;
    bankOut += m.bankOut || 0;
  }

  const lowStock = rawMaterials.filter(
    (m) => m.isActive !== 0 && (m.reorderLevel || 0) > 0 && (m.currentStock || 0) < m.reorderLevel
  );

  // Gross margin on what was SOLD (cost of bricks sold), falling back to
  // production cost only when there is no cost price yet.
  const costPriceBySize = Object.fromEntries(finishedStock.map((f) => [f.brickSize, f.costPrice || 0]));
  let costOfGoodsSold = 0;
  for (const s of sales) {
    if (Array.isArray(s.items) && s.items.length) {
      for (const it of s.items) costOfGoodsSold += (Number(it.quantity) || 0) * (costPriceBySize[it.description] || 0);
    } else {
      costOfGoodsSold += (Number(s.quantity) || 0) * (costPriceBySize[s.brickSize] || 0);
    }
  }
  const grossMargin = totalSales - costOfGoodsSold;

  return {
    totalSales,
    totalCollected,
    totalPurchases,
    totalExpenses,
    totalProduced,
    totalProductionCost,
    receivables,
    payables,
    finishedStockValue,
    rawStockValue,
    cashIn,
    bankIn,
    cashOut,
    bankOut,
    netCashPosition: cashIn - cashOut,
    netBankPosition: bankIn - bankOut,
    netMovement: cashIn + bankIn - cashOut - bankOut,
    grossMargin,
    // Margin after this month's expenses — a simple "profit" indicator.
    netProfit: grossMargin - totalExpenses,
    salesCount: sales.length,
    productionRuns: production.length,
    lowStock,
    bricksInStock: sum(finishedStock.filter((f) => f.isActive !== 0), (f) => f.currentStock),
  };
}
