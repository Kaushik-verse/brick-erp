import { motion } from 'framer-motion';
import {
  LayoutGrid,
  Factory,
  Boxes,
  Receipt,
  Package,
  MoreHorizontal,
} from 'lucide-react';
import clsx from 'clsx';

export const TABS = [
  { key: 'dashboard', label: 'Home', icon: LayoutGrid },
  { key: 'production', label: 'Production', icon: Factory },
  { key: 'inventory', label: 'Stock', icon: Boxes },
  { key: 'sales', label: 'Sales', icon: Receipt },
  { key: 'purchases', label: 'Purchases', icon: Package },
  { key: 'more', label: 'More', icon: MoreHorizontal },
];

/**
 * BottomNav
 * ----------
 * Explicit state-based tab bar (not router-driven) so the app never
 * relies on history/back-stack behaviors that misbehave inside a
 * Capacitor WebView. `activeTab` / `onTabChange` are lifted to the
 * App root. Bottom padding accounts for Android gesture-nav bar.
 *
 * Renders persistently across BOTH primary tabs and secondary
 * sub-screens (Expenses, Documents, Drive Sync, Settings) reached via
 * "More" — the nav must never disappear, so App.jsx always mounts this
 * regardless of navigation depth.
 */
export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-safe max-w-lg mx-auto md:max-w-none md:mx-0 md:top-0 md:w-64 md:border-r md:border-glass-border md:bg-kiln-950/80 md:pb-0">
      <div className="mx-2.5 mb-3 rounded-3xl glass-surface shadow-glass-lg md:mx-0 md:mb-0 md:rounded-none md:h-full md:bg-transparent md:border-0 md:shadow-none md:pt-8 md:flex md:flex-col">
        {/* Desktop Branding (Hidden on mobile) */}
        <div className="hidden md:block px-6 mb-8">
          <h1 className="text-xl font-bold font-fraunces text-clay-50 tracking-wide">Brick ERP</h1>
        </div>
        
        <div className="flex items-stretch justify-around px-0.5 py-1.5 md:flex-col md:px-4 md:gap-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-tap touch-manipulation md:flex-row md:justify-start md:px-4 md:py-3 md:rounded-xl md:flex-none"
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-pill"
                    className="absolute inset-x-1 top-0 bottom-0 rounded-2xl bg-gradient-to-b from-ember-500/25 to-ember-600/10 border border-ember-400/30 md:inset-x-0 md:rounded-xl"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <motion.div
                  animate={{ scale: isActive ? 1.08 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className="relative z-10 flex-shrink-0"
                >
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.4 : 2}
                    className={clsx(isActive ? 'text-ember-400' : 'text-clay-400/70')}
                  />
                </motion.div>
                <span
                  className={clsx(
                    'relative z-10 text-[9.5px] font-semibold tracking-wide whitespace-nowrap md:text-sm md:ml-3',
                    isActive ? 'text-ember-400' : 'text-clay-400/60'
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
