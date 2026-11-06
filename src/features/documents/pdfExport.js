import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import QRCode from 'qrcode';
import { amountInWords } from '../../core/billing/numberToWords';
import { modeName } from '../../core/billing/partyLedger';

/**
 * pdfExport.js
 * -------------
 * Business documents in the standard Indian layout:
 *   • Tax Invoice / Invoice  (GST-ready: HSN, CGST/SGST/IGST, amount in words)
 *   • Statement of Account   (opening → debit/credit → closing, ageing)
 *   • Payment Receipt
 *
 * Design: black ink on white, thin grey rules, one brick-red accent —
 * prints cleanly on any office/thermal-to-A4 printer and reads well as a
 * WhatsApp PDF on a phone.
 *
 * jsPDF notes (verified): use the NAMED `jsPDF` import and `applyPlugin`
 * + `doc.autoTable()` — the default-import forms break under some
 * bundler interop. The 14 built-in PDF fonts have no ₹ glyph, so amounts
 * print as "Rs." (common practice in Indian billing software).
 */
applyPlugin(jsPDF);

const INK = [24, 24, 27];
const MUTED = [98, 98, 108];
const RULE = [200, 200, 206];
const SOFT = [246, 244, 241];
const ACCENT = [168, 62, 28]; // brick red
const GREEN = [22, 120, 70];

const M = 12; // page margin (mm)

// ---------------------------------------------------------------- helpers

const r2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

