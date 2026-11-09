import { useEffect, useRef, useState } from 'react';
import { mountIcon, go, runtime } from './engine';
import { ICONS, ICON_BY_NAME } from './brickIcons';

// One accent per icon, in the order of ICONS (the engine reads colours by index).
if (!runtime.palette) runtime.palette = { name: 'brick', colors: ICONS.map((ic) => ic.accent || '#5393FF') };

/*
 * Performance: a live icon is ~45 SVG nodes with two SVG filters and a mask per
 * outline, built by script on every mount. Most icons never move, so each one
 * is first shown as an <img> of its resting pose. The picture is built once per
 * icon name, cached, and drawn by the browser as an ordinary image: same pixels,
 * one DOM node, no per-screen filter work. The live engine takes over the first
 * time the icon is hovered or tapped (or pinned "active"), so motion is unchanged.
 */

// The live SVG uses overflow:visible so the soft shadow can spill past the box.
// An <img> clips to its viewBox, so the snapshot gets a padded viewBox and is
// placed so the drawing lands in exactly the same spot.
const VB = { x: 0, y: -2, w: 31, h: 29 };
const PAD = 5;
const SNAP_VB = `${VB.x - PAD} ${VB.y - PAD} ${VB.w + PAD * 2} ${VB.h + PAD * 2}`;
const SNAP_STYLE = {
  position: 'absolute',
  left: `${(-PAD / VB.w) * 100}%`,
  top: `${(-PAD / VB.h) * 100}%`,
  width: `${((VB.w + PAD * 2) / VB.w) * 100}%`,
  height: `${((VB.h + PAD * 2) / VB.h) * 100}%`,
  maxWidth: 'none',
  pointerEvents: 'none',
};
// Rules from index.css (.k3d …) that the SVG relies on; an <img> can't see page CSS.
const INLINE_CSS = '.ol{fill:none;stroke-width:2}.ln{fill:none;stroke-width:1.6;stroke-linecap:round}';

const snapshots = new Map();
function snapshot(name) {
  if (snapshots.has(name)) return snapshots.get(name);
  const entry = ICON_BY_NAME[name];
  let url = '';
  if (entry) {
    try {
      const host = document.createElement('span');
      mountIcon(entry.icon, entry.index, host);
      const svg = host.querySelector('svg');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('viewBox', SNAP_VB);
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = INLINE_CSS;
      svg.insertBefore(style, svg.firstChild);
      url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    } catch {
      url = '';
    }
  }
  snapshots.set(name, url);
  return url;
}

/**
 * Icon3D — a Brick ERP clay icon (Kubai method) that plays its own motion:
 *  • mouse hover over the surrounding button/card
 *  • a tap on touch screens (plays once, then settles back)
 *  • `active` keeps it in the moved pose (e.g. the selected item)
 * Reduced-motion users get the end pose without animation (engine handles it).
 */
export default function Icon3D({ name, size = 40, active = false, className = '', title }) {
  const host = useRef(null);
  const inst = useRef(null);
  const [live, setLive] = useState(active);
  const src = live ? '' : snapshot(name);

  // Switch to the live engine on the first hover/tap (or if the snapshot failed).
  useEffect(() => {
    if (live) return undefined;
    if (!src) { setLive(true); return undefined; }
    const target = host.current?.closest('button, a, [role="button"]') || host.current;
    if (!target) return undefined;
    const wake = (e) => {
      setLive(true);
      // Remember how it was woken so the first motion still plays.
      host.current.dataset.wake = e.pointerType === 'mouse' ? 'hover' : 'tap';
    };
    target.addEventListener('pointerenter', wake);
    target.addEventListener('pointerdown', wake);
    return () => {
      target.removeEventListener('pointerenter', wake);
      target.removeEventListener('pointerdown', wake);
    };
  }, [live, src]);

  useEffect(() => {
    if (active) setLive(true);
  }, [active]);

  useEffect(() => {
    if (!live) return undefined;
    const entry = ICON_BY_NAME[name];
    if (!entry || !host.current) return undefined;
    const i = mountIcon(entry.icon, entry.index, host.current);
    inst.current = i;
    i.pin = active;
    if (active) go(i);

    const target = host.current.closest('button, a, [role="button"]') || host.current;
    let timer;
    const enter = (e) => { if (e.pointerType === 'mouse') { i.hover = 1; go(i); } };
    const leave = (e) => { if (e.pointerType === 'mouse') { i.hover = 0; go(i); } };
    const playTap = () => {
      clearTimeout(timer);
      i.hover = 1; go(i);
      timer = setTimeout(() => { i.hover = 0; go(i); }, 620);
    };
    const tap = (e) => { if (e.pointerType !== 'mouse') playTap(); };
    // The event that woke the icon has already fired; play its motion now.
    const wake = host.current.dataset.wake;
    delete host.current.dataset.wake;
    if (wake === 'hover') { i.hover = 1; go(i); } else if (wake === 'tap') playTap();

    target.addEventListener('pointerenter', enter);
    target.addEventListener('pointerleave', leave);
    target.addEventListener('pointerdown', tap);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(i.raf);
      target.removeEventListener('pointerenter', enter);
      target.removeEventListener('pointerleave', leave);
      target.removeEventListener('pointerdown', tap);
      inst.current = null;
    };
    // `active` is applied by the effect below without remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, live]);

  useEffect(() => {
    const i = inst.current;
    if (!i) return;
    i.pin = active;
    go(i);
  }, [active, name]);

  return (
    <span
      ref={host}
      className={`k3d inline-block shrink-0 relative ${className}`}
      style={{ width: size, height: size * (29 / 31) }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {!live && src ? <img src={src} alt="" draggable={false} decoding="async" style={SNAP_STYLE} /> : null}
    </span>
  );
}
