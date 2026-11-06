import { db } from '../db/schema';

/**
 * Sequential invoice numbers per Indian financial year (April–March),
 * e.g. JVI/26-27/0001. The next number is derived from the highest number
 * already used this year, so it can never repeat — even after a restore.
 */
export function financialYearCode(date = new Date()) {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00`) : date;
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
}

export async function getInvoicePrefix() {
  const row = await db.settings.where('key').equals('invoicePrefix').first();
  return (row?.value || 'JVI').trim().replace(/\/+$/, '') || 'JVI';
}

/** Must be called inside a transaction that includes salesLog + settings (or none). */
export async function nextInvoiceNumber(date) {
  const prefix = await getInvoicePrefix();
  const fy = financialYearCode(date || new Date());
  const head = `${prefix}/${fy}/`;
  let max = 0;
  await db.salesLog.each((s) => {
    const no = s.invoiceNumber;
    if (typeof no === 'string' && no.startsWith(head)) {
      const n = parseInt(no.slice(head.length), 10);
      if (n > max) max = n;
    }
  });
  return `${head}${String(max + 1).padStart(4, '0')}`;
}

/** Display number for any sale, including old ones saved without a number. */
export function displayInvoiceNumber(sale) {
  return sale?.invoiceNumber || `INV-${String(sale?.id ?? 0).padStart(4, '0')}`;
}
