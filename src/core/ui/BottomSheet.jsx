import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * BottomSheet
 * ------------
 * Native-feeling modal: emerges from the bottom edge with a liquid
 * spring curve, dims background with a blurred scrim, supports drag-to-
 * dismiss via the handle, and respects safe-area bottom inset.
 */
export default function BottomSheet({ open, onClose, title, children, maxHeight = '88vh' }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-kiln-950/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34, mass: 0.9 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose();
            }}
            style={{ maxHeight }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl glass-surface
                       border-t border-white/10 flex flex-col pb-safe"
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-clay-400/30" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0">
              <h2 className="text-lg font-display font-semibold text-clay-50">{title}</h2>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full glass-surface-light flex items-center justify-center touch-manipulation"
              >
                <X size={18} className="text-clay-300" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-6 no-scrollbar">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
