import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Database } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput } from '../../core/ui/GlassFormControls';
import { db } from '../../core/db/schema';
import { useUIStore } from '../../core/store/uiStore';
import { useFinishedStock } from '../../core/hooks/useDexieHooks';

export default function SettingsScreen({ onBack, onNavigate }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const settings = useLiveQuery(() => db.settings.toArray(), [], []);
  const finishedStock = useFinishedStock();

  const [factoryName, setFactoryName] = useState('');
  const [factoryPhone, setFactoryPhone] = useState('');
  const [factoryAddress, setFactoryAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [businessCategories, setBusinessCategories] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');

  const [sellingPrices, setSellingPrices] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    setFactoryName(map.factoryName || '');
    setFactoryPhone(map.factoryPhone || '');
    setFactoryAddress(map.factoryAddress || '');
    setGstin(map.gstin || '');
    setBusinessCategories(map.businessCategories || '');
    setBankName(map.bankName || '');
    setAccountNumber(map.accountNumber || '');
    setIfscCode(map.ifscCode || '');
    setUpiId(map.upiId || '');
  }, [settings]);

  useEffect(() => {
    if (!finishedStock) return;
    const prices = {};
    finishedStock.forEach((f) => {
      prices[f.id] = String(f.sellingPrice);
    });
    setSellingPrices(prices);
  }, [finishedStock]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting('factoryName', factoryName);
      await updateSetting('factoryPhone', factoryPhone);
      await updateSetting('factoryAddress', factoryAddress);
      await updateSetting('gstin', gstin);
      await updateSetting('businessCategories', businessCategories);
      await updateSetting('bankName', bankName);
      await updateSetting('accountNumber', accountNumber);
      await updateSetting('ifscCode', ifscCode);
      await updateSetting('upiId', upiId);

      for (const [id, price] of Object.entries(sellingPrices)) {
        await db.finishedStock.update(Number(id), { sellingPrice: Number(price) || 0 });
      }

      pushToast('Settings saved', 'success');
    } catch {
      pushToast('Could not save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFactoryReset = async () => {
    if (!window.confirm('WARNING: This will permanently delete ALL data, sales, purchases, and settings. This cannot be undone. Are you absolutely sure?')) return;
    if (!window.confirm('Final confirmation: Delete EVERYTHING?')) return;
    
    setSaving(true);
    try {
      await Promise.all([
        db.rawMaterials.clear(),
        db.recipes.clear(),
        db.finishedStock.clear(),
        db.purchaseLog.clear(),
        db.supplierPayments.clear(),
        db.productionLog.clear(),
        db.salesLog.clear(),
        db.customerCollections.clear(),
        db.expenses.clear(),
        db.customers.clear(),
        db.suppliers.clear(),
        db.settings.clear(),
        db.driveSyncMeta.clear(),
        db.units.clear(),
        db.vehicles.clear(),
        db.drivers.clear(),
      ]);
      pushToast('Database reset successfully. Reloading...', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      pushToast('Error resetting database', 'error');
      setSaving(false);
    }
  };

  return (
    <div className="pb-32">
      <ScreenHeader
        eyebrow="Configuration"
        title="Factory Settings"
        action={
          <button onClick={onBack} className="w-10 h-10 rounded-full glass-surface-light flex items-center justify-center touch-manipulation">
            <ArrowLeft size={18} className="text-clay-300" />
          </button>
        }
      />

      <div className="px-5 space-y-4">
        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-clay-100 mb-1">Factory Profile</h3>
          <GlassInput label="Factory Name" value={factoryName} onChange={(e) => setFactoryName(e.target.value)} />
          <GlassInput label="Phone" value={factoryPhone} onChange={(e) => setFactoryPhone(e.target.value)} inputMode="tel" />
          <GlassInput label="Address" value={factoryAddress} onChange={(e) => setFactoryAddress(e.target.value)} />
          <GlassInput label="GSTIN (Optional)" value={gstin} onChange={(e) => setGstin(e.target.value)} />
          <GlassInput label="Business Categories" value={businessCategories} onChange={(e) => setBusinessCategories(e.target.value)} placeholder="e.g. Fly Ash Bricks | RCC Pipes" />
        </GlassCard>

        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-clay-100 mb-1">Bank Details (For Invoices)</h3>
          <GlassInput label="Bank Name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <GlassInput label="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          <GlassInput label="IFSC Code" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} />
          <GlassInput label="UPI ID (Optional)" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
        </GlassCard>



        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-clay-100 mb-1">Selling Prices</h3>
          {(finishedStock || []).map((f) => (
            <GlassInput
              key={f.id}
              label={`${f.brickSize} Brick`}
              type="number"
              inputMode="decimal"
              prefix="₹"
              value={sellingPrices[f.id] || ''}
              onChange={(e) => setSellingPrices((prev) => ({ ...prev, [f.id]: e.target.value }))}
            />
          ))}
        </GlassCard>

        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-clay-100 mb-1">Advanced</h3>
          <GlassButton variant="glass" fullWidth onClick={() => onNavigate('data-migration')} icon={Database}>
            Import Data from Excel
          </GlassButton>
          <div className="mt-2">
            <GlassButton variant="glass" fullWidth onClick={() => onNavigate('master-settings')} icon={Database}>
              Manage Master Data (Products, Materials)
            </GlassButton>
          </div>
          <div className="mt-2">
            <GlassButton variant="glass" fullWidth onClick={() => onNavigate('recipe-settings')}>
              Manage Brick Recipes
            </GlassButton>
          </div>
          <div className="pt-3 border-t border-ledger-overdue/20">
            <button 
              onClick={handleFactoryReset}
              className="w-full h-12 rounded-xl text-sm font-semibold text-ledger-overdue bg-ledger-overdue/10 touch-manipulation transition-all hover:bg-ledger-overdue/20"
            >
              Factory Reset Database
            </button>
            <p className="text-[10px] text-ledger-overdue/70 text-center mt-2 px-4 leading-tight">
              Permanently deletes all transactions, inventory, and settings. Cannot be undone.
            </p>
          </div>
        </GlassCard>

        <GlassButton fullWidth onClick={handleSave} disabled={saving} icon={Save}>
          {saving ? 'Saving…' : 'Save Settings'}
        </GlassButton>
      </div>
    </div>
  );
}

async function updateSetting(key, value) {
  const existing = await db.settings.where('key').equals(key).first();
  if (existing) {
    await db.settings.update(existing.id, { value });
  } else {
    await db.settings.add({ key, value });
  }
}
