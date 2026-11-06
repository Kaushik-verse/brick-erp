import { db } from './schema';
import { todayISO, parseISODate } from '../utils/format';
import { nextInvoiceNumber } from '../billing/invoiceNumber';

/**
 * ledgerEngine.js
 * ----------------
 * Shared accounts-receivable / accounts-payable logic for Sales and
 * Purchases. Both flows mirror each other: a transaction against a
 * customer (sale) or supplier (purchase) updates that party's running
 * outstanding balance and tags the transaction with a payment status
 * derived purely from amountPaid vs totalAmount — never stored as a
 * manually-set flag, so it can never drift out of sync.
 */

export function derivePaymentStatus(totalAmount, amountPaid) {
  if (amountPaid <= 0) return 'credit';
  if (amountPaid >= totalAmount) return 'paid';
  return 'partial';
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Records a sale: deducts finished-goods stock, writes salesLog entry,
 * and updates the customer's outstanding balance.
 */
export async function recordSale({
  date,
  customerId,
  brickSize,
  quantity,
  rate,
  items, // array of { description, quantity, rate, amount }
  totalAmount: providedTotalAmount,
  amountPaid,
  paymentChannel, // 'cash' | 'bank'
  invoiceNumber,
  balanceDue: providedBalanceDue,
  paymentStatus: providedPaymentStatus,
  remarks,
  vehicleNumber,
  charges,
  tax,
  id: existingId,
  createdAt,
}) {
  if (!customerId) throw new Error('A customer must be selected.');
  
  const isMultiItem = items && Array.isArray(items) && items.length > 0;
  if (!isMultiItem && (!quantity || quantity <= 0)) {
    throw new Error('Quantity must be greater than zero.');
  }

  let totalAmount = providedTotalAmount;
  if (totalAmount === undefined) {
    if (isMultiItem) {
      totalAmount = round2(items.reduce((sum, it) => sum + (it.amount || (it.quantity * it.rate)), 0));
    } else {
      totalAmount = round2(quantity * rate);
    }
  }

  const paid = round2(amountPaid || 0);
  const balanceDue = providedBalanceDue !== undefined ? providedBalanceDue : round2(totalAmount - paid);
  const paymentStatus = providedPaymentStatus !== undefined ? providedPaymentStatus : derivePaymentStatus(totalAmount, paid);

  return db.transaction('rw', db.finishedStock, db.salesLog, db.customers, db.settings, async () => {
    // Every new sale gets a proper sequential invoice number (JVI/26-27/0001).
    // `null` means "keep without a number" (old sales being edited).
    const finalInvoiceNumber = invoiceNumber === undefined ? await nextInvoiceNumber(date) : invoiceNumber || undefined;

    // Deduct stock
    if (isMultiItem) {
      for (const item of items) {
        if (!item.description || !item.quantity) continue;
        const stockRow = await db.finishedStock.where('brickSize').equals(item.description).first();
        if (stockRow) {
          await db.finishedStock.update(stockRow.id, {
            currentStock: round2(stockRow.currentStock - item.quantity),
          });
        }
      }
    } else {
      const stockRow = await db.finishedStock.where('brickSize').equals(brickSize).first();
      if (stockRow) {
        await db.finishedStock.update(stockRow.id, {
          currentStock: round2(stockRow.currentStock - quantity),
        });
      }
    }

    const record = {
      date,
      customerId,
      brickSize: isMultiItem ? undefined : brickSize,
      quantity: isMultiItem ? undefined : quantity,
      rate: isMultiItem ? undefined : rate,
      items,
      invoiceNumber: finalInvoiceNumber,
      totalAmount,
      amountPaid: paid,
      balanceDue,
      paymentStatus,
      paymentChannel,
      remarks: remarks || undefined,
      vehicleNumber: vehicleNumber || undefined,
      charges: charges || undefined,
      tax: tax || undefined,
      createdAt: createdAt || new Date().toISOString(),
    };
    if (existingId) record.id = existingId;
    const id = await db.salesLog.put(record);

    const customer = await db.customers.get(customerId);
    if (customer) {
      await db.customers.update(customerId, {
        outstandingBalance: round2((customer.outstandingBalance || 0) + balanceDue),
      });
    }

    return { id, totalAmount, balanceDue, paymentStatus, invoiceNumber: finalInvoiceNumber };
  });
}

/**
 * Records a purchase: increments raw material stock, writes purchaseLog
 * entry, and updates the supplier's outstanding balance.
 */
export async function recordPurchase({
  date,
  supplierId,
  materialId,
  quantity,
  rate,
  amountPaid,
  paymentChannel,
}) {
  if (!supplierId) throw new Error('A supplier must be selected.');
  if (!materialId) throw new Error('A material must be selected.');
  if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than zero.');

  const totalAmount = round2(quantity * rate);
  const paid = round2(amountPaid || 0);
  const balanceDue = round2(totalAmount - paid);
  const paymentStatus = derivePaymentStatus(totalAmount, paid);

  return db.transaction('rw', db.rawMaterials, db.purchaseLog, db.suppliers, async () => {
    const material = await db.rawMaterials.get(materialId);
    if (material) {
      // Weighted-average rate update on incoming stock
      const existingValue = material.currentStock * material.avgRate;
      const incomingValue = quantity * rate;
      const newQty = material.currentStock + quantity;
      const newAvgRate = newQty > 0 ? round2((existingValue + incomingValue) / newQty) : rate;

      await db.rawMaterials.update(materialId, {
        currentStock: round2(newQty),
        avgRate: newAvgRate,
      });
    }

    const id = await db.purchaseLog.add({
      date,
      supplierId,
      materialId,
      quantity,
      rate,
      totalAmount,
      amountPaid: paid,
      balanceDue,
      paymentStatus,
      paymentChannel,
      createdAt: new Date().toISOString(),
    });

    const supplier = await db.suppliers.get(supplierId);
    if (supplier) {
      await db.suppliers.update(supplierId, {
        outstandingBalance: round2((supplier.outstandingBalance || 0) + balanceDue),
      });
    }

    return { id, totalAmount, balanceDue, paymentStatus };
  });
}

/**
 * Aging buckets — used by both Sales (receivables) and Purchases (payables)
 * to flag overdue accounts. dueDays defaults to 30.
 */
export function calculateAgingDays(transactionDate) {
  const txDate = parseISODate(transactionDate) || new Date();
  const today = new Date();
  const diffMs = today.setHours(0, 0, 0, 0) - txDate.setHours(0, 0, 0, 0);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export async function addCustomerCollection(customerId, amount, paymentChannel, date, remarks = '') {
  if (!customerId) throw new Error('A customer must be selected.');
  if (!amount || amount <= 0) throw new Error('Amount must be greater than zero.');
  const paymentDate = date || todayISO();

  return db.transaction('rw', db.customerCollections, db.customers, async () => {
    const id = await db.customerCollections.add({
      customerId,
      amount: round2(amount),
      paymentChannel,
      date: paymentDate,
      remarks,
      createdAt: new Date().toISOString(),
    });

    const customer = await db.customers.get(customerId);
    if (customer) {
      await db.customers.update(customerId, {
        outstandingBalance: round2((customer.outstandingBalance || 0) - amount),
      });
    }

    return { id };
  });
}

export async function addSupplierPayment(supplierId, amount, paymentChannel, date, remarks = '') {
  if (!supplierId) throw new Error('A supplier must be selected.');
  if (!amount || amount <= 0) throw new Error('Amount must be greater than zero.');
  const paymentDate = date || todayISO();

  return db.transaction('rw', db.supplierPayments, db.suppliers, async () => {
    const id = await db.supplierPayments.add({
      supplierId,
      amount: round2(amount),
      paymentChannel,
      date: paymentDate,
      remarks,
      createdAt: new Date().toISOString(),
    });

    const supplier = await db.suppliers.get(supplierId);
    if (supplier) {
      await db.suppliers.update(supplierId, {
        outstandingBalance: round2((supplier.outstandingBalance || 0) - amount),
      });
    }

    return { id };
  });
}

export async function deleteProductionBatch(productionId) {
  return db.transaction('rw', db.productionLog, db.finishedStock, db.rawMaterials, async () => {
    const log = await db.productionLog.get(productionId);
    if (!log) throw new Error('Production record not found.');

    const stock = await db.finishedStock.where('brickSize').equals(log.brickSize).first();
    if (!stock || stock.currentStock < log.quantity) {
      throw new Error('Cannot delete: Finished goods have already been sold (insufficient stock to revert).');
    }

    // Restore raw materials
    if (log.materialsUsed && log.materialsUsed.materialsRequired) {
      const materials = await db.rawMaterials.toArray();
      const byId = Object.fromEntries(materials.map(m => [m.id, m]));
      for (const [matId, qty] of Object.entries(log.materialsUsed.materialsRequired)) {
        if (qty > 0 && byId[matId]) {
           await db.rawMaterials.update(Number(matId), {
             currentStock: round2(byId[matId].currentStock + qty)
           });
        }
      }
    }

    await db.finishedStock.update(stock.id, {
      currentStock: round2(stock.currentStock - log.quantity),
    });

    await db.productionLog.delete(productionId);
  });
}

/** Error code thrown when a sale/purchase has later payments and `force` was not set. */
export const LATER_PAYMENTS = 'LATER_PAYMENTS';

async function revertSaleEffects(sale) {
    if (sale.items && Array.isArray(sale.items)) {
      for (const item of sale.items) {
        const stock = await db.finishedStock.where('brickSize').equals(item.description).first();
        if (stock) {
          await db.finishedStock.update(stock.id, {
            currentStock: round2(stock.currentStock + (item.quantity || 0)),
          });
        }
      }
    } else if (sale.brickSize) {
      // Legacy single-item sale
      const stock = await db.finishedStock.where('brickSize').equals(sale.brickSize).first();
      if (stock) {
        await db.finishedStock.update(stock.id, {
          currentStock: round2(stock.currentStock + sale.quantity),
        });
      }
    }

    const customer = await db.customers.get(sale.customerId);
    if (customer) {
      await db.customers.update(customer.id, {
        outstandingBalance: round2((customer.outstandingBalance || 0) - (sale.balanceDue || 0)),
      });
    }
}

/**
 * Deletes a sale, returning its bricks to stock and removing its unpaid
 * amount from the customer's balance. If payments were received from the
 * customer after this sale, an error with code LATER_PAYMENTS is thrown
 * unless `force` is true (the UI asks the user to confirm first).
 */
export async function deleteSale(saleId, { force = false } = {}) {
  return db.transaction('rw', db.salesLog, db.finishedStock, db.customers, db.customerCollections, async () => {
    const sale = await db.salesLog.get(saleId);
    if (!sale) throw new Error('Sale record not found.');

    if (!force) {
      const collections = await db.customerCollections.where('customerId').equals(sale.customerId).toArray();
      if (collections.some((c) => c.createdAt >= sale.createdAt)) {
        const err = new Error('Payments were received from this customer after this sale.');
        err.code = LATER_PAYMENTS;
        throw err;
      }
    }

    await revertSaleEffects(sale);
    await db.salesLog.delete(saleId);
  });
}

/**
 * Edits a sale atomically: the old sale's effects (stock + balance) are
 * reversed and the new values applied in ONE transaction, so a failure
 * can never leave the sale deleted. Keeps the same id, invoice number
 * and creation time.
 */
export async function updateSale(saleId, newValues) {
  return db.transaction('rw', db.salesLog, db.finishedStock, db.customers, db.customerCollections, db.settings, async () => {
    const old = await db.salesLog.get(saleId);
    if (!old) throw new Error('Sale record not found.');
    await revertSaleEffects(old);
    await db.salesLog.delete(saleId);
    return recordSale({
      invoiceNumber: old.invoiceNumber ?? null,
      tax: old.tax,
      charges: old.charges,
      remarks: old.remarks,
      vehicleNumber: old.vehicleNumber,
      ...newValues,
      id: saleId,
      createdAt: old.createdAt,
    });
  });
}

export async function deleteCustomerCollection(collectionId) {
  return db.transaction('rw', db.customerCollections, db.customers, async () => {
    const col = await db.customerCollections.get(collectionId);
    if (!col) throw new Error('Collection not found.');

    const customer = await db.customers.get(col.customerId);
    if (customer) {
      await db.customers.update(customer.id, {
        outstandingBalance: round2((customer.outstandingBalance || 0) + col.amount),
      });
    }

    await db.customerCollections.delete(collectionId);
  });
}

export async function deletePurchase(purchaseId, { force = false } = {}) {
  return db.transaction('rw', db.purchaseLog, db.rawMaterials, db.suppliers, db.supplierPayments, async () => {
    const purchase = await db.purchaseLog.get(purchaseId);
    if (!purchase) throw new Error('Purchase record not found.');

    if (!force) {
      const payments = await db.supplierPayments.where('supplierId').equals(purchase.supplierId).toArray();
      if (payments.some((p) => p.createdAt >= purchase.createdAt)) {
        const err = new Error('Payments were made to this supplier after this purchase.');
        err.code = LATER_PAYMENTS;
        throw err;
      }
    }

    const material = await db.rawMaterials.get(purchase.materialId);
    if (material) {
      if (material.currentStock < purchase.quantity) {
        throw new Error('Cannot delete: Material has already been used in production.');
      }
      
      const existingValue = material.currentStock * material.avgRate;
      const removedValue = purchase.quantity * purchase.rate;
      const newQty = material.currentStock - purchase.quantity;
      // Guard against a negative average if stock was consumed at a different rate.
      const newAvgRate = newQty > 0 ? Math.max(0, round2((existingValue - removedValue) / newQty)) : material.avgRate;
      
      await db.rawMaterials.update(material.id, {
        currentStock: round2(newQty),
        avgRate: newAvgRate,
      });
    }

    const supplier = await db.suppliers.get(purchase.supplierId);
    if (supplier) {
      await db.suppliers.update(supplier.id, {
        outstandingBalance: round2((supplier.outstandingBalance || 0) - (purchase.balanceDue || 0)),
      });
    }

    await db.purchaseLog.delete(purchaseId);
  });
}

export async function deleteSupplierPayment(paymentId) {
  return db.transaction('rw', db.supplierPayments, db.suppliers, async () => {
    const pmt = await db.supplierPayments.get(paymentId);
    if (!pmt) throw new Error('Payment not found.');

    const supplier = await db.suppliers.get(pmt.supplierId);
    if (supplier) {
      await db.suppliers.update(supplier.id, {
        outstandingBalance: round2((supplier.outstandingBalance || 0) + pmt.amount),
      });
    }

    await db.supplierPayments.delete(paymentId);
  });
}

/**
 * Manual stock correction (opening stock, breakage, physical count).
 * Sets the item's stock to `newStock` and keeps an audit record of the
 * change in stockAdjustments.
 * @param {'raw'|'finished'} itemType
 */
export async function adjustStock({ itemType, itemId, newStock, reason = '', date }) {
  const qty = Number(newStock);
  if (!Number.isFinite(qty) || qty < 0) throw new Error('Enter a valid stock quantity (0 or more).');
  const table = itemType === 'raw' ? db.rawMaterials : db.finishedStock;

  return db.transaction('rw', table, db.stockAdjustments, async () => {
    const item = await table.get(itemId);
    if (!item) throw new Error('Item not found.');
    const before = item.currentStock || 0;
    const delta = round2(qty - before);
    if (delta === 0) return { delta: 0 };
    await table.update(itemId, { currentStock: round2(qty) });
    await db.stockAdjustments.add({
      date: date || todayISO(),
      itemType,
      itemId,
      itemName: item.name || item.brickSize,
      before,
      after: round2(qty),
      delta,
      reason: reason.trim(),
      createdAt: new Date().toISOString(),
    });
    return { delta };
  });
}

/** Edits a customer's or supplier's name/phone. */
export async function updateParty(kind, id, { name, phone, address, gstin }) {
  const table = kind === 'customer' ? db.customers : db.suppliers;
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Name cannot be empty.');
  const g = (gstin || '').trim().toUpperCase();
  if (g && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(g)) {
    throw new Error('GSTIN looks wrong — it should be 15 characters like 37ABCDE1234F1Z5.');
  }
  const changes = { name: trimmed, phone: (phone || '').trim() };
  if (address !== undefined) changes.address = address.trim();
  if (gstin !== undefined) changes.gstin = g;
  await table.update(id, changes);
}

/** Deletes a customer/supplier — only allowed when they have no transactions. */
export async function deleteParty(kind, id) {
  if (kind === 'customer') {
    const [sales, cols] = await Promise.all([
      db.salesLog.where('customerId').equals(id).count(),
      db.customerCollections.where('customerId').equals(id).count(),
    ]);
    if (sales + cols > 0) throw new Error('This customer has transactions. Delete those first.');
    const c = await db.customers.get(id);
    if (c && Math.abs(c.outstandingBalance || 0) > 0.009) throw new Error('This customer still has a balance.');
    await db.customers.delete(id);
  } else {
    const [purchases, pays] = await Promise.all([
      db.purchaseLog.where('supplierId').equals(id).count(),
      db.supplierPayments.where('supplierId').equals(id).count(),
    ]);
    if (purchases + pays > 0) throw new Error('This supplier has transactions. Delete those first.');
    const s = await db.suppliers.get(id);
    if (s && Math.abs(s.outstandingBalance || 0) > 0.009) throw new Error('This supplier still has a balance.');
    await db.suppliers.delete(id);
  }
}
