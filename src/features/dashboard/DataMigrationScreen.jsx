import { useState, useRef } from 'react';
import { ArrowLeft, Download, Upload, Users, Truck, ShoppingCart, ShoppingBag } from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import { downloadImportTemplate, processExcelImport } from '../../core/utils/excelImport';
import { useUIStore } from '../../core/store/uiStore';
import { saveAndShareBlob } from '../../core/utils/nativeFileBridge';

export default function DataMigrationScreen({ onBack }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [importType, setImportType] = useState('');

  const handleDownload = async (type) => {
    setLoading(true);
    try {
      const blob = await downloadImportTemplate(type);
      await saveAndShareBlob(blob, `${type}_Template.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      pushToast('Template downloaded', 'success');
    } catch (e) {
      pushToast('Failed to generate template', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = (type) => {
    setImportType(type);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const count = await processExcelImport(file, importType);
      pushToast(`Successfully imported ${count} records`, 'success');
    } catch (err) {
      pushToast(err.message || 'Import failed. Check file format.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { title: 'Customers', type: 'Customers', icon: Users, desc: 'Import customer master list and opening balances.' },
    { title: 'Suppliers', type: 'Suppliers', icon: Truck, desc: 'Import supplier master list and opening balances.' },
    { title: 'Sales History', type: 'Sales', icon: ShoppingCart, desc: 'Import past sales. (Requires Customers to be imported first).' },
    { title: 'Purchases History', type: 'Purchases', icon: ShoppingBag, desc: 'Import past material purchases. (Requires Suppliers first).' }
  ];

  return (
    <div className="pb-32">
      <ScreenHeader
        eyebrow="Configuration"
        title="Data Migration"
        action={
          <button onClick={onBack} disabled={loading} className="w-10 h-10 rounded-full glass-surface-light flex items-center justify-center touch-manipulation">
            <ArrowLeft size={18} className="text-clay-300" />
          </button>
        }
      />
      <div className="px-5 mt-4 space-y-4">
        
        <div className="glass-surface-light rounded-2xl p-4 border border-ember-500/20">
          <p className="text-sm text-clay-200">
            Download a blank Excel template, fill in your data, and upload it back here.
          </p>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept=".xlsx, .xls"
          onChange={handleFileChange}
        />

        {categories.map((cat) => (
          <GlassCard key={cat.type} padding="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <cat.icon size={16} className="text-ember-400" />
              <h3 className="text-sm font-semibold text-clay-100">{cat.title}</h3>
            </div>
            <p className="text-xs text-clay-400 leading-relaxed mb-2">
              {cat.desc}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <GlassButton 
                variant="glass" 
                size="sm" 
                icon={Download} 
                onClick={() => handleDownload(cat.type)}
                disabled={loading}
              >
                Template
              </GlassButton>
              <GlassButton 
                size="sm" 
                icon={Upload} 
                onClick={() => handleUploadClick(cat.type)}
                disabled={loading}
              >
                Upload
              </GlassButton>
            </div>
          </GlassCard>
        ))}

      </div>
    </div>
  );
}
