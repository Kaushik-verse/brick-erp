# Tokens

All colours are CSS variables holding **RGB triplets** (`--c-ember-500: 222 98 44`) so
Tailwind opacity modifiers work (`bg-ember-500/15`). Two themes share the same names:

- `:root` — the classic Brick ERP dark "kiln" theme.
- `.theme-light` on `<html>` — **Factory Book**. `AppV3.jsx` adds it on start.

In Factory Book the clay scale is *inverted*: `clay-50` is the darkest text, `clay-500`
the lightest. Always write `text-clay-50` for primary text and it is right in both apps.

## Factory Book palette (`.theme-light`)

| Token | RGB | Hex | Use |
|---|---|---|---|
| page background | — | `#F7F3ED` | `body` |
| `kiln-800` | 255 255 255 | `#FFFFFF` | cards, nav bar |
| `kiln-900` | 247 243 237 | `#F7F3ED` | page |
| `kiln-700` | 240 233 224 | `#F0E9E0` | inset areas |
| `clay-50` | 28 23 18 | `#1C1712` | headings, figures |
| `clay-100` | 38 31 25 | `#261F19` | body text |
| `clay-200` | 62 52 43 | `#3E342B` | strong labels |
| `clay-300` | 92 79 67 | `#5C4F43` | labels |
| `clay-400` | 112 98 85 | `#706255` | secondary text, section titles |
| `clay-500` | 138 124 110 | `#8A7C6E` | hints, captions |
| `ember-400` | 194 77 30 | `#C24D1E` | links, accent text |
| `ember-500` | 222 98 44 | `#DE622C` | **the accent**: primary buttons, active tab, eyebrows |
| `ember-600` | 196 78 30 | `#C44E1E` | pressed / gradient end |
| `ledger-paid` | 30 135 80 | `#1E8750` | money in, paid, healthy |
| `ledger-partial` | 178 112 18 | `#B27012` | partly paid, warnings |
| `ledger-overdue` | 196 52 44 | `#C4342C` | overdue, low stock, money out |
| `ledger-credit` | 62 96 150 | `#3E6096` | on credit, informational |

Status colour always comes with a word (never colour alone): use `StatusPill status="paid|partial|credit|overdue"`.

Tinted backgrounds behind icons/tiles: the item's accent at **8% alpha** — `style={{ background: `${hex}14` }}`.

## Brick sizes (fixed — used in charts, chips, icons, widgets)

| Size | Fill | Dark | Soft |
|---|---|---|---|
| 4″ | `#E0A13A` amber | `#A86F12` | `#FBF0DC` |
| 8″ | `#2F9C8F` teal | `#1D6B61` | `#DDF1EE` |
| 9″ | `#C4552A` brick | `#8E3415` | `#F8E3D9` |

`sizeColor(size)` in `src/factory-book/visuals.jsx` returns these (with a hashed fallback for new sizes).

## Materials (bins, scenes, icons)

| Material | Top / Left / Right faces | Icon accent |
|---|---|---|
| Fly ash | `#C3C9D0` / `#A3ABB5` / `#858E99` | `#8792A3` |
| Lime | `#F4EBC2` / `#E0D39A` / `#C7B979` | `#D1AE34` |
| Gypsum | `#E1EAF6` / `#BFD0E7` / `#A1B6D3` | `#7FA3CF` |
| Quarry dust | `#CDA780` / `#B18A62` / `#91704D` | `#A57A52` |

## Type

| Role | Font | Size / weight |
|---|---|---|
| Screen title | Fraunces (`font-display`) | 23px (26px ≥ sm), semibold, `leading-tight`, wraps |
| Eyebrow above title | Inter | 11px, semibold, `uppercase tracking-[0.14em] text-ember-400/80` |
| Section label | Inter | 11–12px bold uppercase `tracking-wide text-clay-400` |
| Body | Inter, Noto Sans Telugu fallback | 14–15px |
| Figures (₹, counts) | JetBrains Mono via `.figure` (tabular) | 15–24px bold |
| Hints | Inter | 11px `text-clay-500` |

Fonts load from Google Fonts **without blocking first paint** (`media="print" onload`
swap in `index.html`). Body stack: `'Inter', 'Noto Sans Telugu', system-ui`.

## Shape and depth

- Radius: cards `rounded-2xl` (20px), sheets `rounded-t-3xl` (28px), chips/inputs `rounded-xl`–`2xl`, pills `rounded-full`.
- Card (`.theme-light .glass-surface`): white, `1px rgba(60,40,20,.08)` border,
  shadow `0 1px 2px rgba(60,40,20,.06), 0 6px 20px -8px rgba(60,40,20,.14)`.
  **No backdrop blur in the light theme** — it costs GPU on phones and is invisible on white.
- Inset (`glass-surface-light`): `#F3EDE5`, same hairline.
- Sheet (`sheet-surface`): white, shadow `0 -12px 40px -8px rgba(60,40,20,.25)`.
- Hairlines: `border-white/10` is remapped to `rgba(60,40,20,.10)` in the light theme.
- Desktop hover lift: class `lift` (−2px and a deeper shadow, only on hover-capable devices).

## Spacing

Page gutter `px-5` (20px), `md:px-8`; vertical rhythm `space-y-4` between cards,
`space-y-3` inside forms; content max width `max-w-3xl`; bottom padding `pb-32` on tab
screens so the nav never covers the last card.
