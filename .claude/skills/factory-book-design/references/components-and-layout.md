# Components and layout

## App shell (`src/factory-book/AppV3.jsx`)

- Five tabs in `BottomNavV3`: Home, Sales, Production, Stock, Insights. Everything else
  opens from the grid button on Home → **More** (`MoreV3`: big 3D-icon tiles in groups
  Daily work / Data safety / Setup).
- A sub-screen replaces the tab content and shows a back arrow; the nav stays visible
  (hiding it was an old bug in the classic app — users got stuck).
- Sub-screens are `React.lazy` and **prefetched when the app is idle**, so the first
  open is instant without parsing them at start-up.
- `ScreenTransition` fades the new screen in (opacity only — see motion rules).

## Page skeleton

```jsx
<div className="pb-32 md:pb-12 md:pt-6">
  <ScreenHeader eyebrow={t('x.eyebrow')} title={t('x.title')} action={<GlassButton size="sm" icon={Plus}>Add</GlassButton>} />
  <div className="px-5 md:px-8 space-y-4 max-w-3xl mx-auto">
    <div className="glass-surface rounded-3xl overflow-hidden px-2 pt-1"><Illustration name="stock" /></div>
    <GlassCard padding="p-4">…</GlassCard>
  </div>
</div>
```

## Building blocks (`src/core/ui`)

| Component | Props | Notes |
|---|---|---|
| `ScreenHeader` | `eyebrow, title, subtitle, action, onBack` | Title wraps (`break-words`), never truncates. Keep eyebrows plain words ("Money Spent", not "Cash Leakage"). |
| `GlassCard` | `padding='p-4', onClick, animate=true, light, className` | CSS entrance (`card-enter`), CSS press (`card-press`). With `onClick` it is a `role="button"` div so it may contain buttons. |
| `GlassButton` | `variant='primary'\|'glass'\|'ghost'\|'danger', size='md'\|'sm', icon, fullWidth, disabled` | md = 48px tall, sm = 44px. One primary button per view. |
| `GlassInput` | `label, prefix ('₹'), error, …input props` | Uppercase 12px label; use `inputMode="decimal"` for money, `numeric` for counts. |
| `GlassSelect`, `GlassTextarea` | `label, error` | |
| `GlassToggleGroup` | `options=[{value,label,icon}], value, onChange, label` | Payment mode: Cash / UPI / Bank / Cheque. |
| `BottomSheet` | `open, onClose, title, maxHeight='88vh'` | Spring slide-up, drag handle only on the top strip, Android back closes it (`pushBackHandler`). Sits above the nav (z-50). |
| `StatusPill` | `status='paid'\|'partial'\|'credit'\|'overdue', size` | Always pair colour with the word. |
| `ToastStack` | via `useUIStore().pushToast(text, 'success'\|'error'\|'info')` | Short sentences. |

## Home screen pattern

Greeting (date eyebrow in ember, Fraunces greeting, factory name) → **Today** card
(4 tiles: 3D icon in an 8%-tinted square + label + figure) → **quick actions** (3×2 grid,
44px 3D icon, label) → **Tips for you** (2 lines, opens Insights) → **This month**
(money in / out tiles + sales / to collect / to pay) → backup status strip.
Do not duplicate data another tab already shows at the top (e.g. stock counts).

## Forms

- Open as a `BottomSheet` from the place the owner already is (Home quick action,
  ledger sheet). Save button is the last element, full width, primary.
- **Guard double taps:** `if (saving) return; setSaving(true) … finally setSaving(false)`
  and `disabled={saving}`.
- Pre-fill what is known (today's date, the product's selling price, "Paid in full").
- Accept how people type: product names match loosely ("9 inch", `9"`, "9" → `9-inch`);
  purchases accept a **bill total** and work the rate out (₹14,000 per lorry).
- Units in the owner's words: quarry dust is "m³ (1 lorry = 6)", lime/fly ash in tons.
- **Rarely used fields** go in a closed card at the bottom: header "More details
  (optional)", a one-line hint, a chevron, `aria-expanded`; when closed the hint is
  replaced by a summary of what is filled ("Transport ₹500 · AP37AB1234").
- Confirm destructive or surprising actions with a sentence that says the consequence
  ("₹500 is more than the balance … kept as an advance. Continue?").

## Navigation bar and pinned bars

`BottomNavV3` publishes CSS variable `--nav-h` (its measured height, 0 on desktop or while
typing) and toggles `html.kb-open` while a text field has focus (CSS hides the nav then).
Anything pinned to the bottom of a screen uses:

```jsx
<div className="fixed bottom-[var(--nav-h,88px)] md:bottom-0 left-0 md:left-64 right-0 z-30 …">
```

Never hard-code the nav height — text size and Telugu make it taller (79px → 97px).

Nav tabs: 3D icon 30px inside a 56×36 pill; inactive icons are softly greyed
(`.nav3d` grayscale .55), the active one pops (`nav-pop`) and holds its moved pose
(`Icon3D active`). Labels 11.5px semibold, ember when active.

## Lists and ledgers

- Party ledgers show bills newest first with `StatusPill`. **Later payments settle the
  oldest bills first** (`applyPaymentsToBills` in `src/core/billing/partyLedger.js`) so a
  paid bill never shows as due. Use it anywhere a per-bill balance is displayed.
- Empty states: one plain sentence and the next action ("No expenses this month.").

## Desktop

At `md` the nav becomes a 256px left sidebar ("Factory Book" title), pinned bars start at
`md:left-64`, content stays `max-w-3xl` centred. Design phone-first; desktop must just
not break.
