import { useState } from 'react';
import { MessageCircle, FileText, Phone, Download, Trash2, Pencil, Check, X, Share2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import StatusPill from '../../core/ui/StatusPill';
import { db } from '../../core/db/schema';
import {
  calculateAgingDays,
  deleteSale,
  deleteCustomerCollection,
  updateParty,
  deleteParty,
  LATER_PAYMENTS,
} from '../../core/db/ledgerEngine';
import { formatINR, formatDateDisplay, channelLabel } from '../../core/utils/format';
import { GlassInput } from '../../core/ui/GlassFormControls';
import { useUIStore } from '../../core/store/uiStore';
import AddCollectionSheet from './AddCollectionSheet';
import StatementSheet from '../documents/StatementSheet';
import { displayInvoiceNumber } from '../../core/billing/invoiceNumber';
import { receiptNumber } from '../../core/billing/partyLedger';

export default function CustomerLedgerSheet({ open, onClose, customerId, onNavigate, onEditSale }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [sending, setSending] = useState(false);
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editGstin, setEditGstin] = useState('');
  const [showStatement, setShowStatement] = useState(false);

  const customer = useLiveQuery(
    () => (customerId ? db.customers.get(customerId) : null),
    [customerId],
    null
  );

  const transactions = useLiveQuery(
    async () => {
      if (!customerId) return [];
      const sales = await db.salesLog.where('customerId').equals(customerId).toArray();
      const collections = await db.customerCollections.where('customerId').equals(customerId).toArray();
      
      const mixed = [
        ...sales.map(s => ({ ...s, type: 'sale' })),
        ...collections.map(c => ({ ...c, type: 'collection' }))
      ];
      
      // Newest first; same-day entries ordered by entry time.
      return mixed.sort(
        (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '')
      );
    },
    [customerId],
    []
  );

  if (!customer) return null;

  const runDoc = async (fn, errorText) => {
    setSending(true);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      pushToast(e.message || errorText, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleWhatsAppReminder = () =>
    runDoc(async () => {
      const { sendPaymentReminder } = await import('../../core/billing/documents');
      await sendPaymentReminder(customer.id);
    }, 'Could not open WhatsApp');

  const handleShareInvoice = (sale) =>
    runDoc(async () => {
      const { shareSaleInvoice } = await import('../../core/billing/documents');
      await shareSaleInvoice(sale.id);
    }, 'Could not create invoice');

  const handleShareReceipt = (col) =>
    runDoc(async () => {
      const { shareCollectionReceipt } = await import('../../core/billing/documents');
      await shareCollectionReceipt(col.id);
    }, 'Could not create receipt');

  const handleDelete = async (t) => {
    const label = t.type === 'sale' ? 'sale' : 'payment';
    const amount = t.type === 'sale' ? t.totalAmount : t.amount;
    if (
      !window.confirm(
        `Delete this ${label} of ${formatINR(amount)} on ${formatDateDisplay(t.date)}?\n\nThe customer's balance${
          t.type === 'sale' ? ' and brick stock' : ''
        } will be adjusted.`
      )
    )
      return;
    try {
      if (t.type === 'sale') {
        try {
          await deleteSale(t.id);
        } catch (e) {
          if (e.code !== LATER_PAYMENTS) throw e;
          if (
            !window.confirm(
              `${e.message}\n\nDeleting this sale will still reduce the balance by its unpaid amount (${formatINR(
                t.balanceDue
              )}). Continue?`
            )
          )
            return;
          await deleteSale(t.id, { force: true });
        }
      } else {
        await deleteCustomerCollection(t.id);
      }
      pushToast(`${label[0].toUpperCase()}${label.slice(1)} deleted`, 'success');
    } catch (e) {
      pushToast(e.message || `Could not delete ${label}`, 'error');
    }
  };

  const startEdit = () => {
    setEditName(customer.name || '');
    setEditPhone(customer.phone || '');
    setEditAddress(customer.address || '');
    setEditGstin(customer.gstin || '');
    setEditing(true);
  };

  const saveEdit = async () => {
    try {
      await updateParty('customer', customer.id, { name: editName, phone: editPhone, address: editAddress, gstin: editGstin });
      setEditing(false);
      pushToast('Customer updated', 'success');
    } catch (e) {
      pushToast(e.message || 'Could not update customer', 'error');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!window.confirm(`Delete customer "${customer.name}"?`)) return;
    try {
      await deleteParty('customer', customer.id);
      pushToast('Customer deleted', 'success');
      onClose();
    } catch (e) {
      pushToast(e.message || 'Could not delete customer', 'error');
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={customer.name} maxHeight="92vh">
      <div className="space-y-5 pb-6">
        <div className="glass-surface-light rounded-2xl p-4">
          {editing ? (
            <div className="space-y-3">
              <GlassInput label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <GlassInput
                label="Phone"
                value={editPhone}
                inputMode="tel"
                onChange={(e) => setEditPhone(e.target.value)}
              />
              <GlassInput
                label="Address (printed on invoice)"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Village / Town, District"
              />
              <GlassInput
                label="GSTIN (optional)"
                value={editGstin}
                onChange={(e) => setEditGstin(e.target.value.toUpperCase())}
                placeholder="15-character GST number"
                maxLength={15}
              />
              <div className="flex gap-2">
                <GlassButton size="sm" variant="glass" fullWidth icon={X} onClick={() => setEditing(false)}>
                  Cancel
                </GlassButton>
                <GlassButton size="sm" fullWidth icon={Check} onClick={saveEdit}>
                  Save
                </GlassButton>
              </div>
              <button
                onClick={handleDeleteCustomer}
                className="w-full text-xs text-ledger-overdue/80 pt-1 touch-manipulation"
              >
                Delete this customer
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <p className="text-clay-400 text-xs font-semibold mb-1 uppercase tracking-wider">
                  {(customer.outstandingBalance || 0) < 0 ? 'Advance (we owe)' : 'Outstanding Balance'}
                </p>
                <button
                  onClick={startEdit}
                  aria-label="Edit customer"
                  className="text-clay-400 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider touch-manipulation"
                >
                  <Pencil size={12} /> Edit
                </button>
              </div>
              <p
                className={`figure text-2xl font-bold mb-3 ${
                  (customer.outstandingBalance || 0) > 0 ? 'text-ledger-overdue' : 'text-ledger-paid'
                }`}
              >
                {formatINR(Math.abs(customer.outstandingBalance || 0))}
              </p>
              {customer.phone ? (
                <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 text-clay-300 text-xs">
                  <Phone size={12} /> {customer.phone}
                </a>
              ) : (
                <p className="text-xs text-clay-500">No phone — tap Edit to add one for WhatsApp</p>
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          <GlassButton
            fullWidth
            onClick={() => setShowAddCollection(true)}
            icon={Download}
          >
            Receive Payment
          </GlassButton>
          <div className="grid grid-cols-2 gap-2">
            <GlassButton
              fullWidth
              size="sm"
              onClick={handleWhatsAppReminder}
              icon={MessageCircle}
              disabled={customer.outstandingBalance <= 0 || sending}
              className="!bg-[#25D366] !from-[#25D366] !to-[#1FAF54] !border-[#25D366]/40"
            >
              WhatsApp
            </GlassButton>
            <GlassButton
              variant="glass"
              fullWidth
              size="sm"
              onClick={() => setShowStatement(true)}
              icon={FileText}
              disabled={sending}
            >
              Statement
            </GlassButton>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-clay-400 uppercase tracking-wide mb-2">
            Transaction History
          </p>
          <div className="space-y-2.5">
            {(transactions || []).map((t) => {
              if (t.type === 'sale') {
                const aging = calculateAgingDays(t.date);
                const status = t.balanceDue > 0 && aging > 30 ? 'overdue' : t.paymentStatus;
                
                const title = t.items?.length
                  ? `${t.items.length} item${t.items.length === 1 ? '' : 's'}`
                  : `${Number(t.quantity).toLocaleString('en-IN')} × ${t.brickSize}`;

                return (
                  <div key={`sale-${t.id}`} className="glass-surface-light rounded-xl p-3 border-l-2 border-transparent">
                    <div className="flex items-center justify-between mb-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-clay-100 truncate">{title}</p>
                        <p className="text-[10px] text-clay-500">{displayInvoiceNumber(t)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill status={status} size="sm" />
                        <button
                          onClick={() => handleShareInvoice(t)}
                          disabled={sending}
                          aria-label="Share invoice PDF"
                          className="text-clay-400 hover:text-clay-100 p-2 -m-1 touch-manipulation disabled:opacity-40"
                        >
                          <Share2 size={14} />
                        </button>
                        {/* Invoice (multi-item) sales can't be edited in the quick sale form without losing items. */}
                        {!t.items?.length && (
                          <button
                            onClick={() => onEditSale && onEditSale(t)}
                            aria-label="Edit sale"
                            className="text-clay-400 hover:text-clay-100 p-2 -m-1 touch-manipulation"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(t)} aria-label="Delete sale" className="text-clay-500 hover:text-ledger-overdue transition-colors p-2 -m-1 touch-manipulation">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-clay-400">
                      <span>{formatDateDisplay(t.date)}</span>
                      <span className="figure">
                        {formatINR(t.totalAmount)}
                        {t.balanceDue > 0 && (
                          <span className="text-ledger-overdue"> · Due {formatINR(t.balanceDue)}</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div key={`col-${t.id}`} className="glass-surface-light rounded-xl p-3 border-l-2 border-ledger-paid bg-ledger-paid/5">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-sm font-medium text-clay-100">Payment Received</p>
                        <p className="text-[10px] text-clay-500">{receiptNumber(t)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="figure font-bold text-ledger-paid text-sm">
                          +{formatINR(t.amount)}
                        </p>
                        <button
                          onClick={() => handleShareReceipt(t)}
                          disabled={sending}
                          aria-label="Share payment receipt"
                          className="text-clay-400 hover:text-clay-100 p-2 -m-1 touch-manipulation disabled:opacity-40"
                        >
                          <Share2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(t)} aria-label="Delete payment" className="text-clay-500 hover:text-ledger-overdue transition-colors p-2 -m-1 touch-manipulation">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-clay-400">
                      <span>{formatDateDisplay(t.date)}</span>
                      <span>{channelLabel(t.paymentChannel || 'cash')}{t.remarks ? ` · ${t.remarks}` : ''}</span>
                    </div>
                  </div>
                );
              }
            })}
            {(transactions || []).length === 0 && (
              <p className="text-sm text-clay-500 text-center py-4">No transactions yet.</p>
            )}
          </div>
        </div>
      </div>
      <StatementSheet
        open={showStatement}
        onClose={() => setShowStatement(false)}
        type="customer"
        partyId={customer.id}
        partyName={customer.name}
      />
      {showAddCollection && (
        <AddCollectionSheet
          open={showAddCollection}
          onClose={() => setShowAddCollection(false)}
          customerId={customer.id}
          customerName={customer.name}
          outstandingBalance={customer.outstandingBalance}
        />
      )}
    </BottomSheet>
  );
}
