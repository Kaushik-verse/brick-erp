import { motion } from 'framer-motion';
import clsx from 'clsx';

/**
 * GlassCard
 * ----------
 * The base visual container of the entire app. Implements the
 * "liquid glass" signature: backdrop blur, soft inner highlight,
 * subtle border, deep ambient shadow.
 */
export default function GlassCard({
  children,
  className,
  onClick,
  animate = true,
  padding = 'p-4',
  light = false,
}) {
  const Comp = onClick ? motion.button : motion.div;

  return (
    <Comp
      onClick={onClick}
      initial={animate ? { opacity: 0, y: 10 } : false}
      animate={animate ? { opacity: 1, y: 0 } : false}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      whileTap={onClick ? { scale: 0.98 } : {}}
      className={clsx(
        light ? 'glass-surface-light' : 'glass-surface',
        'rounded-2xl',
        padding,
        onClick && 'text-left w-full touch-manipulation',
        className
      )}
    >
      {children}
    </Comp>
  );
}
