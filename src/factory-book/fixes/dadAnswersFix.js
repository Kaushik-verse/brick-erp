import { db, markDataChanged } from '../../core/db/schema';

/**
 * dadAnswersFix.js — one-time correction for Factory Book (new app only).
 *
 * Built from the owner's answers to the questionnaire (6 Nov 2026):
 *  - Recipe per brick: 4"/8" = fly ash 3 kg, lime 1 kg, gypsum 200 g;
 *                      9"    = fly ash 3.5 kg, lime 1.2 kg, gypsum 250 g.
 *  - Quarry Dust is counted in units (1 unit = 1 m³; 1 lorry = 6 units ≈ ₹14,000
 *    incl. transport). 1 unit makes 300 bricks (4"/8") or 275 bricks (9").
 *  - Brick-making labour: ₹3.50 per brick (4"/8"), ₹3.80 (9").
 *  - The 9 Oct "6 t Lime, ₹14,500" from Baby peddakapu was really 6 units of Quarry Dust.
 *  - Stock counted on 6 Nov: fly ash 12 t, lime 21 t, gypsum 500 kg, quarry dust 3 m³;
 *    bricks 4" 170, 8" 0, 9" 2600.
 *  - Selling price incl. transport: ₹26 (4"/8"), ₹28 (9"). No GST on bills.
 *
 * Runs once (marker in settings). Bill totals, supplier balances and cash/bank
 * entries are never changed; only quantities, units, recipes and costs.
 */

const MARKER = 'fix_dadAnswers_v1';
const COUNT_DATE = '2026-11-06';

const RECIPE = {
  '4-inch': { flyAsh: 3, lime: 1, gypsum: 0.2, bricksPerUnit: 300, labour: 3.5, price: 26 },
  '8-inch': { flyAsh: 3, lime: 1, gypsum: 0.2, bricksPerUnit: 300, labour: 3.5, price: 26 },
  '9-inch': { flyAsh: 3.5, lime: 1.2, gypsum: 0.25, bricksPerUnit: 275, labour: 3.8, price: 28 },
};

// Counted in the yard on COUNT_DATE. Raw materials in their stock unit (kg / unit).
const COUNT_RAW = { flyAsh: 12000, lime: 21000, gypsum: 500, quarry: 3 };
const COUNT_BRICKS = { '4-inch': 170, '8-inch': 0, '9-inch': 2600 };

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;
const r6 = (n) => Math.round(n * 1e6) / 1e6;

function findMaterials(list) {
  const by = (re) => list.find((m) => re.test(m.name || ''));
  return {
    flyAsh: by(/fly\s*ash/i),
    lime: by(/lime/i),
    gypsum: by(/gyps/i),
    quarry: by(/quarry|sand/i),
  };
}

let running = null;

/** Safe to call more than once: concurrent calls share one run. */
export function applyDadAnswersFixOnce() {
  running = running || run().then(async (applied) => (await fillUpiIfEmpty()) || applied).finally(() => { running = null; });
  return running;
}

/** Owner's UPI (PhonePe). Only filled in if the app has none, never overwritten. */
async function fillUpiIfEmpty() {
  const row = await db.settings.where('key').equals('upiId').first();
  if (row && String(row.value || '').trim()) return false;
  if (row) await db.settings.update(row.id, { value: '9848174346@ybl' });
  else await db.settings.add({ key: 'upiId', value: '9848174346@ybl' });
  markDataChanged();
  return true;
}

