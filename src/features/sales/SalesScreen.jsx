import { useState, useMemo } from 'react';
import { Plus, Search, MessageCircle, FileDown } from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput } from '../../core/ui/GlassFormControls';
import CustomerLedgerSheet from './CustomerLedgerSheet';
import AddSaleSheet from './AddSaleSheet';
import { useCustomers, useSalesLog } from '../../core/hooks/useDexieHooks';
import { formatINR } from '../../core/utils/format';
import { buildOutstandingReminderLink, openWhatsAppLink } from '../../core/utils/whatsapp';
import { useUIStore } from '../../core/store/uiStore';

export default function SalesScreen({ onNavigate }) {
  const [addSaleOpen, setAddSaleOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [search, setSearch] = useState('');
  const customers = useCustomers();
  const salesLog = useSalesLog(500);
  const pushToast = useUIStore((s) => s.pushToast);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = search.trim().toLowerCase();
    const list = q
      ? customers.filter((c) => c.name.toLowerCase().includes(q))
      : customers;
    return [...list].sort((a, b) => (b.outstandingBalance || 0) - (a.outstandingBalance || 0));
  }, [customers, search]);

  const totalOutstanding = (customers || []).reduce(
    (s, c) => s + (c.outstandingBalance || 0),
    0
  );

  const handleExport = async () => {
    try {
      const { exportSalesLedgerExcel } = await import('../documents/excelExport');
      const byId = Object.fromEntries((customers || []).map((c) => [c.id, c]));
      await exportSalesLedgerExcel(salesLog || [], byId);
      pushToast('Sales ledger exported', 'success');
    } catch {
      pushToast('Export failed', 'error');
    }
  };

  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader
        eyebrow="Receivables"
        title="Sales & Customers"
        action={
          <GlassButton size="sm" icon={Plus} onClick={() => setAddSaleOpen(true)}>
            Sale
          </GlassButton>
        }
      />

      <div className="px-5 md:px-8 space-y-4 md:space-y-6 max-w-7xl mx-auto">
        <GlassCard padding="p-4" className="flex items-center justify-between">
          <div>
            <p className="text-xs text-clay-400 uppercase tracking-wide">Total Outstanding</p>
            <p className="figure text-2xl font-bold text-ledger-overdue">
              {formatINR(totalOutstanding)}
            </p>
          </div>
          <GlassButton size="sm" variant="glass" icon={FileDown} onClick={handleExport}>
            Export
          </GlassButton>
        </GlassCard>

        <GlassInput
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="space-y-2.5 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
          {filtered.map((c) => (
            <GlassCard
              key={c.id}
              padding="p-3.5"
              onClick={() => setSelectedCustomerId(c.id)}
              className="flex items-center justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-clay-50 truncate">{c.name}</p>
                <p className="text-xs text-clay-500">{c.phone || 'No phone on file'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p
                    className={`figure font-bold ${
                      c.outstandingBalance > 0 ? 'text-ledger-overdue' : 'text-ledger-paid'
                    }`}
                  >
                    {formatINR(c.outstandingBalance || 0)}
                  </p>
                </div>
                {c.outstandingBalance > 0 && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const link = buildOutstandingReminderLink({
                        name: c.name,
                        phone: c.phone,
                        amount: c.outstandingBalance,
                      });
                      await openWhatsAppLink(link);
                    }}
                    className="w-9 h-9 rounded-full bg-[#25D366]/15 flex items-center justify-center touch-manipulation"
                  >
                    <MessageCircle size={16} className="text-[#25D366]" />
                  </button>
                )}
              </div>
            </GlassCard>
          ))}

          {filtered.length === 0 && (
            <GlassCard padding="p-8" className="text-center">
              <p className="text-clay-400">No customers found.</p>
            </GlassCard>
          )}
        </div>
      </div>

      <CustomerLedgerSheet
        open={!!selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
        customerId={selectedCustomerId}
        onNavigate={onNavigate}
      />
      {addSaleOpen && (
        <AddSaleSheet open={addSaleOpen} onClose={() => setAddSaleOpen(false)} />
      )}
    </div>
  );
}
