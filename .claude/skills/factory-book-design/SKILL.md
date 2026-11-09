---
name: factory-book-design
description: Design system for Factory Book (the new-design Brick ERP app) — warm light "fired clay" palette, clay-style 3D icons (Kubai method), isometric scenes (Anatomy kit), animated isometric material bins, motion and performance rules, Telugu-first copy, and the Android home-screen widgets. Use whenever you add or change any Factory Book screen, card, form, icon, illustration, animation, widget or app icon, or build a new app/page that should look like Factory Book — even if the request only says "make it match the app", "add an icon", "add a screen" or "make this look premium".
---

# Factory Book design system

Factory Book is a ledger app for a fly-ash brick factory, used daily by an owner who is
not a computer person, often outdoors, often in Telugu. Every design choice serves that:
**large, plain, warm, readable in sunlight, fast on a mid-range Android phone.**

The look in one line: *a clean cream page of white cards, a brick-ember accent, and
small hand-made clay objects (3D icons, isometric scenes) that move only when touched.*

## Where things live

| What | Source of truth |
|---|---|
| Colour tokens (both themes) | `src/index.css` (`:root` = classic dark, `.theme-light` = Factory Book) and `tailwind.config.js` |
| Screens | `src/factory-book/*V3.jsx`; shared screens/forms in `src/features/**` |
| Shared UI | `src/core/ui/` — `GlassCard`, `ScreenHeader`, `BottomSheet`, `GlassButton`, `GlassFormControls`, `StatusPill`, `ScreenTransition` |
| 3D icons | `src/factory-book/icons3d/` — `brickIcons.js` (30 icons), `engine.js` (Kubai engine), `Icon3D.jsx` |
| Isometric scenes | `design/illustrations/build.mjs` → generates `src/factory-book/illustrations/scenes.js` |
| Material bins | `src/factory-book/IsoBin.jsx` |
| Simple charts | `src/factory-book/visuals.jsx` (`PairedBars`, `BarList`, `Ring`, `Initials`, `sizeColor`) |
| Words (EN + Telugu) | `src/core/i18n.js` |
| App icon | `design/app-icon/` |
| Home-screen widgets | `android/app/src/main/res/layout/widget_*.xml`, `WidgetRenderer.java`, `src/core/hooks/WidgetSync.jsx` |
| Third-party kit (MIT) | `vendor/anatomy-kit/` in this skill (used by the scene builder) |

## Non-negotiable rules

1. **Use tokens, never raw hex in screens.** Text `text-clay-50…500`, surfaces
   `glass-surface` / `glass-surface-light` / `sheet-surface`, accent `ember-500`,
   status `ledger-paid|partial|overdue|credit`. Raw hex is allowed only inside icon,
   scene, bin and widget artwork. → `references/tokens.md`
2. **One card = one idea.** Cards are `GlassCard` (white, 20px radius, soft warm
   shadow). A section title is an 11–12px uppercase label in `text-clay-400`.
3. **Numbers are the hero.** Money and counts use `figure` + bold; ₹ via
   `formatINR`, counts via `formatNumber` (Indian grouping). Never show raw floats.
4. **Every tap target ≥ 44px**, primary actions full-width or in the pinned action bar.
5. **Text may wrap, never silently cut.** Titles use `break-words`; reserve `truncate`
   for secondary lines with a fallback (names, file labels).
6. **Rarely used fields go in a closed "More details (optional)" section** whose header
   summarises what is filled (see the Sale screen). Don't make the owner scroll past
   transport/vehicle/remarks every time.
7. **Every label exists in English and Telugu.** Add keys to both `EN` and `TE` in
   `i18n.js`; Telugu is ~30% longer and taller — test it. → `references/language-telugu.md`
8. **Pick a 3D icon for every main action and section header** — never a lucide icon
   there. lucide is for small inline glyphs only (chevrons, close, back).
   → `references/icons-3d.md`
9. **Motion is earned:** icons move on hover/tap, scenes loop only while on screen,
   entrances are CSS on `opacity`/`transform`, everything stops for reduced-motion.
   Never put a `transform` on an ancestor of `position: fixed` UI.
   → `references/motion-and-performance.md`
10. **Pinned bars sit on `--nav-h`.** Anything fixed to the bottom uses
    `bottom-[var(--nav-h,88px)]`; the nav publishes its real height and hides while
    typing. → `references/components-and-layout.md`

## How to work

- **New screen:** start from an existing `*V3.jsx` — `ScreenHeader` (eyebrow + title +
  optional action), a scene or summary card at top, then cards. Wrap content in
  `px-5 md:px-8 space-y-4 max-w-3xl mx-auto` and give the page `pb-32` so the nav never
  covers the last card.
- **New form:** a `BottomSheet` with `GlassInput` / `GlassSelect` / `GlassToggleGroup`;
  guard the save handler against double taps (`if (saving) return`) and disable the button.
- **New icon:** add an entry to `brickIcons.js` following the Kubai layering, then run
  the checker. → `references/icons-3d.md`
- **New scene:** add a function to `design/illustrations/build.mjs`, run
  `node design/illustrations/build.mjs`, use `<Illustration name="…"/>`.
  → `references/isometric-scenes.md`
- **New widget / widget change:** respect RemoteViews limits. → `references/android-widgets.md`
- **Before you finish:** check at 375×812 in English *and* Telugu, light theme, with a
  real tap on every new button, and run `npm run build:new`.

## Reference files

- `references/tokens.md` — palette (light + dark), type, radius, shadow, surfaces, status colours
- `references/components-and-layout.md` — page skeleton, cards, headers, sheets, forms, nav, pinned bars, collapsible sections
- `references/icons-3d.md` — the clay icon method, full icon list with accents, adding an icon, performance snapshot
- `references/isometric-scenes.md` — scene builder, painter's order, materials, animation classes, bins
- `references/motion-and-performance.md` — timing, easing, what may animate, measured budgets
- `references/language-telugu.md` — i18n API, writing for the owner, Telugu layout rules
- `references/android-widgets.md` — widget palette, layouts, RemoteViews rules, data flow
- `references/app-icon.md` — launcher icon art and how to regenerate it

## Credits and licences

Original artwork for this project. Methods and code from: **Kubai Icons** (engine copy in
`src/factory-book/icons3d/engine.js`, licence `KUBAI-LICENSE` beside it; three icons —
`settings`, `notifications`, `home` — are Kubai's own examples, allowed in products),
**Anatomy** isometric kit (MIT, © Ryan — copied to `vendor/anatomy-kit/`), and lighting
rules from **SVG Creator** (Apache-2.0). Keep these notices when copying.
