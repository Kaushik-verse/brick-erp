// Brick ERP isometric scenes, built with the Anatomy skill's kit (MIT, © Ryan).
// Each scene is a real object from the brick business, painted back to front with the
// kit's camera, extrusions, lathe-turned parts and four-tone shading. Materials (brick,
// steel, wood, ash, lime…) re-tint the kit's tone variables per group.
//
// Output: src/factory-book/illustrations/scenes.js (SVG strings + animation vectors).
// Run:    node design/illustrations/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as k from '../../.claude/skills/factory-book-design/vendor/anatomy-kit/iso-kit.mjs';
import { disc, frameAlong, solidOf } from '../../.claude/skills/factory-book-design/vendor/anatomy-kit/lathe.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// ---------- scene helpers ----------

function scene(width, height, bounds, opts = {}) {
  const P = k.fitProjection(bounds, width, height, { pad: opts.pad ?? 16, azimuth: opts.azimuth ?? 45 });
  const items = [];
  const at = (p) => k.iso(p, P);
  const depth = (p) => k.depthOf(p, P);
  /** Screen offset (in SVG units) of moving a point by a world vector. */
  const shift = (v) => {
    const a = at([0, 0, 0]), b = at(v);
    return [+(b[0] - a[0]).toFixed(2), +(b[1] - a[1]).toFixed(2)];
  };
  const add = (d, svg, extra = 0) => items.push({ d: d + extra, svg });
  const solid = (paths, mat, opts2 = {}) => `<g class="m-${mat}">${k.solidSvg(paths, { tone: 'mid', crease: 'faint', ...opts2 })}</g>`;
  /** Box with a rounded plan; returns its svg and adds it unless `keep` is set. */
  const box = (plan, z, h, mat, o = {}) => {
    const svg = solid(k.slabOf(plan, z, h, P, o.steps ?? 6, o.bevel ?? 0), mat, o.style);
    const c = [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2];
    if (!o.keep) add(depth(c), svg + (o.extra || ''), o.bias || 0);
    return svg;
  };
  const cyl = (cx, cy, r, z, h, mat, o = {}) => {
    const svg = solid(k.cylinder(cx, cy, r, z, h, P, o.steps ?? 28, o.bevel ?? 0), mat, o.style);
    if (!o.keep) add(depth([cx, cy, z + h / 2]), svg + (o.extra || ''), o.bias || 0);
    return svg;
  };
  const line = (d, tone = 'lo', o = {}) => `<g class="m-${o.mat || 'ink'}">${k.lineSvg(d, { tone, ...o })}</g>`;
  const seg = (a, b) => k.segment(a, b, P);
  const dots = (pts3, mat = 'ink', size = 0.7, tone = 'mid') => `<g class="m-${mat}">${k.dotsSvg(pts3.map(at), { size, tone })}</g>`;
  const render = () => items.sort((a, b) => a.d - b.d).map((i) => i.svg).join('');
  return { P, at, depth, shift, add, solid, box, cyl, line, seg, dots, render, width, height };
}

/** Brick courses on the two faces toward the viewer (+x and +y) and joints on top. */
function brickwork(S, plan, z, h, course, brickLen) {
  const { x, y, w, d } = plan;
  const out = [];
  for (let zz = z + course; zz < z + h - 0.01; zz += course) {
    out.push(S.seg([x + w, y, zz], [x + w, y + d, zz]));
    out.push(S.seg([x, y + d, zz], [x + w, y + d, zz]));
  }
  let row = 0;
  for (let zz = z; zz < z + h - 0.01; zz += course, row++) {
    const off = row % 2 ? brickLen / 2 : 0;
    for (let xx = x + brickLen - off; xx < x + w - 1; xx += brickLen) out.push(S.seg([xx, y + d, zz], [xx, y + d, Math.min(zz + course, z + h)]));
    for (let yy = y + brickLen - off; yy < y + d - 1; yy += brickLen) out.push(S.seg([x + w, yy, zz], [x + w, yy, Math.min(zz + course, z + h)]));
  }
  for (let yy = y + brickLen / 2; yy < y + d - 1; yy += brickLen / 2) out.push(k.lineOnTop([x, yy], [x + w, yy], z + h, S.P));
  return S.line(out.join(''), 'lo', { mat: 'brick' });
}