export function num(n, decimals = 2) {
  return (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
export function money(n) {
  const v = Number(n) || 0;
  return `${v < 0 ? '-' : ''}Rs. ${num(Math.abs(v))}`;
}
function qtyText(q) {
  const n = Number(q) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}
export function pdfDate(iso) {
  if (!iso) return '-';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  // Fixed month names: some engines print "Sept" with toLocaleDateString.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}
function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function imageFormat(dataUrl) {
  const m = /^data:image\/(\w+);/.exec(dataUrl || '');
  const f = (m?.[1] || 'png').toUpperCase();
  return f === 'JPG' ? 'JPEG' : f;
}

function setText(doc, { size = 8.5, style = 'normal', color = INK } = {}) {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

function hline(doc, x1, y, x2, color = RULE, w = 0.2) {
  doc.setDrawColor(...color);
  doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
}

/** Dynamic UPI QR for an exact amount — opens GPay/PhonePe/Paytm prefilled. */
export async function upiQrDataUrl(profile, amount, note) {
  if (!profile.upiId) return null;
  const params = new URLSearchParams({ pa: profile.upiId, pn: profile.name.slice(0, 40), cu: 'INR' });
  if (amount > 0) params.set('am', r2(amount).toFixed(2));
  if (note) params.set('tn', note.slice(0, 60));
  try {
    return await QRCode.toDataURL(`upi://pay?${params.toString()}`, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
  } catch {
    return null;
  }
}

/** Seller block (left of the header box). Returns the height used. */
function drawSeller(doc, profile, x, y, width) {
  let cy = y + 6;
  setText(doc, { size: 14.5, style: 'bold', color: ACCENT });
  doc.text(profile.name, x + 3, cy);
  cy += 4.6;
  if (profile.invoice.showBusinessDescription && profile.businessLine) {
    setText(doc, { size: 7.5, style: 'italic', color: MUTED });
    const lines = doc.splitTextToSize(profile.businessLine, width - 6);
    doc.text(lines, x + 3, cy);
    cy += lines.length * 3.4 + 0.6;
  }
  setText(doc, { size: 8 });
  if (profile.address) {
    const lines = doc.splitTextToSize(profile.address, width - 6);
    doc.text(lines, x + 3, cy);
    cy += lines.length * 3.6;
  }
  const contact = [profile.phone && `Ph: ${profile.phone}`, profile.email && `Email: ${profile.email}`].filter(Boolean).join('   ');
  if (contact) {
    doc.text(doc.splitTextToSize(contact, width - 6), x + 3, cy);
    cy += 3.6;
  }
  if (profile.gstin) {
    setText(doc, { size: 8, style: 'bold' });
    doc.text(`GSTIN: ${profile.gstin}`, x + 3, cy);
    cy += 3.6;
  }
  if (profile.stateName) {
    setText(doc, { size: 8 });
    doc.text(`State: ${profile.stateName}, Code: ${profile.stateCode}`, x + 3, cy);
    cy += 3.6;
  }
  return cy - y + 1.5;
}

/** Label/value rows in a bordered column. Returns height used. */
function drawMeta(doc, rows, x, y, width, rowH = 6.2) {
  rows.forEach(([label, value], i) => {
    const ry = y + i * rowH;
    if (i > 0) hline(doc, x, ry, x + width);
    setText(doc, { size: 7.2, color: MUTED });
    doc.text(label, x + 2.5, ry + 4.1);
    setText(doc, { size: 8.3, style: 'bold' });
    const v = doc.splitTextToSize(String(value ?? '-'), width * 0.58);
    doc.text(v[0], x + width - 2.5, ry + 4.1, { align: 'right' });
  });
  return rows.length * rowH;
}

function drawTitle(doc, title, rightNote) {
  const W = doc.internal.pageSize.getWidth();
  setText(doc, { size: 12.5, style: 'bold', color: INK });
  doc.text(title, W / 2, M + 3.5, { align: 'center', charSpace: 0.8 });
  if (rightNote) {
    setText(doc, { size: 6.8, style: 'bold', color: MUTED });
    doc.text(rightNote, W - M, M + 3.5, { align: 'right' });
  }
  return M + 6.5;
}

function drawPartyBlock(doc, heading, party, x, y, width, extraLines = []) {
  let cy = y + 4.5;
  setText(doc, { size: 7, style: 'bold', color: MUTED });
  doc.text(heading.toUpperCase(), x + 3, cy);
  cy += 4.6;
  setText(doc, { size: 10, style: 'bold' });
  const nameLines = doc.splitTextToSize(party?.name || 'Cash Customer', width - 6);
  doc.text(nameLines, x + 3, cy);
  cy += nameLines.length * 4.3;
  setText(doc, { size: 8 });
  if (party?.address) {
    const a = doc.splitTextToSize(party.address, width - 6);
    doc.text(a, x + 3, cy);
    cy += a.length * 3.6;
  }
  if (party?.phone) {
    doc.text(`Ph: ${party.phone}`, x + 3, cy);
    cy += 3.6;
  }
  if (party?.gstin) {
    setText(doc, { size: 8, style: 'bold' });
    doc.text(`GSTIN: ${String(party.gstin).toUpperCase()}`, x + 3, cy);
    cy += 3.6;
    setText(doc, { size: 8 });
  }
  for (const line of extraLines) {
    const l = doc.splitTextToSize(line, width - 6);
    doc.text(l, x + 3, cy);
    cy += l.length * 3.6;
  }
  return cy - y + 1;
}

function drawSignature(doc, profile, x, y, width, label = 'Authorised Signatory') {
  setText(doc, { size: 8, style: 'bold' });
  doc.text(`For ${profile.name}`, x + width, y + 4, { align: 'right' });
  if (profile.invoice.showCompanySignature && profile.invoice.signatureImage) {
    try {
      doc.addImage(profile.invoice.signatureImage, imageFormat(profile.invoice.signatureImage), x + width - 38, y + 6, 36, 13, undefined, 'FAST');
    } catch {
      /* bad image — leave space blank for a manual signature */
    }
  }
  setText(doc, { size: 7.5, color: MUTED });
  doc.text(label, x + width, y + 23, { align: 'right' });
}

function drawPageFooters(doc, note) {
  const total = doc.internal.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    hline(doc, M, H - 9, W - M, RULE, 0.15);
    setText(doc, { size: 6.8, color: MUTED });
    if (note) doc.text(note, M, H - 5.5);
    doc.text(`Page ${i} of ${total}`, W - M, H - 5.5, { align: 'right' });
  }
}

function ensureSpace(doc, y, needed) {
  const H = doc.internal.pageSize.getHeight();
  if (y + needed > H - 14) {
    doc.addPage();
    return M + 2;
  }
  return y;
}

function drawBankAndQr(doc, profile, x, y, width, qr, qrCaption) {
  const hasBank = profile.invoice.showBankDetails && profile.bank.accountNumber;
  const qrImg = profile.invoice.showQRCode ? qr || profile.invoice.qrCodeImage : null;
  if (!hasBank && !qrImg) return 0;
  const qrSize = 24;
  const h = Math.max(hasBank ? 25 : 0, qrImg ? qrSize + 7 : 0);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.rect(x, y, width, h);
  if (hasBank) {
    let cy = y + 4.5;
    setText(doc, { size: 7, style: 'bold', color: MUTED });
    doc.text('BANK DETAILS', x + 3, cy);
    cy += 4.2;
    const rows = [
      ['A/c Name', profile.bank.accountName],
      ['Bank', [profile.bank.name, profile.bank.branch].filter(Boolean).join(', ')],
      ['A/c No.', profile.bank.accountNumber],
      ['IFSC', profile.bank.ifsc],
    ].filter(([, v]) => v);
    for (const [k, v] of rows) {
      setText(doc, { size: 7.5, color: MUTED });
      doc.text(k, x + 3, cy);
      setText(doc, { size: 7.8, style: 'bold' });
      doc.text(doc.splitTextToSize(String(v), width - (qrImg ? qrSize + 26 : 24))[0], x + 19, cy);
      cy += 3.9;
    }
  }
  if (qrImg) {
    const qx = x + width - qrSize - 3;
    try {
      doc.addImage(qrImg, imageFormat(qrImg), qx, y + 2.5, qrSize, qrSize, undefined, 'FAST');
      setText(doc, { size: 6.5, style: 'bold' });
      doc.text(qrCaption || 'Scan to pay (UPI)', qx + qrSize / 2, y + qrSize + 5.3, { align: 'center' });
    } catch {
      /* ignore bad QR image */
    }
  }
  return h;
}

// ---------------------------------------------------------------- INVOICE

/**
 * @param {object} p
 * @param {object} p.profile   loadBillingProfile()
 * @param {object} p.invoice   { number, date, dueDate?, paymentMode, vehicleNumber?, remarks?, copyLabel? }
 * @param {object} p.customer  { name, phone, address, gstin }
 * @param {object} p.totals    computeInvoiceTotals() result
 * @param {number} p.amountPaid
 * @param {number} [p.previousBalance] customer balance before this bill
 */
export async function generateInvoicePDF({ profile, invoice, customer, totals, amountPaid = 0, previousBalance = null }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const CW = W - 2 * M;
  const leftW = 110;
  const rightW = CW - leftW;
  const taxed = totals.gstMode !== 'none' && totals.gstRate > 0;
  const title = taxed ? 'TAX INVOICE' : 'INVOICE';

  const grand = totals.grandTotal;
  const paid = r2(amountPaid);
  const balance = r2(grand - paid);
  const status = balance <= 0.004 ? 'Paid' : paid > 0 ? 'Partly Paid' : 'Unpaid';
  const dueDate = invoice.dueDate || (balance > 0 && profile.invoice.dueDays ? addDays(invoice.date, profile.invoice.dueDays) : null);

  let y = drawTitle(doc, title, invoice.copyLabel || 'ORIGINAL FOR RECIPIENT');

  // ---- Header box: seller | invoice meta
  const metaRows = [
    ['Invoice No.', invoice.number],
    ['Invoice Date', pdfDate(invoice.date)],
    ...(dueDate ? [['Due Date', pdfDate(dueDate)]] : []),
    ['Payment', paid > 0 ? modeName(invoice.paymentMode) : 'Credit'],
    ['Status', status],
    ...(profile.invoice.showVehicleNumber && invoice.vehicleNumber ? [['Vehicle No.', invoice.vehicleNumber.toUpperCase()]] : []),
  ];
  const sellerH = drawSeller(doc, profile, M, y, leftW);
  const metaH = drawMeta(doc, metaRows, M + leftW, y, rightW);
  const headH = Math.max(sellerH, metaH);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.rect(M, y, CW, headH);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.line(M + leftW, y, M + leftW, y + headH);
  y += headH;

  // ---- Buyer box: bill to | place of supply
  const buyerState = customer?.gstin ? String(customer.gstin).slice(0, 2) : profile.stateCode;
  const supplyLines = [
    `Place of Supply: ${totals.interState ? `Other State (${buyerState})` : `${profile.stateName} (${profile.stateCode})`}`,
  ];
  if (invoice.deliveryAddress) supplyLines.push(`Delivery: ${invoice.deliveryAddress}`);
  const billH = drawPartyBlock(doc, 'Bill To', customer, M, y, leftW);
  setText(doc, { size: 7, style: 'bold', color: MUTED });
  doc.text('SUPPLY DETAILS', M + leftW + 3, y + 4.5);
  setText(doc, { size: 8 });
  let sy = y + 9;
  for (const l of supplyLines) {
    const parts = doc.splitTextToSize(l, rightW - 6);
    doc.text(parts, M + leftW + 3, sy);
    sy += parts.length * 3.7;
  }
  if (taxed) {
    doc.text(`Tax: ${totals.interState ? 'IGST' : 'CGST + SGST'} @ ${totals.gstRate}%`, M + leftW + 3, sy);
    sy += 3.7;
    doc.text(totals.gstMode === 'inclusive' ? 'Rates are inclusive of GST' : 'Rates are exclusive of GST', M + leftW + 3, sy);
    sy += 3.7;
  }
  const buyerH = Math.max(billH, sy - y + 1);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.rect(M, y, CW, buyerH);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.line(M + leftW, y, M + leftW, y + buyerH);
  y += buyerH + 3;

  // ---- Items table
  const showHsn = profile.invoice.showHsn;
  const head = [['#', 'Description of Goods', ...(showHsn ? ['HSN'] : []), 'Qty', 'Unit', taxed && totals.gstMode === 'inclusive' ? 'Rate (incl. GST)' : 'Rate', 'Amount']];
  const body = totals.lines.map((l, i) => [
    i + 1,
    l.description || '-',
    ...(showHsn ? [l.hsn || profile.invoice.hsn] : []),
    qtyText(l.quantity),
    l.unit || profile.invoice.unit,
    num(l.rate),
    num(l.amount),
  ]);
  const totalQty = totals.lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const foot = [['', 'Total', ...(showHsn ? [''] : []), qtyText(totalQty), '', '', num(totals.itemsTotal)]];
  const right = { halign: 'right' };
  const colStyles = showHsn
    ? { 0: { cellWidth: 8, halign: 'center' }, 2: { cellWidth: 16, halign: 'center' }, 3: { ...right, cellWidth: 20 }, 4: { cellWidth: 13, halign: 'center' }, 5: { ...right, cellWidth: 24 }, 6: { ...right, cellWidth: 30, fontStyle: 'bold' } }
    : { 0: { cellWidth: 8, halign: 'center' }, 2: { ...right, cellWidth: 22 }, 3: { cellWidth: 14, halign: 'center' }, 4: { ...right, cellWidth: 26 }, 5: { ...right, cellWidth: 32, fontStyle: 'bold' } };

  doc.autoTable({
    startY: y,
    head,
    body,
    foot,
    theme: 'grid',
    margin: { left: M, right: M, top: M + 4, bottom: 16 },
    styles: { font: 'helvetica', fontSize: 8.5, textColor: INK, lineColor: RULE, lineWidth: 0.2, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, valign: 'middle' },
    headStyles: { fillColor: SOFT, textColor: INK, fontStyle: 'bold', fontSize: 7.8, halign: 'center' },
    footStyles: { fillColor: SOFT, textColor: INK, fontStyle: 'bold', halign: 'right' },
    columnStyles: colStyles,
    showFoot: 'lastPage',
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === 1) data.cell.styles.halign = 'left';
    },
  });
  y = doc.lastAutoTable.finalY + 3;

  // ---- Totals (right) and words/tax/bank (left)
  const totalsRows = [];
  if (totals.charges.length) totalsRows.push(['Goods Value', num(totals.itemsTotal)]);
  for (const c of totals.charges) totalsRows.push([c.label, num(c.amount)]);
  if (taxed) {
    totalsRows.push(['Taxable Value', num(totals.taxableValue)]);
    if (totals.interState) totalsRows.push([`IGST @ ${totals.gstRate}%`, num(totals.igst)]);
    else {
      totalsRows.push([`CGST @ ${totals.gstRate / 2}%`, num(totals.cgst)]);
      totalsRows.push([`SGST @ ${totals.gstRate / 2}%`, num(totals.sgst)]);
    }
  } else if (!totals.charges.length) {
    totalsRows.push(['Sub Total', num(totals.itemsTotal)]);
  }
  if (Math.abs(totals.roundOff) >= 0.005) totalsRows.push(['Round Off', `${totals.roundOff > 0 ? '+' : ''}${num(totals.roundOff)}`]);

  const afterRows = [['Amount Received', num(paid)], ['Balance Due', num(balance)]];
  const showPrev = profile.invoice.showPreviousBalance && previousBalance !== null && Math.abs(previousBalance) >= 0.005;
  if (showPrev) {
    afterRows.push(['Previous Balance', num(previousBalance)]);
    afterRows.push(['Total Outstanding', num(previousBalance + balance)]);
  }
  const rowH = 5.6;
  const totalsH = totalsRows.length * rowH + 9 + afterRows.length * rowH + 2;

  setText(doc, { size: 8 });
  const words = doc.splitTextToSize(amountInWords(grand), leftW - 8);
  let leftH = 8 + words.length * 3.8;
  if (invoice.remarks) leftH += 4 + doc.splitTextToSize(invoice.remarks, leftW - 8).length * 3.6;

  y = ensureSpace(doc, y, Math.max(totalsH, leftH) + 4);
  const blockTop = y;

  // Totals box
  const tx = M + leftW + 3;
  const tw = CW - leftW - 3;
  let ty = blockTop;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.rect(tx, ty, tw, totalsH);
  ty += 4;
  for (const [k, v] of totalsRows) {
    setText(doc, { size: 8, color: MUTED });
    doc.text(k, tx + 3, ty);
    setText(doc, { size: 8.3 });
    doc.text(v, tx + tw - 3, ty, { align: 'right' });
    ty += rowH;
  }
  // Grand total band
  doc.setFillColor(...ACCENT);
  doc.rect(tx, ty - 3.4, tw, 8.2, 'F');
  setText(doc, { size: 9.5, style: 'bold', color: [255, 255, 255] });
  doc.text('GRAND TOTAL', tx + 3, ty + 1.9);
  doc.text(money(grand), tx + tw - 3, ty + 1.9, { align: 'right' });
  ty += 9.6;
  afterRows.forEach(([k, v], i) => {
    const strong = k === 'Balance Due' || k === 'Total Outstanding';
    if (k === 'Previous Balance') hline(doc, tx + 2, ty - 3.6, tx + tw - 2);
    setText(doc, { size: strong ? 8.6 : 8, style: strong ? 'bold' : 'normal', color: strong ? (k === 'Balance Due' && balance <= 0 ? GREEN : INK) : MUTED });
    doc.text(k, tx + 3, ty);
    doc.text(v, tx + tw - 3, ty, { align: 'right' });
    ty += rowH;
  });

  // Amount in words
  let ly = blockTop;
  doc.setDrawColor(...RULE);
  doc.rect(M, ly, leftW, leftH);
  setText(doc, { size: 7, style: 'bold', color: MUTED });
  doc.text('AMOUNT IN WORDS', M + 3, ly + 4.3);
  setText(doc, { size: 8.2, style: 'bold' });
  doc.text(words, M + 3, ly + 8.6);
  if (invoice.remarks) {
    const ry = ly + 8.6 + words.length * 3.8 + 1;
    setText(doc, { size: 7, style: 'bold', color: MUTED });
    doc.text('REMARKS', M + 3, ry);
    setText(doc, { size: 8 });
    doc.text(doc.splitTextToSize(invoice.remarks, leftW - 8), M + 3, ry + 3.8);
  }
  ly += leftH + 2;

  // GST summary (HSN-wise)
  if (taxed) {
    const hsn = profile.invoice.hsn;
    const taxHead = totals.interState
      ? [['HSN/SAC', 'Taxable Value', 'IGST Rate', 'IGST Amt', 'Total Tax']]
      : [['HSN/SAC', 'Taxable Value', 'CGST', 'Amount', 'SGST', 'Amount', 'Total Tax']];
    const taxBody = totals.interState
      ? [[hsn, num(totals.taxableValue), `${totals.gstRate}%`, num(totals.igst), num(totals.totalTax)]]
      : [[hsn, num(totals.taxableValue), `${totals.gstRate / 2}%`, num(totals.cgst), `${totals.gstRate / 2}%`, num(totals.sgst), num(totals.totalTax)]];
    doc.autoTable({
      startY: ly,
      head: taxHead,
      body: taxBody,
      theme: 'grid',
      margin: { left: M, right: W - M - leftW },
      tableWidth: leftW,
      styles: { fontSize: 7, textColor: INK, lineColor: RULE, lineWidth: 0.2, cellPadding: 1.4, halign: 'right' },
      headStyles: { fillColor: SOFT, textColor: INK, fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { halign: 'center' } },
    });
    ly = doc.lastAutoTable.finalY + 2;
  }

  // Bank + UPI QR
  const qr = balance > 0 ? await upiQrDataUrl(profile, balance, `Invoice ${invoice.number}`) : await upiQrDataUrl(profile, 0, `Invoice ${invoice.number}`);
  const bankH = drawBankAndQr(doc, profile, M, ly, leftW, qr, balance > 0 && profile.upiId ? `Scan to pay ${money(balance)}` : 'Scan to pay (UPI)');
  ly += bankH ? bankH + 2 : 0;

  y = Math.max(ly, blockTop + totalsH + 2) + 2;

  // ---- Terms + signature
  const terms = profile.invoice.showTerms ? profile.invoice.terms : [];
  setText(doc, { size: 7.2 });
  const termLines = terms.flatMap((t, i) => doc.splitTextToSize(`${i + 1}. ${t}`, leftW - 6));
  const footH = Math.max(26, termLines.length ? 7 + termLines.length * 3.3 : 0);
  y = ensureSpace(doc, y, footH + 2);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.rect(M, y, CW, footH);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.line(M + leftW, y, M + leftW, y + footH);
  if (termLines.length) {
    setText(doc, { size: 7, style: 'bold', color: MUTED });
    doc.text('TERMS & CONDITIONS', M + 3, y + 4.3);
    setText(doc, { size: 7.2, color: INK });
    doc.text(termLines, M + 3, y + 8.2);
  } else {
    setText(doc, { size: 8, style: 'bold' });
    doc.text('Thank you for your business!', M + 3, y + 6);
  }
  drawSignature(doc, profile, M + leftW, y, rightW - 3);
  setText(doc, { size: 6.8, color: MUTED });
  doc.text("Receiver's Signature", M + leftW + 3, y + footH - 2.5);

  drawPageFooters(doc, `This is a computer-generated invoice.  ${profile.name}${profile.phone ? ` | ${profile.phone}` : ''}`);
  return doc.output('blob');
}

// ---------------------------------------------------------------- STATEMENT

/**
 * Statement of Account.
 * @param {object} p
 * @param {object} p.profile
 * @param {object} p.party      customer/supplier record
 * @param {'customer'|'supplier'} p.type
 * @param {object} p.slice      sliceLedger() result { opening, entries, debit, credit, closing }
 * @param {string} p.periodLabel
 * @param {object} [p.aging]    agingBuckets() result (customers)
 */
export async function generateStatementPDF({ profile, party, type = 'customer', slice, periodLabel, aging }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const CW = W - 2 * M;
  const leftW = 110;
  const rightW = CW - leftW;
  const isCustomer = type === 'customer';
  const drcr = (n) => (Math.abs(n) < 0.005 ? 'Nil' : `${num(Math.abs(n))} ${(n > 0) === isCustomer ? 'Dr' : 'Cr'}`);

  let y = drawTitle(doc, 'STATEMENT OF ACCOUNT', isCustomer ? 'CUSTOMER ACCOUNT' : 'SUPPLIER ACCOUNT');

  const sellerH = drawSeller(doc, profile, M, y, leftW);
  const metaH = drawMeta(doc, [
    ['Statement Date', pdfDate(new Date().toISOString())],
    ['Period', periodLabel || 'All transactions'],
    ['Account', isCustomer ? 'Receivable' : 'Payable'],
    ['Closing Balance', drcr(slice.closing)],
  ], M + leftW, y, rightW);
  const headH = Math.max(sellerH, metaH);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.rect(M, y, CW, headH);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.line(M + leftW, y, M + leftW, y + headH);
  y += headH;

  const partyH = drawPartyBlock(doc, isCustomer ? 'Account of (Customer)' : 'Account of (Supplier)', party, M, y, CW);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.rect(M, y, CW, partyH);
  y += partyH + 4;

  // Summary strip
  const cards = isCustomer
    ? [['Opening Balance', drcr(slice.opening)], ['Total Billed', num(slice.debit)], ['Total Received', num(slice.credit)], ['Closing Balance', drcr(slice.closing)]]
    : [['Opening Payable', drcr(slice.opening)], ['Total Purchases', num(slice.debit)], ['Total Paid', num(slice.credit)], ['Closing Payable', drcr(slice.closing)]];
  const cw = CW / 4;
  cards.forEach(([k, v], i) => {
    const x = M + i * cw;
    const last = i === cards.length - 1;
    if (last) {
      doc.setFillColor(...ACCENT);
      doc.rect(x, y, cw, 13, 'F');
    } else {
      doc.setFillColor(...SOFT);
      doc.rect(x, y, cw, 13, 'F');
    }
    setText(doc, { size: 7, style: 'bold', color: last ? [255, 255, 255] : MUTED });
    doc.text(k.toUpperCase(), x + 3, y + 4.6);
    setText(doc, { size: 10, style: 'bold', color: last ? [255, 255, 255] : INK });
    doc.text(v, x + 3, y + 10);
  });
  y += 17;

  // Ledger table
  const body = [
    ['', '', '', { content: 'Opening Balance', styles: { fontStyle: 'bold' } }, '', '', { content: drcr(slice.opening), styles: { fontStyle: 'bold' } }],
    ...slice.entries.map((e) => [
      pdfDate(e.date),
      e.kind === 'invoice' ? (isCustomer ? 'Sale' : 'Purchase') : isCustomer ? 'Receipt' : 'Payment',
      e.ref,
      e.particulars,
      e.debit ? num(e.debit) : '',
      e.credit ? num(e.credit) : '',
      drcr(e.balance),
    ]),
  ];
  doc.autoTable({
    startY: y,
    head: [['Date', 'Type', 'Ref No.', 'Particulars', isCustomer ? 'Debit' : 'Bill', isCustomer ? 'Credit' : 'Paid', 'Balance']],
    body,
    foot: [['', '', '', 'Total / Closing Balance', num(slice.debit), num(slice.credit), drcr(slice.closing)]],
    theme: 'grid',
    margin: { left: M, right: M, top: M + 4, bottom: 16 },
    styles: { font: 'helvetica', fontSize: 7.8, textColor: INK, lineColor: RULE, lineWidth: 0.2, cellPadding: 1.8, valign: 'middle' },
    headStyles: { fillColor: SOFT, textColor: INK, fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: SOFT, textColor: INK, fontStyle: 'bold', halign: 'right' },
    showFoot: 'lastPage',
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 15 },
      2: { cellWidth: 25 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 27, fontStyle: 'bold' },
    },
  });
  y = doc.lastAutoTable.finalY + 4;

  // Ageing + payment details
  if (isCustomer && aging && slice.closing > 0.005) {
    y = ensureSpace(doc, y, 20);
    setText(doc, { size: 7, style: 'bold', color: MUTED });
    doc.text('OUTSTANDING BY AGE (DAYS)', M, y + 3);
    doc.autoTable({
      startY: y + 5,
      head: [['0 - 30', '31 - 60', '61 - 90', 'Over 90', 'Total Due']],
      body: [[num(aging['0-30']), num(aging['31-60']), num(aging['61-90']), num(aging['90+']), num(slice.closing)]],
      theme: 'grid',
      margin: { left: M, right: W - M - leftW },
      tableWidth: leftW,
      styles: { fontSize: 7.8, textColor: INK, lineColor: RULE, lineWidth: 0.2, cellPadding: 1.8, halign: 'right' },
      headStyles: { fillColor: SOFT, textColor: INK, fontStyle: 'bold', halign: 'center' },
      columnStyles: { 4: { fontStyle: 'bold' } },
    });
    y = doc.lastAutoTable.finalY + 3;
    const qr = await upiQrDataUrl(profile, slice.closing, `Payment ${party?.name || ''}`.trim());
    const h = drawBankAndQr(doc, profile, M, ensureSpace(doc, y, 32), leftW, qr, profile.upiId ? `Scan to pay ${money(slice.closing)}` : 'Scan to pay (UPI)');
    y += h + 3;
  }

  y = ensureSpace(doc, y, 30);
  setText(doc, { size: 7.5, color: MUTED });
  const note = isCustomer
    ? 'Please verify this statement. If there is any difference, kindly inform us within 7 days; otherwise it will be treated as correct.'
    : 'Please verify this statement against your records and inform us of any difference.';
  doc.text(doc.splitTextToSize(note, leftW), M, y + 4);
  drawSignature(doc, profile, M + leftW, y, rightW);

  drawPageFooters(doc, `Computer-generated statement.  ${profile.name}${profile.phone ? ` | ${profile.phone}` : ''}`);
  return doc.output('blob');
}

