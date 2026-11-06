import { ChevronRight, Fuel, FileStack, ShieldCheck, Settings, BookOpen, FileText, FlaskConical, Database } from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';

const MENU_GROUPS = [
  {
    title: 'Daily work',
    items: [
      { key: 'invoice-builder', label: 'Create Invoice', desc: 'Multi-product bill with PDF & WhatsApp', icon: FileText },
      { key: 'passbook', label: 'Cash & Bank Day Book', desc: 'Every rupee in and out, with balances', icon: BookOpen },
      { key: 'expenses', label: 'Daily Expenses', desc: 'Diesel, labour, repairs, electricity', icon: Fuel },
      { key: 'documents', label: 'Reports', desc: 'Day summary, Excel ledgers', icon: FileStack },
    ],
  },
  {
    title: 'Safety',
    items: [
      { key: 'drive-sync', label: 'Backup & Restore', desc: 'Automatic phone + Google Drive backups', icon: ShieldCheck },
    ],
  },
  {
    title: 'Setup',
    items: [
      { key: 'settings', label: 'Factory Settings', desc: 'Factory profile, bank details, prices', icon: Settings },
      { key: 'master-settings', label: 'Products & Materials', desc: 'Add or hide products, materials, units', icon: Database },
      { key: 'recipe-settings', label: 'Brick Recipes', desc: 'Materials and labour cost per brick', icon: FlaskConical },
      { key: 'invoice-settings', label: 'Invoice Design', desc: 'What appears on printed invoices', icon: FileStack },
    ],
  },
];

export default function MoreScreen({ onNavigate }) {
  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader eyebrow="Workspace" title="More" />

      <div className="px-5 md:px-8 space-y-6 max-w-3xl mx-auto">
        {MENU_GROUPS.map((group) => (
          <section key={group.title} className="space-y-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-clay-500 px-1">{group.title}</h2>
        {group.items.map((item) => (
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
          </section>
        ))}
        <p className="text-center text-[11px] text-clay-500 pt-2">Brick ERP · v{__APP_VERSION__}</p>
      </div>
    </div>
  );
}