/** A floor plate with feet, an inset groove and corner screws. */
function floor(S, plan) {
  S.add(-1e6, `<g class="m-floor">${k.solidSvg(k.slabOf(plan, -6, 6, S.P, 10, 1), { tone: 'lo', crease: 'faint', halo: true })}</g>`
    + S.line(k.planOutline(k.insetPlan(plan, 6), 0, S.P), 'faint', { mat: 'floor' })
    + S.dots(k.corners(plan, 12).map(([x, y]) => [x, y, 0]), 'floor', 0.9, 'lo'));
}

/** A wooden pallet: deck boards on three runners. */
function pallet(S, plan) {
  const { x, y, w, d } = plan;
  for (const yy of [y + 2, y + d / 2 - 3, y + d - 8]) S.box({ x: x + 1, y: yy, w: w - 2, d: 6, r: 1 }, 0, 4, 'wood');
  S.box({ x, y, w, d, r: 1.5 }, 4, 3, 'wood', {
    extra: S.line(Array.from({ length: 5 }, (_, i) => k.lineOnTop([x + ((i + 1) * w) / 6, y + 1], [x + ((i + 1) * w) / 6, y + d - 1], 7, S.P)).join(''), 'lo', { mat: 'wood' }),
  });
  return 7;
}

const svgOf = (S, label, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg" viewBox="0 0 ${S.width} ${S.height}" role="img" aria-label="${label}">${inner}</svg>`;

// ---------- 1. Production: brick press → conveyor → pallet ----------
function production() {
  const S = scene(380, 230, [[-140, -64, -6], [140, 64, -6], [-140, 64, -6], [140, -64, -6], [-110, -36, 112], [120, 32, 58]]);
  floor(S, { x: -140, y: -64, w: 280, d: 128, r: 12 });

  // Press frame
  S.box({ x: -122, y: -36, w: 66, d: 72, r: 4 }, 0, 12, 'steel', { bevel: 1 });
  for (const [px, py] of [[-115, -29], [-63, -29], [-115, 29], [-63, 29]]) S.cyl(px, py, 3.4, 12, 74, 'steel', { style: { tone: 'mid' } });
  S.box({ x: -124, y: -38, w: 70, d: 76, r: 4 }, 86, 12, 'steel', { bevel: 1, extra: S.dots([[-118, -32, 98], [-60, -32, 98], [-118, 32, 98], [-60, 32, 98]], 'steel', 0.9) });
  S.cyl(-89, 0, 13, 98, 16, 'steel', { bevel: 1 });
  S.cyl(-89, 0, 7, 114, 6, 'blue');
  // Mould + freshly pressed brick
  S.box({ x: -108, y: -22, w: 38, d: 44, r: 2 }, 12, 10, 'steel-dark');
  S.box({ x: -98, y: -12, w: 18, d: 24, r: 1.5 }, 22, 9, 'brick');
  // Ram (animated): rod + platen
  const ram = S.cyl(-89, 0, 3.2, 58, 28, 'steel', { keep: true }) + S.box({ x: -105, y: -18, w: 32, d: 36, r: 2 }, 48, 10, 'blue', { keep: true, bevel: 0.8 });
  const [rdx, rdy] = S.shift([0, 0, -17]);
  S.add(S.depth([-89, 0, 52]), `<g class="anim-ram" style="--dx:${rdx}px;--dy:${rdy}px">${ram}</g>`);
  // Control box with buttons
  S.box({ x: -56, y: 24, w: 10, d: 12, r: 1 }, 30, 22, 'blue', { extra: S.dots([[-46, 28, 46], [-46, 32, 46]], 'ok', 1.1, 'mid') });
  S.cyl(-51, 30, 1.6, 0, 30, 'steel');

  // Conveyor
  for (const lx of [-44, 38]) for (const ly of [-12, 12]) S.cyl(lx, ly, 2, 0, 22, 'steel');
  S.box({ x: -50, y: -15, w: 96, d: 30, r: 3 }, 22, 5, 'steel', {
    extra: S.line(Array.from({ length: 9 }, (_, i) => k.lineOnTop([-44 + i * 11, -14], [-44 + i * 11, 14], 27, S.P)).join(''), 'faint', { mat: 'steel' }),
  });
  // Bricks travelling on the belt (animated along +x)
  const beltBricks = [-42, -14, 14].map((bx) => S.box({ x: bx, y: -9, w: 16, d: 18, r: 1.4 }, 27, 8, 'brick', { keep: true })).join('');
  const [bdx, bdy] = S.shift([28, 0, 0]);
  S.add(S.depth([0, 0, 31]), `<g class="anim-belt" style="--dx:${bdx}px;--dy:${bdy}px">${beltBricks}</g>`);

  // Pallet with brick layers stacking up (animated)
  const pal = { x: 58, y: -34, w: 64, d: 68, r: 2 };
  const top = pallet(S, pal);
  const layerPlan = { x: 60, y: -32, w: 60, d: 64, r: 1.5 };
  const course = 10;
  const layers = Array.from({ length: 5 }, (_, i) => {
    const z = top + i * course;
    const body = S.box(layerPlan, z, course, 'brick', { keep: true });
    return `<g class="anim-layer" style="--i:${i}">${body}${brickwork(S, layerPlan, z, course, course, 15)}</g>`;
  }).join('');
  const [ldx, ldy] = S.shift([0, 0, 22]);
  S.add(S.depth([90, 0, 30]), `<g class="anim-stack" style="--dx:${ldx}px;--dy:${ldy}px">${layers}</g>`);

  return { svg: svgOf(S, 'Brick press, conveyor and a pallet of bricks', S.render()), w: S.width, h: S.height };
}

// ---------- 2. Stock yard: silos, brick pallets, lime bags ----------
function stockYard() {
  const S = scene(380, 230, [[-140, -70, -6], [140, 70, -6], [-140, 70, -6], [140, -70, -6], [-110, -40, 110], [100, 40, 50]]);
  floor(S, { x: -140, y: -70, w: 280, d: 140, r: 12 });

  // Three silos (fly ash, lime, quarry dust) along the back
  [[-104, -30, 'ash'], [-58, -38, 'lime'], [-12, -46, 'quarry']].forEach(([sx, sy, mat]) => {
    for (const [lx, ly] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) S.cyl(sx + lx, sy + ly, 1.8, 0, 26, 'steel');
    const F = frameAlong([sx, sy, 14], [0, 0, 1]);
    const body = solidOf([[0, 3], [14, 18], [62, 18], [70, 12], [74, 4]], F, S.P);
    const ladder = S.line(S.seg([sx + 18, sy + 3, 30], [sx + 18, sy + 3, 76]) + S.seg([sx + 17.6, sy + 7, 30], [sx + 17.6, sy + 7, 76])
      + Array.from({ length: 9 }, (_, i) => S.seg([sx + 18, sy + 3, 34 + i * 5], [sx + 17.6, sy + 7, 34 + i * 5])).join(''), 'mid', { mat: 'steel' });
    const bands = S.line([42, 60].map((z) => k.ring(sx, sy, 18.2, z, S.P, 48)).join(''), 'lo', { mat });
    S.add(S.depth([sx, sy, 50]), S.solid(body, mat) + bands + ladder);
  });

  // Brick pallets in front; the top layer of the right stack lifts and settles
  const stack = (px, py, layersN, animate) => {
    const pal = { x: px, y: py, w: 50, d: 50, r: 2 };
    const top = pallet(S, pal);
    const lp = { x: px + 2, y: py + 2, w: 46, d: 46, r: 1.4 };
    for (let i = 0; i < layersN; i++) {
      const z = top + i * 9;
      const g = S.box(lp, z, 9, 'brick', { keep: true }) + brickwork(S, lp, z, 9, 9, 11.5);
      if (animate && i === layersN - 1) {
        const [dx, dy] = S.shift([0, 0, 6]);
        S.add(S.depth([px + 25, py + 25, z + 4.5]), `<g class="anim-lift" style="--dx:${dx}px;--dy:${dy}px">${g}</g>`);
      } else S.add(S.depth([px + 25, py + 25, z + 4.5]), g);
    }
  };
  stack(28, -44, 5, false);
  stack(80, -6, 4, true);

  // Lime bags stacked on the left front
  [[-120, 24, 0], [-92, 24, 0], [-106, 26, 9]].forEach(([bx, by, bz]) =>
    S.box({ x: bx, y: by, w: 26, d: 18, r: 5 }, bz, 9, 'lime', { bevel: 2.4, steps: 8 }));

  return { svg: svgOf(S, 'Stock yard with material silos, brick pallets and lime bags', S.render()), w: S.width, h: S.height };
}

// ---------- 3. Delivery: lorry loaded with bricks on the road ----------
function delivery() {
  const S = scene(380, 210, [[-150, -50, -6], [150, 50, -6], [-150, 50, -6], [150, -50, -6], [-60, -20, 64], [70, 20, 40]]);
  // Road with a dashed centre line that flows
  S.add(-1e6, `<g class="m-road">${k.solidSvg(k.slabOf({ x: -150, y: -50, w: 300, d: 100, r: 10 }, -6, 6, S.P, 10, 1), { tone: 'lo', halo: true })}</g>`
    + `<g class="anim-road">${S.line(k.lineOnTop([-140, 0], [140, 0], 0, S.P), 'hi', { mat: 'paint', dashed: true })}</g>`
    + S.line(k.lineOnTop([-146, -44], [146, -44], 0, S.P) + k.lineOnTop([-146, 44], [146, 44], 0, S.P), 'faint', { mat: 'road' }));

  // Explicit painter's order for the lorry (stacked parts defeat centre-depth sorting):
  // far wheels → chassis → bed → load → cab → near wheels.
  const parts = [];
  const put = (svg, _c, order) => parts.push({ d: order, svg });
  // Chassis
  put(S.box({ x: -78, y: -18, w: 150, d: 36, r: 2 }, 12, 6, 'steel-dark', { keep: true }), [-3, 0, 15], 1);
  // Cargo bed with low walls
  put(S.box({ x: -76, y: -24, w: 100, d: 48, r: 2 }, 18, 5, 'blue', { keep: true, bevel: 0.6 }), [-26, 0, 20], 2);
  // Brick load
  const load = { x: -72, y: -20, w: 92, d: 40, r: 1.5 };
  put(S.box(load, 23, 24, 'brick', { keep: true }) + brickwork(S, load, 23, 24, 8, 13), [-26, 0, 35], 3);
  // Cab
  put(S.box({ x: 28, y: -24, w: 42, d: 48, r: 5 }, 18, 30, 'blue', { keep: true, bevel: 1.2 })
    + S.line(S.seg([70, -18, 40], [70, 18, 40]) + S.seg([70, 18, 40], [70, 18, 30]) + S.seg([70, -18, 40], [70, -18, 30]) + S.seg([70, -18, 30], [70, 18, 30]), 'hi', { mat: 'glass' })
    + S.line(S.seg([36, 24, 42], [58, 24, 42]) + S.seg([36, 24, 32], [58, 24, 32]) + S.seg([36, 24, 32], [36, 24, 42]) + S.seg([58, 24, 32], [58, 24, 42]), 'hi', { mat: 'glass' })
    + S.dots([[71, -14, 22], [71, 14, 22]], 'lamp', 1.6, 'mid'), [49, 0, 33], 4);
  // Wheels (lathe discs along the y axis)
  for (const wx of [-56, -30, 48]) for (const wy of [-24, 24]) {
    const tyre = disc(-4, 4, 11, frameAlong([wx, wy, 11], [0, 1, 0]), S.P);
    const hub = disc(-4.6, 4.6, 5, frameAlong([wx, wy, 11], [0, 1, 0]), S.P);
    put(S.solid(tyre, 'tyre') + S.solid(hub, 'steel'), [wx, wy, 6], wy < 0 ? 0 : 5 + wx / 1000);
  }
  const truck = parts.sort((a, b) => a.d - b.d).map((p) => p.svg).join('');
  const [dx, dy] = S.shift([8, 0, 0]);
  S.add(0, `<g class="anim-truck" style="--dx:${dx}px;--dy:${dy}px">${truck}</g>`);
  return { svg: svgOf(S, 'Delivery lorry carrying bricks', S.render()), w: S.width, h: S.height };
}

// ---------- 4. Sales & cash: counter, till, coins, ledger, notes ----------
function cashCounter() {
  const S = scene(360, 220, [[-120, -60, -6], [120, 60, -6], [-120, 60, -6], [120, -60, -6], [-70, -30, 90], [80, 30, 60]]);
  floor(S, { x: -120, y: -60, w: 240, d: 120, r: 12 });
  // Counter desk
  S.box({ x: -100, y: -40, w: 200, d: 80, r: 4 }, 0, 34, 'wood', {
    bevel: 1,
    bias: -5e5, // the counter is painted before everything that stands on it
    extra: S.line(S.seg([100, -36, 17], [100, 36, 17]) + S.seg([-96, 40, 17], [96, 40, 17]), 'lo', { mat: 'wood' }),
  });
  // Till
  S.box({ x: -84, y: -26, w: 50, d: 44, r: 3 }, 34, 16, 'steel', { bevel: 1, extra: S.dots(Array.from({ length: 9 }, (_, i) => [-50 + (i % 3) * 6, -10 + Math.floor(i / 3) * 7, 50]), 'steel', 1.1) });
  S.box({ x: -82, y: -24, w: 12, d: 40, r: 2 }, 50, 22, 'steel-dark', { bevel: 0.8 });
  S.box({ x: -80.6, y: -20, w: 2, d: 32, r: 0.6 }, 56, 12, 'screen');
  // Ledger book
  S.box({ x: -18, y: -6, w: 40, d: 32, r: 2 }, 34, 3, 'ledger');
  S.box({ x: -17, y: -5, w: 38, d: 30, r: 1.5 }, 37, 3, 'paper', { extra: S.line([5, 10, 15, 20].map((yy) => k.lineOnTop([-12, yy], [16, yy], 40, S.P)).join(''), 'faint', { mat: 'paper' }) });
  S.box({ x: -18, y: -6, w: 40, d: 32, r: 2 }, 40, 2, 'ledger');
  // Banknotes
  for (let i = 0; i < 4; i++) S.box({ x: 30 + i * 0.6, y: -30 + i * 0.4, w: 34, d: 18, r: 1.4 }, 34 + i * 1.6, 1.6, 'cash');
  // Coin stacks
  const coins = (cx, cy, n) => {
    for (let i = 0; i < n; i++) S.cyl(cx, cy, 7, 34 + i * 3.2, 3.2, 'gold', { steps: 32, bevel: 0.4 });
  };
  coins(46, 12, 4); coins(64, 2, 6); coins(78, 22, 3);
  // A coin dropping onto the tallest stack (animated)
  const drop = S.cyl(64, 2, 7, 34 + 6 * 3.2, 3.2, 'gold', { keep: true, steps: 32, bevel: 0.4 });
  const [dx, dy] = S.shift([0, 0, 28]);
  S.add(S.depth([64, 2, 60]), `<g class="anim-coin" style="--dx:${dx}px;--dy:${dy}px">${drop}</g>`);
  return { svg: svgOf(S, 'Sales counter with till, ledger, banknotes and coins', S.render()), w: S.width, h: S.height };
}

const scenes = { production: production(), stock: stockYard(), delivery: delivery(), sales: cashCounter() };
const out = `// Generated by design/illustrations/build.mjs (Anatomy kit, MIT) — do not edit by hand.
export const SCENES = ${JSON.stringify(scenes)};
export const ISO_CSS = ${JSON.stringify(k.ISO_CSS)};
`;
fs.mkdirSync(path.join(here, '../../src/factory-book/illustrations'), { recursive: true });
fs.writeFileSync(path.join(here, '../../src/factory-book/illustrations/scenes.js'), out);
for (const [name, s] of Object.entries(scenes)) fs.writeFileSync(path.join(here, `${name}.svg`), s.svg);
console.log(Object.entries(scenes).map(([n, s]) => `${n}: ${(s.svg.length / 1024).toFixed(1)} KB`).join(' · '));
