import { useState, useMemo } from 'react';
import {
  Fuel,
  Wrench,
  Coffee,
  HandCoins,
  MoreHorizontal,
  Plus,
  Banknote,
  Landmark,
} from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import BottomSheet from '../../core/ui/BottomSheet';
import { GlassInput, GlassToggleGroup, GlassTextarea } from '../../core/ui/GlassFormControls';
import { useExpenses, useTodayExpenses } from '../../core/hooks/useDexieHooks';
import { db } from '../../core/db/schema';
import { formatINR, formatDateDisplay, todayISO } from '../../core/utils/format';
import { useUIStore } from '../../core/store/uiStore';
import { hapticTap } from '../../core/utils/nativeFileBridge';

export const EXPENSE_CATEGORIES = [
  { key: 'Diesel/Fuel', icon: Fuel },
  { key: 'Vehicle Maintenance', icon: Wrench },
  { key: 'Labour Food & Tea', icon: Coffee },
  { key: 'Labour Cash Advance', icon: HandCoins },
  { key: 'Miscellaneous', icon: MoreHorizontal },
];

export default function ExpensesScreen() {
  const [addOpen, setAddOpen] = useState(false);
  const expenses = useExpenses(200);
  const todayExpenses = useTodayExpenses();

  const todayTotal = (todayExpenses || []).reduce((s, e) => s + e.amount, 0);

  const categoryTotals = useMemo(() => {
    const totals = {};
    (expenses || []).forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return totals;
  }, [expenses]);

  return (
    <div className="pb-32">
      <ScreenHeader
        eyebrow="Cash Leakage"
        title="Daily Expenses"
        action={
          <GlassButton size="sm" icon={Plus} onClick={() => setAddOpen(true)}>
            Add
          </GlassButton>
        }
      />

      <div className="px-5 space-y-4">
        <GlassCard padding="p-4" className="bg-gradient-to-br from-ember-700/15 to-kiln-800/30">
          <p className="text-xs text-clay-300 uppercase tracking-wide mb-1">Today's Expenses</p>
          <p className="figure text-2xl font-bold text-clay-50">{formatINR(todayTotal)}</p>
        </GlassCard>

        <div className="grid grid-cols-2 gap-3">
          {EXPENSE_CATEGORIES.map(({ key, icon: Icon }) => (
            <GlassCard key={key} padding="p-3">
              <Icon size={15} className="text-ember-400 mb-1.5" />
              <p className="text-[11px] text-clay-400 leading-tight mb-1">{key}</p>
              <p className="figure text-sm font-bold text-clay-100">
                {formatINR(categoryTotals[key] || 0)}
              </p>
            </GlassCard>
          ))}
        </div>

        <div>
          <p className="text-xs font-semibold text-clay-400 uppercase tracking-wide mb-2 ml-1">
            Recent Entries
          </p>
          <div className="space-y-2">
            {(expenses || []).map((e) => {
              const cfg = EXPENSE_CATEGORIES.find((c) => c.key === e.category);
              const Icon = cfg?.icon || MoreHorizontal;
              return (
                <GlassCard key={e.id} padding="p-3.5" className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-ember-500/15 flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-ember-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-clay-100 truncate">{e.category}</p>
                      <p className="text-xs text-clay-500">
                        {formatDateDisplay(e.date)} · {e.paymentChannel === 'cash' ? 'Cash' : 'Bank/UPI'}
                      </p>
                    </div>
                  </div>
                  <p className="figure font-bold text-clay-50 shrink-0">{formatINR(e.amount)}</p>
                </GlassCard>
              );
            })}
            {(expenses || []).length === 0 && (
              <GlassCard padding="p-8" className="text-center">
                <p className="text-clay-400">No expenses logged yet.</p>
              </GlassCard>
            )}
          </div>
        </div>
      </div>

      <AddExpenseSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function AddExpenseSheet({ open, onClose }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].key);
  const [customCategory, setCustomCategory] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('cash');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setAmount('');
    setNote('');
    setError('');
  };

  const handleSubmit = async () => {
    setError('');
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    const finalCategory = isCustom ? customCategory.trim() : category;
    if (!finalCategory) {
      setError('Enter a valid category.');
      return;
    }
    
    setSubmitting(true);
    try {
      await db.expenses.add({
        date,
        category: finalCategory,
        amount: amt,
        paymentChannel,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      });
      await hapticTap();
      pushToast(`${category} logged — ${formatINR(amt)}`, 'success');
      resetForm();
      onClose();
    } catch (e) {
      setError('Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Add Expense">
      <div className="space-y-4">
        <GlassInput
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={todayISO()}
        />

        <div>
          <span className="block text-xs font-medium text-clay-300/80 mb-1.5 ml-1 tracking-wide uppercase">
            Category
          </span>
          <div className="grid grid-cols-2 gap-2">
            {EXPENSE_CATEGORIES.map(({ key, icon: Icon }) => {
              const active = !isCustom && category === key;
              return (
                <button
                  key={key}
                  onClick={() => { setIsCustom(false); setCategory(key); }}
                  className={`flex items-center gap-2 px-3 h-12 rounded-2xl text-sm font-medium touch-manipulation transition-all ${
                    active
                      ? 'bg-gradient-to-b from-ember-500 to-ember-600 text-clay-50'
                      : 'glass-surface-light text-clay-300'
                  }`}
                >
                  <Icon size={15} />
                  <span className="truncate">{key}</span>
                </button>
              );
            })}
            <button
              onClick={() => setIsCustom(true)}
              className={`flex items-center gap-2 px-3 h-12 rounded-2xl text-sm font-medium touch-manipulation transition-all ${
                isCustom
                  ? 'bg-gradient-to-b from-ember-500 to-ember-600 text-clay-50'
                  : 'glass-surface-light text-clay-300'
              }`}
            >
              <Plus size={15} />
              <span className="truncate">Custom...</span>
            </button>
          </div>
          {isCustom && (
            <div className="mt-3">
              <GlassInput
                placeholder="Type custom category name..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
            </div>
          )}
        </div>

        <GlassInput
          label="Amount"
          type="number"
          inputMode="decimal"
          prefix="₹"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <GlassToggleGroup
          label="Payment Channel"
          value={paymentChannel}
          onChange={setPaymentChannel}
          options={[
            { value: 'cash', label: 'Cash-in-Hand', icon: Banknote },
            { value: 'bank', label: 'Bank/UPI', icon: Landmark },
          ]}
        />

        <GlassTextarea
          label="Note (optional)"
          placeholder="e.g. Diesel for JCB loader"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <p className="text-sm text-ledger-overdue text-center">{error}</p>}

        <GlassButton fullWidth onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save Expense'}
        </GlassButton>
      </div>
    </BottomSheet>
  );
}
