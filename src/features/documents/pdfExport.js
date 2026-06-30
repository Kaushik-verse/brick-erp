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
 * Generates an advanced multi-item sales invoice with a PREMIUM MODERN design.
 * Features Material 3 aesthetics: Rounded cards, soft colors, status badges.
 */
export function generateInvoicePDF({ invoice, items: passedItems, summary, customer, vehicle, factory, settings }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  
  // Colors for Modern Design
  const PRIMARY = [198, 93, 46]; // #C65D2E Brick Orange
  const DARK = [30, 41, 59]; // #1E293B Slate 800
  const GRAY = [100, 116, 139]; // #64748B Slate 500
  const LIGHT_GRAY = [241, 245, 249]; // #F1F5F9 Slate 100
  
  let y = 15;
  
  // ---- PREMIUM HEADER ----
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(10, y, 190, 40, 3, 3, 'F');
  
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY);
  const factoryText = factory.factoryName || 'Brick Factory';
  doc.text(factoryText, 15, y + 15);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  if (settings?.showBusinessDescription !== '0' && factory.businessCategories) {
    doc.text(factory.businessCategories, 15, y + 22);
  }
  
  // Right side of Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('INVOICE', 195, y + 15, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`Invoice No: ${invoice.invoiceNumber || 'INV-0001'}`, 195, y + 23, { align: 'right' });
  doc.text(`Date: ${formatDateDisplay(invoice.date)}`, 195, y + 28, { align: 'right' });
  if (factory.gstin) {
    doc.text(`GSTIN: ${factory.gstin}`, 195, y + 33, { align: 'right' });
  }

  y += 50;

  // ---- CUSTOMER DETAILS (Left) & VEHICLE (Right) ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text('BILL TO:', 15, y);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(customer?.name || 'Walk-in Customer', 15, y + 6);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  let cy = y + 12;
  if (customer?.phone) { doc.text(`Phone: ${customer.phone}`, 15, cy); cy += 5; }
  if (customer?.address) { doc.text(customer.address, 15, cy); }

  // Vehicle / Additional info (Right)
  if (vehicle && (vehicle.vehicleNumber || vehicle.driverName || vehicle.salesPerson)) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text('DELIVERY DETAILS:', 120, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    let vy = y + 6;
    if (settings?.showVehicleNumber !== '0' && vehicle.vehicleNumber) { doc.text(`Vehicle: ${vehicle.vehicleNumber}`, 120, vy); vy += 5; }
    if (settings?.showDriverName !== '0' && vehicle.driverName) { doc.text(`Driver: ${vehicle.driverName}`, 120, vy); vy += 5; }
    if (settings?.showSalesPerson !== '0' && vehicle.salesPerson) { doc.text(`Sales: ${vehicle.salesPerson}`, 120, vy); vy += 5; }
  }

  y += 30;

  // ---- DYNAMIC PRODUCT TABLE ----
  // Normalize items array (handle legacy single-item structures)
  const itemsArray = passedItems && passedItems.length > 0 
    ? passedItems 
    : [{ description: invoice.brickSize, quantity: invoice.quantity, rate: invoice.rate, amount: invoice.totalAmount }];

  const tableData = itemsArray.map((item, index) => [
    (index + 1).toString().padStart(2, '0'),
    item.description || '-',
    item.quantity?.toLocaleString() || '0',
    pdfCurrency(item.rate),
    pdfCurrency(item.amount || (item.quantity * item.rate))
  ]);

  doc.autoTable({
    startY: y,
    head: [['#', 'Item Description', 'Qty', 'Rate', 'Amount']],
    body: tableData,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
    columnStyles: {
      0: { cellWidth: 15, textColor: GRAY },
      1: { cellWidth: 80, textColor: DARK, fontStyle: 'bold' },
      2: { halign: 'right', textColor: DARK },
      3: { halign: 'right', textColor: GRAY },
      4: { halign: 'right', textColor: DARK, fontStyle: 'bold' },
    },
    margin: { left: 10, right: 10 }
  });

  let finalY = doc.lastAutoTable.finalY + 10;

  // ---- SUMMARY SECTION (White Card with Shadow look) ----
  // To keep it simple in jsPDF, we draw a rounded rectangle
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(110, finalY, 90, 75, 3, 3, 'F');
  
  let sy = finalY + 8;
  const drawRow = (label, value, isBold = false, isAccent = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...(isAccent ? PRIMARY : (isBold ? DARK : GRAY)));
    doc.text(label, 115, sy);
    doc.text(value, 195, sy, { align: 'right' });
    sy += 7;
  };

  const stotal = summary.subtotal || itemsArray.reduce((sum, it) => sum + (it.amount || (it.quantity * it.rate)), 0);
  
  drawRow('Subtotal', pdfCurrency(stotal));
  
  if (settings?.showDiscount !== '0' && summary.discount) {
    drawRow('Discount', `-${pdfCurrency(summary.discount)}`, false, true);
  }
  
  if (settings?.showTransport !== '0' && summary.transportCharges) drawRow('Transport', pdfCurrency(summary.transportCharges));
  if (settings?.showLoading !== '0' && summary.loadingCharges) drawRow('Loading', pdfCurrency(summary.loadingCharges));
  if (settings?.showUnloading !== '0' && summary.unloadingCharges) drawRow('Unloading', pdfCurrency(summary.unloadingCharges));
  if (settings?.showOtherCharges !== '0' && summary.otherCharges) drawRow('Other', pdfCurrency(summary.otherCharges));
  
  if (settings?.showGST !== '0' && summary.cgst) {
    drawRow('CGST', pdfCurrency(summary.cgst));
    drawRow('SGST', pdfCurrency(summary.sgst));
  }

  // Grand Total Line
  sy += 2;
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.2);
  doc.line(115, sy - 5, 195, sy - 5);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Grand Total', 115, sy);
  doc.setTextColor(...PRIMARY);
  doc.text(pdfCurrency(summary.grandTotal || summary.totalAmount), 195, sy, { align: 'right' });

  // Paid / Balance
  sy += 8;
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text('Paid Amount', 115, sy);
  doc.text(pdfCurrency(summary.amountPaid), 195, sy, { align: 'right' });
  sy += 7;
  
  const bal = summary.balanceDue !== undefined ? summary.balanceDue : ((summary.grandTotal || summary.totalAmount) - summary.amountPaid);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Balance Due', 115, sy);
  doc.setTextColor(bal > 0 ? 239 : 34, bal > 0 ? 68 : 197, bal > 0 ? 68 : 94); // Red if > 0, Green if 0
  doc.text(pdfCurrency(bal), 195, sy, { align: 'right' });

  // ---- LEFT SIDE (QR, Bank, Payment Status) ----
  let leftY = finalY + 5;
  
  // Payment Status Badge
  const pStatus = summary.paymentStatus || (bal <= 0 ? 'paid' : (summary.amountPaid > 0 ? 'partial' : 'pending'));
  const badgeColor = pStatus === 'paid' ? [34, 197, 94] : pStatus === 'partial' ? [249, 115, 22] : [239, 68, 68];
  doc.setFillColor(...badgeColor);
  doc.roundedRect(15, leftY, 25, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(pStatus.toUpperCase(), 27.5, leftY + 5.5, { align: 'center' });
  
  leftY += 15;

  if (settings?.showBankDetails !== '0' && factory.accountNumber) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('BANK DETAILS', 15, leftY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`Bank: ${factory.bankName}`, 15, leftY + 5);
    doc.text(`A/C: ${factory.accountNumber}`, 15, leftY + 10);
    doc.text(`IFSC: ${factory.ifscCode}`, 15, leftY + 15);
    leftY += 25;
  }

  // QR Code Image
  if (settings?.showQRCode !== '0' && settings?.qrCodeImage) {
    try {
      doc.addImage(settings.qrCodeImage, 'JPEG', 15, leftY, 35, 35);
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text('Scan to Pay', 32.5, leftY + 39, { align: 'center' });
    } catch (e) {
      console.warn('Failed to embed QR code image', e);
    }
  }

  // ---- FOOTER & SIGNATURES ----
  const pageHeight = doc.internal.pageSize.getHeight();
  let footY = pageHeight - 35;
  
  if (settings?.showTerms !== '0') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text('Terms & Conditions:', 15, footY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text('1. Goods once sold will not be taken back.', 15, footY + 4);
    doc.text('2. Payment must be completed within agreed period.', 15, footY + 8);
  }

  if (settings?.showCompanySignature !== '0') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(`For ${factory.factoryName || 'Company'}`, 195, footY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text('Authorized Signatory', 195, footY + 15, { align: 'right' });
  }
  
  if (settings?.showCustomerSignature !== '0') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('Customer Signature', 100, footY + 15, { align: 'center' });
  }

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
