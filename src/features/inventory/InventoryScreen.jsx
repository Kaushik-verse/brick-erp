import { useState } from 'react';
import { AlertTriangle, Boxes, FileDown } from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import { useRawMaterials, useFinishedStock } from '../../core/hooks/useDexieHooks';
import { formatINR, formatNumber } from '../../core/utils/format';
import { useUIStore } from '../../core/store/uiStore';
import StockAdjustSheet from './StockAdjustSheet';

export default function InventoryScreen() {
  const [tab, setTab] = useState('raw'); // 'raw' | 'finished'
  const rawMaterials = useRawMaterials();
  const finishedStock = useFinishedStock();
  const pushToast = useUIStore((s) => s.pushToast);
  const [adjust, setAdjust] = useState(null); // { item, itemType }

  const activeRaw = (rawMaterials || []).filter((m) => m.isActive !== 0);
  const activeFinished = (finishedStock || []).filter((f) => f.isActive !== 0);
  const lowCount = activeRaw.filter((m) => (m.reorderLevel || 0) > 0 && m.currentStock < m.reorderLevel).length;

  const rawValue = (rawMaterials || []).reduce((s, m) => s + m.currentStock * m.avgRate, 0);
  const finishedValue = (finishedStock || []).reduce((s, f) => s + f.currentStock * f.costPrice, 0);

  const handleExport = async () => {
    try {
      const { exportInventoryValuationExcel } = await import('../documents/excelExport');
      await exportInventoryValuationExcel(rawMaterials || [], finishedStock || []);
      pushToast('Inventory valuation exported', 'success');
    } catch (e) {
      pushToast('Export failed', 'error');
    }
  };

  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader
        eyebrow="Live Valuation"
        title="Inventory"
        action={
          <GlassButton size="sm" variant="glass" icon={FileDown} onClick={handleExport}>
            Export
          </GlassButton>
        }
      />

      <div className="px-5 md:px-8 max-w-7xl mx-auto space-y-4 md:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-4">
          <GlassCard padding="p-3.5">
            <p className="text-[11px] text-clay-400 uppercase tracking-wide mb-1">Raw Material Value</p>
            <p className="figure text-lg font-bold text-clay-50">{formatINR(rawValue)}</p>
          </GlassCard>
          <GlassCard padding="p-3.5">
            <p className="text-[11px] text-clay-400 uppercase tracking-wide mb-1">Finished Stock Value</p>
            <p className="figure text-lg font-bold text-ember-400">{formatINR(finishedValue)}</p>
          </GlassCard>
        </div>
        <p className="text-[11px] text-clay-500 -mt-2 px-1">Tap any item to correct its stock (opening stock, physical count, breakage).</p>

        <div className="flex p-1 rounded-2xl glass-surface-light gap-1 mb-4">
          <TabButton active={tab === 'raw'} onClick={() => setTab('raw')}>
            Raw Materials{lowCount > 0 ? ` · ${lowCount} low` : ''}
          </TabButton>
          <TabButton active={tab === 'finished'} onClick={() => setTab('finished')}>
            Finished Bricks
          </TabButton>
        </div>

        {tab === 'raw' && (
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
            {activeRaw.map((m) => {
              const isLow = (m.reorderLevel || 0) > 0 && m.currentStock < m.reorderLevel;
              return (
                <GlassCard key={m.id} padding="p-4" onClick={() => setAdjust({ item: m, itemType: 'raw' })}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-clay-50">{m.name}</p>
                      <p className="text-xs text-clay-400">
                        Avg rate ₹{formatNumber(m.unit === 'kg' ? m.avgRate * 1000 : m.avgRate, 2)}/{m.unit === 'kg' ? 'Ton' : m.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="figure text-lg font-bold text-clay-50">
                        {formatNumber(m.unit === 'kg' ? m.currentStock / 1000 : m.currentStock, m.unit === 'kg' ? 3 : 2)}{' '}
                        <span className="text-xs text-clay-400">{m.unit === 'kg' ? 'Ton' : m.unit}</span>
                      </p>
                      <p className="figure text-xs text-clay-400">
                        {formatINR(m.currentStock * m.avgRate)}
                      </p>
                    </div>
                  </div>
                  {isLow && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
                      <AlertTriangle size={13} className="text-ledger-overdue" />
                      <span className="text-xs text-ledger-overdue font-medium">
                        Below reorder level ({formatNumber(m.unit === 'kg' ? m.reorderLevel / 1000 : m.reorderLevel, m.unit === 'kg' ? 3 : 2)} {m.unit === 'kg' ? 'Ton' : m.unit})
                      </span>
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}

        {tab === 'finished' && (
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
            {activeFinished.map((f) => (
              <GlassCard key={f.id} padding="p-4" onClick={() => setAdjust({ item: f, itemType: 'finished' })}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <Boxes size={18} className="text-ember-400" />
                    <p className="font-semibold text-clay-50">{f.brickSize} Brick</p>
                  </div>
                  <p className="figure text-xl font-bold text-clay-50">
                    {formatNumber(f.currentStock)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-white/5">
                  <div>
                    <p className="text-[10px] text-clay-500 uppercase">Cost Price</p>
                    <p className="figure text-sm font-semibold text-clay-200">₹{(f.costPrice || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-clay-500 uppercase">Selling Price</p>
                    <p className="figure text-sm font-semibold text-clay-200">₹{f.sellingPrice}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-clay-500 uppercase">Margin</p>
                    <p className={`figure text-sm font-semibold ${f.sellingPrice - f.costPrice >= 0 ? 'text-ledger-paid' : 'text-ledger-overdue'}`}>
                      ₹{((f.sellingPrice || 0) - (f.costPrice || 0)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      <StockAdjustSheet
        open={!!adjust}
        item={adjust?.item}
        itemType={adjust?.itemType}
        onClose={() => setAdjust(null)}
      />
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-all touch-manipulation ${
        active ? 'bg-gradient-to-b from-ember-500 to-ember-600 text-clay-50' : 'text-clay-400'
      }`}
    >
      {children}
    </button>
  );
}
