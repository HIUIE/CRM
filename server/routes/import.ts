import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import AdmZip from 'adm-zip';
import path from 'path';
import { dbBegin, dbCommit, dbGet, dbRun, dbRollback } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readString } from '../lib/values.js';

const upload = multer({ dest: 'uploads/temp/' });

export function createImportRouter() {
  const router = Router();

  // Preview file headers and first 5 rows
  router.post('/preview', requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) return fail(res, 400, '请选择要上传的文件');

    const isZip = req.file.originalname.endsWith('.zip');
    
    if (isZip) {
      try {
        const zip = new AdmZip(req.file.path);
        const entries = zip.getEntries().map(e => e.entryName);
        const isBackup = entries.includes('customers.csv') || entries.includes('orders.csv');
        
        return res.json({ 
          isZip: true, 
          isBackup, 
          entries, 
          filename: req.file.filename, 
          originalName: req.file.originalname 
        });
      } catch (error) {
        return handleRouteError(res, error, '解析压缩包失败');
      }
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const isCsv = req.file.originalname.endsWith('.csv');
      
      if (isCsv) {
        await workbook.csv.readFile(req.file.path);
      } else {
        await workbook.xlsx.readFile(req.file.path);
      }

      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) return fail(res, 400, '文件内容为空');

      const headers: string[] = [];
      const rows: any[][] = [];

      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.text;
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && rowNumber <= 6) {
          const rowData: any[] = [];
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            rowData[colNumber - 1] = cell.value;
          });
          rows.push(rowData);
        }
      });

      res.json({ headers, rows, filename: req.file.filename, originalName: req.file.originalname });
    } catch (error) {
      return handleRouteError(res, error, '解析文件失败');
    }
  });

  // Execute import
  router.post('/execute', requireAuth, async (req: AuthedRequest, res) => {
    const { filename, entityType, mapping, isBackup } = req.body;
    if (!filename) return fail(res, 400, '参数不完整');

    const filePath = `uploads/temp/${filename}`;
    
    if (isBackup) {
      try {
        const result = await importBackup(filePath, req.user?.id);
        return res.json(result);
      } catch (error) {
        return handleRouteError(res, error, '还原备份失败');
      }
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const isCsv = filename.endsWith('.csv') || filename.includes('csv'); // Simple check
      
      try {
        if (isCsv) {
          await workbook.csv.readFile(filePath);
        } else {
          await workbook.xlsx.readFile(filePath);
        }
      } catch (e) {
        // Retry as XLSX if CSV fails or vice-versa
        if (isCsv) await workbook.xlsx.readFile(filePath);
        else await workbook.csv.readFile(filePath);
      }

      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) return fail(res, 400, '无法读取文件内容');

      const headers: string[] = [];
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.text;
      });

      await dbBegin();
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        if (!row.values || (row.values as any[]).length <= 1) continue;

        const data: Record<string, any> = {};
        Object.entries(mapping).forEach(([systemField, fileHeader]) => {
          const colIndex = headers.indexOf(fileHeader as string);
          if (colIndex !== -1) {
            data[systemField] = row.getCell(colIndex + 1).value;
          }
        });

        try {
          if (entityType === 'CUSTOMER') {
            await importCustomer(data, req.user?.id);
          } else if (entityType === 'ORDER') {
            await importOrder(data, req.user?.id);
          }
          successCount++;
        } catch (e: any) {
          errorCount++;
          errors.push(`第 ${i} 行: ${e.message}`);
        }
      }

      await dbCommit();
      res.json({ successCount, errorCount, errors });
    } catch (error) {
      await dbRollback();
      return handleRouteError(res, error, '导入失败');
    }
  });

  return router;
}

