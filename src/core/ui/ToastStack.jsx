import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { useUIStore } from '../store/uiStore';

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const COLORS = {
  success: 'text-ledger-paid border-ledger-paid/30',
  error: 'text-ledger-overdue border-ledger-overdue/30',
  info: 'text-ledger-credit border-ledger-credit/30',
};

export default function ToastStack() {
  const toasts = useUIStore((s) => s.toasts);

  return (
    <div className="fixed top-safe left-0 right-0 z-[60] flex flex-col items-center gap-2 pt-3 px-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone] || Info;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`glass-surface rounded-2xl px-4 py-3 flex items-center gap-2 max-w-sm shadow-glass-md border ${COLORS[toast.tone]}`}
            >
              <Icon size={18} strokeWidth={2.5} />
              <span className="text-sm font-medium text-clay-50">{toast.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
