import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import { onDataChanged, getLastChangeAt } from '../db/schema';
import { createLocalBackup } from './localBackups';
import { getDriveToken, isDriveConnected, clearDriveToken } from '../drive/googleAuth';

/**
 * autoBackup.js
 * --------------
 * Keeps backups up to date WITHOUT the user having to remember:
 *   • ~1 minute after any change (sale, payment, expense …)
 *   • whenever the app goes to the background (home button, screen off)
 *   • on app start if anything changed since the last backup
 *
 * Every run writes an on-device backup file, and — if Google Drive has
 * been connected once — also uploads today's copy to Drive.
 * Failures never interrupt the user; they are shown on the Backup screen
 * and as a warning on the dashboard.
 */

const LS = {
  local: 'brickerp_last_local_backup',
  localLocation: 'brickerp_last_local_location',
  drive: 'brickerp_last_drive_backup',
  error: 'brickerp_last_backup_error',
};

const DEBOUNCE_MS = 60 * 1000;
const LOCAL_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DRIVE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export const useBackupStatus = create((set) => ({
  lastLocalAt: read(LS.local),
  lastLocalLocation: read(LS.localLocation),
  lastDriveAt: read(LS.drive),
  lastError: read(LS.error),
  running: false,
  _set: set,
}));

function setStatus(patch) {
  useBackupStatus.getState()._set(patch);
}

let running = null;

/**
 * Runs a backup cycle. `force` backs up even if nothing changed.
 * Returns { local, drive } results for UI feedback.
 */
export function runBackup({ force = false, includeDrive = true } = {}) {
  if (running) return running;
  running = (async () => {
    setStatus({ running: true });
    const result = { local: null, drive: null, errors: [] };
    const lastChange = getLastChangeAt();
    const now = Date.now();

    // ---- On-device backup ----
    try {
      const lastLocal = Date.parse(read(LS.local) || '') || 0;
      if (force || lastChange > lastLocal || now - lastLocal > LOCAL_MAX_AGE_MS) {
        const info = await createLocalBackup('auto');
        const at = new Date().toISOString();
        write(LS.local, at);
        write(LS.localLocation, info.location);
        setStatus({ lastLocalAt: at, lastLocalLocation: info.location });
        result.local = info;
      }
    } catch (e) {
      result.errors.push(`Device backup failed: ${e.message || e}`);
    }

    // ---- Google Drive backup ----
    if (includeDrive && isDriveConnected()) {
      try {
        const lastDrive = Date.parse(read(LS.drive) || '') || 0;
        if (force || lastChange > lastDrive || now - lastDrive > DRIVE_MAX_AGE_MS) {
          const token = await getDriveToken({ interactive: false });
          if (token) {
            const { uploadBackupToDrive } = await import('../drive/driveSync');
            try {
              await uploadBackupToDrive(token);
            } catch (e) {
              if (e.name === 'DriveAuthError' || /expired/i.test(e.message)) {
                clearDriveToken();
                const fresh = await getDriveToken({ interactive: false });
                if (!fresh) throw e;
                await uploadBackupToDrive(fresh);
              } else {
                throw e;
              }
            }
            const at = new Date().toISOString();
            write(LS.drive, at);
            setStatus({ lastDriveAt: at });
            result.drive = { at };
          } else if (Capacitor.isNativePlatform()) {
            result.errors.push('Google Drive: please reconnect your Google account.');
          }
        }
      } catch (e) {
        result.errors.push(`Drive backup failed: ${navigator.onLine === false ? 'no internet' : e.message || e}`);
      }
    }

    const err = result.errors.length ? result.errors.join(' · ') : null;
    // Only overwrite a previous error when this run actually attempted something.
    if (err || result.local || result.drive) {
      write(LS.error, err);
      setStatus({ lastError: err });
    }
    setStatus({ running: false });
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Records a successful manual Drive upload so the status stays accurate. */
export function markDriveBackupDone() {
  const at = new Date().toISOString();
  write(LS.drive, at);
  setStatus({ lastDriveAt: at });
}

/**
 * Starts the automatic scheduler. Call once after the DB is ready.
 * Returns a cleanup function.
 */
export function startAutoBackup() {
  let timer = null;
  let listener = null;
  let disposed = false;

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => runBackup().catch(() => {}), DEBOUNCE_MS);
  };

  const unsubscribe = onDataChanged(schedule);

  // Initial check shortly after launch (catches changes made right before the app was killed).
  const initial = setTimeout(() => runBackup().catch(() => {}), 4000);

  (async () => {
    try {
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('pause', () => {
        clearTimeout(timer);
        runBackup().catch(() => {});
      });
      if (disposed) handle.remove();
      else listener = handle;
    } catch {
      /* not native */
    }
  })();

  const onHide = () => {
    if (document.visibilityState === 'hidden') {
      clearTimeout(timer);
      runBackup().catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', onHide);

  return () => {
    disposed = true;
    clearTimeout(timer);
    clearTimeout(initial);
    unsubscribe();
    listener?.remove();
    document.removeEventListener('visibilitychange', onHide);
  };
}

/** Asks the browser/WebView not to evict our database under storage pressure. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted?.();
      if (!already) await navigator.storage.persist();
    }
  } catch {
    /* unsupported */
  }
}
