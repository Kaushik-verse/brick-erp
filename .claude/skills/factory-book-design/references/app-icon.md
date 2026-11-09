# App icon

**Factory Book** launcher icon: an ember-orange ledger book with cream pages, a small
brick on the cover and a gold ribbon bookmark, on a warm cream background — drawn in the
same clay style as the 3D icons (back/front pieces, soft coloured shadow, top inner light).

| File | What |
|---|---|
| `design/app-icon/art.mjs` | the artwork (108×108 canvas, art inside Android's 66dp safe zone) |
| `design/app-icon/render.mjs` | renders all launcher sizes |
| `design/app-icon/factory-book-icon.svg`, `-512.png`, `-round-512.png` | previews |
| `android/app/src/newdesign/res/mipmap-*` | generated launcher icons (adaptive + round) for the Factory Book build |
| `design/app-icon/brick-erp-classic-icon.png` | source art of the classic Brick ERP icon |

Palette: background `#FFF6EC → #F3E1CC`, cover `#EE8457 → #DB6233 → #C24F24`, spine
`#A9421C → #C2522A`, pages `#FFF8EE → #EBD9C2`, ribbon `#F7C24B → #E09A1B`.

Regenerate: `node design/app-icon/render.mjs` (needs headless Chrome), then
`npm run android:build:new`. The Factory Book build picks its icons and the
"Factory Book" name from `android/app/src/newdesign/res` via the `-PnewApp` flag in
`android/app/build.gradle`.
