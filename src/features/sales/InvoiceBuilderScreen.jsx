import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Save, Send, Printer, UserPlus, Banknote, Landmark, Smartphone, FileCheck2 } from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput, GlassSelect, GlassToggleGroup } from '../../core/ui/GlassFormControls';
import { db } from '../../core/db/schema';
import { useCustomers, useFinishedStock } from '../../core/hooks/useDexieHooks';
import { useUIStore } from '../../core/store/uiStore';
import { todayISO, formatINR, formatNumber } from '../../core/utils/format';
import { hapticTap } from '../../core/utils/nativeFileBridge';
import { recordSale } from '../../core/db/ledgerEngine';
import { computeInvoiceTotals } from '../../core/billing/invoiceMath';
import { loadBillingProfile, isInterState } from '../../core/billing/profile';
import { nextInvoiceNumber } from '../../core/billing/invoiceNumber';

let rowSeq = 1;
const newRow = (description = '', rate = '') => ({ key: rowSeq++, description, quantity: '', rate });

/**
 * InvoiceBuilderScreen
 * ---------------------
 * Multi-product GST-ready invoice. Totals use the same calculation as the
 * PDF (invoiceMath), so what you see here is exactly what gets printed.
 */
export default function InvoiceBuilderScreen({ onBack }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const setInvoiceBuilderData = useUIStore((s) => s.setInvoiceBuilderData);
  const customers = useCustomers();
  const finishedStock = useFinishedStock();
  const products = (finishedStock || []).filter((f) => f.isActive !== 0);

  const [profile, setProfile] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [previewNumber, setPreviewNumber] = useState('');

  const [customerId, setCustomerId] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const [rows, setRows] = useState([newRow()]);
  const [transport, setTransport] = useState('');
  const [loading, setLoading] = useState('');
  const [unloading, setUnloading] = useState('');
  const [other, setOther] = useState('');

  const [amountPaid, setAmountPaid] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('cash');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBillingProfile().then(setProfile).catch(() => {});
    // Clear any legacy hand-off data from older app versions.
    setInvoiceBuilderData(null);
  }, [setInvoiceBuilderData]);

  useEffect(() => {
    nextInvoiceNumber(date).then(setPreviewNumber).catch(() => setPreviewNumber(''));
  }, [date]);

  const customer = (customers || []).find((c) => String(c.id) === String(customerId));
  const inv = profile?.invoice;

  const totals = useMemo(
    () =>
      computeInvoiceTotals({
        items: rows
          .filter((r) => r.description.trim() || Number(r.quantity) > 0)
          .map((r) => ({ description: r.description.trim(), quantity: r.quantity, rate: r.rate })),
        charges: { transport, loading, unloading, other },
        gstMode: inv?.gstMode || 'none',
        gstRate: inv?.gstRate || 0,
        interState: profile ? isInterState(profile, customer) : false,
      }),
    [rows, transport, loading, unloading, other, inv, profile, customer]
  );
  const taxed = totals.gstMode !== 'none' && totals.gstRate > 0;
  const paid = Number(amountPaid) || 0;
  const balance = Math.round((totals.grandTotal - paid) * 100) / 100;

  const updateRow = (key, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, [field]: value };
        // Fill the selling price when a known product is chosen.
        if (field === 'description') {
          const p = products.find((x) => x.brickSize === value);
          if (p && (!r.rate || r.description !== value)) next.rate = String(p.sellingPrice ?? '');
        }
        return next;
      })
    );
  };

  const stockWarnings = useMemo(() => {
    const need = {};
    for (const r of rows) if (r.description) need[r.description] = (need[r.description] || 0) + (Number(r.quantity) || 0);
    return Object.entries(need)
      .map(([d, q]) => {
        const p = products.find((x) => x.brickSize === d);
        return p && q > (p.currentStock || 0) ? `${d}: need ${formatNumber(q)}, only ${formatNumber(p.currentStock)} in stock` : null;
      })
      .filter(Boolean);
  }, [rows, products]);

  const handleCreateCustomer = async () => {
    const name = newName.trim();
    if (!name) return;
    const existing = await db.customers.where('name').equalsIgnoreCase(name).first();
    const id = existing
      ? existing.id
      : await db.customers.add({
          name,
          phone: newPhone.trim(),
          address: newAddress.trim(),
          outstandingBalance: 0,
          createdAt: new Date().toISOString(),
        });
    setCustomerId(String(id));
    setShowNewCustomer(false);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
    if (existing) pushToast(`${existing.name} already exists — selected`, 'info');
  };

  const validate = () => {
    if (!customerId) return 'Select or add a customer.';
    const used = rows.filter((r) => r.description.trim() || Number(r.quantity) > 0);
    if (!used.length) return 'Add at least one product.';
    if (used.some((r) => !r.description.trim() || !(Number(r.quantity) > 0) || !(Number(r.rate) > 0)))
      return 'Every product row needs a name, quantity and rate — or remove the empty row.';
    if (paid < 0 || paid > totals.grandTotal + 0.009) return 'Amount received cannot be more than the grand total.';
    return null;
  };

  const handleSave = async (mode) => {
    if (saving) return;
    const err = validate();
    if (err) {
      pushToast(err, 'error');
      return;
    }
    if (stockWarnings.length && !window.confirm(`Not enough stock:\n${stockWarnings.join('\n')}\n\nSave anyway? Stock will go below zero.`)) return;

    setSaving(true);
    try {
      const unit = inv?.unit || 'Nos';
      const hsn = inv?.hsn || '';
      const res = await recordSale({
        date,
        customerId: Number(customerId),
        items: totals.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          rate: l.rate,
          amount: l.amount,
          unit,
          hsn,
        })),
        totalAmount: totals.grandTotal,
        amountPaid: paid,
        paymentChannel: paid > 0 ? paymentChannel : 'credit',
        charges: {
          transport: Number(transport) || 0,
          loading: Number(loading) || 0,
          unloading: Number(unloading) || 0,
          other: Number(other) || 0,
        },
        tax: {
          gstMode: totals.gstMode,
          gstRate: totals.gstRate,
          interState: totals.interState,
          taxableValue: totals.taxableValue,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          totalTax: totals.totalTax,
          roundOff: totals.roundOff,
        },
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        remarks: remarks.trim(),
      });
      await hapticTap();
      pushToast(`Invoice ${res.invoiceNumber} saved`, 'success');

      if (mode !== 'save') {
        try {
          const { shareSaleInvoice } = await import('../../core/billing/documents');
          await shareSaleInvoice(res.id, { share: mode === 'share' });
        } catch (e) {
          console.error(e);
          pushToast('Saved, but the PDF could not be shared. Share it from the customer ledger.', 'error');
        }
      }
      onBack();
    } catch (e) {
      console.error(e);
      pushToast(e.message || 'Error saving invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  const chargeFields = [
    inv?.showTransport !== false && ['Transport', transport, setTransport],
    inv?.showLoading !== false && ['Loading', loading, setLoading],
    inv?.showUnloading !== false && ['Unloading', unloading, setUnloading],
    inv?.showOtherCharges !== false && ['Other', other, setOther],
  ].filter(Boolean);

  return (
    <div className="pb-56 md:pb-40 md:pt-6">
      <ScreenHeader
        onBack={onBack}
        eyebrow={taxed ? 'Tax Invoice' : 'Invoice'}
        title="New Invoice"
        subtitle={previewNumber ? `No. ${previewNumber}` : undefined}
      />

      <div className="px-5 md:px-8 space-y-4 max-w-3xl mx-auto">
        {/* Customer & date */}
        <GlassCard padding="p-4 space-y-3">
          <GlassInput label="Invoice Date" type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          {!showNewCustomer ? (
            <div>
              <GlassSelect label="Bill To" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select customer…</option>
                {(customers || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </option>
                ))}
              </GlassSelect>
              <div className="flex items-center justify-between mt-2 px-1">
                <button
                  onClick={() => setShowNewCustomer(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-ember-400 touch-manipulation"
                >
                  <UserPlus size={13} /> New customer
                </button>
                {customer && (customer.outstandingBalance || 0) > 0 && (
                  <span className="text-[11px] text-ledger-overdue">Previous due {formatINR(customer.outstandingBalance)}</span>
                )}
              </div>
              {customer && !customer.address && (
                <p className="text-[11px] text-clay-500 mt-1 px-1">Tip: add the customer’s address in their ledger (Edit) so it prints on the bill.</p>
              )}
            </div>
          ) : (
            <div className="glass-surface-light rounded-2xl p-3.5 space-y-3">
              <GlassInput label="Customer Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <GlassInput label="Phone" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              <GlassInput label="Address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Village / Town" />
              <div className="flex gap-2">
                <GlassButton size="sm" variant="glass" fullWidth onClick={() => setShowNewCustomer(false)}>
                  Cancel
                </GlassButton>
                <GlassButton size="sm" fullWidth onClick={handleCreateCustomer}>
                  Save & Select
                </GlassButton>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Items */}
        <GlassCard padding="p-4">
          <h3 className="text-xs font-semibold text-clay-300 uppercase tracking-wide mb-3">Products</h3>
          <datalist id="invoice-products">
            {products.map((p) => (
              <option key={p.id} value={p.brickSize} />
            ))}
          </datalist>
          <div className="space-y-3">
            {rows.map((r, i) => {
              const amount = (Number(r.quantity) || 0) * (Number(r.rate) || 0);
              return (
                <div key={r.key} className="glass-surface-light rounded-2xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-clay-400">Item {i + 1}</span>
                    {rows.length > 1 && (
                      <button
                        onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                        aria-label={`Remove item ${i + 1}`}
                        className="p-1.5 -m-1.5 text-clay-500 hover:text-ledger-overdue touch-manipulation"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <GlassInput
                    list="invoice-products"
                    placeholder="Product (e.g. 4-inch)"
                    value={r.description}
                    onChange={(e) => updateRow(r.key, 'description', e.target.value)}
                    aria-label="Product"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <GlassInput
                      label={`Qty (${inv?.unit || 'Nos'})`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={r.quantity}
                      onChange={(e) => updateRow(r.key, 'quantity', e.target.value)}
                    />
                    <GlassInput
                      label={taxed && totals.gstMode === 'exclusive' ? 'Rate (before GST)' : 'Rate'}
                      type="number"
                      inputMode="decimal"
                      prefix="₹"
                      min="0"
                      value={r.rate}
                      onChange={(e) => updateRow(r.key, 'rate', e.target.value)}
                    />
                  </div>
                  {amount > 0 && (
                    <p className="text-right text-xs text-clay-400">
                      Amount <span className="figure font-semibold text-clay-100">{formatINR(amount, { decimals: 2 })}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setRows((prev) => [...prev, newRow()])}
            className="mt-3 w-full h-11 rounded-xl border border-dashed border-glass-border text-ember-400 text-sm font-semibold flex items-center justify-center gap-1.5 touch-manipulation"
          >
            <Plus size={15} /> Add another product
          </button>
          {stockWarnings.length > 0 && (
            <div className="mt-3 rounded-xl p-3 bg-ledger-partial/10 border border-ledger-partial/30 text-xs text-ledger-partial space-y-0.5">
              {stockWarnings.map((w) => (
                <p key={w}>Low stock — {w}</p>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Charges */}
        {chargeFields.length > 0 && (
          <GlassCard padding="p-4">
            <h3 className="text-xs font-semibold text-clay-300 uppercase tracking-wide mb-3">Extra Charges</h3>
            <div className="grid grid-cols-2 gap-3">
              {chargeFields.map(([label, value, set]) => (
                <GlassInput key={label} label={label} type="number" inputMode="decimal" prefix="₹" min="0" value={value} onChange={(e) => set(e.target.value)} />
              ))}
            </div>
          </GlassCard>
        )}

        {/* Totals */}
        <GlassCard padding="p-4">
          <div className="space-y-1.5 text-sm">
            <Row label="Goods value" value={totals.itemsTotal} />
            {totals.charges.map((c) => (
              <Row key={c.label} label={c.label} value={c.amount} />
            ))}
            {taxed && (
              <>
                <Row label="Taxable value" value={totals.taxableValue} />
                {totals.interState ? (
                  <Row label={`IGST @ ${totals.gstRate}%`} value={totals.igst} />
                ) : (
                  <>
                    <Row label={`CGST @ ${totals.gstRate / 2}%`} value={totals.cgst} />
                    <Row label={`SGST @ ${totals.gstRate / 2}%`} value={totals.sgst} />
                  </>
                )}
              </>
            )}
            {Math.abs(totals.roundOff) >= 0.005 && <Row label="Round off" value={totals.roundOff} />}
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 flex items-end justify-between">
            <span className="text-xs font-semibold text-clay-300 uppercase tracking-wide">Grand Total</span>
            <span className="figure text-2xl font-bold text-ember-400">{formatINR(totals.grandTotal)}</span>
          </div>
          {!taxed && (
            <p className="text-[11px] text-clay-500 mt-2">GST is off. Turn it on in More → Invoice Design if you bill with GST.</p>
          )}
        </GlassCard>

        {/* Payment */}
        <GlassCard padding="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-clay-300 uppercase tracking-wide">Payment Received Now</h3>
          <GlassInput
            type="number"
            inputMode="decimal"
            prefix="₹"
            placeholder="0 for full credit"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            aria-label="Amount received"
          />
          {totals.grandTotal > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAmountPaid(String(totals.grandTotal))}
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
          {paid > 0 && (
            <GlassToggleGroup
              value={paymentChannel}
              onChange={setPaymentChannel}
              options={[
                { value: 'cash', label: 'Cash', icon: Banknote },
                { value: 'upi', label: 'UPI', icon: Smartphone },
                { value: 'bank', label: 'Bank', icon: Landmark },
                { value: 'cheque', label: 'Cheque', icon: FileCheck2 },
              ]}
            />
          )}
          <div className="flex justify-between text-sm pt-1">
            <span className="text-clay-400">Balance due on this bill</span>
            <span className={`figure font-bold ${balance > 0 ? 'text-ledger-overdue' : 'text-ledger-paid'}`}>{formatINR(balance, { decimals: 2 })}</span>
          </div>
        </GlassCard>

        {/* Delivery */}
        <GlassCard padding="p-4 space-y-3">
          {inv?.showVehicleNumber !== false && (
            <GlassInput label="Vehicle Number" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="AP 37 AB 1234" />
          )}
          <GlassInput label="Remarks (printed on bill)" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
        </GlassCard>
      </div>

      {/* Action bar */}
      <div className="fixed bottom-[88px] md:bottom-0 left-0 md:left-64 right-0 z-30 px-4 py-3 sheet-surface border-t border-white/10">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-2">
          <GlassButton size="sm" variant="glass" icon={Save} onClick={() => handleSave('save')} disabled={saving}>
            Save
          </GlassButton>
          <GlassButton size="sm" variant="glass" icon={Printer} onClick={() => handleSave('print')} disabled={saving}>
            PDF
          </GlassButton>
          <GlassButton
            size="sm"
            icon={Send}
            onClick={() => handleSave('share')}
            disabled={saving}
            className="!from-[#25D366] !to-[#1FAF54] !border-[#25D366]/40 !shadow-none"
          >
            Share
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-clay-400">{label}</span>
      <span className="figure text-clay-100">{formatINR(value, { decimals: 2 })}</span>
    </div>
  );
}
