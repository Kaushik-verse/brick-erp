import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Capacitor } from '@capacitor/core';
import WidgetSync from '../core/hooks/WidgetSync';
import ScreenTransition from '../core/ui/ScreenTransition';
import ToastStack from '../core/ui/ToastStack';
import SalesScreen from '../features/sales/SalesScreen';

// Screens opened from Home / More are loaded on first use, so the app starts
// without parsing them (Import-from-Excel alone pulled in the 900 KB Excel library).
// They are prefetched in the background once the app is idle, so opening one is instant.
const SUB_SCREENS = {
  PurchasesScreen: () => import('../features/purchases/PurchasesScreen'),
  InvoiceBuilderScreen: () => import('../features/sales/InvoiceBuilderScreen'),
  ExpensesScreen: () => import('../features/expenses/ExpensesScreen'),
  DocumentHubScreen: () => import('../features/documents/DocumentHubScreen'),
  DriveSyncScreen: () => import('../features/dashboard/DriveSyncScreen'),
  SettingsScreen: () => import('../features/dashboard/SettingsScreen'),
  MasterSettingsScreen: () => import('../features/dashboard/MasterSettingsScreen'),
  RecipeSettingsScreen: () => import('../features/dashboard/RecipeSettingsScreen'),
  DataMigrationScreen: () => import('../features/dashboard/DataMigrationScreen'),
  InvoiceSettingsScreen: () => import('../features/settings/InvoiceSettingsScreen'),
  PassbookScreen: () => import('../features/passbook/PassbookScreen'),
};
const PurchasesScreen = lazy(SUB_SCREENS.PurchasesScreen);
const InvoiceBuilderScreen = lazy(SUB_SCREENS.InvoiceBuilderScreen);
const ExpensesScreen = lazy(SUB_SCREENS.ExpensesScreen);
const DocumentHubScreen = lazy(SUB_SCREENS.DocumentHubScreen);
const DriveSyncScreen = lazy(SUB_SCREENS.DriveSyncScreen);
const SettingsScreen = lazy(SUB_SCREENS.SettingsScreen);
const MasterSettingsScreen = lazy(SUB_SCREENS.MasterSettingsScreen);
const RecipeSettingsScreen = lazy(SUB_SCREENS.RecipeSettingsScreen);
const DataMigrationScreen = lazy(SUB_SCREENS.DataMigrationScreen);
const InvoiceSettingsScreen = lazy(SUB_SCREENS.InvoiceSettingsScreen);
const PassbookScreen = lazy(SUB_SCREENS.PassbookScreen);
// Everyday screens first; setup screens last. Excel import is left to load on demand.
const PREFETCH = ['InvoiceBuilderScreen', 'ExpensesScreen', 'PurchasesScreen', 'PassbookScreen', 'DriveSyncScreen', 'DocumentHubScreen', 'SettingsScreen', 'MasterSettingsScreen', 'RecipeSettingsScreen', 'InvoiceSettingsScreen'];
function prefetchSubScreens() {
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 400));
  let i = 0;
  const next = () => {
    if (i >= PREFETCH.length) return;
    SUB_SCREENS[PREFETCH[i++]]().catch(() => {}).finally(() => idle(next));
  };
  idle(next);
}
import { seedDatabaseIfEmpty, db } from '../core/db/schema';
import { validateSnapshot, restoreDatabaseSnapshot } from '../core/backup/snapshot';

// Optional: a backup bundled into this build (src/v3/seed/*.json, git-ignored).
// It is restored ONCE, on the very first launch, if the phone has no data yet,
// so the owner can try the new design with his real records immediately.
const SEED_FILES = import.meta.glob('./seed/*.json');
const SEED_FLAG = 'brickerp_seed_restored';

async function restoreBundledBackupOnce() {
  try {
    if (localStorage.getItem(SEED_FLAG)) return false;
  } catch {
    return false;
  }
  const loaders = Object.values(SEED_FILES);
  if (!loaders.length) return false;
  const [sales, customers] = await Promise.all([db.salesLog.count(), db.customers.count()]);
  if (sales > 0 || customers > 0) {
    localStorage.setItem(SEED_FLAG, 'skipped-has-data');
    return false;
  }
  const mod = await loaders[0]();
  const snapshot = mod.default || mod;
  validateSnapshot(snapshot);
  await restoreDatabaseSnapshot(snapshot);
  localStorage.setItem(SEED_FLAG, new Date().toISOString());
  return true;
}
import { startAutoBackup, requestPersistentStorage } from '../core/backup/autoBackup';
import { handleBack } from '../core/store/backStack';
import BottomNavV3 from './BottomNavV3';
import HomeV3 from './HomeV3';
import ProductionV3 from './ProductionV3';
import StockV3 from './StockV3';
import InsightsV3 from './InsightsV3';
import MoreV3 from './MoreV3';
import Illustration from './illustrations/Illustration';

