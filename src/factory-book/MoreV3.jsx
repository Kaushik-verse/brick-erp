import { Truck, Fuel, BookOpen, FileStack, ShieldCheck, Settings, Database, FlaskConical, FileText, Receipt, Upload } from 'lucide-react';
import ScreenHeader from '../core/ui/ScreenHeader';
import Icon3D from './icons3d/Icon3D';
import { useT } from '../core/i18n';
import LanguageToggle from './LanguageToggle';

const GROUPS = [
  {
    title: 'more.daily',
    items: [
      { key: 'invoice-builder', icon3d: 'new-sale', label: 'New Sale / Bill', icon: Receipt, color: '#DE622C' },
      { key: 'purchases', icon3d: 'purchase', label: 'Purchases & Suppliers', icon: Truck, color: '#3E6096' },
      { key: 'expenses', icon3d: 'expense', label: 'Expenses', icon: Fuel, color: '#B27012' },
      { key: 'passbook', icon3d: 'day-book', label: 'Cash & Bank Day Book', icon: BookOpen, color: '#6B5D50' },
      { key: 'documents', icon3d: 'reports', label: 'Reports & Excel', icon: FileStack, color: '#1D6B61' },
    ],
  },
  {
    title: 'more.safety',
    items: [{ key: 'drive-sync', icon3d: 'storage', label: 'Backup & Restore', icon: ShieldCheck, color: '#1E8750' }],
  },
  {
    title: 'more.setup',
    items: [
      { key: 'settings', icon3d: 'factory', label: 'Factory Details', icon: Settings, color: '#6B5D50' },
      { key: 'master-settings', icon3d: 'brick-stack', label: 'Products & Materials', icon: Database, color: '#8B6BB8' },
      { key: 'recipe-settings', icon3d: 'machinery', label: 'Brick Recipes', icon: FlaskConical, color: '#C4552A' },
      { key: 'invoice-settings', icon3d: 'settings', label: 'Bill Design', icon: FileText, color: '#DE622C' },
      { key: 'data-migration', icon3d: 'revenue', label: 'Import from Excel', icon: Upload, color: '#8A7C6E' },
    ],
  },
];

/** Big picture tiles instead of a long text menu. */
export default function MoreV3({ onOpen, onBack }) {
  const { t } = useT();
  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader onBack={onBack} eyebrow={t('more.eyebrow')} title={t('more.title')} />
      <div className="px-5 md:px-8 space-y-5 max-w-3xl mx-auto">
        <section>
          <h2 className="text-xs font-bold text-clay-400 uppercase tracking-wide px-1 mb-2">{t('more.language')}</h2>
          <LanguageToggle wide />
        </section>
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="text-xs font-bold text-clay-400 uppercase tracking-wide px-1 mb-2">{t(g.title)}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {g.items.map((it) => (
                <button
                  key={it.key}
                  onClick={() => onOpen(it.key)}
                  className="glass-surface lift rounded-2xl p-4 flex flex-col items-start gap-3 text-left touch-manipulation active:scale-[0.97] transition-transform min-h-[104px]"
                >
                  <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${it.color}14` }}>
                    <Icon3D name={it.icon3d} size={44} />
                  </span>
                  <span className="text-sm font-semibold text-clay-50 leading-snug">{t(`more.${it.key}`)}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        <p className="text-center text-[11px] text-clay-500 pt-1">Factory Book · v{__APP_VERSION__}</p>
      </div>
    </div>
  );
}
