import { useEffect, useId, useRef, useState } from 'react';

/**
 * IsoBin
 * -------
 * Animated isometric storage bin for a raw material.
 *  • the material rises to its real level when the screen opens
 *  • grains keep pouring in from the top, and the surface gently shimmers
 *  • a dashed red line marks the reorder level; the bin pulses red when low
 * Pure SVG (no images), ~2 KB per bin. Motion is skipped for users who ask
 * their phone for reduced motion.
 */

const LOOKS = [
  [/fly/i, { top: '#C3C9D0', left: '#A3ABB5', right: '#858E99', grain: '#9AA2AC', speck: '#E9ECEF', kind: 'powder' }],
  [/lime/i, { top: '#F4EBC2', left: '#E0D39A', right: '#C7B979', grain: '#D9CB8A', speck: '#FFFBEA', kind: 'powder' }],
  [/gyps/i, { top: '#E1EAF6', left: '#BFD0E7', right: '#A1B6D3', grain: '#B6C8E0', speck: '#FFFFFF', kind: 'crystal' }],
  [/quarry|sand|dust/i, { top: '#CDA780', left: '#B18A62', right: '#91704D', grain: '#A47F58', speck: '#7A5B3C', kind: 'grain' }],
];
const DEFAULT_LOOK = { top: '#D3C6B8', left: '#B9AB9C', right: '#9D8F80', grain: '#B0A291', speck: '#EFE8E0', kind: 'powder' };

export function binLook(name) {
  return (LOOKS.find(([re]) => re.test(name || '')) || [null, DEFAULT_LOOK])[1];
}

// Isometric geometry (viewBox 0 0 120 132)
const W = { L: 14, R: 106, C: 60 };
const TOP_Y = { side: 40, back: 17, front: 63 };
const DEPTH = 60; // wall height
const bottom = (y) => y + DEPTH;
const pts = (arr) => arr.map((p) => p.join(',')).join(' ');

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    setReduce(mq.matches);
    const on = (e) => setReduce(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduce;
}

