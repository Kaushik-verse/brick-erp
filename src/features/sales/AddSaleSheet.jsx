import { useState, useEffect } from 'react';
import { Receipt, Banknote, Landmark, UserPlus, Smartphone, Send } from 'lucide-react';
import BottomSheet from '../../core/ui/BottomSheet';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput, GlassSelect, GlassToggleGroup } from '../../core/ui/GlassFormControls';
import { recordSale, updateSale } from '../../core/db/ledgerEngine';
import { useCustomers, useFinishedStock } from '../../core/hooks/useDexieHooks';
import { useUIStore } from '../../core/store/uiStore';
import { todayISO, formatINR } from '../../core/utils/format';
import { hapticTap } from '../../core/utils/nativeFileBridge';
import { db } from '../../core/db/schema';

export default function AddSaleSheet({ open, onClose, editSale }) {
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
    if (open && editSale) {
      setDate(editSale.date);
      setCustomerId(String(editSale.customerId));
      setBrickSize(editSale.brickSize || '4-inch');
      setQuantity(String(editSale.quantity || ''));
      setRate(String(editSale.rate || ''));
      setAmountPaid(String(editSale.amountPaid || ''));
      setPaymentChannel(editSale.paymentChannel || 'cash');
      setError('');
    } else if (open && !editSale) {
      setDate(todayISO());
      setQuantity('');
      setAmountPaid('');
      setRate('');
      setError('');
    }
  }, [open, editSale]);

  // Fill the default selling price when the product changes (not while editing).
  useEffect(() => {
    if (editSale) return;
    const stockRow = (finishedStock || []).find((f) => f.brickSize === brickSize);
    if (stockRow) setRate(String(stockRow.sellingPrice ?? ''));
  }, [brickSize, finishedStock, editSale]);

  // Default to the first active product if the current one doesn't exist.
  useEffect(() => {
    const active = (finishedStock || []).filter((f) => f.isActive !== 0);
    if (active.length && !active.some((f) => f.brickSize === brickSize)) {
      setBrickSize(active[0].brickSize);
    }
  }, [finishedStock, brickSize]);

  const selectedStock = (finishedStock || []).find((f) => f.brickSize === brickSize);
  // When editing, the bricks of the original sale go back to stock first.
  const editCredit = editSale && editSale.brickSize === brickSize ? Number(editSale.quantity) || 0 : 0;
  const availableStock = (selectedStock?.currentStock || 0) + editCredit;

  const qtyNum = Number(quantity) || 0;
  const rateNum = Number(rate) || 0;
  const totalAmount = Math.round(qtyNum * rateNum * 100) / 100;
  const paidNum = Number(amountPaid) || 0;
  const balanceDue = Math.max(totalAmount - paidNum, 0);
  const selectedCustomer = (customers || []).find((c) => String(c.id) === String(customerId));
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
    const existing = await db.customers.where('name').equalsIgnoreCase(newCustomerName.trim()).first();
    if (existing) {
      setCustomerId(String(existing.id));
      setShowNewCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      pushToast(`${existing.name} already exists — selected`, 'info');
      return;
    }
    const id = await db.customers.add({
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim(),
      outstandingBalance: 0,
      createdAt: new Date().toISOString(),
    });
    setCustomerId(String(id));
    setShowNewCustomer(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
  };

  const handleSubmit = async (shareAfter = false) => {
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
    if (paidNum < 0) {
      setError('Amount paid cannot be negative.');
      return;
    }
    if (paidNum > totalAmount + 0.009) {
      setError(`Amount paid is more than the bill (${formatINR(totalAmount, { decimals: 2 })}). Record extra money as a payment on the customer.`);
      return;
    }
    setSubmitting(true);
    try {
      const values = {
        date,
        customerId: Number(customerId),
        brickSize,
        quantity: qtyNum,
        rate: rateNum,
        amountPaid: paidNum,
        paymentChannel: paidNum > 0 ? paymentChannel : 'credit',
      };
      const res = editSale ? await updateSale(editSale.id, values) : await recordSale(values);
      if (shareAfter && res?.id) {
        try {
          const { shareSaleInvoice } = await import('../../core/billing/documents');
          await shareSaleInvoice(res.id);
        } catch (e) {
          console.error(e);
          pushToast('Sale saved, but the invoice could not be shared', 'error');
        }
      }
      await hapticTap();
      pushToast(editSale ? 'Sale updated successfully' : 'Sale recorded successfully', 'success');
      resetForm();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to record sale.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={editSale ? 'Edit Sale' : 'Record Sale'}>
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
                  {c.phone ? ` · ${c.phone}` : ''}
                </option>
              ))}
            </GlassSelect>
            {selectedCustomer && (selectedCustomer.outstandingBalance || 0) > 0 && (
              <p className="text-[11px] text-ledger-overdue mt-1.5 ml-1">
                Already owes {formatINR(selectedCustomer.outstandingBalance)}
              </p>
            )}
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
            <span className="block text-xs font-medium text-clay-300/80 mb-1.5 ml-1 tracking-wide uppercase">
              Quantity
            </span>
            <div className="flex items-center gap-1">
              <button 
                className="w-16 h-12 rounded-xl glass-surface-light flex items-center justify-center text-xs font-semibold text-clay-100 active:scale-95 transition-transform touch-manipulation"
                type="button"
                aria-label="Decrease by 500"
                onClick={() => handleQtyChange(-500)}
              >−500</button>
              <input
                type="number"
                inputMode="numeric"
                aria-label="Quantity"
                className="flex-1 min-w-0 h-12 glass-surface-light rounded-xl text-center text-clay-50 placeholder:text-clay-400/60 figure focus:outline-none focus:ring-2 focus:ring-ember-500/50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
              <button 
                className="w-16 h-12 rounded-xl glass-surface-light flex items-center justify-center text-xs font-semibold text-clay-100 active:scale-95 transition-transform touch-manipulation"
                type="button"
                aria-label="Increase by 500"
                onClick={() => handleQtyChange(500)}
              >+500</button>
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

        <div>
          <GlassInput
            label="Amount Paid Now"
            type="number"
            inputMode="decimal"
            prefix="₹"
            placeholder="0 for full credit"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
          />
          {totalAmount > 0 && (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setAmountPaid(String(totalAmount))}
                className="flex-1 h-9 rounded-xl glass-surface-light text-xs font-semibold text-ledger-paid touch-manipulation"
              >
                Paid in full
              </button>
              <button
                type="button"
                onClick={() => setAmountPaid('')}
                className="flex-1 h-9 rounded-xl glass-surface-light text-xs font-semibold text-ledger-credit touch-manipulation"
              >
                Full credit
              </button>
            </div>
          )}
        </div>

        {paidNum > 0 && (
          <GlassToggleGroup
            label="Paid By"
            value={paymentChannel}
            onChange={setPaymentChannel}
            options={[
              { value: 'cash', label: 'Cash', icon: Banknote },
              { value: 'upi', label: 'UPI', icon: Smartphone },
              { value: 'bank', label: 'Bank', icon: Landmark },
            ]}
          />
        )}

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

        <div className="grid grid-cols-2 gap-2">
          <GlassButton fullWidth variant="glass" onClick={() => handleSubmit(false)} disabled={submitting} icon={Receipt}>
            {submitting ? 'Saving…' : editSale ? 'Update' : 'Save'}
          </GlassButton>
          <GlassButton
            fullWidth
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            icon={Send}
            className="!from-[#25D366] !to-[#1FAF54] !border-[#25D366]/40 !shadow-none"
          >
            Save & Bill
          </GlassButton>
        </div>
      </div>
    </BottomSheet>
  );
}
