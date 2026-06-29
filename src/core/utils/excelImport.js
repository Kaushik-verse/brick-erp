import ExcelJS from 'exceljs';
import { db } from '../db/schema';
import { recordSale, recordPurchase } from '../db/ledgerEngine';

export async function downloadImportTemplate(type) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(type);
  
  if (type === 'Customers' || type === 'Suppliers') {
    ws.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'OpeningBalance', key: 'balance', width: 15 },
    ];
    ws.addRow(['Example ' + (type === 'Customers' ? 'Customer' : 'Supplier'), '9876543210', '5000']);
  } else if (type === 'Sales') {
    ws.columns = [
      { header: 'Date (YYYY-MM-DD)', key: 'date', width: 20 },
      { header: 'Customer Phone', key: 'phone', width: 15 },
      { header: 'Brick Size', key: 'brickSize', width: 15 },
      { header: 'Quantity', key: 'qty', width: 15 },
      { header: 'Rate', key: 'rate', width: 15 },
      { header: 'Amount Paid', key: 'paid', width: 15 },
      { header: 'Payment Channel (cash/bank/upi)', key: 'channel', width: 30 },
    ];
    ws.addRow(['2023-10-25', '9876543210', '4-inch', '5000', '6.5', '10000', 'cash']);
  } else if (type === 'Purchases') {
    ws.columns = [
      { header: 'Date (YYYY-MM-DD)', key: 'date', width: 20 },
      { header: 'Supplier Phone', key: 'phone', width: 15 },
      { header: 'Material Name', key: 'material', width: 15 },
      { header: 'Quantity (kg/ton)', key: 'qty', width: 15 },
      { header: 'Rate', key: 'rate', width: 15 },
      { header: 'Amount Paid', key: 'paid', width: 15 },
      { header: 'Payment Channel (cash/bank/upi)', key: 'channel', width: 30 },
    ];
    ws.addRow(['2023-10-25', '9876543210', 'Fly Ash', '15000', '0.5', '7500', 'bank']);
  }

  // Header styling
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2947' } };

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function processExcelImport(file, type) {
  const arrayBuffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);
  const ws = wb.worksheets[0]; // always take first sheet

  let count = 0;
  
  if (type === 'Customers' || type === 'Suppliers') {
    const table = type === 'Customers' ? db.customers : db.suppliers;
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const name = row.getCell(1).text?.trim();
      const phone = row.getCell(2).text?.trim();
      const balance = Number(row.getCell(3).value) || 0;

      if (!name) continue; // Skip empty rows

      // Check if exists
      const existing = await table.where('phone').equals(phone).first();
      if (existing) {
         // Update balance if they have one? We usually shouldn't overwrite, but since it's import...
         await table.update(existing.id, { outstandingBalance: balance });
      } else {
         await table.add({
           name,
           phone,
           outstandingBalance: balance,
           createdAt: new Date().toISOString()
         });
      }
      count++;
    }
  } else if (type === 'Sales') {
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      let dateVal = row.getCell(1).value;
      if (dateVal instanceof Date) {
        dateVal = dateVal.toISOString().split('T')[0];
      } else if (typeof dateVal === 'string') {
        dateVal = dateVal.trim();
      } else {
        continue;
      }
      
      const phone = row.getCell(2).text?.trim();
      const brickSize = row.getCell(3).text?.trim();
      const qty = Number(row.getCell(4).value) || 0;
      const rate = Number(row.getCell(5).value) || 0;
      const paid = Number(row.getCell(6).value) || 0;
      const channel = row.getCell(7).text?.trim().toLowerCase() || 'cash';

      if (!phone || !brickSize || qty <= 0) continue;

      const customer = await db.customers.where('phone').equals(phone).first();
      if (!customer) throw new Error(`Customer with phone ${phone} not found. Import Customers first.`);

      await recordSale({
        date: dateVal,
        customerId: customer.id,
        brickSize,
        quantity: qty,
        rate,
        amountPaid: paid,
        paymentChannel: channel,
        allowOverdraw: true // Don't block import if stock is low
      });
      count++;
    }
  } else if (type === 'Purchases') {
    const rawMaterials = await db.rawMaterials.toArray();
    
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      let dateVal = row.getCell(1).value;
      if (dateVal instanceof Date) {
        dateVal = dateVal.toISOString().split('T')[0];
      } else if (typeof dateVal === 'string') {
        dateVal = dateVal.trim();
      } else {
        continue;
      }
      
      const phone = row.getCell(2).text?.trim();
      const materialName = row.getCell(3).text?.trim();
      const qty = Number(row.getCell(4).value) || 0;
      const rate = Number(row.getCell(5).value) || 0;
      const paid = Number(row.getCell(6).value) || 0;
      const channel = row.getCell(7).text?.trim().toLowerCase() || 'cash';

      if (!phone || !materialName || qty <= 0) continue;

      const supplier = await db.suppliers.where('phone').equals(phone).first();
      if (!supplier) throw new Error(`Supplier with phone ${phone} not found. Import Suppliers first.`);

      const material = rawMaterials.find(m => m.name.toLowerCase() === materialName.toLowerCase());
      if (!material) throw new Error(`Raw material '${materialName}' not found in master data.`);

      await recordPurchase({
        date: dateVal,
        supplierId: supplier.id,
        materialId: material.id,
        quantity: qty,
        rate,
        amountPaid: paid,
        paymentChannel: channel
      });
      count++;
    }
  }

  return count;
}
