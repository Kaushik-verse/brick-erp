# Motion and performance

Target: a mid-range Android phone (4–6× slower than a laptop). Every rule below came
from a measurement on the production build; keep them.

## What moves, and how

| Element | Motion | Timing | Mechanism |
|---|---|---|---|
| Screen change | fade in | 150 ms ease-out | CSS `screen-enter` (**opacity only**) |
| Card entrance | rise 10px + fade | 420 ms `cubic-bezier(.22,1,.36,1)` | CSS `card-enter`, `backwards` fill |
| Header entrance | drop 6px + fade | 350 ms ease-out | CSS `header-enter` |
| Card press | scale .98 | 120 ms | CSS `card-press:active` |
| Bottom sheet | slide up | spring 340 / 34 | framer-motion (needs exit animation) |
| Nav tab selected | pop .82 → 1.12 → 1 | 420 ms | CSS `nav-pop` |
| 3D icon | its own object motion | 460 ms same ease | Kubai engine, on hover/tap only |
| Scenes | gentle loops | 1.2–7.5 s | CSS, paused off-screen |
| Bins | fill rises once, grains loop | — | SVG/CSS, off for reduced motion |

Every animation has a `prefers-reduced-motion: reduce` off switch.

## Hard rules

1. **Animate only `opacity` and `transform`.** No animated `width/height/top/filter/box-shadow`.
2. **Never put a `transform` on an ancestor of `position: fixed` UI.** It makes the fixed
   bar attach to the moving element (the Sale screen's Save bar ended up off-screen).
   That is why the screen wrapper fades without sliding.
3. **No JavaScript-driven entrances.** framer-motion springs on every card meant ~330
   style writes per screen; CSS does the same on the compositor. Keep framer-motion for
   sheets and toasts (they need exit animations).
4. **No `AnimatePresence mode="wait"` between screens** — it made every tap wait for the
   old screen's exit (~300 ms before the new screen rendered).
5. **No backdrop blur in the light theme**; avoid SVG filters on many elements (icons use
   the cached snapshot instead).
6. **Loops stop when not visible** (IntersectionObserver), and never run on reduced motion.
7. **Load heavy code on demand:** jsPDF (~440 KB) and ExcelJS (~940 KB) only when a PDF or
   Excel file is made; sub-screens are lazy and prefetched when idle. Don't add a
   `manualChunks` entry for them — that once dragged Vite's preload helper into the PDF
   chunk and loaded it at start-up.
8. **Fonts must not block first paint.**

## Budgets (production build, 375×812)

| Measure | Budget | Current |
|---|---|---|
| JS loaded at start | ≤ 1 MB | 905 KB (was 2.3 MB) |
| Tap → new screen painted | ≤ 60 ms on a laptop | 28–49 ms (was 210–250 ms) |
| Worst frame while switching / scrolling | ≤ 20 ms | 18 ms, 0 janky frames |
| Home DOM nodes | ≤ 500 | 361 (was 1,137) |
| JS heap | ≤ 25 MB | 13–16 MB |

## How to measure

Run the production build (`npm run build:new && npx vite preview --port 4174`) in a
**visible** browser tab at 375×812 (a hidden tab pauses animation frames and the numbers
lie). Then:

- startup JS: `performance.getEntriesByType('resource')` filtered to `.js`, sum `decodedBodySize`
- tap → paint: click a nav button and time until two `requestAnimationFrame`s after the new screen is added to `<main>`
- frames: record `requestAnimationFrame` gaps for 1–1.5 s while switching and while scrolling; count gaps > 34 ms
- JS animation work: `MutationObserver` on `style` attributes — should be ~0 after an entrance
