import { ArrowLeft } from 'lucide-react';

/**
 * ScreenHeader
 * -------------
 * Standard top header used by every feature screen. Accounts for the
 * Android status bar / camera pinhole via pt-safe-header (safe-area
 * inset PLUS breathing room — see index.css), and carries the app's
 * editorial typographic signature (Fraunces display serif against the
 * kiln-dark background).
 *
 * Pass `onBack` on secondary screens to show a back arrow before the title.
 */
export default function ScreenHeader({ eyebrow, title, action, subtitle, onBack }) {
  return (
    <header
      className="header-enter pt-safe-header px-5 md:px-8 pb-3 flex items-start justify-between gap-3 max-w-7xl mx-auto"
    >
      <div className="flex items-start gap-3 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="mt-1 w-10 h-10 shrink-0 rounded-full glass-surface-light flex items-center justify-center touch-manipulation active:scale-95 transition-transform"
          >
            <ArrowLeft size={18} className="text-clay-300" />
          </button>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ember-400/80 mb-0.5">
              {eyebrow}
            </p>
          )}
          <h1 className="text-[26px] leading-tight font-display font-semibold text-clay-50 truncate">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-clay-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </header>
  );
}
