import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Save, Send, Printer, UserPlus } from 'lucide-react';
import { db } from '../../core/db/schema';
import { useCustomers, useFinishedStock, useInvoiceSettings } from '../../core/hooks/useDexieHooks';
import { useUIStore } from '../../core/store/uiStore';
import { todayISO, formatINR } from '../../core/utils/format';
import { generateInvoicePDF } from '../documents/pdfExport';
import { hapticTap, saveAndShareBlob } from '../../core/utils/nativeFileBridge';
import { openWhatsAppLink } from '../../core/utils/whatsapp';

export default function InvoiceBuilderScreen({ onBack, prefillCustomer = null }) {
  const pushToast = useUIStore(s => s.pushToast);
  const customers = useCustomers();
  const finishedStock = useFinishedStock();
  const settings = useInvoiceSettings();

  // ----- INVOICE STATE -----
  const [date, setDate] = useState(todayISO());
  const [customerId, setCustomerId] = useState(prefillCustomer || '');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [salesPerson, setSalesPerson] = useState('');
  const [remarks, setRemarks] = useState('');

  // Dynamic Products Table
  const [items, setItems] = useState([
    { id: Date.now().toString(), description: '', quantity: '', rate: '', amount: 0 }
  ]);

  // Charges
  const [transport, setTransport] = useState('');
  const [loading, setLoading] = useState('');
  const [unloading, setUnloading] = useState('');
  const [otherCharges, setOtherCharges] = useState('');
  
  // Discount & GST
  const [discountType, setDiscountType] = useState('flat'); // flat, percent
  const [discountValue, setDiscountValue] = useState('');
  const [gstPercent, setGstPercent] = useState('');

  // Payment
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('cash');

  const [saving, setSaving] = useState(false);

  // ----- CALCULATIONS -----
  const subtotal = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const discVal = Number(discountValue) || 0;
  const discountAmount = discountType === 'percent' ? (subtotal * discVal) / 100 : discVal;
  
  const extraCharges = (Number(transport) || 0) + (Number(loading) || 0) + (Number(unloading) || 0) + (Number(otherCharges) || 0);
  const taxableAmount = subtotal - discountAmount + extraCharges;
  
  const gstAmount = (taxableAmount * (Number(gstPercent) || 0)) / 100;
  const grandTotal = taxableAmount + gstAmount;
  
  const paid = Number(amountPaid) || 0;
  const balanceDue = grandTotal - paid;
  
  let paymentStatus = 'pending';
  if (paid > 0 && paid < grandTotal) paymentStatus = 'partial';
  if (paid >= grandTotal && grandTotal > 0) paymentStatus = 'paid';

  // ----- HANDLERS -----
  const handleAddItem = () => {
    setItems([...items, { id: Date.now().toString(), description: '', quantity: '', rate: '', amount: 0 }]);
  };

  const handleRemoveItem = (id) => {
    if (items.length === 1) return;
    setItems(items.filter(it => it.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, [field]: value };
      
      // Auto-fill rate if selecting a product
      if (field === 'description' && finishedStock) {
        const stock = finishedStock.find(s => s.brickSize === value);
        if (stock) {
          updated.rate = String(stock.sellingPrice || '');
        }
      }

      // Auto-calc amount
      const q = Number(updated.quantity) || 0;
      const r = Number(updated.rate) || 0;
      updated.amount = q * r;
      return updated;
    }));
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
  };

  const generateInvNum = async () => {
    // Generate a simple auto-incrementing invoice number based on today's sales count
    const today = new Date().toISOString().slice(0, 10);
    const count = await db.salesLog.where('date').equals(today).count();
    return `INV-${today.replace(/-/g, '')}-${String(count + 1).padStart(3, '0')}`;
  };

  const handleSaveInvoice = async (andPrint = false, andShare = false) => {
    if (!customerId) { pushToast('Please select a customer', 'error'); return; }
    if (items.some(i => !i.description || !i.quantity || !i.rate)) {
      pushToast('Please complete all product rows', 'error'); return;
    }

    setSaving(true);
    try {
      const invNum = await generateInvNum();
      
      // Create a sale record
      // Note: We use the existing recordSale function but we must pass multiple items
      // The current ledgerEngine deducts stock for single items.
      // For this upgrade, we will update ledgerEngine later. For now, we save it.
      
      const payload = {
        invoiceNumber: invNum,
        date,
        customerId: Number(customerId),
        items: items.map(i => ({
          description: i.description,
          quantity: Number(i.quantity) || 0,
          rate: Number(i.rate) || 0,
          amount: Number(i.amount) || 0
        })),
        subtotal,
        discount: discountAmount,
        discountType,
        transportCharges: Number(transport) || 0,
        loadingCharges: Number(loading) || 0,
        unloadingCharges: Number(unloading) || 0,
        otherCharges: Number(otherCharges) || 0,
        cgst: gstAmount / 2,
        sgst: gstAmount / 2,
        igst: 0,
        totalAmount: grandTotal,
        amountPaid: paid,
        balanceDue,
        paymentStatus,
        paymentChannel,
        vehicleNumber,
        driverName,
        salesPerson,
        remarks,
        createdAt: new Date().toISOString()
      };

      const saleId = await db.salesLog.add(payload);
      
      // Update customer balance manually since we bypassed recordSale
      const cust = await db.customers.get(Number(customerId));
      if (cust && balanceDue > 0) {
        await db.customers.update(cust.id, { outstandingBalance: (cust.outstandingBalance || 0) + balanceDue });
      }

      // Deduct stock for items that match finishedStock
      for (const item of payload.items) {
        const stockRow = await db.finishedStock.where('brickSize').equals(item.description).first();
        if (stockRow) {
          await db.finishedStock.update(stockRow.id, {
            currentStock: (stockRow.currentStock || 0) - item.quantity
          });
        }
      }

      await hapticTap();
      pushToast('Invoice saved successfully', 'success');

      // Setup payload for PDF/Share
      const factorySettings = {};
      const s = await db.settings.toArray();
      s.forEach(x => factorySettings[x.key] = x.value);
      
      const invoiceData = {
        invoice: { invoiceNumber: invNum, date },
        items: payload.items,
        summary: {
          subtotal, discount: discountAmount,
          transportCharges: payload.transportCharges,
          loadingCharges: payload.loadingCharges,
          unloadingCharges: payload.unloadingCharges,
          otherCharges: payload.otherCharges,
          cgst: payload.cgst, sgst: payload.sgst, igst: 0,
          grandTotal, amountPaid: paid, balanceDue, paymentStatus
        },
        customer: cust || { name: newCustomerName },
        vehicle: { vehicleNumber, driverName, salesPerson },
        factory: factorySettings,
        settings: settings
      };

      if (andPrint || andShare) {
        const pdfBlob = await generateInvoicePDF(invoiceData);
        
        if (andShare) {
          // Generate WhatsApp Text
          const text = `*INVOICE: ${invNum}*\n*Amount:* ₹${grandTotal.toLocaleString()}\n*Status:* ${paymentStatus.toUpperCase()}\n\nThank you for your business!`;
          
          if (Capacitor.isNativePlatform()) {
            await saveAndShareBlob(pdfBlob, `${invNum}.pdf`, 'application/pdf', text);
          } else {
            await openWhatsAppLink(`https://wa.me/?text=${encodeURIComponent(text)}`);
            const url = URL.createObjectURL(pdfBlob);
            window.open(url);
          }
        } else {
          const url = URL.createObjectURL(pdfBlob);
          window.open(url);
        }
      }

      onBack();

    } catch (e) {
      console.error(e);
      pushToast('Error saving invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ----- STYLED COMPONENTS -----
  const Label = ({ children }) => <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{children}</label>;
  const Input = (props) => <input {...props} className={`w-full bg-slate-100/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-[#C65D2E] focus:ring-1 focus:ring-[#C65D2E] transition-all placeholder:text-slate-400 ${props.className||''}`} />;
  const Select = (props) => <select {...props} className={`w-full bg-slate-100/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-[#C65D2E] focus:ring-1 focus:ring-[#C65D2E] appearance-none ${props.className||''}`}>{props.children}</select>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={onBack} className="p-2 rounded-full bg-slate-100 text-slate-600 active:scale-95 transition-transform">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-bold text-slate-800 text-lg leading-tight">Create Invoice</h1>
          <p className="text-xs text-slate-500 font-medium">Premium Billing Module</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        
        {/* CUSTOMER SECTION */}
        <div className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-slate-800">Customer Details</h2>
            <p className="text-xs font-semibold text-[#C65D2E]">{date}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!showNewCustomer ? (
              <div>
                <Label>Select Customer</Label>
                <div className="flex gap-2">
                  <Select value={customerId} onChange={e => setCustomerId(e.target.value)}>
                    <option value="">Choose customer...</option>
                    {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                  <button onClick={() => setShowNewCustomer(true)} className="px-3 rounded-lg bg-slate-100 text-[#C65D2E] flex items-center justify-center shrink-0 border border-slate-200"><UserPlus size={16}/></button>
                </div>
              </div>
            ) : (
              <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div><Label>New Customer Name</Label><Input value={newCustomerName} onChange={e=>setNewCustomerName(e.target.value)} placeholder="Full name"/></div>
                <div><Label>Phone Number</Label><Input value={newCustomerPhone} onChange={e=>setNewCustomerPhone(e.target.value)} type="tel" placeholder="10 digits"/></div>
                <div className="col-span-full flex gap-2 justify-end mt-1">
                  <button onClick={() => setShowNewCustomer(false)} className="px-4 py-1.5 text-xs font-bold text-slate-500">Cancel</button>
                  <button onClick={handleCreateCustomer} className="px-4 py-1.5 text-xs font-bold bg-[#C65D2E] text-white rounded-lg">Save & Select</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PRODUCT TABLE */}
        <div className="bg-white rounded-2xl p-0 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">Products</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  <th className="p-3 w-8">#</th>
                  <th className="p-3 min-w-[200px]">Product / Description</th>
                  <th className="p-3 w-24">Qty</th>
                  <th className="p-3 w-28">Rate (₹)</th>
                  <th className="p-3 w-32 text-right">Amount</th>
                  <th className="p-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0 group">
                    <td className="p-3 text-xs text-slate-400 font-medium">{idx + 1}</td>
                    <td className="p-3">
                      <Input 
                        list="products"
                        value={item.description} 
                        onChange={e => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Type or select..."
                        className="bg-transparent border-transparent hover:border-slate-200 focus:bg-white"
                      />
                      <datalist id="products">
                        {(finishedStock||[]).filter(s=>s.isActive).map(s => <option key={s.id} value={s.brickSize} />)}
                        <option value="Custom Item" />
                      </datalist>
                    </td>
                    <td className="p-3">
                      <Input type="number" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} className="bg-transparent border-transparent hover:border-slate-200 text-center focus:bg-white" placeholder="0" />
                    </td>
                    <td className="p-3">
                      <Input type="number" value={item.rate} onChange={e => updateItem(item.id, 'rate', e.target.value)} className="bg-transparent border-transparent hover:border-slate-200 text-right focus:bg-white" placeholder="0.0" />
                    </td>
                    <td className="p-3 text-right text-sm font-bold text-slate-700">
                      ₹{item.amount.toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleRemoveItem(item.id)} className="text-slate-300 hover:text-red-500 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-3 bg-slate-50 border-t border-slate-100">
            <button onClick={handleAddItem} className="flex items-center gap-2 text-[#C65D2E] text-xs font-bold px-3 py-2 hover:bg-[#C65D2E]/10 rounded-lg transition-colors">
              <Plus size={14}/> Add Product Row
            </button>
          </div>
        </div>

        {/* OPTIONAL CHARGES & SUMMARY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Left Column - Optional Fields */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100">
              <h2 className="text-sm font-bold text-slate-800 mb-3">Additional Details</h2>
              
              <div className="space-y-3">
                {settings?.showVehicleNumber === '1' && (
                  <div><Label>Vehicle Number</Label><Input value={vehicleNumber} onChange={e=>setVehicleNumber(e.target.value)} placeholder="AP 37..."/></div>
                )}
                {settings?.showDriverName === '1' && (
                  <div><Label>Driver Name</Label><Input value={driverName} onChange={e=>setDriverName(e.target.value)} placeholder="Driver Name"/></div>
                )}
                {settings?.showSalesPerson === '1' && (
                  <div><Label>Sales Person</Label><Input value={salesPerson} onChange={e=>setSalesPerson(e.target.value)} placeholder="Agent name"/></div>
                )}
                <div><Label>Remarks</Label><Input value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Any notes..."/></div>
              </div>
            </div>
          </div>

          {/* Right Column - Summary & Math */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex-1 space-y-3">
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Subtotal</span>
                <span className="font-bold text-slate-800">₹{subtotal.toLocaleString()}</span>
              </div>

              {settings?.showDiscount === '1' && (
                <div className="flex items-center gap-2">
                  <Select value={discountType} onChange={e=>setDiscountType(e.target.value)} className="!py-1 !text-xs w-28 !bg-slate-50">
                    <option value="flat">Flat ₹</option>
                    <option value="percent">Percent %</option>
                  </Select>
                  <Input type="number" value={discountValue} onChange={e=>setDiscountValue(e.target.value)} placeholder="Discount" className="!py-1 !text-xs text-right"/>
                  <span className="text-sm font-bold text-green-600 min-w-[80px] text-right">-{discountAmount.toLocaleString()}</span>
                </div>
              )}

              {settings?.showTransport === '1' && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm text-slate-500 flex-1">Transport Charges</span>
                  <Input type="number" value={transport} onChange={e=>setTransport(e.target.value)} placeholder="0" className="!py-1 !text-xs w-24 text-right"/>
                </div>
              )}
              {settings?.showLoading === '1' && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm text-slate-500 flex-1">Loading Charges</span>
                  <Input type="number" value={loading} onChange={e=>setLoading(e.target.value)} placeholder="0" className="!py-1 !text-xs w-24 text-right"/>
                </div>
              )}
              {settings?.showUnloading === '1' && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm text-slate-500 flex-1">Unloading Charges</span>
                  <Input type="number" value={unloading} onChange={e=>setUnloading(e.target.value)} placeholder="0" className="!py-1 !text-xs w-24 text-right"/>
                </div>
              )}
              {settings?.showOtherCharges === '1' && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm text-slate-500 flex-1">Other Charges</span>
                  <Input type="number" value={otherCharges} onChange={e=>setOtherCharges(e.target.value)} placeholder="0" className="!py-1 !text-xs w-24 text-right"/>
                </div>
              )}

              {settings?.showGST === '1' && (
                <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100">
                  <span className="text-sm text-slate-500">GST %</span>
                  <Input type="number" value={gstPercent} onChange={e=>setGstPercent(e.target.value)} placeholder="0" className="!py-1 !text-xs w-16 text-center"/>
                  <span className="text-sm font-bold text-slate-700 min-w-[80px] text-right">+₹{gstAmount.toLocaleString()}</span>
                </div>
              )}

            </div>
            
            <div className="bg-[#1E293B] p-4 text-white">
              <div className="flex justify-between items-end">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Grand Total</span>
                <span className="text-3xl font-bold">₹{grandTotal.toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
              </div>
            </div>

          </div>
        </div>

        {/* PAYMENT SECTION */}
        <div className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Payment Receipt</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount Paid Now</Label>
              <Input type="number" value={amountPaid} onChange={e=>setAmountPaid(e.target.value)} placeholder="₹0" className="!text-lg font-bold text-[#C65D2E]" />
            </div>
            <div>
              <Label>Payment Mode</Label>
              <Select value={paymentChannel} onChange={e=>setPaymentChannel(e.target.value)} className="!h-10">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="credit">Full Credit (Later)</option>
              </Select>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Status</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${paymentStatus === 'paid' ? 'bg-green-500' : paymentStatus === 'partial' ? 'bg-orange-500' : 'bg-red-500'}`} />
                <span className="text-sm font-bold text-slate-700 capitalize">{paymentStatus}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Balance Due</p>
              <span className={`text-sm font-bold ${balanceDue > 0 ? 'text-red-500' : 'text-slate-700'}`}>₹{balanceDue.toLocaleString()}</span>
            </div>
          </div>
        </div>

      </div>

      {/* FAB Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 flex gap-3 z-20">
        <button onClick={() => handleSaveInvoice(false, false)} disabled={saving} className="flex-1 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors">
          <Save size={18}/> {saving ? 'Saving...' : 'Save Only'}
        </button>
        <button onClick={() => handleSaveInvoice(true, false)} disabled={saving} className="flex-1 bg-slate-800 hover:bg-slate-900 active:bg-black text-white h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors">
          <Printer size={18}/> Save & Print
        </button>
        <button onClick={() => handleSaveInvoice(false, true)} disabled={saving} className="flex-1 bg-[#25D366] hover:bg-[#1DA851] active:bg-[#168840] text-white h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors">
          <Send size={18}/> Save & Share
        </button>
      </div>

    </div>
  );
}
