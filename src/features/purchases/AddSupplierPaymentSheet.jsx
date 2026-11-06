import { useState } from 'react';
import { Banknote, Landmark, Smartphone, Upload } from 'lucide-react';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput, GlassToggleGroup } from '../../core/ui/GlassFormControls';
import { addSupplierPayment } from '../../core/db/ledgerEngine';
import { useUIStore } from '../../core/store/uiStore';
import { todayISO, formatINR } from '../../core/utils/format';
import { hapticTap } from '../../core/utils/nativeFileBridge';

export default function AddSupplierPaymentSheet({ open, onClose, supplierId, supplierName, outstandingBalance }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('cash');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const amtNum = Number(amount) || 0;

  const handleSubmit = async () => {
    setError('');
    if (!amtNum || amtNum <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    const due = Number(outstandingBalance) || 0;
    if (amtNum > due + 0.009 &&
      !window.confirm(`${formatINR(amtNum)} is more than the balance of ${formatINR(due)}. The extra will be kept as an advance. Continue?`)) {
      return;
    }
    setSubmitting(true);
    try {
      await addSupplierPayment(supplierId, amtNum, paymentChannel, date, remarks);
      await hapticTap();
      pushToast('Payment recorded successfully', 'success');
      setAmount('');
      setRemarks('');
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Record Payment - ${supplierName}`}>
      <div className="space-y-4">
        <div className="glass-surface-light rounded-2xl p-3.5 flex justify-between items-center mb-4">
          <p className="text-sm text-clay-300">Outstanding</p>
          <p className="figure font-bold text-lg text-ledger-overdue">{formatINR(Number(outstandingBalance) || 0, { decimals: 2 })}</p>
        </div>

        <GlassInput
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={todayISO()}
        />

        <GlassInput
          label="Amount Paid"
          type="number"
          inputMode="decimal"
          prefix="₹"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {Number(outstandingBalance) > 0 && (
          <button
            type="button"
            onClick={() => setAmount(String(Number(outstandingBalance)))}
            className="-mt-2 w-full h-9 rounded-xl glass-surface-light text-xs font-semibold text-ledger-paid touch-manipulation"
          >
            Full balance ({formatINR(Number(outstandingBalance))})
          </button>
        )}

        <GlassInput
          label="Remarks / Reference (Optional)"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. UTR number, check number"
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

        {error && <p className="text-sm text-ledger-overdue text-center">{error}</p>}

        <GlassButton fullWidth onClick={handleSubmit} disabled={submitting} icon={Upload}>
          {submitting ? 'Saving…' : 'Record Payment'}
        </GlassButton>
      </div>
    </BottomSheet>
  );
}
