import { useState, useEffect } from 'react';
import { Receipt, Banknote, Landmark, UserPlus } from 'lucide-react';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput, GlassSelect, GlassToggleGroup } from '../../core/ui/GlassFormControls';
import { recordSale } from '../../core/db/ledgerEngine';
import { useCustomers, useFinishedStock } from '../../core/hooks/useDexieHooks';
import { useUIStore } from '../../core/store/uiStore';
import { todayISO } from '../../core/utils/format';
import { hapticTap } from '../../core/utils/nativeFileBridge';
import { db } from '../../core/db/schema';

export default function AddSaleSheet({ open, onClose }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const customers = useCustomers();
  const finishedStock = useFinishedStock();

  const [date, setDate] = useState(todayISO());
  const [customerId, setCustomerId] = useState('');
  const [brickSize, setBrickSize] = useState('4-inch');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('cash');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stockRow = (finishedStock || []).find((f) => f.brickSize === brickSize);
    if (stockRow && !rate) setRate(String(stockRow.sellingPrice));
  }, [brickSize, finishedStock]);

  const selectedStock = (finishedStock || []).find((f) => f.brickSize === brickSize);
  const availableStock = selectedStock?.currentStock || 0;

  const qtyNum = Number(quantity) || 0;
  const rateNum = Number(rate) || 0;
  const totalAmount = qtyNum * rateNum;
  const paidNum = Number(amountPaid) || 0;
  const balanceDue = Math.max(totalAmount - paidNum, 0);
  const remainingStock = availableStock - qtyNum;

  const handleQtyChange = (delta) => {
    let newQty = qtyNum + delta;
    if (newQty < 0) newQty = 0;
    setQuantity(newQty === 0 ? '' : String(newQty));
  };

  const resetForm = () => {
    setQuantity('');
    setAmountPaid('');
    setError('');
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) return;
    const id = await db.customers.add({
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim(),
      outstandingBalance: 0,
      createdAt: new Date().toISOString(),
    });
    setCustomerId(id);
    setShowNewCustomer(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
  };

  const handleSubmit = async () => {
    setError('');
    if (!customerId) {
      setError('Select or add a customer.');
      return;
    }
    if (!qtyNum || qtyNum <= 0) {
      setError('Enter a valid quantity.');
      return;
    }
    if (qtyNum > availableStock) {
      setError('Insufficient stock. Cannot oversell.');
      return;
    }
    if (!rateNum || rateNum <= 0) {
      setError('Enter a valid rate.');
      return;
    }
    setSubmitting(true);
    try {
      await recordSale({
        date,
        customerId: Number(customerId),
        brickSize,
        quantity: qtyNum,
        rate: rateNum,
        amountPaid: paidNum,
        paymentChannel,
      });
      await hapticTap();
      pushToast('Sale recorded successfully', 'success');
      resetForm();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to record sale.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Record Sale">
      <div className="space-y-4">
        <GlassInput
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={todayISO()}
        />

        {!showNewCustomer ? (
          <div>
            <GlassSelect
              label="Customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select customer…</option>
              {(customers || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </GlassSelect>
            <button
              onClick={() => setShowNewCustomer(true)}
              className="flex items-center gap-1.5 mt-2 ml-1 text-xs font-semibold text-ember-400 touch-manipulation"
            >
              <UserPlus size={13} /> Add new customer
            </button>
          </div>
        ) : (
          <div className="glass-surface-light rounded-2xl p-3.5 space-y-3">
            <GlassInput
              label="New Customer Name"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="Full name"
            />
            <GlassInput
              label="Phone (for WhatsApp reminders)"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              placeholder="10-digit mobile"
              inputMode="tel"
            />
            <div className="flex gap-2">
              <GlassButton size="sm" variant="glass" fullWidth onClick={() => setShowNewCustomer(false)}>
                Cancel
              </GlassButton>
              <GlassButton size="sm" fullWidth onClick={handleCreateCustomer}>
                Save Customer
              </GlassButton>
            </div>
          </div>
        )}

        <GlassSelect label="Product" value={brickSize} onChange={(e) => setBrickSize(e.target.value)}>
          {(finishedStock || []).filter(f => f.isActive !== 0).map((product) => (
            <option key={product.id} value={product.brickSize}>
              {product.brickSize}
            </option>
          ))}
        </GlassSelect>
        <div className="flex justify-between items-center text-xs px-1">
          <span className="text-clay-400">Available Stock:</span>
          <span className="font-bold text-clay-100">{availableStock.toLocaleString()}</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-xs font-medium text-clay-300 mb-1.5 px-1">
              Quantity
            </label>
            <div className="flex items-center gap-1">
              <button 
                className="w-10 h-10 rounded-xl bg-glass-panel border border-glass-border flex items-center justify-center text-clay-100 active:scale-95 transition-transform"
                onClick={() => handleQtyChange(-500)}
              >-</button>
              <input
                type="number"
                inputMode="numeric"
                className="flex-1 h-10 bg-glass-panel border border-glass-border rounded-xl text-center text-clay-50 placeholder-clay-500 text-sm focus:outline-none focus:ring-1 focus:ring-ember-500"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
              <button 
                className="w-10 h-10 rounded-xl bg-glass-panel border border-glass-border flex items-center justify-center text-clay-100 active:scale-95 transition-transform"
                onClick={() => handleQtyChange(500)}
              >+</button>
            </div>
          </div>
          <GlassInput
            label="Rate / Unit"
            type="number"
            inputMode="decimal"
            prefix="₹"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        {qtyNum > 0 && (
          <div className="flex justify-end text-xs px-1">
            <span className={remainingStock < 0 ? 'text-ledger-overdue' : 'text-clay-400'}>
              Remaining Stock after sale: <span className="font-bold">{remainingStock.toLocaleString()}</span>
            </span>
          </div>
        )}

        <GlassInput
          label="Amount Paid Now"
          type="number"
          inputMode="decimal"
          prefix="₹"
          placeholder="0 for full credit"
          value={amountPaid}
          onChange={(e) => setAmountPaid(e.target.value)}
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

        {totalAmount > 0 && (
          <div className="glass-surface-light rounded-2xl p-3.5 flex justify-between items-center">
            <div>
              <p className="text-xs text-clay-400">Total Amount</p>
              <p className="figure text-lg font-bold text-clay-50">₹{totalAmount.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-clay-400">Balance Due</p>
              <p className={`figure text-lg font-bold ${balanceDue > 0 ? 'text-ledger-overdue' : 'text-ledger-paid'}`}>
                ₹{balanceDue.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-ledger-overdue text-center">{error}</p>}

        <GlassButton fullWidth onClick={handleSubmit} disabled={submitting} icon={Receipt}>
          {submitting ? 'Saving…' : 'Record Sale'}
        </GlassButton>
      </div>
    </BottomSheet>
  );
}
