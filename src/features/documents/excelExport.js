import ExcelJS from 'exceljs';
import { calculateAgingDays } from '../../core/db/ledgerEngine';
import { saveAndShareBlob } from '../../core/utils/nativeFileBridge';

/**
 * excelExport.js
 * ---------------
 * Generates structured Excel workbooks for sales, purchases, and
 * inventory valuation. Implements:
 *  - Frozen header row
 *  - Auto-fitted column widths
 *  - SUM / SUBTOTAL formulas (uppercase, as specified)
 *  - ₹ currency number format
 *  - Pastel conditional fills for payment status:
 *      🟢 #E2EFDA settled · 🟡 #FFF2CC partial · 🔴 #FCE4D6 overdue
 *
 * SAVING: each export function builds the workbook, then hands the
 * resulting Blob to `saveAndShareBlob` (core/utils/nativeFileBridge) —
 * the SAME path used by PDF exports. Earlier this module called
 * `file-saver`'s `saveAs()` directly, which only triggers a plain
 * `<a download>` click. That has no reliable effect inside a Capacitor
 * Android WebView (there's no browser "Downloads" UI to catch it), which
 * was a real reason exports could silently appear to do nothing on
 * device. Routing through the Filesystem+Share native bridge fixes that
 * and gives the user an actual share sheet, matching PDF behavior.
 */

const FILL_PAID = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
const FILL_PARTIAL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
const FILL_OVERDUE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2947' } };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
const CURRENCY_FMT = '"₹"#,##0.00';

function statusFill(status, agingDays) {
  if (status === 'paid') return FILL_PAID;
  if (status === 'partial') return FILL_PARTIAL;
  if (status === 'credit' && agingDays > 30) return FILL_OVERDUE;
  if (status === 'credit') return FILL_PARTIAL;
  return undefined;
}

function autoFitColumns(worksheet) {
  worksheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 3, 40);
  });
}

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  row.height = 22;
}

/**
 * Exports the Sales Ledger as an Excel workbook with conditional
 * status highlighting and a SUBTOTAL-powered summary row.
 */
