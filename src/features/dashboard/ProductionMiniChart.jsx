import { motion } from 'framer-motion';
import GlassCard from '../../core/ui/GlassCard';
import { formatNumber } from '../../core/utils/format';

/**
 * ProductionMiniChart
 * ---------------------
 * Lightweight, dependency-free animated bar chart showing bricks
 * produced per size this period. Built with plain divs + Framer Motion
 * rather than a charting library — keeps bundle size down and gives
 * full control over the touch-friendly tap targets and spring-in bars.
 */
export default function ProductionMiniChart({ data }) {
  // data: [{ label: '4-inch', value: 12000 }, ...]
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <GlassCard padding="p-4">
      <h3 className="text-sm font-semibold text-clay-200 mb-4">Production by Size</h3>
      <div className="flex items-end justify-around gap-4 h-32">
        {data.map((d, i) => {
          const heightPct = (d.value / max) * 100;
          return (
            <div key={d.label} className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
              <span className="figure text-xs text-clay-300 font-semibold">
                {formatNumber(d.value)}
              </span>
              <div className="w-full max-w-[40px] h-full flex items-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPct}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 18, delay: i * 0.08 }}
                  className="w-full rounded-t-lg bg-gradient-to-t from-ember-700 via-ember-500 to-ember-400 shadow-ember-glow min-h-[6px]"
                />
              </div>
              <span className="text-[11px] text-clay-400 font-medium">{d.label}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
