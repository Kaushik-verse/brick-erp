import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { pushBackHandler } from '../store/backStack';

/**
 * BottomSheet
 * ------------
 * Native-feeling modal: emerges from the bottom edge with a liquid
 * spring curve, dims background with a blurred scrim, supports drag-to-
 * dismiss via the handle, and respects safe-area bottom inset.
 */
export default function BottomSheet({ open, onClose, title, children, maxHeight = '88vh' }) {
  const dragControls = useDragControls();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Android back button closes this sheet first.
  useEffect(() => {
    if (!open) return undefined;
    return pushBackHandler(() => onCloseRef.current?.());
  }, [open]);

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
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 600) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            style={{ maxHeight }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl sheet-surface
                       border-t border-white/10 flex flex-col pb-safe md:left-64 md:max-w-2xl md:mx-auto"
          >
            {/* Only the handle area is draggable, so scrolling a long form never closes the sheet. */}
            <div
              className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab touch-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1.5 rounded-full bg-clay-400/30" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0">
              <h2 className="text-lg font-display font-semibold text-clay-50">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-full glass-surface-light flex items-center justify-center touch-manipulation"
              >
                <X size={18} className="text-clay-300" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-5 pb-6 no-scrollbar">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
