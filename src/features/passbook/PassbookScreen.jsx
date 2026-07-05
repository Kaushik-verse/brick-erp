import { useState, useMemo } from 'react';
import { BookOpen, Search, Filter, Download, ArrowUpRight, ArrowDownRight, Activity, Plus } from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import BottomSheet from '../../core/ui/BottomSheet';
import { GlassInput, GlassToggleGroup } from '../../core/ui/GlassFormControls';
import { usePassbook } from '../../core/hooks/usePassbook';
import { formatINR, formatDateDisplay, todayISO } from '../../core/utils/format';
import { db } from '../../core/db/schema';
import { useUIStore } from '../../core/store/uiStore';
import { hapticTap } from '../../core/utils/nativeFileBridge';

export default function PassbookScreen({ onBack }) {
  const pushToast = useUIStore(s => s.pushToast);
  const rawEntries = usePassbook();
  
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'cash', 'bank', 'upi', 'credit', 'cheque'
  const [filterType, setFilterType] = useState('All');
  
  // Date filtering
  const [dateRange, setDateRange] = useState('This Month');
  const [customStart, setCustomStart] = useState(todayISO().slice(0,8)+'01');
  const [customEnd, setCustomEnd] = useState(todayISO());

  const [selectedEntry, setSelectedEntry] = useState(null);
  const [addEntryOpen, setAddEntryOpen] = useState(false);

  const filteredEntries = useMemo(() => {
    if (!rawEntries) return [];
    
    // 1. Date Filter
    let startDate = '1970-01-01';
    let endDate = '2099-12-31';
    
    const today = new Date();
    if (dateRange === 'Today') {
      startDate = todayISO();
      endDate = todayISO();
    } else if (dateRange === 'Yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      startDate = y.toISOString().slice(0, 10);
      endDate = startDate;
    } else if (dateRange === 'This Week') {
      const w = new Date(today);
      w.setDate(w.getDate() - w.getDay());
      startDate = w.toISOString().slice(0, 10);
      endDate = todayISO();
    } else if (dateRange === 'This Month') {
      startDate = todayISO().slice(0, 8) + '01';
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    } else if (dateRange === 'Last Month') {
      const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      startDate = lm.toISOString().slice(0, 10);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);
    } else if (dateRange === 'Custom') {
      startDate = customStart;
      endDate = customEnd;
    }

    let result = rawEntries.filter(e => e.date >= startDate && e.date <= endDate);

    // 2. Mode Filter
    if (filterMode !== 'all') {
      if (filterMode === 'bank') {
        result = result.filter(e => e.paymentMode === 'bank' || e.paymentMode === 'upi' || e.paymentMode === 'cheque' || e.paymentMode === 'transfer');
      } else {
        result = result.filter(e => e.paymentMode === filterMode);
      }
    }

    // 3. Type Filter
    if (filterType !== 'All') {
      if (filterType === 'Sales') result = result.filter(e => e.type === 'Sale');
      if (filterType === 'Purchases') result = result.filter(e => e.type === 'Purchase');
      if (filterType === 'Expenses') result = result.filter(e => e.type === 'Expense');
      if (filterType === 'Customer Payments') result = result.filter(e => e.type === 'Customer Payment');
      if (filterType === 'Supplier Payments') result = result.filter(e => e.type === 'Supplier Payment');
      if (filterType === 'Transfers') result = result.filter(e => e.type.includes('Transfer'));
      if (filterType === 'Opening Balance') result = result.filter(e => e.type.includes('Opening'));
    }

    // 4. Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e => 
        e.partyName.toLowerCase().includes(q) || 
        e.description.toLowerCase().includes(q) ||
        e.remarks.toLowerCase().includes(q) ||
        (e.refNo && e.refNo.toLowerCase().includes(q))
      );
    }

    return result;
  }, [rawEntries, search, filterMode, filterType, dateRange, customStart, customEnd]);

  // Summaries
  const summaries = useMemo(() => {
    if (filteredEntries.length === 0) return null;
    // Entries are sorted newest first, so the last element is the oldest in this filtered view
    const oldest = filteredEntries[filteredEntries.length - 1];
    const newest = filteredEntries[0];

    const openingCash = oldest.runningCash - oldest.cashIn + oldest.cashOut;
    const openingBank = oldest.runningBank - oldest.bankIn + oldest.bankOut;

    const closingCash = newest.runningCash;
    const closingBank = newest.runningBank;

    const cashIn = filteredEntries.reduce((s, e) => s + e.cashIn, 0);
    const cashOut = filteredEntries.reduce((s, e) => s + e.cashOut, 0);
    const bankIn = filteredEntries.reduce((s, e) => s + e.bankIn, 0);
    const bankOut = filteredEntries.reduce((s, e) => s + e.bankOut, 0);

    return {
      openingCash, closingCash, cashIn, cashOut,
      openingBank, closingBank, bankIn, bankOut
    };
  }, [filteredEntries]);

  const handleExportCSV = async () => {
    if (!filteredEntries.length) return;
    const header = "Date,Type,Party,Description,Mode,Cash In,Cash Out,Bank In,Bank Out,Running Balance,Ref\n";
    const rows = filteredEntries.map(e => 
      `"${e.date}","${e.type}","${e.partyName}","${e.description}","${e.paymentMode}",${e.cashIn},${e.cashOut},${e.bankIn},${e.bankOut},${e.runningBalance},"${e.refNo}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DayBook_${todayISO()}.csv`;
    a.click();
    pushToast("Exported to CSV", "success");
  };

  return (
    <div className="pb-32">
      <ScreenHeader
        onBack={onBack}
        eyebrow="Single Source of Truth"
        title="Day Book"
        action={
          <div className="flex gap-2">
            <GlassButton size="sm" icon={Download} onClick={handleExportCSV}>CSV</GlassButton>
            <GlassButton size="sm" icon={Plus} onClick={() => setAddEntryOpen(true)}>Add</GlassButton>
          </div>
        }
      />

      <div className="px-5 space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {['Today', 'Yesterday', 'This Week', 'This Month', 'Last Month', 'Custom'].map(d => (
              <button
                key={d}
                onClick={() => setDateRange(d)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  dateRange === d ? 'bg-ember-500 border-ember-500 text-white' : 'bg-kiln-800 border-kiln-700 text-clay-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {dateRange === 'Custom' && (
            <div className="flex gap-2">
              <GlassInput type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <GlassInput type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1">
              <GlassInput 
                placeholder="Search party, remarks, invoice..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                icon={Search}
              />
            </div>
            <select 
              value={filterMode} 
              onChange={e => setFilterMode(e.target.value)}
              className="bg-kiln-800 border border-kiln-700 text-clay-100 text-xs rounded-xl px-2 outline-none focus:ring-2 focus:ring-ember-500"
            >
              <option value="all">All Modes</option>
              <option value="cash">Cash Only</option>
              <option value="bank">Bank/UPI Only</option>
              <option value="credit">Credit Only</option>
            </select>
          </div>
        </div>

        {/* Statement Summary */}
        {summaries && (
          <GlassCard padding="p-4" className="bg-kiln-800/80 border-white/5">
            <h3 className="text-xs font-bold text-clay-300 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Account Summary</h3>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="text-clay-500 uppercase tracking-wider text-[10px]">
                    <th className="pb-2 font-medium">Account</th>
                    <th className="pb-2 font-medium text-right">Opening</th>
                    <th className="pb-2 font-medium text-right">Deposits</th>
                    <th className="pb-2 font-medium text-right">Withdrawals</th>
                    <th className="pb-2 font-medium text-right">Closing</th>
                  </tr>
                </thead>
                <tbody className="text-clay-100 divide-y divide-white/5">
                  <tr>
                    <td className="py-2.5 text-clay-400">Cash</td>
                    <td className="py-2.5 text-right">{formatINR(summaries.openingCash)}</td>
                    <td className="py-2.5 text-right text-emerald-400">{formatINR(summaries.cashIn)}</td>
                    <td className="py-2.5 text-right text-red-400">{formatINR(summaries.cashOut)}</td>
                    <td className="py-2.5 text-right font-semibold">{formatINR(summaries.closingCash)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 text-clay-400">Bank</td>
                    <td className="py-2.5 text-right">{formatINR(summaries.openingBank)}</td>
                    <td className="py-2.5 text-right text-blue-400">{formatINR(summaries.bankIn)}</td>
                    <td className="py-2.5 text-right text-red-400">{formatINR(summaries.bankOut)}</td>
                    <td className="py-2.5 text-right font-semibold">{formatINR(summaries.closingBank)}</td>
                  </tr>
                  <tr className="bg-white/5 font-bold">
                    <td className="py-2.5 px-2 text-clay-50 rounded-l-md">Total</td>
                    <td className="py-2.5 px-2 text-right">{formatINR(summaries.openingCash + summaries.openingBank)}</td>
                    <td className="py-2.5 px-2 text-right text-emerald-400">{formatINR(summaries.cashIn + summaries.bankIn)}</td>
                    <td className="py-2.5 px-2 text-right text-red-400">{formatINR(summaries.cashOut + summaries.bankOut)}</td>
                    <td className="py-2.5 px-2 text-right text-clay-50 rounded-r-md">{formatINR(summaries.closingCash + summaries.closingBank)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}

        {/* Ledger Table */}
        <div className="pt-2">
          {!rawEntries ? (
            <p className="text-center text-sm text-clay-400 py-8">Loading statement...</p>
          ) : filteredEntries.length === 0 ? (
            <p className="text-center text-sm text-clay-400 py-8">No transactions found for this period.</p>
          ) : (
            <div className="bg-kiln-800/80 rounded-2xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs whitespace-nowrap min-w-[500px]">
                  <thead className="bg-kiln-900/50">
                    <tr className="text-clay-500 uppercase tracking-widest text-[10px]">
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold">Particulars</th>
                      <th className="py-3 px-4 font-semibold text-right">Debit (-)</th>
                      <th className="py-3 px-4 font-semibold text-right">Credit (+)</th>
                      <th className="py-3 px-4 font-semibold text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-clay-100">
                    {filteredEntries.map((e, idx) => {
                      const amountIn = e.cashIn + e.bankIn;
                      const amountOut = e.cashOut + e.bankOut;
                      
                      return (
                        <tr 
                          key={e.id} 
                          onClick={() => setSelectedEntry(e)}
                          className="hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 text-[11px] text-clay-400">
                            {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-clay-50 truncate max-w-[150px]">{e.partyName}</p>
                            <p className="text-[9px] text-clay-500 uppercase tracking-wider mt-0.5">{e.paymentMode}</p>
                          </td>
                          <td className="py-3 px-4 text-right text-red-400 font-medium">
                            {amountOut > 0 ? formatINR(amountOut) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-400 font-medium">
                            {amountIn > 0 ? formatINR(amountIn) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-clay-100">
                            {formatINR(e.runningBalance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedEntry && (
        <BottomSheet open={!!selectedEntry} onClose={() => setSelectedEntry(null)} title="Transaction Details">
          <div className="space-y-4 pb-8">
             <div className="flex justify-center py-4">
                <div className="text-center">
                  <p className="text-sm font-semibold text-clay-400 uppercase tracking-widest mb-1">{selectedEntry.type}</p>
                  <p className="text-3xl font-bold text-clay-50">
                    {formatINR(selectedEntry.cashIn + selectedEntry.bankIn || selectedEntry.cashOut + selectedEntry.bankOut)}
                  </p>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-y-4 text-sm bg-kiln-800 p-4 rounded-2xl">
                <div><span className="block text-[10px] text-clay-400 uppercase">Date</span><span className="font-semibold text-clay-50">{formatDateDisplay(selectedEntry.date)}</span></div>
                <div><span className="block text-[10px] text-clay-400 uppercase">Party</span><span className="font-semibold text-clay-50">{selectedEntry.partyName}</span></div>
                <div><span className="block text-[10px] text-clay-400 uppercase">Payment Mode</span><span className="font-semibold text-clay-50 capitalize">{selectedEntry.paymentMode}</span></div>
                <div><span className="block text-[10px] text-clay-400 uppercase">Source</span><span className="font-semibold text-clay-50">{selectedEntry.sourceModule}</span></div>
                <div className="col-span-2"><span className="block text-[10px] text-clay-400 uppercase">Description</span><span className="font-medium text-clay-300">{selectedEntry.description}</span></div>
                {selectedEntry.remarks && <div className="col-span-2"><span className="block text-[10px] text-clay-400 uppercase">Remarks</span><span className="font-medium text-clay-300">{selectedEntry.remarks}</span></div>}
                {selectedEntry.refNo && <div className="col-span-2"><span className="block text-[10px] text-clay-400 uppercase">Reference No</span><span className="font-medium text-clay-300">{selectedEntry.refNo}</span></div>}
             </div>

             <div className="bg-emerald-500/10 p-3 rounded-xl">
               <p className="text-xs font-bold text-emerald-400 text-center">Running Balance after transaction: {formatINR(selectedEntry.runningBalance)}</p>
             </div>
          </div>
        </BottomSheet>
      )}

      <AddManualEntrySheet open={addEntryOpen} onClose={() => setAddEntryOpen(false)} />
    </div>
  );
}

function AddManualEntrySheet({ open, onClose }) {
  const pushToast = useUIStore(s => s.pushToast);
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState('Cash Deposit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  
  const types = [
    'Opening Balance - Cash',
    'Opening Balance - Bank',
    'Cash Deposit',
    'Cash Withdrawal',
    'Bank Deposit',
    'Bank Withdrawal',
    'Cash to Bank Transfer',
    'Bank to Cash Transfer'
  ];

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      pushToast("Enter a valid amount", "error"); return;
    }
    
    let paymentChannel = 'cash';
    if (type.includes('Bank') && !type.includes('Transfer')) paymentChannel = 'bank';
    if (type.includes('Transfer')) paymentChannel = 'transfer';

    try {
      await db.manualTransactions.add({
        date,
        type,
        amount: amt,
        paymentChannel,
        note,
        createdAt: new Date().toISOString()
      });
      await hapticTap();
      pushToast("Manual entry added", "success");
      onClose();
      setAmount('');
      setNote('');
    } catch(e) {
      pushToast("Failed to add entry", "error");
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Manual Passbook Entry">
      <div className="space-y-4 pb-4">
        <GlassInput label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <div>
          <span className="block text-xs font-medium text-clay-400 mb-1.5 ml-1">Entry Type</span>
          <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-kiln-800 border border-kiln-700 text-clay-50 rounded-2xl h-12 px-4 outline-none text-sm font-medium">
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <GlassInput label="Amount (₹)" type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
        <GlassInput label="Note / Remarks" value={note} onChange={e => setNote(e.target.value)} />
        <GlassButton fullWidth onClick={handleSave}>Save Entry</GlassButton>
      </div>
    </BottomSheet>
  );
}
