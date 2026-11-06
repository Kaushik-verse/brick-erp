import { useState, useMemo, useEffect } from 'react';
import {
  Fuel,
  Wrench,
  MoreHorizontal,
  Plus,
  Banknote,
  Landmark,
  Settings,
  Tags,
  MapPin,
  Trash2,
  Pencil,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Users,
  Zap,
} from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import BottomSheet from '../../core/ui/BottomSheet';
import { GlassInput, GlassToggleGroup, GlassTextarea } from '../../core/ui/GlassFormControls';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/schema';
import { formatINR, formatDateDisplay, todayISO, channelLabel, parseISODate } from '../../core/utils/format';
import { useUIStore } from '../../core/store/uiStore';
import { hapticTap } from '../../core/utils/nativeFileBridge';
import FillExpenseSheet from './FillExpenseSheet';

export const EXPENSE_CATEGORIES = [
  { key: 'Diesel/Fuel', icon: Fuel },
  { key: 'Labour/Wages', icon: Users },
  { key: 'Electricity', icon: Zap },
  { key: 'Vehicle Maintenance', icon: Wrench },
  { key: 'Machinery Repair Charges', icon: Settings },
  { key: 'General Charges', icon: Tags },
  { key: 'Travelling Charges', icon: MapPin },
  { key: 'Miscellaneous', icon: MoreHorizontal },
];

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ExpensesScreen({ onBack, fillMode = false }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [addOpen, setAddOpen] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7)); // 'YYYY-MM'
  const currentMonth = todayISO().slice(0, 7);

  const expenses = useLiveQuery(() => {
    const [y, m] = selectedMonth.split('-');
    const daysInMonth = new Date(Number(y), Number(m), 0).getDate();
    const start = `${selectedMonth}-01`;
    const end = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`;
    return db.expenses
      .where('date')
      .between(start, end, true, true)
      .toArray()
      .then((rows) =>
        rows.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''))
      );
  }, [selectedMonth], []);

  const handleDelete = async (e) => {
    if (window.confirm(`Delete ${e.category} expense of ${formatINR(e.amount)} on ${formatDateDisplay(e.date)}?`)) {
      try {
        await db.expenses.delete(e.id);
        pushToast("Expense deleted successfully", "success");
      } catch (err) {
        pushToast("Error deleting expense", "error");
      }
    }
  };

  const monthTotal = (expenses || []).reduce((s, e) => s + e.amount, 0);

  const customCategories = useMemo(() => {
    const known = new Set(EXPENSE_CATEGORIES.map((c) => c.key));
    return [...new Set((expenses || []).map((e) => e.category).filter((c) => c && !known.has(c)))];
  }, [expenses]);

  const categoryTotals = useMemo(() => {
    const totals = {};
    (expenses || []).forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return totals;
  }, [expenses]);

  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader
        onBack={onBack}
        eyebrow="Cash Leakage"
        title="Daily Expenses"
        action={
          <GlassButton size="sm" icon={Plus} onClick={() => setAddOpen(true)}>
            Add
          </GlassButton>
        }
      />

      <div className="px-5 md:px-8 space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between glass-surface-light rounded-2xl p-1">
          <button
            onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
            aria-label="Previous month"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-clay-300 touch-manipulation active:bg-white/5"
          >
            <ChevronLeft size={18} />
          </button>
          <label className="relative text-sm font-semibold text-clay-50">
            {parseISODate(`${selectedMonth}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            <input
              type="month"
              value={selectedMonth}
              max={currentMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Choose month"
            />
          </label>
          <button
            onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
            disabled={selectedMonth >= currentMonth}
            aria-label="Next month"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-clay-300 touch-manipulation active:bg-white/5 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <GlassCard padding="p-4" className="bg-gradient-to-br from-ember-700/15 to-kiln-800/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Banknote size={64} />
          </div>
          <p className="text-xs text-clay-300 uppercase tracking-wide mb-1">Total Expenses This Month</p>
          <p className="figure text-3xl font-bold text-clay-50">{formatINR(monthTotal)}</p>
          <p className="text-xs text-clay-400 mt-1">{(expenses || []).length} entries</p>
        </GlassCard>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...EXPENSE_CATEGORIES, ...customCategories.map((key) => ({ key, icon: Tags }))]
            .filter(({ key }) => (categoryTotals[key] || 0) > 0 || EXPENSE_CATEGORIES.slice(0, 4).some((c) => c.key === key))
            .map(({ key, icon: Icon }) => {
            const amt = categoryTotals[key] || 0;
            const pct = monthTotal > 0 ? (amt / monthTotal) * 100 : 0;
            return (
              <GlassCard key={key} padding="p-3">
                <Icon size={15} className="text-ember-400 mb-1.5" />
                <p className="text-[11px] text-clay-400 leading-tight mb-1">{key}</p>
                <p className="figure text-sm font-bold text-clay-100 mb-2">
                  {formatINR(amt)}
                </p>
                <div className="w-full bg-slate-200/10 rounded-full h-1.5">
                  <div className="bg-ember-500 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                </div>
              </GlassCard>
            );
          })}
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
                        {formatDateDisplay(e.date)} · {channelLabel(e.paymentChannel)}
                      </p>
                      {e.note && <p className="text-xs text-clay-400 truncate">{e.note}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <p className="figure font-bold text-clay-50 mr-1">{formatINR(e.amount)}</p>
                    <button
                      onClick={() => { setEditExpense(e); setAddOpen(true); }}
                      aria-label="Edit expense"
                      className="text-clay-400 hover:text-clay-100 transition-colors p-2 touch-manipulation"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(e)}
                      aria-label="Delete expense"
                      className="text-clay-500 hover:text-ledger-overdue transition-colors p-2 touch-manipulation"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </GlassCard>
              );
            })}
            {(expenses || []).length === 0 && (
              <GlassCard padding="p-8" className="text-center">
                <p className="text-clay-400">No expenses in this month.</p>
              </GlassCard>
            )}
          </div>
        </div>
      </div>

      {fillMode ? (
        <FillExpenseSheet
          open={addOpen}
          editExpense={editExpense}
          onClose={() => {
            setAddOpen(false);
            setEditExpense(null);
          }}
        />
      ) : (
      <AddExpenseSheet
        open={addOpen}
        editExpense={editExpense}
        onClose={() => {
          setAddOpen(false);
          setEditExpense(null);
        }}
      />
      )}
    </div>
  );
}

