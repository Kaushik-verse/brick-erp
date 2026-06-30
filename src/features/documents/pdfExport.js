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

// Removed corrupted base64 PNG
export function generateInvoicePDF({ invoice, items: passedItems, summary, customer, vehicle, factory, settings }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  
  // Colors for Modern Design
  const PRIMARY = [198, 93, 46]; // #C65D2E Brick Orange
  const DARK = [30, 41, 59]; // #1E293B Slate 800
  const GRAY = [100, 116, 139]; // #64748B Slate 500
  const LIGHT_GRAY = [248, 250, 252]; // #F8FAFC Slate 50
  
  // Margin settings
  const marginLeft = 15;
  const marginRight = 195;
  const contentWidth = marginRight - marginLeft;
  
  let y = 15;
  
  // ---- WATERMARK ----
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.04 }));
  doc.setFontSize(40);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(factory.factoryName || 'JAYA VASAVI INDUSTRIES', 40, 150, { angle: 45 });
  doc.restoreGraphicsState();
  
  // ---- PREMIUM HEADER ----
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(marginLeft, y, contentWidth, 40, 3, 3, 'F');
  
  // Vector Brick Logo
  doc.setFillColor(...PRIMARY);
  doc.rect(marginLeft + 5, y + 9, 8, 5, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.line(marginLeft + 5, y + 11.5, marginLeft + 13, y + 11.5);
  doc.line(marginLeft + 9, y + 9, marginLeft + 9, y + 11.5);
  doc.line(marginLeft + 7, y + 11.5, marginLeft + 7, y + 14);
  doc.line(marginLeft + 11, y + 11.5, marginLeft + 11, y + 14);
  
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY);
  const factoryText = factory.factoryName || 'JAYA VASAVI INDUSTRIES';
  doc.text(factoryText, marginLeft + 16, y + 14);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  
  let leftHeaderY = y + 21;
  if (settings?.showBusinessDescription !== '0' && factory.businessCategories) {
    doc.text(factory.businessCategories, marginLeft + 5, leftHeaderY);
    leftHeaderY += 4.5;
  }
  if (factory.factoryAddress) {
    doc.text(factory.factoryAddress, marginLeft + 5, leftHeaderY);
    leftHeaderY += 4.5;
  }
  if (factory.factoryPhone) {
    doc.text(`Phone: ${factory.factoryPhone}`, marginLeft + 5, leftHeaderY);
  }
  
  // Right side of Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('INVOICE', marginRight - 5, y + 14, { align: 'right' });
  
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  
  const paymentMode = invoice.paymentChannel ? invoice.paymentChannel.toUpperCase() : 'CASH';
  const bal = summary.balanceDue !== undefined ? summary.balanceDue : ((summary.grandTotal || summary.totalAmount) - summary.amountPaid);
  const pStatus = summary.paymentStatus || (bal <= 0 ? 'PAID' : (summary.amountPaid > 0 ? 'PARTIAL' : 'UNPAID'));
  
  doc.text(`Invoice No: ${invoice.invoiceNumber || 'INV-0001'}`, marginRight - 5, y + 21, { align: 'right' });
  doc.text(`Date: ${formatDateDisplay(invoice.date)}`, marginRight - 5, y + 25.5, { align: 'right' });
  doc.text(`Pay Mode: ${paymentMode} | Status: ${pStatus}`, marginRight - 5, y + 30, { align: 'right' });

  y += 50;

  // ---- CUSTOMER DETAILS (Left) & VEHICLE (Right) ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text('BILL TO:', marginLeft, y);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(customer?.name || 'Walk-in Customer', marginLeft, y + 5);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  let cy = y + 10;
  if (customer?.phone) { doc.text(`Phone: ${customer.phone}`, marginLeft, cy); cy += 4.5; }
  if (customer?.address) { doc.text(customer.address, marginLeft, cy); cy += 4.5; }
  
  // Vehicle / Additional info (Right)
  const hasDeliveryDetails = (settings?.showVehicleNumber !== '0' && vehicle?.vehicleNumber) || 
                             (settings?.showDriverName !== '0' && vehicle?.driverName) || 
                             customer?.address;
                             
  if (hasDeliveryDetails) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('DELIVERY DETAILS:', marginLeft + 105, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    let vy = y + 5;
    if (settings?.showVehicleNumber !== '0' && vehicle?.vehicleNumber) { doc.text(`Vehicle: ${vehicle.vehicleNumber}`, marginLeft + 105, vy); vy += 4.5; }
    if (settings?.showDriverName !== '0' && vehicle?.driverName) { doc.text(`Driver: ${vehicle.driverName}`, marginLeft + 105, vy); vy += 4.5; }

    if (customer?.address) { doc.text(`Destination: ${customer.address}`, marginLeft + 105, vy); vy += 4.5; }
  }

  y += 28;

  // ---- DYNAMIC PRODUCT TABLE ----
  const itemsArray = passedItems && passedItems.length > 0 
    ? passedItems 
    : [{ description: invoice.brickSize, quantity: invoice.quantity, rate: invoice.rate, amount: invoice.totalAmount, unit: 'Nos' }];

  const tableData = itemsArray.map((item, index) => {
    let product = item.description || '-';
    let size = '-';
    if (product.includes(' - ')) {
      const parts = product.split(' - ');
      product = parts[0];
      size = parts.slice(1).join(' - ');
    }
    return [
      product,
      size,
      item.quantity?.toLocaleString() || '0',
      item.unit || 'Nos',
      pdfCurrency(item.rate),
      pdfCurrency(item.amount || (item.quantity * item.rate))
    ];
  });

  doc.autoTable({
    startY: y,
    head: [['Product', 'Size', 'Qty', 'Unit', 'Rate', 'Amount']],
    body: tableData,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
    columnStyles: {
      0: { cellWidth: 50, textColor: DARK, fontStyle: 'bold' },
      1: { cellWidth: 40, textColor: GRAY },
      2: { halign: 'right', textColor: DARK },
      3: { halign: 'center', textColor: GRAY },
      4: { halign: 'right', textColor: GRAY },
      5: { halign: 'right', textColor: DARK, fontStyle: 'bold' },
    },
    margin: { left: marginLeft, right: 210 - marginRight }
  });

  let finalY = doc.lastAutoTable.finalY + 10;
  
  if (finalY > 210) {
    doc.addPage();
    finalY = 20;
  }

  // ---- SUMMARY SECTION ----
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(marginLeft + 95, finalY, 85, 75, 3, 3, 'F');
  
  let sy = finalY + 8;
  const drawRow = (label, value, isBold = false, isAccent = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...(isAccent ? PRIMARY : (isBold ? DARK : GRAY)));
    doc.text(label, marginLeft + 100, sy);
    doc.text(value, marginRight - 5, sy, { align: 'right' });
    sy += 6;
  };

  const stotal = summary.subtotal || itemsArray.reduce((sum, it) => sum + (it.amount || (it.quantity * it.rate)), 0);
  
  drawRow('Subtotal', pdfCurrency(stotal));
  

  
  if (settings?.showTransport !== '0' && summary.transportCharges) drawRow('Transport Charges', pdfCurrency(summary.transportCharges));
  if (settings?.showLoading !== '0' && summary.loadingCharges) drawRow('Loading Charges', pdfCurrency(summary.loadingCharges));
  if (settings?.showUnloading !== '0' && summary.unloadingCharges) drawRow('Unloading Charges', pdfCurrency(summary.unloadingCharges));
  if (settings?.showOtherCharges !== '0' && summary.otherCharges) drawRow('Other Charges', pdfCurrency(summary.otherCharges));
  


  // Grand Total Line
  sy += 2;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(marginLeft + 100, sy - 4, marginRight - 5, sy - 4);
  
  // Highlight Grand Total row
  doc.setFillColor(254, 243, 199); // amber-100 highlight
  doc.rect(marginLeft + 95, sy - 2, 85, 8, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Grand Total', marginLeft + 100, sy + 3.5);
  doc.setTextColor(...PRIMARY);
  doc.text(pdfCurrency(summary.grandTotal || summary.totalAmount), marginRight - 5, sy + 3.5, { align: 'right' });

  // Paid / Balance
  sy += 12;
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text('Paid Amount', marginLeft + 100, sy);
  doc.text(pdfCurrency(summary.amountPaid), marginRight - 5, sy, { align: 'right' });
  sy += 6;
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Balance Due', marginLeft + 100, sy);
  doc.setTextColor(bal > 0 ? 239 : 34, bal > 0 ? 68 : 197, bal > 0 ? 68 : 94); // Red if > 0, Green if 0
  doc.text(pdfCurrency(bal), marginRight - 5, sy, { align: 'right' });

  // ---- LEFT SIDE (QR, Payment Status, Payment Info) ----
  let leftY = finalY + 5;
  
  // Payment Status Badge
  const badgeColor = pStatus === 'PAID' ? [34, 197, 94] : pStatus === 'PARTIAL' ? [249, 115, 22] : [239, 68, 68];
  
  // Draw Pill
  doc.setFillColor(...badgeColor);
  doc.roundedRect(marginLeft, leftY, 28, 7, 3.5, 3.5, 'F');
  
  // Draw white circle inside pill
  doc.setFillColor(255, 255, 255);
  doc.circle(marginLeft + 4.5, leftY + 3.5, 2, 'F');
  
  // Draw text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(pStatus, marginLeft + 9, leftY + 5);
  
  leftY += 12;
  
  // Payment History Note
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text('Payment Details:', marginLeft, leftY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`Initial Payment (${paymentMode}): ${pdfCurrency(summary.amountPaid)}`, marginLeft, leftY + 4.5);
  if (bal > 0) {
    doc.text(`Current Invoice Balance: ${pdfCurrency(bal)}`, marginLeft, leftY + 9);
  } else {
    doc.text(`Payment Status: Fully Paid`, marginLeft, leftY + 9);
  }
  
  leftY += 16;

  // Bank Details
  if (settings?.showBankDetails !== '0' && factory.accountNumber) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text('BANK DETAILS', marginLeft, leftY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`A/C Holder: ${factory.factoryName || 'JAYA VASAVI INDUSTRIES'}`, marginLeft, leftY + 4.5);
    doc.text(`Bank: ${factory.bankName}`, marginLeft, leftY + 9);
    doc.text(`A/C: ${factory.accountNumber}`, marginLeft, leftY + 13.5);
    doc.text(`IFSC: ${factory.ifscCode}`, marginLeft, leftY + 18);
    
    leftY += 25;
  }

  // QR Code Image (25x25mm)
  if (settings?.showQRCode !== '0' && settings?.qrCodeImage) {
    try {
      const qrFormat = settings.qrCodeImage.substring(11, settings.qrCodeImage.indexOf(';')).toUpperCase();
      doc.addImage(settings.qrCodeImage, qrFormat, marginLeft, leftY, 25, 25);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...DARK);
      doc.text('Scan & Pay', marginLeft + 12.5, leftY + 28, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...GRAY);
      doc.text('UPI ID | Google Pay', marginLeft + 12.5, leftY + 31, { align: 'center' });
      doc.text('PhonePe | Paytm', marginLeft + 12.5, leftY + 34, { align: 'center' });
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
    doc.text('Terms & Conditions:', marginLeft, footY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text('1. Goods once sold will not be taken back.', marginLeft, footY + 4);
    doc.text('2. Payment should be completed within agreed period.', marginLeft, footY + 8);
  }

  // Signatures
  if (settings?.showCompanySignature !== '0') {
    if (settings?.signatureImage) {
      try {
        const sigFormat = settings.signatureImage.substring(11, settings.signatureImage.indexOf(';')).toUpperCase();
        doc.addImage(settings.signatureImage, sigFormat, marginRight - 35, footY - 12, 35, 15);
      } catch (e) {
        console.warn('Failed to embed signature image', e);
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text('Authorized Signature', marginRight, footY + 8, { align: 'right' });
  }


  // Very Bottom Page Footer Message
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text('Thank you for your business', 105, pageHeight - 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  const factoryPhone = factory.factoryPhone || '9502266200';
  const ownerName = factory.ownerName || 'Ch Nagabhushanam';
  doc.text(`${ownerName} - ${factoryPhone}`, 105, pageHeight - 8, { align: 'center' });

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
