import { useState, useEffect } from 'react';
import { Save, Database } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput, GlassSelect } from '../../core/ui/GlassFormControls';
import { GST_STATES, stateCodeFromGstin } from '../../core/billing/profile';
import { financialYearCode } from '../../core/billing/invoiceNumber';
import { db } from '../../core/db/schema';
import { factoryResetWithSafetyBackup } from '../../core/backup/localBackups';
import { useUIStore } from '../../core/store/uiStore';
import { useFinishedStock } from '../../core/hooks/useDexieHooks';

export default function SettingsScreen({ onBack, onNavigate }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const settings = useLiveQuery(() => db.settings.toArray(), [], []);
  const finishedStock = useFinishedStock();

  const [factoryName, setFactoryName] = useState('');
  const [factoryPhone, setFactoryPhone] = useState('');
  const [factoryAddress, setFactoryAddress] = useState('');
  const [businessCategories, setBusinessCategories] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [gstin, setGstin] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [factoryEmail, setFactoryEmail] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('');

  const [sellingPrices, setSellingPrices] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    setFactoryName(map.factoryName || '');
    setFactoryPhone(map.factoryPhone || '');
    setFactoryAddress(map.factoryAddress || '');
    setBusinessCategories(map.businessCategories || '');
    setBankName(map.bankName || '');
    setAccountNumber(map.accountNumber || '');
    setIfscCode(map.ifscCode || '');
    setUpiId(map.upiId || '');
    setGstin(map.gstin || '');
    setStateCode(map.stateCode || stateCodeFromGstin(map.gstin) || '37');
    setFactoryEmail(map.factoryEmail || '');
    setBankBranch(map.bankBranch || '');
    setAccountHolder(map.accountHolder || '');
    setInvoicePrefix(map.invoicePrefix || 'JVI');
  }, [settings]);

  const gstinClean = gstin.trim().toUpperCase();
  const gstinValid = !gstinClean || /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gstinClean);
  const upiValid = !upiId.trim() || /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId.trim());

  useEffect(() => {
    if (!finishedStock) return;
    // Only fill prices the user hasn't started editing.
    setSellingPrices((prev) => {
      const next = { ...prev };
      finishedStock.forEach((f) => {
        if (next[f.id] === undefined) next[f.id] = String(f.sellingPrice ?? '');
      });
      return next;
    });
  }, [finishedStock]);

  const handleSave = async () => {
    if (!upiValid) {
      pushToast('Please fix the UPI ID first', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateSetting('factoryName', factoryName);
      await updateSetting('factoryPhone', factoryPhone);
      await updateSetting('factoryAddress', factoryAddress);
      await updateSetting('businessCategories', businessCategories);
      await updateSetting('bankName', bankName);
      await updateSetting('accountNumber', accountNumber);
      await updateSetting('ifscCode', ifscCode);
      await updateSetting('upiId', upiId.trim());
      await updateSetting('gstin', gstinClean);
      await updateSetting('stateCode', stateCode);
      await updateSetting('factoryEmail', factoryEmail.trim());
      await updateSetting('bankBranch', bankBranch.trim());
      await updateSetting('accountHolder', accountHolder.trim());
      await updateSetting('invoicePrefix', (invoicePrefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '') || 'JVI'));

      for (const [id, price] of Object.entries(sellingPrices)) {
        const n = Number(price);
        if (price !== '' && Number.isFinite(n) && n >= 0) {
          await db.finishedStock.update(Number(id), { sellingPrice: n });
        }
      }

      pushToast('Settings saved', 'success');
    } catch {
      pushToast('Could not save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFactoryReset = async () => {
    if (
      !window.confirm(
        'WARNING: This deletes ALL sales, purchases, customers, stock and settings from this phone.\n\n' +
          'A safety backup is saved first, and your Google Drive backups are NOT touched, so you can restore later.\n\nContinue?'
      )
    )
      return;
    const typed = window.prompt('Type DELETE (in capital letters) to confirm the reset:');
    if (typed !== 'DELETE') {
      pushToast('Reset cancelled', 'info');
      return;
    }

    setSaving(true);
    try {
      await factoryResetWithSafetyBackup();
      pushToast('Database reset. A safety backup was saved. Reloading…', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      pushToast(`Reset stopped: ${e.message || 'could not save safety backup'}`, 'error');
      setSaving(false);
    }
  };

  return (
    <div className="pb-32">
      <ScreenHeader
        eyebrow="Configuration"
        title="Factory Settings"
        onBack={onBack}
      />

      <div className="px-5 space-y-4">
        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-clay-100 mb-1">Factory Profile</h3>
          <GlassInput label="Factory Name" value={factoryName} onChange={(e) => setFactoryName(e.target.value)} />
          <GlassInput label="Phone" value={factoryPhone} onChange={(e) => setFactoryPhone(e.target.value)} inputMode="tel" />
          <GlassInput label="Address" value={factoryAddress} onChange={(e) => setFactoryAddress(e.target.value)} />
          <GlassInput label="Business Categories" value={businessCategories} onChange={(e) => setBusinessCategories(e.target.value)} placeholder="e.g. Fly Ash Bricks | RCC Pipes" />
          <GlassInput label="Email (optional)" type="email" value={factoryEmail} onChange={(e) => setFactoryEmail(e.target.value)} />
        </GlassCard>

        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-clay-100 mb-1">GST & Invoice Numbering</h3>
          <GlassInput
            label="GSTIN"
            value={gstin}
            maxLength={15}
            onChange={(e) => {
              const v = e.target.value.toUpperCase();
              setGstin(v);
              const code = stateCodeFromGstin(v);
              if (code) setStateCode(code);
            }}
            error={!gstinValid ? `GSTIN must be 15 characters (now ${gstinClean.length}). Please check your GST certificate.` : ''}
          />
          <GlassSelect label="State" value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
            {Object.entries(GST_STATES).map(([code, name]) => (
              <option key={code} value={code}>
                {name} ({code})
              </option>
            ))}
          </GlassSelect>
          <GlassInput
            label="Invoice Number Prefix"
            value={invoicePrefix}
            maxLength={8}
            onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
          />
          <p className="text-[11px] text-clay-500 -mt-1 ml-1">
            Bills are numbered {(invoicePrefix || 'JVI').toUpperCase()}/{financialYearCode()}/0001, 0002… and restart every April.
          </p>
        </GlassCard>

        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-clay-100 mb-1">Bank Details (For Invoices)</h3>
          <GlassInput label="Account Holder Name" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Same as factory name if blank" />
          <GlassInput label="Bank Name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <GlassInput label="Branch" value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} />
          <GlassInput label="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          <GlassInput label="IFSC Code" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} />
          <GlassInput
            label="UPI ID (for pay-by-QR on bills)"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="e.g. jayavasavi@sbi"
            error={!upiValid ? 'UPI ID looks wrong — it should look like name@bank' : ''}
          />
          <p className="text-[11px] text-clay-500 -mt-1 ml-1">
            With a UPI ID, every invoice and statement gets a QR code with the exact amount due — the customer scans and pays.
          </p>
        </GlassCard>

        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-clay-100 mb-1">Selling Prices</h3>
          {(finishedStock || []).filter((f) => f.isActive !== 0).map((f) => (
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
          <div className="pt-3 border-t border-ledger-overdue/20">
            <button 
              onClick={handleFactoryReset}
              className="w-full h-12 rounded-xl text-sm font-semibold text-ledger-overdue bg-ledger-overdue/10 touch-manipulation transition-all hover:bg-ledger-overdue/20"
            >
              Factory Reset Database
            </button>
            <p className="text-[10px] text-ledger-overdue/70 text-center mt-2 px-4 leading-tight">
              Deletes all data on this phone. A safety backup is saved first and Drive backups are kept.
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
