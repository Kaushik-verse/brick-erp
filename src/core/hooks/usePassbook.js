import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { isBankChannel, isCashChannel } from '../utils/format';

function saleDescription(s) {
  if (Array.isArray(s.items) && s.items.length) {
    const parts = s.items
      .filter((it) => it.description)
      .map((it) => `${Number(it.quantity || 0).toLocaleString('en-IN')} × ${it.description}`);
    return parts.length ? parts.join(', ') : 'Invoice sale';
  }
  return `${Number(s.quantity || 0).toLocaleString('en-IN')} × ${s.brickSize || 'bricks'}`;
}

/**
 * usePassbook: Dynamically aggregates all financial records into a single sorted chronological ledger.
 */
export function usePassbook() {
  return useLiveQuery(async () => {
    const [
      sales,
      purchases,
      customerCollections,
      supplierPayments,
      expenses,
      manualTransactions,
      customers,
      suppliers
    ] = await Promise.all([
      db.salesLog.toArray(),
      db.purchaseLog.toArray(),
      db.customerCollections.toArray(),
      db.supplierPayments.toArray(),
      db.expenses.toArray(),
      db.manualTransactions.toArray(),
      db.customers.toArray(),
      db.suppliers.toArray()
    ]);

    const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
    const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));

    const entries = [];

    const isBank = isBankChannel;
    const isCash = isCashChannel;
    const materials = await db.rawMaterials.toArray();
    const materialMap = Object.fromEntries(materials.map((m) => [m.id, m]));

    // 1. Sales
    for (const s of sales) {
      if (s.amountPaid > 0) {
        const cIn = isCash(s.paymentChannel) ? s.amountPaid : 0;
        const bIn = isBank(s.paymentChannel) ? s.amountPaid : 0;
        entries.push({
          id: `sale-${s.id}`,
          date: s.date,
          createdAt: s.createdAt,
          type: 'Sale',
          sourceModule: 'Sales',
          partyName: customerMap[s.customerId] || 'Unknown Customer',
          description: saleDescription(s),
          paymentMode: s.paymentChannel || 'credit',
          cashIn: cIn,
          cashOut: 0,
          bankIn: bIn,
          bankOut: 0,
          remarks: `Total Bill: ₹${s.totalAmount}`,
          refNo: s.invoiceNumber || `INV-${s.id}`,
          sourceId: s.id
        });
      }
    }

    // 2. Purchases
    for (const p of purchases) {
      if (p.amountPaid > 0) {
        const cOut = isCash(p.paymentChannel) ? p.amountPaid : 0;
        const bOut = isBank(p.paymentChannel) ? p.amountPaid : 0;
        entries.push({
          id: `purchase-${p.id}`,
          date: p.date,
          createdAt: p.createdAt,
          type: 'Purchase',
          sourceModule: 'Purchases',
          partyName: supplierMap[p.supplierId] || 'Unknown Supplier',
          description: `Purchase of ${materialMap[p.materialId]?.name || 'material'}`,
          paymentMode: p.paymentChannel || 'credit',
          cashIn: 0,
          cashOut: cOut,
          bankIn: 0,
          bankOut: bOut,
          remarks: `Total Bill: ₹${p.totalAmount}`,
          refNo: `PUR-${p.id}`
        });
      }
    }

    // 3. Customer Collections
    for (const c of customerCollections) {
      const cIn = isCash(c.paymentChannel) ? c.amount : 0;
      const bIn = isBank(c.paymentChannel) ? c.amount : 0;
      entries.push({
        id: `cc-${c.id}`,
        date: c.date,
        createdAt: c.createdAt,
        type: 'Customer Payment',
        sourceModule: 'Sales',
        partyName: customerMap[c.customerId] || 'Unknown Customer',
        description: `Payment received`,
        paymentMode: c.paymentChannel,
        cashIn: cIn,
        cashOut: 0,
        bankIn: bIn,
        bankOut: 0,
        remarks: c.remarks || '',
        refNo: `REC-${c.id}`
      });
    }

    // 4. Supplier Payments
    for (const sp of supplierPayments) {
      const cOut = isCash(sp.paymentChannel) ? sp.amount : 0;
      const bOut = isBank(sp.paymentChannel) ? sp.amount : 0;
      entries.push({
        id: `sp-${sp.id}`,
        date: sp.date,
        createdAt: sp.createdAt,
        type: 'Supplier Payment',
        sourceModule: 'Purchases',
        partyName: supplierMap[sp.supplierId] || 'Unknown Supplier',
        description: `Payment made`,
        paymentMode: sp.paymentChannel,
        cashIn: 0,
        cashOut: cOut,
        bankIn: 0,
        bankOut: bOut,
        remarks: sp.remarks || '',
        refNo: `PAY-${sp.id}`
      });
    }

    // 5. Expenses
    for (const e of expenses) {
      const cOut = isCash(e.paymentChannel) ? e.amount : 0;
      const bOut = isBank(e.paymentChannel) ? e.amount : 0;
      entries.push({
        id: `exp-${e.id}`,
        date: e.date,
        createdAt: e.createdAt,
        type: 'Expense',
        sourceModule: 'Expenses',
        partyName: e.category,
        description: e.note || 'General expense',
        paymentMode: e.paymentChannel,
        cashIn: 0,
        cashOut: cOut,
        bankIn: 0,
        bankOut: bOut,
        remarks: e.note || '',
        refNo: `EXP-${e.id}`
      });
    }

    // 6. Manual Transactions
    for (const mt of manualTransactions) {
      let cIn = 0, cOut = 0, bIn = 0, bOut = 0;
      let pMode = mt.paymentChannel;

      if (mt.type === 'Cash Deposit') {
        cIn = mt.amount; pMode = 'cash';
      } else if (mt.type === 'Cash Withdrawal') {
        cOut = mt.amount; pMode = 'cash';
      } else if (mt.type === 'Bank Deposit') {
        bIn = mt.amount; pMode = 'bank';
      } else if (mt.type === 'Bank Withdrawal') {
        bOut = mt.amount; pMode = 'bank';
      } else if (mt.type === 'Cash to Bank Transfer') {
        cOut = mt.amount; bIn = mt.amount; pMode = 'transfer';
      } else if (mt.type === 'Bank to Cash Transfer') {
        bOut = mt.amount; cIn = mt.amount; pMode = 'transfer';
      } else if (mt.type === 'Opening Balance - Cash') {
        cIn = mt.amount; pMode = 'cash';
      } else if (mt.type === 'Opening Balance - Bank') {
        bIn = mt.amount; pMode = 'bank';
      }

      entries.push({
        id: `mt-${mt.id}`,
        date: mt.date,
        createdAt: mt.createdAt,
        type: mt.type,
        sourceModule: 'Passbook',
        partyName: 'Self',
        description: mt.note || mt.type,
        paymentMode: pMode,
        cashIn: cIn,
        cashOut: cOut,
        bankIn: bIn,
        bankOut: bOut,
        remarks: mt.note || '',
        refNo: `MAN-${mt.id}`,
        manualId: mt.id
      });
    }

    // Sort chronologically by date and then createdAt (to ensure stable intraday sorting)
    entries.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    // Compute running balances
    let runningCash = 0;
    let runningBank = 0;

    for (const entry of entries) {
      runningCash = runningCash + entry.cashIn - entry.cashOut;
      runningBank = runningBank + entry.bankIn - entry.bankOut;
      entry.runningCash = runningCash;
      entry.runningBank = runningBank;
      entry.runningBalance = runningCash + runningBank;
    }

    // For rendering, we often want newest first
    entries.reverse();

    return entries;

  }, [], []);
}
