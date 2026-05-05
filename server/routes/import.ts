import { Router, type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { Readable } from 'stream';
import multer from 'multer';
import ExcelJS from 'exceljs';
import AdmZip from 'adm-zip';
import { logger } from '../lib/logger.js';
import { dbGet, dbRun, withTransaction, type TransactionExecutor } from '../lib/db.js';
import { requireAdmin, type AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readString } from '../lib/values.js';
import { UPLOADS_DIR } from '../paths.js';
import { isSystemBackupZip, restoreSystemBackupZip } from '../services/backup.js';

type ImportRowData = Record<string, unknown>;
type CsvRowData = Record<string, string>;

const IMPORT_TEMP_DIR = path.join(UPLOADS_DIR, 'temp');
const MAX_IMPORT_FILE_SIZE = 512 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 5000;
const MAX_ZIP_UNCOMPRESSED_SIZE = 2 * 1024 * 1024 * 1024;
const ALLOWED_IMPORT_EXTENSIONS = new Set(['.xlsx', '.csv', '.zip']);
const ALLOWED_IMPORT_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
]);

const upload = multer({
  dest: IMPORT_TEMP_DIR,
  limits: { fileSize: MAX_IMPORT_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const mimeAllowed = ALLOWED_IMPORT_MIME_TYPES.has(file.mimetype);
    if (!ALLOWED_IMPORT_EXTENSIONS.has(extension) || !mimeAllowed) {
      callback(new Error('UNSUPPORTED_IMPORT_FILE'));
      return;
    }
    callback(null, true);
  },
});

function handleImportUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      fail(res, 400, '导入文件不能超过 512MB', 'IMPORT_FILE_TOO_LARGE');
      return;
    }
    fail(res, 400, '仅支持 CSV、XLSX 或 ZIP 备份文件', 'UNSUPPORTED_IMPORT_FILE');
  });
}

function resolveImportTempFile(filename: unknown) {
  const safeName = readString(filename);
  if (!/^[a-zA-Z0-9_-]+$/.test(safeName)) {
    return null;
  }
  const tempDir = path.resolve(IMPORT_TEMP_DIR);
  const filePath = path.resolve(tempDir, safeName);
  if (filePath !== tempDir && filePath.startsWith(`${tempDir}${path.sep}`)) {
    return filePath;
  }
  return null;
}

function validateZipEntries(zip: AdmZip) {
  const entries = zip.getEntries();
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error('ZIP_ENTRIES_LIMIT');
  }
  let totalSize = 0;
  for (const entry of entries) {
    if (entry.entryName.startsWith('/') || entry.entryName.includes('..')) {
      throw new Error('ZIP_ENTRY_PATH_INVALID');
    }
    totalSize += entry.header.size || 0;
    if (totalSize > MAX_ZIP_UNCOMPRESSED_SIZE) {
      throw new Error('ZIP_SIZE_LIMIT');
    }
  }
  return entries;
}

