// Brick ERP 3D icon set — original icons drawn for Brick ERP with the Kubai Icons method
// (layered back/front pieces, outside outlines, one accent per icon, hover motion the
// object itself makes). The three icons marked "Kubai example" are the skill's own
// examples, which its licence allows inside products.
//
// Each entry: svg(u) builds the layers, target(hover) returns rest/hover numbers,
// draw(p, E) writes the interpolated numbers back. Canvas 31×29, live area x 4–27, y 2–23.


const OL = 'class="ol" data-t="stroke:#5393FF"';
const LINE = 'class="ln" data-t="stroke:#D3E2FC"';
const DEEP = 'data-t="fill:#2F6FE0"';
const DEEPS = 'data-t="stroke:#2F6FE0"';
const WHITE_LN = 'class="ln" stroke="#fff" data-w="stroke"';

// ---------- shared shapes ----------

/** A till receipt: rounded top, zig-zag tear along the bottom. */
function receipt(x, y, w, h, n = 4) {
  const pts = [[x, y], [x + w, y], [x + w, y + h]];
  const step = w / n;
  for (let i = 0; i < n; i++) {
    pts.push([x + w - step * (i + 0.5), y + h - 1.8]);
    pts.push([x + w - step * (i + 1), y + h]);
  }
  const r = pts.map((_, i) => (i < 2 ? KR : 0.45));
  return rp(pts, r);
}

