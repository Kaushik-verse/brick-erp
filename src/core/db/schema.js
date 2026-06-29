import Dexie from 'dexie';

/**
 * BrickERPDatabase
 * -----------------
 * Local-first IndexedDB store via Dexie. Every table is designed so the
 * device works fully offline; Google Drive sync (see core/drive) is a
 * backup/restore layer on top, never a requirement for normal operation.
 *
 * Schema notes:
 * - All monetary values are stored in plain rupees (number), not paise,
 *   to keep ledger math simple and human-debuggable.
 * - All dates are stored as ISO strings (YYYY-MM-DD) for stable indexing
 *   and easy aging calculations.
 * - `id` fields are Dexie auto-increment primary keys (++id).
 */
export class BrickERPDatabase extends Dexie {
  constructor() {
    super('BrickERP');

    this.version(1).stores({
      // ---- Masters --------------------------------------------------
      customers: '++id, name, phone, outstandingBalance, createdAt',
      suppliers: '++id, name, phone, outstandingBalance, createdAt',

      // ---- Inventory --------------------------------------------------
      rawMaterials: '++id, name, unit, currentStock, reorderLevel, avgRate',
      finishedStock: '++id, brickSize, currentStock, costPrice, sellingPrice',

      // ---- Transactional logs -----------------------------------------
      productionLog: '++id, date, brickSize, quantity, costPerBrick, totalCost, electricityUnits, createdAt',
      salesLog: '++id, date, customerId, brickSize, quantity, rate, totalAmount, amountPaid, balanceDue, paymentStatus, paymentChannel, createdAt',
      purchaseLog: '++id, date, supplierId, materialId, quantity, rate, totalAmount, amountPaid, balanceDue, paymentStatus, paymentChannel, createdAt',
      expenses: '++id, date, category, amount, paymentChannel, note, createdAt',

      // ---- System -------------------------------------------------------
      recipes: '++id, brickSize',
      settings: '++id, key, value',
      driveSyncMeta: '++id, lastSyncedAt, fileId',
    });

    this.version(2).stores({
      rawMaterials: '++id, name, unit, currentStock, reorderLevel, avgRate, isActive',
      finishedStock: '++id, brickSize, currentStock, costPrice, sellingPrice, isActive',
      salesLog: '++id, date, customerId, brickSize, quantity, rate, totalAmount, amountPaid, balanceDue, paymentStatus, paymentChannel, vehicleId, driverId, createdAt',
      purchaseLog: '++id, date, supplierId, materialId, quantity, rate, totalAmount, amountPaid, balanceDue, paymentStatus, paymentChannel, vehicleId, driverId, createdAt',
      customerCollections: '++id, date, customerId, amount, paymentChannel, createdAt',
      supplierPayments: '++id, date, supplierId, amount, paymentChannel, createdAt',
      units: '++id, name, symbol, baseUnit, conversionFactor, isActive',
      vehicles: '++id, vehicleNumber, owner, capacity, driverAssigned, isActive',
      drivers: '++id, name, phone, licenseNumber, isActive',
    }).upgrade(tx => {
      // Set isActive to 1 for existing items
      return tx.table('rawMaterials').toCollection().modify(item => { item.isActive = 1; })
        .then(() => tx.table('finishedStock').toCollection().modify(item => { item.isActive = 1; }));
    });

    this.version(3).stores({
      // No schema change, just data cleanup
    }).upgrade(async tx => {
      // Rename 'Sand' to 'Quarry Dust'
      await tx.table('rawMaterials').where('name').equals('Sand').modify({ name: 'Quarry Dust' });
      
      // Remove 'Cement'
      await tx.table('rawMaterials').where('name').equals('Cement').delete();

      // Deduplicate
      const allMaterials = await tx.table('rawMaterials').toArray();
      const seen = new Set();
      const idsToDelete = [];
      for (const m of allMaterials) {
        const key = m.name.toLowerCase();
        if (seen.has(key)) {
          idsToDelete.push(m.id);
        } else {
          seen.add(key);
        }
      }
      if (idsToDelete.length > 0) {
        await tx.table('rawMaterials').bulkDelete(idsToDelete);
      }
    });

    this.customers = this.table('customers');
    this.suppliers = this.table('suppliers');
    this.rawMaterials = this.table('rawMaterials');
    this.finishedStock = this.table('finishedStock');
    this.productionLog = this.table('productionLog');
    this.salesLog = this.table('salesLog');
    this.purchaseLog = this.table('purchaseLog');
    this.expenses = this.table('expenses');
    this.recipes = this.table('recipes');
    this.settings = this.table('settings');
    this.driveSyncMeta = this.table('driveSyncMeta');
    
    this.customerCollections = this.table('customerCollections');
    this.supplierPayments = this.table('supplierPayments');
    this.units = this.table('units');
    this.vehicles = this.table('vehicles');
    this.drivers = this.table('drivers');
  }
}

