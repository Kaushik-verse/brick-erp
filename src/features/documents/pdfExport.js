import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import { formatDateDisplay } from '../../core/utils/format';
import { calculateAgingDays } from '../../core/db/ledgerEngine';

/**
 * pdfExport.js
 * -------------
 * Generates executive-tier PDF documents: customer statements and sale
 * invoices. Design language is deliberately restrained — deep charcoal /
 * navy ink on white, strict grid rules, no flashy color — matching the
 * "professional business reporting" requirement precisely.
 *
 * IMPORTANT — jspdf-autotable import pattern (verified working):
 * The package's standalone `autoTable(doc, opts)` function export has a
 * dual-package (CJS/ESM) interop hazard where `import autoTable from
 * 'jspdf-autotable'` can resolve to a non-callable object instead of the
 * actual function, depending on the bundler/runtime — this was tested
 * and confirmed to throw `TypeError: autoTable is not a function` /
 * `... is not a function` at runtime. The fix used here — calling
 * `applyPlugin(jsPDF)` once at module load, then using `doc.autoTable(opts)`
 * as an instance method — is jsPDF-autotable's own documented usage
 * pattern and does not depend on that fragile export shape.
 *
 * Likewise `import jsPDF from 'jspdf'` (default import) is unreliable —
 * the package exports `jsPDF` as a NAMED export, with `default` only
 * sometimes aliasing it depending on interop settings. The named import
 * below is the form documented by jsPDF itself and was verified to work.
 */
applyPlugin(jsPDF);

const INK = [30, 32, 38];        // near-black charcoal text
const RULE = [210, 213, 219];    // hairline grey rules
const ACCENT = [27, 41, 71];     // deep navy for headers/totals

/**
 * jsPDF's built-in fonts (helvetica/times/courier) are the 14 standard
 * PDF base fonts and do NOT include the ₹ (Indian Rupee, U+20B9) glyph —
 * rendering it directly produces a blank box or garbled character in
 * many PDF viewers. Amounts inside generated PDFs use "Rs." instead for
 * this reason. The in-app UI everywhere else still uses the real ₹
 * symbol via formatINR — this swap is local to PDF output only.
 */
function pdfCurrency(amount) {
  const n = Number(amount) || 0;
  const formatted = n.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return `Rs. ${formatted}`;
}

function drawLetterhead(doc, factoryName, factoryAddress, factoryPhone) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...ACCENT);
  doc.text(factoryName || 'Brick Factory', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 114, 122);
  let y = 24;
  if (factoryAddress) {
    doc.text(factoryAddress, 14, y);
    y += 4.5;
  }
  if (factoryPhone) {
    doc.text(`Phone: ${factoryPhone}`, 14, y);
    y += 4.5;
  }

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  doc.line(14, y + 2, 196, y + 2);
  return y + 8;
}

function drawFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Add page border
    doc.setLineWidth(0.5);
    doc.setDrawColor(...RULE);
    doc.rect(8, 8, 194, 281);

    doc.setFontSize(8);
    doc.setTextColor(150, 153, 160);
    doc.text(
      `Generated ${formatDateDisplay(new Date().toISOString())} - Page ${i} of ${pageCount}`,
      14,
      284
    );
  }
}

function drawSignaturesAndTerms(doc, y) {
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(8);
  doc.setTextColor(110, 114, 122);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions:', 14, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text('1. Goods once sold will not be taken back.', 14, y + 14);
  doc.text('2. Subject to local jurisdiction.', 14, y + 18);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...ACCENT);
  doc.text('Authorized Signatory', 160, y + 20);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  doc.line(150, y + 16, 196, y + 16);
  return y + 25;
}

/**
 * Generates an advanced multi-item sales invoice matching traditional Indian factory layouts.
 * Supports an array of items, optional transport/loading charges, and GST.
 * @param {object} params
 * @param {object} params.invoice - { invoiceNumber, date, type (CASH BILL / CREDIT BILL) }
 * @param {array} params.items - [{ description, quantity, rate, amount }]
 * @param {object} params.summary - { subtotal, transport, loading, unloading, discount, cgst, sgst, igst, grandTotal, amountPaid, balanceDue, paymentStatus, paymentChannel }
 * @param {object} params.customer - { name, phone, address }
 * @param {object} params.vehicle - { vehicleNumber, driverName, driverPhone } (optional)
 * @param {object} params.factory - Settings map with gstin, businessCategories, bankName, etc.
 */
