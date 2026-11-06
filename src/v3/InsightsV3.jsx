import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  IndianRupee,
  Truck,
  Fuel,
  Factory,
  Boxes,
  HandCoins,
  Wallet,
  Lightbulb,
} from 'lucide-react';
import ScreenHeader from '../core/ui/ScreenHeader';
import GlassCard from '../core/ui/GlassCard';
import { computeInsights } from '../core/insights/insights';
import { db } from '../core/db/schema';
import { formatINR, formatNumber, formatDateDisplay } from '../core/utils/format';
import { PairedBars, BarList, Ring, Initials } from './visuals';
import Icon3D from './icons3d/Icon3D';
import Illustration from './illustrations/Illustration';

const brick3d = (size) => (['4-inch', '8-inch', '9-inch'].includes(size) ? `brick-${size[0]}` : 'brick-stack');
const TIP_3D = {
  alert: 'notifications', 'trending-down': 'expenses', 'trending-up': 'revenue', rupee: 'profit', truck: 'purchase',
  fuel: 'expense', factory: 'factory', boxes: 'brick-stack', 'hand-coins': 'payment-in', wallet: 'money-received',
};

import { useT, pick, materialName } from '../core/i18n';

const TIP_ICONS = {
  alert: AlertTriangle,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
  rupee: IndianRupee,
  truck: Truck,
  fuel: Fuel,
  factory: Factory,
  boxes: Boxes,
  'hand-coins': HandCoins,
  wallet: Wallet,
};
const TONES = {
  warn: { bg: 'bg-ledger-partial/15', fg: 'text-ledger-partial' },
  bad: { bg: 'bg-ledger-overdue/15', fg: 'text-ledger-overdue' },
  good: { bg: 'bg-ledger-paid/15', fg: 'text-ledger-paid' },
  idea: { bg: 'bg-ember-500/15', fg: 'text-ember-500' },
  info: { bg: 'bg-ledger-credit/15', fg: 'text-ledger-credit' },
};

const rupees = (n) => formatINR(Math.round(n));

/**
 * InsightsV3
 * -----------
 * "How is my business doing, and what should I do?" — in plain words.
 * Tips first (with ₹ amounts), then a few simple pictures.
 */