export function AddExpenseSheet({ open, onClose, editExpense }) {
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

  useEffect(() => {
    if (!open) return;
    if (editExpense) {
      const known = EXPENSE_CATEGORIES.some((c) => c.key === editExpense.category);
      setDate(editExpense.date);
      setIsCustom(!known);
      setCategory(known ? editExpense.category : EXPENSE_CATEGORIES[0].key);
      setCustomCategory(known ? '' : editExpense.category);
      setAmount(String(editExpense.amount));
      setPaymentChannel(editExpense.paymentChannel || 'cash');
      setNote(editExpense.note || '');
      setError('');
    } else {
      setDate(todayISO());
      resetForm();
    }
  }, [open, editExpense]);

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
      if (editExpense) {
        await db.expenses.update(editExpense.id, {
          date,
          category: finalCategory,
          amount: amt,
          paymentChannel,
          note: note.trim(),
        });
      } else {
        await db.expenses.add({
          date,
          category: finalCategory,
          amount: amt,
          paymentChannel,
          note: note.trim(),
          createdAt: new Date().toISOString(),
        });
      }
      await hapticTap();
      pushToast(`${finalCategory} ${editExpense ? 'updated' : 'logged'} — ${formatINR(amt)}`, 'success');
      resetForm();
      onClose();
    } catch (e) {
      setError('Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={editExpense ? 'Edit Expense' : 'Add Expense'}>
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
            { value: 'cash', label: 'Cash', icon: Banknote },
            { value: 'upi', label: 'UPI', icon: Smartphone },
            { value: 'bank', label: 'Bank', icon: Landmark },
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
          {submitting ? 'Saving…' : editExpense ? 'Update Expense' : 'Save Expense'}
        </GlassButton>
      </div>
    </BottomSheet>
  );
}
