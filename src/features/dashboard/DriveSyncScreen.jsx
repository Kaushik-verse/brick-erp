import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CloudUpload, CloudDownload, ShieldCheck, Clock, HardDrive, Upload } from 'lucide-react';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import {
  uploadBackupToDrive,
  downloadBackupFromDrive,
  getLastSyncTimestamp,
  exportDatabaseSnapshot,
  restoreDatabaseSnapshot,
} from '../../core/drive/driveSync';
import { saveAndShareBlob } from '../../core/utils/nativeFileBridge';
import { useUIStore } from '../../core/store/uiStore';
import { formatDateDisplay } from '../../core/utils/format';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

/**
 * DriveSyncScreen
 * ----------------
 * Two backup strategies:
 * 1. Google Drive appDataFolder (OAuth required)
 * 2. Local JSON file export/import (works always, no auth needed)
 */
export default function DriveSyncScreen({ onBack }) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [accessToken, setAccessToken] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    getLastSyncTimestamp().then(setLastSync);
  }, []);

  // ---- Google Drive Flow ----
  const handleConnect = async () => {
    setBusy(true);
    try {
      const user = await GoogleAuth.signIn();
      if (user && user.authentication && user.authentication.accessToken) {
        setAccessToken(user.authentication.accessToken);
        pushToast('Connected to Google Drive', 'success');
      } else {
        throw new Error('Sign in failed (no token)');
      }
    } catch (e) {
      console.error(e);
      pushToast(e.message || 'Failed to connect to Google', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleBackup = async () => {
    if (!accessToken) {
      pushToast('Connect Google Drive first', 'error');
      return;
    }
    setBusy(true);
    try {
      await uploadBackupToDrive(accessToken);
      setLastSync(new Date().toISOString());
      pushToast('Backup uploaded to Drive', 'success');
    } catch (e) {
      pushToast(e.message || 'Backup failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!accessToken) {
      pushToast('Connect Google Drive first', 'error');
      return;
    }
    if (!window.confirm('This will REPLACE all local data with the Drive backup. Continue?')) return;
    setBusy(true);
    try {
      await downloadBackupFromDrive(accessToken);
      pushToast('Database restored from Drive. Reloading...', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      pushToast(e.message || 'Restore failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  // ---- Local JSON Flow ----
  const handleLocalExport = async () => {
    setBusy(true);
    try {
      const snapshot = await exportDatabaseSnapshot();
      const jsonString = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const dateStr = new Date().toISOString().slice(0, 10);
      await saveAndShareBlob(blob, `BrickERP_Backup_${dateStr}.json`, 'application/json');
      pushToast('Backup file ready to share/save', 'success');
    } catch (e) {
      pushToast(e.message || 'Export failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleLocalImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
      fileInputRef.current.click();
    }
  };

  const handleLocalImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm('This will REPLACE all local data with the backup file. Continue?')) return;
    setBusy(true);
    try {
      const text = await file.text();
      const snapshot = JSON.parse(text);
      if (!snapshot?.data) throw new Error('Invalid backup file: missing data payload.');
      await restoreDatabaseSnapshot(snapshot);
      pushToast('Database restored from file. Reloading...', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      pushToast(e.message || 'Import failed. Check file format.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-32">
      <ScreenHeader
        eyebrow="Disaster Recovery"
        title="Backup & Restore"
        action={
          <button onClick={onBack} className="w-10 h-10 rounded-full glass-surface-light flex items-center justify-center touch-manipulation">
            <ArrowLeft size={18} className="text-clay-300" />
          </button>
        }
      />

      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".json"
        onChange={handleLocalImportFile}
      />

      <div className="px-5 space-y-4">
        {/* Local Backup Section */}
        <GlassCard padding="p-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={16} className="text-ember-400" />
            <h3 className="text-sm font-semibold text-clay-100">Local Backup (Recommended)</h3>
          </div>
          <p className="text-xs text-clay-400 leading-relaxed mb-3">
            Export your entire database as a JSON file. Share it via WhatsApp, save to Files, or email it to yourself. Works offline, no Google account needed.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <GlassButton onClick={handleLocalExport} disabled={busy} icon={CloudUpload} fullWidth>
              Export Backup
            </GlassButton>
            <GlassButton onClick={handleLocalImportClick} disabled={busy} icon={Upload} variant="glass" fullWidth>
              Import Backup
            </GlassButton>
          </div>
        </GlassCard>

        {/* Google Drive Section */}
        <GlassCard padding="p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={16} className="text-ledger-paid" />
            <h3 className="text-sm font-semibold text-clay-100">Google Drive Backup</h3>
          </div>
          <p className="text-xs text-clay-400 leading-relaxed mb-3">
            Backups are stored in Google Drive's hidden appDataFolder — invisible in your normal
            Drive, accessible only by this app.
          </p>

          <GlassCard padding="p-3 flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-clay-400" />
              <span className="text-sm text-clay-300">Last synced</span>
            </div>
            <span className="text-sm font-semibold text-clay-100">
              {lastSync ? formatDateDisplay(lastSync) : 'Never'}
            </span>
          </GlassCard>

          {!accessToken ? (
            <GlassButton onClick={handleConnect} disabled={busy} fullWidth>
              Connect to Google Drive
            </GlassButton>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <GlassButton onClick={handleBackup} disabled={busy} icon={CloudUpload} fullWidth>
                Backup Now
              </GlassButton>
              <GlassButton onClick={handleRestore} disabled={busy} icon={CloudDownload} variant="glass" fullWidth>
                Restore
              </GlassButton>
            </div>
          )}
        </GlassCard>

        <p className="text-[11px] text-clay-500 text-center px-4 leading-relaxed">
          Restore replaces all local data with the backup. Use only for new-device setup or
          disaster recovery.
        </p>
      </div>
    </div>
  );
}
