import { useState } from 'react';
import { ArrowLeft, FileText, FileSpreadsheet, MessageCircle, Calendar } from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput } from '../../core/ui/GlassFormControls';
import { compileEndOfDaySummary } from '../../core/drive/eodSummary';
import { openWhatsAppLink } from '../../core/utils/whatsapp';
import { todayISO } from '../../core/utils/format';
import { useUIStore } from '../../core/store/uiStore';
import { useCustomers, useSalesLog, useSuppliers, usePurchaseLog, useRawMaterials, useFinishedStock } from '../../core/hooks/useDexieHooks';

export default function DocumentHubScreen({ onBack }) {
  const [eodDate, setEodDate] = useState(todayISO());
  const [summaryText, setSummaryText] = useState('');
  const [generating, setGenerating] = useState(false);
  const pushToast = useUIStore((s) => s.pushToast);

  const customers = useCustomers();
  const suppliers = useSuppliers();
  const salesLog = useSalesLog(1000);
  const purchaseLog = usePurchaseLog(1000);
  const rawMaterials = useRawMaterials();
  const finishedStock = useFinishedStock();

  const handleCompileSummary = async () => {
    setGenerating(true);
    try {
      const text = await compileEndOfDaySummary(eodDate);
      setSummaryText(text);
    } catch {
      pushToast('Could not compile summary', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleShareSummary = async () => {
    if (!summaryText) return;
    const encoded = encodeURIComponent(summaryText);
    await openWhatsAppLink(`https://api.whatsapp.com/send?text=${encoded}`);
  };

  return (
    <div className="pb-32">
      <ScreenHeader
        eyebrow="Reports"
        title="Document Hub"
        action={
          <button onClick={onBack} className="w-10 h-10 rounded-full glass-surface-light flex items-center justify-center touch-manipulation">
            <ArrowLeft size={18} className="text-clay-300" />
          </button>
        }
      />

      <div className="px-5 space-y-4">
        <GlassCard padding="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-ember-400" />
            <h3 className="text-sm font-semibold text-clay-100">End-of-Day Summary</h3>
          </div>
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <GlassInput type="date" value={eodDate} onChange={(e) => setEodDate(e.target.value)} max={todayISO()} />
            </div>
            <GlassButton onClick={handleCompileSummary} disabled={generating} size="sm">
              {generating ? 'Compiling…' : 'Compile'}
            </GlassButton>
          </div>
          {summaryText && (
            <>
              <div className="glass-surface-light rounded-xl p-3 mb-3 max-h-64 overflow-y-auto no-scrollbar">
                <pre className="text-xs text-clay-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {summaryText}
                </pre>
              </div>
              <GlassButton
                fullWidth
                onClick={handleShareSummary}
                icon={MessageCircle}
                className="!bg-[#25D366] !from-[#25D366] !to-[#1FAF54] !border-[#25D366]/40"
              >
                Send to Owner via WhatsApp
              </GlassButton>
            </>
          )}
        </GlassCard>

        <GlassCard padding="p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileSpreadsheet size={16} className="text-ember-400" />
            <h3 className="text-sm font-semibold text-clay-100">Excel Exports</h3>
          </div>
          <div className="space-y-2.5">
            <ExportRow
              label="Sales Ledger"
              onClick={async () => {
                const { exportSalesLedgerExcel } = await import('./excelExport');
                const byId = Object.fromEntries((customers || []).map((c) => [c.id, c]));
                await exportSalesLedgerExcel(salesLog || [], byId);
                pushToast('Sales ledger exported', 'success');
              }}
            />
            <ExportRow
              label="Purchase Ledger"
              onClick={async () => {
                const { exportPurchaseLedgerExcel } = await import('./excelExport');
                const supplierById = Object.fromEntries((suppliers || []).map((s) => [s.id, s]));
                const materialById = Object.fromEntries((rawMaterials || []).map((m) => [m.id, m]));
                await exportPurchaseLedgerExcel(purchaseLog || [], supplierById, materialById);
                pushToast('Purchase ledger exported', 'success');
              }}
            />
            <ExportRow
              label="Inventory Valuation"
              onClick={async () => {
                const { exportInventoryValuationExcel } = await import('./excelExport');
                await exportInventoryValuationExcel(rawMaterials || [], finishedStock || []);
                pushToast('Inventory valuation exported', 'success');
              }}
            />
          </div>
        </GlassCard>

        <GlassCard padding="p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-ember-400" />
            <h3 className="text-sm font-semibold text-clay-100">PDF Statements</h3>
          </div>
          <p className="text-xs text-clay-400 leading-relaxed">
            Generate individual customer/supplier statements from their ledger screen — tap any
            customer or supplier in Sales or Purchases, then "Statement".
          </p>
        </GlassCard>
      </div>
    </div>
  );
}

function ExportRow({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between glass-surface-light rounded-xl px-3.5 h-12 touch-manipulation"
    >
      <span className="text-sm font-medium text-clay-100">{label}</span>
      <FileSpreadsheet size={15} className="text-ledger-paid" />
    </button>
  );
}