export function generateInvoicePDF({ invoice, items, summary, customer, vehicle, factory }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 10;
  
  // Outer Border
  doc.setLineWidth(0.5);
  doc.setDrawColor(...RULE);
  doc.rect(8, 8, 194, 281);
  
  // ---- HEADER SECTION ----
  doc.setFontSize(10);
  doc.setTextColor(110, 114, 122);
  if (factory.gstin) {
    doc.text(`GSTIN: ${factory.gstin}`, 14, y + 5);
  }
  
  // Right side tags
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text(invoice.type || 'CASH BILL', 170, y + 5);
  
  y += 12;
  
  // Factory Name (Center)
  doc.setFontSize(20);
  doc.setTextColor(...ACCENT);
  const factoryText = factory.factoryName || 'Brick Factory';
  const nameWidth = doc.getTextWidth(factoryText);
  doc.text(factoryText, (210 - nameWidth) / 2, y);
  
  y += 5;
  
  // Business Categories
  if (factory.businessCategories) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 114, 122);
    const catText = factory.businessCategories;
    const catWidth = doc.getTextWidth(catText);
    doc.text(catText, (210 - catWidth) / 2, y);
    y += 5;
  }
  
  // Address & Phone
  doc.setFontSize(9);
  const addressText = factory.factoryAddress || '';
  const phoneText = factory.factoryPhone ? `Mobile: ${factory.factoryPhone}` : '';
  const contactLine = [addressText, phoneText].filter(Boolean).join(' | ');
  if (contactLine) {
    const contactWidth = doc.getTextWidth(contactLine);
    doc.text(contactLine, (210 - contactWidth) / 2, y);
  }
  
  y += 4;
  
  // Horizontal Rule
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  doc.line(8, y, 202, y);
  
  y += 6;
  
  // ---- CUSTOMER & VEHICLE SECTION ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  
  // Left: Customer
  doc.text(`Bill No: ${invoice.invoiceNumber}`, 14, y);
  doc.text(`Date: ${formatDateDisplay(invoice.date)}`, 14, y + 5);
  doc.text(`M/S: ${customer?.name || 'Walk-in Customer'}`, 14, y + 10);
  doc.setFont('helvetica', 'normal');
  if (customer?.address) doc.text(customer.address, 14, y + 15);
  if (customer?.phone) doc.text(`Phone: ${customer.phone}`, 14, y + 20);
  
  // Right: Vehicle
  if (vehicle && (vehicle.vehicleNumber || vehicle.driverName)) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Vehicle No: ${vehicle.vehicleNumber || '-'}`, 130, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Driver: ${vehicle.driverName || '-'}`, 130, y + 5);
    if (vehicle.driverPhone) doc.text(`Driver Ph: ${vehicle.driverPhone}`, 130, y + 10);
  }
  
  y += 26;
  
  // ---- ITEM TABLE ----
  const tableData = items.map((item, index) => [
    index + 1,
    item.description,
    item.quantity,
    pdfCurrency(item.rate),
    pdfCurrency(item.amount)
  ]);
  
  doc.autoTable({
    startY: y,
    head: [['S.No', 'Type of Brick', 'Quantity (Pcs)', 'Unit Price', 'Amount']],
    body: tableData,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9.5, textColor: INK, cellPadding: 3 },
    headStyles: {
      fillColor: ACCENT,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'left' },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 },
      4: { halign: 'right', cellWidth: 35 },
    },
    tableLineColor: RULE,
    tableLineWidth: 0.2,
    margin: { left: 10, right: 10 }
  });
  
  let finalY = doc.lastAutoTable.finalY + 2;
  
  // ---- SUMMARY SECTION ----
  const summaryRows = [];
  if (summary.subtotal && summary.subtotal !== summary.grandTotal) {
    summaryRows.push(['Subtotal', pdfCurrency(summary.subtotal)]);
  }
  if (summary.transport) summaryRows.push(['Transport Charges', pdfCurrency(summary.transport)]);
  if (summary.loading) summaryRows.push(['Loading Charges', pdfCurrency(summary.loading)]);
  if (summary.unloading) summaryRows.push(['Unloading Charges', pdfCurrency(summary.unloading)]);
  if (summary.discount) summaryRows.push(['Discount', `-${pdfCurrency(summary.discount)}`]);
  if (summary.cgst) summaryRows.push(['CGST', pdfCurrency(summary.cgst)]);
  if (summary.sgst) summaryRows.push(['SGST', pdfCurrency(summary.sgst)]);
  if (summary.igst) summaryRows.push(['IGST', pdfCurrency(summary.igst)]);
  
  summaryRows.push(['Grand Total', pdfCurrency(summary.grandTotal)]);
  
  doc.autoTable({
    startY: finalY,
    body: summaryRows,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'right', cellWidth: 140, textColor: [110, 114, 122] },
      1: { halign: 'right', cellWidth: 44, fontStyle: 'bold', textColor: ACCENT },
    },
    margin: { left: 10, right: 10 }
  });
  
  finalY = doc.lastAutoTable.finalY + 8;
  
  // ---- PAYMENT INFO ----
  doc.setFontSize(9);
  doc.setTextColor(110, 114, 122);
  doc.text(`Payment Status: ${(summary.paymentStatus || 'pending').toUpperCase()} (${summary.paymentChannel || 'N/A'})`, 14, finalY);
  
  if (summary.balanceDue > 0) {
    doc.setTextColor(...ACCENT);
    doc.text(`Amount Paid: ${pdfCurrency(summary.amountPaid)}`, 14, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Balance Due: ${pdfCurrency(summary.balanceDue)}`, 14, finalY + 10);
  }
  
  finalY += 20;
  
  // Check page break for footer
  if (finalY > 230) {
    doc.addPage();
    doc.setLineWidth(0.5);
    doc.setDrawColor(...RULE);
    doc.rect(8, 8, 194, 281);
    finalY = 20;
  }
  
  // ---- FOOTER BLOCK ----
  // Bank Details (Left)
  if (factory.bankName || factory.upiId) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text('Bank Details:', 14, finalY);
    doc.setFont('helvetica', 'normal');
    let by = finalY + 5;
    if (factory.bankName) { doc.text(`Bank: ${factory.bankName}`, 14, by); by += 5; }
    if (factory.accountNumber) { doc.text(`A/C No: ${factory.accountNumber}`, 14, by); by += 5; }
    if (factory.ifscCode) { doc.text(`IFSC: ${factory.ifscCode}`, 14, by); by += 5; }
    if (factory.upiId) { doc.text(`UPI: ${factory.upiId}`, 14, by); by += 5; }
  }
  
  // Terms & Conditions (Middle)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(110, 114, 122);
  doc.text('Terms & Conditions:', 80, finalY);
  doc.setFont('helvetica', 'normal');
  doc.text('1. Goods once sold will not be taken back.', 80, finalY + 5);
  doc.text('2. Payment within agreed credit period.', 80, finalY + 10);
  doc.text('3. Delay attracts interest as agreed.', 80, finalY + 15);
  doc.text('4. Subject to local jurisdiction.', 80, finalY + 20);
  
  // Signature (Right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ACCENT);
  const sigText = 'For ' + (factory.factoryName || 'Jaya Vasavi Industries');
  const sigWidth = doc.getTextWidth(sigText);
  doc.text(sigText, 190 - sigWidth, finalY);
  
  doc.setFontSize(8);
  doc.setTextColor(150, 153, 160);
  doc.text('Authorized Signature', 190 - doc.getTextWidth('Authorized Signature'), finalY + 20);
  
  doc.setDrawColor(...RULE);
  doc.line(140, finalY + 16, 194, finalY + 16);
  
  drawFooter(doc);
  return doc.output('blob');
}

/**
 * Generates a customer (or supplier) statement PDF listing all
 * transactions with running aging and a closing balance summary.
 */
export function generateStatementPDF({ party, transactions, factory, type = 'customer' }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = drawLetterhead(doc, factory.factoryName, factory.factoryAddress, factory.factoryPhone);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(
    type === 'customer' ? 'ACCOUNT STATEMENT' : 'SUPPLIER PAYABLE STATEMENT',
    14,
    y + 4
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`${type === 'customer' ? 'Customer' : 'Supplier'}: ${party.name}`, 14, y + 11);
  if (party.phone) doc.text(`Phone: ${party.phone}`, 14, y + 16);
  doc.text(`Statement Date: ${formatDateDisplay(new Date().toISOString())}`, 140, y + 11);

  y += 24;

  const safeTransactions = transactions || [];
  const rows = safeTransactions.map((t) => {
    const aging = calculateAgingDays(t.date);
    const desc =
      type === 'customer' ? `${t.quantity} x ${t.brickSize} bricks` : 'Material purchase';
    return [
      formatDateDisplay(t.date),
      desc,
      pdfCurrency(t.totalAmount),
      pdfCurrency(t.amountPaid),
      pdfCurrency(t.balanceDue),
      `${aging}d`,
    ];
  });

  doc.autoTable({
    startY: y,
    head: [['Date', 'Description', 'Total', 'Paid', 'Balance', 'Aging']],
    body: rows.length ? rows : [['-', 'No transactions yet', '-', '-', '-', '-']],
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8.5, textColor: INK, cellPadding: 2.5 },
    headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    tableLineColor: RULE,
    tableLineWidth: 0.15,
  });

  let finalY = doc.lastAutoTable.finalY + 8;
  const totalOutstanding = safeTransactions.reduce((s, t) => s + t.balanceDue, 0);

  doc.setDrawColor(...RULE);
  doc.line(120, finalY, 196, finalY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...ACCENT);
  doc.text('Total Outstanding:', 120, finalY + 7);
  doc.text(pdfCurrency(totalOutstanding), 196, finalY + 7, { align: 'right' });

  finalY += 15;
  drawSignaturesAndTerms(doc, finalY);

  drawFooter(doc);
  return doc.output('blob');
}
