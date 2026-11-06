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
export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`; // assume India if no country code
  return digits;
}

/** WhatsApp link that opens a chat with `phone` (or the contact picker) with `text` filled in. */
export function buildWhatsAppLink(phone, text) {
  const encoded = encodeURIComponent(text || '');
  const normalizedPhone = normalizePhone(phone);
  return normalizedPhone
    ? `https://api.whatsapp.com/send?phone=${normalizedPhone}&text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;
}

/** Opens WhatsApp with a ready-made message. */
export async function sendWhatsAppText(phone, text) {
  await openWhatsAppLink(buildWhatsAppLink(phone, text));
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