async function importBackup(zipPath: string, userId?: number) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  await dbBegin();
  try {
    // 1. Import Customers first (priority for linking)
    const customerEntry = entries.find(e => e.entryName === 'customers.csv');
    if (customerEntry) {
      const content = customerEntry.getData().toString('utf8');
      const rows = parseCsv(content);
      for (const row of rows) {
        try {
          await upsertCustomer(row, userId);
          successCount++;
        } catch (e: any) {
          errorCount++;
          errors.push(`客户导入错误: ${e.message}`);
        }
      }
    }

    // 2. Import Orders
    const orderEntry = entries.find(e => e.entryName === 'orders.csv');
    if (orderEntry) {
      const content = orderEntry.getData().toString('utf8');
      const rows = parseCsv(content);
      for (const row of rows) {
        try {
          await upsertOrder(row, userId);
          successCount++;
        } catch (e: any) {
          errorCount++;
          errors.push(`订单导入错误: ${e.message}`);
        }
      }
    }

    await dbCommit();
    return { successCount, errorCount, errors };
  } catch (error) {
    await dbRollback();
    throw error;
  }
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  
  // Handle UTF-8 BOM
  let headerLine = lines[0];
  if (headerLine.startsWith('\uFEFF')) {
    headerLine = headerLine.slice(1);
  }

  const headers = headerLine.split(',').map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.replace(/^"|"$/g, '').trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i];
    });
    return row;
  });
}

async function upsertCustomer(data: any, userId?: number) {
  const displayId = data.display_id || data.displayId;
  const name = data.name;
  if (!displayId || !name) return;

  const existing = await dbGet(`SELECT id FROM customers WHERE display_id = ?`, [displayId]);
  if (existing) {
    await dbRun(
      `UPDATE customers SET name = ?, country = ?, contact = ?, source_channel = ?, intent_products = ?, updated_by = ? WHERE id = ?`,
      [name, data.country, data.contact, data.source_channel || data.sourceChannel, data.intent_products || data.intentProducts, userId, existing.id]
    );
  } else {
    await dbRun(
      `INSERT INTO customers (display_id, name, country, contact, source_channel, intent_products, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [displayId, name, data.country, data.contact, data.source_channel || data.sourceChannel, data.intent_products || data.intentProducts, userId, userId]
    );
  }
}

async function upsertOrder(data: any, userId?: number) {
  const displayId = data.display_id || data.displayId;
  if (!displayId) return;

  // Find customer by name or id from backup
  const customerName = data.customer_name || data.customerName;
  const customer = await dbGet(`SELECT id FROM customers WHERE name = ? AND deleted_at IS NULL`, [customerName]);
  if (!customer) throw new Error(`找不到订单关联的客户: ${customerName}`);

  const existing = await dbGet(`SELECT id FROM orders WHERE display_id = ?`, [displayId]);
  if (existing) {
    await dbRun(
      `UPDATE orders SET customer_id = ?, status = ?, total_amount = ?, product_summary = ?, details = ?, updated_by = ? WHERE id = ?`,
      [customer.id, data.status, data.total_amount || data.totalAmount, data.product_summary || data.productSummary, data.details, userId, existing.id]
    );
  } else {
    await dbRun(
      `INSERT INTO orders (display_id, customer_id, status, total_amount, product_summary, details, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [displayId, customer.id, data.status, data.total_amount || data.totalAmount, data.product_summary || data.productSummary, data.details, userId, userId]
    );
  }
}

async function importCustomer(data: any, userId?: number) {
  const name = String(data.name || '').trim();
  const country = String(data.country || '').trim();
  if (!name || !country) throw new Error('缺少必填项：名称或国家');

  const displayId = `cust-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8)}`;
  
  await dbRun(
    `INSERT INTO customers (display_id, name, country, contact, source_channel, intent_products, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [displayId, name, country, data.contact, data.sourceChannel, data.intentProducts, userId, userId]
  );
}

async function importOrder(data: any, userId?: number) {
  const customerName = String(data.customerName || '').trim();
  if (!customerName) throw new Error('缺少必填项：客户名称');

  // Find customer
  const customer = await dbGet(`SELECT id FROM customers WHERE name = ? AND deleted_at IS NULL`, [customerName]);
  if (!customer) throw new Error(`未找到匹配的客户: ${customerName}`);

  let displayId = String(data.displayId || '').trim();
  if (!displayId) {
    // Generate simple display ID for import if missing
    displayId = `ORD-IMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  const totalAmount = parseFloat(data.totalAmount) || 0;
  const status = data.status || 'draft';

  await dbRun(
    `INSERT INTO orders (display_id, customer_id, status, total_amount, product_summary, details, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [displayId, customer.id, status, totalAmount, data.productSummary, data.details, userId, userId]
  );
}
