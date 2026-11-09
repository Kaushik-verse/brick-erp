# Design sources

Sources for Factory Book's artwork. How to *use* the design system (tokens, components,
rules) is in the skill: [`.claude/skills/factory-book-design/SKILL.md`](../.claude/skills/factory-book-design/SKILL.md).

| Folder | What | Output used by the app |
|---|---|---|
| `brick-icons/` | gallery and checker for the 30 clay 3D icons (Kubai method) | definitions live in `src/factory-book/icons3d/brickIcons.js` |
| `illustrations/` | builder for the 4 isometric scenes (Anatomy kit) + SVG previews | `src/factory-book/illustrations/scenes.js` |
| `app-icon/` | Factory Book launcher icon art and renderer; classic icon source | `android/app/src/newdesign/res/mipmap-*` |

## Regenerate

```bash
# 3D icons: copy the app's definitions into the gallery, then render check sheets
node design/brick-icons/sync.mjs
node design/brick-icons/scripts/check.mjs --out design/brick-icons/check-out

# Isometric scenes → src/factory-book/illustrations/scenes.js (+ previews here)
node design/illustrations/build.mjs

# Launcher icons for every density (needs Google Chrome)
node design/app-icon/render.mjs
```

The scene builder imports the Anatomy kit from
`.claude/skills/factory-book-design/vendor/anatomy-kit/`, so it works on a fresh clone.

## Licences

All artwork is original to this project. Kubai engine: `src/factory-book/icons3d/engine.js`
keeps its copyright notice, licence in `src/factory-book/icons3d/KUBAI-LICENSE`; the
`settings`, `notifications` and `home` icons are Kubai's own examples, allowed in products.
Anatomy kit: MIT (`vendor/anatomy-kit/LICENSE` in the skill). SVG Creator lighting rules: Apache-2.0.
