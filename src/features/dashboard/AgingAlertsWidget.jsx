import { AlertTriangle, ChevronRight } from 'lucide-react';
import GlassCard from '../../core/ui/GlassCard';
import { formatINR } from '../../core/utils/format';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/schema';

/**
 * TopOutstandingWidget
 * -------------------
 * Surfaces the customers with the highest outstanding balances
 * right on the dashboard so the owner can't miss them.
 */
export default function AgingAlertsWidget({ onSelectCustomer }) {
  const critical = useLiveQuery(async () => {
    const customers = await db.customers.where('outstandingBalance').above(0).toArray();
    return customers.sort((a, b) => b.outstandingBalance - a.outstandingBalance).slice(0, 4);
  });

  if (!critical) return null;

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
        <h3 className="text-sm font-semibold text-clay-100">Top Outstanding Balances</h3>
      </div>
      <div className="flex flex-col divide-y divide-white/5">
        {critical.map((c) => (
          <div
            key={c.id}
            className="py-3 flex justify-between items-center active:bg-white/5 cursor-pointer rounded-lg px-2 -mx-2 transition-colors"
            onClick={() => onSelectCustomer && onSelectCustomer(c.id)}
          >
            <div>
              <p className="text-sm font-bold text-white truncate max-w-[150px]">
                {c.name}
              </p>
              <p className="text-[11px] text-clay-400 mt-0.5 font-medium">
                {c.phone || 'No phone'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-ledger-overdue">
                  ₹{c.outstandingBalance.toLocaleString()}
                </p>
              </div>
              <ChevronRight size={16} className="text-clay-500" />
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
