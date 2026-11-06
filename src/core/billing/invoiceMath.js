/**
 * invoiceMath.js
 * ---------------
 * GST-aware invoice totals. One function used by the Invoice Builder
 * screen, the saved sale record and the PDF, so the numbers always match.
 *
 * gstMode:
 *   'none'      — no tax shown (default; behaves like the app always did)
 *   'exclusive' — rates are BEFORE tax; GST is added on top
 *   'inclusive' — rates already INCLUDE tax; GST is shown as a breakup
 *
 * Extra charges (transport, loading…) are treated as part of the same
 * supply and taxed at the same rate, as is standard for delivered goods.
 * Intra-state supply → CGST + SGST (half each); inter-state → IGST.
 */
const r2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

export function computeInvoiceTotals({ items = [], charges = {}, gstMode = 'none', gstRate = 0, interState = false }) {
  const rate = gstMode === 'none' ? 0 : Math.max(0, Number(gstRate) || 0);

  const lines = items.map((it) => {
    const qty = Number(it.quantity) || 0;
    const unitRate = Number(it.rate) || 0;
    const gross = it.amount !== undefined && it.amount !== '' ? Number(it.amount) || 0 : qty * unitRate;
    const taxable = gstMode === 'inclusive' && rate ? gross / (1 + rate / 100) : gross;
    return { ...it, quantity: qty, rate: unitRate, amount: r2(gross), taxable: r2(taxable) };
  });

  const chargeList = [
    ['Transport Charges', charges.transport],
    ['Loading Charges', charges.loading],
    ['Unloading Charges', charges.unloading],
    ['Other Charges', charges.other],
  ]
    .map(([label, v]) => ({ label, amount: r2(v) }))
    .filter((c) => c.amount);

  const itemsGross = r2(lines.reduce((s, l) => s + l.amount, 0));
  const chargesGross = r2(chargeList.reduce((s, c) => s + c.amount, 0));
  const gross = itemsGross + chargesGross;

  let taxable;
  let tax;
  if (!rate) {
    taxable = gross;
    tax = 0;
  } else if (gstMode === 'inclusive') {
    taxable = r2(gross / (1 + rate / 100));
    tax = r2(gross - taxable);
  } else {
    taxable = gross;
    tax = r2((gross * rate) / 100);
  }

  const cgst = interState ? 0 : r2(tax / 2);
  const sgst = interState ? 0 : r2(tax - cgst);
  const igst = interState ? tax : 0;

  const exact = gstMode === 'inclusive' ? gross : taxable + tax;
  const grandTotal = Math.round(exact);
  const roundOff = r2(grandTotal - exact);

  return {
    lines,
    charges: chargeList,
    itemsTotal: itemsGross,
    chargesTotal: chargesGross,
    taxableValue: r2(taxable),
    gstMode,
    gstRate: rate,
    interState,
    cgst,
    sgst,
    igst,
    totalTax: r2(tax),
    roundOff,
    grandTotal,
  };
}
