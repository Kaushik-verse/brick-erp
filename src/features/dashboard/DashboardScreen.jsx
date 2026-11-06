import { useState } from 'react';
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Wallet,
  Factory,
  AlertCircle,
  Package,
  Receipt,
  Fuel,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  HandCoins,
} from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import KpiCard from './KpiCard';
import ProductionMiniChart from './ProductionMiniChart';
import AgingAlertsWidget from './AgingAlertsWidget';
import AddSaleSheet from '../sales/AddSaleSheet';
import AddProductionSheet from '../production/AddProductionSheet';
import { AddExpenseSheet } from '../expenses/ExpensesScreen';
import { useDashboardKPIs, useFinishedStock } from '../../core/hooks/useDexieHooks';
import { useBackupStatus } from '../../core/backup/autoBackup';
import { monthRange, formatINR, formatNumber, todayISO, formatRelativeTime } from '../../core/utils/format';

const BACKUP_STALE_MS = 2 * 24 * 60 * 60 * 1000;

export default function DashboardScreen({ onNavigate, onOpenSubScreen }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [sheet, setSheet] = useState(null); // 'sale' | 'production' | 'expense'

  const now = new Date();
  const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const { start, end } = monthRange(monthDate);
  const today = todayISO();

  const kpis = useDashboardKPIs(start, end);
  const todayKpis = useDashboardKPIs(today, today);
  const finishedStock = useFinishedStock();
  const backup = useBackupStatus();

  const lastBackup = backup.lastLocalAt ? Date.parse(backup.lastLocalAt) : 0;
  const backupStale = !lastBackup || Date.now() - lastBackup > BACKUP_STALE_MS || !!backup.lastError;

  const monthLabel = monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const isCurrentMonth = monthOffset === 0;

  const stockData = (finishedStock || [])
    .filter((f) => f.isActive !== 0)
    .map((f) => ({ label: f.brickSize, value: f.currentStock || 0 }));

  const quickActions = [
    { key: 'sale', label: 'New Sale', icon: Receipt, onClick: () => setSheet('sale') },
    { key: 'payment', label: 'Payment In', icon: HandCoins, onClick: () => onNavigate?.('sales') },
    { key: 'production', label: 'Production', icon: Factory, onClick: () => setSheet('production') },
    { key: 'expense', label: 'Expense', icon: Fuel, onClick: () => setSheet('expense') },
    { key: 'invoice', label: 'Invoice', icon: FileText, onClick: () => onOpenSubScreen?.('invoice-builder') },
    { key: 'daybook', label: 'Day Book', icon: BookOpen, onClick: () => onOpenSubScreen?.('passbook') },
  ];

  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader eyebrow={isCurrentMonth ? 'This Month' : 'Past Month'} title="Factory Overview" />

      <div className="px-5 md:px-8 space-y-4 md:space-y-6 max-w-7xl mx-auto">
        {/* Backup health */}
        <button
          onClick={() => onOpenSubScreen?.('drive-sync')}
          className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left touch-manipulation border ${
            backupStale
              ? 'bg-ledger-partial/10 border-ledger-partial/30'
              : 'bg-ledger-paid/5 border-ledger-paid/15'
          }`}
        >
          {backupStale ? (
            <ShieldAlert size={18} className="text-ledger-partial shrink-0" />
          ) : (
            <ShieldCheck size={18} className="text-ledger-paid shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-clay-100">
              {backupStale ? 'Backup needs attention' : 'Data backed up'}
            </p>
            <p className="text-xs text-clay-400 truncate">
              {backup.lastError
                ? backup.lastError
                : lastBackup
                ? `Last backup ${formatRelativeTime(backup.lastLocalAt)}${backup.lastDriveAt ? ` · Drive ${formatRelativeTime(backup.lastDriveAt)}` : ''}`
                : 'Tap to set up backups'}
            </p>
          </div>
          <ChevronRight size={16} className="text-clay-500 shrink-0" />
        </button>

        {/* Quick actions */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
          {quickActions.map((a) => (
            <button
              key={a.key}
              onClick={a.onClick}
              className="glass-surface rounded-2xl py-3 flex flex-col items-center gap-1.5 touch-manipulation active:scale-95 transition-transform"
            >
              <span className="w-9 h-9 rounded-xl bg-ember-500/15 flex items-center justify-center">
                <a.icon size={17} className="text-ember-400" />
              </span>
              <span className="text-[11px] font-semibold text-clay-200">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Today */}
        {isCurrentMonth && todayKpis && (
          <GlassCard padding="p-4">
            <p className="text-xs font-semibold text-clay-300 uppercase tracking-wide mb-3">Today</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Sales" value={formatINR(todayKpis.totalSales)} />
              <MiniStat label="Money received" value={formatINR(todayKpis.totalCollected)} tone="paid" />
              <MiniStat label="Expenses" value={formatINR(todayKpis.totalExpenses)} tone="overdue" />
              <MiniStat label="Bricks made" value={formatNumber(todayKpis.totalProduced)} tone="ember" />
            </div>
          </GlassCard>
        )}

        {/* Month selector */}
        <div className="flex items-center justify-between glass-surface-light rounded-2xl p-1">
          <button
            onClick={() => setMonthOffset((m) => m - 1)}
            aria-label="Previous month"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-clay-300 touch-manipulation active:bg-white/5"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-clay-50">{monthLabel}</span>
          <button
            onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
            disabled={isCurrentMonth}
            aria-label="Next month"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-clay-300 touch-manipulation active:bg-white/5 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {!kpis ? (
          <p className="text-center text-sm text-clay-400 py-8">Loading factory data…</p>
        ) : (
          <>
            {/* Money movement */}
            <GlassCard padding="p-5" className="bg-gradient-to-br from-ember-700/20 via-kiln-800/40 to-kiln-800/40">
              <p className="text-xs font-medium text-clay-300 uppercase tracking-wide mb-1">
                Net Money In (Cash + Bank)
              </p>
              <div className="flex items-end gap-2">
                <span className="figure text-3xl font-bold text-clay-50 ember-text-glow">
                  {formatINR(kpis.netMovement)}
                </span>
                {kpis.netMovement >= 0 ? (
                  <TrendingUp size={20} className="text-ledger-paid mb-1.5" />
                ) : (
                  <TrendingDown size={20} className="text-ledger-overdue mb-1.5" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 pt-3 border-t border-white/10">
                <Flow label="Cash In" value={kpis.cashIn} tone="text-ledger-paid" />
                <Flow label="Cash Out" value={kpis.cashOut} tone="text-ledger-overdue" />
                <Flow label="Bank / UPI In" value={kpis.bankIn} tone="text-ledger-credit" />
                <Flow label="Bank / UPI Out" value={kpis.bankOut} tone="text-ledger-overdue" />
              </div>
            </GlassCard>

            {/* Low stock */}
            {kpis.lowStock.length > 0 && (
              <GlassCard padding="p-4" onClick={() => onNavigate?.('inventory')} className="border-ledger-overdue/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle size={16} className="text-ledger-overdue" />
                  <h3 className="text-sm font-semibold text-clay-100">Low raw material stock</h3>
                </div>
                <p className="text-xs text-clay-400">
                  {kpis.lowStock
                    .map((m) => {
                      const isKg = (m.unit || '').toLowerCase() === 'kg';
                      return `${m.name}: ${formatNumber(isKg ? m.currentStock / 1000 : m.currentStock, isKg ? 2 : 1)} ${isKg ? 'Ton' : m.unit}`;
                    })
                    .join(' · ')}
                </p>
              </GlassCard>
            )}

            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
              <KpiCard label="Total Sales" value={kpis.totalSales} icon={IndianRupee} delay={0.05} />
              <KpiCard label="Collected" value={kpis.totalCollected} icon={Wallet} delay={0.1} tone="paid" />
              <KpiCard label="Receivables" value={kpis.receivables} icon={AlertCircle} delay={0.15} tone="overdue" onClick={() => onNavigate?.('sales')} />
              <KpiCard label="Payables" value={kpis.payables} icon={Package} delay={0.2} onClick={() => onNavigate?.('purchases')} />
              <KpiCard
                label="Bricks Produced"
                value={kpis.totalProduced}
                isCurrency={false}
                icon={Factory}
                delay={0.25}
                tone="ember"
                onClick={() => onNavigate?.('production')}
              />
              <KpiCard label="Expenses" value={kpis.totalExpenses} icon={Fuel} delay={0.3} tone="overdue" onClick={() => onOpenSubScreen?.('expenses')} />
              <KpiCard
                label="Gross Margin"
                hint="Sales − cost of bricks sold"
                value={kpis.grossMargin}
                icon={TrendingUp}
                delay={0.35}
                tone={kpis.grossMargin >= 0 ? 'paid' : 'overdue'}
              />
              <KpiCard
                label="Profit (est.)"
                hint="Gross margin − expenses"
                value={kpis.netProfit}
                icon={TrendingUp}
                delay={0.4}
                tone={kpis.netProfit >= 0 ? 'paid' : 'overdue'}
              />
            </div>

            {stockData.length > 0 && <ProductionMiniChart data={stockData} title="Bricks in Stock Now" />}

            <AgingAlertsWidget onSelectCustomer={() => onNavigate?.('sales')} />

            <div className="grid grid-cols-2 gap-3">
              <GlassCard padding="p-4">
                <p className="text-[11px] text-clay-400 uppercase tracking-wide mb-1">Brick Stock Value</p>
                <p className="figure text-lg font-bold text-clay-50">{formatINR(kpis.finishedStockValue)}</p>
              </GlassCard>
              <GlassCard padding="p-4">
                <p className="text-[11px] text-clay-400 uppercase tracking-wide mb-1">Raw Material Value</p>
                <p className="figure text-lg font-bold text-clay-50">{formatINR(kpis.rawStockValue)}</p>
              </GlassCard>
            </div>
          </>
        )}
      </div>

      {sheet === 'sale' && <AddSaleSheet open onClose={() => setSheet(null)} />}
      <AddProductionSheet open={sheet === 'production'} onClose={() => setSheet(null)} />
      <AddExpenseSheet open={sheet === 'expense'} onClose={() => setSheet(null)} />
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  const tones = {
    paid: 'text-ledger-paid',
    overdue: 'text-ledger-overdue',
    ember: 'text-ember-400',
  };
  return (
    <div>
      <p className="text-[11px] text-clay-400">{label}</p>
      <p className={`figure text-base font-bold ${tones[tone] || 'text-clay-50'}`}>{value}</p>
    </div>
  );
}

function Flow({ label, value, tone }) {
  return (
    <div>
      <p className="text-[11px] text-clay-400">{label}</p>
      <p className={`figure text-sm font-semibold ${tone}`}>{formatINR(value)}</p>
    </div>
  );
}