/** Tween a number from 0 to `target` (ease-out) once, and on change. */
function useRise(target, ms, skip) {
  const [v, setV] = useState(skip ? target : 0);
  const from = useRef(0);
  useEffect(() => {
    if (skip) {
      setV(target);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const a = from.current;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      const val = a + (target - a) * e;
      from.current = val;
      setV(val);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, skip]);
  return v;
}

export default function IsoBin({ name, pct = 0, reorderPct = null, low = false, width = 96, delay = 0 }) {
  const id = useId().replace(/:/g, '');
  const look = binLook(name);
  const reduce = useReducedMotion();
  const fill = Math.max(0, Math.min(100, pct)) / 100;
  const level = useRise(fill * (DEPTH - 3), 1400 + delay, reduce);

  // Material prism
  const yL = bottom(TOP_Y.side) - level;
  const yB = bottom(TOP_Y.back) - level;
  const yF = bottom(TOP_Y.front) - level;
  const topFace = [[W.L, yL], [W.C, yB], [W.R, yL], [W.C, yF]];
  const leftFace = [[W.L, yL], [W.C, yF], [W.C, bottom(TOP_Y.front)], [W.L, bottom(TOP_Y.side)]];
  const rightFace = [[W.C, yF], [W.R, yL], [W.R, bottom(TOP_Y.side)], [W.C, bottom(TOP_Y.front)]];

  // Walls
  const backLeft = [[W.L, TOP_Y.side], [W.C, TOP_Y.back], [W.C, bottom(TOP_Y.back)], [W.L, bottom(TOP_Y.side)]];
  const backRight = [[W.C, TOP_Y.back], [W.R, TOP_Y.side], [W.R, bottom(TOP_Y.side)], [W.C, bottom(TOP_Y.back)]];
  const floor = [[W.L, bottom(TOP_Y.side)], [W.C, bottom(TOP_Y.back)], [W.R, bottom(TOP_Y.side)], [W.C, bottom(TOP_Y.front)]];
  const frontLeft = [[W.L, TOP_Y.side], [W.C, TOP_Y.front], [W.C, bottom(TOP_Y.front)], [W.L, bottom(TOP_Y.side)]];
  const frontRight = [[W.C, TOP_Y.front], [W.R, TOP_Y.side], [W.R, bottom(TOP_Y.side)], [W.C, bottom(TOP_Y.front)]];
  const rim = [[W.L, TOP_Y.side], [W.C, TOP_Y.back], [W.R, TOP_Y.side], [W.C, TOP_Y.front]];

  // Reorder line on the front walls
  const rl = reorderPct !== null && reorderPct !== undefined ? (Math.min(100, reorderPct) / 100) * (DEPTH - 3) : null;

  // Mound on top of the material (small iso cone) — only when there is material
  const showMound = level > 4;
  const mx = W.C;
  const my = (yB + yF) / 2;
  const moundH = Math.min(9, level * 0.35);

  const surfaceY = my - 2;
  const grains = reduce || fill <= 0 ? [] : [0, 1, 2, 3];

  const h = (width * 132) / 120;
  return (
    <svg width={width} height={h} viewBox="0 0 120 132" role="img" aria-label={`${name} ${Math.round(fill * 100)}%`}>
      <defs>
        <pattern id={`tex-${id}`} width="6" height="6" patternUnits="userSpaceOnUse">
          {look.kind === 'grain' ? (
            <>
              <circle cx="1.5" cy="1.5" r="0.9" fill={look.speck} opacity="0.55" />
              <circle cx="4.5" cy="4" r="0.7" fill={look.speck} opacity="0.4" />
            </>
          ) : look.kind === 'crystal' ? (
            <path d="M1 3 L3 1 L5 3 L3 5 Z" fill={look.speck} opacity="0.45" />
          ) : (
            <circle cx="3" cy="3" r="0.6" fill={look.speck} opacity="0.5" />
          )}
        </pattern>
        <linearGradient id={`glass-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.38" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.06" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgb(196,52,44)" stopOpacity="0.45" />
          <stop offset="1" stopColor="rgb(196,52,44)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow / low-stock glow */}
      <ellipse cx="60" cy="124" rx="50" ry="8" fill="rgba(60,40,20,0.12)" />
      {low && (
        <ellipse cx="60" cy="100" rx="58" ry="34" fill={`url(#glow-${id})`}>
          {!reduce && <animate attributeName="opacity" values="0.35;1;0.35" dur="1.8s" repeatCount="indefinite" />}
        </ellipse>
      )}

      {/* back walls + floor */}
      <polygon points={pts(backLeft)} fill="#EDE6DC" />
      <polygon points={pts(backRight)} fill="#E2D9CC" />
      <polygon points={pts(floor)} fill="#D9CFC1" />

      {/* material */}
      {level > 0.5 && (
        <g>
          <polygon points={pts(leftFace)} fill={look.left} />
          <polygon points={pts(leftFace)} fill={`url(#tex-${id})`} />
          <polygon points={pts(rightFace)} fill={look.right} />
          <polygon points={pts(rightFace)} fill={`url(#tex-${id})`} />
          <polygon points={pts(topFace)} fill={look.top} />
          <polygon points={pts(topFace)} fill={`url(#tex-${id})`} />
          {showMound && (
            <g>
              {/* soft heap: darker base ring, lighter crown, a highlight */}
              <ellipse cx={mx} cy={my + 1} rx="30" ry="12" fill={look.left} opacity="0.55" />
              <ellipse cx={mx} cy={my - moundH * 0.45} rx="22" ry="8.5" fill={look.top} />
              <ellipse cx={mx} cy={my - moundH * 0.45} rx="22" ry="8.5" fill={`url(#tex-${id})`} />
              <ellipse cx={mx - 4} cy={my - moundH * 0.7} rx="10" ry="3.5" fill="#FFFFFF" opacity="0.35" />
            </g>
          )}
          {/* shimmer on the surface */}
          <polygon points={pts(topFace)} fill="#FFFFFF" opacity="0">
            {!reduce && <animate attributeName="opacity" values="0;0.22;0" dur="3.2s" begin={`${delay / 1000}s`} repeatCount="indefinite" />}
          </polygon>
        </g>
      )}

      {/* pouring grains */}
      {grains.map((i) => (
        <circle key={i} cx={56 + i * 3} cy="0" r={look.kind === 'grain' ? 1.6 : 1.2} fill={look.grain}>
          <animate attributeName="cy" from="-4" to={surfaceY} dur="1.5s" begin={`${(delay / 1000) + i * 0.38}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="1.5s" begin={`${(delay / 1000) + i * 0.38}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* front glass walls */}
      <polygon points={pts(frontLeft)} fill={`url(#glass-${id})`} stroke="rgba(60,40,20,0.35)" strokeWidth="1" />
      <polygon points={pts(frontRight)} fill={`url(#glass-${id})`} stroke="rgba(60,40,20,0.35)" strokeWidth="1" opacity="0.85" />

      {/* reorder level */}
      {rl !== null && (
        <polyline
          points={pts([[W.L, bottom(TOP_Y.side) - rl], [W.C, bottom(TOP_Y.front) - rl], [W.R, bottom(TOP_Y.side) - rl]])}
          fill="none"
          stroke="rgb(196,52,44)"
          strokeWidth="1.6"
          strokeDasharray="4 3"
        />
      )}

      {/* rim */}
      <polygon points={pts(rim)} fill="none" stroke="rgba(60,40,20,0.45)" strokeWidth="1.4" strokeLinejoin="round" />
      <line x1={W.C} y1={TOP_Y.front} x2={W.C} y2={bottom(TOP_Y.front)} stroke="rgba(60,40,20,0.35)" strokeWidth="1" />
    </svg>
  );
}
