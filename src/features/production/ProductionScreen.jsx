import { useState } from 'react';
import { Plus, Factory } from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import AddProductionSheet from './AddProductionSheet';
import { useProductionLog } from '../../core/hooks/useDexieHooks';
import { formatINR, formatNumber, formatDateDisplay, todayISO } from '../../core/utils/format';
import { useUIStore } from '../../core/store/uiStore';
import { deleteProductionBatch } from '../../core/db/ledgerEngine';

export default function ProductionScreen() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editRun, setEditRun] = useState(null);
  const productionLog = useProductionLog(120);
  const monthPrefix = todayISO().slice(0, 7);
  const monthRuns = (productionLog || []).filter((r) => (r.date || '').startsWith(monthPrefix));
  const monthBricks = monthRuns.reduce((s, r) => s + (r.quantity || 0), 0);
  const monthCost = monthRuns.reduce((s, r) => s + (r.totalCost || 0), 0);
  const pushToast = useUIStore(s => s.pushToast);

  const handleDelete = async (run) => {
    if (!window.confirm(`Delete ${formatNumber(run.quantity)} ${run.brickSize} bricks made on ${formatDateDisplay(run.date)}?\n\nBrick stock goes down and raw materials are returned.`)) return;
    try {
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

      {monthRuns.length > 0 && (
        <div className="px-5 md:px-8 max-w-7xl mx-auto mb-3">
          <GlassCard padding="p-4" className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] text-clay-500 uppercase tracking-wide">This month</p>
              <p className="figure text-lg font-bold text-ember-400">{formatNumber(monthBricks)}</p>
            </div>
            <div>
              <p className="text-[10px] text-clay-500 uppercase tracking-wide">Batches</p>
              <p className="figure text-lg font-bold text-clay-50">{monthRuns.length}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-clay-500 uppercase tracking-wide">Avg cost/brick</p>
              <p className="figure text-lg font-bold text-clay-50">₹{monthBricks ? (monthCost / monthBricks).toFixed(2) : '0.00'}</p>
            </div>
          </GlassCard>
        </div>
      )}

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
                <button onClick={() => { setEditRun(run); setSheetOpen(true); }} className="text-clay-400 hover:text-clay-100 px-2 py-2 text-xs uppercase font-bold tracking-wider touch-manipulation">
                  Edit
                </button>
                <button onClick={() => handleDelete(run)} className="text-ledger-overdue px-2 py-2 text-xs uppercase font-bold tracking-wider touch-manipulation">
                  Delete
                </button>
              </div>
            </div>
            <div className="flex items-end justify-between border-t border-white/5 pt-2.5">
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Total Cost" value={formatINR(run.totalCost)} />
                <Stat label="Cost / Brick" value={`₹${Number(run.costPerBrick || 0).toFixed(2)}`} highlight />
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
