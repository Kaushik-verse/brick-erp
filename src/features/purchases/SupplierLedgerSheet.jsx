import { useState } from 'react';
import { MessageCircle, FileText, Phone, Upload, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import StatusPill from '../../core/ui/StatusPill';
import { db } from '../../core/db/schema';
import { calculateAgingDays, deletePurchase, deleteSupplierPayment } from '../../core/db/ledgerEngine';
import { formatINR, formatDateDisplay } from '../../core/utils/format';
import { buildSupplierReminderLink, openWhatsAppLink } from '../../core/utils/whatsapp';
import { saveAndShareBlob } from '../../core/utils/nativeFileBridge';
import { useUIStore } from '../../core/store/uiStore';
import AddSupplierPaymentSheet from './AddSupplierPaymentSheet';

export default function SupplierLedgerSheet({ open, onClose, supplierId }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [sending, setSending] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);

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
        ...purchases.map(p => ({ ...p, type: 'purchase' })),
        ...payments.map(p => ({ ...p, type: 'payment' }))
      ];
      
      return mixed.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
    },
    [supplierId],
    []
  );

  const materials = useLiveQuery(() => db.rawMaterials.toArray(), [], []);
  const materialsById = Object.fromEntries((materials || []).map((m) => [m.id, m]));
  const settings = useLiveQuery(() => db.settings.toArray(), [], []);

  if (!supplier) return null;

  const handleWhatsAppReminder = async () => {
    const factory = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const link = buildSupplierReminderLink({
      name: supplier.name,
      phone: supplier.phone,
      amount: supplier.outstandingBalance,
      factoryName: factory.factoryName,
      factoryPhone: factory.factoryPhone,
    });
    await openWhatsAppLink(link);
  };

  const handleExportStatement = async () => {
    setSending(true);
    try {
      const { generateStatementPDF } = await import('../documents/pdfExport');
      const factory = Object.fromEntries(settings.map((s) => [s.key, s.value]));
      const blob = generateStatementPDF({
        party: supplier,
        transactions: transactions.filter(t => t.type === 'purchase') || [],
        factory,
        type: 'supplier',
      });
      await saveAndShareBlob(blob, `${supplier.name}_statement.pdf`, 'application/pdf');
      pushToast('Statement ready to share', 'success');
    } catch (e) {
      pushToast('Could not generate statement', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Are you sure you want to delete this ${t.type}? This will adjust balances.`)) return;
    try {
      if (t.type === 'purchase') {
        await deletePurchase(t.id);
      } else {
        await deleteSupplierPayment(t.id);
      }
      pushToast(`${t.type} deleted successfully`, 'success');
    } catch (e) {
      pushToast(e.message || 'Could not delete transaction', 'error');
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={supplier.name}>
      <div className="space-y-4">
        <div className="glass-surface-light rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-clay-400">Payable Balance</p>
            <p className="figure text-2xl font-bold text-ledger-overdue">
              {formatINR(supplier.outstandingBalance)}
            </p>
          </div>
          {supplier.phone && (
            <div className="flex items-center gap-1 text-clay-400 text-xs">
              <Phone size={12} /> {supplier.phone}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <GlassButton
            fullWidth
            onClick={() => setShowAddPayment(true)}
            icon={Upload}
          >
            Make Payment
          </GlassButton>
          <div className="flex gap-2">
            <GlassButton
              fullWidth
              onClick={handleWhatsAppReminder}
              icon={MessageCircle}
              disabled={supplier.outstandingBalance <= 0}
              className="!bg-[#25D366] !from-[#25D366] !to-[#1FAF54] !border-[#25D366]/40 px-0"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-clay-400 uppercase tracking-wide mb-2">
            Transaction History
          </p>
          <div className="space-y-2.5 max-h-[40vh] overflow-y-auto no-scrollbar">
            {(transactions || []).map((t) => {
              if (t.type === 'purchase') {
                const aging = calculateAgingDays(t.date);
                const status = t.balanceDue > 0 && aging > 30 ? 'overdue' : t.paymentStatus;
                return (
                  <div key={`purchase-${t.id}`} className="glass-surface-light rounded-xl p-3 border-l-2 border-transparent">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-clay-100">
                        {t.quantity} {materialsById[t.materialId]?.unit} {materialsById[t.materialId]?.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <StatusPill status={status} size="sm" />
                        <button onClick={() => handleDelete(t)} className="text-clay-500 hover:text-ledger-overdue transition-colors p-1 touch-manipulation">
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
                        <button onClick={() => handleDelete(t)} className="text-clay-500 hover:text-ledger-overdue transition-colors p-1 touch-manipulation">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-clay-400">
                      <span>{formatDateDisplay(t.date)}</span>
                      <span>{(t.paymentChannel || 'cash').toUpperCase()}{t.remarks ? ` · ${t.remarks}` : ''}</span>
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
