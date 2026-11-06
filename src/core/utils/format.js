/**
 * format.js — shared formatting helpers for currency, dates, and numbers.
 */

const inrFormatters = new Map();
export function formatINR(amount, options = {}) {
  const decimals = options.decimals || 0;
  if (!inrFormatters.has(decimals)) {
    inrFormatters.set(decimals, new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }));
  }
  return inrFormatters.get(decimals).format(amount || 0);
}

const numFormatters = new Map();
export function formatNumber(value, decimals = 0) {
  if (!numFormatters.has(decimals)) {
    numFormatters.set(decimals, new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }));
  }
  return numFormatters.get(decimals).format(value || 0);
}

export function toLocalISOString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function todayISO() {
  return toLocalISOString(new Date());
}

/**
 * Parses 'YYYY-MM-DD' as a LOCAL date (new Date('2024-01-05') would be
 * UTC midnight, which shifts the day in some time zones). Full ISO
 * timestamps are parsed normally.
 */
export function parseISODate(isoDate) {
  if (!isoDate) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(isoDate);
}

export function formatDateDisplay(isoDate) {
  if (!isoDate) return '—';
  const d = parseISODate(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateShort(isoDate) {
  if (!isoDate) return '—';
  const d = parseISODate(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/** "just now", "5 min ago", "3 hours ago", "yesterday", "12 Oct" */
export function formatRelativeTime(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/** Date `n` days from `base` as local 'YYYY-MM-DD'. */
export function addDaysISO(n, base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  return toLocalISOString(d);
}

// ---- Payment channels ------------------------------------------------------
// Sales/invoices can be paid by cash, bank, UPI or cheque. UPI and cheque
// land in the bank account, so every report must treat them as bank money.
export function isCashChannel(channel) {
  return channel === 'cash';
}
export function isBankChannel(channel) {
  return channel === 'bank' || channel === 'upi' || channel === 'cheque';
}
export function channelLabel(channel) {
  switch (channel) {
    case 'cash':
      return 'Cash';
    case 'bank':
      return 'Bank';
    case 'upi':
      return 'UPI';
    case 'cheque':
      return 'Cheque';
    case 'credit':
      return 'Credit';
    case 'transfer':
      return 'Transfer';
    default:
      return channel ? String(channel) : '—';
  }
}

/** Round to 2 decimals without floating-point drift (0.1+0.2 → 0.3). */
export function round2(n) {
  return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
}

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toLocalISOString(start), end: toLocalISOString(end) };
}
