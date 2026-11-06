/**
 * Indian-system amount in words, as printed on Indian invoices:
 *   125430.5 → "Rupees One Lakh Twenty Five Thousand Four Hundred Thirty and Fifty Paise Only"
 */
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function threeDigits(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
}

export function integerToIndianWords(num) {
  let n = Math.floor(Math.abs(num));
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${integerToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(' ');
}

export function amountInWords(amount) {
  const value = Math.round((Number(amount) || 0) * 100) / 100;
  const rupees = Math.floor(Math.abs(value));
  const paise = Math.round((Math.abs(value) - rupees) * 100);
  let words = `Rupees ${integerToIndianWords(rupees)}`;
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return `${value < 0 ? 'Minus ' : ''}${words} Only`;
}