/** An isometric-looking brick: front face, lighter top, darker side. */
function brickFaces(x, y, w, h, d) {
  const front = rr(x, y + d, w, h, 1);
  const top = rp([[x, y + d], [x + d, y], [x + w + d, y], [x + w, y + d]], [0.6, 0.8, 0.8, 0.6]);
  const side = rp([[x + w, y + d], [x + w + d, y], [x + w + d, y + h], [x + w, y + h + d]], [0.6, 0.8, 0.8, 0.6]);
  return { front, top, side };
}
function brickSvg(u, b, extra = '') {
  return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${b.front}" fill="${u.loS}"/></g></g><path d="${b.front}" ${OL}/>
    <path d="${b.side}" fill="${u.pure('#4389FF')}"/><path d="${b.side}" ${OL}/>
    <g filter="${u.hi}"><path d="${b.top}" fill="${u.upS}"/></g><path d="${b.top}" ${OL}/>${extra}`;
}

/** Solid arrowhead (base centred on (x,y), pointing up or down). */
const arrowHead = (x, y, dir) => rp([[x - 2.6, y], [x + 2.6, y], [x, y + 3 * dir]], 0.5);

// ---------- icons ----------

const ICONS = [
  // ===== Business operations =====
  {
    name: 'new-sale',
    accent: '#E2683C',
    // A bill with a plus badge; on hover the bill rises out and the badge turns.
    svg: (u) => {
      const rc = receipt(6.4, 1.6, 14.2, 21.4);
      return `<g data-n="rc"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${rc}" fill="${u.loS}"/></g></g><path d="${rc}" ${OL}/>
        <path d="${lines(9.4, 6.6, [8.2, 5.4, 7])}" ${WHITE_LN}/></g>
        <g data-n="pl"><g filter="${u.hi}"><path d="${circ(21.4, 17.8, 4.6)}" fill="${u.upS}"/></g><path d="${circ(21.4, 17.8, 4.6)}" ${OL}/>
        <path d="M21.4 15.5V20.1M19.1 17.8H23.7" class="ln" stroke-width="2.2" ${DEEPS}/></g>`;
    },
    target: (h) => ({ y: h ? -1.4 : 0, r: h ? 90 : 0 }),
    draw(p, E) {
      at(E.rc, { transform: `translate(0 ${f(p.y)})` });
      at(E.pl, { transform: `rotate(${f(p.r)} 21.4 17.8)` });
    },
  },
  {
    name: 'payment-in',
    accent: '#2BA36B',
    // A coin drops into the wallet.
    svg: (u) => {
      const body = rr(4, 9.6, 23, 13.4, KR);
      const pocket = rp(R(4, 14.4, 23, 8.6), [1.6, 1.6, KR, KR]);
      const clasp = rr(19.4, 16.4, 7.6, 4.6, 2.3);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${body}" fill="${u.loS}"/></g></g><path d="${body}" ${OL}/>
        <g data-n="coin"><g filter="${u.hi}"><path d="${circ(15.5, 0, 4.2)}" fill="${u.upS}"/></g><path d="${circ(15.5, 0, 4.2)}" ${OL}/>
          <path d="${circ(15.5, 0, 2.1)}" class="ln" ${DEEPS}/></g>
        <g filter="${u.hi}"><path d="${pocket}" fill="${u.upS}"/></g><path d="${pocket}" ${OL}/>
        <path d="${clasp}" fill="${u.loS}"/><path d="${clasp}" ${OL}/>`;
    },
    // Rest: coin above the wallet. Hover: it sits right on the pocket edge.
    target: (h) => ({ y: h ? 10.2 : 6.2 }),
    draw(p, E) { at(E.coin, { transform: `translate(0 ${f(p.y)})` }); },
  },
  {
    name: 'expense',
    accent: '#E0A030',
    // Two banknotes; the front one slides out — money going out.
    svg: (u) => {
      const note = rr(0, 0, 19, 12.2, 1.6);
      return `<g data-n="b"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${note}" fill="${u.upS}"/></g></g><path d="${note}" ${OL}/></g>
        <g data-n="fr"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${note}" fill="${u.loS}"/></g></g><path d="${note}" ${OL}/>
          <path d="${circ(9.5, 6.1, 2.6)}" ${WHITE_LN}/>
          <path d="M3.2 3.4H5.4M13.6 8.8H15.8" ${WHITE_LN}/></g>`;
    },
    target: (h) => ({ b: h ? [7.6, 3.4, -4] : [7.4, 4.2, 0], fr: h ? [6.6, 10.2, 6] : [4.6, 8.6, 0] }),
    draw(p, E) {
      at(E.b, { transform: `translate(${f(p.b[0])} ${f(p.b[1])}) rotate(${f(p.b[2])} 9.5 6.1)` });
      at(E.fr, { transform: `translate(${f(p.fr[0])} ${f(p.fr[1])}) rotate(${f(p.fr[2])} 9.5 6.1)` });
    },
  },
  {
    name: 'purchase',
    accent: '#4C7BD9',
    // A delivery lorry that rolls forward.
    svg: (u) => {
      const cargo = rr(3.8, 4.6, 15.4, 14, KR);
      const cab = rp([[19.6, 8.8], [23.6, 8.8], [27, 13], [27, 18.6], [19.6, 18.6]], [1.2, 1.2, 1.4, KR, 0.6]);
      const win = rp([[21, 10.4], [23, 10.4], [25.2, 13.4], [21, 13.4]], 0.6);
      const wheel = (cx) => `<path d="${circ(cx, 20.4, 2.8)}" ${DEEP}/><path d="${circ(cx, 20.4, 1.2)}" fill="#fff"/>`;
      return `<g data-n="t">
        <g filter="${u.sh}"><g filter="${u.hi}"><path d="${cargo}" fill="${u.loS}"/></g></g><path d="${cargo}" ${OL}/>
        <path d="${lines(7, 9, [8.6, 5.6])}" ${WHITE_LN}/>
        <g filter="${u.hi}"><path d="${cab}" fill="${u.upS}"/></g><path d="${cab}" ${OL}/>
        <path d="${win}" fill="#fff"/>
        ${wheel(8.6)}${wheel(22.4)}</g>`;
    },
    target: (h) => ({ x: h ? 1 : -0.2, y: h ? -0.4 : 0 }),
    draw(p, E) { at(E.t, { transform: `translate(${f(p.x)} ${f(p.y)})` }); },
  },
  {
    name: 'day-book',
    accent: '#8A6AD6',
    // An open ledger; the right-hand page lifts to turn.
    svg: (u) => {
      const cover = rr(4, 3.6, 23, 19.4, KR);
      const left = rr(5.8, 5.4, 9.4, 15.8, CR);
      const right = rr(15.8, 5.4, 9.4, 15.8, CR);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${cover}" fill="${u.loS}"/></g></g><path d="${cover}" ${OL}/>
        <path d="${left}" fill="#fff"/><path d="${lines(7.6, 9.4, [5.8, 4, 5.8])}" ${LINE}/>
        <path d="${right}" fill="#fff"/><path d="${lines(17.6, 9.4, [5.8, 4.4])}" ${LINE}/>
        <g data-n="pg"><path d="${right}" fill="#fff"/><path d="${right}" ${OL}/><path d="${lines(17.6, 9.4, [5.8, 4, 5.8])}" class="ln" ${DEEPS}/></g>
        <path d="M15.5 5.4V21.2" class="ln" ${DEEPS}/>`;
    },
    target: (h) => ({ s: h ? 0.35 : 1 }),
    draw(p, E) {
      at(E.pg, { transform: `translate(15.5 0) scale(${f(Math.max(0.01, p.s))} 1) translate(-15.5 0)` });
    },
  },
  {
    name: 'reports',
    accent: '#2C9C9A',
    // A clipboard report whose bars grow.
    svg: (u) => {
      const board = rr(6.2, 3.6, 18.6, 19.4, KR);
      const sheet = rr(8.4, 7, 14.2, 13.8, CR);
      const clip = rr(11.4, 1.6, 8.2, 4.6, 1.4);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${board}" fill="${u.loS}"/></g></g><path d="${board}" ${OL}/>
        <path d="${sheet}" fill="#fff"/>
        <path data-n="b1" ${DEEP}/><path data-n="b2" ${DEEP}/><path data-n="b3" ${DEEP}/>
        <g filter="${u.hi}"><path d="${clip}" fill="${u.upS}"/></g><path d="${clip}" ${OL}/>`;
    },
    target: (h) => ({ hg: h ? [8.4, 5, 10.4] : [4.4, 8, 6.4] }),
    draw(p, E) {
      [10.6, 14.2, 17.8].forEach((x, i) => {
        const hh = p.hg[i];
        at(E['b' + (i + 1)], { d: rp(R(x, 19 - hh, 2.6, hh), [0.8, 0.8, 0.3, 0.3]) });
      });
    },
  },

  // ===== Brick manufacturing =====
  ...[
    ['brick-4', '4', '#E0A13A', 2.8],
    ['brick-8', '8', '#2F9C8F', 4.4],
    ['brick-9', '9', '#C4552A', 5.4],
  ].map(([name, digit, accent, d]) => ({
    name,
    accent,
    // A brick (top depth shows its width class) that lifts on hover.
    svg: (u) => {
      const w = 18.4, h = 9.4;
      const x = 15.5 - (w + d) / 2, y = 12.5 - (h + d) / 2;
      const b = brickFaces(x, y, w, h, d);
      const label = `<text x="${f(x + w / 2)}" y="${f(y + d + h / 2 + 2.6)}" text-anchor="middle" font-size="7.6" font-weight="800" font-family="Inter, system-ui, sans-serif" fill="#fff" data-w="fill">${digit}"</text>`;
      return `<g data-n="br">${brickSvg(u, b, label)}</g>`;
    },
    target: (h) => ({ y: h ? -1.6 : 0 }),
    draw(p, E) { at(E.br, { transform: `translate(0 ${f(p.y)})` }); },
  })),
  {
    name: 'brick-stack',
    accent: '#C4552A',
    // Three bricks; the top one is lifted into place on hover.
    svg: (u) => {
      const w = 10, h = 5.8, d = 2.6;
      const x0 = 4.2, yb = 11.2, yt = 5.4, xt = 9.2;
      const a = brickFaces(x0, yb, w, h, d), b = brickFaces(x0 + w, yb, w, h, d), c = brickFaces(xt, yt, w, h, d);
      return `${brickSvg(u, a)}${brickSvg(u, b)}<g data-n="top">${brickSvg(u, c)}</g>`;
    },
    target: (h) => ({ y: h ? -2.4 : 0, r: h ? -5 : 0 }),
    draw(p, E) { at(E.top, { transform: `translate(0 ${f(p.y)}) rotate(${f(p.r)} 14.2 9.6)` }); },
  },
  {
    name: 'factory',
    accent: '#B85C3B',
    // A brick works with a chimney; smoke puffs rise on hover.
    svg: (u) => {
      const body = rp([[4, 23], [4, 11.4], [9.4, 8], [9.4, 11.4], [14.8, 8], [14.8, 11.4], [20.2, 8], [20.2, 23]], [KR, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6]);
      const chim = rp(R(20.2, 6.4, 5.6, 16.6), [1.2, 1.2, KR, 0.4]);
      const win = (x) => rr(x, 14.2, 3.2, 3.6, 0.8);
      return `<g data-n="sm"><g filter="${u.hi}"><path d="${circ(23, 3.4, 2)}" fill="${u.upS}"/></g><path d="${circ(23, 3.4, 2)}" ${OL}/>
          <g filter="${u.hi}"><path d="${circ(26.4, 1.2, 1.5)}" fill="${u.upS}"/></g><path d="${circ(26.4, 1.2, 1.5)}" ${OL}/></g>
        <g filter="${u.sh}"><g filter="${u.hi}"><path d="${body}" fill="${u.loS}"/></g></g><path d="${body}" ${OL}/>
        <path d="${win(6.2)}" fill="#fff"/><path d="${win(11.6)}" fill="#fff"/><path d="${win(15.4)}" fill="#fff"/>
        <g filter="${u.hi}"><path d="${chim}" fill="${u.upS}"/></g><path d="${chim}" ${OL}/>
        <path d="M21.6 10H24.4M21.6 13H24.4" class="ln" ${DEEPS}/>`;
    },
    target: (h) => ({ y: h ? -2.2 : 0, s: h ? 1.2 : 1 }),
    draw(p, E) { at(E.sm, { transform: `translate(0 ${f(p.y)}) translate(23 3.4) scale(${f(p.s)}) translate(-23 -3.4)` }); },
  },
  {
    name: 'machinery',
    accent: '#5B7DB8',
    // A brick press: the ram comes down onto the brick.
    svg: (u) => {
      const frame = rp([[5, 2.8], [26, 2.8], [26, 21], [21.8, 21], [21.8, 7.2], [9.2, 7.2], [9.2, 21], [5, 21]], [KR, KR, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6]);
      const base = rr(3.6, 19.8, 23.8, 3.2, 1);
      const brick = rr(11.6, 15.4, 7.8, 4.4, 0.8);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${frame}" fill="${u.loS}"/></g></g><path d="${frame}" ${OL}/>
        <path d="${brick}" fill="${u.upS}"/><path d="${brick}" ${OL}/>
        <g data-n="ram"><path d="${rr(14.3, 4, 2.4, 6.4, 0.6)}" ${DEEP}/>
          <g filter="${u.hi}"><path d="${rr(11, 9.4, 9, 3, 0.8)}" fill="${u.upS}"/></g><path d="${rr(11, 9.4, 9, 3, 0.8)}" ${OL}/></g>
        <g filter="${u.hi}"><path d="${base}" fill="${u.upS}"/></g><path d="${base}" ${OL}/>`;
    },
    // Hover: the ram's face (y 12.4 + 3) meets the brick top (15.4) exactly.
    target: (h) => ({ y: h ? 3 : 0 }),
    draw(p, E) { at(E.ram, { transform: `translate(0 ${f(p.y)})` }); },
  },
  {
    name: 'storage',
    accent: '#6E8CA8',
    // A silo whose level gauge fills up.
    svg: (u) => {
      // A material silo: domed top, level window, cone hopper on two legs.
      const silo = 'M8.2 15.4V8.4C8.2 5.2 11.4 2.8 15.5 2.8C19.6 2.8 22.8 5.2 22.8 8.4V15.4Z';
      const cone = rp([[8.2, 15.4], [22.8, 15.4], [17.8, 20.4], [13.2, 20.4]], [0.8, 0.8, 0.9, 0.9]);
      const win = rr(13.3, 6.2, 4.4, 7.6, CR);
      return `<path d="M10 16L8 23M21 16L23 23" class="ln" stroke-width="2.2" ${DEEPS}/>
        <path d="${rr(13.6, 20, 3.8, 3, 0.8)}" ${DEEP}/>
        <g filter="${u.sh}"><g filter="${u.hi}"><path d="${silo}" fill="${u.loS}"/></g></g><path d="${silo}" ${OL}/>
        <path d="${win}" fill="#fff"/><path data-n="lv" ${DEEP}/>
        <g filter="${u.hi}"><path d="${cone}" fill="${u.upS}"/></g><path d="${cone}" ${OL}/>`;
    },
    target: (h) => ({ lv: h ? 6.4 : 2.6 }),
    draw(p, E) { at(E.lv, { d: rp(R(13.3, 13.8 - p.lv, 4.4, p.lv), [0.3, 0.3, CR, CR]) }); },
  },

  // ===== Raw materials =====
  {
    name: 'fly-ash',
    accent: '#8792A3',
    // A heap of fine ash; dust puffs drift up.
    svg: (u) => {
      const heap = 'M4 21.6C5.8 15.6 9.8 11.4 15.5 11.4C21.2 11.4 25.2 15.6 27 21.6Q27.4 23 26 23H5Q3.6 23 4 21.6Z';
      // Lower band of the heap as the light front piece, top corners rounded.
      const front = 'M6.6 18.6H24.4Q25.4 18.6 25.9 19.5Q26.5 20.6 27 21.6Q27.4 23 26 23H5Q3.6 23 4 21.6Q4.5 20.6 5.1 19.5Q5.6 18.6 6.6 18.6Z';
      return `<g data-n="dust">
          <g filter="${u.hi}"><path d="${circ(11, 6.6, 2.2)}" fill="${u.upS}"/></g><path d="${circ(11, 6.6, 2.2)}" ${OL}/>
          <g filter="${u.hi}"><path d="${circ(18.6, 4.2, 2.8)}" fill="${u.upS}"/></g><path d="${circ(18.6, 4.2, 2.8)}" ${OL}/></g>
        <g filter="${u.sh}"><g filter="${u.hi}"><path d="${heap}" fill="${u.loS}"/></g></g><path d="${heap}" ${OL}/>
        <g filter="${u.hi}"><path d="${front}" fill="${u.upS}"/></g><path d="${front}" ${OL}/>`;
    },
    target: (h) => ({ y: h ? -1.8 : 0, s: h ? 1.15 : 1 }),
    draw(p, E) { at(E.dust, { transform: `translate(0 ${f(p.y)}) translate(15 6) scale(${f(p.s)}) translate(-15 -6)` }); },
  },
  {
    name: 'lime',
    accent: '#D1AE34',
    // A tied lime sack; the neck opens on hover.
    svg: (u) => {
      const sack = 'M9.4 7.4Q15.5 9 21.6 7.4L24.6 19.4Q25.2 23 21.8 23H9.2Q5.8 23 6.4 19.4Z';
      const label = rr(10.2, 12.4, 10.6, 6.8, CR);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${sack}" fill="${u.loS}"/></g></g><path d="${sack}" ${OL}/>
        <path d="${label}" fill="#fff"/><path d="${lines(12.2, 14.6, [6.6, 4.2])}" class="ln" ${DEEPS}/>
        <g filter="${u.hi}"><path data-n="nk" fill="${u.upS}"/></g><path data-n="nkO" ${OL}/>`;
    },
    target: (h) => ({ o: h ? 2 : 0 }),
    draw(p, E) {
      const o = p.o;
      const d = rp([[10.6, 7.8], [12.4 - o, 2.4], [18.6 + o, 2.4], [20.4, 7.8]], [0.8, 1, 1, 0.8]);
      at(E.nk, { d }); at(E.nkO, { d });
    },
  },
  {
    name: 'quarry-dust',
    accent: '#A57A52',
    // A gravel pile; one stone rolls down on hover.
    svg: (u) => {
      const pile = 'M3.8 21.8C5.4 17.2 9.4 13.6 15.5 13.6C21.6 13.6 25.6 17.2 27.2 21.8Q27.6 23 26.2 23H4.8Q3.4 23 3.8 21.8Z';
      const stone = (x, y, s) => rp([[x - 2.4 * s, y + 0.6 * s], [x - 1 * s, y - 2 * s], [x + 2 * s, y - 1.4 * s], [x + 2.6 * s, y + 1.2 * s], [x, y + 2.2 * s]], 0.9);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${pile}" fill="${u.loS}"/></g></g><path d="${pile}" ${OL}/>
        ${[[8.2, 20.4, 0.62], [12.8, 18.2, 0.7], [16.6, 20.6, 0.58], [22, 19.8, 0.66]].map(([x, y, s2]) =>
          `<g filter="${u.hi}"><path d="${stone(x, y, s2)}" fill="${u.upS}"/></g><path d="${stone(x, y, s2)}" ${OL}/>`).join('')}
        <g data-n="rk"><g filter="${u.hi}"><path d="${stone(17.6, 11.6, 1)}" fill="${u.upS}"/></g><path d="${stone(17.6, 11.6, 1)}" ${OL}/></g>`;
    },
    target: (h) => ({ x: h ? 4.6 : 0, y: h ? 2.6 : 0, r: h ? 90 : 0 }),
    draw(p, E) { at(E.rk, { transform: `translate(${f(p.x)} ${f(p.y)}) rotate(${f(p.r)} 17.6 11.6)` }); },
  },
  {
    name: 'cement',
    accent: '#7D8796',
    // A stitched cement bag that tips forward.
    svg: (u) => {
      // A filled sack: sides bulge out, corners pinched into small ears.
      const bag = 'M7.6 3.6Q15.5 5.4 23.4 3.6Q24.6 3.4 24.4 4.6Q22.8 13.3 24.4 21.8Q24.6 23 23.4 22.8Q15.5 21.2 7.6 22.8Q6.4 23 6.6 21.8Q8.2 13.3 6.6 4.6Q6.4 3.4 7.6 3.6Z';
      const patch = rr(9.4, 10.2, 12.2, 7.8, 1.6);
      return `<g data-n="bg"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${bag}" fill="${u.loS}"/></g></g><path d="${bag}" ${OL}/>
        <path d="M9 7.4Q15.5 8.8 22 7.4" ${WHITE_LN} stroke-dasharray="1.6 1.4"/>
        <g filter="${u.hi}"><path d="${patch}" fill="${u.upS}"/></g><path d="${patch}" ${OL}/>
        <path d="${lines(11.6, 13, [7.8, 5])}" class="ln" ${DEEPS}/></g>`;
    },
    target: (h) => ({ r: h ? -7 : 0 }),
    draw(p, E) { at(E.bg, { transform: `rotate(${f(p.r)} 15.5 23)` }); },
  },
  {
    name: 'gypsum',
    accent: '#7FA3CF',
    // Gypsum crystals; the front crystal tilts to catch the light.
    svg: (u) => {
      const back = rp([[8.6, 22.6], [7.4, 12.4], [12.2, 3.6], [17.2, 12], [16.2, 22.6]], [1, 1.2, 0.8, 1.2, 1]);
      const front = rp([[14.4, 23], [13.8, 15.4], [19.4, 7.8], [24.8, 15], [23.6, 23]], [1, 1.2, 0.8, 1.2, 1]);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${back}" fill="${u.loS}"/></g></g><path d="${back}" ${OL}/>
        <path d="M12.2 6.4V20.6" ${WHITE_LN}/>
        <g data-n="fc"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${front}" fill="${u.upS}"/></g></g><path d="${front}" ${OL}/>
          <path d="M19.4 10.8L17.2 15.6M19.4 10.8L21.6 15.6" class="ln" ${DEEPS}/></g>`;
    },
    target: (h) => ({ r: h ? -8 : 0 }),
    draw(p, E) { at(E.fc, { transform: `rotate(${f(p.r)} 19 23)` }); },
  },
  {
    name: 'water',
    accent: '#3D8FE0',
    // A water drop that squashes softly as it lands.
    svg: (u) => {
      const drop = 'M15.5 2C19.6 7.4 23.2 11.6 23.2 16C23.2 20.2 19.8 23.2 15.5 23.2C11.2 23.2 7.8 20.2 7.8 16C7.8 11.6 11.4 7.4 15.5 2Z';
      const front = frontPiece([15.5, 16, 7.7], [15.5, 16, 7.7], 18.4, 1.6);
      return `<g data-n="dr"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${drop}" fill="${u.loS}"/></g></g><path d="${drop}" ${OL}/>
        <g filter="${u.hi}"><path d="${front}" fill="${u.upS}"/></g><path d="${front}" ${OL}/>
        <path d="M11.4 13.6Q11.8 11 13.6 9.4" ${WHITE_LN}/></g>`;
    },
    target: (h) => ({ sx: h ? 1.08 : 1, sy: h ? 0.92 : 1 }),
    draw(p, E) { at(E.dr, { transform: `translate(15.5 23.2) scale(${f(p.sx)} ${f(p.sy)}) translate(-15.5 -23.2)` }); },
  },
  {
    name: 'coal',
    accent: '#5A6474',
    // Coal lumps; the top lump settles on hover.
    svg: (u) => {
      const big = rp([[5.2, 20.6], [7.6, 12.4], [13.4, 9.6], [19, 12.6], [19.8, 20], [15.2, 23], [8.2, 23]], 1.3);
      const small = rp([[15.6, 23], [17, 17.6], [21.8, 15.6], [26, 18.6], [25.6, 23]], 1.1);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${big}" fill="${u.loS}"/></g></g><path d="${big}" ${OL}/>
        <path d="M9.6 15.4L12.8 13.6" ${WHITE_LN}/>
        <g data-n="sm"><g filter="${u.hi}"><path d="${small}" fill="${u.upS}"/></g><path d="${small}" ${OL}/></g>`;
    },
    target: (h) => ({ r: h ? -6 : 0 }),
    draw(p, E) { at(E.sm, { transform: `rotate(${f(p.r)} 25.6 23)` }); },
  },

  // ===== Finance =====
  ...[
    ['money-received', '#2BA36B', 1],
    ['payments', '#E05A47', -1],
  ].map(([name, accent, dir]) => ({
    name,
    accent,
    // A note going into (received) or out of (payment) the cash tray.
    svg: (u) => {
      const tray = rr(4, 13.6, 23, 9.4, KR);
      const lip = rp(R(4, 17.6, 23, 5.4), [1.4, 1.4, KR, KR]);
      const note = rr(0, 0, 15, 9.6, 1.4);
      const ax = 7.5;
      const arrow = dir > 0
        ? `<path d="M${ax} 1.8V5.6" class="ln" stroke-width="2.2" ${DEEPS}/><path d="${arrowHead(ax, 5.2, 1)}" ${DEEP}/>`
        : `<path d="M${ax} 7.8V4" class="ln" stroke-width="2.2" ${DEEPS}/><path d="${arrowHead(ax, 4.4, -1)}" ${DEEP}/>`;
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${tray}" fill="${u.loS}"/></g></g><path d="${tray}" ${OL}/>
        <g data-n="nt"><g filter="${u.hi}"><path d="${note}" fill="${u.upS}"/></g><path d="${note}" ${OL}/>${arrow}</g>
        <g filter="${u.hi}"><path d="${lip}" fill="${u.upS}"/></g><path d="${lip}" ${OL}/>`;
    },
    // Received: note sits on the tray top, then drops to touch the lip. Payment: reverse.
    target: (h) => ({ y: (dir > 0 ? h : !h) ? 8 : 4 }),
    draw(p, E) { at(E.nt, { transform: `translate(8 ${f(p.y)})` }); },
  })),
  ...[
    ['revenue', '#2E8BC9', [5, 8, 11.6], [7.4, 11, 14.4], true],
    ['expenses', '#E07A3C', [11.6, 8.4, 5.4], [9.6, 6.2, 3.4], false],
  ].map(([name, accent, rest, hover, up]) => ({
    name,
    accent,
    // Bars that climb (revenue) or fall (expenses), with a trend arrow badge.
    svg: (u) => {
      const box = rr(5.2, 2.2, 20.6, 20.6, KR);
      const badge = circ(up ? 21.8 : 21.8, 7.2, 3.8);
      const arr = up
        ? `<path d="M21.8 9.4V6.4" class="ln" stroke-width="2.2" ${DEEPS}/><path d="${arrowHead(21.8, 6.8, -1)}" ${DEEP}/>`
        : `<path d="M21.8 5V8" class="ln" stroke-width="2.2" ${DEEPS}/><path d="${arrowHead(21.8, 7.6, 1)}" ${DEEP}/>`;
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${box}" fill="${u.loS}"/></g></g><path d="${box}" ${OL}/>
        <path data-n="b1" fill="#fff"/><path data-n="b2" fill="#fff"/><path data-n="b3" fill="#fff"/>
        <g filter="${u.hi}"><path d="${badge}" fill="${u.upS}"/></g><path d="${badge}" ${OL}/>${arr}`;
    },
    target: (h) => ({ hg: h ? hover : rest }),
    draw(p, E) {
      [8.2, 12.4, 16.6].forEach((x, i) => {
        const hh = p.hg[i];
        at(E['b' + (i + 1)], { d: rp(R(x, 20 - hh, 3, hh), [0.9, 0.9, 0.4, 0.4]) });
      });
    },
  })),
  {
    name: 'profit',
    accent: '#D9A21B',
    // A stack of coins and a big coin that hops up.
    svg: (u) => {
      const coin = (y) => rr(4.6, y, 13, 3.6, 1.8);
      const stack = [19.4, 15.8, 12.2].map((y, i) => {
        const fill = i % 2 ? u.upS : u.loS;
        return `<g filter="${u.hi}"><path d="${coin(y)}" fill="${fill}"/></g><path d="${coin(y)}" ${OL}/>`;
      }).join('');
      return `<g filter="${u.sh}">${stack}</g>
        <g data-n="bc"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${circ(20.6, 14, 6.2)}" fill="${u.upS}"/></g></g><path d="${circ(20.6, 14, 6.2)}" ${OL}/>
          <text x="20.6" y="17.4" text-anchor="middle" font-size="9" font-weight="800" font-family="Inter, system-ui, sans-serif" ${DEEP}>₹</text></g>`;
    },
    target: (h) => ({ y: h ? -3 : 0 }),
    draw(p, E) { at(E.bc, { transform: `translate(0 ${f(p.y)})` }); },
  },
  {
    name: 'outstanding',
    accent: '#D9534F',
    // An unpaid bill with a clock; the minute hand moves on.
    svg: (u) => {
      const doc = rp([[6, 1.6], [17.4, 1.6], [21.4, 5.6], [21.4, 22.8], [6, 22.8]], [KR, 0.5, 0.5, KR, KR]);
      const fold = rp([[17.4, 1.6], [21.4, 5.6], [17.4, 5.6]], [0.4, 0.4, 1]);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${doc}" fill="${u.loS}"/></g></g><path d="${doc}" ${OL}/>
        <path d="${lines(9, 9.6, [8.6, 5.8])}" ${WHITE_LN}/>
        <g filter="${u.hi}"><path d="${fold}" fill="${u.upS}"/></g><path d="${fold}" ${OL}/>
        <g filter="${u.sh}"><path d="${circ(21.2, 17.6, 5.2)}" fill="#fff"/></g><path d="${circ(21.2, 17.6, 5.2)}" ${OL}/>
        <path d="M21.2 17.6V14.8" class="ln" stroke-width="2" ${DEEPS}/>
        <path data-n="mh" d="M21.2 17.6H24" class="ln" stroke-width="2" ${DEEPS}/>
        <path d="${circ(21.2, 17.6, 1.2)}" ${DEEP}/>`;
    },
    target: (h) => ({ r: h ? 120 : 0 }),
    draw(p, E) { at(E.mh, { transform: `rotate(${f(p.r)} 21.2 17.6)` }); },
  },

  // ===== Kubai examples (licence allows use inside products) =====
  {
    name: 'settings',
    accent: '#6B7A90',
    svg: (u) => {
      const G = gear(6, 11.4, 9);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><g data-n="gear"><path d="${G}" fill="${u.loS}"/></g></g></g><g data-n="gearO"><path d="${G}" ${OL}/></g>
        <path d="${circ(15.5, 12.5, 5.8)}" fill="#fff"/>
        <g filter="${u.hi}"><path data-n="hub" fill="${u.upS}"/></g><path data-n="hubO" ${OL}/>`;
    },
    target: (h) => ({ rot: h ? 60 : 0, hub: h ? 2.9 : 3.5 }),
    draw(p, E) {
      at(E.gear, { transform: `rotate(${f(p.rot)} 15.5 12.5)` }); at(E.gearO, { transform: `rotate(${f(p.rot)} 15.5 12.5)` });
      const d = circ(15.5, 12.5, p.hub);
      at(E.hub, { d }); at(E.hubO, { d });
    },
  },
  {
    name: 'notifications',
    accent: '#E0A030',
    svg: (u) => {
      const bell = 'M7.8 18.4C9 17 9.3 15 9.3 12C9.3 8 12 5.2 15.5 5.2C19 5.2 21.7 8 21.7 12C21.7 15 22 17 23.2 18.4Z';
      const rim = rr(5.6, 17.4, 19.8, 3.8, 1.9);
      return `<g data-n="bell">
        <circle cx="15.5" cy="4.4" r="1.8" ${DEEP}/>
        <circle data-n="clap" cx="15.5" cy="21.4" r="2.3" ${DEEP}/>
        <g filter="${u.sh}"><g filter="${u.hi}"><path d="${bell}" fill="${u.loS}"/></g></g><path d="${bell}" ${OL}/>
        <g filter="${u.hi}"><path d="${rim}" fill="${u.upS}"/></g><path d="${rim}" ${OL}/>
      </g>`;
    },
    target: (h) => ({ swing: h ? 14 : 0, clap: h ? -1.6 : 0 }),
    draw(p, E) {
      at(E.bell, { transform: `rotate(${f(p.swing)} 15.5 4.4)` });
      at(E.clap, { cx: f(15.5 + p.clap) });
    },
  },
  {
    name: 'home',
    accent: '#E2683C',
    svg: (u) => {
      const roof = rp([[3.6, 12.6], [15.5, 2.4], [27.4, 12.6]], [1.4, 2.2, 1.4]);
      const door = rp(R(13.2, 15.6, 4.6, 7.4), [1.2, 1.2, 0, 0]);
      return `
      <g filter="${u.sh}"><g filter="${u.hi}"><path d="${rr(7.4, 10.6, 16.2, 12.4, KR)}" fill="${u.loS}"/></g></g>
      <path d="${rr(7.4, 10.6, 16.2, 12.4, KR)}" ${OL}/>
      <path d="${door}" fill="${u.pure('#2F6FE0')}"/>
      <g data-n="door"><path d="${door}" fill="#fff"/></g>
      <g filter="${u.hi}"><path d="${roof}" fill="${u.upS}"/></g>
      <path d="${roof}" ${OL}/>`;
    },
    target: (h) => ({ door: h ? 0.3 : 1 }),
    draw(p, E) {
      at(E.door, { transform: `translate(13.2 0) scale(${f(Math.max(0.001, p.door))} 1) translate(-13.2 0)` });
    },
  },
];


