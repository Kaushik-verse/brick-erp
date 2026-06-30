import { useState, useEffect } from 'react';
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
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { seedDatabaseIfEmpty } from './core/db/schema';

GoogleAuth.initialize({
  clientId: '813773523036-4vo5qijl8uvtdqsd83qb5c7c7j9hth0u.apps.googleusercontent.com',
  scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.appdata'],
  grantOfflineAccess: Capacitor.isNativePlatform(),
});

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

  useEffect(() => {
    seedDatabaseIfEmpty().then(() => setDbReady(true));
  }, []);

  // Automatic daily Google Drive Backup
  useEffect(() => {
    if (!dbReady) return;
    const runAutoBackup = async () => {
      try {
        const { getLastSyncTimestamp, uploadBackupToDrive } = await import('./core/drive/driveSync');
        const lastSync = await getLastSyncTimestamp();
        const now = new Date();
        const last = lastSync ? new Date(lastSync) : null;
        
        // Only run auto-backup if no sync today (or > 12 hours ago)
        if (!last || (now - last) > 12 * 60 * 60 * 1000) {
          if (!Capacitor.isNativePlatform()) return; // Skip silent web auto-auth
          const user = await GoogleAuth.refresh();
          if (user?.authentication?.accessToken) {
            await uploadBackupToDrive(user.authentication.accessToken);
            console.log('Auto-backup to Google Drive successful');
          }
        }
      } catch (e) {
        // Silently fail: user might not have connected Drive yet, or no internet.
        console.log('Auto-backup skipped or failed:', e);
      }
    };
    runAutoBackup();
  }, [dbReady]);

  // Android hardware back button handling (Capacitor App plugin)
  useEffect(() => {
    let cleanup;
    (async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#15110D' });
        } catch (e) {
          // ignore web
        }
      }

      try {
        const { App: CapApp } = await import('@capacitor/app');
        const listener = await CapApp.addListener('backButton', () => {
          if (subScreen) {
            setSubScreen(null);
          } else if (activeTab !== 'dashboard') {
            setActiveTab('dashboard');
          } else {
            CapApp.exitApp();
          }
        });
        cleanup = () => listener.remove();
      } catch {
        /* not running in Capacitor — ignore */
      }
    })();
    return () => cleanup?.();
  }, [activeTab, subScreen]);

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
        return <DashboardScreen onNavigate={handleTabChange} />;
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
        return <ExpensesScreen />;
      case 'documents':
        return <DocumentHubScreen onBack={() => setSubScreen(null)} />;
      case 'drive-sync':
        return <DriveSyncScreen onBack={() => setSubScreen(null)} />;
      case 'settings':
        return <SettingsScreen onBack={() => setSubScreen(null)} onNavigate={setSubScreen} />;
      case 'master-settings':
        return <MasterSettingsScreen onBack={() => setSubScreen('settings')} />;
      case 'recipe-settings':
        return <RecipeSettingsScreen onBack={() => setSubScreen('settings')} />;
      case 'data-migration':
        return <DataMigrationScreen onBack={() => setSubScreen('settings')} />;
      case 'invoice-settings':
        return <InvoiceSettingsScreen onBack={() => setSubScreen('settings')} />;
      case 'invoice-builder':
        return <InvoiceBuilderScreen onBack={() => setSubScreen(null)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-full relative bg-kiln-900">
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
