import { useState } from 'react';
import { Plus, Factory } from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import AddProductionSheet from './AddProductionSheet';
import { useProductionLog } from '../../core/hooks/useDexieHooks';
import { formatINR, formatNumber, formatDateDisplay } from '../../core/utils/format';
import { useUIStore } from '../../core/store/uiStore';

export default function ProductionScreen() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editRun, setEditRun] = useState(null);
  const productionLog = useProductionLog(60);
  const pushToast = useUIStore(s => s.pushToast);

  const handleDelete = async (run) => {
    if (!window.confirm(`Delete ${run.quantity} ${run.brickSize} bricks? This will deduct finished stock and restore raw materials.`)) return;
    try {
      const { deleteProductionBatch } = await import('../../core/db/ledgerEngine');
      await deleteProductionBatch(run.id);
      pushToast("Production deleted", "success");
    } catch (e) {
      pushToast(e.message || "Could not delete", "error");
    }
  };

  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader
        eyebrow="Manufacturing"
        title="Production Log"
        action={
          <GlassButton size="sm" icon={Plus} onClick={() => setSheetOpen(true)}>
            Log
          </GlassButton>
        }
      />

      <div className="px-5 md:px-8 space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 max-w-7xl mx-auto">
        {productionLog && productionLog.length === 0 && (
          <GlassCard padding="p-8" className="text-center">
            <Factory size={28} className="mx-auto mb-3 text-clay-500" />
            <p className="text-clay-300 font-medium">No production logged yet</p>
            <p className="text-sm text-clay-500 mt-1">
              Tap "Log" to record your first batch and auto-deduct raw materials.
            </p>
          </GlassCard>
        )}

        {(productionLog || []).map((run) => (
          <GlassCard key={run.id} padding="p-4">
            <div className="flex items-start justify-between mb-2.5">
              <div>
                <p className="font-semibold text-clay-50">{run.brickSize} Brick</p>
                <p className="text-xs text-clay-400">{formatDateDisplay(run.date)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditRun(run); setSheetOpen(true); }} className="text-clay-400 hover:text-clay-100 p-1 text-xs uppercase font-bold tracking-wider">
                  Edit
                </button>
                <button onClick={() => handleDelete(run)} className="text-red-400 hover:text-red-300 p-1 text-xs uppercase font-bold tracking-wider">
                  Delete
                </button>
              </div>
            </div>
            <div className="flex items-end justify-between border-t border-white/5 pt-2.5">
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Material Cost" value={formatINR(run.materialCost || run.totalCost)} />
                <Stat label="Cost / Brick" value={`₹${run.costPerBrick}`} highlight />
              </div>
              <div className="text-right">
                <p className="figure text-lg font-bold text-ember-400">
                  {formatNumber(run.quantity)}
                </p>
                <p className="text-[11px] text-clay-500">bricks</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <AddProductionSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditRun(null); }} editRun={editRun} />
    </div>
  );
}

function Stat({ label, value, highlight, icon: Icon }) {
  return (
    <div>
      <p className="text-[10px] text-clay-500 uppercase tracking-wide flex items-center gap-1">
        {Icon && <Icon size={10} />}
        {label}
      </p>
      <p className={`figure text-sm font-semibold ${highlight ? 'text-ember-400' : 'text-clay-200'}`}>
        {value}
      </p>
    </div>
  );
}
