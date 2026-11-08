import { useState, useEffect, useRef, useCallback } from 'react';
import { BACKUP_FOLDER, BACKUP_FILE_PREFIX } from '../../core/appVariant';
import { CloudUpload, CloudDownload, ShieldCheck, ShieldAlert, HardDrive, Upload, Share2, RotateCcw, RefreshCw, LogOut, Smartphone, Info } from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import { exportDatabaseSnapshot, parseSnapshotText, summarizeSnapshot } from '../../core/backup/snapshot';
import {
  listLocalBackups,
  readLocalBackup,
  shareLocalBackup,
  restoreWithSafetyBackup,
} from '../../core/backup/localBackups';
import { runBackup, useBackupStatus, markDriveBackupDone } from '../../core/backup/autoBackup';
import { getDriveToken, isDriveConnected, disconnectDrive, clearDriveToken } from '../../core/drive/googleAuth';
import { saveAndShareBlob } from '../../core/utils/nativeFileBridge';
import { useUIStore } from '../../core/store/uiStore';
import { formatRelativeTime } from '../../core/utils/format';
import { Capacitor } from '@capacitor/core';

function describeSnapshot(snapshot) {
  const s = summarizeSnapshot(snapshot);
  const when = s.exportedAt ? new Date(s.exportedAt).toLocaleString('en-IN') : 'unknown date';
  return (
    `Backup from ${when}\n\n` +
    `• ${s.customers} customers, ${s.suppliers} suppliers\n` +
    `• ${s.sales} sales, ${s.collections} collections\n` +
    `• ${s.purchases} purchases, ${s.payments} supplier payments\n` +
    `• ${s.production} production runs, ${s.expenses} expenses\n` +
    `• ${s.manualEntries} passbook entries`
  );
}

function confirmRestore(snapshot) {
  return window.confirm(
    `${describeSnapshot(snapshot)}\n\nThis will REPLACE the data on this phone with this backup.\n` +
      'A safety copy of your current data is saved first, so this can be undone.\n\nContinue?'
  );
}

function fileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_LABEL = { auto: 'Daily', monthly: 'Monthly', safety: 'Safety copy', manual: 'Manual', drive: 'Drive' };

