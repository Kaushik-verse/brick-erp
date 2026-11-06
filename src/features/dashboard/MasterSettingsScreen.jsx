import { useState } from 'react';
import { Plus, Settings2, EyeOff, Eye } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput } from '../../core/ui/GlassFormControls';
import { db } from '../../core/db/schema';
import { useUIStore } from '../../core/store/uiStore';

export default function MasterSettingsScreen({ onBack, hideUnits = false }) {
  const pushToast = useUIStore((s) => s.pushToast);
  
  const allMaterials = useLiveQuery(() => db.rawMaterials.toArray(), [], []);
  const allProducts = useLiveQuery(() => db.finishedStock.toArray(), [], []);
  const units = useLiveQuery(() => db.units.filter(u => u.isActive !== 0).toArray(), []);
  const materials = allMaterials.filter((m) => m.isActive !== 0);
  const products = allProducts.filter((p) => p.isActive !== 0);
  const hiddenMaterials = allMaterials.filter((m) => m.isActive === 0);
  const hiddenProducts = allProducts.filter((p) => p.isActive === 0);

  const setActive = async (table, id, active, label) => {
    if (!active && !window.confirm(`Hide "${label}"? Past records stay; it just won't appear in new entries. You can show it again later.`)) return;
    await table.update(id, { isActive: active ? 1 : 0 });
    pushToast(active ? `${label} shown` : `${label} hidden`, 'success');
  };

  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialUnit, setNewMaterialUnit] = useState('kg');
  
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');

  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitSymbol, setNewUnitSymbol] = useState('');
  const [newUnitFactor, setNewUnitFactor] = useState('');

  const handleAddMaterial = async () => {
    const name = newMaterialName.trim();
    if (!name) return;
    if (allMaterials.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      pushToast(`${name} already exists`, 'error');
      return;
    }
    try {
      await db.rawMaterials.add({
        name: newMaterialName.trim(),
        unit: newMaterialUnit,
        currentStock: 0,
        reorderLevel: 500,
        avgRate: 0,
        isActive: 1,
      });
      setNewMaterialName('');
      pushToast('Material added', 'success');
    } catch (e) {
      pushToast('Error adding material', 'error');
    }
  };

  const handleAddProduct = async () => {
    const name = newProductName.trim();
    if (!name) return;
    if (allProducts.some((p) => p.brickSize.toLowerCase() === name.toLowerCase())) {
      pushToast(`${name} already exists`, 'error');
      return;
    }
    try {
      await db.finishedStock.add({
        brickSize: newProductName.trim(),
        currentStock: 0,
        costPrice: 0,
        sellingPrice: Number(newProductPrice) || 0,
        isActive: 1,
      });
      setNewProductName('');
      setNewProductPrice('');
      pushToast('Product added', 'success');
    } catch (e) {
      pushToast('Error adding product', 'error');
    }
  };

  const handleAddUnit = async () => {
    if (!newUnitName || !newUnitSymbol) return;
    try {
      await db.units.add({
        name: newUnitName.trim(),
        symbol: newUnitSymbol.trim(),
        baseUnit: 'kg',
        conversionFactor: Number(newUnitFactor) || 1,
        isActive: 1,
      });
      setNewUnitName('');
      setNewUnitSymbol('');
      setNewUnitFactor('');
      pushToast('Unit added', 'success');
    } catch (e) {
      pushToast('Error adding unit', 'error');
    }
  };

  return (
    <div className="pb-32">
      <ScreenHeader
        eyebrow="Configuration"
        title="Master Data"
        onBack={onBack}
      />

      <div className="px-5 space-y-4">
        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-clay-100 flex items-center gap-2">
            <Settings2 size={16} className="text-ember-400" /> Products
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {products.map(p => (
              <Chip key={p.id} label={`${p.brickSize} · ₹${p.sellingPrice}`} onHide={() => setActive(db.finishedStock, p.id, false, p.brickSize)} />
            ))}
            {hiddenProducts.map(p => (
              <Chip key={p.id} hidden label={p.brickSize} onShow={() => setActive(db.finishedStock, p.id, true, p.brickSize)} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <GlassInput label="New Product Name" placeholder="e.g. 6-inch Solid" value={newProductName} onChange={e => setNewProductName(e.target.value)} />
            <GlassInput label="Selling Price" type="number" placeholder="₹" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} />
          </div>
          <GlassButton size="sm" onClick={handleAddProduct} icon={Plus}>Add Product</GlassButton>
        </GlassCard>

        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-clay-100 flex items-center gap-2">
            <Settings2 size={16} className="text-ember-400" /> Raw Materials
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {materials.map(m => (
              <Chip key={m.id} label={`${m.name} (${m.unit})`} onHide={() => setActive(db.rawMaterials, m.id, false, m.name)} />
            ))}
            {hiddenMaterials.map(m => (
              <Chip key={m.id} hidden label={m.name} onShow={() => setActive(db.rawMaterials, m.id, true, m.name)} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <GlassInput label="New Material Name" placeholder="e.g. Quarry Dust" value={newMaterialName} onChange={e => setNewMaterialName(e.target.value)} />
            <GlassInput label="Base Unit" value={newMaterialUnit} onChange={e => setNewMaterialUnit(e.target.value)} />
          </div>
          <GlassButton size="sm" onClick={handleAddMaterial} icon={Plus}>Add Material</GlassButton>
        </GlassCard>

{!hideUnits && (
        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-clay-100 flex items-center gap-2">
            <Settings2 size={16} className="text-ember-400" /> Units
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {(units || []).map(u => (
              <span key={u.id} className="text-xs bg-glass-panel border border-glass-border rounded-lg px-2 py-1 text-clay-200">
                {u.name} ({u.symbol})
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <GlassInput label="Unit Name" placeholder="e.g. Ton" value={newUnitName} onChange={e => setNewUnitName(e.target.value)} />
            <GlassInput label="Symbol" placeholder="e.g. t" value={newUnitSymbol} onChange={e => setNewUnitSymbol(e.target.value)} />
            <GlassInput label="Conv. to Kg" type="number" placeholder="1000" value={newUnitFactor} onChange={e => setNewUnitFactor(e.target.value)} />
          </div>
          <GlassButton size="sm" onClick={handleAddUnit} icon={Plus}>Add Unit</GlassButton>
        </GlassCard>
        )}
      </div>
    </div>
  );
}

function Chip({ label, hidden, onHide, onShow }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs rounded-lg pl-2.5 pr-1 py-1 border ${
        hidden ? 'border-dashed border-glass-border text-clay-500' : 'bg-glass-panel border-glass-border text-clay-200'
      }`}
    >
      {label}
      <button
        type="button"
        onClick={hidden ? onShow : onHide}
        aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
        className="w-7 h-7 rounded-md flex items-center justify-center text-clay-400 touch-manipulation active:bg-white/10"
      >
        {hidden ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
    </span>
  );
}