// ---------------------------------------------------------------- RECEIPT

/**
 * Payment receipt (A5 landscape) for money received from a customer.
 * @param {object} p { profile, customer, receipt: { number, date, amount, mode, reference }, balanceAfter }
 */
export async function generateReceiptPDF({ profile, customer, receipt, balanceAfter }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  const CW = W - 2 * M;

  let y = drawTitle(doc, 'PAYMENT RECEIPT', '');
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);

  // Compact seller header
  setText(doc, { size: 13, style: 'bold', color: ACCENT });
  doc.text(profile.name, W / 2, y + 5, { align: 'center' });
  setText(doc, { size: 7.5, color: MUTED });
  const sub = [profile.address, [profile.phone && `Ph: ${profile.phone}`, profile.gstin && `GSTIN: ${profile.gstin}`].filter(Boolean).join('   ')].filter(Boolean);
  let sy = y + 9;
  for (const s of sub) {
    const lines = doc.splitTextToSize(s, CW - 10);
    doc.text(lines, W / 2, sy, { align: 'center' });
    sy += lines.length * 3.4;
  }
  y = sy + 1;
  hline(doc, M, y, W - M, INK, 0.3);
  y += 6;

  setText(doc, { size: 8.5 });
  doc.text(`Receipt No: `, M, y);
  setText(doc, { size: 8.5, style: 'bold' });
  doc.text(receipt.number, M + 19, y);
  setText(doc, { size: 8.5 });
  doc.text(`Date: `, W - M - 32, y);
  setText(doc, { size: 8.5, style: 'bold' });
  doc.text(pdfDate(receipt.date), W - M, y, { align: 'right' });
  y += 9;

  setText(doc, { size: 9.5 });
  const sentence = `Received with thanks from ${customer?.name || 'Customer'} the sum of ${amountInWords(receipt.amount)} by ${modeName(receipt.mode)}${receipt.reference ? ` (${receipt.reference})` : ''}${receipt.against ? ` against ${receipt.against}` : ' towards their account'}.`;
  const lines = doc.splitTextToSize(sentence, CW);
  doc.text(lines, M, y, { lineHeightFactor: 1.5 });
  y += lines.length * 5.2 + 4;

  // Amount box
  doc.setFillColor(...SOFT);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.5);
  doc.rect(M, y, 70, 13, 'FD');
  setText(doc, { size: 7, style: 'bold', color: MUTED });
  doc.text('AMOUNT RECEIVED', M + 3, y + 4.5);
  setText(doc, { size: 13, style: 'bold', color: ACCENT });
  doc.text(money(receipt.amount), M + 3, y + 10.8);

  if (balanceAfter !== undefined && balanceAfter !== null) {
    setText(doc, { size: 7, style: 'bold', color: MUTED });
    doc.text('BALANCE AFTER THIS PAYMENT', M + 76, y + 4.5);
    setText(doc, { size: 11, style: 'bold', color: balanceAfter > 0.005 ? INK : GREEN });
    doc.text(balanceAfter > 0.005 ? money(balanceAfter) : 'Nil - Account settled', M + 76, y + 10.8);
  }

  const H = doc.internal.pageSize.getHeight();
  drawSignature(doc, profile, W - M - 70, H - 38, 70);
  drawPageFooters(doc, 'This is a computer-generated receipt.');
  return doc.output('blob');
}
