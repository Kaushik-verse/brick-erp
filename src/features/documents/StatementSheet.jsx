import { useState } from 'react';
import { FileText } from 'lucide-react';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput } from '../../core/ui/GlassFormControls';
import { useUIStore } from '../../core/store/uiStore';
import { todayISO, toLocalISOString } from '../../core/utils/format';

function periods() {
  const now = new Date();
  const fyStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1);
  const monthName = (d) => d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return [
    { key: 'all', label: 'All transactions' },
    { key: 'month', label: monthName(now), from: toLocalISOString(new Date(now.getFullYear(), now.getMonth(), 1)), to: todayISO() },
    { key: 'last', label: monthName(lastMonth), from: toLocalISOString(lastMonth), to: toLocalISOString(new Date(now.getFullYear(), now.getMonth(), 0)) },
    { key: 'fy', label: `FY ${fyStart.getFullYear()}-${String(fyStart.getFullYear() + 1).slice(-2)}`, from: toLocalISOString(fyStart), to: todayISO() },
    { key: 'custom', label: 'Custom dates' },
  ];
}

/** Choose a period, then generate & share a Statement of Account PDF. */
export default function StatementSheet({ open, onClose, type, partyId, partyName }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [choice, setChoice] = useState('all');
  const [from, setFrom] = useState(todayISO().slice(0, 8) + '01');
  const [to, setTo] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const list = periods();

  const handleShare = async () => {
    const p = list.find((x) => x.key === choice);
    const period =
      choice === 'custom'
        ? { from, to, label: `${new Date(`${from}T00:00:00`).toLocaleDateString('en-GB')} to ${new Date(`${to}T00:00:00`).toLocaleDateString('en-GB')}` }
        : { from: p.from, to: p.to, label: p.key === 'all' ? '' : p.label };
    if (choice === 'custom' && from > to) {
      pushToast('“From” date must be before “To” date', 'error');
      return;
    }
    setBusy(true);
    try {
      const { shareStatement } = await import('../../core/billing/documents');
      await shareStatement(type, partyId, period);
      onClose();
    } catch (e) {
      console.error(e);
      pushToast(e.message || 'Could not create statement', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Statement · ${partyName || ''}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {list.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setChoice(p.key)}
              className={`h-12 rounded-xl text-xs font-semibold px-2 touch-manipulation ${
                choice === p.key ? 'bg-gradient-to-b from-ember-500 to-ember-600 text-clay-50' : 'glass-surface-light text-clay-300'
              } ${p.key === 'all' ? 'col-span-2' : ''}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {choice === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <GlassInput label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <GlassInput label="To" type="date" value={to} max={todayISO()} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
        <p className="text-xs text-clay-400 leading-relaxed">
          The PDF shows the opening balance, every bill and payment with a running balance, the closing balance
          {type === 'customer' ? ', how old the dues are, and a UPI QR code for the balance.' : '.'}
        </p>
        <GlassButton fullWidth icon={FileText} onClick={handleShare} disabled={busy}>
          {busy ? 'Preparing…' : 'Create & Share PDF'}
        </GlassButton>
      </div>
    </BottomSheet>
  );
}
