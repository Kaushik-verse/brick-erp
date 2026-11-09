# 3D clay icons (Kubai method)

Small, soft, clay-like objects drawn in SVG: a **back piece and a front piece**, each
filled with a vertical gradient of the icon's accent, **outlined outside** with a 1-unit
deeper edge, lit by a **top inner highlight** and resting on a **soft coloured shadow**.
Each icon has **one accent colour** and **one motion the object itself would make**
(a bill rises, a coin drops into a wallet, a brick lifts).

## Files

- `src/factory-book/icons3d/brickIcons.js` — the 30 icon definitions (`ICONS`, `ICON_BY_NAME`).
- `src/factory-book/icons3d/engine.js` — Kubai engine (geometry helpers, gradients,
  filters, outside strokes, motion). Keep its copyright header; licence in `KUBAI-LICENSE`.
- `src/factory-book/icons3d/Icon3D.jsx` — React component.
- `design/brick-icons/` — gallery + checker workspace (`index.html`, `scripts/check.mjs`, `scripts/export.mjs`).

## Using an icon

```jsx
<Icon3D name="new-sale" size={44} />            // in a 56px square tinted with the accent at 8%
<Icon3D name="home" size={30} active={on} />    // nav: holds the moved pose while active
```

Sizes in use: 24 (inline with a material name), 30 (nav), 34–38 (tiles, tips),
44 (quick actions, More tiles), 48–52 (brick rows). Below 24px use lucide instead.

## The set (name — accent)

| Business | Bricks & plant | Materials | Money & system |
|---|---|---|---|
| `new-sale` #E2683C | `brick-4` #E0A13A | `fly-ash` #8792A3 | `money-received` #2BA36B |
| `payment-in` #2BA36B | `brick-8` #2F9C8F | `lime` #D1AE34 | `payments` #E05A47 |
| `expense` #E0A030 | `brick-9` #C4552A | `quarry-dust` #A57A52 | `revenue` #2E8BC9 |
| `purchase` #4C7BD9 | `brick-stack` #C4552A | `cement` #7D8796 | `expenses` #E07A3C |
| `day-book` #8A6AD6 | `factory` #B85C3B | `gypsum` #7FA3CF | `profit` #D9A21B |
| `reports` #2C9C9A | `machinery` #5B7DB8 | `water` #3D8FE0 | `outstanding` #D9534F |
| | `storage` #6E8CA8 | `coal` #5A6474 | `settings` #6B7A90 · `notifications` #E0A030 · `home` #E2683C · `insights` #D9A21B |

Mapping helpers already in screens: `brick3d(size)` → `brick-4|8|9|stack`,
`material3d(name)` → material icon. Nav: home→`home`, sales→`new-sale`,
production→`factory`, stock→`brick-stack`, insights→`insights`.

## Anatomy of an entry

```js
{
  name: 'new-sale',
  accent: '#E2683C',
  // Canvas 31×29 (viewBox "0 -2 31 29"); keep artwork in x 4–27, y 2–23.
  svg: (u) => `
    <g data-n="rc">                                   <!-- named part that moves -->
      <g filter="${u.sh}"><g filter="${u.hi}">        <!-- shadow + top highlight -->
        <path d="${rc}" fill="${u.loS}"/></g></g>     <!-- back piece: lower gradient -->
      <path d="${rc}" ${OL}/>                         <!-- outside outline -->
    </g>
    <g data-n="pl"> … fill="${u.upS}" … </g>`,        // front piece: upper gradient
  target: (hover) => ({ y: hover ? -1.4 : 0, r: hover ? 90 : 0 }),  // numbers only
  draw(p, E) {                                         // apply interpolated numbers
    at(E.rc, { transform: `translate(0 ${f(p.y)})` });
    at(E.pl, { transform: `rotate(${f(p.r)} 21.4 17.8)` });
  },
}
```

Rules that keep the set coherent:

- Colours are written as the reference blue (`#5393FF` outline, `#D3E2FC` light lines,
  `#2F6FE0` deep marks) with `data-t` / `data-w` attributes — the engine re-tints them to
  the accent. Never hard-code the accent inside `svg()`.
- Fills: back piece `u.loS` (lower gradient), front piece `u.upS` (upper), solids `u.pure('#4389FF')`.
- Outlines use `class="ol"` (2-unit stroke masked to its outer half); detail lines `class="ln"` (1.6, round caps).
- Shared shapes: `rr` (rounded rect), `rp` (rounded polygon), `circ`, `lines`, `gear`, `receipt`, `brickFaces`.
- Motion: one or two parts, small distances (≤2 units, ≤90°), 460 ms, ease `cubic-bezier(.22,1,.36,1)`, reversible mid-way.
- Reduced motion → the engine jumps straight to the end pose.

## Adding an icon

1. Add the entry to `ICONS` (pick an accent that is not already used nearby on screen).
2. `node design/brick-icons/sync.mjs` then
   `node design/brick-icons/scripts/check.mjs --only my-icon --with new-sale,lime --out design/brick-icons/check-out`
   and look at `rest.png`, `hover.png`, `frames.png`, `size-24.png`.
3. Check it at 24px — if the idea disappears, simplify.

## Performance (measured — keep it)

A live icon is ~45 SVG nodes, 2 SVG filters and a mask per outline, rebuilt by script on
every mount. `Icon3D` therefore renders a **cached `<img>` snapshot of the resting pose**
(same pixels: the snapshot inlines the `.ol/.ln` CSS and pads the viewBox by 5 units so
the shadow is not clipped) and swaps to the live engine on the first hover/tap or when
`active`. Home went from 1,137 DOM nodes / 40 filters to 261 / 2. Do not render live
icons in long lists.
