import { useState, useMemo } from 'react';
import { Plus, Search, MessageCircle, FileDown } from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput } from '../../core/ui/GlassFormControls';
import AddPurchaseSheet from './AddPurchaseSheet';
import SupplierLedgerSheet from './SupplierLedgerSheet';
import { useSuppliers, usePurchaseLog, useRawMaterials } from '../../core/hooks/useDexieHooks';
import { formatINR } from '../../core/utils/format';
import { buildSupplierReminderLink, openWhatsAppLink } from '../../core/utils/whatsapp';
import { useUIStore } from '../../core/store/uiStore';

export default function PurchasesScreen() {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [search, setSearch] = useState('');
  const suppliers = useSuppliers();
  const purchaseLog = usePurchaseLog(500);
  const rawMaterials = useRawMaterials();
  const pushToast = useUIStore((s) => s.pushToast);

  const filtered = useMemo(() => {
    if (!suppliers) return [];
    const q = search.trim().toLowerCase();
    const list = q ? suppliers.filter((s) => s.name.toLowerCase().includes(q)) : suppliers;
    return [...list].sort((a, b) => (b.outstandingBalance || 0) - (a.outstandingBalance || 0));
  }, [suppliers, search]);

  const totalPayable = (suppliers || []).reduce((s, r) => s + (r.outstandingBalance || 0), 0);

  const handleExport = async () => {
    try {
      const { exportPurchaseLedgerExcel } = await import('../documents/excelExport');
      const supplierById = Object.fromEntries((suppliers || []).map((s) => [s.id, s]));
      const materialById = Object.fromEntries((rawMaterials || []).map((m) => [m.id, m]));
      await exportPurchaseLedgerExcel(purchaseLog || [], supplierById, materialById);
      pushToast('Purchase ledger exported', 'success');
    } catch {
      pushToast('Export failed', 'error');
    }
  };

  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader
        eyebrow="Payables"
        title="Purchases & Suppliers"
        action={
          <GlassButton size="sm" icon={Plus} onClick={() => setAddOpen(true)}>
            Purchase
          </GlassButton>
        }
      />

      <div className="px-5 md:px-8 space-y-4 md:space-y-6 max-w-7xl mx-auto">
        <GlassCard padding="p-4" className="flex items-center justify-between">
          <div>
            <p className="text-xs text-clay-400 uppercase tracking-wide">Total Payable</p>
            <p className="figure text-2xl font-bold text-ledger-overdue">
              {formatINR(totalPayable)}
            </p>
          </div>
          <GlassButton size="sm" variant="glass" icon={FileDown} onClick={handleExport}>
            Export
          </GlassButton>
        </GlassCard>

        <GlassInput
          placeholder="Search suppliers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="space-y-2.5 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
          {filtered.map((s) => (
            <GlassCard
              key={s.id}
              padding="p-3.5"
              onClick={() => setSelectedSupplierId(s.id)}
              className="flex items-center justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-clay-50 truncate">{s.name}</p>
                <p className="text-xs text-clay-500">{s.phone || 'No phone on file'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p
                  className={`figure font-bold ${
                    s.outstandingBalance > 0 ? 'text-ledger-overdue' : 'text-ledger-paid'
                  }`}
                >
                  {formatINR(s.outstandingBalance || 0)}
                </p>
                {s.outstandingBalance > 0 && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const link = buildSupplierReminderLink({
                        name: s.name,
                        phone: s.phone,
                        amount: s.outstandingBalance,
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
              <p className="text-clay-400">No suppliers found.</p>
            </GlassCard>
          )}
        </div>
      </div>

      <AddPurchaseSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <SupplierLedgerSheet
        open={!!selectedSupplierId}
        onClose={() => setSelectedSupplierId(null)}
        supplierId={selectedSupplierId}
      />
    </div>
  );
}
