import { db } from '../db/schema';

/**
 * profile.js
 * -----------
 * Loads everything a bill/statement/message needs about the business in
 * ONE normalized object, so no document or WhatsApp text ever hard-codes
 * the factory name, phone or address again.
 */

export const GST_STATES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
};

export const DEFAULT_TERMS = [
  'Goods once sold will not be taken back or exchanged.',
  'Please check the quantity and quality at the time of delivery.',
  'Interest @ 18% p.a. may be charged on payments delayed beyond the due date.',
  'Subject to Narsapur jurisdiction only.',
];

export function stateCodeFromGstin(gstin) {
  const code = String(gstin || '').trim().slice(0, 2);
  return /^\d{2}$/.test(code) && GST_STATES[code] ? code : '';
}

const on = (v, def = true) => (v === undefined || v === null || v === '' ? def : v !== '0');

export async function loadBillingProfile() {
  const [settingsRows, invoiceRows] = await Promise.all([db.settings.toArray(), db.invoiceSettings.toArray()]);
  const s = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
  const inv = Object.fromEntries(invoiceRows.map((r) => [r.key, r.value]));

  const gstin = (s.gstin || '').trim().toUpperCase();
  const stateCode = (s.stateCode || stateCodeFromGstin(gstin) || '37').padStart(2, '0');
  const terms = (inv.termsText || '').trim()
    ? inv.termsText.split('\n').map((t) => t.trim()).filter(Boolean)
    : DEFAULT_TERMS;

  return {
    name: (s.factoryName || 'JAYA VASAVI INDUSTRIES').trim(),
    businessLine: s.businessCategories || '',
    address: s.factoryAddress || '',
    phone: s.factoryPhone || '',
    email: s.factoryEmail || '',
    ownerName: s.ownerName || '',
    gstin,
    stateCode,
    stateName: GST_STATES[stateCode] || s.stateName || '',
    bank: {
      name: s.bankName || '',
      accountName: s.accountHolder || s.factoryName || '',
      accountNumber: s.accountNumber || '',
      ifsc: s.ifscCode || '',
      branch: s.bankBranch || '',
    },
    upiId: (s.upiId || '').trim(),
    invoice: {
      prefix: s.invoicePrefix || 'JVI',
      gstMode: inv.gstMode || 'none',
      gstRate: Number(inv.gstRate ?? 5) || 0,
      hsn: inv.hsnCode || '6815',
      unit: inv.defaultUnit || 'Nos',
      productLabel: inv.productLabel ?? 'Fly Ash Bricks',
      dueDays: Number(inv.dueDays ?? 15) || 0,
      terms,
      showTransport: on(inv.showTransport),
      showLoading: on(inv.showLoading),
      showUnloading: on(inv.showUnloading),
      showOtherCharges: on(inv.showOtherCharges),
      showBankDetails: on(inv.showBankDetails),
      showQRCode: on(inv.showQRCode),
      showTerms: on(inv.showTerms),
      showBusinessDescription: on(inv.showBusinessDescription),
      showVehicleNumber: on(inv.showVehicleNumber),
      showCompanySignature: on(inv.showCompanySignature),
      showPreviousBalance: on(inv.showPreviousBalance),
      showHsn: on(inv.showHsn),
      qrCodeImage: inv.qrCodeImage || '',
      signatureImage: inv.signatureImage || '',
    },
  };
}

/** True when buyer is in another state (→ IGST instead of CGST+SGST). */
export function isInterState(profile, customer) {
  const buyer = stateCodeFromGstin(customer?.gstin) || (customer?.stateCode || '').padStart(2, '0');
  return !!buyer && buyer !== '00' && buyer !== profile.stateCode;
}
