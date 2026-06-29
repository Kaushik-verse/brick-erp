import { db } from './schema';

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
  amountPaid,
  paymentChannel, // 'cash' | 'bank'
}) {
  if (!customerId) throw new Error('A customer must be selected.');
  if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than zero.');

  const totalAmount = round2(quantity * rate);
  const paid = round2(amountPaid || 0);
  const balanceDue = round2(totalAmount - paid);
  const paymentStatus = derivePaymentStatus(totalAmount, paid);

  return db.transaction('rw', db.finishedStock, db.salesLog, db.customers, async () => {
    const stockRow = await db.finishedStock.where('brickSize').equals(brickSize).first();
    if (stockRow) {
      await db.finishedStock.update(stockRow.id, {
        currentStock: round2(stockRow.currentStock - quantity),
      });
    }

    const id = await db.salesLog.add({
      date,
      customerId,
      brickSize,
      quantity,
      rate,
      totalAmount,
      amountPaid: paid,
      balanceDue,
      paymentStatus,
      paymentChannel,
      createdAt: new Date().toISOString(),
    });

    const customer = await db.customers.get(customerId);
    if (customer) {
      await db.customers.update(customerId, {
        outstandingBalance: round2((customer.outstandingBalance || 0) + balanceDue),
      });
    }

    return { id, totalAmount, balanceDue, paymentStatus };
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
 * Records a payment received against an existing sale (reduces balanceDue
 * on that sale and the customer's overall outstanding balance).
 */
export async function recordSalePayment(saleId, amount, paymentChannel) {
  return db.transaction('rw', db.salesLog, db.customers, async () => {
    const sale = await db.salesLog.get(saleId);
    if (!sale) throw new Error('Sale record not found.');

    const newPaid = round2(sale.amountPaid + amount);
    const newBalance = round2(sale.totalAmount - newPaid);
    const newStatus = derivePaymentStatus(sale.totalAmount, newPaid);

    await db.salesLog.update(saleId, {
      amountPaid: newPaid,
      balanceDue: newBalance,
      paymentStatus: newStatus,
      paymentChannel,
    });

    const customer = await db.customers.get(sale.customerId);
    if (customer) {
      await db.customers.update(sale.customerId, {
        outstandingBalance: round2((customer.outstandingBalance || 0) - amount),
      });
    }

    return { newPaid, newBalance, newStatus };
  });
}

/**
 * Records a payment made against an existing purchase.
 */
export async function recordPurchasePayment(purchaseId, amount, paymentChannel) {
  return db.transaction('rw', db.purchaseLog, db.suppliers, async () => {
    const purchase = await db.purchaseLog.get(purchaseId);
    if (!purchase) throw new Error('Purchase record not found.');

    const newPaid = round2(purchase.amountPaid + amount);
    const newBalance = round2(purchase.totalAmount - newPaid);
    const newStatus = derivePaymentStatus(purchase.totalAmount, newPaid);

    await db.purchaseLog.update(purchaseId, {
      amountPaid: newPaid,
      balanceDue: newBalance,
      paymentStatus: newStatus,
      paymentChannel,
    });

    const supplier = await db.suppliers.get(purchase.supplierId);
    if (supplier) {
      await db.suppliers.update(purchase.supplierId, {
        outstandingBalance: round2((supplier.outstandingBalance || 0) - amount),
      });
    }

    return { newPaid, newBalance, newStatus };
  });
}

/**
 * Aging buckets — used by both Sales (receivables) and Purchases (payables)
 * to flag overdue accounts. dueDays defaults to 30.
 */
export function calculateAgingDays(transactionDate) {
  const txDate = new Date(transactionDate);
  const today = new Date();
  const diffMs = today.setHours(0, 0, 0, 0) - txDate.setHours(0, 0, 0, 0);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function agingBucket(days) {
  if (days <= 15) return { label: '0-15 days', tone: 'fresh' };
  if (days <= 30) return { label: '16-30 days', tone: 'watch' };
  if (days <= 60) return { label: '31-60 days', tone: 'overdue' };
  return { label: '60+ days', tone: 'critical' };
}

export async function addCustomerCollection(customerId, amount, paymentChannel, date, remarks = '') {
  if (!customerId) throw new Error('A customer must be selected.');
  if (!amount || amount <= 0) throw new Error('Amount must be greater than zero.');
  const paymentDate = date || new Date().toISOString().split('T')[0];

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
  const paymentDate = date || new Date().toISOString().split('T')[0];

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
  return db.transaction('rw', db.productionLog, db.finishedStock, async () => {
    const log = await db.productionLog.get(productionId);
    if (!log) throw new Error('Production record not found.');

    const stock = await db.finishedStock.where('brickSize').equals(log.brickSize).first();
    if (!stock || stock.currentStock < log.quantity) {
      throw new Error('Cannot delete: Finished goods have already been sold (insufficient stock to revert).');
    }

    await db.finishedStock.update(stock.id, {
      currentStock: round2(stock.currentStock - log.quantity),
    });

    await db.productionLog.delete(productionId);
  });
}

export async function deleteSale(saleId) {
  return db.transaction('rw', db.salesLog, db.finishedStock, db.customers, db.customerCollections, async () => {
    const sale = await db.salesLog.get(saleId);
    if (!sale) throw new Error('Sale record not found.');

    // Check if there are collections after this sale
    const collections = await db.customerCollections
      .where('customerId').equals(sale.customerId)
      .toArray();
      
    const collectionsAfterSale = collections.filter(c => c.createdAt >= sale.createdAt);

    if (collectionsAfterSale.length > 0) {
      throw new Error('Cannot delete: Collections have been recorded after this sale.');
    }

    const stock = await db.finishedStock.where('brickSize').equals(sale.brickSize).first();
    if (stock) {
      await db.finishedStock.update(stock.id, {
        currentStock: round2(stock.currentStock + sale.quantity),
      });
    }

    const customer = await db.customers.get(sale.customerId);
    if (customer) {
      await db.customers.update(customer.id, {
        outstandingBalance: round2(customer.outstandingBalance - sale.balanceDue),
      });
    }

    await db.salesLog.delete(saleId);
  });
}

export async function deleteCustomerCollection(collectionId) {
  return db.transaction('rw', db.customerCollections, db.customers, async () => {
    const col = await db.customerCollections.get(collectionId);
    if (!col) throw new Error('Collection not found.');

    const customer = await db.customers.get(col.customerId);
    if (customer) {
      await db.customers.update(customer.id, {
        outstandingBalance: round2(customer.outstandingBalance + col.amount),
      });
    }

    await db.customerCollections.delete(collectionId);
  });
}

export async function deletePurchase(purchaseId) {
  return db.transaction('rw', db.purchaseLog, db.rawMaterials, db.suppliers, db.supplierPayments, async () => {
    const purchase = await db.purchaseLog.get(purchaseId);
    if (!purchase) throw new Error('Purchase record not found.');

    // Check if there are payments after this purchase
    const payments = await db.supplierPayments
      .where('supplierId').equals(purchase.supplierId)
      .toArray();
      
    const paymentsAfterPurchase = payments.filter(p => p.createdAt >= purchase.createdAt);

    if (paymentsAfterPurchase.length > 0) {
      throw new Error('Cannot delete: Payments have been recorded after this purchase.');
    }

    const material = await db.rawMaterials.get(purchase.materialId);
    if (material) {
      if (material.currentStock < purchase.quantity) {
        throw new Error('Cannot delete: Material has already been used in production.');
      }
      
      const existingValue = material.currentStock * material.avgRate;
      const removedValue = purchase.quantity * purchase.rate;
      const newQty = material.currentStock - purchase.quantity;
      const newAvgRate = newQty > 0 ? round2((existingValue - removedValue) / newQty) : 0;
      
      await db.rawMaterials.update(material.id, {
        currentStock: round2(newQty),
        avgRate: newAvgRate,
      });
    }

    const supplier = await db.suppliers.get(purchase.supplierId);
    if (supplier) {
      await db.suppliers.update(supplier.id, {
        outstandingBalance: round2(supplier.outstandingBalance - purchase.balanceDue),
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
        outstandingBalance: round2(supplier.outstandingBalance + pmt.amount),
      });
    }

    await db.supplierPayments.delete(paymentId);
  });
}
