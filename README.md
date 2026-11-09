# Brick ERP / Factory Book

An offline-first ledger app for a fly-ash brick factory: sales and bills, payments,
purchases, production with recipes, stock, expenses, cash & bank day book, insights and
automatic backups. React + Vite + Tailwind + Dexie (IndexedDB), packaged for Android with
Capacitor. No server: data lives on the phone and is backed up to phone storage and the
owner's Google Drive.

One codebase builds **two separate Android apps** that can be installed side by side:

| App | Look | Package | Build |
|---|---|---|---|
| **Factory Book** (current) | light "fired clay" design, 3D icons, isometric scenes, Telugu mode, Insights | `com.brickworks.erp.newdesign` | `npm run android:build:new` → `apk/FactoryBook.apk` |
| **Brick ERP** (classic) | original dark design | `com.brickworks.erp` | `npm run android:build:classic` → `apk/BrickERP-Classic.apk` |

## Quick start

```bash
npm install
npm run dev:new        # Factory Book in the browser → http://localhost:5174
npm run dev            # classic app → http://localhost:5173
npm run build:new      # production web build of Factory Book (dist/)
```

Android builds need the Android SDK and sign with this machine's debug keystore, so
updates must be built on the same machine as the installed app (see
[docs/upgrade-guide.md](docs/upgrade-guide.md)).

## Project structure

```
src/
  main.jsx               picks the app: VITE_APP_VARIANT=new → Factory Book, else classic
  App.jsx                classic Brick ERP shell
  factory-book/          Factory Book shell and screens (AppV3, Home, Production, Stock,
                         Insights, More), 3D icons (icons3d/), isometric scenes
                         (illustrations/), material bins (IsoBin), one-time data fixes (fixes/)
  features/              screens and forms shared by both apps (sales, purchases,
                         expenses, passbook, documents, settings …)
  core/
    db/                  Dexie schema, ledger and recipe engines, KPIs
    backup/  drive/      automatic phone + Google Drive backups, restore, snapshots
    billing/             invoice maths and numbers, party ledgers, PDFs/messages data
    insights/            business tips for the Insights tab
    hooks/  store/  ui/  utils/   shared hooks, state, UI components, helpers
    i18n.js              English + Telugu text
    appVariant.js        names that differ per app (backup folders, Drive file names)
design/                  sources for the artwork (icons, isometric scenes, app icon)
android/                 Capacitor Android project, home-screen widgets
docs/                    owner-facing guides
.claude/skills/factory-book-design/   the design system as a reusable skill
```

## Design system

Everything about the look — tokens, components, 3D clay icons, isometric scenes, bins,
motion and performance rules, Telugu copy, widgets, app icon — is documented in the
**`factory-book-design`** skill: [`.claude/skills/factory-book-design/SKILL.md`](.claude/skills/factory-book-design/SKILL.md).
Claude Code loads it automatically in this repo; people can read it as plain Markdown.
Asset sources and regeneration commands are in [design/README.md](design/README.md).

## Data safety

- Automatic backup about a minute after every change and whenever the app is closed:
  phone storage (`Documents/FactoryBook/Backups`, survives uninstall) and, once
  connected, a private Google Drive app folder.
- 30 daily copies plus **one copy per month kept forever**; a safety copy before every
  restore or reset.
- Each app uses its own folder and Drive file names, so the two apps never overwrite each
  other's backups.
- Real backups and bundled seed data are git-ignored (`*Backup*.json`, `src/factory-book/seed/`).

See [docs/upgrade-guide.md](docs/upgrade-guide.md) for installing updates without losing data.
