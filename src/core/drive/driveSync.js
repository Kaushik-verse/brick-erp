import { db } from '../db/schema';
import { Preferences } from '@capacitor/preferences';
import { exportDatabaseSnapshot, parseSnapshotText } from '../backup/snapshot';
import { toLocalISOString } from '../utils/format';
import { DRIVE_FILE_PREFIX, DRIVE_RESTORE_PREFIXES } from '../appVariant';

/**
 * driveSync.js
 * -------------
 * Google Drive backup/restore using the hidden `appDataFolder` scope —
 * a private per-app space in the owner's own Google account. Free, no
 * server needed, and invisible in the normal Drive UI so it can't be
 * deleted by accident.
 *
 * VERSIONED: one file per day (<prefix>_YYYY-MM-DD.json), the last 30 days
 * are kept, plus one file per month (<prefix>_monthly_YYYY-MM.json) that is
 * never deleted, so every month since the start stays restorable. A bad day (wrong entries, accidental delete)
 * can therefore never overwrite every good copy — older days remain
 * restorable. The legacy single file (brick_erp_backup.json) from older
 * app versions is still listed and restorable.
 *
 * The app stays fully functional offline; Drive is a safety net only.
 */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
// Each app writes (and prunes) only its own files; Factory Book can also list
// and restore the classic app's backups. See core/appVariant.js.
const FILE_PREFIX = DRIVE_FILE_PREFIX;
const KEEP_DAYS = 30;

export { exportDatabaseSnapshot };

export class DriveAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DriveAuthError';
  }
}

async function driveFetch(url, accessToken, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) },
  });
  if (res.status === 401 || res.status === 403) {
    throw new DriveAuthError('Google sign-in expired. Please connect Google Drive again.');
  }
  return res;
}

/** Newest-first list of every Brick ERP backup in appDataFolder. */
export async function listDriveBackups(accessToken) {
  const names = DRIVE_RESTORE_PREFIXES.map((p) => `name contains '${p}'`).join(' or ');
  const q = encodeURIComponent(`(${names}) and trashed = false`);
  const url = `${DRIVE_API_BASE}/files?spaces=appDataFolder&q=${q}&orderBy=modifiedTime desc&pageSize=200&fields=files(id,name,modifiedTime,size)`;
  const res = await driveFetch(url, accessToken);
  if (!res.ok) throw new Error(`Drive lookup failed (${res.status})`);
  const json = await res.json();
  return json.files || [];
}

function dailyFileName(date = new Date()) {
  return `${FILE_PREFIX}_${toLocalISOString(date)}.json`;
}

/**
 * Uploads today's backup and this month's permanent copy (each created or
 * replaced), then prunes daily files older than KEEP_DAYS.
 */
export async function uploadBackupToDrive(accessToken) {
  const snapshot = await exportDatabaseSnapshot();
  snapshot.backupKind = 'drive';
  const fileContent = JSON.stringify(snapshot);
  const name = dailyFileName();
  const monthName = `${FILE_PREFIX}_monthly_${toLocalISOString(new Date()).slice(0, 7)}.json`;

  const files = await listDriveBackups(accessToken);
  const result = await upsertFile(accessToken, files, name, fileContent);
  // This month's permanent copy (never pruned).
  await upsertFile(accessToken, files, monthName, fileContent).catch(() => {});

  // Prune old DAILY files of this app only (never monthly or legacy files).
  const dated = files.filter((f) => f.name.startsWith(`${FILE_PREFIX}_`) && /_\d{4}-\d{2}-\d{2}\.json$/.test(f.name) && f.name !== name);
  const stale = dated.slice(KEEP_DAYS - 1);
  for (const f of stale) {
    await driveFetch(`${DRIVE_API_BASE}/files/${f.id}`, accessToken, { method: 'DELETE' }).catch(() => {});
  }

  const now = new Date().toISOString();
  await db.driveSyncMeta.clear();
  await db.driveSyncMeta.add({ lastSyncedAt: now, fileId: result.id });
  await Preferences.set({ key: 'lastDriveSync', value: now });

  return result;
}

/** Creates the file in appDataFolder, or replaces its content if it exists. */
async function upsertFile(accessToken, files, name, content) {
  const existing = files.find((f) => f.name === name);
  const metadata = existing ? { name } : { name, parents: ['appDataFolder'] };
  const boundary = `brick_erp_${Date.now()}`;
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${content}\r\n` +
    `--${boundary}--`;
  const url = existing
    ? `${DRIVE_UPLOAD_BASE}/files/${existing.id}?uploadType=multipart`
    : `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`;
  const res = await driveFetch(url, accessToken, {
    method: existing ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Drive upload failed: ${res.status} ${errBody.slice(0, 200)}`);
  }
  return res.json();
}

/** Downloads and validates a specific Drive backup (newest if no id). */
export async function downloadDriveBackup(accessToken, fileId) {
  let id = fileId;
  if (!id) {
    const files = await listDriveBackups(accessToken);
    if (!files.length) throw new Error('No backup found in Google Drive.');
    id = files[0].id;
  }
  const res = await driveFetch(`${DRIVE_API_BASE}/files/${id}?alt=media`, accessToken);
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
  return parseSnapshotText(await res.text());
}
