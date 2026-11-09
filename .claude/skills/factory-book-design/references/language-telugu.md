# Language: writing for the owner, in English and Telugu

## API (`src/core/i18n.js`)

```jsx
const { t, lang } = useT();                 // lang: 'en' | 'te' (saved in localStorage 'brickerp_lang')
t('home.today')                             // key lookup, falls back to English
t('stock.worth', { v: formatINR(x) })       // {name} placeholders
pick(lang, { en: '…', te: '…' })            // for generated text (insight tips)
materialName(lang, 'Quarry Dust')           // 'mat.<Name>' lookup → 'క్వారీ డస్ట్'
translate(lang, key, vars)                  // outside React (widgets, PDFs)
```

`LanguageToggle` sits on Home (compact) and in More (wide). Switching language also
re-labels the Android widgets.

Add every new key to **both** the `TE` and `EN` maps, grouped by screen prefix
(`home.`, `stock.`, `prod.`, `ins.`, `more.`, `nav.`, `unit.`). Dynamic keys must keep a
literal prefix (``t(`more.${key}`)``) so unused-key checks can see them.

## Voice

- The reader runs a brick factory and is not a computer person. Plain words, short sentences, no jargon.
  - "Money Spent", not "Cash Leakage"; "Cash & Bank", not "Single Source of Truth".
  - "To collect" / "To pay", not "Receivables" / "Payables" on the main screens.
- Name things the way the factory does: lorry, load, m³ (1 lorry = 6), 4″/8″/9″ bricks,
  Hamali, fly ash, lime, quarry dust.
- Numbers in Indian format (₹1,00,000) via `formatINR` / `formatNumber`.
- Tips say what to *do*: "Quarry Dust will run out in about 2 days — order early",
  then the reason in one line.
- Warnings explain the consequence and the way out.

## Telugu layout rules

- Telugu strings run ~30% longer and need more line height; nothing may be cut off.
  Use wrapping (`break-words`), not `truncate`, for titles and labels.
- The nav labels and the widget labels are tested in Telugu — keep new nav/tab labels to
  one short word (హోమ్, అమ్మకాలు, ఉత్పత్తి, స్టాక్, విశ్లేషణ).
- Keep English product codes and money as they are (₹, 9″, m³); translate the words around them.
- Fonts: Noto Sans Telugu is in the body font stack; Android widgets use the system font.
- Always check a new screen at 375px wide in Telugu before finishing.
