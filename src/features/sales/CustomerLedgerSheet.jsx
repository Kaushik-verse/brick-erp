import { useState } from 'react';
import { MessageCircle, FileText, Phone, Download, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import StatusPill from '../../core/ui/StatusPill';
import { db } from '../../core/db/schema';
import { calculateAgingDays, deleteSale, deleteCustomerCollection } from '../../core/db/ledgerEngine';
import { formatINR, formatDateDisplay } from '../../core/utils/format';
import { buildOutstandingReminderLink, openWhatsAppLink } from '../../core/utils/whatsapp';
import { saveAndShareBlob } from '../../core/utils/nativeFileBridge';
import { useUIStore } from '../../core/store/uiStore';
import AddCollectionSheet from './AddCollectionSheet';
import { generateInvoicePDF, generateStatementPDF } from '../documents/pdfExport';

export default function CustomerLedgerSheet({ open, onClose, customerId }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [sending, setSending] = useState(false);
  const [showAddCollection, setShowAddCollection] = useState(false);

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
      
      return mixed.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
    },
    [customerId],
    []
  );

  const settings = useLiveQuery(() => db.settings.toArray(), [], []);

  if (!customer) return null;

  const handleWhatsAppReminder = async () => {
    const factory = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const link = buildOutstandingReminderLink({
      name: customer.name,
      phone: customer.phone,
      amount: customer.outstandingBalance,
      factoryName: factory.factoryName,
      factoryPhone: factory.factoryPhone,
    });
    await openWhatsAppLink(link);
  };

  const handleExportStatement = async () => {
    setSending(true);
    try {
      const factory = Object.fromEntries(settings.map((s) => [s.key, s.value]));
      const blob = generateStatementPDF({
        party: customer,
        transactions: transactions.filter(t => t.type === 'sale') || [],
        factory,
        type: 'customer',
      });
      await saveAndShareBlob(blob, `${customer.name}_statement.pdf`, 'application/pdf');
      pushToast('Statement ready to share', 'success');
    } catch (e) {
      pushToast('Could not generate statement', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setSending(true);
    try {
      const factory = Object.fromEntries(settings.map((s) => [s.key, s.value]));
      const sales = transactions.filter(t => t.type === 'sale');
      
      if (sales.length === 0) {
        pushToast('No sales found to generate invoice', 'error');
        setSending(false);
        return;
      }

      // Group sales by brick size
      const grouped = {};
      let subtotal = 0;
      let amountPaid = 0;
      
      for (const s of sales) {
         if (!grouped[s.brickSize]) {
             grouped[s.brickSize] = { quantity: 0, amount: 0, rate: s.rate };
         }
         grouped[s.brickSize].quantity += s.quantity;
         grouped[s.brickSize].amount += s.totalAmount;
         // Note: If rate differs across time, this will just show the first rate encountered or an average. 
         // For a true invoice, we should list every line, but rolling them up is cleaner for a consolidated bill.
         subtotal += s.totalAmount;
         amountPaid += s.amountPaid;
      }

      const items = Object.entries(grouped).map(([brickSize, data]) => ({
         description: `Fly Ash Brick - ${brickSize}`,
         quantity: data.quantity,
         rate: data.amount / data.quantity, // average rate
         amount: data.amount
      }));

      // Calculate total payments from collections as well
      const collections = transactions.filter(t => t.type === 'collection');
      const totalCollected = collections.reduce((acc, c) => acc + c.amount, 0) + amountPaid;
      const balanceDue = Math.max(0, subtotal - totalCollected);
      
      const invoiceData = {
         invoiceNumber: `CON-${String(customer.id).padStart(4, '0')}`,
         date: new Date().toISOString(),
         type: balanceDue > 0 ? 'CREDIT BILL' : 'CASH BILL'
      };

      const summaryData = {
         subtotal,
         grandTotal: subtotal,
         amountPaid: totalCollected,
         balanceDue: balanceDue,
         paymentStatus: balanceDue > 0 ? 'partial' : 'paid',
         paymentChannel: 'mixed'
      };

      const blob = generateInvoicePDF({
        invoice: invoiceData,
        items,
        summary: summaryData,
        customer,
        factory,
      });

      await saveAndShareBlob(blob, `${customer.name}_invoice.pdf`, 'application/pdf');
      pushToast('Invoice generated successfully', 'success');
    } catch (e) {
      pushToast('Could not generate invoice', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Are you sure you want to delete this ${t.type}? This will adjust balances.`)) return;
    try {
      if (t.type === 'sale') {
        await deleteSale(t.id);
      } else {
        await deleteCustomerCollection(t.id);
      }
      pushToast(`${t.type} deleted successfully`, 'success');
    } catch (e) {
      pushToast(e.message || 'Could not delete transaction', 'error');
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={customer.name}>
      <div className="space-y-4">
        <div className="glass-surface-light rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-clay-400">Outstanding Balance</p>
            <p className="figure text-2xl font-bold text-ledger-overdue">
              {formatINR(customer.outstandingBalance)}
            </p>
          </div>
          {customer.phone && (
            <div className="flex items-center gap-1 text-clay-400 text-xs">
              <Phone size={12} /> {customer.phone}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <GlassButton
            fullWidth
            onClick={() => setShowAddCollection(true)}
            icon={Download}
          >
            Receive Payment
          </GlassButton>
          <div className="flex gap-2">
            <GlassButton
              fullWidth
              onClick={handleWhatsAppReminder}
              icon={MessageCircle}
              disabled={customer.outstandingBalance <= 0}
              className="!bg-[#25D366] !from-[#25D366] !to-[#1FAF54] !border-[#25D366]/40"
              style={{ paddingLeft: 0, paddingRight: 0 }}
            />
            <GlassButton
              variant="glass"
              fullWidth
              onClick={handleGenerateInvoice}
              icon={FileText}
              disabled={sending}
            >
              PDF
            </GlassButton>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-clay-400 uppercase tracking-wide mb-2">
            Transaction History
          </p>
          <div className="space-y-2.5 max-h-[40vh] overflow-y-auto no-scrollbar">
            {(transactions || []).map((t) => {
              if (t.type === 'sale') {
                const aging = calculateAgingDays(t.date);
                const status = t.balanceDue > 0 && aging > 30 ? 'overdue' : t.paymentStatus;
                return (
                  <div key={`sale-${t.id}`} className="glass-surface-light rounded-xl p-3 border-l-2 border-transparent">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-clay-100">
                        {t.quantity} × {t.brickSize}
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
                  <div key={`col-${t.id}`} className="glass-surface-light rounded-xl p-3 border-l-2 border-ledger-paid bg-ledger-paid/5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-clay-100">
                        Payment Received
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="figure font-bold text-ledger-paid text-sm">
                          +{formatINR(t.amount)}
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