export const db = new BrickERPDatabase();

let seedPromise = null;

/**
 * Seeds the database with sensible factory defaults on first launch only.
 * Idempotent and protected against React StrictMode double-execution.
 */
export function seedDatabaseIfEmpty() {
  if (!seedPromise) {
    seedPromise = doSeedDatabaseIfEmpty();
  }
  return seedPromise;
}

async function doSeedDatabaseIfEmpty() {
  const materialCount = await db.rawMaterials.count();
  if (materialCount === 0) {
    await db.rawMaterials.bulkAdd([
      { name: 'Fly Ash', unit: 'kg', currentStock: 0, reorderLevel: 5000, avgRate: 0.5, isActive: 1 },
      { name: 'Lime', unit: 'kg', currentStock: 0, reorderLevel: 1000, avgRate: 8, isActive: 1 },
      { name: 'Gypsum', unit: 'kg', currentStock: 0, reorderLevel: 500, avgRate: 6, isActive: 1 },
      { name: 'Quarry Dust', unit: 'kg', currentStock: 0, reorderLevel: 3000, avgRate: 1.2, isActive: 1 },
    ]);
  }

  const stockCount = await db.finishedStock.count();
  if (stockCount === 0) {
    await db.finishedStock.bulkAdd([
      { brickSize: '4-inch', currentStock: 0, costPrice: 0, sellingPrice: 7, isActive: 1 },
      { brickSize: '8-inch', currentStock: 0, costPrice: 0, sellingPrice: 12, isActive: 1 },
      { brickSize: '9-inch', currentStock: 0, costPrice: 0, sellingPrice: 14, isActive: 1 },
    ]);
  }

  const recipeCount = await db.recipes.count();
  if (recipeCount === 0) {
    // Quantities are per 1 brick produced
    await db.recipes.bulkAdd([
      {
        brickSize: '4-inch',
        flyAshKg: 3, limeKg: 1, gypsumKg: 0.1, sandKg: 10.9, cementKg: 0,
      },
      {
        brickSize: '8-inch',
        flyAshKg: 3, limeKg: 1, gypsumKg: 0.1, sandKg: 10.9, cementKg: 0,
      },
      {
        brickSize: '9-inch',
        flyAshKg: 3, limeKg: 1, gypsumKg: 0.1, sandKg: 10.9, cementKg: 0,
      },
    ]);
  }

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.bulkAdd([
      { key: 'factoryName', value: 'Jaya Vasavi Industries' },
      { key: 'factoryPhone', value: '9502266200' },
      { key: 'ownerName', value: 'SriRamKumar(Ch Nagabhushanam)' },
      { key: 'factoryAddress', value: '' },
      { key: 'gstin', value: '' },
      { key: 'businessCategories', value: 'Fly Ash Bricks | RCC Pipes | Cement Products' },
      { key: 'bankName', value: '' },
      { key: 'accountNumber', value: '' },
      { key: 'ifscCode', value: '' },
      { key: 'upiId', value: '' },
    ]);
  }

  const unitsCount = await db.units.count();
  if (unitsCount === 0) {
    await db.units.bulkAdd([
      { name: 'Kilogram', symbol: 'kg', baseUnit: 'kg', conversionFactor: 1, isActive: 1 },
      { name: 'Ton', symbol: 'ton', baseUnit: 'kg', conversionFactor: 1000, isActive: 1 },
      { name: 'Piece', symbol: 'pc', baseUnit: 'pc', conversionFactor: 1, isActive: 1 },
      { name: 'Bag', symbol: 'bag', baseUnit: 'bag', conversionFactor: 1, isActive: 1 },
      { name: 'Cubic Feet', symbol: 'cft', baseUnit: 'cft', conversionFactor: 1, isActive: 1 },
      { name: 'Cubic Meter', symbol: 'cum', baseUnit: 'cum', conversionFactor: 1, isActive: 1 },
      { name: 'Liter', symbol: 'L', baseUnit: 'L', conversionFactor: 1, isActive: 1 },
      { name: 'Unit', symbol: 'unit', baseUnit: 'kg', conversionFactor: 4000, isActive: 1 },
    ]);
  } else {
    const hasUnit = await db.units.where('name').equalsIgnoreCase('Unit').count();
    if (hasUnit === 0) {
      await db.units.add({ name: 'Unit', symbol: 'unit', baseUnit: 'kg', conversionFactor: 4000, isActive: 1 });
    }
  }
}