export function createImportRouter() {
  const router = Router();

  // Preview file headers and first 5 rows
  router.post('/preview', requireAdmin, handleImportUpload, async (req, res) => {
    if (!req.file) return fail(res, 400, '请选择要上传的文件');

    const isZip = path.extname(req.file.originalname || '').toLowerCase() === '.zip';
    
    if (isZip) {
      try {
        const zip = new AdmZip(req.file.path);
        const entries = validateZipEntries(zip).map(e => e.entryName);
        const isRestorableBackup = isSystemBackupZip(zip);
        const isBackup = isRestorableBackup || entries.includes('customers.csv') || entries.includes('orders.csv');

        let backupMeta: { format?: string; version?: number; appVersion?: string; createdAt?: string; counts?: Record<string, number>; note?: string } | null = null;
        if (isRestorableBackup) {
          try {
            const metaEntry = zip.getEntry('metadata.json');
            if (metaEntry) {
              backupMeta = JSON.parse(metaEntry.getData().toString('utf8'));
            }
          } catch {
            // metadata parse failure is non-fatal
          }
        }

        return res.json({
          isZip: true,
          isBackup,
          isRestorableBackup,
          entries,
          filename: req.file.filename,
          originalName: req.file.originalname,
          backupMeta,
        });
      } catch (error) {
        try { await fs.unlink(req.file.path); } catch {}
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('Number of disk entries')) {
          return fail(res, 400, '解析备份包失败：该文件可能由旧版本系统生成且体积过大，请尝试在原系统升级后重新导出备份。', 'ZIP_HEADER_OVERFLOW');
        }
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
      if (!worksheet) {
        try { await fs.unlink(req.file.path); } catch {}
        return fail(res, 400, '文件内容为空');
      }

      const headers: string[] = [];
      const rows: unknown[][] = [];

      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.text;
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && rowNumber <= 6) {
          const rowData: unknown[] = [];
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            rowData[colNumber - 1] = cell.value;
          });
          rows.push(rowData);
        }
      });

      res.json({ headers, rows, filename: req.file.filename, originalName: req.file.originalname });
    } catch (error) {
      try { await fs.unlink(req.file.path); } catch {}
      return handleRouteError(res, error, '解析文件失败');
    }
  });

  // Execute import
  router.post('/execute', requireAdmin, async (req: AuthedRequest, res) => {
    const { filename, entityType, mapping, isBackup } = req.body;
    if (!filename) return fail(res, 400, '参数不完整');
    if (!isBackup && !['CUSTOMER', 'ORDER'].includes(readString(entityType))) {
      return fail(res, 400, '导入对象不正确', 'INVALID_IMPORT_ENTITY');
    }

    const filePath = resolveImportTempFile(filename);
    if (!filePath) {
      return fail(res, 400, '导入文件名无效', 'INVALID_IMPORT_FILE');
    }
    
    try {
      if (isBackup) {
        const result = await importBackup(filePath, req.user?.id);
        return res.json(result);
      }

      const workbook = new ExcelJS.Workbook();
      const isCsv = filename.endsWith('.csv') || filename.includes('csv');
      
      try {
        if (isCsv) {
          await workbook.csv.readFile(filePath);
        } else {
          await workbook.xlsx.readFile(filePath);
        }
      } catch (e) {
        if (isCsv) await workbook.xlsx.readFile(filePath);
        else await workbook.csv.readFile(filePath);
      }

      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) return fail(res, 400, '无法读取文件内容');

      const headers: string[] = [];
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.text;
      });

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      await withTransaction(async (tx) => {
        for (let i = 2; i <= worksheet.rowCount; i++) {
          const row = worksheet.getRow(i);
          if (!row.values || (row.values as unknown[]).length <= 1) continue;

          const data: Record<string, unknown> = {};
          Object.entries(mapping).forEach(([systemField, fileHeader]) => {
            const colIndex = headers.indexOf(fileHeader as string);
            if (colIndex !== -1) {
              data[systemField] = row.getCell(colIndex + 1).value;
            }
          });

          try {
            if (entityType === 'CUSTOMER') {
              await importCustomer(tx, data, req.user?.id);
            } else if (entityType === 'ORDER') {
              await importOrder(tx, data, req.user?.id);
            }
            successCount++;
          } catch (e: unknown) {
            errorCount++;
            errors.push(`第 ${i} 行: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      });
      res.json({ successCount, errorCount, errors });
    } catch (error) {
      return handleRouteError(res, error, '导入失败');
    } finally {
      // Cleanup temporary file
      try {
        await fs.unlink(filePath);
      } catch (e) {
        logger.error({ err: e, filePath }, 'Failed to cleanup import file');
      }
    }
  });

  return router;
}

async function importBackup(zipPath: string, userId?: number) {
  const zip = new AdmZip(zipPath);
  const entries = validateZipEntries(zip);
  if (isSystemBackupZip(zip)) {
    return restoreSystemBackupZip(zipPath);
  }
  
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  return await withTransaction(async (tx) => {
    // 1. Import Customers first (priority for linking)
    const customerEntry = entries.find(e => e.entryName === 'customers.csv');
    if (customerEntry) {
      const content = customerEntry.getData().toString('utf8');
      const rows = await parseCsv(content);
      for (const row of rows) {
        try {
          await upsertCustomer(tx, row, userId);
          successCount++;
        } catch (e: unknown) {
          errorCount++;
          errors.push(`客户导入错误: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    // 2. Import Orders
    const orderEntry = entries.find(e => e.entryName === 'orders.csv');
    if (orderEntry) {
      const content = orderEntry.getData().toString('utf8');
      const rows = await parseCsv(content);
      for (const row of rows) {
        try {
          await upsertOrder(tx, row, userId);
          successCount++;
        } catch (e: unknown) {
          errorCount++;
          errors.push(`订单导入错误: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    return { successCount, errorCount, errors };
  });
}

async function parseCsv(content: string): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  const stream = Readable.from(content);
  await workbook.csv.read(stream);
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) return [];

  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = cell.text.trim();
  });

  const result: Record<string, string>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const rowData: Record<string, string> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.text.trim();
        }
      });
      result.push(rowData);
    }
  });
  return result;
}

async function upsertCustomer(tx: TransactionExecutor, data: CsvRowData, userId?: number) {
  const displayId = data.display_id || data.displayId;
  const name = data.name;
  if (!displayId || !name) return;

  const existing = await tx.get<{ id: number }>(`SELECT id FROM customers WHERE display_id = ?`, [displayId]);
  if (existing) {
    await tx.run(
      `UPDATE customers SET name = ?, country = ?, contact = ?, source_channel = ?, intent_products = ?, updated_by = ? WHERE id = ?`,
      [name, data.country, data.contact, data.source_channel || data.sourceChannel, data.intent_products || data.intentProducts, userId, existing.id]
    );
  } else {
    await tx.run(
      `INSERT INTO customers (display_id, name, country, contact, source_channel, intent_products, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [displayId, name, data.country, data.contact, data.source_channel || data.sourceChannel, data.intent_products || data.intentProducts, userId, userId]
    );
  }
}

async function upsertOrder(tx: TransactionExecutor, data: CsvRowData, userId?: number) {
  const displayId = data.display_id || data.displayId;
  if (!displayId) return;

  // Find customer by name or id from backup
  const customerName = data.customer_name || data.customerName;
  const customer = await tx.get<{ id: number }>(`SELECT id FROM customers WHERE name = ? AND deleted_at IS NULL`, [customerName]);
  if (!customer) throw new Error(`找不到订单关联的客户: ${customerName}`);

  const existing = await tx.get<{ id: number }>(`SELECT id FROM orders WHERE display_id = ?`, [displayId]);
  if (existing) {
    await tx.run(
      `UPDATE orders SET customer_id = ?, status = ?, total_amount = ?, product_summary = ?, details = ?, updated_by = ? WHERE id = ?`,
      [customer.id, data.status, data.total_amount || data.totalAmount, data.product_summary || data.productSummary, data.details, userId, existing.id]
    );
  } else {
    await tx.run(
      `INSERT INTO orders (display_id, customer_id, status, total_amount, product_summary, details, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [displayId, customer.id, data.status, data.total_amount || data.totalAmount, data.product_summary || data.productSummary, data.details, userId, userId]
    );
  }
}

async function importCustomer(tx: TransactionExecutor, data: ImportRowData, userId?: number) {
  const name = String(data.name || '').trim();
  const country = String(data.country || '').trim();
  if (!name || !country) throw new Error('缺少必填项：名称或国家');

  // P9: Similarity check during import
  const { calculateSimilarity } = await import('../lib/values.js');
  const existingCustomers = await tx.all<{ name: string }[]>(`SELECT name FROM customers WHERE deleted_at IS NULL`);
  for (const existing of existingCustomers) {
    if (calculateSimilarity(name, existing.name) > 0.9) {
      throw new Error(`发现高度相似的已有客户: "${existing.name}"`);
    }
  }

  const displayId = `cust-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8)}`;
  
  await tx.run(
    `INSERT INTO customers (display_id, name, country, contact, source_channel, intent_products, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [displayId, name, country, data.contact, data.sourceChannel, data.intentProducts, userId, userId]
  );
}

async function importOrder(tx: TransactionExecutor, data: ImportRowData, userId?: number) {
  const customerName = String(data.customerName || '').trim();
  if (!customerName) throw new Error('缺少必填项：客户名称');

  // Find customer
  const customer = await tx.get<{ id: number }>(`SELECT id FROM customers WHERE name = ? AND deleted_at IS NULL`, [customerName]);
  if (!customer) throw new Error(`未找到匹配的客户: ${customerName}`);

  let displayId = String(data.displayId || '').trim();
  if (!displayId) {
    // Generate simple display ID for import if missing
    displayId = `ORD-IMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  const totalAmount = Number(data.totalAmount) || 0;
  const status = data.status || 'draft';

  await tx.run(
    `INSERT INTO orders (display_id, customer_id, status, total_amount, product_summary, details, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [displayId, customer.id, status, totalAmount, data.productSummary, data.details, userId, userId]
  );
}
