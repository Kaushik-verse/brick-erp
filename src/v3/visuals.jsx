/**
 * visuals.jsx — small picture components for the new design:
 * brick-size colours and simple charts (bars, ring, initials).
 * Plain SVG/CSS, no chart library, so it stays light on old phones.
 */

const SIZE_COLORS = {
  '4-inch': { fill: '#E0A13A', dark: '#A86F12', soft: '#FBF0DC', label: 'Amber' },
  '8-inch': { fill: '#2F9C8F', dark: '#1D6B61', soft: '#DDF1EE', label: 'Teal' },
  '9-inch': { fill: '#C4552A', dark: '#8E3415', soft: '#F8E3D9', label: 'Brick' },
};
const FALLBACK = ['#6C7FB5', '#8B6BB8', '#5E8F4E', '#B5606C'];

export function sizeColor(size) {
  if (SIZE_COLORS[size]) return SIZE_COLORS[size];
  const h = [...String(size || '')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const fill = FALLBACK[h % FALLBACK.length];
  return { fill, dark: fill, soft: `${fill}22` };
}

/**
 * Paired bars per month (e.g. money in vs out). values: [{label, a, b}]
 */
export function PairedBars({ data, aLabel, bLabel, aColor = 'rgb(var(--c-ledger-paid))', bColor = 'rgb(var(--c-ledger-overdue))', format = (v) => v, height = 120 }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  return (
    <div>
      <div className="flex items-end justify-around gap-3" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="flex-1 flex items-end justify-center gap-1 h-full">
            {[['a', aColor], ['b', bColor]].map(([k, col]) => (
              <div
                key={k}
                className="w-1/2 max-w-[22px] rounded-t-md transition-all duration-700"
                style={{ height: `${Math.max(2, (d[k] / max) * 100)}%`, background: col }}
                title={`${k === 'a' ? aLabel : bLabel}: ${format(d[k])}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-around gap-3 mt-1.5">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[11px] font-semibold text-clay-400">
            {d.label}
          </span>
        ))}
      </div>
      <div className="flex justify-center gap-4 mt-2 text-[11px] text-clay-400">
        <Legend color={aColor} label={aLabel} />
        <Legend color={bColor} label={bLabel} />
      </div>
    </div>
  );
}

export function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Single bar list (e.g. expense categories). rows: [{label, value, color?, icon?}] */
export function BarList({ rows, format = (v) => v, color = 'rgb(var(--c-ember-500))' }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-clay-200 font-medium truncate pr-2">{r.label}</span>
            <span className="figure text-clay-100 font-semibold shrink-0">{format(r.value)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-kiln-700 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(r.value / max) * 100}%`, background: r.color || color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Ring showing a share (0–100). */
export function Ring({ pct, color = 'rgb(var(--c-ember-500))', size = 64, stroke = 8, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--c-kiln-700))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/** Coloured round avatar with initials. */
export function Initials({ name, size = 40 }) {
  const n = String(name || '?').trim();
  const parts = n.split(/\s+/);
  const text = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  const hues = [18, 160, 210, 280, 40, 340, 120];
  const h = hues[[...n].reduce((a, ch) => a + ch.charCodeAt(0), 0) % hues.length];
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${h} 60% 88%)`, color: `hsl(${h} 55% 30%)` }}
    >
      {text}
    </span>
  );
}
