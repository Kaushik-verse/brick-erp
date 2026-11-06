import Icon3D from './icons3d/Icon3D';

// Same clay icons as the rest of the app; the selected one holds its "active" pose.
const NAV_3D = { home: 'home', sales: 'new-sale', production: 'factory', stock: 'brick-stack', insights: 'insights' };
import clsx from 'clsx';
import { useT } from '../core/i18n';

export const TABS_V3 = [
  { key: 'home' },
  { key: 'sales' },
  { key: 'production' },
  { key: 'stock' },
  { key: 'insights' },
];

/** Five large tabs with clear labels — easier to hit and read than six. */
export default function BottomNavV3({ active, onChange }) {
  const { t } = useT();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-safe md:top-0 md:right-auto md:w-64 md:pb-0">
      <div className="bg-kiln-800 border-t border-glass-border shadow-[0_-4px_20px_-8px_rgba(60,40,20,0.18)] md:h-full md:border-t-0 md:border-r md:pt-8">
        <div className="hidden md:block px-6 mb-6">
          <p className="text-lg font-display font-semibold text-clay-50">Factory Book</p>
        </div>
        <div className="flex md:flex-col md:px-3 md:gap-1">
          {TABS_V3.map((tab) => {
            const on = active === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onChange(tab.key)}
                aria-current={on ? 'page' : undefined}
                className={clsx(
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[64px] touch-manipulation md:flex-row md:justify-start md:gap-3 md:px-4 md:rounded-xl md:min-h-[48px]',
                  on && 'md:bg-ember-500/10'
                )}
              >
                <span className={clsx('w-14 h-9 rounded-full flex items-center justify-center transition-colors md:w-auto md:h-auto', on && 'bg-ember-500/15 md:bg-transparent')}>
                  <span className={clsx('nav3d', on && 'nav3d-on')}><Icon3D name={NAV_3D[tab.key]} size={30} active={on} /></span>
                </span>
                <span className={clsx('text-[11.5px] font-semibold md:text-sm', on ? 'text-ember-500' : 'text-clay-400')}>{t(`nav.${tab.key}`)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
