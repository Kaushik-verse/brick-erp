import { useState } from 'react';
import { Banknote, Landmark, Smartphone, Download, Send } from 'lucide-react';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput, GlassToggleGroup } from '../../core/ui/GlassFormControls';
import { addCustomerCollection } from '../../core/db/ledgerEngine';
import { useUIStore } from '../../core/store/uiStore';
import { todayISO, formatINR } from '../../core/utils/format';
import { hapticTap } from '../../core/utils/nativeFileBridge';

export default function AddCollectionSheet({ open, onClose, customerId, customerName, outstandingBalance }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('cash');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const amtNum = Number(amount) || 0;

  const handleSubmit = async (sendReceipt = false) => {
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
      const res = await addCustomerCollection(customerId, amtNum, paymentChannel, date, remarks);
      if (sendReceipt && res?.id) {
        try {
          const { shareCollectionReceipt } = await import('../../core/billing/documents');
          await shareCollectionReceipt(res.id);
        } catch (e) {
          console.error(e);
          pushToast('Payment saved, but the receipt could not be shared', 'error');
        }
      }
      await hapticTap();
      pushToast('Collection recorded successfully', 'success');
      setAmount('');
      setRemarks('');
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to record collection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Record Collection - ${customerName}`}>
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
          label="Amount Received"
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

        <div className="grid grid-cols-2 gap-2">
          <GlassButton fullWidth variant="glass" onClick={() => handleSubmit(false)} disabled={submitting} icon={Download}>
            {submitting ? 'Saving…' : 'Save'}
          </GlassButton>
          <GlassButton
            fullWidth
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            icon={Send}
            className="!from-[#25D366] !to-[#1FAF54] !border-[#25D366]/40 !shadow-none"
          >
            Save & Receipt
          </GlassButton>
        </div>
      </div>
    </BottomSheet>
  );
}
