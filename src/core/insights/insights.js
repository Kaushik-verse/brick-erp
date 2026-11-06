import { db } from '../db/schema';
import { toLocalISOString, todayISO } from '../utils/format';
import { defaultLabourPerBrick } from '../db/recipeEngine';

/**
 * insights.js
 * ------------
 * Turns the factory's records into a few simple answers for the owner:
 *   • Is money coming in faster than it goes out?
 *   • What does one brick really cost, and how much do I keep?
 *   • Where does the money go?  Which suppliers are cheaper?
 *   • What should I do next?  (plain-language tips with ₹ amounts)
 *
 * Everything is computed on the phone from existing data — nothing new to
 * enter. Numbers are deliberately rounded; this is guidance, not accounts.
 */

const sum = (rows, fn) => rows.reduce((s, r) => s + (Number(fn(r)) || 0), 0);
const monthKey = (iso) => (iso || '').slice(0, 7);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (key, long = false) => {
  const [y, m] = key.split('-').map(Number);
  const name = long
    ? new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long' })
    : MONTHS[m - 1];
  return long ? `${name} ${y}` : name;
};

function lastMonths(n, ref = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

const roundTo = (n, step) => Math.round(n / step) * step;
/** "about ₹12,000" style rounding for advice text. */
export function approx(n) {
  const v = Math.abs(n);
  const step = v >= 100000 ? 1000 : v >= 10000 ? 500 : v >= 1000 ? 100 : 10;
  return roundTo(n, step);
}

function saleLines(s) {
  if (Array.isArray(s.items) && s.items.length) {
    return s.items.map((it) => ({ size: it.description, qty: Number(it.quantity) || 0, amount: Number(it.amount) || (Number(it.quantity) || 0) * (Number(it.rate) || 0) }));
  }
  return [{ size: s.brickSize, qty: Number(s.quantity) || 0, amount: (Number(s.quantity) || 0) * (Number(s.rate) || 0) }];
}

function isWorkingDay(iso) {
  return new Date(`${iso}T00:00:00`).getDay() !== 0; // Sundays off
}

export async function computeInsights({ months = 4 } = {}) {
  const [sales, purchases, expenses, production, collections, supplierPays, customers, suppliers, materials, stock, recipes] =
    await Promise.all([
      db.salesLog.toArray(),
      db.purchaseLog.toArray(),
      db.expenses.toArray(),
      db.productionLog.toArray(),
      db.customerCollections.toArray(),
      db.supplierPayments.toArray(),
      db.customers.toArray(),
      db.suppliers.toArray(),
      db.rawMaterials.toArray(),
      db.finishedStock.toArray(),
      db.recipes.toArray(),
    ]);

  const today = todayISO();
  const keys = lastMonths(months);
  const byMonth = Object.fromEntries(keys.map((k) => [k, { key: k, label: monthLabel(k), moneyIn: 0, moneyOut: 0, sales: 0, bricksMade: 0, bricksSold: 0, expenses: 0, materialBought: 0 }]));
  const add = (iso, field, v) => {
    const m = byMonth[monthKey(iso)];
    if (m) m[field] += Number(v) || 0;
  };
  for (const s of sales) {
    add(s.date, 'sales', s.totalAmount);
    add(s.date, 'moneyIn', s.amountPaid);
    add(s.date, 'bricksSold', sum(saleLines(s), (l) => l.qty));
  }
  for (const c of collections) add(c.date, 'moneyIn', c.amount);
  for (const p of purchases) {
    add(p.date, 'moneyOut', p.amountPaid);
    add(p.date, 'materialBought', p.totalAmount);
  }
  for (const p of supplierPays) add(p.date, 'moneyOut', p.amount);
  for (const e of expenses) {
    add(e.date, 'moneyOut', e.amount);
    add(e.date, 'expenses', e.amount);
  }
  for (const p of production) add(p.date, 'bricksMade', p.quantity);
  const monthList = keys.map((k) => ({ ...byMonth[k], net: byMonth[k].moneyIn - byMonth[k].moneyOut }));

  // ---- Window for "per brick" maths: last 90 days
  const from90 = toLocalISOString(new Date(Date.now() - 90 * 86400000));
  const prod90 = production.filter((p) => p.date >= from90);
  const bricks90 = sum(prod90, (p) => p.quantity);
  const exp90 = sum(expenses.filter((e) => e.date >= from90), (e) => e.amount);
  const overheadPerBrick = bricks90 > 0 ? exp90 / bricks90 : 0;

  // ---- Cost of one brick, per size, at today's material prices
  const matById = Object.fromEntries(materials.map((m) => [String(m.id), m]));
  const sold90 = {};
  const soldAmt90 = {};
  for (const s of sales.filter((x) => x.date >= from90)) {
    for (const l of saleLines(s)) {
      sold90[l.size] = (sold90[l.size] || 0) + l.qty;
      soldAmt90[l.size] = (soldAmt90[l.size] || 0) + l.amount;
    }
  }
  const made90 = {};
  for (const p of prod90) made90[p.brickSize] = (made90[p.brickSize] || 0) + p.quantity;

  const brickEconomics = stock
    .filter((f) => f.isActive !== 0 && ((sold90[f.brickSize] || 0) > 0 || (made90[f.brickSize] || 0) > 0))
    .map((f) => {
      const recipe = recipes.find((r) => r.brickSize === f.brickSize);
      let materialCost = 0;
      const parts = [];
      for (const [mid, qty] of Object.entries(recipe?.materials || {})) {
        const m = matById[mid];
        if (!m || !qty) continue;
        const c = qty * (m.avgRate || 0);
        materialCost += c;
        parts.push({ name: m.name, cost: c });
      }
      const labourCost =
        recipe?.labourPerBrick !== undefined && recipe?.labourPerBrick !== null && recipe?.labourPerBrick !== ''
          ? Number(recipe.labourPerBrick) || 0
          : defaultLabourPerBrick(f.brickSize);
      const fullCost = materialCost + labourCost + overheadPerBrick;
      const soldQty = sold90[f.brickSize] || 0;
      const avgSoldRate = soldQty ? soldAmt90[f.brickSize] / soldQty : f.sellingPrice || 0;
      const profitPerBrick = avgSoldRate - fullCost;
      return {
        size: f.brickSize,
        sellingPrice: f.sellingPrice || 0,
        avgSoldRate,
        materialCost,
        materialParts: parts.sort((a, b) => b.cost - a.cost),
        labourCost,
        overheadCost: overheadPerBrick,
        fullCost,
        profitPerBrick,
        marginPct: avgSoldRate ? (profitPerBrick / avgSoldRate) * 100 : 0,
        soldPerMonth: soldQty / 3,
        inStock: f.currentStock || 0,
      };
    })
    .sort((a, b) => b.soldPerMonth - a.soldPerMonth);

  // ---- Where money goes (selected = last full month with data, else current)
  const currentKey = monthKey(today);
  const prevKey = keys[keys.length - 2];
  const expenseFor = (key) => {
    const rows = expenses.filter((e) => monthKey(e.date) === key);
    const total = sum(rows, (e) => e.amount);
    const cats = {};
    for (const e of rows) cats[e.category || 'Other'] = (cats[e.category || 'Other'] || 0) + e.amount;
    return {
      total,
      categories: Object.entries(cats)
        .map(([category, amount]) => ({ category, amount, pct: total ? (amount / total) * 100 : 0 }))
        .sort((a, b) => b.amount - a.amount),
    };
  };
  const expenseByMonth = Object.fromEntries(keys.map((k) => [k, expenseFor(k)]));

  // ---- Production rhythm (last 30 days)
  const from30 = toLocalISOString(new Date(Date.now() - 29 * 86400000));
  const dayTotals = {};
  for (const p of production) dayTotals[p.date] = (dayTotals[p.date] || 0) + (p.quantity || 0);
  let workingDays = 0;
  let idleWorkingDays = 0;
  let made30 = 0;
  for (let i = 29; i >= 0; i--) {
    const d = toLocalISOString(new Date(Date.now() - i * 86400000));
    const q = dayTotals[d] || 0;
    made30 += q;
    if (q > 0) workingDays++;
    else if (isWorkingDay(d)) idleWorkingDays++;
  }
  const avgPerWorkingDay = workingDays ? made30 / workingDays : 0;
  const days = Object.entries(dayTotals).sort((a, b) => b[1] - a[1]);
  const productionInfo = {
    from: from30,
    made30,
    workingDays,
    idleWorkingDays,
    avgPerWorkingDay,
    bestDay: days[0] ? { date: days[0][0], qty: days[0][1] } : null,
    dayTotals,
  };

  // ---- Customers
  const custName = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const custTotals = {};
  for (const s of sales.filter((x) => x.date >= from90)) custTotals[s.customerId] = (custTotals[s.customerId] || 0) + (s.totalAmount || 0);
  const totalCust = Object.values(custTotals).reduce((a, b) => a + b, 0);
  const topCustomers = Object.entries(custTotals)
    .map(([id, amount]) => ({ id: Number(id), name: custName[id] || 'Customer', amount, pct: totalCust ? (amount / totalCust) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const dues = customers.filter((c) => (c.outstandingBalance || 0) > 0.5).sort((a, b) => b.outstandingBalance - a.outstandingBalance);
  const payables = suppliers.filter((s) => (s.outstandingBalance || 0) > 0.5).sort((a, b) => b.outstandingBalance - a.outstandingBalance);

  // ---- Supplier price comparison per material (last 6 months)
  const from180 = toLocalISOString(new Date(Date.now() - 180 * 86400000));
  const supName = Object.fromEntries(suppliers.map((s) => [s.id, s.name]));
  const supplierPrices = [];
  for (const m of materials) {
    const rows = purchases.filter((p) => p.materialId === m.id && p.date >= from180 && p.quantity > 0);
    if (!rows.length) continue;
    const isKg = (m.unit || '').toLowerCase() === 'kg';
    const factor = isKg ? 1000 : 1;
    const bySup = {};
    for (const p of rows) {
      const b = (bySup[p.supplierId] = bySup[p.supplierId] || { qty: 0, amount: 0, last: p.date, count: 0 });
      b.qty += p.quantity;
      b.amount += p.totalAmount;
      b.count += 1;
      if (p.date > b.last) b.last = p.date;
    }
    const list = Object.entries(bySup)
      .map(([sid, b]) => ({ supplier: supName[sid] || 'Supplier', rate: (b.amount / b.qty) * factor, qty: b.qty / factor, amount: b.amount, last: b.last, count: b.count }))
      .sort((a, b) => a.rate - b.rate);
    const cheapest = list[0];
    const median = list.length ? list[Math.floor(list.length / 2)].rate : 0;
    // A price far below everyone else from a single purchase is more likely a
    // wrong entry (e.g. another material saved under this one) than a deal.
    const suspicious = list.filter((r) => r.count === 1 && list.length > 1 && r.rate < median * 0.65);
    // Only suggest switching when the cheaper supplier is a regular one.
    const reliable = cheapest && cheapest.count >= 2 && !suspicious.includes(cheapest);
    const saving = reliable ? list.slice(1).reduce((s, r) => s + Math.max(0, r.rate - cheapest.rate) * r.qty, 0) : 0;
    supplierPrices.push({ material: m.name, unit: isKg ? 'Ton' : m.unit, list, cheapest, saving, suspicious });
  }

  // ---- Raw material days left at the recent production pace
  const dailyBricks = made30 / 30;
  const avgRecipe = {};
  for (const r of recipes) for (const [mid, q] of Object.entries(r.materials || {})) avgRecipe[mid] = Math.max(avgRecipe[mid] || 0, Number(q) || 0);
  const stockLevels = materials
    .filter((m) => m.isActive !== 0)
    .map((m) => {
      const perDay = (avgRecipe[String(m.id)] || 0) * dailyBricks;
      const daysLeft = perDay > 0 ? m.currentStock / perDay : null;
      return { ...m, perDay, daysLeft };
    });

  // ---- Credit share last month
  const lastFull = byMonth[prevKey] ? prevKey : currentKey;
  const salesLast = sales.filter((s) => monthKey(s.date) === lastFull);
  const creditShare = salesLast.length ? (sum(salesLast, (s) => s.balanceDue) / Math.max(1, sum(salesLast, (s) => s.totalAmount))) * 100 : 0;

  const tips = buildTips({
    brickEconomics,
    supplierPrices,
    expenseByMonth,
    keys,
    productionInfo,
    stock,
    dues,
    payables,
    stockLevels,
    monthList,
    creditShare,
  });

  return {
    months: monthList,
    brickEconomics,
    overheadPerBrick,
    expenseByMonth,
    production: productionInfo,
    topCustomers,
    dues,
    payables,
    supplierPrices,
    stockLevels,
    tips,
  };
}

// ---------------------------------------------------------------- tips

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const num = (n) => Math.round(n).toLocaleString('en-IN');
const TE_MAT = { 'Fly Ash': 'ఫ్లై యాష్', Lime: 'సున్నం', Gypsum: 'జిప్సం', 'Quarry Dust': 'క్వారీ డస్ట్' };
const teMat = (n) => TE_MAT[n] || n;
const TE_UNIT = { Ton: 'టన్ను', unit: 'లోడ్' };
const teUnit = (u) => TE_UNIT[u] || u;
const teMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  const names = ['జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్', 'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'];
  return `${names[m - 1]} ${y}`;
};

/** Every tip carries English and Telugu text: { en, te }. */
function buildTips(ctx) {
  const tips = [];
  const push = (t) => tips.push(t);

  // Bricks sold at a loss
  const best = ctx.brickEconomics[0];
  for (const b of ctx.brickEconomics) {
    if (b.soldPerMonth < 1 || b.profitPerBrick >= 0) continue;
    const loss = Math.abs(b.profitPerBrick);
    push({
      id: `loss-${b.size}`, icon: 'trending-down', tone: 'bad', priority: 90,
      title: { en: `${b.size} bricks are sold at a loss`, te: `${b.size} ఇటుకలు నష్టానికి అమ్ముతున్నారు` },
      text: {
        en: `Each one costs about ₹${b.fullCost.toFixed(2)} to make but sells for ₹${b.avgSoldRate.toFixed(2)}. You lose about ₹${loss.toFixed(2)} on every brick.`,
        te: `ఒక్కో ఇటుక తయారీకి సుమారు ₹${b.fullCost.toFixed(2)} అవుతోంది, కానీ ₹${b.avgSoldRate.toFixed(2)} కే అమ్ముతున్నారు. ప్రతి ఇటుకపై సుమారు ₹${loss.toFixed(2)} నష్టం.`,
      },
      impact: { en: `${inr(loss * b.soldPerMonth)} lost per month`, te: `నెలకు ${inr(loss * b.soldPerMonth)} నష్టం` },
    });
  }

  // ₹1 price what-if
  if (best && best.soldPerMonth > 0) {
    const extra = approx(best.soldPerMonth);
    push({
      id: 'price-plus-one', icon: 'rupee', tone: 'idea', priority: 60,
      title: { en: `₹1 more on ${best.size} = ${inr(extra)} more each month`, te: `${best.size} పై ₹1 ఎక్కువ = నెలకు ${inr(extra)} అదనం` },
      text: {
        en: `You sell about ${num(best.soldPerMonth)} ${best.size} bricks a month. Even ₹1 more per brick adds up. Check what others in the area charge.`,
        te: `నెలకు సుమారు ${num(best.soldPerMonth)} ${best.size} ఇటుకలు అమ్ముతున్నారు. ఇటుకకు ₹1 పెంచినా పెద్ద మొత్తం అవుతుంది. చుట్టుపక్కల వాళ్లు ఎంతకు అమ్ముతున్నారో చూడండి.`,
      },
      impact: { en: `+${inr(approx(extra * 12))} a year`, te: `సంవత్సరానికి +${inr(approx(extra * 12))}` },
    });
  }

  // Possible wrong entry (price far too low)
  const odd = ctx.supplierPrices.find((s) => s.suspicious?.length);
  if (odd) {
    const r = odd.suspicious[0];
    push({
      id: 'odd-price', icon: 'alert', tone: 'warn', priority: 85,
      title: { en: `Check one ${odd.material} purchase from ${r.supplier}`, te: `${r.supplier} నుండి ఒక ${teMat(odd.material)} కొనుగోలు సరిచూడండి` },
      text: {
        en: `Its price (about ${inr(r.rate)}/${odd.unit}) is much lower than usual. It may have been entered under the wrong material. Open Purchases → ${r.supplier} to check.`,
        te: `దాని ధర (${teUnit(odd.unit)}కు సుమారు ${inr(r.rate)}) మామూలు కంటే చాలా తక్కువ. వేరే సరుకు కింద నమోదు అయి ఉండవచ్చు. కొనుగోళ్లు → ${r.supplier} తెరిచి చూడండి.`,
      },
    });
  }

  // Cheaper regular supplier
  const savingMat = ctx.supplierPrices.filter((s) => s.saving > 2000 && s.list.length > 1).sort((a, b) => b.saving - a.saving)[0];
  if (savingMat) {
    const dear = savingMat.list[savingMat.list.length - 1];
    const c = savingMat.cheapest;
    push({
      id: 'supplier', icon: 'truck', tone: 'idea', priority: 70,
      title: { en: `${savingMat.material}: ${c.supplier} is cheaper`, te: `${teMat(savingMat.material)}: ${c.supplier} తక్కువ ధర` },
      text: {
        en: `${c.supplier} charged about ${inr(c.rate)}/${savingMat.unit}, ${dear.supplier} about ${inr(dear.rate)}/${savingMat.unit}. Prices also change over time — ask both before the next order.`,
        te: `${c.supplier} ${teUnit(savingMat.unit)}కు సుమారు ${inr(c.rate)}, ${dear.supplier} సుమారు ${inr(dear.rate)} తీసుకున్నారు. ధరలు మారుతుంటాయి — తదుపరి ఆర్డర్ ముందు ఇద్దరినీ అడగండి.`,
      },
      impact: { en: `Up to ${inr(approx(savingMat.saving))} difference`, te: `${inr(approx(savingMat.saving))} వరకు తేడా` },
    });
  }

  // Expenses
  const k = ctx.keys;
  const lastKey = k[k.length - 2];
  const curr = ctx.expenseByMonth[lastKey];
  const prev = ctx.expenseByMonth[k[k.length - 3]];
  if (curr && prev && prev.total > 0 && curr.total > prev.total * 1.25 && curr.total - prev.total > 3000) {
    const top = curr.categories[0];
    push({
      id: 'expense-up', icon: 'fuel', tone: 'warn', priority: 65,
      title: { en: `Expenses went up in ${monthLabel(lastKey, true)}`, te: `${teMonth(lastKey)} లో ఖర్చులు పెరిగాయి` },
      text: {
        en: `${inr(curr.total)} compared with ${inr(prev.total)} the month before. Biggest item: ${top?.category} (${inr(top?.amount || 0)}).`,
        te: `ముందు నెల ${inr(prev.total)} తో పోలిస్తే ఈసారి ${inr(curr.total)}. ఎక్కువ ఖర్చు: ${top?.category} (${inr(top?.amount || 0)}).`,
      },
    });
  } else if (curr && curr.categories[0] && curr.total > 0) {
    const top = curr.categories[0];
    push({
      id: 'expense-top', icon: 'fuel', tone: 'info', priority: 30,
      title: { en: `Biggest expense: ${top.category}`, te: `అతి పెద్ద ఖర్చు: ${top.category}` },
      text: {
        en: `${inr(top.amount)} of ${inr(curr.total)} last month (${Math.round(top.pct)}%). Small savings here make the biggest difference.`,
        te: `గత నెల ${inr(curr.total)} లో ${inr(top.amount)} (${Math.round(top.pct)}%). ఇక్కడ కొంచెం ఆదా చేసినా పెద్ద తేడా వస్తుంది.`,
      },
    });
  }

  // Idle production days
  const p = ctx.productionInfo;
  if (p.idleWorkingDays >= 5 && p.avgPerWorkingDay > 0) {
    const perDayProfit = best ? Math.max(0, best.profitPerBrick) * p.avgPerWorkingDay : 0;
    push({
      id: 'idle', icon: 'factory', tone: 'idea', priority: 55,
      title: { en: `No bricks made on ${p.idleWorkingDays} working days`, te: `${p.idleWorkingDays} పని రోజుల్లో ఇటుకలు తయారు కాలేదు` },
      text: {
        en: `In the last 30 days the factory worked ${p.workingDays} days and made about ${num(p.avgPerWorkingDay)} bricks on a working day.${perDayProfit > 0 ? ` One more working day is worth about ${inr(approx(perDayProfit))} profit.` : ''}`,
        te: `గత 30 రోజుల్లో ఫ్యాక్టరీ ${p.workingDays} రోజులు పని చేసి, పని రోజుకు సుమారు ${num(p.avgPerWorkingDay)} ఇటుకలు చేసింది.${perDayProfit > 0 ? ` ఇంకో పని రోజు అంటే సుమారు ${inr(approx(perDayProfit))} లాభం.` : ''}`,
      },
    });
  }

  // Unsold stock
  const unsold = ctx.stock.filter((f) => f.isActive !== 0).reduce((s, f) => s + (f.currentStock || 0), 0);
  const avgSold = ctx.monthList.slice(-3).reduce((s, m) => s + m.bricksSold, 0) / 3;
  if (unsold > 0 && avgSold > 0 && unsold > avgSold * 1.5) {
    const months = Math.round((unsold / avgSold) * 10) / 10;
    push({
      id: 'unsold', icon: 'boxes', tone: 'warn', priority: 50,
      title: { en: `${num(unsold)} bricks waiting in the yard`, te: `${num(unsold)} ఇటుకలు యార్డులో అమ్ముడుపోకుండా ఉన్నాయి` },
      text: {
        en: `That is more than ${months} months of sales. Money is stuck in stock — consider a small discount for bulk orders.`,
        te: `ఇది ${months} నెలల అమ్మకాల కంటే ఎక్కువ. డబ్బు స్టాక్‌లో ఇరుక్కుపోయింది — పెద్ద ఆర్డర్లకు కొంచెం తగ్గింపు ఆలోచించండి.`,
      },
    });
  }

  // Low raw material
  const low = ctx.stockLevels.filter((m) => m.daysLeft !== null && m.daysLeft < 7).sort((a, b) => a.daysLeft - b.daysLeft)[0];
  if (low) {
    const d = Math.max(0, Math.floor(low.daysLeft));
    push({
      id: 'low-material', icon: 'alert', tone: 'warn', priority: 80,
      title: { en: `${low.name} will run out in about ${d} days`, te: `${teMat(low.name)} సుమారు ${d} రోజుల్లో అయిపోతుంది` },
      text: {
        en: 'Order early so production doesn’t stop. Compare prices from two suppliers before ordering.',
        te: 'ఉత్పత్తి ఆగకుండా ముందుగానే ఆర్డర్ చేయండి. ఆర్డర్ ముందు ఇద్దరు సప్లయర్ల ధరలు పోల్చండి.',
      },
    });
  }

  // Customer dues
  const totalDue = ctx.dues.reduce((s, c) => s + c.outstandingBalance, 0);
  if (totalDue > 1000) {
    const top = ctx.dues[0];
    push({
      id: 'dues', icon: 'hand-coins', tone: 'warn', priority: 75,
      title: {
        en: `${inr(totalDue)} to collect from ${ctx.dues.length} customer${ctx.dues.length === 1 ? '' : 's'}`,
        te: `${ctx.dues.length} కస్టమర్ల నుండి ${inr(totalDue)} రావాలి`,
      },
      text: {
        en: `Biggest: ${top.name} (${inr(top.outstandingBalance)}). Send a polite WhatsApp reminder from the Sales tab.`,
        te: `ఎక్కువ: ${top.name} (${inr(top.outstandingBalance)}). అమ్మకాలు ట్యాబ్ నుండి వాట్సాప్ గుర్తు చేయండి.`,
      },
    });
  }
  if (ctx.creditShare > 50) {
    const pct = Math.round(ctx.creditShare);
    push({
      id: 'credit', icon: 'wallet', tone: 'info', priority: 40,
      title: { en: `${pct}% of last month’s sales were on credit`, te: `గత నెల అమ్మకాల్లో ${pct}% అప్పుపై జరిగాయి` },
      text: {
        en: 'Asking for part payment at delivery keeps cash ready for buying fly ash and lime.',
        te: 'డెలివరీ సమయంలో కొంత డబ్బు తీసుకుంటే ఫ్లై యాష్, సున్నం కొనడానికి డబ్బు చేతిలో ఉంటుంది.',
      },
    });
  }

  // Payables
  const totalPay = ctx.payables.reduce((s, c) => s + c.outstandingBalance, 0);
  if (totalPay > 1000) {
    const top = ctx.payables[0];
    push({
      id: 'payables', icon: 'truck', tone: 'info', priority: 35,
      title: { en: `You owe ${inr(totalPay)} to suppliers`, te: `సప్లయర్లకు ${inr(totalPay)} ఇవ్వాలి` },
      text: {
        en: `${top.name}: ${inr(top.outstandingBalance)}. Paying on time keeps good prices from suppliers.`,
        te: `${top.name}: ${inr(top.outstandingBalance)}. సమయానికి చెల్లిస్తే సప్లయర్లు మంచి ధరలు ఇస్తారు.`,
      },
    });
  }

  // Encouragement
  const m = ctx.monthList;
  const a = m[m.length - 2];
  const b = m[m.length - 3];
  if (a && b && b.sales > 0 && a.sales > b.sales * 1.1) {
    const g = Math.round(((a.sales - b.sales) / b.sales) * 100);
    push({
      id: 'good', icon: 'trending-up', tone: 'good', priority: 20,
      title: { en: `Sales grew ${g}% in ${monthLabel(a.key, true)}`, te: `${teMonth(a.key)} లో అమ్మకాలు ${g}% పెరిగాయి` },
      text: {
        en: `${inr(a.sales)} compared with ${inr(b.sales)} the month before. Well done!`,
        te: `ముందు నెల ${inr(b.sales)} తో పోలిస్తే ${inr(a.sales)}. చాలా బాగుంది!`,
      },
    });
  }

  return tips.sort((x, y) => y.priority - x.priority);
}
