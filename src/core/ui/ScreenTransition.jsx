import { motion, AnimatePresence } from 'framer-motion';

/**
 * ScreenTransition
 * -----------------
 * Wraps the active tab's screen content. Uses a lightweight fade+slide
 * that completes in 150ms for snappy tab switching — critical for
 * perceived performance on mid-range Android devices.
 */
export default function ScreenTransition({ activeKey, children }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
