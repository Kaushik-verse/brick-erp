# Factory Book: visual assets

All assets are original, drawn for Brick ERP with the skills installed in
`.claude/skills/`. They are used only by the **New app** (`npm run dev:new`);
the Classic app is unchanged.

| Asset | Made with | Source | Used in the app |
|---|---|---|---|
| 30 rich 3D clay icons (brick sizes, press, factory, silo, materials, finance, actions) | **Kubai Icons** method and engine | `src/v3/icons3d/brickIcons.js` | `<Icon3D name="…"/>`: bottom bar, Home cards, Today, More tiles, Stock, Production, Insights |
| 4 isometric scenes (press line, stock yard, delivery lorry, sales counter) | **Anatomy** iso kit + lathe | `design/illustrations/build.mjs` | `<Illustration name="…"/>`: Production, Stock, Insights, loading screen |
| Animated material bins | SVG + **SVG Creator** lighting rules | `src/v3/IsoBin.jsx` | Stock |

Three icons (`settings`, `notifications`, `home`) are Kubai's own examples. Its
licence allows using them inside products.

## Regenerate

```bash
node design/brick-icons/sync.mjs && node design/brick-icons/scripts/check.mjs --out design/brick-icons/check-out   # icon screenshots
node design/illustrations/build.mjs      # isometric scenes → src/v3/illustrations/scenes.js
```

Motion: icons play their own movement on hover (mouse) or tap (touch), 460 ms
ease-out. Scenes loop gently and only while visible. Everything is still for
users who turn on "reduce motion" on their phone.

## Going back to the previous version

A full copy of the code from before this redesign is kept in
`.checkpoints/checkpoint-before-3d/`, which git ignores. Ask Claude to "revert
the 3D redesign" and it will restore that copy.

## Licences

Kubai engine: `src/v3/icons3d/engine.js` keeps its copyright notice; the licence
is in `src/v3/icons3d/KUBAI-LICENSE`. Anatomy kit: MIT. SVG Creator: Apache-2.0.
