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

export function formatDateDisplay(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateShort(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toLocalISOString(start), end: toLocalISOString(end) };
}

export function brickSizeLabel(size) {
  return size; // already human readable e.g. '4-inch'
}
