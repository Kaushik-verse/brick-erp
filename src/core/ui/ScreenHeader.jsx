import { motion } from 'framer-motion';

/**
 * ScreenHeader
 * -------------
 * Standard top header used by every feature screen. Accounts for the
 * Android status bar / camera pinhole via pt-safe-header (safe-area
 * inset PLUS breathing room — see index.css), and carries the app's
 * editorial typographic signature (Fraunces display serif against the
 * kiln-dark background).
 */
export default function ScreenHeader({ eyebrow, title, action, subtitle }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="pt-safe-header px-5 pb-3 flex items-start justify-between gap-3"
    >
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
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </motion.header>
  );
}
