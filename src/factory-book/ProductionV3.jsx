import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import ScreenHeader from '../core/ui/ScreenHeader';
import GlassCard from '../core/ui/GlassCard';
import GlassButton from '../core/ui/GlassButton';
import AddProductionSheet from '../features/production/AddProductionSheet';
import { db } from '../core/db/schema';
import { useUIStore } from '../core/store/uiStore';
import { formatNumber, formatDateDisplay, formatINR } from '../core/utils/format';
import { sizeColor } from './visuals';
import Icon3D from './icons3d/Icon3D';
import Illustration from './illustrations/Illustration';

const brick3d = (size) => (['4-inch', '8-inch', '9-inch'].includes(size) ? `brick-${size[0]}` : 'brick-stack');

import { useT } from '../core/i18n';
import { deleteProductionBatch } from '../core/db/ledgerEngine';


export default function ProductionV3() {
  const { t, lang } = useT();
  const WEEKDAYS = t('prod.weekdays').split(',');
  const pushToast = useUIStore((s) => s.pushToast);
  const [offset, setOffset] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editRun, setEditRun] = useState(null);

  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const ym = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

  const runs = useLiveQuery(
    () => db.productionLog.where('date').between(`${ym}-01`, `${ym}-31`, true, true).toArray(),
    [ym],
    []
  );

  const { bySize, byDay, total, cost } = useMemo(() => {
    const bs = {};
    const bd = {};
    let t = 0;
    let c = 0;
    for (const r of runs) {
      bs[r.brickSize] = (bs[r.brickSize] || 0) + r.quantity;
      bd[r.date] = (bd[r.date] || 0) + r.quantity;
      t += r.quantity;
      c += r.totalCost || 0;
    }
    return { bySize: bs, byDay: bd, total: t, cost: c };
  }, [runs]);

  const maxDay = Math.max(1, ...Object.values(byDay));
  const sorted = [...runs].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const groups = [];
  for (const r of sorted) {
    const g = groups[groups.length - 1];
    if (g && g.date === r.date) g.runs.push(r);
    else groups.push({ date: r.date, runs: [r] });
  }

  const handleDelete = async (run) => {
    if (!window.confirm(`Delete ${formatNumber(run.quantity)} ${run.brickSize} bricks made on ${formatDateDisplay(run.date)}?`)) return;
    try {
      await deleteProductionBatch(run.id);
      pushToast('Production deleted', 'success');
    } catch (e) {
      pushToast(e.message || 'Could not delete', 'error');
    }
  };

  const monthName = first.toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', { month: 'long', year: 'numeric' });
  const lead = first.getDay();

  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader
        eyebrow={t('prod.eyebrow')}
        title={t('prod.title')}
        action={
          <GlassButton size="sm" icon={Plus} onClick={() => { setEditRun(null); setSheetOpen(true); }}>
            {t('prod.add')}
          </GlassButton>
        }
      />

      <div className="px-5 md:px-8 space-y-4 max-w-3xl mx-auto">
        {/* Brick press scene: ram presses, bricks ride the belt, the pallet fills up */}
        <div className="glass-surface rounded-3xl overflow-hidden px-2 pt-1 -mb-1">
          <Illustration name="production" />
        </div>

        {/* Month switcher */}
        <div className="flex items-center justify-between glass-surface rounded-2xl p-1">
          <button onClick={() => setOffset((o) => o - 1)} aria-label="Previous month" className="w-11 h-11 rounded-xl flex items-center justify-center text-clay-300 touch-manipulation">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-clay-50">{monthName}</span>
          <button
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset === 0}
            aria-label="Next month"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-clay-300 touch-manipulation disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Totals by size */}
        <GlassCard padding="p-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs text-clay-400">{t('prod.total')}</p>
              <p className="figure text-3xl font-bold text-clay-50">{formatNumber(total)}</p>
            </div>
            {total > 0 && (
              <p className="text-xs text-clay-400 text-right">
                {t('prod.avgCost')}
                <span className="block figure text-base font-bold text-clay-100">₹{(cost / total).toFixed(2)}</span>
              </p>
            )}
          </div>
          {total > 0 && (
            <>
              <div className="h-3 rounded-full overflow-hidden flex" aria-hidden="true">
                {Object.entries(bySize).map(([size, q]) => (
                  <div key={size} style={{ width: `${(q / total) * 100}%`, background: sizeColor(size).fill }} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {Object.entries(bySize).map(([size, q]) => (
                  <div key={size} className="flex items-center gap-2">
                    <Icon3D name={brick3d(size)} size={34} />
                    <div>
                      <p className="text-[11px] text-clay-400">{size}</p>
                      <p className="figure text-sm font-bold text-clay-50">{formatNumber(q)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </GlassCard>

        {/* Calendar */}
        <GlassCard padding="p-4">
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="text-[10px] font-bold text-clay-500">
                {d}
              </span>
            ))}
            {Array.from({ length: lead }).map((_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const iso = `${ym}-${String(i + 1).padStart(2, '0')}`;
              const q = byDay[iso] || 0;
              const strong = q / maxDay > 0.5;
              return (
                <div
                  key={iso}
                  title={`${q} bricks`}
                  className="aspect-square rounded-lg flex flex-col items-center justify-center"
                  style={{ background: q ? `rgb(var(--c-ember-500) / ${0.2 + 0.8 * (q / maxDay)})` : 'rgb(var(--c-kiln-700))' }}
                >
                  <span className="text-[11px] font-bold" style={{ color: strong ? '#fff' : 'rgb(var(--c-clay-300))' }}>
                    {i + 1}
                  </span>
                  {q > 0 && (
                    <span className="text-[8px] font-semibold leading-none" style={{ color: strong ? '#fff' : 'rgb(var(--c-clay-300))' }}>
                      {q >= 1000 ? `${(q / 1000).toFixed(1)}k` : q}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-clay-500 mt-2">{t('prod.darker')}</p>
        </GlassCard>

        {/* Entries */}
        {groups.length === 0 && (
          <GlassCard padding="p-6" className="text-center">
            <p className="text-clay-300 font-medium">{t('prod.none', { m: monthName })}</p>
            <p className="text-sm text-clay-500 mt-1">{t('prod.noneHint')}</p>
          </GlassCard>
        )}
        {groups.map((g) => (
          <section key={g.date}>
            <p className="text-xs font-bold text-clay-400 px-1 mb-1.5">
              {formatDateDisplay(g.date)} · {formatNumber(g.runs.reduce((s, r) => s + r.quantity, 0))} {t('prod.bricks')}
            </p>
            <div className="space-y-2">
              {g.runs.map((r) => (
                <GlassCard key={r.id} padding="p-3.5">
                  <div className="flex items-center gap-3">
                    <Icon3D name={brick3d(r.brickSize)} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-clay-50">
                        {formatNumber(r.quantity)} × {r.brickSize}
                      </p>
                      <p className="text-xs text-clay-400">
                        {t('prod.cost', { total: formatINR(r.totalCost), each: Number(r.costPerBrick || 0).toFixed(2) })}
                      </p>
                    </div>
                    <button onClick={() => { setEditRun(r); setSheetOpen(true); }} aria-label="Edit" className="p-2.5 text-clay-400 touch-manipulation">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(r)} aria-label="Delete" className="p-2.5 text-ledger-overdue touch-manipulation">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </GlassCard>
              ))}
            </div>
          </section>
        ))}
      </div>

      <AddProductionSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditRun(null); }} editRun={editRun} />
    </div>
  );
}
