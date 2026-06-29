import { motion } from 'framer-motion';
import clsx from 'clsx';

/**
 * GlassButton
 * ------------
 * Primary touch target component. Minimum 48px tap height enforced.
 * Variants:
 *  - 'primary'   : ember gradient fill, used for the single most important
 *                  action on a screen (Save, Confirm, Record).
 *  - 'glass'     : translucent glass surface, for secondary actions.
 *  - 'ghost'     : text-only, for tertiary/cancel actions.
 *  - 'danger'    : reserved for destructive actions (delete).
 */
const VARIANTS = {
  primary:
    'bg-gradient-to-b from-ember-500 to-ember-600 text-clay-50 shadow-ember-glow border border-ember-400/40',
  glass:
    'glass-surface text-clay-100 active:bg-white/10',
  ghost:
    'bg-transparent text-clay-300 active:bg-white/5',
  danger:
    'bg-gradient-to-b from-ledger-overdue to-red-700 text-clay-50 border border-red-400/30',
};

export default function GlassButton({
  children,
  onClick,
  variant = 'primary',
  className,
  disabled = false,
  type = 'button',
  fullWidth = false,
  icon: Icon,
  size = 'md',
}) {
  const sizeClasses = size === 'sm' ? 'h-11 px-4 text-sm' : 'h-tap px-5 text-base';

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      className={clsx(
        'rounded-2xl font-semibold flex items-center justify-center gap-2',
        'select-none touch-manipulation',
        sizeClasses,
        VARIANTS[variant],
        fullWidth && 'w-full',
        disabled && 'opacity-40 pointer-events-none',
        className
      )}
    >
      {Icon && <Icon size={18} strokeWidth={2.25} />}
      {children}
    </motion.button>
  );
}
