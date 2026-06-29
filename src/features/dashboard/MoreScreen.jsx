import { ChevronRight, Fuel, FileStack, CloudUpload, Settings } from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';

const MENU_ITEMS = [
  { key: 'expenses', label: 'Daily Expenses', desc: 'Diesel, maintenance, labour advances', icon: Fuel },
  { key: 'documents', label: 'Document Hub', desc: 'Invoices, statements, EOD summary', icon: FileStack },
  { key: 'drive-sync', label: 'Google Drive Backup', desc: 'Sync ledger to appDataFolder', icon: CloudUpload },
  { key: 'settings', label: 'Factory Settings', desc: 'Rates, recipes, factory profile', icon: Settings },
];

export default function MoreScreen({ onNavigate }) {
  return (
    <div className="pb-32">
      <ScreenHeader eyebrow="Workspace" title="More" />

      <div className="px-5 space-y-3">
        {MENU_ITEMS.map((item) => (
          <GlassCard
            key={item.key}
            padding="p-4"
            onClick={() => onNavigate(item.key)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-ember-500/15 flex items-center justify-center shrink-0">
                <item.icon size={19} className="text-ember-400" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-clay-50">{item.label}</p>
                <p className="text-xs text-clay-500 truncate">{item.desc}</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-clay-500 shrink-0" />
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
