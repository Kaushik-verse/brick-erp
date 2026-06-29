import { useState, useEffect, useMemo } from 'react';
import { Zap, Factory, AlertTriangle } from 'lucide-react';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput, GlassSelect } from '../../core/ui/GlassFormControls';
import {
  computeMaterialRequirement,
  checkInventorySufficiency,
  recordProduction,
} from '../../core/db/recipeEngine';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/schema';
import { useUIStore } from '../../core/store/uiStore';
import { todayISO, formatNumber } from '../../core/utils/format';
import { hapticTap } from '../../core/utils/nativeFileBridge';

export default function AddProductionSheet({ open, onClose }) {
  const pushToast = useUIStore((s) => s.pushToast);

  const [date, setDate] = useState(todayISO());
  const [brickSize, setBrickSize] = useState('4-inch');
  const [quantity, setQuantity] = useState('');
  const [requirement, setRequirement] = useState(null);
  const [shortfalls, setShortfalls] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const products = useLiveQuery(() => db.finishedStock.toArray(), [], []);
  const materials = useLiveQuery(() => db.rawMaterials.toArray(), [], []);
  const materialsById = Object.fromEntries((materials || []).map(m => [m.id, m]));

  const qtyNum = Number(quantity) || 0;

  useEffect(() => {
    let active = true;
    if (qtyNum > 0) {
      computeMaterialRequirement(brickSize, qtyNum).then((req) => {
        if (active) setRequirement(req);
      });
      checkInventorySufficiency(brickSize, qtyNum).then((sf) => {
        if (active) setShortfalls(sf);
      });
    } else {
      setRequirement(null);
      setShortfalls([]);
    }
    return () => {
      active = false;
    };
  }, [brickSize, qtyNum]);

  const resetForm = () => {
    setQuantity('');
    setError('');
  };

  const handleSubmit = async () => {
    setError('');
    if (!qtyNum || qtyNum <= 0) {
      setError('Enter a valid production quantity.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await recordProduction({
        date,
        brickSize,
        quantity: qtyNum,
        allowOverdraw: false, // Strict block on overdraw
      });
      await hapticTap();
      pushToast(`Logged ${qtyNum} ${brickSize} bricks · Cost/brick ₹${result.costPerBrick}`, 'success');
      resetForm();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to record production.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Log Production">
      <div className="space-y-4">
        <GlassInput
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={todayISO()}
        />

        <GlassSelect
          label="Product"
          value={brickSize}
          onChange={(e) => setBrickSize(e.target.value)}
        >
          {(products || []).filter(p => p.isActive !== 0).map((p) => (
            <option key={p.id} value={p.brickSize}>
              {p.brickSize}
            </option>
          ))}
        </GlassSelect>

        <GlassInput
          label="Quantity Produced"
          type="number"
          inputMode="numeric"
          placeholder="e.g. 5000"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />


        {requirement && (
          <div className="glass-surface-light rounded-2xl p-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <Factory size={15} className="text-clay-300" />
              <span className="text-sm font-semibold text-clay-100">Materials Required</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {Object.entries(requirement.materialsRequired || {}).map(([matId, qty]) => {
                const mat = materialsById[matId];
                const unit = mat?.unit || 'kg';
                const isKg = unit.toLowerCase() === 'kg';
                const displayQty = isKg ? qty / 1000 : qty;
                const displayUnit = isKg ? 'Ton' : unit;
                return (
                  <MaterialRow 
                    key={matId} 
                    label={mat?.name || `Material ${matId}`} 
                    value={displayQty} 
                    unit={displayUnit} 
                  />
                );
              })}
            </div>
          </div>
        )}

        {shortfalls.length > 0 && (
          <div className="rounded-2xl p-3.5 bg-ledger-overdue/10 border border-ledger-overdue/30">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle size={15} className="text-ledger-overdue" />
              <span className="text-sm font-semibold text-ledger-overdue">Insufficient Stock</span>
            </div>
            {shortfalls.map((s) => {
              const mat = materialsById[s.materialId];
              const isKg = mat?.unit === 'kg';
              const dNeeded = isKg ? s.needed / 1000 : s.needed;
              const dAvail = isKg ? s.available / 1000 : s.available;
              const dShort = isKg ? s.shortBy / 1000 : s.shortBy;
              const unit = isKg ? 'Ton' : (mat?.unit || 'kg');
              
              return (
                <p key={s.materialId || s.material} className="text-xs text-clay-300">
                  {s.material}: need {formatNumber(dNeeded, isKg ? 3 : 2)}{unit}, only {formatNumber(dAvail, isKg ? 3 : 2)}{unit} available (short by {formatNumber(dShort, isKg ? 3 : 2)}{unit})
                </p>
              );
            })}
            <p className="text-xs text-ledger-overdue mt-1.5 font-semibold">
              Production is blocked until materials are restocked.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-ledger-overdue text-center">{error}</p>}

        <GlassButton
          fullWidth
          onClick={handleSubmit}
          disabled={submitting || !qtyNum || shortfalls.length > 0}
          icon={Factory}
        >
          {submitting ? 'Recording…' : 'Record Production'}
        </GlassButton>
      </div>
    </BottomSheet>
  );
}

function MaterialRow({ label, value, unit }) {
  if (!value) return null;
  return (
    <div className="flex justify-between">
      <span className="text-clay-400">{label}</span>
      <span className="figure text-clay-200 font-medium">
        {formatNumber(value, unit === 'Ton' ? 3 : 2)} {unit}
      </span>
    </div>
  );
}