export async function exportSalesLedgerExcel(sales, customersById) {
  const safeSales = sales || [];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Brick ERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Sales Ledger', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Customer', key: 'customer', width: 22 },
    { header: 'Brick Size', key: 'brickSize', width: 12 },
    { header: 'Quantity', key: 'quantity', width: 11 },
    { header: 'Rate (₹)', key: 'rate', width: 11 },
    { header: 'Total Amount', key: 'totalAmount', width: 14 },
    { header: 'Amount Paid', key: 'amountPaid', width: 14 },
    { header: 'Balance Due', key: 'balanceDue', width: 14 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Aging (days)', key: 'aging', width: 12 },
    { header: 'Channel', key: 'channel', width: 12 },
  ];
  styleHeaderRow(sheet.getRow(1));

  safeSales.forEach((s) => {
    const aging = calculateAgingDays(s.date);
    const row = sheet.addRow({
      date: s.date,
      customer: customersById[s.customerId]?.name || 'Unknown',
      brickSize: s.brickSize,
      quantity: s.quantity,
      rate: s.rate,
      totalAmount: s.totalAmount,
      amountPaid: s.amountPaid,
      balanceDue: s.balanceDue,
      status: s.paymentStatus.toUpperCase(),
      aging,
      channel: s.paymentChannel === 'cash' ? 'Cash' : 'Bank/UPI',
    });

    ['rate', 'totalAmount', 'amountPaid', 'balanceDue'].forEach((key) => {
      row.getCell(key).numFmt = CURRENCY_FMT;
    });

    const fill = statusFill(s.paymentStatus, aging);
    if (fill) {
      ['status', 'balanceDue', 'aging'].forEach((key) => {
        row.getCell(key).fill = fill;
      });
    }
  });

  if (safeSales.length > 0) {
    const dataRowCount = safeSales.length;
    const totalRowIdx = dataRowCount + 2;

    sheet.getCell(`E${totalRowIdx}`).value = 'TOTALS';
    sheet.getCell(`E${totalRowIdx}`).font = { bold: true };
    sheet.getCell(`F${totalRowIdx}`).value = { formula: `SUBTOTAL(9,F2:F${dataRowCount + 1})` };
    sheet.getCell(`G${totalRowIdx}`).value = { formula: `SUBTOTAL(9,G2:G${dataRowCount + 1})` };
    sheet.getCell(`H${totalRowIdx}`).value = { formula: `SUBTOTAL(9,H2:H${dataRowCount + 1})` };
    ['F', 'G', 'H'].forEach((col) => {
      sheet.getCell(`${col}${totalRowIdx}`).numFmt = CURRENCY_FMT;
      sheet.getCell(`${col}${totalRowIdx}`).font = { bold: true };
    });
  }

  autoFitColumns(sheet);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  await saveAndShareBlob(blob, `sales_ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports the Purchase Ledger / Payables as an Excel workbook.
 */
export async function exportPurchaseLedgerExcel(purchases, suppliersById, materialsById) {
  const safePurchases = purchases || [];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Purchase Ledger', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Supplier', key: 'supplier', width: 22 },
    { header: 'Material', key: 'material', width: 16 },
    { header: 'Quantity', key: 'quantity', width: 11 },
    { header: 'Rate (₹)', key: 'rate', width: 11 },
    { header: 'Total Amount', key: 'totalAmount', width: 14 },
    { header: 'Amount Paid', key: 'amountPaid', width: 14 },
    { header: 'Balance Due', key: 'balanceDue', width: 14 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Aging (days)', key: 'aging', width: 12 },
  ];
  styleHeaderRow(sheet.getRow(1));

  safePurchases.forEach((p) => {
    const aging = calculateAgingDays(p.date);
    const row = sheet.addRow({
      date: p.date,
      supplier: suppliersById[p.supplierId]?.name || 'Unknown',
      material: materialsById[p.materialId]?.name || 'Unknown',
      quantity: p.quantity,
      rate: p.rate,
      totalAmount: p.totalAmount,
      amountPaid: p.amountPaid,
      balanceDue: p.balanceDue,
      status: p.paymentStatus.toUpperCase(),
      aging,
    });

    ['rate', 'totalAmount', 'amountPaid', 'balanceDue'].forEach((key) => {
      row.getCell(key).numFmt = CURRENCY_FMT;
    });

    const fill = statusFill(p.paymentStatus, aging);
    if (fill) {
      ['status', 'balanceDue', 'aging'].forEach((key) => {
        row.getCell(key).fill = fill;
      });
    }
  });

  if (safePurchases.length > 0) {
    const dataRowCount = safePurchases.length;
    const totalRowIdx = dataRowCount + 2;
    sheet.getCell(`E${totalRowIdx}`).value = 'TOTALS';
    sheet.getCell(`E${totalRowIdx}`).font = { bold: true };
    sheet.getCell(`F${totalRowIdx}`).value = { formula: `SUBTOTAL(9,F2:F${dataRowCount + 1})` };
    sheet.getCell(`G${totalRowIdx}`).value = { formula: `SUBTOTAL(9,G2:G${dataRowCount + 1})` };
    sheet.getCell(`H${totalRowIdx}`).value = { formula: `SUBTOTAL(9,H2:H${dataRowCount + 1})` };
    ['F', 'G', 'H'].forEach((col) => {
      sheet.getCell(`${col}${totalRowIdx}`).numFmt = CURRENCY_FMT;
      sheet.getCell(`${col}${totalRowIdx}`).font = { bold: true };
    });
  }

  autoFitColumns(sheet);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  await saveAndShareBlob(blob, `purchase_ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports current inventory valuation (raw materials + finished stock)
 * as a single workbook with two sheets.
 */
export async function exportInventoryValuationExcel(rawMaterials, finishedStock) {
  const safeRaw = rawMaterials || [];
  const safeFinished = finishedStock || [];
  const workbook = new ExcelJS.Workbook();

  const rawSheet = workbook.addWorksheet('Raw Materials', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  rawSheet.columns = [
    { header: 'Material', key: 'name', width: 18 },
    { header: 'Unit', key: 'unit', width: 8 },
    { header: 'Current Stock', key: 'stock', width: 14 },
    { header: 'Avg Rate (₹)', key: 'rate', width: 13 },
    { header: 'Stock Value', key: 'value', width: 14 },
    { header: 'Reorder Level', key: 'reorder', width: 14 },
  ];
  styleHeaderRow(rawSheet.getRow(1));

  safeRaw.forEach((m) => {
    const row = rawSheet.addRow({
      name: m.name,
      unit: m.unit,
      stock: m.currentStock,
      rate: m.avgRate,
      value: m.currentStock * m.avgRate,
      reorder: m.reorderLevel,
    });
    row.getCell('rate').numFmt = CURRENCY_FMT;
    row.getCell('value').numFmt = CURRENCY_FMT;
    if (m.currentStock < m.reorderLevel) {
      row.getCell('stock').fill = FILL_OVERDUE;
    }
  });

  if (safeRaw.length > 0) {
    const rawTotalRow = safeRaw.length + 2;
    rawSheet.getCell(`D${rawTotalRow}`).value = 'TOTAL VALUE';
    rawSheet.getCell(`D${rawTotalRow}`).font = { bold: true };
    rawSheet.getCell(`E${rawTotalRow}`).value = { formula: `SUM(E2:E${safeRaw.length + 1})` };
    rawSheet.getCell(`E${rawTotalRow}`).numFmt = CURRENCY_FMT;
    rawSheet.getCell(`E${rawTotalRow}`).font = { bold: true };
  }
  autoFitColumns(rawSheet);

  const finishedSheet = workbook.addWorksheet('Finished Stock', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  finishedSheet.columns = [
    { header: 'Brick Size', key: 'size', width: 14 },
    { header: 'Current Stock', key: 'stock', width: 14 },
    { header: 'Cost Price (₹)', key: 'cost', width: 14 },
    { header: 'Selling Price (₹)', key: 'sell', width: 16 },
    { header: 'Stock Value (Cost)', key: 'value', width: 18 },
  ];
  styleHeaderRow(finishedSheet.getRow(1));

  safeFinished.forEach((f) => {
    const row = finishedSheet.addRow({
      size: f.brickSize,
      stock: f.currentStock,
      cost: f.costPrice,
      sell: f.sellingPrice,
      value: f.currentStock * f.costPrice,
    });
    row.getCell('cost').numFmt = CURRENCY_FMT;
    row.getCell('sell').numFmt = CURRENCY_FMT;
    row.getCell('value').numFmt = CURRENCY_FMT;
  });

  if (safeFinished.length > 0) {
    const finishedTotalRow = safeFinished.length + 2;
    finishedSheet.getCell(`D${finishedTotalRow}`).value = 'TOTAL VALUE';
    finishedSheet.getCell(`D${finishedTotalRow}`).font = { bold: true };
    finishedSheet.getCell(`E${finishedTotalRow}`).value = {
      formula: `SUM(E2:E${safeFinished.length + 1})`,
    };
    finishedSheet.getCell(`E${finishedTotalRow}`).numFmt = CURRENCY_FMT;
    finishedSheet.getCell(`E${finishedTotalRow}`).font = { bold: true };
  }
  autoFitColumns(finishedSheet);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  await saveAndShareBlob(blob, `inventory_valuation_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
