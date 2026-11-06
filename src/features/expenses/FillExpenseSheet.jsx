import { useEffect, useMemo, useState } from 'react';
import { Banknote, Landmark, Smartphone, Check } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput, GlassToggleGroup } from '../../core/ui/GlassFormControls';
import { db } from '../../core/db/schema';
import { useUIStore } from '../../core/store/uiStore';
import { todayISO, formatINR } from '../../core/utils/format';
import { hapticTap } from '../../core/utils/nativeFileBridge';
import { useT } from '../../core/i18n';

const STARTERS = ['Diesel/Fuel', 'Hamali', 'Daily wages', 'Current bill', 'Machinery Repair Charges', 'Lorry freight'];

/**
 * FillExpenseSheet (New app)
 * ---------------------------
 * Dad mostly writes his own expense names (Hamali, Daily wages, Lime
 * transport…), so instead of a fixed category grid this is a simple
 * "what was it for?" box. His most-used names appear as one-tap buttons,
 * learned from his past entries, and typing a name he used before reuses
 * the same spelling so reports group correctly.
 */
export default function FillExpenseSheet({ open, onClose, editExpense }) {
  const { t } = useT();
  const pushToast = useUIStore((s) => s.pushToast);
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('cash');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const history = useLiveQuery(() => db.expenses.toArray(), [], []);

  // Most-used names first, then recent ones, then a few starters.
  const usual = useMemo(() => {
    const count = {};
    const last = {};
    for (const e of history) {
      const c = (e.category || '').trim();
      if (!c) continue;
      count[c] = (count[c] || 0) + 1;
      if (!last[c] || e.date > last[c]) last[c] = e.date;
    }
    const names = Object.keys(count).sort((a, b) => count[b] - count[a] || (last[b] || '').localeCompare(last[a] || ''));
    for (const s of STARTERS) if (!names.some((n) => n.toLowerCase() === s.toLowerCase())) names.push(s);
    return names.slice(0, 10);
  }, [history]);

  const shown = what.trim()
    ? usual.filter((n) => n.toLowerCase().includes(what.trim().toLowerCase()) && n.toLowerCase() !== what.trim().toLowerCase())
    : usual;

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editExpense) {
      setWhat(editExpense.category || '');
      setAmount(String(editExpense.amount ?? ''));
      setChannel(editExpense.paymentChannel || 'cash');
      setDate(editExpense.date || todayISO());
      setNote(editExpense.note || '');
    } else {
      setWhat('');
      setAmount('');
      setChannel('cash');
      setDate(todayISO());
      setNote('');
    }
  }, [open, editExpense]);

  const handleSave = async () => {
    setError('');
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError(t('exp.errAmount'));
    let category = what.trim().replace(/\s+/g, ' ');
    if (!category) return setError(t('exp.errWhat'));
    // Reuse the existing spelling ("hamali" → "Hamali") so totals group together.
    const known = usual.find((n) => n.toLowerCase() === category.toLowerCase());
    if (known) category = known;
    else category = category.charAt(0).toUpperCase() + category.slice(1);

    setSaving(true);
    try {
      const row = { date, category, amount: amt, paymentChannel: channel, note: note.trim() };
      if (editExpense) await db.expenses.update(editExpense.id, row);
      else await db.expenses.add({ ...row, createdAt: new Date().toISOString() });
      await hapticTap();
      pushToast(`${category} — ${formatINR(amt)}`, 'success');
      onClose();
    } catch {
      setError('Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={editExpense ? t('exp.edit') : t('exp.add')}>
      <div className="space-y-4">
        <div>
          <GlassInput
            label={t('exp.forWhat')}
            placeholder={t('exp.forWhatPh')}
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            autoFocus={!editExpense}
            className="text-lg font-semibold"
          />
          {shown.length > 0 && (
            <>
              <p className="text-[11px] text-clay-400 mt-2.5 mb-1.5 ml-1">{t('exp.often')}</p>
              <div className="flex flex-wrap gap-2">
                {shown.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setWhat(n)}
                    className={`h-10 px-3.5 rounded-full text-sm font-semibold touch-manipulation border transition-colors ${
                      what === n ? 'bg-ember-500 text-white border-ember-500' : 'glass-surface-light text-clay-200 border-glass-border'
                    }`}
                  >
                    {what === n && <Check size={13} className="inline -mt-0.5 mr-1" />}
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <GlassInput
          label={t('exp.amount')}
          type="number"
          inputMode="decimal"
          prefix="₹"
          min="0"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="text-2xl font-bold h-14 figure"
        />

        <GlassToggleGroup
          label={t('exp.paidBy')}
          value={channel}
          onChange={setChannel}
          options={[
            { value: 'cash', label: t('exp.cash'), icon: Banknote },
            { value: 'upi', label: 'UPI', icon: Smartphone },
            { value: 'bank', label: t('exp.bank'), icon: Landmark },
          ]}
        />

        <div className="grid grid-cols-1 gap-3">
          <GlassInput label={t('exp.date')} type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <GlassInput label={t('exp.details')} placeholder={t('exp.detailsPh')} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && <p className="text-sm text-ledger-overdue text-center">{error}</p>}

        <GlassButton fullWidth onClick={handleSave} disabled={saving}>
          {saving ? t('exp.saving') : editExpense ? t('exp.update') : t('exp.save')}
        </GlassButton>
      </div>
    </BottomSheet>
  );
}
