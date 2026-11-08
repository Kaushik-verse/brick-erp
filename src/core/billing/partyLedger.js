import { db } from '../db/schema';
import { displayInvoiceNumber } from './invoiceNumber';

/**
 * partyLedger.js
 * ---------------
 * Rebuilds a customer's or supplier's account as a proper ledger:
 * opening balance + chronological debit/credit entries + running balance.
 *
 * The stored outstandingBalance can include an opening balance that was
 * imported from Excel without any transaction behind it; that amount is
 * recovered here so statements always end at the true balance.
 */
const byTime = (a, b) =>
  (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || '');

function saleParticulars(s) {
  if (Array.isArray(s.items) && s.items.length) {
    return s.items
      .filter((it) => it.description)
      .map((it) => `${Number(it.quantity || 0).toLocaleString('en-IN')} x ${it.description}`)
      .join(', ');
  }
  return `${Number(s.quantity || 0).toLocaleString('en-IN')} x ${s.brickSize || 'Bricks'}`;
}

export async function buildCustomerLedger(customerId) {
  const [customer, sales, collections] = await Promise.all([
    db.customers.get(customerId),
    db.salesLog.where('customerId').equals(customerId).toArray(),
    db.customerCollections.where('customerId').equals(customerId).toArray(),
  ]);
  const entries = [];
  for (const s of sales) {
    entries.push({
      kind: 'invoice', date: s.date, createdAt: s.createdAt, ref: displayInvoiceNumber(s),
      particulars: saleParticulars(s), debit: Number(s.totalAmount) || 0, credit: 0, source: s,
    });
    if ((Number(s.amountPaid) || 0) > 0) {
      entries.push({
        kind: 'receipt', date: s.date, createdAt: `${s.createdAt || ''}~`, ref: displayInvoiceNumber(s),
        particulars: `Paid at billing (${modeName(s.paymentChannel)})`, debit: 0, credit: Number(s.amountPaid) || 0, source: s,
      });
    }
  }
  for (const c of collections) {
    entries.push({
      kind: 'receipt', date: c.date, createdAt: c.createdAt, ref: receiptNumber(c),
      particulars: `Payment received (${modeName(c.paymentChannel)})${c.remarks ? ` - ${c.remarks}` : ''}`,
      debit: 0, credit: Number(c.amount) || 0, source: c,
    });
  }
  return finish(customer, entries);
}

export async function buildSupplierLedger(supplierId) {
  const [supplier, purchases, payments, materials] = await Promise.all([
    db.suppliers.get(supplierId),
    db.purchaseLog.where('supplierId').equals(supplierId).toArray(),
    db.supplierPayments.where('supplierId').equals(supplierId).toArray(),
    db.rawMaterials.toArray(),
  ]);
  const mat = Object.fromEntries(materials.map((m) => [m.id, m]));
  const entries = [];
  // For a supplier account we show what WE owe: bills increase it, payments reduce it.
  for (const p of purchases) {
    const m = mat[p.materialId];
    const isKg = (m?.unit || '').toLowerCase() === 'kg';
    const qty = isKg ? `${(p.quantity / 1000).toLocaleString('en-IN', { maximumFractionDigits: 3 })} Ton` : `${p.quantity} ${m?.unit || ''}`;
    entries.push({
      kind: 'invoice', date: p.date, createdAt: p.createdAt, ref: `PUR-${String(p.id).padStart(4, '0')}`,
      particulars: `${m?.name || 'Material'} - ${qty}`, debit: Number(p.totalAmount) || 0, credit: 0, source: p,
    });
    if ((Number(p.amountPaid) || 0) > 0) {
      entries.push({
        kind: 'receipt', date: p.date, createdAt: `${p.createdAt || ''}~`, ref: `PUR-${String(p.id).padStart(4, '0')}`,
        particulars: `Paid at purchase (${modeName(p.paymentChannel)})`, debit: 0, credit: Number(p.amountPaid) || 0, source: p,
      });
    }
  }
  for (const pay of payments) {
    entries.push({
      kind: 'receipt', date: pay.date, createdAt: pay.createdAt, ref: `PAY-${String(pay.id).padStart(4, '0')}`,
      particulars: `Payment made (${modeName(pay.paymentChannel)})${pay.remarks ? ` - ${pay.remarks}` : ''}`,
      debit: 0, credit: Number(pay.amount) || 0, source: pay,
    });
  }
  return finish(supplier, entries);
}

