/**
 * messages.js
 * ------------
 * Every WhatsApp/share text the app sends, in one place, in a consistent
 * professional business format. All business details come from the
 * Factory Settings (never hard-coded), so changing the phone number or
 * name in Settings updates every message.
 */
const inr = (n) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function dateText(iso) {
  if (!iso) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function signature(profile) {
  return [
    'Regards,',
    `*${profile.name}*`,
    profile.phone ? `Ph: ${profile.phone}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function payInfo(profile) {
  const lines = [];
  if (profile.upiId) lines.push(`UPI: ${profile.upiId}`);
  if (profile.bank?.accountNumber) {
    lines.push(
      `Bank: ${profile.bank.name || ''} | A/c ${profile.bank.accountNumber}${profile.bank.ifsc ? ` | IFSC ${profile.bank.ifsc}` : ''}`
    );
  }
  return lines.length ? ['*Payment details*', ...lines].join('\n') : null;
}

const join = (blocks) => blocks.filter((b) => b !== null && b !== undefined && b !== '').join('\n\n');

export function invoiceMessage({ profile, customer, invoiceNumber, date, grandTotal, paid, balance, totalOutstanding, totalQty }) {
  const rows = [
    `Invoice No: *${invoiceNumber}*`,
    `Date: ${dateText(date)}`,
    totalQty ? `Quantity: ${Number(totalQty).toLocaleString('en-IN')} Nos` : null,
    `Invoice Amount: *${inr(grandTotal)}*`,
    paid > 0 ? `Received: ${inr(paid)}` : null,
    balance > 0.005 ? `Balance Due: *${inr(balance)}*` : 'Status: *Fully Paid*',
    totalOutstanding !== undefined && totalOutstanding !== null && Math.abs(totalOutstanding - balance) > 0.005
      ? `Total Outstanding (incl. previous): *${inr(totalOutstanding)}*`
      : null,
  ].filter(Boolean);
  return join([
    `*${profile.name}*`,
    `Dear ${customer?.name || 'Customer'},`,
    'Thank you for your purchase. Please find your invoice attached.',
    rows.join('\n'),
    balance > 0.005 ? payInfo(profile) : null,
    signature(profile),
  ]);
}

export function reminderMessage({ profile, customer, amount, oldestDate }) {
  return join([
    `*${profile.name}*`,
    `Dear ${customer?.name || 'Customer'},`,
    `This is a friendly reminder that an amount of *${inr(amount)}* is outstanding on your account${
      oldestDate ? ` (pending since ${dateText(oldestDate)})` : ''
    }.`,
    'We request you to kindly arrange the payment at the earliest. If you have already paid, please ignore this message and share the payment reference with us.',
    payInfo(profile),
    signature(profile),
  ]);
}

export function receiptMessage({ profile, customer, receiptNumber, date, amount, mode, balanceAfter }) {
  return join([
    `*${profile.name}*`,
    `Dear ${customer?.name || 'Customer'},`,
    `We have received *${inr(amount)}* by ${mode} on ${dateText(date)}. Thank you!`,
    [
      `Receipt No: ${receiptNumber}`,
      balanceAfter > 0.005 ? `Balance outstanding: *${inr(balanceAfter)}*` : 'Your account is fully settled.',
    ].join('\n'),
    signature(profile),
  ]);
}

export function statementMessage({ profile, party, type = 'customer', periodLabel, closing }) {
  const isCustomer = type === 'customer';
  return join([
    `*${profile.name}*`,
    `Dear ${party?.name || (isCustomer ? 'Customer' : 'Sir/Madam')},`,
    `Please find attached the statement of your account${periodLabel ? ` for ${periodLabel}` : ''}.`,
    isCustomer
      ? closing > 0.005
        ? `Closing balance due: *${inr(closing)}*`
        : 'Your account has no balance due. Thank you!'
      : `Closing balance payable by us: *${inr(Math.max(closing, 0))}*`,
    'Kindly verify and let us know if there is any difference.',
    isCustomer && closing > 0.005 ? payInfo(profile) : null,
    signature(profile),
  ]);
}

export function supplierBalanceMessage({ profile, supplier, amount }) {
  return join([
    `*${profile.name}*`,
    `Dear ${supplier?.name || 'Sir/Madam'},`,
    `As per our books, the balance payable to you is *${inr(amount)}* as on ${dateText(new Date().toISOString())}.`,
    'Kindly confirm this balance with your records. Payment will be made as per our agreed terms.',
    signature(profile),
  ]);
}
