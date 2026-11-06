import { useState, useEffect, useRef } from 'react';
import { Save, Upload, Trash2, Eye } from 'lucide-react';
import { GlassInput, GlassTextarea, GlassToggleGroup, GlassSelect } from '../../core/ui/GlassFormControls';
import { DEFAULT_TERMS, loadBillingProfile } from '../../core/billing/profile';
import { computeInvoiceTotals } from '../../core/billing/invoiceMath';
import { saveAndShareBlob } from '../../core/utils/nativeFileBridge';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import { db } from '../../core/db/schema';
import { useUIStore } from '../../core/store/uiStore';
import { useInvoiceSettings } from '../../core/hooks/useDexieHooks';

export default function InvoiceSettingsScreen({ onBack }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const settingsMap = useInvoiceSettings();
  
  const [localSettings, setLocalSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  useEffect(() => {
    if (settingsMap && Object.keys(settingsMap).length > 0) {
      setLocalSettings(settingsMap);
    }
  }, [settingsMap]);

  // Missing keys count as ON (matches how the PDF reads them).
  const isOn = (key) => localSettings[key] !== '0';
  const handleToggle = (key) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: prev[key] === '0' ? '1' : '0'
    }));
  };
  const setVal = (key, value) => setLocalSettings((prev) => ({ ...prev, [key]: value }));
  const [previewing, setPreviewing] = useState(false);

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      await saveAll();
      const { generateInvoicePDF } = await import('../documents/pdfExport');
      const profile = await loadBillingProfile();
      const totals = computeInvoiceTotals({
        items: [
          { description: `${profile.invoice.productLabel || 'Bricks'} - 4-inch`, quantity: 3000, rate: 7.5 },
          { description: `${profile.invoice.productLabel || 'Bricks'} - 9-inch`, quantity: 1500, rate: 9 },
        ],
        charges: { transport: 1500, loading: 600 },
        gstMode: profile.invoice.gstMode,
        gstRate: profile.invoice.gstRate,
        interState: false,
      });
      const blob = await generateInvoicePDF({
        profile,
        totals,
        amountPaid: 20000,
        previousBalance: 12500,
        customer: { name: 'Sample Customer', phone: '9876543210', address: 'Main Road, Narsapur' },
        invoice: { number: `${profile.invoice.prefix}/SAMPLE/0001`, date: new Date().toISOString().slice(0, 10), paymentMode: 'upi', vehicleNumber: 'AP 37 AB 1234', copyLabel: 'SAMPLE - NOT A VALID INVOICE' },
      });
      await saveAndShareBlob(blob, 'Sample_Invoice.pdf', 'application/pdf');
    } catch (e) {
      console.error(e);
      pushToast('Could not create preview', 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      pushToast('Image size must be less than 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLocalSettings(prev => ({
        ...prev,
        qrCodeImage: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      pushToast('Image size must be less than 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLocalSettings(prev => ({
        ...prev,
        signatureImage: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const saveAll = async () => {
      const updates = Object.entries(localSettings).map(async ([key, value]) => {
        const existing = await db.invoiceSettings.where('key').equals(key).first();
        if (existing) {
          await db.invoiceSettings.update(existing.id, { value });
        } else {
          await db.invoiceSettings.add({ key, value });
        }
      });
      await Promise.all(updates);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAll();
      pushToast('Invoice settings saved', 'success');
    } catch (e) {
      pushToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const ToggleRow = ({ label, settingKey, description }) => (
    <div className="flex items-center justify-between py-3 border-b border-glass-border last:border-0">
      <div>
        <p className="text-sm font-medium text-clay-100">{label}</p>
        {description && <p className="text-xs text-clay-400 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => handleToggle(settingKey)}
        role="switch"
        aria-checked={isOn(settingKey)}
        aria-label={label}
        className={`w-12 h-7 shrink-0 rounded-full transition-colors relative touch-manipulation ${isOn(settingKey) ? 'bg-ember-500' : 'bg-glass-panel border border-glass-border'}`}
      >
        <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${isOn(settingKey) ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );

  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader
        eyebrow="Configuration"
        title="Invoice Design"
        onBack={onBack}
      />

      <div className="px-5 md:px-8 space-y-4 max-w-3xl mx-auto">
        
        <GlassCard padding="p-4">
          <h3 className="text-xs font-bold text-clay-400 uppercase tracking-wider mb-2">Optional Charges</h3>
          <ToggleRow label="Transport Charges" settingKey="showTransport" />
          <ToggleRow label="Loading Charges" settingKey="showLoading" />
          <ToggleRow label="Unloading Charges" settingKey="showUnloading" />
          <ToggleRow label="Other Charges" settingKey="showOtherCharges" />
        </GlassCard>


        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-xs font-bold text-clay-400 uppercase tracking-wider">GST on Invoices</h3>
          <GlassToggleGroup
            value={localSettings.gstMode || 'none'}
            onChange={(v) => setVal('gstMode', v)}
            options={[
              { value: 'none', label: 'No GST' },
              { value: 'inclusive', label: 'Incl. GST' },
              { value: 'exclusive', label: '+ GST' },
            ]}
          />
          <p className="text-[11px] text-clay-400 leading-relaxed">
            {(localSettings.gstMode || 'none') === 'none' && 'Bills are titled “INVOICE” and show no tax — same as before.'}
            {localSettings.gstMode === 'inclusive' && 'Your rates already include GST. The bill total stays the same; the tax is shown separately (TAX INVOICE).'}
            {localSettings.gstMode === 'exclusive' && 'GST is added on top of your rates. The customer pays rate + GST (TAX INVOICE).'}
          </p>
          {(localSettings.gstMode || 'none') !== 'none' && (
            <div className="grid grid-cols-2 gap-3">
              <GlassSelect label="GST Rate" value={localSettings.gstRate ?? '5'} onChange={(e) => setVal('gstRate', e.target.value)}>
                {['5', '12', '18', '28'].map((r) => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </GlassSelect>
              <GlassInput label="HSN Code" value={localSettings.hsnCode ?? '6815'} onChange={(e) => setVal('hsnCode', e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={8} />
            </div>
          )}
          <p className="text-[11px] text-clay-500">Please confirm the correct GST rate and HSN code with your auditor.</p>
        </GlassCard>

        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-xs font-bold text-clay-400 uppercase tracking-wider">Bill Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <GlassInput label="Goods Name" value={localSettings.productLabel ?? 'Fly Ash Bricks'} onChange={(e) => setVal('productLabel', e.target.value)} />
            <GlassInput label="Unit" value={localSettings.defaultUnit ?? 'Nos'} onChange={(e) => setVal('defaultUnit', e.target.value)} />
          </div>
          <GlassInput
            label="Payment due in (days)"
            type="number"
            inputMode="numeric"
            min="0"
            value={localSettings.dueDays ?? '15'}
            onChange={(e) => setVal('dueDays', e.target.value)}
          />
          <ToggleRow label="Show HSN column" settingKey="showHsn" />
          <ToggleRow label="Show previous balance" settingKey="showPreviousBalance" description="Prints old dues + this bill = total outstanding" />
        </GlassCard>

        <GlassCard padding="p-4">
          <h3 className="text-xs font-bold text-clay-400 uppercase tracking-wider mb-2">Header & Footer Fields</h3>
          <ToggleRow label="Vehicle Number" settingKey="showVehicleNumber" />
          <ToggleRow label="Bank Details" settingKey="showBankDetails" />
          <ToggleRow label="Terms & Conditions" settingKey="showTerms" />
          {isOn('showTerms') && (
            <div className="pt-3">
              <GlassTextarea
                label="Terms (one per line)"
                value={localSettings.termsText ?? DEFAULT_TERMS.join('\n')}
                onChange={(e) => setVal('termsText', e.target.value)}
                className="min-h-[130px] text-sm"
              />
            </div>
          )}
          <ToggleRow label="Business Description" settingKey="showBusinessDescription" />
        </GlassCard>

        <GlassCard padding="p-4">
          <h3 className="text-xs font-bold text-clay-400 uppercase tracking-wider mb-2">Authorized Signature</h3>
          <ToggleRow label="Show Company Signature" settingKey="showCompanySignature" />
          
          {isOn('showCompanySignature') && (
            <div className="mt-4 p-4 border border-dashed border-glass-border rounded-xl flex flex-col items-center justify-center gap-3">
              {localSettings['signatureImage'] ? (
                <>
                  <img src={localSettings['signatureImage']} alt="Signature" className="h-16 object-contain rounded-lg bg-white p-2" />
                  <button 
                    onClick={() => setLocalSettings(prev => ({...prev, signatureImage: ''}))}
                    className="text-xs text-ledger-overdue flex items-center gap-1"
                  >
                    <Trash2 size={12}/> Remove Signature
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-glass-panel flex items-center justify-center text-clay-400">
                    <Upload size={20} />
                  </div>
                  <p className="text-xs text-clay-300 text-center">Upload Authorized Signature (transparent PNG recommended)</p>
                  <button 
                    onClick={() => signatureInputRef.current?.click()}
                    className="text-xs font-semibold text-ember-400 px-3 py-1.5 rounded-lg bg-glass-panel"
                  >
                    Select Image
                  </button>
                  <input 
                    type="file" 
                    ref={signatureInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleSignatureUpload}
                  />
                </>
              )}
            </div>
          )}
        </GlassCard>

        <GlassCard padding="p-4">
          <h3 className="text-xs font-bold text-clay-400 uppercase tracking-wider mb-2">UPI QR Code</h3>
          <ToggleRow label="Display UPI QR Code" settingKey="showQRCode" description="If a UPI ID is set in Factory Settings, a QR with the exact amount is generated automatically. Otherwise this uploaded image is used." />
          
          {isOn('showQRCode') && (
            <div className="mt-4 p-4 border border-dashed border-glass-border rounded-xl flex flex-col items-center justify-center gap-3">
              {localSettings['qrCodeImage'] ? (
                <>
                  <img src={localSettings['qrCodeImage']} alt="QR Code" className="w-32 h-32 object-contain rounded-lg bg-white p-2" />
                  <button 
                    onClick={() => setLocalSettings(prev => ({...prev, qrCodeImage: ''}))}
                    className="text-xs text-ledger-overdue flex items-center gap-1"
                  >
                    <Trash2 size={12}/> Remove QR
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-glass-panel flex items-center justify-center text-clay-400">
                    <Upload size={20} />
                  </div>
                  <p className="text-xs text-clay-300 text-center">Upload your UPI QR Code image</p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-semibold text-ember-400 px-3 py-1.5 rounded-lg bg-glass-panel"
                  >
                    Select Image
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </>
              )}
            </div>
          )}
        </GlassCard>

        <div className="pt-2 grid grid-cols-2 gap-3">
          <GlassButton fullWidth variant="glass" onClick={handlePreview} disabled={saving || previewing} icon={Eye}>
            {previewing ? 'Preparing…' : 'Preview'}
          </GlassButton>
          <GlassButton fullWidth onClick={handleSave} disabled={saving} icon={Save}>
            {saving ? 'Saving…' : 'Save'}
          </GlassButton>
        </div>

      </div>
    </div>
  );
}
