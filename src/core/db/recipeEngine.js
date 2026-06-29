import { db } from './schema';

/**
 * recipeEngine.js
 * ----------------
 * The beating heart of the production module. Given a brick size and a
 * quantity produced, this computes exact raw-material consumption
 * (scaled from the per-1000-brick recipe matrix), deducts it from live
 * inventory, allocates electricity cost, and returns a fully costed
 * production cost-per-brick figure.
 *
 * The recipe math is now 1-to-1: 1 unit of production requires 1 unit of the recipe.
 */

/**
 * Fetches the recipe (per 1000 bricks) for a given brick size.
 */
export async function getRecipe(brickSize) {
  const recipe = await db.recipes.where('brickSize').equals(brickSize).first();
  if (!recipe) {
    return { brickSize, materials: {} };
  }
  return recipe;
}

/**
 * Computes scaled raw-material requirements for a production run.
 * @param {string} brickSize - The product identifier
 * @param {number} quantity - number of units being produced in this run
 * @returns {object} scaled material requirements in kg + electricity in kWh
 */
export async function computeMaterialRequirement(brickSize, quantity) {
  const recipe = await getRecipe(brickSize);
  const scale = quantity; // Math is per 1-brick

  // Handle legacy flat format vs new `materials` object format
  const materialsRequired = {};
  
  if (recipe.materials) {
    for (const [matId, qty] of Object.entries(recipe.materials)) {
      materialsRequired[matId] = round2(qty * scale);
    }
  } else {
    // Legacy mapping by Name since old DB has 'Fly Ash' etc.
    const rawMats = await db.rawMaterials.toArray();
    const nameToId = Object.fromEntries(rawMats.map(m => [m.name, m.id]));
    
    const matFlyAsh = nameToId['Fly Ash'];
    const matLime = nameToId['Lime'];
    const matGypsum = nameToId['Gypsum'];
    const matSand = nameToId['Quarry Dust'] || nameToId['Sand'];
    const matCement = nameToId['Cement'];

    if (recipe.flyAshKg && matFlyAsh) materialsRequired[matFlyAsh] = round2(recipe.flyAshKg * scale);
    if (recipe.limeKg && matLime) materialsRequired[matLime] = round2(recipe.limeKg * scale);
    if (recipe.gypsumKg && matGypsum) materialsRequired[matGypsum] = round2(recipe.gypsumKg * scale);
    if (recipe.sandKg && matSand) materialsRequired[matSand] = round2(recipe.sandKg * scale);
    if (recipe.cementKg && matCement) materialsRequired[matCement] = round2(recipe.cementKg * scale);
  }

  return {
    materialsRequired, // { [materialId]: quantityRequired }
  };
}

/**
 * Checks whether current inventory can satisfy a planned production run.
 * Returns a list of shortfalls (empty array = good to go).
 */
export async function checkInventorySufficiency(brickSize, quantity) {
  const req = await computeMaterialRequirement(brickSize, quantity);
  const materials = await db.rawMaterials.toArray();
  const byId = Object.fromEntries(materials.map((m) => [m.id, m]));

  const shortfalls = [];

  for (const [matId, needed] of Object.entries(req.materialsRequired)) {
    if (needed <= 0) continue;
    const stock = byId[matId];
    if (!stock || stock.currentStock < needed) {
      shortfalls.push({
        materialId: matId,
        material: stock ? stock.name : `Unknown (${matId})`,
        needed,
        available: stock ? stock.currentStock : 0,
        shortBy: round2(needed - (stock ? stock.currentStock : 0)),
      });
    }
  }
  return shortfalls;
}

/**
 * Records a production run:
 *  1. Deducts raw materials (Fly Ash, Lime, Gypsum, Sand, Cement) from inventory
 *  2. Computes true cost-per-brick (materials only)
 *  3. Increments finished-goods stock for that brick size
 *  4. Writes an immutable productionLog entry
 *
 * @param {object} params
 * @param {string} params.date - ISO date string
 * @param {string} params.brickSize
 * @param {number} params.quantity
 * @param {boolean} [params.allowOverdraw] - if true, allows negative stock (manual override)
 */
export async function recordProduction({
  date,
  brickSize,
  quantity,
  allowOverdraw = false,
}) {
  if (!quantity || quantity <= 0) {
    throw new Error('Production quantity must be greater than zero.');
  }

  const req = await computeMaterialRequirement(brickSize, quantity);

  if (!allowOverdraw) {
    const shortfalls = await checkInventorySufficiency(brickSize, quantity);
    if (shortfalls.length > 0) {
      const err = new Error('Insufficient raw material stock for this production run.');
      err.shortfalls = shortfalls;
      throw err;
    }
  }

  return db.transaction(
    'rw',
    db.rawMaterials,
    db.finishedStock,
    db.productionLog,
    async () => {
      // 1. Deduct raw materials
      const materials = await db.rawMaterials.toArray();
      const byId = Object.fromEntries(materials.map((m) => [m.id, m]));

      let materialCost = 0;
      for (const [matId, qty] of Object.entries(req.materialsRequired)) {
        if (qty <= 0) continue;
        const mat = byId[matId];
        if (mat) {
          materialCost += qty * (mat.avgRate || 0);
          await db.rawMaterials.update(mat.id, {
            currentStock: round2(mat.currentStock - qty),
          });
        }
      }

      // 2. Total + per-brick cost
      const totalCost = round2(materialCost);
      const costPerBrick = round2(totalCost / quantity);

      // 3. Increment finished stock + update rolling cost price (weighted average)
      const stockRow = await db.finishedStock.where('brickSize').equals(brickSize).first();
      if (stockRow) {
        const existingValue = stockRow.currentStock * stockRow.costPrice;
        const newValue = existingValue + totalCost;
        const newQty = stockRow.currentStock + quantity;
        const newAvgCost = newQty > 0 ? round2(newValue / newQty) : costPerBrick;

        await db.finishedStock.update(stockRow.id, {
          currentStock: newQty,
          costPrice: newAvgCost,
        });
      }

      // 4. Write the immutable production log entry
      const id = await db.productionLog.add({
        date,
        brickSize,
        quantity,
        materialCost: round2(materialCost),
        totalCost,
        costPerBrick,
        materialsUsed: req,
        createdAt: new Date().toISOString(),
      });

      return { id, totalCost, costPerBrick, materialCost };
    }
  );
}

async function getSetting(key, fallback) {
  const row = await db.settings.where('key').equals(key).first();
  return row ? Number(row.value) : fallback;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
