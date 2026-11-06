import { db, markDataChanged } from '../db/schema';

/**
 * snapshot.js
 * ------------
 * Single source of truth for turning the whole local database into a
 * portable JSON backup and back again. Every backup path (device files,
 * Google Drive, manual export/share) goes through these functions so a
 * backup can never silently miss a table again.
 *
 * Tables are discovered dynamically from the Dexie schema, so new tables
 * added in future schema versions are automatically included.
 */

export const BACKUP_FORMAT = 'brick-erp-backup';
export const BACKUP_FORMAT_VERSION = 3;

// Purely local bookkeeping — never part of a backup.
const EXCLUDED_TABLES = new Set(['driveSyncMeta']);

function backupTables() {
  return db.tables.filter((t) => !EXCLUDED_TABLES.has(t.name));
}

/** Serializes the entire local database into a single JSON snapshot. */
export async function exportDatabaseSnapshot() {
  const tables = backupTables();
  const data = {};
  const counts = {};

  // A single read transaction guarantees a consistent point-in-time copy.
  await db.transaction('r', tables, async () => {
    for (const table of tables) {
      const rows = await table.toArray();
      data[table.name] = rows;
      counts[table.name] = rows.length;
    }
  });

  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_FORMAT_VERSION,
    dbVersion: db.verno,
    exportedAt: new Date().toISOString(),
    counts,
    data,
  };
}

/** Total number of business records in a snapshot (for UI summaries). */
export function countRecords(snapshot) {
  const data = snapshot?.data || {};
  return Object.values(data).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
}

/**
 * Human-friendly summary of what a backup contains, shown before restore
 * so the user can confirm they picked the right file.
 */
export function summarizeSnapshot(snapshot) {
  const d = snapshot?.data || {};
  const len = (k) => (Array.isArray(d[k]) ? d[k].length : 0);
  return {
    exportedAt: snapshot?.exportedAt || null,
    customers: len('customers'),
    suppliers: len('suppliers'),
    sales: len('salesLog'),
    purchases: len('purchaseLog'),
    production: len('productionLog'),
    expenses: len('expenses'),
    collections: len('customerCollections'),
    payments: len('supplierPayments'),
    manualEntries: len('manualTransactions'),
    total: countRecords(snapshot),
  };
}

/**
 * Validates a parsed backup object. Throws a readable Error if the file is
 * not a usable backup, so a bad file can never wipe good data.
 */
export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('This file is not a Brick ERP backup.');
  }
  if (!snapshot.data || typeof snapshot.data !== 'object') {
    throw new Error('Invalid backup file: missing data payload.');
  }
  for (const [name, rows] of Object.entries(snapshot.data)) {
    if (!Array.isArray(rows)) {
      throw new Error(`Invalid backup file: table "${name}" is damaged.`);
    }
  }
  // Integrity check: newer backups record row counts at export time.
  if (snapshot.counts) {
    for (const [name, expected] of Object.entries(snapshot.counts)) {
      const actual = snapshot.data[name]?.length ?? 0;
      if (actual !== expected) {
        throw new Error(`Backup file is incomplete (${name}: expected ${expected}, found ${actual}).`);
      }
    }
  }
  const knownTables = new Set(db.tables.map((t) => t.name));
  const usable = Object.keys(snapshot.data).filter((n) => knownTables.has(n));
  if (usable.length === 0) {
    throw new Error('Backup file contains no recognizable data.');
  }
  return true;
}

/** Parses JSON text into a validated snapshot. */
export function parseSnapshotText(text) {
  let snapshot;
  try {
    snapshot = JSON.parse(text);
  } catch {
    throw new Error('Backup file is corrupted or not valid JSON.');
  }
  validateSnapshot(snapshot);
  return snapshot;
}

/**
 * Restores the database from a snapshot (full replace, atomic).
 *
 * Only tables that are PRESENT in the backup are replaced. This matters
 * for backups made by older versions of the app that did not include
 * some tables (e.g. Passbook manual entries) — those local tables are
 * left untouched instead of being wiped.
 *
 * Callers should create a safety backup first (see localBackups.js).
 */
export async function restoreDatabaseSnapshot(snapshot) {
  validateSnapshot(snapshot);
  const tables = backupTables().filter((t) => Array.isArray(snapshot.data[t.name]));

  await db.transaction('rw', tables, async () => {
    for (const table of tables) {
      await table.clear();
      const rows = snapshot.data[table.name];
      if (rows.length) await table.bulkPut(rows);
    }
  });
  markDataChanged();
}
