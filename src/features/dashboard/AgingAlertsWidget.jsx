import { AlertTriangle, ChevronRight } from 'lucide-react';
import GlassCard from '../../core/ui/GlassCard';
import { formatINR } from '../../core/utils/format';
import { useOutstandingSales } from '../../core/hooks/useDexieHooks';

/**
 * AgingAlertsWidget
 * -------------------
 * Surfaces the most critical aging receivables (60+ / 31-60 days) right
 * on the dashboard so the owner can't miss them. Tapping a row jumps
 * into the Sales tab pre-filtered (handled by parent via onSelectCustomer).
 */
export default function AgingAlertsWidget({ onSelectCustomer }) {
  const outstandingSales = useOutstandingSales();

  const critical = (outstandingSales || [])
    .filter((s) => s.agingDays > 30)
    .slice(0, 4);

  if (!outstandingSales) return null;

  if (critical.length === 0) {
    return (
      <GlassCard padding="p-4">
        <div className="flex items-center gap-2 text-clay-300">
          <AlertTriangle size={16} className="text-ledger-paid" />
          <span className="text-sm font-medium">No overdue receivables — books are clean.</span>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-ledger-overdue" />
        <h3 className="text-sm font-semibold text-clay-100">Aging Alerts</h3>
      </div>
      <div className="flex flex-col divide-y divide-white/5">
        {critical.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelectCustomer?.(s.customerId)}
            className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 touch-manipulation"
          >
            <div className="text-left min-w-0">
              <p className="text-sm font-medium text-clay-100 truncate">{s.customerName}</p>
              <p className="text-xs text-ledger-overdue font-semibold">{s.agingDays} days overdue</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="figure text-sm font-bold text-clay-50">
                {formatINR(s.balanceDue)}
              </span>
              <ChevronRight size={16} className="text-clay-500" />
            </div>
          </button>
        ))}
      </div>
    </GlassCard>
  );
}
