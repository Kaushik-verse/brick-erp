import Dexie from 'dexie';
import { Capacitor } from '@capacitor/core';
import { exportDatabaseSnapshot, parseSnapshotText, countRecords, restoreDatabaseSnapshot, validateSnapshot } from './snapshot';
import { db, markDataChanged } from '../db/schema';
import { saveAndShareBlob } from '../utils/nativeFileBridge';
import { toLocalISOString } from '../utils/format';
import { BACKUP_FOLDER, BACKUP_FILE_PREFIX, BACKUP_LOCATION_LABEL } from '../appVariant';

/**
 * localBackups.js
 * ----------------
 * Automatic on-device backups that need no internet and no account.
 *
 * ANDROID: JSON files are written to the phone's public storage at
 *   Documents/BrickERP/Backups/   (classic app)
 *   Documents/FactoryBook/Backups/ (Factory Book — its own folder, so the two
 *   apps never overwrite or block each other's files)
 * Files there SURVIVE an app uninstall or "Clear data", and can be copied
 * to a PC/pen-drive or shared over WhatsApp. If public storage is not
 * available (old Android without permission), we fall back to the app's
 * private storage so a backup is still taken.
 *
 * WEB / DESKTOP BROWSER: a separate IndexedDB database keeps the last few
 * restore points (protects against mistakes, not against clearing the
 * browser). Use "Export backup file" or Google Drive for off-device copies.
 *
 * Retention:
 *   auto    — one file per day (overwritten during the day), keep 30 days
 *   safety  — taken before restore / reset / risky operations, keep 10
 *   monthly — one per month (holds that month's last state), kept FOREVER,
 *             so every month since the app was first used can be restored
 */

const FOLDER = BACKUP_FOLDER;
const KEEP = { auto: 30, safety: 10 };

const isNative = () => Capacitor.isNativePlatform();

// ---------- helpers ----------

function pad(n) {
  return String(n).padStart(2, '0');
}

function fileNameFor(kind, date = new Date()) {
  const day = toLocalISOString(date);
  if (kind === 'auto') return `${BACKUP_FILE_PREFIX}_auto_${day}.json`;
  if (kind === 'monthly') return `${BACKUP_FILE_PREFIX}_monthly_${day.slice(0, 7)}.json`;
  // Milliseconds keep two copies made in the same second (e.g. safety copy + restore) apart.
  return `${BACKUP_FILE_PREFIX}_${kind}_${day}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${String(date.getMilliseconds()).padStart(3, '0')}.json`;
}

function kindFromName(name) {
  const m = /^(?:BrickERP|FactoryBook)_([a-z]+)_/.exec(name);
  return m ? m[1] : 'manual';
}

// ---------- web restore-point store ----------

let webStore = null;
function getWebStore() {
  if (!webStore) {
    webStore = new Dexie('BrickERP_RestorePoints');
    webStore.version(1).stores({ points: '++id, name, kind, createdAt' });
  }
  return webStore;
}

// ---------- native filesystem ----------

async function fs() {
  const mod = await import('@capacitor/filesystem');
  return mod;
}

async function ensurePublicStoragePermission() {
  try {
    const { Filesystem } = await fs();
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage === 'granted') return true;
    const req = await Filesystem.requestPermissions();
    return req.publicStorage === 'granted';
  } catch {
    return false;
  }
}

async function writeNativeFile(name, text) {
  const { Filesystem, Directory, Encoding } = await fs();
  const attempt = async (directory) =>
    Filesystem.writeFile({
      path: `${FOLDER}/${name}`,
      data: text,
      directory,
      encoding: Encoding.UTF8,
      recursive: true,
    });

  try {
    await attempt(Directory.Documents);
    return 'documents';
  } catch (e) {
    // Android 9 and below need runtime storage permission for Documents.
    if (await ensurePublicStoragePermission()) {
      try {
        await attempt(Directory.Documents);
        return 'documents';
      } catch {
        /* fall through to private storage */
      }
    }
    await attempt(Directory.Data);
    return 'app';
  }
}

async function listNativeDir(directoryKey) {
  const { Filesystem, Directory } = await fs();
  try {
    const res = await Filesystem.readdir({ path: FOLDER, directory: Directory[directoryKey] });
    return (res.files || [])
      .filter((f) => (f.type ? f.type === 'file' : true) && f.name.endsWith('.json'))
      .map((f) => ({
        id: `${directoryKey}:${f.name}`,
        name: f.name,
        kind: kindFromName(f.name),
        size: f.size || 0,
        createdAt: f.mtime ? new Date(Number(f.mtime)).toISOString() : null,
        location: directoryKey === 'Documents' ? BACKUP_LOCATION_LABEL : 'App storage',
        directoryKey,
      }));
  } catch {
    return [];
  }
}

