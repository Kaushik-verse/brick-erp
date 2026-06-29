import { motion } from 'framer-motion';
import GlassCard from '../../core/ui/GlassCard';
import { formatINR, formatNumber } from '../../core/utils/format';

/**
 * KpiCard — single metric tile in the dashboard grid. `tone` drives the
 * accent color for the value text (ember default, or status colors for
 * receivables/payables emphasis).
 */
export default function KpiCard({ label, value, isCurrency = true, icon: Icon, tone = 'default', delay = 0 }) {
  const toneClasses = {
    default: 'text-clay-50',
    ember: 'text-ember-400',
    paid: 'text-ledger-paid',
    overdue: 'text-ledger-overdue',
  };

  return (
    <GlassCard padding="p-3.5" className="flex flex-col gap-2">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay }}
        className="flex items-center justify-between"
      >
        <span className="text-[11px] font-medium text-clay-400 uppercase tracking-wide">
          {label}
        </span>
        {Icon && <Icon size={15} className="text-clay-500" strokeWidth={2} />}
      </motion.div>
      <span className={`figure text-xl font-bold ${toneClasses[tone]}`}>
        {isCurrency ? formatINR(value) : formatNumber(value)}
      </span>
    </GlassCard>
  );
}
