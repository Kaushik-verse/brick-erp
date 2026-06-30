import { db } from '../db/schema';
import { Preferences } from '@capacitor/preferences';

/**
 * driveSync.js
 * -------------
 * Google Drive backup/restore using the hidden `appDataFolder` scope.
 * appDataFolder is invisible in the user's normal Drive UI — it's a
 * private sandboxed space per-app, which is exactly right for a
 * financial ledger backup file the owner shouldn't accidentally delete
 * by browsing Drive.
 *
 * AUTH NOTE: This module expects an OAuth 2.0 access token with the
 * scope `https://www.googleapis.com/auth/drive.appdata` to already be
 * available (obtained via Capacitor Google Auth plugin or a custom
 * native OAuth flow — not implemented here, since token acquisition is
 * platform/credential-specific). Pass the token into each function.
 *
 * The whole local-first architecture means Drive sync is OPTIONAL —
 * the app is fully functional offline with zero Drive connectivity.
 * This module is a safety net, not a dependency.
 */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const BACKUP_FILENAME = 'brick_erp_backup.json';

/**
 * Serializes the entire local database into a single JSON snapshot.
 */
export async function exportDatabaseSnapshot() {
  const [
    customers,
    suppliers,
    rawMaterials,
    finishedStock,
    productionLog,
    salesLog,
    purchaseLog,
    expenses,
    recipes,
    settings,
    customerCollections,
    supplierPayments,
    units,
    vehicles,
    drivers,
    invoiceSettings,
  ] = await Promise.all([
    db.customers.toArray(),
    db.suppliers.toArray(),
    db.rawMaterials.toArray(),
    db.finishedStock.toArray(),
    db.productionLog.toArray(),
    db.salesLog.toArray(),
    db.purchaseLog.toArray(),
    db.expenses.toArray(),
    db.recipes.toArray(),
    db.settings.toArray(),
    db.customerCollections.toArray(),
    db.supplierPayments.toArray(),
    db.units.toArray(),
    db.vehicles.toArray(),
    db.drivers.toArray(),
    db.invoiceSettings.toArray(),
  ]);

  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    data: {
      customers,
      suppliers,
      rawMaterials,
      finishedStock,
      productionLog,
      salesLog,
      purchaseLog,
      expenses,
      recipes,
      settings,
      customerCollections,
      supplierPayments,
      units,
      vehicles,
      drivers,
      invoiceSettings,
    },
  };
}

/**
 * Restores the database from a previously exported snapshot. This is a
 * destructive full-replace restore — used for disaster recovery
 * (new device / app reinstall), not for merging.
 */
export async function restoreDatabaseSnapshot(snapshot) {
  if (!snapshot?.data) throw new Error('Invalid backup file: missing data payload.');
  const { data } = snapshot;

  await db.transaction(
    'rw',
    db.customers,
    db.suppliers,
    db.rawMaterials,
    db.finishedStock,
    db.productionLog,
    db.salesLog,
    db.purchaseLog,
    db.expenses,
    db.recipes,
    db.settings,
    db.customerCollections,
    db.supplierPayments,
    db.units,
    db.vehicles,
    db.drivers,
    db.invoiceSettings,
    async () => {
      await Promise.all([
        db.customers.clear(),
        db.suppliers.clear(),
        db.rawMaterials.clear(),
        db.finishedStock.clear(),
        db.productionLog.clear(),
        db.salesLog.clear(),
        db.purchaseLog.clear(),
        db.expenses.clear(),
        db.recipes.clear(),
        db.settings.clear(),
        db.customerCollections.clear(),
        db.supplierPayments.clear(),
        db.units.clear(),
        db.vehicles.clear(),
        db.drivers.clear(),
        db.invoiceSettings.clear(),
      ]);

      await Promise.all([
        data.customers?.length && db.customers.bulkAdd(data.customers),
        data.suppliers?.length && db.suppliers.bulkAdd(data.suppliers),
        data.rawMaterials?.length && db.rawMaterials.bulkAdd(data.rawMaterials),
        data.finishedStock?.length && db.finishedStock.bulkAdd(data.finishedStock),
        data.productionLog?.length && db.productionLog.bulkAdd(data.productionLog),
        data.salesLog?.length && db.salesLog.bulkAdd(data.salesLog),
        data.purchaseLog?.length && db.purchaseLog.bulkAdd(data.purchaseLog),
        data.expenses?.length && db.expenses.bulkAdd(data.expenses),
        data.recipes?.length && db.recipes.bulkAdd(data.recipes),
        data.settings?.length && db.settings.bulkAdd(data.settings),
        data.customerCollections?.length && db.customerCollections.bulkAdd(data.customerCollections),
        data.supplierPayments?.length && db.supplierPayments.bulkAdd(data.supplierPayments),
        data.units?.length && db.units.bulkAdd(data.units),
        data.vehicles?.length && db.vehicles.bulkAdd(data.vehicles),
        data.drivers?.length && db.drivers.bulkAdd(data.drivers),
        data.invoiceSettings?.length && db.invoiceSettings.bulkAdd(data.invoiceSettings),
      ]);
    }
  );
}

/**
 * Finds the existing backup file ID in appDataFolder, if one exists.
 */
async function findExistingBackupFileId(accessToken) {
  const url = `${DRIVE_API_BASE}/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&fields=files(id,modifiedTime)`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive lookup failed: ${res.status}`);
  const json = await res.json();
  return json.files?.[0] || null;
}

/**
 * Uploads (creates or updates) the backup JSON file into appDataFolder.
 */
export async function uploadBackupToDrive(accessToken) {
  const snapshot = await exportDatabaseSnapshot();
  const fileContent = JSON.stringify(snapshot);
  const existing = await findExistingBackupFileId(accessToken);

  const metadata = existing
    ? { name: BACKUP_FILENAME }
    : { name: BACKUP_FILENAME, parents: ['appDataFolder'] };

  const boundary = 'brick_erp_backup_boundary';
  const multipartBody =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${fileContent}\r\n` +
    `--${boundary}--`;

  const url = existing
    ? `${DRIVE_UPLOAD_BASE}/files/${existing.id}?uploadType=multipart`
    : `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`;

  const res = await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Drive upload failed: ${res.status} ${errBody}`);
  }

  const result = await res.json();

  await db.driveSyncMeta.clear();
  await db.driveSyncMeta.add({
    lastSyncedAt: new Date().toISOString(),
    fileId: result.id,
  });
  await Preferences.set({ key: 'lastDriveSync', value: new Date().toISOString() });

  return result;
}

/**
 * Downloads and restores the backup JSON file from appDataFolder.
 */
export async function downloadBackupFromDrive(accessToken) {
  const existing = await findExistingBackupFileId(accessToken);
  if (!existing) throw new Error('No backup file found in Google Drive appDataFolder.');

  const res = await fetch(`${DRIVE_API_BASE}/files/${existing.id}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);

  const snapshot = await res.json();
  await restoreDatabaseSnapshot(snapshot);
  return snapshot;
}

/** Reads the locally cached "last synced" timestamp for UI display. */
export async function getLastSyncTimestamp() {
  const { value } = await Preferences.get({ key: 'lastDriveSync' });
  return value || null;
}
