import { useState, useEffect } from 'react';
import { Package, Banknote, Landmark, UserPlus } from 'lucide-react';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput, GlassSelect, GlassToggleGroup } from '../../core/ui/GlassFormControls';
import { recordPurchase } from '../../core/db/ledgerEngine';
import { useSuppliers, useRawMaterials } from '../../core/hooks/useDexieHooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUIStore } from '../../core/store/uiStore';
import { todayISO } from '../../core/utils/format';
import { hapticTap } from '../../core/utils/nativeFileBridge';
import { db } from '../../core/db/schema';

export default function AddPurchaseSheet({ open, onClose }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const suppliers = useSuppliers();
  const rawMaterials = useRawMaterials();

  const [date, setDate] = useState(todayISO());
  const [supplierId, setSupplierId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitId, setUnitId] = useState('');
  const [rate, setRate] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('cash');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [showNewMaterial, setShowNewMaterial] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const units = useLiveQuery(() => db.units.toArray(), [], []);

  useEffect(() => {
    if (!units || units.length === 0) return;
    
    // Default to Ton if no unit is set
    if (!unitId) {
      const ton = units.find(u => u.symbol.toLowerCase() === 'ton' || u.name.toLowerCase() === 'ton');
      if (ton) setUnitId(String(ton.id));
      else setUnitId(String(units[0].id));
    }
  }, [units, unitId, materialId, rawMaterials]);

  const qtyNum = Number(quantity) || 0;
  const rateNum = Number(rate) || 0;
  const totalAmount = qtyNum * rateNum;
  const paidNum = Number(amountPaid) || 0;
  const balanceDue = Math.max(totalAmount - paidNum, 0);

  const activeUnit = units?.find(u => String(u.id) === String(unitId));
  const conversionFactor = activeUnit ? activeUnit.conversionFactor : 1;
  const qtyNumBase = qtyNum * conversionFactor;
  const rateNumBase = qtyNumBase > 0 ? totalAmount / qtyNumBase : 0;

  const resetForm = () => {
    setQuantity('');
    setRate('');
    setAmountPaid('');
    setError('');
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) return;
    const id = await db.suppliers.add({
      name: newSupplierName.trim(),
      phone: newSupplierPhone.trim(),
      outstandingBalance: 0,
      createdAt: new Date().toISOString(),
    });
    setSupplierId(id);
    setShowNewSupplier(false);
    setNewSupplierName('');
    setNewSupplierPhone('');
  };

  const handleCreateMaterial = async () => {
    if (!newMaterialName.trim()) return;
    const id = await db.rawMaterials.add({
      name: newMaterialName.trim(),
      unit: 'kg', // default base unit
      currentStock: 0,
      reorderLevel: 500,
      avgRate: 0,
      isActive: 1,
    });
    setMaterialId(String(id));
    setShowNewMaterial(false);
    setNewMaterialName('');
  };

  const handleSubmit = async () => {
    setError('');
    if (!supplierId) {
      setError('Select or add a supplier.');
      return;
    }
    if (!materialId) {
      setError('Select a material.');
      return;
    }
    if (!qtyNum || qtyNum <= 0) {
      setError('Enter a valid quantity.');
      return;
    }
    if (!rateNum || rateNum <= 0) {
      setError('Enter a valid rate.');
      return;
    }
    setSubmitting(true);
    try {
      await recordPurchase({
        date,
        supplierId: Number(supplierId),
        materialId: Number(materialId),
        quantity: qtyNumBase,
        rate: rateNumBase,
        amountPaid: paidNum,
        paymentChannel,
      });
      await hapticTap();
      pushToast('Purchase recorded successfully', 'success');
      resetForm();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to record purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Record Purchase">
      <div className="space-y-4">
        <GlassInput
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={todayISO()}
        />

        {!showNewSupplier ? (
          <div>
            <GlassSelect
              label="Supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">Select supplier…</option>
              {(suppliers || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </GlassSelect>
            <button
              onClick={() => setShowNewSupplier(true)}
              className="flex items-center gap-1.5 mt-2 ml-1 text-xs font-semibold text-ember-400 touch-manipulation"
            >
              <UserPlus size={13} /> Add new supplier
            </button>
          </div>
        ) : (
          <div className="glass-surface-light rounded-2xl p-3.5 space-y-3">
            <GlassInput
              label="New Supplier Name"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
            />
            <GlassInput
              label="Phone"
              value={newSupplierPhone}
              onChange={(e) => setNewSupplierPhone(e.target.value)}
              inputMode="tel"
            />
            <div className="flex gap-2">
              <GlassButton size="sm" variant="glass" fullWidth onClick={() => setShowNewSupplier(false)}>
                Cancel
              </GlassButton>
              <GlassButton size="sm" fullWidth onClick={handleCreateSupplier}>
                Save Supplier
              </GlassButton>
            </div>
          </div>
        )}

        {!showNewMaterial ? (
          <div>
            <GlassSelect label="Material" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">Select material…</option>
              {(rawMaterials || []).filter(m => m.isActive !== 0).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </GlassSelect>
            <button
              onClick={() => setShowNewMaterial(true)}
              className="flex items-center gap-1.5 mt-2 ml-1 text-xs font-semibold text-ember-400 touch-manipulation"
            >
              <Package size={13} /> Add custom material
            </button>
          </div>
        ) : (
          <div className="glass-surface-light rounded-2xl p-3.5 space-y-3">
            <GlassInput
              label="New Material Name"
              value={newMaterialName}
              onChange={(e) => setNewMaterialName(e.target.value)}
              placeholder="e.g. Crusher Dust"
            />
            <div className="flex gap-2">
              <GlassButton size="sm" variant="glass" fullWidth onClick={() => setShowNewMaterial(false)}>
                Cancel
              </GlassButton>
              <GlassButton size="sm" fullWidth onClick={handleCreateMaterial}>
                Save Material
              </GlassButton>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <GlassInput
            label="Quantity"
            type="number"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <GlassSelect label="Unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            {(units || []).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </GlassSelect>
        </div>
        <GlassInput
          label={`Rate / ${activeUnit?.symbol || 'Unit'}`}
          type="number"
          inputMode="decimal"
          prefix="₹"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />

        <GlassInput
          label="Amount Paid Now"
          type="number"
          inputMode="decimal"
          prefix="₹"
          placeholder="0 for full credit"
          value={amountPaid}
          onChange={(e) => setAmountPaid(e.target.value)}
        />

        <GlassToggleGroup
          label="Payment Channel"
          value={paymentChannel}
          onChange={setPaymentChannel}
          options={[
            { value: 'cash', label: 'Cash', icon: Banknote },
            { value: 'bank', label: 'Bank/UPI', icon: Landmark },
          ]}
        />

        {totalAmount > 0 && (
          <div className="glass-surface-light rounded-2xl p-3.5 flex justify-between items-center">
            <div>
              <p className="text-xs text-clay-400">Total Amount</p>
              <p className="figure text-lg font-bold text-clay-50">₹{totalAmount.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-clay-400">Balance Due</p>
              <p className={`figure text-lg font-bold ${balanceDue > 0 ? 'text-ledger-overdue' : 'text-ledger-paid'}`}>
                ₹{balanceDue.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-ledger-overdue text-center">{error}</p>}

        <GlassButton fullWidth onClick={handleSubmit} disabled={submitting} icon={Package}>
          {submitting ? 'Saving…' : 'Record Purchase'}
        </GlassButton>
      </div>
    </BottomSheet>
  );
}