async function run() {
  if (await db.settings.where('key').equals(MARKER).first()) return false;
  const mats = findMaterials(await db.rawMaterials.toArray());
  if (!mats.flyAsh || !mats.lime || !mats.gypsum || !mats.quarry) return false; // not Dad's data

  try {
    const { createLocalBackup } = await import('../../core/backup/localBackups');
    await createLocalBackup('safety');
  } catch (e) {
    console.warn('Safety backup before correction failed:', e);
  }

  const tables = [db.purchaseLog, db.rawMaterials, db.recipes, db.productionLog, db.finishedStock, db.stockAdjustments, db.settings, db.invoiceSettings];
  let applied = false;
  await db.transaction('rw', tables, async () => {
    if (await db.settings.where('key').equals(MARKER).first()) return;
    applied = true;
    const qd = mats.quarry.id;
    const lime = mats.lime.id;

    // 1. Quarry Dust purchases saved ×1000 through the old "Ton" default.
    for (const p of await db.purchaseLog.where('materialId').equals(qd).toArray()) {
      if (p.quantity >= 1000 && p.rate > 0 && p.rate < 50) {
        await db.purchaseLog.update(p.id, {
          quantity: r4(p.quantity / 1000),
          rate: r2(p.totalAmount / (p.quantity / 1000)),
          fixedNote: `Unit corrected (was ${p.quantity} @ ${p.rate})`,
        });
      }
    }

    // 2. 9 Oct: "6 t Lime ₹14,500" was 6 units of Quarry Dust.
    const oct9 = (await db.purchaseLog.where('materialId').equals(lime).toArray()).find(
      (p) => p.date === '2026-10-09' && Math.round(p.totalAmount) === 14500
    );
    if (oct9) {
      await db.purchaseLog.update(oct9.id, {
        materialId: qd,
        quantity: 6,
        rate: r2(14500 / 6),
        fixedNote: `Was saved as Lime ${oct9.quantity} kg; owner confirmed it was Quarry Dust (6 units)`,
      });
    }

    // 3. Average price = total spent ÷ quantity bought, for every material.
    const allPurch = await db.purchaseLog.toArray();
    for (const m of Object.values(mats)) {
      const ps = allPurch.filter((p) => p.materialId === m.id && p.quantity > 0);
      const qty = ps.reduce((s, p) => s + p.quantity, 0);
      const amt = ps.reduce((s, p) => s + (p.totalAmount || 0), 0);
      if (qty > 0) await db.rawMaterials.update(m.id, { avgRate: r4(amt / qty) });
    }
    await db.rawMaterials.update(qd, { unit: 'unit', reorderLevel: 6 });

    // 4. Recipes (per brick) + labour rate.
    for (const r of await db.recipes.toArray()) {
      const x = RECIPE[r.brickSize];
      if (!x) continue;
      await db.recipes.update(r.id, {
        materials: {
          ...(r.materials || {}),
          [mats.flyAsh.id]: x.flyAsh,
          [lime]: x.lime,
          [mats.gypsum.id]: x.gypsum,
          [qd]: r6(1 / x.bricksPerUnit),
        },
        flyAshKg: x.flyAsh,
        limeKg: x.lime,
        gypsumKg: x.gypsum,
        sandKg: r6(1 / x.bricksPerUnit),
        labourPerBrick: x.labour,
      });
    }

    // 5. Past production runs: materials and cost with the right recipe and prices.
    const recipes = Object.fromEntries((await db.recipes.toArray()).map((r) => [r.brickSize, r]));
    const rate = Object.fromEntries((await db.rawMaterials.toArray()).map((m) => [String(m.id), m.avgRate || 0]));
    const bySize = {};
    for (const run of await db.productionLog.toArray()) {
      const rec = recipes[run.brickSize];
      if (!rec || !RECIPE[run.brickSize]) continue;
      const req = {};
      let materialCost = 0;
      for (const [mid, perBrick] of Object.entries(rec.materials || {})) {
        if (!perBrick) continue;
        req[mid] = r2(perBrick * run.quantity);
        materialCost += perBrick * run.quantity * (rate[mid] || 0);
      }
      const labourCost = r2(RECIPE[run.brickSize].labour * run.quantity);
      const totalCost = r2(materialCost + labourCost);
      await db.productionLog.update(run.id, {
        materialsUsed: { ...(run.materialsUsed || {}), materialsRequired: req },
        materialCost: r2(materialCost),
        labourCost,
        totalCost,
        costPerBrick: run.quantity ? r2(totalCost / run.quantity) : 0,
      });
      const b = (bySize[run.brickSize] = bySize[run.brickSize] || { cost: 0, qty: 0 });
      b.cost += totalCost;
      b.qty += run.quantity;
    }

    // 6. Stock = what was counted in the yard (logged as stock corrections).
    const now = new Date().toISOString();
    const reason = 'Stock count by owner (6 Nov) + recipe correction';
    for (const [key, count] of Object.entries(COUNT_RAW)) {
      const m = await db.rawMaterials.get(mats[key].id);
      const before = m.currentStock || 0;
      await db.rawMaterials.update(m.id, { currentStock: count });
      await db.stockAdjustments.add({ date: COUNT_DATE, itemType: 'raw', itemId: m.id, itemName: m.name, before, after: count, delta: r2(count - before), reason, createdAt: now });
    }
    for (const f of await db.finishedStock.toArray()) {
      const x = RECIPE[f.brickSize];
      if (!x) continue;
      const changes = { sellingPrice: x.price };
      const b = bySize[f.brickSize];
      if (b?.qty) changes.costPrice = r2(b.cost / b.qty);
      const count = COUNT_BRICKS[f.brickSize];
      if (count !== undefined && count !== f.currentStock) {
        changes.currentStock = count;
        await db.stockAdjustments.add({ date: COUNT_DATE, itemType: 'finished', itemId: f.id, itemName: f.brickSize, before: f.currentStock, after: count, delta: count - f.currentStock, reason, createdAt: now });
      }
      await db.finishedStock.update(f.id, changes);
    }

    // 7. Bills: name as owner wants, no GST.
    const setSetting = async (table, key, value) => {
      const row = await table.where('key').equals(key).first();
      if (row) await table.update(row.id, { value });
      else await table.add({ key, value });
    };
    const name = await db.settings.where('key').equals('factoryName').first();
    if (name) await db.settings.update(name.id, { value: 'CH SS NAGABHUSHANAM' });
    await setSetting(db.settings, 'gstin', '');
    await setSetting(db.invoiceSettings, 'gstMode', 'none');
    await setSetting(db.invoiceSettings, 'showHsn', '0');

    await db.settings.add({ key: MARKER, value: now });
  });
  if (applied) markDataChanged();
  return applied;
}
