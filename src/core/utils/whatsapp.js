/**
 * whatsapp.js
 * ------------
 * Generates native WhatsApp deep links so a single tap on a customer's
 * outstanding balance opens WhatsApp pre-filled with a payment reminder.
 *
 * Uses the universal https://wa.me/ / api.whatsapp.com link format rather
 * than the raw `whatsapp://` scheme, because wa.me reliably falls back to
 * the WhatsApp Business app or web client across all Android OEM skins,
 * whereas the bare custom scheme can silently fail on some devices.
 */

/** Strips all non-digit characters and ensures a country code is present. */
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`; // assume India if no country code
  return digits;
}

function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Builds a WhatsApp deep link with a pre-filled outstanding-balance
 * reminder message, matching the required format exactly:
 * "Dear [Name], your outstanding balance is ₹[Amount]. Kindly settle it
 * at your earliest convenience."
 */
export function buildOutstandingReminderLink({ name, phone, amount, factoryName, factoryPhone }) {
  const message = `🧱 *JAYA VASAVI INDUSTRIES*

Dear *${name},*

This is a gentle reminder regarding your outstanding balance with Jaya Vasavi Industries.

💰 *Outstanding Balance:* ${formatINR(amount)}

Please arrange for the payment of the outstanding amount at your earliest convenience. If already paid, please ignore this message.

Thank you for your continued trust and support.

Regards,
*JAYA VASAVI INDUSTRIES*
📍 Chinamamidipalli, Narsapur, West Godavari
📞 ${factoryPhone || '9848174346 | 9502266200'}`;

  const encoded = encodeURIComponent(message);
  const normalizedPhone = normalizePhone(phone);

  if (normalizedPhone) {
    return `https://api.whatsapp.com/send?phone=${normalizedPhone}&text=${encoded}`;
  }
  return `https://api.whatsapp.com/send?text=${encoded}`;
}

export function buildSupplierReminderLink({ name, phone, amount, factoryName, factoryPhone }) {
  const message = `🧱 *JAYA VASAVI INDUSTRIES*

Dear *${name},*

This is an update regarding our pending account payable balance.

💰 *Pending Balance:* ${formatINR(amount)}

We will be settling this pending balance soon. Please verify with your ledger.

Thank you for your continued partnership.

Regards,
*JAYA VASAVI INDUSTRIES*
📍 Chinamamidipalli, Narsapur, West Godavari
📞 ${factoryPhone || '9848174346 | 9502266200'}`;

  const encoded = encodeURIComponent(message);
  const normalizedPhone = normalizePhone(phone);

  if (normalizedPhone) {
    return `https://api.whatsapp.com/send?phone=${normalizedPhone}&text=${encoded}`;
  }
  return `https://api.whatsapp.com/send?text=${encoded}`;
}

/**
 * Builds a richer end-of-transaction statement link (used from the
 * Sales ledger detail sheet) including item + transaction context.
 */
export function buildTransactionStatementLink({ name, phone, amount, brickSize, quantity, date, factoryName, factoryPhone }) {
  const message = `*${factoryName || 'Jaya Vasavi Industries'}*
-----------------------------------
*ORDER CONFIRMATION*

👤 *Customer:* ${name}
📅 *Date:* ${date}
📦 *Items:* ${quantity} × ${brickSize} Bricks

💰 *Outstanding Balance:* ${formatINR(amount)}

Thank you for your order!
📞 ${factoryPhone || '9502266200'}`;
  const encoded = encodeURIComponent(message);
  const normalizedPhone = normalizePhone(phone);

  if (normalizedPhone) {
    return `https://api.whatsapp.com/send?phone=${normalizedPhone}&text=${encoded}`;
  }
  return `https://api.whatsapp.com/send?text=${encoded}`;
}

/**
 * Opens a WhatsApp link. Inside Capacitor this should be invoked via the
 * Browser plugin so Android routes it to the installed WhatsApp app
 * instead of an in-app webview. Falls back to window.open on web.
 */
export async function openWhatsAppLink(url) {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } catch {
    window.open(url, '_blank');
  }
}