// ---------- public API ----------

/**
 * Writes a backup of the current database.
 * @param {'auto'|'safety'|'manual'|'monthly'} kind
 * @returns {{ name, location, records, size }}
 */
export async function createLocalBackup(kind = 'auto') {
  const snapshot = await exportDatabaseSnapshot();
  const records = countRecords(snapshot);
  const write = async (k) => {
    const name = fileNameFor(k);
    const text = JSON.stringify({ ...snapshot, backupKind: k });
    if (isNative()) return { name, location: await writeNativeFile(name, text), size: text.length };
    const store = getWebStore();
    await store.transaction('rw', store.points, async () => {
      // Daily and monthly copies replace the earlier one of the same day / month.
      if (k === 'auto' || k === 'monthly') await store.points.where('name').equals(name).delete();
      await store.points.add({ name, kind: k, createdAt: new Date().toISOString(), size: text.length, records, text });
    });
    return { name, location: 'browser', size: text.length };
  };

  const main = await write(kind);
  // The daily backup also refreshes this month's permanent copy.
  if (kind === 'auto') await write('monthly').catch(() => {});
  await pruneLocalBackups().catch(() => {});
  return { ...main, records };
}

/** Newest-first list of on-device backups. */
export async function listLocalBackups() {
  if (isNative()) {
    const [docs, app] = await Promise.all([listNativeDir('Documents'), listNativeDir('Data')]);
    const all = [...docs, ...app];
    return all.sort((a, b) => (b.createdAt || b.name).localeCompare(a.createdAt || a.name));
  }
  const store = getWebStore();
  const points = await store.points.orderBy('createdAt').reverse().toArray();
  return points.map((p) => ({
    id: `web:${p.id}`,
    name: p.name,
    kind: p.kind,
    size: p.size,
    records: p.records,
    createdAt: p.createdAt,
    location: 'This browser',
  }));
}

/** Reads and validates a backup from the on-device list. */
export async function readLocalBackup(entry) {
  if (entry.id.startsWith('web:')) {
    const store = getWebStore();
    const point = await store.points.get(Number(entry.id.slice(4)));
    if (!point) throw new Error('Restore point not found.');
    return parseSnapshotText(point.text);
  }
  const { Filesystem, Directory, Encoding } = await fs();
  const res = await Filesystem.readFile({
    path: `${FOLDER}/${entry.name}`,
    directory: Directory[entry.directoryKey],
    encoding: Encoding.UTF8,
  });
  return parseSnapshotText(typeof res.data === 'string' ? res.data : await res.data.text());
}

async function pruneLocalBackups() {
  const all = await listLocalBackups();
  const byKind = {};
  for (const b of all) (byKind[b.kind] = byKind[b.kind] || []).push(b);

  const toDelete = [];
  for (const [kind, list] of Object.entries(byKind)) {
    const keep = KEEP[kind];
    if (!keep) continue; // never auto-delete manual files
    toDelete.push(...list.slice(keep));
  }
  if (!toDelete.length) return;

  if (isNative()) {
    const { Filesystem, Directory } = await fs();
    for (const b of toDelete) {
      await Filesystem.deleteFile({ path: `${FOLDER}/${b.name}`, directory: Directory[b.directoryKey] }).catch(() => {});
    }
  } else {
    const store = getWebStore();
    await store.points.bulkDelete(toDelete.map((b) => Number(b.id.slice(4))));
  }
}

/** Shares/saves a specific on-device backup through the native share sheet. */
export async function shareLocalBackup(entry) {
  const snapshot = await readLocalBackup(entry);
  const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
  await saveAndShareBlob(blob, entry.name, 'application/json');
}

/**
 * Restores a snapshot, but FIRST saves a safety copy of the current data
 * so a wrong restore can always be undone from the restore-point list.
 */
export async function restoreWithSafetyBackup(snapshot) {
  validateSnapshot(snapshot);
  await createLocalBackup('safety');
  await restoreDatabaseSnapshot(snapshot);
}

/**
 * Wipes every business table after taking a safety backup. Off-device
 * backups (Google Drive, phone storage files) are intentionally left
 * untouched so a reset is always recoverable.
 */
export async function factoryResetWithSafetyBackup() {
  await createLocalBackup('safety');
  const tables = db.tables;
  await db.transaction('rw', tables, async () => {
    for (const t of tables) await t.clear();
  });
  markDataChanged();
}
