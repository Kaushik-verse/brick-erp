import { useState, useEffect, useRef } from 'react';
import WidgetSync from './core/hooks/WidgetSync';
import BottomNav from './core/ui/BottomNav';
import ScreenTransition from './core/ui/ScreenTransition';
import ToastStack from './core/ui/ToastStack';
import DashboardScreen from './features/dashboard/DashboardScreen';
import ProductionScreen from './features/production/ProductionScreen';
import InventoryScreen from './features/inventory/InventoryScreen';
import SalesScreen from './features/sales/SalesScreen';
import PurchasesScreen from './features/purchases/PurchasesScreen';
import InvoiceBuilderScreen from './features/sales/InvoiceBuilderScreen';
import MoreScreen from './features/dashboard/MoreScreen';
import ExpensesScreen from './features/expenses/ExpensesScreen';
import DocumentHubScreen from './features/documents/DocumentHubScreen';
import DriveSyncScreen from './features/dashboard/DriveSyncScreen';
import SettingsScreen from './features/dashboard/SettingsScreen';
import MasterSettingsScreen from './features/dashboard/MasterSettingsScreen';
import RecipeSettingsScreen from './features/dashboard/RecipeSettingsScreen';
import DataMigrationScreen from './features/dashboard/DataMigrationScreen';
import InvoiceSettingsScreen from './features/settings/InvoiceSettingsScreen';
import PassbookScreen from './features/passbook/PassbookScreen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { seedDatabaseIfEmpty } from './core/db/schema';
import { startAutoBackup, requestPersistentStorage } from './core/backup/autoBackup';
import { handleBack } from './core/store/backStack';

/**
 * App
 * ----
 * Root shell. Navigation is deliberately explicit React state, NOT a
 * router (no HashRouter/BrowserRouter) — this guarantees zero history
 * or deep-link breakage once compiled into a Capacitor Android WebView,
 * where the system back button and Android process lifecycle can
 * otherwise produce unpredictable router behavior.
 *
 * `activeTab` drives the bottom nav's 6 primary destinations (Home,
 * Production, Stock, Sales, Purchases, More). `subScreen` drives
 * secondary destinations reached from "More" — Expenses, Documents,
 * Drive Sync, Settings.
 *
 * IMPORTANT: BottomNav is mounted UNCONDITIONALLY at the bottom of this
 * tree, on every render path, including when a sub-screen is open. It
 * must never disappear — that was a prior bug. While a sub-screen is
 * open, the nav still shows "More" as the active/highlighted tab, and
 * tapping any other tab exits the sub-screen and jumps straight there.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [subScreen, setSubScreen] = useState(null);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(null);

  const initDb = () => {
    setDbError(null);
    seedDatabaseIfEmpty()
      .then(() => setDbReady(true))
      .catch((e) => {
        // Never open the app on a broken database: an empty-looking app
        // could make the user think data is lost and start re-entering it.
        console.error('DB Init Error:', e);
        setDbError(e);
      });
  };

  useEffect(() => {
    initDb();
    requestPersistentStorage();
  }, []);

  // Automatic backups (phone storage + Google Drive if connected)
  useEffect(() => {
    if (!dbReady) return undefined;
    return startAutoBackup();
  }, [dbReady]);

  // Keep latest navigation state in a ref so the back-button listener is registered once.
  const navRef = useRef({ activeTab, subScreen });
  navRef.current = { activeTab, subScreen };

  // Android hardware back button handling (Capacitor App plugin)
  useEffect(() => {
    let listener;
    let disposed = false;
    (async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#15110D' });
        } catch {
          // ignore web
        }
      }

      try {
        const { App: CapApp } = await import('@capacitor/app');
        const handle = await CapApp.addListener('backButton', () => {
          if (handleBack()) return; // an open sheet consumed it
          const { activeTab: tab, subScreen: sub } = navRef.current;
          if (sub === 'data-migration') {
            setSubScreen('settings');
          } else if (sub) {
            setSubScreen(null);
          } else if (tab !== 'dashboard') {
            setActiveTab('dashboard');
          } else {
            CapApp.exitApp();
          }
        });
        if (disposed) handle.remove();
        else listener = handle;
      } catch {
        /* not running in Capacitor — ignore */
      }
    })();
    return () => {
      disposed = true;
      listener?.remove();
    };
  }, []);

  if (dbError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kiln-900 px-8">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-lg font-display font-semibold text-clay-50">Could not open your ledger</p>
          <p className="text-sm text-clay-400 leading-relaxed">
            Your data has not been deleted. Please close the app completely and open it again. If this keeps
            happening, contact support before reinstalling the app.
          </p>
          <p className="text-[11px] text-clay-500 break-words">{String(dbError?.message || dbError)}</p>
          <button
            onClick={initDb}
            className="h-12 px-6 rounded-2xl bg-ember-500 text-clay-50 font-semibold touch-manipulation"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kiln-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-ember-500/30 border-t-ember-500 animate-spin" />
          <p className="text-clay-400 text-sm">Preparing your ledger…</p>
        </div>
      </div>
    );
  }

  const handleTabChange = (tab) => {
    setSubScreen(null);
    setActiveTab(tab);
  };

  const renderMainScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen onNavigate={handleTabChange} onOpenSubScreen={setSubScreen} />;
      case 'production':
        return <ProductionScreen />;
      case 'inventory':
        return <InventoryScreen />;
      case 'sales':
        return <SalesScreen onNavigate={setSubScreen} />;
      case 'purchases':
        return <PurchasesScreen />;
      case 'more':
        return <MoreScreen onNavigate={setSubScreen} />;
      default:
        return null;
    }
  };

  const renderSubScreen = () => {
    switch (subScreen) {
      case 'expenses':
        return <ExpensesScreen onBack={() => setSubScreen(null)} />;
      case 'documents':
        return <DocumentHubScreen onBack={() => setSubScreen(null)} />;
      case 'drive-sync':
        return <DriveSyncScreen onBack={() => setSubScreen(null)} />;
      case 'settings':
        return <SettingsScreen onBack={() => setSubScreen(null)} onNavigate={setSubScreen} />;
      case 'master-settings':
        return <MasterSettingsScreen onBack={() => setSubScreen(null)} />;
      case 'recipe-settings':
        return <RecipeSettingsScreen onBack={() => setSubScreen(null)} />;
      case 'data-migration':
        return <DataMigrationScreen onBack={() => setSubScreen('settings')} />;
      case 'invoice-settings':
        return <InvoiceSettingsScreen onBack={() => setSubScreen(null)} />;
      case 'invoice-builder':
        return <InvoiceBuilderScreen onBack={() => setSubScreen(null)} />;
      case 'passbook':
        return <PassbookScreen onBack={() => setSubScreen(null)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-full relative bg-kiln-900">
      <WidgetSync />
      <ToastStack />
      <main className="min-h-screen w-full md:pl-64">
        <ScreenTransition activeKey={subScreen || activeTab}>
          {subScreen ? renderSubScreen() : renderMainScreen()}
        </ScreenTransition>
      </main>
      <BottomNav
        activeTab={subScreen ? 'more' : activeTab}
        onTabChange={handleTabChange}
      />
    </div>
  );
}
