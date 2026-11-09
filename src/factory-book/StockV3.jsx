import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle } from 'lucide-react';
import ScreenHeader from '../core/ui/ScreenHeader';
import GlassCard from '../core/ui/GlassCard';
import StockAdjustSheet from '../features/inventory/StockAdjustSheet';
import { useRawMaterials, useFinishedStock } from '../core/hooks/useDexieHooks';
import { db } from '../core/db/schema';
import { formatINR, formatNumber } from '../core/utils/format';
import Icon3D from './icons3d/Icon3D';
import Illustration from './illustrations/Illustration';

const brick3d = (size) => (['4-inch', '8-inch', '9-inch'].includes(size) ? `brick-${size[0]}` : 'brick-stack');
const material3d = (name) => (/fly/i.test(name) ? 'fly-ash' : /lime/i.test(name) ? 'lime' : /gyps/i.test(name) ? 'gypsum' : /quarry|sand|dust/i.test(name) ? 'quarry-dust' : /cement/i.test(name) ? 'cement' : /coal/i.test(name) ? 'coal' : /water/i.test(name) ? 'water' : 'storage');

import IsoBin from './IsoBin';
import { useT, materialName, translate } from '../core/i18n';

/** Days a material lasts at the last 30 days' production pace. */
function useDaysLeft(materials) {
  // Stable dependency: a new array is created every render.
  const key = (materials || []).map((m) => `${m.id}:${m.currentStock}`).join('|');
  return useLiveQuery(async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const runs = await db.productionLog.where('date').aboveOrEqual(since).toArray();
    const recipes = await db.recipes.toArray();
    const daily = runs.reduce((s, r) => s + (r.quantity || 0), 0) / 30;
    const out = {};
    for (const m of materials || []) {
      const perBrick = Math.max(0, ...recipes.map((r) => Number(r.materials?.[m.id]) || 0));
      const perDay = perBrick * daily;
      out[m.id] = perDay > 0 ? m.currentStock / perDay : null;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key], {});
}

export default function StockV3() {
  const { t, lang } = useT();
  const raw = (useRawMaterials() || []).filter((m) => m.isActive !== 0);
  const bricks = (useFinishedStock() || []).filter((f) => f.isActive !== 0);
  const daysLeft = useDaysLeft(raw);
  const [adjust, setAdjust] = useState(null);

  const brickValue = bricks.reduce((s, f) => s + (f.currentStock || 0) * (f.costPrice || 0), 0);
  const rawValue = raw.reduce((s, m) => s + (m.currentStock || 0) * (m.avgRate || 0), 0);

  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader eyebrow={t('stock.eyebrow')} title={t('stock.title')} />

      <div className="px-5 md:px-8 space-y-5 max-w-3xl mx-auto">
        {/* Yard scene: silos, brick pallets (top layer lifts), lime bags */}
        <div className="glass-surface rounded-3xl overflow-hidden px-2 pt-1">
          <Illustration name="stock" />
        </div>

        {/* Bricks */}
        <section>
          <div className="flex items-baseline justify-between px-1 mb-2.5">
            <h2 className="text-sm font-bold text-clay-200 uppercase tracking-wide">{t('stock.bricksReady')}</h2>
            <span className="text-xs text-clay-400">{t('stock.worth', { v: formatINR(brickValue) })}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {bricks.map((f) => (
              <GlassCard key={f.id} padding="p-4" onClick={() => setAdjust({ item: f, itemType: 'finished' })}>
                <div className="flex items-center gap-3">
                  <Icon3D name={brick3d(f.brickSize)} size={52} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-clay-50">{f.brickSize}</p>
                    <p className="text-xs text-clay-400">{t('stock.sellCost', { sell: f.sellingPrice, cost: (f.costPrice || 0).toFixed(2) })}</p>
                  </div>
                  <p className="figure text-2xl font-bold text-clay-50">{formatNumber(f.currentStock)}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Raw materials */}
        <section>
          <div className="flex items-baseline justify-between px-1 mb-2.5">
            <h2 className="text-sm font-bold text-clay-200 uppercase tracking-wide">{t('stock.raw')}</h2>
            <span className="text-xs text-clay-400">{t('stock.worth', { v: formatINR(rawValue) })}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {raw.map((m, idx) => {
              const isKg = (m.unit || '').toLowerCase() === 'kg';
              const shown = isKg ? m.currentStock / 1000 : m.currentStock;
              const unit = translate(lang, isKg ? 'unit.Ton' : 'unit.loads');
              const unitLabel = isKg || m.unit === 'unit' ? unit : m.unit;
              const reorder = m.reorderLevel || 0;
              const days = daysLeft?.[m.id];
              // A full bin = about 45 days of production, so the picture shows
              // "how long will it last", not just "how much". If the material
              // isn't being used, fall back to 3× the reorder level.
              const FULL_DAYS = 45;
              let pct;
              let reorderPct = null;
              if (days !== null && days !== undefined && m.currentStock > 0) {
                const perDay = m.currentStock / days;
                pct = (days / FULL_DAYS) * 100;
                if (reorder && perDay > 0) reorderPct = (reorder / perDay / FULL_DAYS) * 100;
              } else {
                const cap = Math.max(reorder * 3, m.currentStock, 1);
                pct = (m.currentStock / cap) * 100;
                if (reorder) reorderPct = (reorder / cap) * 100;
              }
              const low = reorder > 0 && m.currentStock < reorder;
              return (
                <GlassCard key={m.id} padding="p-3" onClick={() => setAdjust({ item: m, itemType: 'raw' })}>
                  <div className="flex flex-col items-center text-center">
                    <IsoBin name={m.name} pct={pct} reorderPct={reorderPct} low={low} width={104} delay={idx * 180} />
                    <p className="font-semibold text-clay-50 mt-1 truncate w-full flex items-center justify-center gap-1.5">
                      <Icon3D name={material3d(m.name)} size={24} />
                      {materialName(lang, m.name)}
                    </p>
                    <p className="figure text-xl font-bold text-clay-50 leading-tight">
                      {formatNumber(shown, 1)} <span className="text-xs font-semibold text-clay-400">{unitLabel}</span>
                    </p>
                    {m.unit === 'unit' && (
                      <p className="text-[11px] text-clay-400 -mt-0.5">{t('stock.lorries', { n: formatNumber(m.currentStock / 6, 1) })}</p>
                    )}
                    {low ? (
                      <p className="text-[11px] text-ledger-overdue font-semibold mt-0.5 flex items-center gap-1">
                        <AlertTriangle size={11} /> {t('stock.low')}
                      </p>
                    ) : days !== null && days !== undefined ? (
                      <p className={`text-[11px] font-semibold mt-0.5 ${days < 7 ? 'text-ledger-overdue' : 'text-clay-400'}`}>
                        {days > 60 ? t('stock.lastsMonths') : t('stock.lastsDays', { n: Math.floor(days) })}
                      </p>
                    ) : (
                      <p className="text-[11px] text-clay-400 mt-0.5">{t('stock.notUsed')}</p>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
          <p className="text-[11px] text-clay-500 px-1 mt-2">{t('stock.legend')}</p>
        </section>
      </div>

      <StockAdjustSheet open={!!adjust} item={adjust?.item} itemType={adjust?.itemType} onClose={() => setAdjust(null)} />
    </div>
  );
}
