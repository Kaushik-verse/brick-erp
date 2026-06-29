import { useState } from 'react';
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Wallet,
  Factory,
  AlertCircle,
  Package,
} from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import KpiCard from './KpiCard';
import ProductionMiniChart from './ProductionMiniChart';
import AgingAlertsWidget from './AgingAlertsWidget';
import { useDashboardKPIs, useFinishedStock } from '../../core/hooks/useDexieHooks';
import { monthRange, formatINR } from '../../core/utils/format';

export default function DashboardScreen({ onNavigate }) {
  const { start, end } = monthRange();
  const kpis = useDashboardKPIs(start, end);
  const finishedStock = useFinishedStock();

  if (!kpis) {
    return (
      <div className="px-5 pt-safe-loose text-center text-clay-400">
        <p>Loading factory data…</p>
      </div>
    );
  }

  const productionData = (finishedStock || []).map((f) => ({
    label: f.brickSize,
    value: f.currentStock,
  }));

  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader
        eyebrow="This Month"
        title="Factory Overview"
        subtitle={`${new Date(start).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`}
      />

      <div className="px-5 md:px-8 space-y-4 md:space-y-6 max-w-7xl mx-auto">
        {/* Hero net position card */}
        <GlassCard padding="p-5" className="bg-gradient-to-br from-ember-700/20 via-kiln-800/40 to-kiln-800/40">
          <p className="text-xs font-medium text-clay-300 uppercase tracking-wide mb-1">
            Net Cash Position (Month)
          </p>
          <div className="flex items-end gap-2">
            <span className="figure text-3xl font-bold text-clay-50 ember-text-glow">
              {formatINR(kpis.netCashPosition)}
            </span>
            {kpis.netCashPosition >= 0 ? (
              <TrendingUp size={20} className="text-ledger-paid mb-1.5" />
            ) : (
              <TrendingDown size={20} className="text-ledger-overdue mb-1.5" />
            )}
          </div>
          <div className="flex gap-4 mt-3 pt-3 border-t border-white/10">
            <div>
              <p className="text-[11px] text-clay-400">Cash In</p>
              <p className="figure text-sm font-semibold text-ledger-paid">
                {formatINR(kpis.cashIn)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-clay-400">Cash Out</p>
              <p className="figure text-sm font-semibold text-ledger-overdue">
                {formatINR(kpis.cashOut)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-clay-400">Bank In</p>
              <p className="figure text-sm font-semibold text-ledger-credit">
                {formatINR(kpis.bankIn)}
              </p>
            </div>
          </div>
        </GlassCard>

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
          <KpiCard label="Total Sales" value={kpis.totalSales} icon={IndianRupee} delay={0.05} />
          <KpiCard label="Collected" value={kpis.totalCollected} icon={Wallet} delay={0.1} tone="paid" />
          <KpiCard label="Receivables" value={kpis.receivables} icon={AlertCircle} delay={0.15} tone="overdue" />
          <KpiCard label="Payables" value={kpis.payables} icon={Package} delay={0.2} />
          <KpiCard
            label="Bricks Produced"
            value={kpis.totalProduced}
            isCurrency={false}
            icon={Factory}
            delay={0.25}
            tone="ember"
          />
          <KpiCard
            label="Gross Margin"
            value={kpis.grossMargin}
            icon={TrendingUp}
            delay={0.3}
            tone={kpis.grossMargin >= 0 ? 'paid' : 'overdue'}
          />
        </div>

        {productionData.length > 0 && <ProductionMiniChart data={productionData} />}

        <AgingAlertsWidget onSelectCustomer={() => onNavigate?.('sales')} />

        <GlassCard padding="p-4">
          <p className="text-xs text-clay-400 uppercase tracking-wide mb-1">Finished Stock Value</p>
          <p className="figure text-xl font-bold text-clay-50">
            {formatINR(kpis.finishedStockValue)}
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