export default function DriveSyncScreen({ onBack }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const status = useBackupStatus();
  const [busy, setBusy] = useState(false);
  const [driveConnected, setDriveConnected] = useState(isDriveConnected());
  const [driveFiles, setDriveFiles] = useState(null);
  const [localList, setLocalList] = useState(null);
  const [showAllLocal, setShowAllLocal] = useState(false);
  const fileInputRef = useRef(null);

  const refreshLocal = useCallback(() => {
    listLocalBackups()
      .then(setLocalList)
      .catch(() => setLocalList([]));
  }, []);

  useEffect(() => {
    refreshLocal();
  }, [refreshLocal, status.lastLocalAt]);

  const withBusy = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      pushToast(e.message || 'Something went wrong', 'error');
    } finally {
      setBusy(false);
    }
  };

  const reloadSoon = () => setTimeout(() => window.location.reload(), 1200);

  // ---------- Backup now ----------
  const handleBackupNow = () =>
    withBusy(async () => {
      const res = await runBackup({ force: true });
      if (res.errors.length) {
        pushToast(res.errors[0], 'error');
      } else {
        pushToast(res.drive ? 'Backed up to phone and Google Drive' : 'Backed up to phone', 'success');
      }
      refreshLocal();
    });

  // ---------- Google Drive ----------
  const handleConnect = () =>
    withBusy(async () => {
      const token = await getDriveToken({ interactive: true });
      if (!token) throw new Error('Google sign-in failed');
      setDriveConnected(true);
      pushToast('Google Drive connected — backing up…', 'success');
      const { uploadBackupToDrive } = await import('../../core/drive/driveSync');
      await uploadBackupToDrive(token);
      markDriveBackupDone();
      pushToast('First Drive backup complete', 'success');
    });

  const getTokenOrReconnect = async () => {
    try {
      return await getDriveToken({ interactive: true });
    } catch (e) {
      clearDriveToken();
      throw e;
    }
  };

  const handleLoadDriveList = () =>
    withBusy(async () => {
      const token = await getTokenOrReconnect();
      const { listDriveBackups } = await import('../../core/drive/driveSync');
      setDriveFiles(await listDriveBackups(token));
    });

  const handleDriveRestore = (file) =>
    withBusy(async () => {
      const token = await getTokenOrReconnect();
      const { downloadDriveBackup } = await import('../../core/drive/driveSync');
      const snapshot = await downloadDriveBackup(token, file.id);
      if (!confirmRestore(snapshot)) return;
      await restoreWithSafetyBackup(snapshot);
      pushToast('Restored from Google Drive. Reloading…', 'success');
      reloadSoon();
    });

  const handleDisconnect = () =>
    withBusy(async () => {
      if (!window.confirm('Stop automatic Google Drive backups on this phone? Existing Drive backups are kept.')) return;
      await disconnectDrive();
      setDriveConnected(false);
      setDriveFiles(null);
      pushToast('Google Drive disconnected', 'info');
    });

  // ---------- On-device restore points ----------
  const handleLocalRestore = (entry) =>
    withBusy(async () => {
      const snapshot = await readLocalBackup(entry);
      if (!confirmRestore(snapshot)) return;
      await restoreWithSafetyBackup(snapshot);
      pushToast('Restored. Reloading…', 'success');
      reloadSoon();
    });

  const handleLocalShare = (entry) =>
    withBusy(async () => {
      await shareLocalBackup(entry);
    });

  // ---------- File export / import ----------
  const handleExportFile = () =>
    withBusy(async () => {
      const snapshot = await exportDatabaseSnapshot();
      snapshot.backupKind = 'manual';
      const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      await saveAndShareBlob(blob, `${BACKUP_FILE_PREFIX}_Backup_${stamp}.json`, 'application/json');
      pushToast('Backup file ready — save it to Drive/WhatsApp/PC', 'success');
    });

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
      fileInputRef.current.click();
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    withBusy(async () => {
      const snapshot = parseSnapshotText(await file.text());
      if (!confirmRestore(snapshot)) return;
      await restoreWithSafetyBackup(snapshot);
      pushToast('Restored from file. Reloading…', 'success');
      reloadSoon();
    });
  };

  const healthy = !!status.lastLocalAt && !status.lastError;
  const localShown = showAllLocal ? localList || [] : (localList || []).slice(0, 5);

  return (
    <div className="pb-32 md:pb-12 md:pt-6">
      <ScreenHeader
        eyebrow="Data Safety"
        title="Backup & Restore"
        onBack={onBack}
      />

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".json,application/json"
        onChange={handleImportFile}
      />

      <div className="px-5 md:px-8 space-y-4 max-w-3xl mx-auto">
        {/* Status */}
        <GlassCard
          padding="p-4"
          className={healthy ? 'border-ledger-paid/30' : 'border-ledger-partial/40'}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                healthy ? 'bg-ledger-paid/15' : 'bg-ledger-partial/15'
              }`}
            >
              {healthy ? (
                <ShieldCheck size={22} className="text-ledger-paid" />
              ) : (
                <ShieldAlert size={22} className="text-ledger-partial" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-clay-50">
                {healthy ? 'Your data is being backed up' : 'Backup needs attention'}
              </p>
              <p className="text-xs text-clay-400 mt-0.5 leading-relaxed">
                Automatic backups run a minute after every change and whenever the app is closed.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <StatusTile
              icon={Smartphone}
              label="Phone backup"
              value={status.lastLocalAt ? formatRelativeTime(status.lastLocalAt) : 'Not yet'}
              ok={!!status.lastLocalAt}
            />
            <StatusTile
              icon={CloudUpload}
              label="Google Drive"
              value={
                !driveConnected
                  ? 'Not connected'
                  : status.lastDriveAt
                  ? formatRelativeTime(status.lastDriveAt)
                  : 'Pending'
              }
              ok={driveConnected && !!status.lastDriveAt}
            />
          </div>

          {status.lastError && (
            <p className="text-xs text-ledger-partial mt-3 leading-relaxed">{status.lastError}</p>
          )}

          <GlassButton
            onClick={handleBackupNow}
            disabled={busy || status.running}
            icon={RefreshCw}
            fullWidth
            className="mt-4"
          >
            {status.running ? 'Backing up…' : 'Back Up Now'}
          </GlassButton>
        </GlassCard>

        {/* Google Drive */}
        <GlassCard padding="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CloudUpload size={16} className="text-ledger-credit" />
              <h3 className="text-sm font-semibold text-clay-100">Google Drive (off-phone copy)</h3>
            </div>
            {driveConnected && (
              <button
                onClick={handleDisconnect}
                disabled={busy}
                className="text-[11px] text-clay-400 flex items-center gap-1 touch-manipulation"
              >
                <LogOut size={12} /> Disconnect
              </button>
            )}
          </div>
          <p className="text-xs text-clay-400 leading-relaxed mb-3">
            Free and private: backups go to a hidden folder in your own Google account. The last 30
            days and one copy of every month (kept forever) are saved, so even if wrong entries are
            made you can go back to an older day or month. If the phone is lost or broken, install
            the app on a new phone and restore from here.
          </p>

          {!driveConnected ? (
            <GlassButton onClick={handleConnect} disabled={busy} fullWidth icon={CloudUpload}>
              Connect Google Drive
            </GlassButton>
          ) : (
            <GlassButton onClick={handleLoadDriveList} disabled={busy} variant="glass" icon={CloudDownload} fullWidth>
              {driveFiles ? 'Refresh Drive Backups' : 'Show Drive Backups'}
            </GlassButton>
          )}

          {driveFiles && (
            <div className="mt-3 space-y-2">
              {driveFiles.length === 0 && (
                <p className="text-xs text-clay-500 text-center py-2">No Drive backups yet.</p>
              )}
              {driveFiles.slice(0, 10).map((f) => (
                <BackupRow
                  key={f.id}
                  title={new Date(f.modifiedTime).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  subtitle={`${f.name.includes('_20') ? 'Daily backup' : 'Old-format backup'} · ${fileSize(Number(f.size))}`}
                  onRestore={() => handleDriveRestore(f)}
                  disabled={busy}
                />
              ))}
            </div>
          )}
        </GlassCard>

        {/* On-device restore points */}
        <GlassCard padding="p-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={16} className="text-ember-400" />
            <h3 className="text-sm font-semibold text-clay-100">Backups on this phone</h3>
          </div>
          <p className="text-xs text-clay-400 leading-relaxed mb-3">
            {Capacitor.isNativePlatform()
              ? `Saved in the phone’s Documents/${BACKUP_FOLDER} folder — they stay even if the app is uninstalled. One per day for the last 30 days, one per month kept forever, plus safety copies taken before every restore. Every backup holds all your data from the very first entry.`
              : 'Restore points kept in this browser. Use “Export file” or Google Drive for a copy outside this computer.'}
          </p>
          <div className="space-y-2">
            {localList === null && <p className="text-xs text-clay-500 text-center py-2">Loading…</p>}
            {localList?.length === 0 && (
              <p className="text-xs text-clay-500 text-center py-2">No backups yet — tap “Back Up Now”.</p>
            )}
            {localShown.map((b) => (
              <BackupRow
                key={b.id}
                title={
                  b.createdAt
                    ? new Date(b.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : b.name
                }
                subtitle={`${KIND_LABEL[b.kind] || 'Backup'} · ${fileSize(b.size)}${
                  b.location === 'App storage' ? ' · app storage' : ''
                }`}
                onRestore={() => handleLocalRestore(b)}
                onShare={() => handleLocalShare(b)}
                disabled={busy}
              />
            ))}
            {(localList?.length || 0) > 5 && (
              <button
                onClick={() => setShowAllLocal((v) => !v)}
                className="w-full text-xs font-semibold text-ember-400 py-2 touch-manipulation"
              >
                {showAllLocal ? 'Show fewer' : `Show all ${localList.length}`}
              </button>
            )}
          </div>
        </GlassCard>

        {/* File export/import */}
        <GlassCard padding="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Share2 size={16} className="text-ember-400" />
            <h3 className="text-sm font-semibold text-clay-100">Backup file</h3>
          </div>
          <p className="text-xs text-clay-400 leading-relaxed mb-3">
            Send a full backup to yourself on WhatsApp, email or a PC — or restore one you saved earlier.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <GlassButton onClick={handleExportFile} disabled={busy} icon={Share2} fullWidth size="sm">
              Export file
            </GlassButton>
            <GlassButton onClick={handleImportClick} disabled={busy} icon={Upload} variant="glass" fullWidth size="sm">
              Restore file
            </GlassButton>
          </div>
        </GlassCard>

        <div className="flex gap-2 px-1">
          <Info size={14} className="text-clay-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-clay-500 leading-relaxed">
            When updating the app, install the new version on top of the old one — do not uninstall
            first. Every restore saves a safety copy of the current data first, so it can be undone.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusTile({ icon: Icon, label, value, ok }) {
  return (
    <div className="glass-surface-light rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className={ok ? 'text-ledger-paid' : 'text-clay-500'} />
        <span className="text-[10px] uppercase tracking-wide text-clay-400">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${ok ? 'text-clay-50' : 'text-clay-400'}`}>{value}</p>
    </div>
  );
}

function BackupRow({ title, subtitle, onRestore, onShare, disabled }) {
  return (
    <div className="glass-surface-light rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-clay-100 truncate">{title}</p>
        <p className="text-[11px] text-clay-500 truncate">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {onShare && (
          <button
            onClick={onShare}
            disabled={disabled}
            aria-label="Share backup"
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center touch-manipulation disabled:opacity-40"
          >
            <Share2 size={14} className="text-clay-300" />
          </button>
        )}
        <button
          onClick={onRestore}
          disabled={disabled}
          className="h-9 px-3 rounded-full bg-ember-500/15 text-ember-400 text-xs font-semibold flex items-center gap-1 touch-manipulation disabled:opacity-40"
        >
          <RotateCcw size={12} /> Restore
        </button>
      </div>
    </div>
  );
}
