# Android home-screen widgets

Two widgets, same warm style as the app, light and dark:

| Widget | Size | Shows |
|---|---|---|
| **Today** (`TodayWidgetProvider`, `widget_today.xml`) | 2×2 (min 140dp) | today's sales (22sp, ember), received (green), bricks made; footer: low-stock warning *or* "Updated 5:40 pm" |
| **Factory overview** (`OverviewWidgetProvider`, `widget_overview.xml`) | 4×2 (min 280×140dp) | three tiles (sales / received / bricks), bricks-ready chips per size, to collect / to pay; header right: warning *or* update time |

## Data flow

`src/core/hooks/WidgetSync.jsx` (mounted in both apps) builds the payload on start, 3 s
after any data change, on language change and every 5 min, and calls the Capacitor
plugin `WidgetPlugin.syncKpis({ data })`:

```json
{ "date": "2026-11-06", "timeText": "Updated 5:40 pm",
  "todaySales": 9000, "todayReceived": 9000, "todayBricks": 864,
  "receivables": 0, "payables": 81607.5,
  "stock": [{ "size": "4″", "qty": 170 }, { "size": "8″", "qty": 0 }, { "size": "9″", "qty": 2600 }],
  "alert": "Low stock: Quarry Dust",
  "labels": { "today": "Today", "sales": "Sales", … } }
```

`WidgetPlugin.java` saves it to SharedPreferences and calls `WidgetRenderer.updateAll`.
`WidgetRenderer.java` draws both widgets. If `date` is not today the "today" figures show
"—" and the time line says "Open app to update" — never show yesterday's numbers as today's.

## Visual tokens (`res/values/widget_colors.xml`, dark in `values-night/`)

| Token | Light | Dark |
|---|---|---|
| `widget_bg` / `widget_stroke` | `#FBF7F2` / `#EADFD2` | `#211C18` / `#3A322B` |
| `widget_tile` | `#FFFFFF` | `#2B2520` |
| `widget_ink` / `widget_muted` | `#2B241D` / `#8A7C6E` | `#F4EEE7` / `#A89A8C` |
| `widget_accent` / `widget_green` | `#C4552A` / `#1E8750` | `#E07A4F` / `#4CC38A` |
| `widget_warn` on `widget_warn_bg` | `#A8650E` on `#FCEFD8` | `#E9B04F` on `#3A2E1C` |
| size chips 4″ / 8″ / 9″ | amber / teal / brick (see `tokens.md`) | darker backgrounds, lighter text |

Shapes: background radius 24dp + 1dp stroke, tiles 14dp, chips and warning 10dp.
Header: the round launcher icon at 20dp + 13sp bold title.

## RemoteViews rules (break these and the widget shows "Can't load widget")

- Only `FrameLayout`, `LinearLayout`, `RelativeLayout`, `GridLayout`, `TextView`,
  `ImageView`, `Button`, `ImageButton`, `ProgressBar`, list/stack views. **No plain
  `<View>`** — use an empty `FrameLayout` as a spacer.
- No custom fonts, no blur, no SVG; shapes via `<shape>` drawables, colours via resources.
- Every text view `maxLines="1"` + `ellipsize="end"`; size for Telugu (taller lines).
- Only one of {warning, time} per widget — there is no room for both.
- Picker names come from `widget_strings.xml` (`values-te/` has Telugu).

## Checking a change without a phone

Mirror the layout in an HTML mock at 1 CSS px = 1 dp (same paddings, sizes, colours),
render it at 160×160 and 330×160 in light/dark and English/Telugu, and confirm nothing
overflows. Then build (`npm run android:build:new`) and verify with
`aapt2 dump xmltree` that the layouts and receivers are in the APK.