export default function InsightsV3() {
  const { t, lang } = useT();
  const mLabel = (key) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', { month: 'long', year: 'numeric' });
  };
  const mShort = (key) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', { month: 'short' });
  };
  // Recompute whenever data changes.
  const version = useLiveQuery(() => db.settings.count(), [], 0);
  const salesCount = useLiveQuery(() => db.salesLog.count(), [], 0);
  const [data, setData] = useState(null);
  const [expMonth, setExpMonth] = useState(null);

  useEffect(() => {
    computeInsights({ months: 4 }).then((d) => {
      setData(d);
      setExpMonth((m) => m || d.months[d.months.length - 2]?.key || d.months[d.months.length - 1]?.key);
    });
  }, [version, salesCount]);

  if (!data) {
    return <p className="pt-safe-loose text-center text-clay-400">{t('ins.loading')}</p>;
  }

  const exp = data.expenseByMonth[expMonth] || { total: 0, categories: [] };

  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader eyebrow={t('ins.eyebrow')} title={t('ins.title')} />

      <div className="px-5 md:px-8 space-y-5 max-w-3xl mx-auto">
        {/* Counter scene: till, ledger, notes; a coin drops onto the stack */}
        <div className="glass-surface rounded-3xl overflow-hidden px-2 pt-1">
          <Illustration name="sales" />
        </div>
        {/* ---------- Tips ---------- */}
        <section>
          <SectionTitle icon3d="notifications" title={t('ins.next')} />
          <div className="space-y-2.5">
            {data.tips.length === 0 && (
              <GlassCard padding="p-4">
                <p className="text-sm text-clay-300">{t('ins.allFine')}</p>
              </GlassCard>
            )}
            {data.tips.slice(0, 6).map((tip) => {
              const Icon = TIP_ICONS[tip.icon] || Lightbulb;
              const tone = TONES[tip.tone] || TONES.info;
              return (
                <GlassCard key={tip.id} padding="p-4">
                  <div className="flex gap-3">
                    <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${tone.bg}`}>
                      <Icon3D name={TIP_3D[tip.icon] || 'notifications'} size={38} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-clay-50 leading-snug">{pick(lang, tip.title)}</p>
                      <p className="text-[13px] text-clay-300 mt-1 leading-relaxed">{pick(lang, tip.text)}</p>
                      {tip.impact && (
                        <span className={`inline-block mt-2 text-xs font-bold px-2.5 py-1 rounded-full ${tone.bg} ${tone.fg}`}>
                          {pick(lang, tip.impact)}
                        </span>
                      )}
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </section>

        {/* ---------- Money in / out ---------- */}
        <section>
          <SectionTitle icon3d="money-received" title={t('ins.money')} />
          <GlassCard padding="p-4">
            <PairedBars
              data={data.months.map((m) => ({ label: mShort(m.key), a: m.moneyIn, b: m.moneyOut }))}
              aLabel={t('ins.moneyIn')}
              bLabel={t('ins.moneyOut')}
              format={rupees}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {data.months.map((m) => (
                <div key={m.key} className="glass-surface-light rounded-xl p-2.5 text-center">
                  <p className="text-[11px] text-clay-400 font-semibold">{mLabel(m.key)}</p>
                  <p className={`figure text-sm font-bold ${m.net >= 0 ? 'text-ledger-paid' : 'text-ledger-overdue'}`}>
                    {m.net >= 0 ? '+' : '−'}
                    {rupees(Math.abs(m.net))}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-clay-500 mt-3 leading-relaxed">
              {t('ins.moneyNote')}
            </p>
          </GlassCard>
        </section>

        {/* ---------- Cost of one brick ---------- */}
        {data.brickEconomics.length > 0 && (
          <section>
            <SectionTitle icon3d="brick-9" title={t('ins.brickCost')} />
            <div className="space-y-2.5">
              {data.brickEconomics.map((b) => {
                const parts = [
                  { label: t('ins.materials'), value: b.materialCost, color: '#A07A55' },
                  { label: t('ins.labour'), value: b.labourCost, color: '#6C7FB5' },
                  { label: t('ins.other'), value: b.overheadCost, color: '#C9B458' },
                ];
                const total = Math.max(b.avgSoldRate, b.fullCost, 0.01);
                return (
                  <GlassCard key={b.size} padding="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Icon3D name={brick3d(b.size)} size={48} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-clay-50">{t('ins.brick', { s: b.size })}</p>
                        <p className="text-xs text-clay-400">
                          {t('ins.soldMonth', { n: formatNumber(Math.round(b.soldPerMonth)) })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-clay-400">{t('ins.youKeep')}</p>
                        <p className={`figure text-xl font-bold ${b.profitPerBrick >= 0 ? 'text-ledger-paid' : 'text-ledger-overdue'}`}>
                          ₹{b.profitPerBrick.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {/* Cost stack vs selling price */}
                    <div className="h-4 rounded-full overflow-hidden flex bg-kiln-700" aria-hidden="true">
                      {parts.map((p) => (
                        <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
                      ))}
                      {b.profitPerBrick > 0 && (
                        <div style={{ width: `${(b.profitPerBrick / total) * 100}%`, background: 'rgb(var(--c-ledger-paid))' }} />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs">
                      {parts.map((p) => (
                        <Row key={p.label} color={p.color} label={p.label} value={`₹${p.value.toFixed(2)}`} />
                      ))}
                      <Row color="rgb(var(--c-ledger-paid))" label={t('ins.soldAt')} value={`₹${b.avgSoldRate.toFixed(2)}`} />
                    </div>
                  </GlassCard>
                );
              })}
              <p className="text-[11px] text-clay-500 px-1 leading-relaxed">
                {t('ins.brickNote')}
              </p>
            </div>
          </section>
        )}

        {/* ---------- Where money goes ---------- */}
        <section>
          <SectionTitle icon3d="expenses" title={t('ins.whereMoney')} />
          <GlassCard padding="p-4">
            <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
              {data.months.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setExpMonth(m.key)}
                  className={`h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap touch-manipulation ${
                    expMonth === m.key ? 'bg-ember-500 text-white' : 'glass-surface-light text-clay-300'
                  }`}
                >
                  {mLabel(m.key)}
                </button>
              ))}
            </div>
            <p className="text-sm text-clay-300 mb-3">
              {t('ins.expensesTotal')} <span className="figure font-bold text-clay-50">{rupees(exp.total)}</span>
            </p>
            {exp.categories.length ? (
              <BarList rows={exp.categories.slice(0, 6).map((c) => ({ label: c.category, value: c.amount }))} format={rupees} />
            ) : (
              <p className="text-xs text-clay-500">{t('ins.noExpenses')}</p>
            )}
          </GlassCard>
        </section>

        {/* ---------- Production ---------- */}
        <section>
          <SectionTitle icon3d="factory" title={t('ins.production')} />
          <GlassCard padding="p-4">
            <div className="flex items-center gap-4">
              <Ring pct={(data.production.workingDays / 26) * 100} color="rgb(var(--c-ember-500))" size={76}>
                <div className="text-center leading-none">
                  <p className="figure text-lg font-bold text-clay-50">{data.production.workingDays}</p>
                  <p className="text-[9px] text-clay-400">{t('ins.days')}</p>
                </div>
              </Ring>
              <div className="text-sm text-clay-300 space-y-1">
                <p>
                  {t('ins.made')} <b className="figure text-clay-50">{formatNumber(data.production.made30)}</b>
                </p>
                <p>
                  {t('ins.perDay')} <b className="figure text-clay-50">{formatNumber(Math.round(data.production.avgPerWorkingDay))}</b>
                </p>
                {data.production.bestDay && (
                  <p className="text-xs text-clay-400">
                    {t('ins.bestDay', { n: formatNumber(data.production.bestDay.qty), d: formatDateDisplay(data.production.bestDay.date) })}
                  </p>
                )}
              </div>
            </div>
            <DayDots dayTotals={data.production.dayTotals} note={t('ins.dots')} />
          </GlassCard>
        </section>

        {/* ---------- Customers ---------- */}
        {data.topCustomers.length > 0 && (
          <section>
            <SectionTitle icon3d="payment-in" title={t('ins.customers')} />
            <GlassCard padding="p-4" className="space-y-3">
              {data.topCustomers.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <Initials name={c.name} size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-clay-50 truncate pr-2">{c.name}</span>
                      <span className="figure font-semibold text-clay-100">{rupees(c.amount)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-kiln-700 mt-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-ember-500" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {data.topCustomers[0]?.pct > 60 && (
                <p className="text-xs text-clay-400 pt-1 leading-relaxed">
                  {t('ins.oneCustomer', { p: Math.round(data.topCustomers[0].pct), name: data.topCustomers[0].name })}
                </p>
              )}
            </GlassCard>
          </section>
        )}

        {/* ---------- Supplier prices ---------- */}
        {data.supplierPrices.length > 0 && (
          <section>
            <SectionTitle icon3d="purchase" title={t('ins.suppliers')} />
            <div className="space-y-2.5">
              {data.supplierPrices.map((s) => (
                <GlassCard key={s.material} padding="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Icon3D name={/fly/i.test(s.material) ? 'fly-ash' : /lime/i.test(s.material) ? 'lime' : /gyps/i.test(s.material) ? 'gypsum' : 'quarry-dust'} size={34} />
                    <p className="font-semibold text-clay-50">{materialName(lang, s.material)}</p>
                  </div>
                  <div className="space-y-1.5">
                    {s.list.map((r, i) => (
                      <div key={r.supplier} className="flex items-center justify-between text-sm">
                        <span className="text-clay-200 truncate pr-2">
                          {r.supplier}
                          {s.suspicious?.includes(r) ? (
                            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-ledger-partial/15 text-ledger-partial">{t('ins.check')}</span>
                          ) : (
                            i === 0 && s.list.length > 1 && s.saving > 0 && (
                              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-ledger-paid/15 text-ledger-paid">{t('ins.cheapest')}</span>
                            )
                          )}
                        </span>
                        <span className="figure text-clay-100 shrink-0">
                          {rupees(r.rate)}/{s.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              ))}
            </div>
          </section>
        )}

        <p className="text-[11px] text-clay-500 text-center px-6 pb-2 leading-relaxed">
          {t('ins.footer')}
        </p>
      </div>

    </div>
  );
}

function SectionTitle({ icon3d, title }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-bold text-clay-200 uppercase tracking-wide mb-2.5 px-1">
      <Icon3D name={icon3d} size={26} />
      {title}
    </h2>
  );
}

function Row({ color, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-clay-400">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
        {label}
      </span>
      <span className="figure text-clay-100 font-semibold">{value}</span>
    </div>
  );
}

/** 30 small squares, darker = more bricks made that day. */
function DayDots({ dayTotals, note }) {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ iso, q: dayTotals[iso] || 0, sunday: d.getDay() === 0, day: d.getDate() });
  }
  const max = Math.max(1, ...days.map((d) => d.q));
  return (
    <div className="mt-4">
      <div className="grid grid-cols-10 gap-1.5">
        {days.map((d) => (
          <div
            key={d.iso}
            title={`${d.iso}: ${d.q} bricks`}
            className="aspect-square rounded-md flex items-center justify-center text-[9px] font-semibold"
            style={{
              background: d.q ? `rgb(var(--c-ember-500) / ${0.25 + 0.75 * (d.q / max)})` : 'rgb(var(--c-kiln-700))',
              color: d.q / max > 0.5 ? '#fff' : 'rgb(var(--c-clay-400))',
              outline: d.sunday ? '1px dashed rgb(var(--c-clay-600))' : 'none',
            }}
          >
            {d.day}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-clay-500 mt-2">{note}</p>
    </div>
  );
}
