# Isometric scenes and material bins

## Scenes

Four explanatory pictures of the real business, drawn as **true isometric objects**
(not flat illustrations) with the Anatomy kit: many small solid parts, four-tone shading,
correct painter's order, gentle looping motion.

| Name | Shows | Used on |
|---|---|---|
| `production` | brick press: ram presses, bricks ride the belt, pallet layers fill up | Production tab |
| `stock` | yard: three silos, brick pallets (top layer lifts), lime bags | Stock tab |
| `delivery` | lorry on a road (dashes scroll) | app loading screen |
| `sales` | counter: till, ledger, a coin drops onto the stack | Insights |

```jsx
import Illustration from './illustrations/Illustration';
<div className="glass-surface rounded-3xl overflow-hidden px-2 pt-1"><Illustration name="stock" /></div>
```

`Illustration` lazy-loads `scenes.js` (~300 KB of SVG strings, loaded once), injects the
kit CSS once, and pauses every animation while the picture is off screen
(IntersectionObserver → `data-paused`). Animations are off for reduced-motion users.

## Building / changing a scene

Source: `design/illustrations/build.mjs` → writes `src/factory-book/illustrations/scenes.js`
and preview SVGs next to the script. Run `node design/illustrations/build.mjs`.
The kit is vendored in this skill: `vendor/anatomy-kit/iso-kit.mjs` and `lathe.mjs` (MIT).

Inside a scene function:

```js
const S = scene(380, 230, bounds, { azimuth: 45 });   // projection fitted to the bounds
S.box({ x, y, w, d }, z, h, 'steel');                 // extruded rounded box
S.cyl(cx, cy, r, z, h, 'lime');                       // cylinder (silos, coins)
S.add(S.depth(centre), svg, bias);                    // custom part with explicit depth
brickwork(S, plan, z, h, course, brickLen);            // brick joints on visible faces
pallet(S, plan); floor(S, plan);
return svgOf(S, 'Stock yard', S.render());            // render() sorts back → front
```

Rules:

- **Painter's order is depth-sorted per part.** When two parts overlap wrongly (a chassis
  drawn over its load), split the part or pass a small `bias` — never fix it with z-index.
- **Materials are classes** that re-tint the kit's tone variables: `m-brick`, `m-steel`,
  `m-wood`, `m-ash`, `m-lime`, `m-quarry`, `m-floor`, `m-road`, `m-tyre`, `m-glass`,
  `m-lamp`, `m-screen`, `m-paint`, `m-blue`, `m-gold`, `m-cash`, `m-ledger`, `m-paper`,
  `m-ok`, `m-ink`. Add a material in `src/factory-book/illustrations/illustrations.css`;
  don't inline colours.
- Moving parts are wrapped in a group with an `anim-*` class and CSS variables `--dx/--dy`
  computed with `S.shift([wx, wy, wz])` so motion follows the isometric axes.
- Animation classes (in `illustrations.css`): `anim-ram` 3.2s, `anim-belt` 3.2s,
  `anim-stack` + `anim-layer` 7.5s, `anim-lift` 4.2s, `anim-truck` 6s, `anim-road` 1.2s,
  `anim-coin` 3.6s — all `transform`/`opacity` only.
- Keep each scene under ~110 KB of SVG; current sizes 47–102 KB.

## Material bins (`src/factory-book/IsoBin.jsx`)

An isometric open bin per raw material on the Stock tab:

```jsx
<IsoBin name="Lime" pct={62} reorderPct={20} low={false} width={104} delay={idx * 180} />
```

- The material **rises to its real level** when the screen opens; grains pour in from the
  top and the surface shimmers; a **dashed red line marks the reorder level**; the bin
  pulses red when low.
- A full bin means ~45 days of production, so the picture shows *how long it lasts*,
  not just how much.
- Colours come from `binLook(name)` (fly ash grey powder, lime yellow powder, gypsum blue
  crystals, quarry dust brown grain) — see `tokens.md`.
- viewBox 120×132, pure SVG, ~2 KB each, lighting from top-left (top face lightest,
  right face darkest).
