import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShieldCheck, ShieldAlert, ChevronRight, LayoutGrid, Lightbulb } from 'lucide-react';
import GlassCard from '../core/ui/GlassCard';
import AddProductionSheet from '../features/production/AddProductionSheet';
import AddPurchaseSheet from '../features/purchases/AddPurchaseSheet';
import FillExpenseSheet from '../features/expenses/FillExpenseSheet';
import { useDashboardKPIs } from '../core/hooks/useDexieHooks';
import { useBackupStatus } from '../core/backup/autoBackup';
import { computeInsights } from '../core/insights/insights';
import { db } from '../core/db/schema';
import { monthRange, formatINR, formatNumber, todayISO, formatRelativeTime } from '../core/utils/format';
import Icon3D from './icons3d/Icon3D';
import { useT, pick } from '../core/i18n';
import LanguageToggle from './LanguageToggle';

const BACKUP_STALE_MS = 2 * 24 * 60 * 60 * 1000;

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'home.morning';
  if (h < 17) return 'home.afternoon';
  return 'home.evening';
}

export default function HomeV3({ onTab, onOpen }) {
  const { t, lang } = useT();
  const [sheet, setSheet] = useState(null);
  const today = todayISO();
  const { start, end } = monthRange();
  const todayK = useDashboardKPIs(today, today);
  const month = useDashboardKPIs(start, end);
  const backup = useBackupStatus();
  const factoryName = useLiveQuery(async () => (await db.settings.where('key').equals('factoryName').first())?.value, [], '');
  const changeCount = useLiveQuery(() => db.salesLog.count(), [], 0);
  const [tips, setTips] = useState([]);

  useEffect(() => {
    computeInsights({ months: 4 }).then((d) => setTips(d.tips.slice(0, 2))).catch(() => {});
  }, [changeCount, sheet]);

  const lastBackup = backup.lastLocalAt ? Date.parse(backup.lastLocalAt) : 0;
  const backupStale = !lastBackup || Date.now() - lastBackup > BACKUP_STALE_MS || !!backup.lastError;

  const actions = [
    { label: t('home.newSale'), icon3d: 'new-sale', color: '#DE622C', onClick: () => onOpen('invoice-builder') },
    { label: t('home.paymentIn'), icon3d: 'payment-in', color: '#1E8750', onClick: () => onTab('sales') },
    { label: t('home.production'), icon3d: 'machinery', color: '#C4552A', onClick: () => setSheet('production') },
    { label: t('home.expense'), icon3d: 'expense', color: '#B27012', onClick: () => setSheet('expense') },
    { label: t('home.purchase'), icon3d: 'purchase', color: '#3E6096', onClick: () => setSheet('purchase') },
    { label: t('home.dayBook'), icon3d: 'day-book', color: '#6B5D50', onClick: () => onOpen('passbook') },
  ];

  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      {/* Header */}
      <header className="pt-safe-header px-5 md:px-8 pb-2 flex items-start justify-between gap-3 max-w-3xl mx-auto">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ember-500">
            {new Date().toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-[26px] leading-tight font-display font-semibold text-clay-50 truncate">{t(greetingKey())}</h1>
          {factoryName && <p className="text-sm text-clay-400 truncate">{factoryName.trim()}</p>}
        </div>
        <div className="flex items-center gap-2 mt-1 shrink-0">
          <LanguageToggle />
          <button
            onClick={() => onOpen('more')}
            aria-label={t('home.allOptions')}
            className="w-11 h-11 rounded-2xl glass-surface flex items-center justify-center touch-manipulation"
          >
            <LayoutGrid size={20} className="text-clay-200" />
          </button>
        </div>
      </header>

      <div className="px-5 md:px-8 space-y-4 max-w-3xl mx-auto">
        {/* Today */}
        <GlassCard padding="p-4">
          <p className="text-xs font-bold text-clay-400 uppercase tracking-wide mb-3">{t('home.today')}</p>
          <div className="grid grid-cols-2 gap-3">
            <TodayTile label={t('home.sales')} value={formatINR(todayK?.totalSales || 0)} color="#DE622C" icon3d="revenue" />
            <TodayTile label={t('home.received')} value={formatINR(todayK?.totalCollected || 0)} color="#1E8750" icon3d="money-received" />
            <TodayTile label={t('home.bricksMade')} value={formatNumber(todayK?.totalProduced || 0)} color="#C4552A" icon3d="brick-stack" />
            <TodayTile label={t('home.expenses')} value={formatINR(todayK?.totalExpenses || 0)} color="#B27012" icon3d="expenses" />
          </div>
        </GlassCard>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2.5">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="glass-surface lift rounded-2xl py-3.5 flex flex-col items-center gap-2 touch-manipulation active:scale-95 transition-transform"
            >
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${a.color}14` }}>
                <Icon3D name={a.icon3d} size={44} />
              </span>
              <span className="text-xs font-semibold text-clay-100">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Tips teaser */}
        {tips.length > 0 && (
          <GlassCard padding="p-4" onClick={() => onTab('insights')}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-clay-400 uppercase tracking-wide flex items-center gap-1.5">
                <Lightbulb size={14} className="text-ember-500" /> {t('home.tips')}
              </p>
              <ChevronRight size={16} className="text-clay-500" />
            </div>
            <ul className="space-y-1.5">
              {tips.map((tip) => (
                <li key={tip.id} className="text-sm text-clay-100 font-medium leading-snug">
                  • {pick(lang, tip.title)}
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        {/* This month */}
        {month && (
          <GlassCard padding="p-4">
            <p className="text-xs font-bold text-clay-400 uppercase tracking-wide mb-3">
              {t('home.thisMonth')} · {new Date().toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', { month: 'long' })}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Flow icon3d="money-received" label={t('home.moneyIn')} value={month.cashIn + month.bankIn} color="#1E8750" />
              <Flow icon3d="payments" label={t('home.moneyOut')} value={month.cashOut + month.bankOut} color="#C4342C" />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-center">
              <Mini label={t('home.sales')} value={formatINR(month.totalSales)} />
              <Mini label={t('home.toCollect')} value={formatINR(month.receivables)} tone={month.receivables > 0 ? 'text-ledger-overdue' : ''} onClick={() => onTab('sales')} />
              <Mini label={t('home.toPay')} value={formatINR(month.payables)} onClick={() => onOpen('purchases')} />
            </div>
          </GlassCard>
        )}

        {/* Backup */}
        <button
          onClick={() => onOpen('drive-sync')}
          className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left touch-manipulation border ${
            backupStale ? 'bg-ledger-partial/10 border-ledger-partial/30' : 'bg-ledger-paid/10 border-ledger-paid/20'
          }`}
        >
          {backupStale ? <ShieldAlert size={20} className="text-ledger-partial shrink-0" /> : <ShieldCheck size={20} className="text-ledger-paid shrink-0" />}
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-clay-100">{backupStale ? t('home.backupAttention') : t('home.safe')}</span>
            <span className="block text-xs text-clay-400 truncate">
              {lastBackup ? t('home.lastBackup', { when: formatRelativeTime(backup.lastLocalAt) }) : t('home.setupBackup')}
            </span>
          </span>
          <ChevronRight size={16} className="text-clay-500 shrink-0" />
        </button>
      </div>

      <AddProductionSheet open={sheet === 'production'} onClose={() => setSheet(null)} />
      <FillExpenseSheet open={sheet === 'expense'} onClose={() => setSheet(null)} />
      <AddPurchaseSheet open={sheet === 'purchase'} onClose={() => setSheet(null)} />
    </div>
  );
}

function TodayTile({ label, value, color, icon3d }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}14` }}>
        <Icon3D name={icon3d} size={34} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-clay-400">{label}</p>
        <p className="figure text-base font-bold text-clay-50 truncate">{value}</p>
      </div>
    </div>
  );
}

function Flow({ icon3d, label, value, color }) {
  return (
    <div className="rounded-xl p-3 flex items-center gap-2.5" style={{ background: `${color}14` }}>
      <Icon3D name={icon3d} size={36} />
      <div className="min-w-0">
      <p className="text-xs font-semibold" style={{ color }}>
        {label}
      </p>
      <p className="figure text-lg font-bold text-clay-50 mt-0.5 truncate">{formatINR(value)}</p>
      </div>
    </div>
  );
}

function Mini({ label, value, tone = '', onClick }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className="touch-manipulation">
      <p className="text-[11px] text-clay-400">{label}</p>
      <p className={`figure text-sm font-bold text-clay-50 ${tone}`}>{value}</p>
    </Comp>
  );
}
