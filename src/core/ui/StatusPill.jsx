import clsx from 'clsx';
import { CheckCircle2, Clock, AlertCircle, CircleDollarSign } from 'lucide-react';

const STATUS_CONFIG = {
  paid: {
    label: 'Paid',
    icon: CheckCircle2,
    classes: 'bg-ledger-paid/15 text-ledger-paid border-ledger-paid/30',
  },
  partial: {
    label: 'Partial',
    icon: Clock,
    classes: 'bg-ledger-partial/15 text-ledger-partial border-ledger-partial/30',
  },
  credit: {
    label: 'Full Credit',
    icon: CircleDollarSign,
    classes: 'bg-ledger-credit/15 text-ledger-credit border-ledger-credit/30',
  },
  overdue: {
    label: 'Overdue',
    icon: AlertCircle,
    classes: 'bg-ledger-overdue/15 text-ledger-overdue border-ledger-overdue/30',
  },
};

/**
 * StatusPill — used across Sales, Purchases, Dashboard aging alerts.
 * `status` accepts 'paid' | 'partial' | 'credit' | 'overdue'.
 */
export default function StatusPill({ status, size = 'md' }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.credit;
  const Icon = cfg.icon;
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border font-semibold whitespace-nowrap',
        sizeClasses,
        cfg.classes
      )}
    >
      <Icon size={size === 'sm' ? 10 : 12} strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
}
