import { create } from 'zustand';

/**
 * i18n.js — English / Telugu for the New app.
 *
 * `useT()` returns { t, lang, setLang }. `t('key', { n: 5 })` fills {n}.
 * Missing Telugu falls back to English, so a screen never shows blanks.
 * The choice is remembered on this phone.
 */
const KEY = 'brickerp_lang';

function initial() {
  try {
    return localStorage.getItem(KEY) === 'te' ? 'te' : 'en';
  } catch {
    return 'en';
  }
}

export const useLangStore = create((set) => ({
  lang: initial(),
  setLang: (lang) => {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang === 'te' ? 'te' : 'en';
    set({ lang });
  },
}));

const TE = {
  // Navigation
  'nav.home': 'హోమ్',
  'nav.sales': 'అమ్మకాలు',
  'nav.production': 'ఉత్పత్తి',
  'nav.stock': 'స్టాక్',
  'nav.insights': 'విశ్లేషణ',

  // Home
  'home.morning': 'శుభోదయం',
  'home.afternoon': 'శుభ మధ్యాహ్నం',
  'home.evening': 'శుభ సాయంత్రం',
  'home.today': 'ఈరోజు',
  'home.sales': 'అమ్మకాలు',
  'home.received': 'వచ్చిన డబ్బు',
  'home.bricksMade': 'తయారైన ఇటుకలు',
  'home.expenses': 'ఖర్చులు',
  'home.newSale': 'కొత్త అమ్మకం',
  'home.paymentIn': 'డబ్బు వసూలు',
  'home.production': 'ఉత్పత్తి',
  'home.expense': 'ఖర్చు',
  'home.purchase': 'కొనుగోలు',
  'home.dayBook': 'రోజు పుస్తకం',
  'home.tips': 'మీ కోసం సూచనలు',
  'home.thisMonth': 'ఈ నెల',
  'home.moneyIn': 'వచ్చిన డబ్బు',
  'home.moneyOut': 'వెళ్ళిన డబ్బు',
  'home.toCollect': 'రావాల్సింది',
  'home.toPay': 'ఇవ్వాల్సింది',
  'home.safe': 'డేటా భద్రంగా ఉంది',
  'home.backupAttention': 'బ్యాకప్ చూడాలి',
  'home.lastBackup': 'చివరి బ్యాకప్ {when}',
  'home.setupBackup': 'బ్యాకప్ సెట్ చేయడానికి తాకండి',
  'home.allOptions': 'అన్ని ఎంపికలు',

  // Stock
  'stock.title': 'స్టాక్',
  'stock.eyebrow': 'లెక్క సరిచేయడానికి దేనినైనా తాకండి',
  'stock.bricksReady': 'అమ్మకానికి సిద్ధమైన ఇటుకలు',
  'stock.raw': 'ముడి సరుకులు',
  'stock.worth': 'విలువ సుమారు {v}',
  'stock.sellCost': 'అమ్మకం ₹{sell} · ఖర్చు ₹{cost}',
  'stock.lastsDays': 'సుమారు {n} రోజులు సరిపోతుంది',
  'stock.lastsMonths': '2 నెలలకు పైగా సరిపోతుంది',
  'stock.low': 'తక్కువగా ఉంది — త్వరగా ఆర్డర్ చేయండి',
  'stock.notUsed': 'ఇటీవల వాడలేదు',
  'stock.legend': 'ఎరుపు గీత = మళ్ళీ ఆర్డర్ చేయాల్సిన స్థాయి. గత 30 రోజుల ఉత్పత్తి ఆధారంగా “సరిపోతుంది” లెక్క.',

  // Units & materials
  'unit.Ton': 'టన్నులు',
  'unit.loads': 'క్యూ.మీ',
  'stock.lorries': '≈ {n} లారీలు',
  'mat.Fly Ash': 'ఫ్లై యాష్',
  'mat.Lime': 'సున్నం',
  'mat.Gypsum': 'జిప్సం',
  'mat.Quarry Dust': 'క్వారీ డస్ట్',

  // Production
  'prod.title': 'ఉత్పత్తి',
  'prod.eyebrow': 'తయారైన ఇటుకలు',
  'prod.add': 'జోడించు',
  'prod.total': 'ఈ నెల మొత్తం',
  'prod.avgCost': 'సగటు ఖర్చు',
  'prod.darker': 'ముదురు రంగు = ఆ రోజు ఎక్కువ ఇటుకలు.',
  'prod.none': '{m} లో ఉత్పత్తి నమోదు కాలేదు',
  'prod.noneHint': 'ఈరోజు ఇటుకలు నమోదు చేయడానికి “జోడించు” తాకండి.',
  'prod.bricks': 'ఇటుకలు',
  'prod.cost': 'ఖర్చు {total} · ఒక్కొక్కటి ₹{each}',
  'prod.weekdays': 'ఆ,సో,మం,బు,గు,శు,శ',

  // Insights
  'ins.title': 'విశ్లేషణ',
  'ins.eyebrow': 'మీ వ్యాపారం — సులభంగా',
  'ins.loading': 'మీ వ్యాపారాన్ని చూస్తున్నాం…',
  'ins.next': 'తరువాత ఏమి చేయాలి',
  'ins.allFine': 'అంతా బాగుంది. రోజూ నమోదు చేస్తూ ఉండండి — సూచనలు ఇక్కడ కనిపిస్తాయి.',
  'ins.money': 'వచ్చిన డబ్బు, వెళ్ళిన డబ్బు',
  'ins.moneyIn': 'వచ్చిన డబ్బు',
  'ins.moneyOut': 'చెల్లించిన డబ్బు',
  'ins.moneyNote': 'ఆకుపచ్చ = వచ్చిన డబ్బు (అమ్మకాలు + వసూళ్లు). ఎరుపు = వెళ్ళిన డబ్బు (సరుకు, సప్లయర్లు, ఖర్చులు). ప్లస్ అంటే వెళ్ళిన దానికంటే ఎక్కువ వచ్చింది.',
  'ins.brickCost': 'ఒక ఇటుకకు ఎంత ఖర్చు',
  'ins.brick': '{s} ఇటుక',
  'ins.soldMonth': 'నెలకు సుమారు {n} అమ్ముడవుతాయి',
  'ins.youKeep': 'మీకు మిగిలేది',
  'ins.materials': 'ముడి సరుకు',
  'ins.labour': 'కూలీ',
  'ins.other': 'ఇతర ఖర్చులు',
  'ins.soldAt': 'అమ్మిన ధర',
  'ins.brickNote': 'ముడి సరుకు ఖర్చు ఈరోజు సగటు ధరలు, మీ రెసిపీల ఆధారంగా. “ఇతర ఖర్చులు” అంటే డీజిల్, కూలీలు, రిపేర్లు వంటి రోజువారీ ఖర్చులను గత 3 నెలల ఇటుకలపై పంచినది.',
  'ins.whereMoney': 'డబ్బు ఎక్కడికి వెళ్తోంది',
  'ins.expensesTotal': 'ఖర్చులు:',
  'ins.noExpenses': 'ఈ నెల ఖర్చులు లేవు.',
  'ins.production': 'ఉత్పత్తి (గత 30 రోజులు)',
  'ins.days': 'రోజులు',
  'ins.made': 'తయారైన ఇటుకలు:',
  'ins.perDay': 'పని రోజుకు:',
  'ins.bestDay': 'అత్యుత్తమ రోజు: {d} న {n}',
  'ins.dots': 'ముదురు = ఆ రోజు ఎక్కువ ఇటుకలు. చుక్కల గీత = ఆదివారం.',
  'ins.customers': 'మీ కస్టమర్లు (గత 3 నెలలు)',
  'ins.oneCustomer': 'అమ్మకాల్లో {p}% {name} నుండే వస్తున్నాయి. ఇంకా కొంతమంది రెగ్యులర్ కొనుగోలుదారులు ఉంటే వ్యాపారం మరింత సురక్షితం.',
  'ins.suppliers': 'ఎవరు తక్కువ ధరకు అమ్ముతున్నారు',
  'ins.cheapest': 'తక్కువ ధర',
  'ins.check': 'సరిచూడండి',
  'ins.footer': 'ఇవి యాప్‌లో నమోదైన వివరాల ఆధారంగా అంచనాలు. రోజూ పూర్తిగా నమోదు చేస్తే సూచనలు మరింత బాగుంటాయి.',

  // More
  'more.title': 'మరిన్ని',
  'more.eyebrow': 'మిగతావన్నీ',
  'more.daily': 'రోజువారీ పని',
  'more.safety': 'భద్రత',
  'more.setup': 'సెటప్',
  'more.invoice-builder': 'కొత్త అమ్మకం / బిల్లు',
  'more.purchases': 'కొనుగోళ్లు & సప్లయర్లు',
  'more.expenses': 'ఖర్చులు',
  'more.passbook': 'నగదు & బ్యాంక్ రోజు పుస్తకం',
  'more.documents': 'రిపోర్టులు & ఎక్సెల్',
  'more.drive-sync': 'బ్యాకప్ & రీస్టోర్',
  'more.settings': 'ఫ్యాక్టరీ వివరాలు',
  'more.master-settings': 'ఉత్పత్తులు & సరుకులు',
  'more.recipe-settings': 'ఇటుక రెసిపీలు',
  'more.invoice-settings': 'బిల్లు డిజైన్',
  'more.data-migration': 'ఎక్సెల్ నుండి దిగుమతి',
  'more.language': 'భాష',

  // Expense (fill in details)
  'exp.add': 'ఖర్చు నమోదు',
  'exp.edit': 'ఖర్చు మార్చు',
  'exp.forWhat': 'దేనికి ఖర్చు చేశారు?',
  'exp.forWhatPh': 'ఉదా: డీజిల్, హమాలీ, కరెంట్ బిల్లు',
  'exp.often': 'తరచుగా వాడేవి — తాకితే చాలు',
  'exp.amount': 'మొత్తం',
  'exp.paidBy': 'ఎలా చెల్లించారు',
  'exp.cash': 'నగదు',
  'exp.bank': 'బ్యాంక్',
  'exp.date': 'తేదీ',
  'exp.details': 'వివరాలు (అవసరమైతే)',
  'exp.detailsPh': 'ఉదా: JCB కి 40 లీటర్లు',
  'exp.save': 'సేవ్ చేయి',
  'exp.update': 'మార్చి సేవ్ చేయి',
  'exp.saving': 'సేవ్ అవుతోంది…',
  'exp.errAmount': 'సరైన మొత్తం ఇవ్వండి.',
  'exp.errWhat': 'దేనికి ఖర్చు చేశారో రాయండి.',
};

