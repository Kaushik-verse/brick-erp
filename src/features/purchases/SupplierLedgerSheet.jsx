import { useState } from 'react';
import { MessageCircle, FileText, Phone, Upload, Trash2, Pencil, Check, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import StatusPill from '../../core/ui/StatusPill';
import { db } from '../../core/db/schema';
import {
  calculateAgingDays,
  deletePurchase,
  deleteSupplierPayment,
  updateParty,
  deleteParty,
  LATER_PAYMENTS,
} from '../../core/db/ledgerEngine';
import { formatINR, formatDateDisplay, formatNumber, channelLabel } from '../../core/utils/format';
import { GlassInput } from '../../core/ui/GlassFormControls';
import StatementSheet from '../documents/StatementSheet';
import { useUIStore } from '../../core/store/uiStore';
import AddSupplierPaymentSheet from './AddSupplierPaymentSheet';
import { applyPaymentsToBills } from '../../core/billing/partyLedger';


export default function SupplierLedgerSheet({ open, onClose, supplierId }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [sending, setSending] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const supplier = useLiveQuery(
    () => (supplierId ? db.suppliers.get(supplierId) : null),
    [supplierId],
    null
  );

  const transactions = useLiveQuery(
    async () => {
      if (!supplierId) return [];
      const purchases = await db.purchaseLog.where('supplierId').equals(supplierId).toArray();
      const payments = await db.supplierPayments.where('supplierId').equals(supplierId).toArray();
      
      const mixed = [
        // Later payments settle the oldest bills first, so paid bills don't show as due.
        ...applyPaymentsToBills(purchases, payments).map(p => ({ ...p, type: 'purchase' })),
        ...payments.map(p => ({ ...p, type: 'payment' }))
      ];
      
      return mixed.sort(
        (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '')
      );
    },
    [supplierId],
    []
  );

  const materials = useLiveQuery(() => db.rawMaterials.toArray(), [], []);
  const materialsById = Object.fromEntries((materials || []).map((m) => [m.id, m]));

  if (!supplier) return null;

  const handleWhatsAppReminder = async () => {
    try {
      const { sendSupplierBalanceMessage } = await import('../../core/billing/documents');
      await sendSupplierBalanceMessage(supplier.id);
    } catch (e) {
      pushToast(e.message || 'Could not open WhatsApp', 'error');
    }
  };

  const handleDelete = async (t) => {
    const amount = t.type === 'purchase' ? t.totalAmount : t.amount;
    if (
      !window.confirm(
        `Delete this ${t.type} of ${formatINR(amount)} on ${formatDateDisplay(t.date)}?\n\nThe supplier's balance${
          t.type === 'purchase' ? ' and material stock' : ''
        } will be adjusted.`
      )
    )
      return;
    try {
      if (t.type === 'purchase') {
        try {
          await deletePurchase(t.id);
        } catch (e) {
          if (e.code !== LATER_PAYMENTS) throw e;
          if (
            !window.confirm(
              `${e.message}\n\nDeleting this purchase will still reduce the payable by its unpaid amount (${formatINR(
                t.savedBalanceDue ?? t.balanceDue
              )}). Continue?`
            )
          )
            return;
          await deletePurchase(t.id, { force: true });
        }
      } else {
        await deleteSupplierPayment(t.id);
      }
      pushToast(t.type === 'purchase' ? 'Purchase deleted' : 'Payment deleted', 'success');
    } catch (e) {
      pushToast(e.message || 'Could not delete transaction', 'error');
    }
  };

  const startEdit = () => {
    setEditName(supplier.name || '');
    setEditPhone(supplier.phone || '');
    setEditing(true);
  };

  const saveEdit = async () => {
    try {
      await updateParty('supplier', supplier.id, { name: editName, phone: editPhone });
      setEditing(false);
      pushToast('Supplier updated', 'success');
    } catch (e) {
      pushToast(e.message || 'Could not update supplier', 'error');
    }
  };

  const handleDeleteSupplier = async () => {
    if (!window.confirm(`Delete supplier "${supplier.name}"?`)) return;
    try {
      await deleteParty('supplier', supplier.id);
      pushToast('Supplier deleted', 'success');
      onClose();
    } catch (e) {
      pushToast(e.message || 'Could not delete supplier', 'error');
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={supplier.name}>
      <div className="space-y-4">
        <div className="glass-surface-light rounded-2xl p-4">
          {editing ? (
            <div className="space-y-3">
              <GlassInput label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <GlassInput label="Phone" value={editPhone} inputMode="tel" onChange={(e) => setEditPhone(e.target.value)} />
              <div className="flex gap-2">
                <GlassButton size="sm" variant="glass" fullWidth icon={X} onClick={() => setEditing(false)}>
                  Cancel
                </GlassButton>
                <GlassButton size="sm" fullWidth icon={Check} onClick={saveEdit}>
                  Save
                </GlassButton>
              </div>
              <button onClick={handleDeleteSupplier} className="w-full text-xs text-ledger-overdue/80 pt-1 touch-manipulation">
                Delete this supplier
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-clay-400">Payable Balance</p>
                <p className="figure text-2xl font-bold text-ledger-overdue">
                  {formatINR(supplier.outstandingBalance)}
                </p>
                {supplier.phone ? (
                  <a href={`tel:${supplier.phone}`} className="inline-flex items-center gap-1 text-clay-300 text-xs mt-1">
                    <Phone size={12} /> {supplier.phone}
                  </a>
                ) : (
                  <p className="text-xs text-clay-500 mt-1">No phone on file</p>
                )}
              </div>
              <button
                onClick={startEdit}
                aria-label="Edit supplier"
                className="text-clay-400 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider touch-manipulation"
              >
                <Pencil size={12} /> Edit
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <GlassButton
            fullWidth
            onClick={() => setShowAddPayment(true)}
            icon={Upload}
          >
            Make Payment
          </GlassButton>
          <div className="grid grid-cols-2 gap-2">
            <GlassButton
              fullWidth
              size="sm"
              onClick={handleWhatsAppReminder}
              icon={MessageCircle}
              disabled={supplier.outstandingBalance <= 0}
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
              if (t.type === 'purchase') {
                const aging = calculateAgingDays(t.date);
                const status = t.balanceDue > 0 && aging > 30 ? 'overdue' : t.paymentStatus;
                return (
                  <div key={`purchase-${t.id}`} className="glass-surface-light rounded-xl p-3 border-l-2 border-transparent">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-clay-100">
                        {(() => {
                          const m = materialsById[t.materialId];
                          const isKg = (m?.unit || '').toLowerCase() === 'kg';
                          const qty = isKg ? t.quantity / 1000 : t.quantity;
                          return `${formatNumber(qty, isKg ? 3 : 2)} ${isKg ? 'Ton' : m?.unit || ''} ${m?.name || 'Material'}`;
                        })()}
                      </p>
                      <div className="flex items-center gap-2">
                        <StatusPill status={status} size="sm" />
                        <button onClick={() => handleDelete(t)} aria-label="Delete" className="text-clay-500 hover:text-ledger-overdue transition-colors p-2 -m-1 touch-manipulation">
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
                  <div key={`payment-${t.id}`} className="glass-surface-light rounded-xl p-3 border-l-2 border-ledger-paid bg-ledger-paid/5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-clay-100">
                        Payment Sent
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="figure font-bold text-ledger-paid text-sm">
                          -{formatINR(t.amount)}
                        </p>
                        <button onClick={() => handleDelete(t)} aria-label="Delete" className="text-clay-500 hover:text-ledger-overdue transition-colors p-2 -m-1 touch-manipulation">
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
        type="supplier"
        partyId={supplier.id}
        partyName={supplier.name}
      />
      {showAddPayment && (
        <AddSupplierPaymentSheet
          open={showAddPayment}
          onClose={() => setShowAddPayment(false)}
          supplierId={supplier.id}
          supplierName={supplier.name}
          outstandingBalance={supplier.outstandingBalance}
        />
      )}
    </BottomSheet>
  );
}
