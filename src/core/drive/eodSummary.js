import { db } from '../db/schema';
import { formatINR, formatDateDisplay } from '../utils/format';

/**
 * eodSummary.js
 * --------------
 * Compiles a single day's complete financial + production movement into
 * a clean, dispatch-ready plain-text summary. Designed to be sent to the
 * factory owner via WhatsApp (using the same deep-link mechanism as
 * customer reminders) or any other native share sheet.
 */
export async function compileEndOfDaySummary(dateISO) {
  const [sales, purchases, expenses, production, settingsRows] = await Promise.all([
    db.salesLog.where('date').equals(dateISO).toArray(),
    db.purchaseLog.where('date').equals(dateISO).toArray(),
    db.expenses.where('date').equals(dateISO).toArray(),
    db.productionLog.where('date').equals(dateISO).toArray(),
    db.settings.toArray(),
  ]);

  const factoryName =
    settingsRows.find((s) => s.key === 'factoryName')?.value || 'Brick Factory';

  const totalSalesAmount = sales.reduce((s, r) => s + r.totalAmount, 0);
  const totalCollected = sales.reduce((s, r) => s + r.amountPaid, 0);
  const newCreditExtended = sales.reduce((s, r) => s + r.balanceDue, 0);

  const totalPurchaseAmount = purchases.reduce((s, r) => s + r.totalAmount, 0);
  const totalPaidToSuppliers = purchases.reduce((s, r) => s + r.amountPaid, 0);

  const totalExpenseAmount = expenses.reduce((s, r) => s + r.amount, 0);
  const expensesByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const cashIn = sales
    .filter((s) => s.paymentChannel === 'cash')
    .reduce((s, r) => s + r.amountPaid, 0);
  const cashOut =
    expenses.filter((e) => e.paymentChannel === 'cash').reduce((s, r) => s + r.amount, 0) +
    purchases
      .filter((p) => p.paymentChannel === 'cash')
      .reduce((s, r) => s + r.amountPaid, 0);
  const closingCashMovement = cashIn - cashOut;

  const totalBricksProduced = production.reduce((s, r) => s + r.quantity, 0);
  const totalProductionCost = production.reduce((s, r) => s + r.totalCost, 0);
  const productionBySize = production.reduce((acc, p) => {
    acc[p.brickSize] = (acc[p.brickSize] || 0) + p.quantity;
    return acc;
  }, {});

  const lines = [
    `📋 *${factoryName} — Day Summary*`,
    `🗓️ ${formatDateDisplay(dateISO)}`,
    '',
    '🏭 *Production*',
    `Total bricks produced: ${totalBricksProduced}`,
    ...Object.entries(productionBySize).map(([size, qty]) => `  • ${size}: ${qty}`),
    `Production cost: ${formatINR(totalProductionCost)}`,
    '',
    '💰 *Sales*',
    `Total sales value: ${formatINR(totalSalesAmount)}`,
    `Amount collected: ${formatINR(totalCollected)}`,
    `New credit extended: ${formatINR(newCreditExtended)}`,
    `Transactions: ${sales.length}`,
    '',
    '📦 *Purchases*',
    `Total purchase value: ${formatINR(totalPurchaseAmount)}`,
    `Paid to suppliers: ${formatINR(totalPaidToSuppliers)}`,
    '',
    '🧾 *Expenses*',
    `Total: ${formatINR(totalExpenseAmount)}`,
    ...Object.entries(expensesByCategory).map(([cat, amt]) => `  • ${cat}: ${formatINR(amt)}`),
    '',
    '💵 *Cash Movement*',
    `Cash in: ${formatINR(cashIn)}`,
    `Cash out: ${formatINR(cashOut)}`,
    `Net cash movement: ${formatINR(closingCashMovement)}`,
  ];

  return lines.join('\n');
}
