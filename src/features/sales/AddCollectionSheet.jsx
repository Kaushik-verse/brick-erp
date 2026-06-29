import { useState } from 'react';
import { Banknote, Landmark, Download } from 'lucide-react';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput, GlassToggleGroup } from '../../core/ui/GlassFormControls';
import { addCustomerCollection } from '../../core/db/ledgerEngine';
import { useUIStore } from '../../core/store/uiStore';
import { todayISO } from '../../core/utils/format';
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

  const handleSubmit = async () => {
    setError('');
    if (!amtNum || amtNum <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      await addCustomerCollection(customerId, amtNum, paymentChannel, date, remarks);
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
          <p className="font-bold text-lg text-ledger-overdue">₹{Number(outstandingBalance).toFixed(2)}</p>
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
            { value: 'bank', label: 'Bank/UPI', icon: Landmark },
          ]}
        />

        {error && <p className="text-sm text-ledger-overdue text-center">{error}</p>}

        <GlassButton fullWidth onClick={handleSubmit} disabled={submitting} icon={Download}>
          {submitting ? 'Saving…' : 'Record Collection'}
        </GlassButton>
      </div>
    </BottomSheet>
  );
}