function finish(party, entries) {
  entries.sort(byTime);
  const net = entries.reduce((s, e) => s + e.debit - e.credit, 0);
  const openingBalance = round2((Number(party?.outstandingBalance) || 0) - net);
  let running = openingBalance;
  for (const e of entries) {
    running = round2(running + e.debit - e.credit);
    e.balance = running;
  }
  return { party, openingBalance, entries, closingBalance: round2(running) };
}

/** Opening/closing for a date range plus the entries inside it. */
export function sliceLedger(ledger, from, to) {
  let opening = ledger.openingBalance;
  const inRange = [];
  for (const e of ledger.entries) {
    if (from && e.date < from) opening = e.balance;
    else if (!to || e.date <= to) inRange.push(e);
  }
  const debit = inRange.reduce((s, e) => s + e.debit, 0);
  const credit = inRange.reduce((s, e) => s + e.credit, 0);
  return { opening: round2(opening), entries: inRange, debit: round2(debit), credit: round2(credit), closing: round2(opening + debit - credit) };
}

/**
 * What is really still unpaid on each bill.
 *
 * A bill's own `balanceDue` only knows what was paid at the moment it was made.
 * Money received later ("Payment In" / supplier payments) is recorded against the
 * party, not a bill, so without this every older bill would keep showing as due
 * or "Overdue" even when the party owes nothing. Later payments are applied to
 * the oldest bills first (same rule as agingBuckets). Nothing is saved; the
 * original value stays in `savedBalanceDue`.
 *
 * @param {Array} bills    sales or purchases of ONE party
 * @param {Array} payments that party's collections / supplier payments
 */
export function applyPaymentsToBills(bills, payments) {
  let credit = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const oldestFirst = [...(bills || [])].sort(
    (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || '') || (a.id || 0) - (b.id || 0)
  );
  const due = new Map();
  for (const b of oldestFirst) {
    const saved = Math.max(0, Number(b.balanceDue) || 0);
    const used = Math.min(credit, saved);
    credit -= used;
    due.set(b, round2(saved - used));
  }
  return (bills || []).map((b) => {
    const left = due.get(b);
    const total = Number(b.totalAmount) || 0;
    const paymentStatus = left <= 0.005 ? 'paid' : left < total - 0.005 ? 'partial' : b.paymentStatus;
    return { ...b, savedBalanceDue: b.balanceDue, balanceDue: left, paymentStatus };
  });
}

/** Outstanding split by age using first-in-first-out payment allocation. */
export function agingBuckets(ledger, asOf = new Date()) {
  let credits = ledger.entries.reduce((s, e) => s + e.credit, 0) - Math.min(ledger.openingBalance, 0);
  const bills = [];
  if (ledger.openingBalance > 0) bills.push({ date: ledger.entries[0]?.date || null, amount: ledger.openingBalance });
  for (const e of ledger.entries) if (e.debit > 0) bills.push({ date: e.date, amount: e.debit });
  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  for (const b of bills) {
    const used = Math.min(credits, b.amount);
    credits -= used;
    const left = b.amount - used;
    if (left <= 0.005) continue;
    const d = b.date ? new Date(`${b.date}T00:00:00`) : today;
    const days = Math.max(0, Math.round((today - d) / 86400000));
    const key = days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
    buckets[key] = round2(buckets[key] + left);
  }
  return buckets;
}

/** Customer balance just before a given sale (for "Previous Balance" on its invoice). */
export async function balanceBeforeSale(sale) {
  const ledger = await buildCustomerLedger(sale.customerId);
  let before = ledger.openingBalance;
  for (const e of ledger.entries) {
    if (e.source === undefined) continue;
    if (e.kind === 'invoice' && e.source.id === sale.id) break;
    before = e.balance;
  }
  return round2(before);
}

export function receiptNumber(collection) {
  return `RCT-${String(collection?.id ?? 0).padStart(4, '0')}`;
}

export function modeName(ch) {
  return { cash: 'Cash', bank: 'Bank Transfer', upi: 'UPI', cheque: 'Cheque', credit: 'Credit' }[ch] || (ch ? String(ch) : 'Cash');
}

function round2(n) {
  return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
}
