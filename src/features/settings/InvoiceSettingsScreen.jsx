import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Upload, Trash2 } from 'lucide-react';
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

  const handleToggle = (key) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: prev[key] === '1' ? '0' : '1'
    }));
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(localSettings).map(async ([key, value]) => {
        const existing = await db.invoiceSettings.where('key').equals(key).first();
        if (existing) {
          await db.invoiceSettings.update(existing.id, { value });
        } else {
          await db.invoiceSettings.add({ key, value });
        }
      });
      await Promise.all(updates);
      pushToast('Invoice Settings Saved', 'success');
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
        className={`w-12 h-6 rounded-full transition-colors relative ${localSettings[settingKey] === '1' ? 'bg-ember-500' : 'bg-glass-panel'}`}
      >
        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${localSettings[settingKey] === '1' ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );

  return (
    <div className="pb-32">
      <ScreenHeader
        eyebrow="Configuration"
        title="Invoice Settings"
        action={
          <button onClick={onBack} className="w-10 h-10 rounded-full glass-surface-light flex items-center justify-center touch-manipulation">
            <ArrowLeft size={18} className="text-clay-300" />
          </button>
        }
      />

      <div className="px-5 space-y-4">
        
        <GlassCard padding="p-4">
          <h3 className="text-xs font-bold text-clay-400 uppercase tracking-wider mb-2">Optional Charges</h3>
          <ToggleRow label="Transport Charges" settingKey="showTransport" />
          <ToggleRow label="Loading Charges" settingKey="showLoading" />
          <ToggleRow label="Unloading Charges" settingKey="showUnloading" />
          <ToggleRow label="Other Charges" settingKey="showOtherCharges" />
        </GlassCard>

        <GlassCard padding="p-4">
          <h3 className="text-xs font-bold text-clay-400 uppercase tracking-wider mb-2">Calculations</h3>
        </GlassCard>

        <GlassCard padding="p-4">
          <h3 className="text-xs font-bold text-clay-400 uppercase tracking-wider mb-2">Header & Footer Fields</h3>
          <ToggleRow label="Driver Name" settingKey="showDriverName" />
          <ToggleRow label="Vehicle Number" settingKey="showVehicleNumber" />
          <ToggleRow label="Bank Details" settingKey="showBankDetails" />
          <ToggleRow label="Terms & Conditions" settingKey="showTerms" />
          <ToggleRow label="Business Description" settingKey="showBusinessDescription" />
        </GlassCard>

        <GlassCard padding="p-4">
          <h3 className="text-xs font-bold text-clay-400 uppercase tracking-wider mb-2">Authorized Signature</h3>
          <ToggleRow label="Show Company Signature" settingKey="showCompanySignature" />
          
          {localSettings['showCompanySignature'] === '1' && (
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
          <ToggleRow label="Display UPI QR Code" settingKey="showQRCode" description="Show QR code on printed invoice" />
          
          {localSettings['showQRCode'] === '1' && (
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

        <div className="pt-2">
          <GlassButton fullWidth onClick={handleSave} disabled={saving} icon={Save}>
            {saving ? 'Saving...' : 'Save Settings'}
          </GlassButton>
        </div>

      </div>
    </div>
  );
}
