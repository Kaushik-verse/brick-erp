import { useState, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput } from '../../core/ui/GlassFormControls';
import { adjustStock } from '../../core/db/ledgerEngine';
import { db } from '../../core/db/schema';
import { useUIStore } from '../../core/store/uiStore';
import { formatNumber, formatDateDisplay } from '../../core/utils/format';

const REASONS = ['Opening stock', 'Physical count', 'Breakage / wastage', 'Correction'];

/**
 * StockAdjustSheet
 * -----------------
 * Correct the stock of a raw material or brick product (opening stock,
 * physical count, breakage). Every change is logged with the before /
 * after quantity so nothing changes silently. Raw materials stored in kg
 * are entered in Tons, matching the rest of the app.
 */
export default function StockAdjustSheet({ open, onClose, item, itemType }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const isKg = itemType === 'raw' && (item?.unit || '').toLowerCase() === 'kg';
  const factor = isKg ? 1000 : 1;
  const displayUnit = itemType === 'finished' ? 'bricks' : isKg ? 'Ton' : item?.unit || '';

  const [newStock, setNewStock] = useState('');
  const [reorder, setReorder] = useState('');
  const [reason, setReason] = useState(REASONS[1]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && item) {
      setNewStock(String(+((item.currentStock || 0) / factor).toFixed(3)));
      setReorder(item.reorderLevel !== undefined ? String(+((item.reorderLevel || 0) / factor).toFixed(3)) : '');
      setReason(REASONS[1]);
      setNote('');
    }
  }, [open, item, factor]);

  const history = useLiveQuery(
    async () => {
      if (!item) return [];
      const rows = await db.stockAdjustments.where('itemId').equals(item.id).toArray();
      return rows
        .filter((r) => r.itemType === itemType)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 5);
    },
    [item?.id, itemType],
    []
  );

  if (!item) return null;

  const current = (item.currentStock || 0) / factor;
  const target = Number(newStock);
  const delta = Number.isFinite(target) ? target - current : 0;

  const handleSave = async () => {
    if (newStock === '' || !Number.isFinite(target) || target < 0) {
      pushToast('Enter the correct stock (0 or more)', 'error');
      return;
    }
    setSaving(true);
    try {
      const fullReason = note.trim() ? `${reason}: ${note.trim()}` : reason;
      const res = await adjustStock({ itemType, itemId: item.id, newStock: target * factor, reason: fullReason });
      if (itemType === 'raw' && reorder !== '' && Number(reorder) >= 0) {
        await db.rawMaterials.update(item.id, { reorderLevel: Number(reorder) * factor });
      }
      pushToast(res.delta === 0 ? 'Saved — no stock change' : 'Stock updated', 'success');
      onClose();
    } catch (e) {
      pushToast(e.message || 'Could not update stock', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Adjust ${item.name || `${item.brickSize} Brick`}`}>
      <div className="space-y-4">
        <div className="glass-surface-light rounded-2xl p-3.5 flex justify-between items-center">
          <span className="text-sm text-clay-300">Current stock</span>
          <span className="figure font-bold text-clay-50">
            {formatNumber(current, isKg ? 3 : itemType === 'finished' ? 0 : 2)} {displayUnit}
          </span>
        </div>

        <GlassInput
          label={`Correct stock (${displayUnit})`}
          type="number"
          inputMode="decimal"
          min="0"
          value={newStock}
          onChange={(e) => setNewStock(e.target.value)}
        />
        {newStock !== '' && Math.abs(delta) > 0.0005 && (
          <p className={`text-xs -mt-2 ml-1 ${delta > 0 ? 'text-ledger-paid' : 'text-ledger-overdue'}`}>
            {delta > 0 ? 'Adds' : 'Removes'} {formatNumber(Math.abs(delta), isKg ? 3 : 2)} {displayUnit}
          </p>
        )}

        <div>
          <span className="block text-xs font-medium text-clay-300/80 mb-1.5 ml-1 tracking-wide uppercase">Reason</span>
          <div className="grid grid-cols-2 gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`h-11 rounded-xl text-xs font-semibold touch-manipulation transition-colors ${
                  reason === r ? 'bg-gradient-to-b from-ember-500 to-ember-600 text-clay-50' : 'glass-surface-light text-clay-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <GlassInput label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. counted on Sunday" />

        {itemType === 'raw' && (
          <GlassInput
            label={`Low-stock alert below (${displayUnit})`}
            type="number"
            inputMode="decimal"
            min="0"
            value={reorder}
            onChange={(e) => setReorder(e.target.value)}
          />
        )}

        <GlassButton fullWidth onClick={handleSave} disabled={saving} icon={SlidersHorizontal}>
          {saving ? 'Saving…' : 'Save'}
        </GlassButton>

        {history?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-clay-400 uppercase tracking-wide mb-2">Recent adjustments</p>
            <div className="space-y-1.5">
              {history.map((h) => (
                <div key={h.id} className="flex justify-between text-xs glass-surface-light rounded-xl px-3 py-2">
                  <span className="text-clay-300 truncate pr-2">
                    {formatDateDisplay(h.date)} · {h.reason || 'Adjustment'}
                  </span>
                  <span className={`figure shrink-0 ${h.delta > 0 ? 'text-ledger-paid' : 'text-ledger-overdue'}`}>
                    {h.delta > 0 ? '+' : '−'}
                    {formatNumber(Math.abs(h.delta) / factor, isKg ? 3 : 2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