const EN = {
  'nav.home': 'Home',
  'nav.sales': 'Sales',
  'nav.production': 'Production',
  'nav.stock': 'Stock',
  'nav.insights': 'Insights',
  'home.morning': 'Good morning',
  'home.afternoon': 'Good afternoon',
  'home.evening': 'Good evening',
  'home.today': 'Today',
  'home.sales': 'Sales',
  'home.received': 'Money received',
  'home.bricksMade': 'Bricks made',
  'home.expenses': 'Expenses',
  'home.newSale': 'New Sale',
  'home.paymentIn': 'Payment In',
  'home.production': 'Production',
  'home.expense': 'Expense',
  'home.purchase': 'Purchase',
  'home.dayBook': 'Day Book',
  'home.tips': 'Tips for you',
  'home.thisMonth': 'This month',
  'home.moneyIn': 'Money in',
  'home.moneyOut': 'Money out',
  'home.toCollect': 'To collect',
  'home.toPay': 'To pay',
  'home.safe': 'Data is safe',
  'home.backupAttention': 'Backup needs attention',
  'home.lastBackup': 'Last backup {when}',
  'home.setupBackup': 'Tap to set up backups',
  'home.allOptions': 'All options',
  'stock.title': 'Stock',
  'stock.eyebrow': 'Tap any item to correct its count',
  'stock.bricksReady': 'Bricks ready to sell',
  'stock.raw': 'Raw materials',
  'stock.worth': 'Worth about {v}',
  'stock.sellCost': 'Sell ₹{sell} · Cost ₹{cost}',
  'stock.lastsDays': 'Lasts about {n} days',
  'stock.lastsMonths': 'Lasts 2+ months',
  'stock.low': 'Low — order soon',
  'stock.notUsed': 'Not used recently',
  'stock.legend': 'Red line = reorder level. “Lasts about” uses the last 30 days of production.',
  'unit.Ton': 'Ton',
  'unit.loads': 'm³',
  'stock.lorries': '≈ {n} lorry loads',
  'prod.title': 'Production',
  'prod.eyebrow': 'Bricks made',
  'prod.add': 'Add',
  'prod.total': 'Total this month',
  'prod.avgCost': 'Avg cost',
  'prod.darker': 'Darker = more bricks that day.',
  'prod.none': 'No production entered for {m}',
  'prod.noneHint': 'Tap “Add” to record today’s bricks.',
  'prod.bricks': 'bricks',
  'prod.cost': 'Cost {total} · ₹{each} each',
  'prod.weekdays': 'S,M,T,W,T,F,S',
  'ins.title': 'Insights',
  'ins.eyebrow': 'Simple view of your business',
  'ins.loading': 'Looking at your business…',
  'ins.next': 'What to do next',
  'ins.allFine': 'Everything looks fine. Keep entering daily work and tips will appear here.',
  'ins.money': 'Money in and money out',
  'ins.moneyIn': 'Money received',
  'ins.moneyOut': 'Money paid',
  'ins.moneyNote': 'Green = money that came in (sales + payments). Red = money that went out (materials, suppliers, expenses). Plus means more came in than went out.',
  'ins.brickCost': 'What one brick costs you',
  'ins.brick': '{s} brick',
  'ins.soldMonth': 'About {n} sold a month',
  'ins.youKeep': 'You keep',
  'ins.materials': 'Materials',
  'ins.labour': 'Labour',
  'ins.other': 'Other costs',
  'ins.soldAt': 'Sold at',
  'ins.brickNote': 'Materials use today’s average prices and your recipes. “Other costs” is your daily expenses (diesel, wages, repairs…) shared over the bricks made in the last 3 months.',
  'ins.whereMoney': 'Where the money goes',
  'ins.expensesTotal': 'Expenses:',
  'ins.noExpenses': 'No expenses this month.',
  'ins.production': 'Production (last 30 days)',
  'ins.days': 'days',
  'ins.made': 'Bricks made:',
  'ins.perDay': 'Per working day:',
  'ins.bestDay': 'Best day ever: {n} on {d}',
  'ins.dots': 'Darker = more bricks made that day. Dashed = Sunday.',
  'ins.customers': 'Your customers (last 3 months)',
  'ins.oneCustomer': '{p}% of sales come from {name}. Finding a few more regular buyers makes the business safer.',
  'ins.suppliers': 'Who sells materials cheaper',
  'ins.cheapest': 'CHEAPEST',
  'ins.check': 'CHECK ENTRY',
  'ins.footer': 'These are estimates from what is entered in the app. The more complete the daily entries, the better the advice.',
  'more.title': 'More',
  'more.eyebrow': 'Everything else',
  'more.daily': 'Daily work',
  'more.safety': 'Safety',
  'more.setup': 'Setup',
  'more.invoice-builder': 'New Sale / Bill',
  'more.purchases': 'Purchases & Suppliers',
  'more.expenses': 'Expenses',
  'more.passbook': 'Cash & Bank Day Book',
  'more.documents': 'Reports & Excel',
  'more.drive-sync': 'Backup & Restore',
  'more.settings': 'Factory Details',
  'more.master-settings': 'Products & Materials',
  'more.recipe-settings': 'Brick Recipes',
  'more.invoice-settings': 'Bill Design',
  'more.data-migration': 'Import from Excel',
  'more.language': 'Language',
  'exp.add': 'Add Expense',
  'exp.edit': 'Edit Expense',
  'exp.forWhat': 'What was it for?',
  'exp.forWhatPh': 'e.g. Diesel, Hamali, Current bill',
  'exp.often': 'Used often — just tap',
  'exp.amount': 'Amount',
  'exp.paidBy': 'Paid by',
  'exp.cash': 'Cash',
  'exp.bank': 'Bank',
  'exp.date': 'Date',
  'exp.details': 'Details (optional)',
  'exp.detailsPh': 'e.g. 40 litres for JCB',
  'exp.save': 'Save Expense',
  'exp.update': 'Update Expense',
  'exp.saving': 'Saving…',
  'exp.errAmount': 'Enter a valid amount.',
  'exp.errWhat': 'Write what the expense was for.',
};

function fill(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
}

export function translate(lang, key, vars) {
  const dict = lang === 'te' ? TE : EN;
  return fill(dict[key] ?? EN[key] ?? key, vars);
}

export function useT() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  return { lang, setLang, t: (key, vars) => translate(lang, key, vars) };
}

/** Material name in the current language (falls back to the stored name). */
export function materialName(lang, name) {
  if (lang !== 'te') return name;
  return TE[`mat.${name}`] || name;
}

/** Pick {en, te} text objects (used by Insights tips). */
export function pick(lang, v) {
  if (v && typeof v === 'object' && ('en' in v || 'te' in v)) return lang === 'te' ? v.te || v.en : v.en;
  return v;
}
