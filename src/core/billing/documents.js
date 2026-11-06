import { Capacitor } from '@capacitor/core';
import { db } from '../db/schema';
import { loadBillingProfile, isInterState } from './profile';
import { computeInvoiceTotals } from './invoiceMath';
import { displayInvoiceNumber } from './invoiceNumber';
import {
  buildCustomerLedger,
  buildSupplierLedger,
  sliceLedger,
  agingBuckets,
  balanceBeforeSale,
  receiptNumber,
  modeName,
} from './partyLedger';
import { invoiceMessage, receiptMessage, statementMessage, reminderMessage, supplierBalanceMessage } from './messages';
import { saveAndShareBlob } from '../utils/nativeFileBridge';
import { sendWhatsAppText } from '../utils/whatsapp';

/**
 * documents.js
 * -------------
 * One-call helpers that build a document from the database, render the
 * PDF and hand it to the share sheet together with the matching message.
 * Used by every screen, so an invoice looks the same whether it is
 * shared right after billing or re-printed months later.
 */

const safeName = (s) => String(s || '').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

async function pdf() {
  return import('../../features/documents/pdfExport');
}

/** "4-inch" → "Fly Ash Bricks - 4-inch" so the bill describes the goods properly. */
export function goodsDescription(name, profile) {
  const n = String(name || '').trim();
  const label = profile.invoice.productLabel;
  if (!n) return label || 'Goods';
  if (label && /inch|"|mm\b/i.test(n) && !/brick/i.test(n)) return `${label} - ${n}`;
  return n;
}

/** Totals for a saved sale, reproducing exactly what was billed. */
export function totalsFromSale(sale, profile, customer) {
  const items = Array.isArray(sale.items) && sale.items.length
    ? sale.items.map((it) => ({ description: goodsDescription(it.description, profile), quantity: it.quantity, rate: it.rate, amount: it.amount, unit: it.unit, hsn: it.hsn }))
    : [{ description: goodsDescription(sale.brickSize, profile), quantity: sale.quantity, rate: sale.rate, amount: (Number(sale.quantity) || 0) * (Number(sale.rate) || 0) }];

  const charges = sale.charges || {};
  // Sales saved with tax info are reproduced exactly. Older/quick sales are
  // final amounts, so if GST is switched on we show the tax INSIDE them.
  const gstMode = sale.tax?.gstMode || (profile.invoice.gstMode === 'none' ? 'none' : 'inclusive');
  const gstRate = sale.tax?.gstRate ?? profile.invoice.gstRate;
  const interState = sale.tax?.interState ?? isInterState(profile, customer);
  const totals = computeInvoiceTotals({ items, charges, gstMode, gstRate, interState });

  // The stored total is the legal amount of the bill — reconcile to it.
  const stored = Number(sale.totalAmount);
  if (Number.isFinite(stored) && Math.abs(stored - totals.grandTotal) >= 0.005) {
    totals.roundOff = Math.round((totals.roundOff + stored - totals.grandTotal) * 100) / 100;
    totals.grandTotal = stored;
  }
  return totals;
}

function totalQty(totals) {
  return totals.lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
}

async function deliver({ blob, filename, text, phone }) {
  if (Capacitor.isNativePlatform()) {
    await saveAndShareBlob(blob, filename, 'application/pdf', text);
  } else {
    await saveAndShareBlob(blob, filename, 'application/pdf');
    if (text) await sendWhatsAppText(phone, text);
  }
}

/**
 * Builds the invoice PDF for a saved sale.
 * @param {number} saleId
 * @param {{ share?: boolean, copyLabel?: string }} opts  share=false only downloads/prints
 */
export async function shareSaleInvoice(saleId, { share = true, copyLabel } = {}) {
  const sale = await db.salesLog.get(saleId);
  if (!sale) throw new Error('Sale not found.');
  const [profile, customer] = await Promise.all([loadBillingProfile(), db.customers.get(sale.customerId)]);
  const totals = totalsFromSale(sale, profile, customer);
  const previousBalance = await balanceBeforeSale(sale);
  const number = displayInvoiceNumber(sale);
  const paid = Number(sale.amountPaid) || 0;
  const balance = Math.round((totals.grandTotal - paid) * 100) / 100;

  const { generateInvoicePDF } = await pdf();
  const blob = await generateInvoicePDF({
    profile,
    customer,
    totals,
    amountPaid: paid,
    previousBalance,
    invoice: {
      number,
      date: sale.date,
      paymentMode: sale.paymentChannel,
      vehicleNumber: sale.vehicleNumber,
      remarks: sale.remarks,
      copyLabel,
    },
  });
  const filename = `Invoice_${safeName(number)}_${safeName(customer?.name)}.pdf`;
  const text = share
    ? invoiceMessage({
        profile,
        customer,
        invoiceNumber: number,
        date: sale.date,
        grandTotal: totals.grandTotal,
        paid,
        balance,
        totalOutstanding: previousBalance + balance,
        totalQty: totalQty(totals),
      })
    : '';
  await deliver({ blob, filename, text, phone: customer?.phone });
  return { number };
}

/** Payment receipt for a customer collection. */
export async function shareCollectionReceipt(collectionId) {
  const col = await db.customerCollections.get(collectionId);
  if (!col) throw new Error('Payment not found.');
  const [profile, customer, ledger] = await Promise.all([
    loadBillingProfile(),
    db.customers.get(col.customerId),
    buildCustomerLedger(col.customerId),
  ]);
  const number = receiptNumber(col);
  const entry = ledger.entries.find((e) => e.kind === 'receipt' && e.ref === number);
  const balanceAfter = entry ? entry.balance : customer?.outstandingBalance;
  const { generateReceiptPDF } = await pdf();
  const blob = await generateReceiptPDF({
    profile,
    customer,
    balanceAfter,
    receipt: { number, date: col.date, amount: col.amount, mode: col.paymentChannel, reference: col.remarks },
  });
  const text = receiptMessage({
    profile,
    customer,
    receiptNumber: number,
    date: col.date,
    amount: col.amount,
    mode: modeName(col.paymentChannel),
    balanceAfter,
  });
  await deliver({ blob, filename: `Receipt_${number}_${safeName(customer?.name)}.pdf`, text, phone: customer?.phone });
}

/**
 * Statement of account for a customer or supplier.
 * @param {'customer'|'supplier'} type
 * @param {{ from?: string, to?: string, label?: string }} period
 */
export async function shareStatement(type, partyId, period = {}) {
  const ledger = type === 'customer' ? await buildCustomerLedger(partyId) : await buildSupplierLedger(partyId);
  const profile = await loadBillingProfile();
  const slice = sliceLedger(ledger, period.from, period.to);
  const { generateStatementPDF } = await pdf();
  const blob = await generateStatementPDF({
    profile,
    party: ledger.party,
    type,
    slice,
    periodLabel: period.label,
    aging: type === 'customer' ? agingBuckets(ledger) : null,
  });
  const text = statementMessage({ profile, party: ledger.party, type, periodLabel: period.label, closing: slice.closing });
  await deliver({
    blob,
    filename: `Statement_${safeName(ledger.party?.name)}_${safeName(period.label || 'All')}.pdf`,
    text,
    phone: ledger.party?.phone,
  });
}

/** WhatsApp payment reminder with the oldest unpaid date. */
export async function sendPaymentReminder(customerId) {
  const [profile, ledger] = await Promise.all([loadBillingProfile(), buildCustomerLedger(customerId)]);
  const amount = ledger.closingBalance;
  // Oldest bill not yet covered by payments (FIFO).
  let credits = ledger.entries.reduce((s, e) => s + e.credit, 0) - Math.min(ledger.openingBalance, 0);
  let oldestDate = null;
  for (const e of ledger.entries) {
    if (!e.debit) continue;
    if (credits >= e.debit) credits -= e.debit;
    else {
      oldestDate = e.date;
      break;
    }
  }
  await sendWhatsAppText(ledger.party?.phone, reminderMessage({ profile, customer: ledger.party, amount, oldestDate }));
}

export async function sendSupplierBalanceMessage(supplierId) {
  const [profile, supplier] = await Promise.all([loadBillingProfile(), db.suppliers.get(supplierId)]);
  await sendWhatsAppText(supplier?.phone, supplierBalanceMessage({ profile, supplier, amount: supplier?.outstandingBalance || 0 }));
}
