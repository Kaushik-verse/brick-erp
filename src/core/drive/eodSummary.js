import { db } from '../db/schema';
import { formatINR, formatDateDisplay, formatNumber, isCashChannel, isBankChannel } from '../utils/format';

/**
 * eodSummary.js
 * --------------
 * Compiles a single day's complete financial + production movement into
 * a clean, dispatch-ready plain-text summary for WhatsApp.
 *
 * Includes customer payments and supplier payments received/made that
 * day (not only money paid at the time of sale/purchase), and treats
 * UPI/cheque as bank money.
 */
const sum = (rows, fn) => rows.reduce((s, r) => s + (Number(fn(r)) || 0), 0);

export async function compileEndOfDaySummary(dateISO) {
  const onDay = (table) => table.where('date').equals(dateISO).toArray();
  const [sales, purchases, expenses, production, collections, supplierPays, settingsRows, customers] =
    await Promise.all([
      onDay(db.salesLog),
      onDay(db.purchaseLog),
      onDay(db.expenses),
      onDay(db.productionLog),
      onDay(db.customerCollections),
      onDay(db.supplierPayments),
      db.settings.toArray(),
      db.customers.toArray(),
    ]);

  const factoryName = settingsRows.find((s) => s.key === 'factoryName')?.value || 'Brick Factory';
  const customerName = Object.fromEntries(customers.map((c) => [c.id, c.name]));

  const totalSalesAmount = sum(sales, (r) => r.totalAmount);
  const paidAtSale = sum(sales, (r) => r.amountPaid);
  const newCreditExtended = sum(sales, (r) => r.balanceDue);
  const collectionsTotal = sum(collections, (r) => r.amount);

  const totalPurchaseAmount = sum(purchases, (r) => r.totalAmount);
  const paidToSuppliers = sum(purchases, (r) => r.amountPaid) + sum(supplierPays, (r) => r.amount);

  const totalExpenseAmount = sum(expenses, (r) => r.amount);
  const expensesByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const inBy = (pred) =>
    sum(sales.filter((s) => pred(s.paymentChannel)), (r) => r.amountPaid) +
    sum(collections.filter((c) => pred(c.paymentChannel)), (r) => r.amount);
  const outBy = (pred) =>
    sum(expenses.filter((e) => pred(e.paymentChannel)), (r) => r.amount) +
    sum(purchases.filter((p) => pred(p.paymentChannel)), (r) => r.amountPaid) +
    sum(supplierPays.filter((p) => pred(p.paymentChannel)), (r) => r.amount);

  const cashIn = inBy(isCashChannel);
  const cashOut = outBy(isCashChannel);
  const bankIn = inBy(isBankChannel);
  const bankOut = outBy(isBankChannel);

  const totalBricksProduced = sum(production, (r) => r.quantity);
  const totalProductionCost = sum(production, (r) => r.totalCost);
  const productionBySize = production.reduce((acc, p) => {
    acc[p.brickSize] = (acc[p.brickSize] || 0) + p.quantity;
    return acc;
  }, {});

  const lines = [
    `📋 *${factoryName} — Day Summary*`,
    `🗓️ ${formatDateDisplay(dateISO)}`,
    '',
    '🏭 *Production*',
    `Bricks produced: ${formatNumber(totalBricksProduced)}`,
    ...Object.entries(productionBySize).map(([size, qty]) => `  • ${size}: ${formatNumber(qty)}`),
    `Production cost: ${formatINR(totalProductionCost)}`,
    '',
    '💰 *Sales*',
    `Sales value: ${formatINR(totalSalesAmount)} (${sales.length} bills)`,
    `Paid at sale: ${formatINR(paidAtSale)}`,
    `New credit given: ${formatINR(newCreditExtended)}`,
    '',
    '📥 *Payments Received*',
    `Total: ${formatINR(collectionsTotal)}`,
    ...collections.map((c) => `  • ${customerName[c.customerId] || 'Customer'}: ${formatINR(c.amount)}`),
    '',
    '📦 *Purchases*',
    `Purchase value: ${formatINR(totalPurchaseAmount)}`,
    `Paid to suppliers: ${formatINR(paidToSuppliers)}`,
    '',
    '🧾 *Expenses*',
    `Total: ${formatINR(totalExpenseAmount)}`,
    ...Object.entries(expensesByCategory).map(([cat, amt]) => `  • ${cat}: ${formatINR(amt)}`),
    '',
    '💵 *Money Movement*',
    `Cash in: ${formatINR(cashIn)} | Cash out: ${formatINR(cashOut)}`,
    `Bank/UPI in: ${formatINR(bankIn)} | Bank out: ${formatINR(bankOut)}`,
    `Net for the day: ${formatINR(cashIn + bankIn - cashOut - bankOut)}`,
  ];

  return lines.join('\n');
}