/**
 * AppV3 — "Factory Book" (the new-design app).
 * A separate app build (see `npm run dev:new` / `android:build:new`) with a
 * light, high-contrast design, five tabs and an Insights section. It uses
 * the same business logic, backups and PDFs as the classic app.
 */
export default function AppV3() {
  const [tab, setTab] = useState('home');
  const [sub, setSub] = useState(null);
  const [ready, setReady] = useState(false);
  const [dbError, setDbError] = useState(null);

  const init = () => {
    setDbError(null);
    seedDatabaseIfEmpty()
      .then(() => restoreBundledBackupOnce().catch((e) => console.error('Bundled backup not restored:', e)))
      .then(() => import('./fixes/dadAnswersFix').then((m) => m.applyDadAnswersFixOnce()).catch((e) => console.error('Data correction not applied:', e)))
      .then(() => setReady(true))
      .catch((e) => setDbError(e));
  };

  useEffect(() => {
    document.documentElement.classList.add('theme-light');
    document.title = 'Factory Book';
    document.documentElement.classList.remove('dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F7F3ED');
    init();
    requestPersistentStorage();
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/status-bar')
        .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: Style.Light }).then(() => StatusBar.setBackgroundColor({ color: '#F7F3ED' })))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(prefetchSubScreens, 1500);
    const stop = startAutoBackup();
    return () => { clearTimeout(t); stop?.(); };
  }, [ready]);

  const nav = useRef({ tab, sub });
  nav.current = { tab, sub };
  useEffect(() => {
    let listener;
    let disposed = false;
    import('@capacitor/app')
      .then(async ({ App }) => {
        const h = await App.addListener('backButton', () => {
          if (handleBack()) return;
          const { tab: t, sub: s } = nav.current;
          if (s === 'data-migration') setSub('settings');
          else if (s) setSub(s === 'more' ? null : nav.current.fromMore ? 'more' : null);
          else if (t !== 'home') setTab('home');
          else App.exitApp();
        });
        if (disposed) h.remove();
        else listener = h;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      listener?.remove();
    };
  }, []);

  if (dbError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-8 text-center">
        <div className="space-y-3">
          <p className="text-lg font-semibold text-clay-50">Could not open the ledger</p>
          <p className="text-sm text-clay-400">Your data is not deleted. Close the app fully and open it again.</p>
          <button onClick={init} className="h-12 px-6 rounded-2xl bg-ember-500 text-white font-semibold">Try Again</button>
        </div>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 gap-2">
        <div className="w-full max-w-sm"><Illustration name="delivery" /></div>
        <p className="text-sm text-clay-400">Loading your ledger…</p>
      </div>
    );
  }

  const openSub = (key, fromMore = false) => {
    nav.current.fromMore = fromMore;
    setSub(key);
  };
  const back = () => setSub(nav.current.fromMore ? 'more' : null);
  const goTab = (t) => {
    setSub(null);
    setTab(t);
  };

  const renderSub = () => {
    switch (sub) {
      case 'more':
        return <MoreV3 onBack={() => setSub(null)} onOpen={(k) => openSub(k, true)} />;
      case 'invoice-builder':
        return <InvoiceBuilderScreen onBack={back} />;
      case 'purchases':
        return <PurchasesScreen onBack={back} hideExport />;
      case 'expenses':
        return <ExpensesScreen onBack={back} fillMode />;
      case 'passbook':
        return <PassbookScreen onBack={back} />;
      case 'documents':
        return <DocumentHubScreen onBack={back} />;
      case 'drive-sync':
        return <DriveSyncScreen onBack={back} />;
      case 'settings':
        return <SettingsScreen onBack={back} onNavigate={(k) => openSub(k, nav.current.fromMore)} />;
      case 'master-settings':
        return <MasterSettingsScreen onBack={back} hideUnits />;
      case 'recipe-settings':
        return <RecipeSettingsScreen onBack={back} />;
      case 'invoice-settings':
        return <InvoiceSettingsScreen onBack={back} />;
      case 'data-migration':
        return <DataMigrationScreen onBack={back} />;
      default:
        return null;
    }
  };

  const renderTab = () => {
    switch (tab) {
      case 'home':
        return <HomeV3 onTab={goTab} onOpen={(k) => openSub(k, false)} />;
      case 'sales':
        return <SalesScreen onNavigate={(k) => openSub(k)} onNewSale={() => openSub('invoice-builder')} hideExport />;
      case 'production':
        return <ProductionV3 />;
      case 'stock':
        return <StockV3 />;
      case 'insights':
        return <InsightsV3 />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-full relative">
      <WidgetSync />
      <ToastStack />
      <main className="min-h-screen w-full md:pl-64">
        <ScreenTransition activeKey={sub || tab}><Suspense fallback={<div className="min-h-[60vh]" />}>{sub ? renderSub() : renderTab()}</Suspense></ScreenTransition>
      </main>
      <BottomNavV3 active={tab} onChange={goTab} />
    </div>
  );
}
