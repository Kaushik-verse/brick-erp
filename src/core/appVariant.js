/**
 * Which app this build is: the classic "Brick ERP" or the new-design
 * "Factory Book" (`VITE_APP_VARIANT=new`). Both can be installed on the same
 * phone, so anything they store OUTSIDE their own app sandbox (phone storage
 * folders, Google Drive) must use different names, or one app's backups
 * would overwrite — or be blocked by — the other's.
 */
export const IS_NEW_APP = import.meta.env.VITE_APP_VARIANT === 'new';

/** Phone storage: Documents/<folder> and the backup file name prefix. */
export const BACKUP_FOLDER = IS_NEW_APP ? 'FactoryBook/Backups' : 'BrickERP/Backups';
export const BACKUP_FILE_PREFIX = IS_NEW_APP ? 'FactoryBook' : 'BrickERP';
export const BACKUP_LOCATION_LABEL = `Phone storage (Documents/${BACKUP_FOLDER})`;

/** Google Drive (hidden app folder): this app's daily file prefix. */
export const DRIVE_FILE_PREFIX = IS_NEW_APP ? 'factory_book_backup' : 'brick_erp_backup';
/** Prefixes this app can restore from (Factory Book can also restore classic backups). */
export const DRIVE_RESTORE_PREFIXES = IS_NEW_APP ? ['factory_book_backup', 'brick_erp_backup'] : ['brick_erp_backup'];
