import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import type { Response } from 'express';
import { dbAll, dbTableInfo } from '../lib/db.js';
import { resolveAttachmentAbsolutePath } from '../lib/files.js';
import { ZipStreamWriter, createZipBuffer, type ZipSink } from '../lib/zip.js';
import { buildOrderDetail } from './order-detail.js';
import { buildCustomerXlsx, buildOrderXlsx } from './excel-export.js';

type LegacyExportDefinition = {
  table: string;
  fileName: string;
  query: string;
  extraColumns?: string[];
};

type CustomerRow = Record<string, unknown> & {
  id: number;
  name: string;
  country?: string | null;
  contact?: string | null;
  logistics_preference?: string | null;
  payment_terms?: string | null;
  created_at?: string | null;
  order_count?: number;
};

type OrderRow = Record<string, unknown> & {
  id: number;
  customer_id: number;
  display_id: string;
  status?: string | null;
  total_amount?: number | null;
  created_at?: string | null;
};

type AttachmentExportRow = {
  attachmentId: number;
  sourceModule: string;
  sourceRecordId: number | null;
  originalFileName: string;
  storedName: string;
  mimeType: string | null;
  fileSize: number | null;
  filePath: string;
  createdAt: string | null;
  entityType?: string | null;
  entityId?: number | null;
};

const LEGACY_EXPORTS: LegacyExportDefinition[] = [
  {
    table: 'customers',
    fileName: 'customers.csv',
    query: `
      SELECT
        c.*,
        cu.name AS created_by_name,
        uu.name AS updated_by_name,
        COUNT(o.id) AS order_count
      FROM customers c
      LEFT JOIN users cu ON cu.id = c.created_by
      LEFT JOIN users uu ON uu.id = c.updated_by
      LEFT JOIN orders o ON o.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.id ASC
    `,
    extraColumns: ['created_by_name', 'updated_by_name', 'order_count'],
  },
  {
    table: 'partners',
    fileName: 'partners.csv',
    query: `
      SELECT
        p.*,
        cu.name AS created_by_name,
        uu.name AS updated_by_name
      FROM partners p
      LEFT JOIN users cu ON cu.id = p.created_by
      LEFT JOIN users uu ON uu.id = p.updated_by
      ORDER BY p.id ASC
    `,
    extraColumns: ['created_by_name', 'updated_by_name'],
  },
  {
    table: 'orders',
    fileName: 'orders.csv',
    query: `
      SELECT
        o.*,
        c.name AS customer_name,
        c.country AS customer_country,
        cu.name AS created_by_name,
        uu.name AS updated_by_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN users cu ON cu.id = o.created_by
      LEFT JOIN users uu ON uu.id = o.updated_by
      ORDER BY o.id ASC
    `,
    extraColumns: ['customer_name', 'customer_country', 'created_by_name', 'updated_by_name'],
  },
  {
    table: 'order_items',
    fileName: 'order_items.csv',
    query: `
      SELECT
        oi.*,
        o.display_id AS order_display_id,
        c.name AS customer_name
      FROM order_items oi
      LEFT JOIN orders o ON o.id = oi.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      ORDER BY oi.id ASC
    `,
    extraColumns: ['order_display_id', 'customer_name'],
  },
  {
    table: 'finance_records',
    fileName: 'finance_records.csv',
    query: `
      SELECT
        f.*,
        o.display_id AS order_display_id,
        c.name AS customer_name,
        p.name AS partner_name,
        cu.name AS created_by_name,
        uu.name AS updated_by_name
      FROM finance_records f
      LEFT JOIN orders o ON o.id = f.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN partners p ON p.id = f.partner_id
      LEFT JOIN users cu ON cu.id = f.created_by
      LEFT JOIN users uu ON uu.id = f.updated_by
      ORDER BY f.id ASC
    `,
    extraColumns: ['order_display_id', 'customer_name', 'partner_name', 'created_by_name', 'updated_by_name'],
  },
  {
    table: 'logistics_records',
    fileName: 'logistics_records.csv',
    query: `
      SELECT
        l.*,
        o.display_id AS order_display_id,
        c.name AS customer_name,
        cu.name AS created_by_name,
        uu.name AS updated_by_name
      FROM logistics_records l
      LEFT JOIN orders o ON o.id = l.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN users cu ON cu.id = l.created_by
      LEFT JOIN users uu ON uu.id = l.updated_by
      ORDER BY l.id ASC
    `,
    extraColumns: ['order_display_id', 'customer_name', 'created_by_name', 'updated_by_name'],
  },
  {
    table: 'customs_records',
    fileName: 'customs_records.csv',
    query: `
      SELECT
        cr.*,
        o.display_id AS order_display_id,
        c.name AS customer_name,
        cu.name AS created_by_name,
        uu.name AS updated_by_name
      FROM customs_records cr
      LEFT JOIN orders o ON o.id = cr.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN users cu ON cu.id = cr.created_by
      LEFT JOIN users uu ON uu.id = cr.updated_by
      ORDER BY cr.id ASC
    `,
    extraColumns: ['order_display_id', 'customer_name', 'created_by_name', 'updated_by_name'],
  },
  {
    table: 'production_plans',
    fileName: 'production_plans.csv',
    query: `
      SELECT
        pp.*,
        o.display_id AS order_display_id,
        c.name AS customer_name,
        p.name AS partner_name,
        cu.name AS created_by_name,
        uu.name AS updated_by_name
      FROM production_plans pp
      LEFT JOIN orders o ON o.id = pp.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN partners p ON p.id = pp.partner_id
      LEFT JOIN users cu ON cu.id = pp.created_by
      LEFT JOIN users uu ON uu.id = pp.updated_by
      ORDER BY pp.id ASC
    `,
    extraColumns: ['order_display_id', 'customer_name', 'partner_name', 'created_by_name', 'updated_by_name'],
  },
  {
    table: 'production_logs',
    fileName: 'production_logs.csv',
    query: `
      SELECT
        pl.*,
        pp.order_id AS order_id,
        o.display_id AS order_display_id,
        c.name AS customer_name,
        cu.name AS created_by_name
      FROM production_logs pl
      LEFT JOIN production_plans pp ON pp.id = pl.plan_id
      LEFT JOIN orders o ON o.id = pp.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN users cu ON cu.id = pl.created_by
      ORDER BY pl.id ASC
    `,
    extraColumns: ['order_id', 'order_display_id', 'customer_name', 'created_by_name'],
  },
  {
    table: 'attachments',
    fileName: 'attachments.csv',
    query: `
      SELECT
        a.*,
        o.display_id AS order_display_id,
        c.name AS customer_name
      FROM attachments a
      LEFT JOIN finance_records f ON a.entity_type = 'finance' AND a.entity_id = f.id
      LEFT JOIN logistics_records l ON a.entity_type = 'logistics' AND a.entity_id = l.id
      LEFT JOIN customs_records cr ON a.entity_type = 'customs' AND a.entity_id = cr.id
      LEFT JOIN production_logs pl ON a.entity_type = 'production_log' AND a.entity_id = pl.id
      LEFT JOIN production_plans pp ON pl.plan_id = pp.id
      LEFT JOIN packing_records pr ON a.id = pr.attachment_id
      LEFT JOIN orders o ON o.id = COALESCE(f.order_id, l.order_id, cr.order_id, pp.order_id, pr.order_id)
      LEFT JOIN customers c ON c.id = o.customer_id
      ORDER BY a.id ASC
    `,
    extraColumns: ['order_display_id', 'customer_name'],
  },
  {
    table: 'order_items',
    fileName: 'order_items.csv',
    query: `SELECT oi.*, o.display_id AS order_display_id FROM order_items oi LEFT JOIN orders o ON o.id = oi.order_id ORDER BY oi.id ASC`,
    extraColumns: ['order_display_id'],
  },
  {
    table: 'packing_records',
    fileName: 'packing_records.csv',
    query: `SELECT pr.*, o.display_id AS order_display_id FROM packing_records pr LEFT JOIN orders o ON o.id = pr.order_id ORDER BY pr.id ASC`,
    extraColumns: ['order_display_id'],
  },
  {
    table: 'tasks',
    fileName: 'tasks.csv',
    query: `SELECT t.*, u.name AS assignee_name, cu.name AS created_by_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id LEFT JOIN users cu ON cu.id = t.created_by ORDER BY t.id ASC`,
    extraColumns: ['assignee_name', 'created_by_name'],
  },
  {
    table: 'customer_contacts',
    fileName: 'customer_contacts.csv',
    query: `SELECT cc.*, c.name AS customer_name FROM customer_contacts cc LEFT JOIN customers c ON c.id = cc.customer_id ORDER BY cc.id ASC`,
    extraColumns: ['customer_name'],
  },
  {
    table: 'customer_followups',
    fileName: 'customer_followups.csv',
    query: `SELECT cf.*, c.name AS customer_name, u.name AS created_by_name FROM customer_followups cf LEFT JOIN customers c ON c.id = cf.customer_id LEFT JOIN users u ON u.id = cf.created_by ORDER BY cf.id ASC`,
    extraColumns: ['customer_name', 'created_by_name'],
  },
  {
    table: 'order_follow_ups',
    fileName: 'order_followups.csv',
    query: `SELECT ofu.*, o.display_id AS order_display_id, u.name AS created_by_name FROM order_follow_ups ofu LEFT JOIN orders o ON o.id = ofu.order_id LEFT JOIN users u ON u.id = ofu.created_by ORDER BY ofu.id ASC`,
    extraColumns: ['order_display_id', 'created_by_name'],
  },
];

const ATTACHMENT_MANIFEST_HEADERS = ['attachmentId', 'sourceModule', 'sourceRecordId', 'originalFileName', 'exportedFileName', 'mimeType', 'fileSize', 'createdAt', 'missing'];
const UNLINKED_HEADERS = ['attachmentId', 'entityType', 'entityId', 'originalFileName', 'storedName', 'mimeType', 'fileSize', 'createdAt', 'missing'];

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvBufferFromRows(headers: string[], rows: Record<string, unknown>[]) {
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ];
  return Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

function sanitizeArchiveSegment(value: unknown, fallback: string) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '');

  return cleaned || fallback;
}

function sanitizeArchiveFileName(value: unknown, fallback: string) {
  return sanitizeArchiveSegment(value, fallback);
}

function uniqueFileName(preferredName: string, usedNames: Set<string>) {
  if (!usedNames.has(preferredName)) {
    usedNames.add(preferredName);
    return preferredName;
  }

  const dotIndex = preferredName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? preferredName.slice(0, dotIndex) : preferredName;
  const extension = dotIndex > 0 ? preferredName.slice(dotIndex) : '';

  let counter = 2;
  while (true) {
    const candidate = `${baseName} (${counter})${extension}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    counter += 1;
  }
}

interface ExportOrderDetail {
  order?: Record<string, unknown>;
  customer?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  customs?: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
  financeRecords?: Array<Record<string, unknown>>;
  logisticsRecords?: Array<Record<string, unknown>>;
  productionPlan?: Record<string, unknown> & { logs?: Array<Record<string, unknown>> };
  packingRecords?: Array<Record<string, unknown>>;
  orderDocuments?: Array<Record<string, unknown>>;
}

async function resolveExistingAttachmentPath(filePath: string) {
  const absolutePath = resolveAttachmentAbsolutePath(filePath);
  if (!absolutePath) {
    return null;
  }

  try {
    await fs.access(absolutePath);
    return absolutePath;
  } catch {
    return null;
  }
}

async function getTableColumns(table: string) {
  const rows = await dbTableInfo(table);
  return rows.map((row) => row.name);
}

async function buildLegacyCsvBuffer(definition: LegacyExportDefinition) {
  const [columns, rows] = await Promise.all([
    getTableColumns(definition.table),
    dbAll<Record<string, unknown>[]>(definition.query),
  ]);
  const headers = [...columns, ...(definition.extraColumns || [])];
  return buildCsvBufferFromRows(headers, rows);
}

export async function buildLegacyExportZip() {
  const entries = await Promise.all(
    LEGACY_EXPORTS.map(async (definition) => ({
      name: definition.fileName,
      data: await buildLegacyCsvBuffer(definition),
    })),
  );

  return createZipBuffer(entries);
}

async function getCustomersForArchive() {
  return dbAll<CustomerRow[]>(`
    SELECT
      c.*,
      COUNT(o.id) AS order_count
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id
    ORDER BY c.id ASC
  `);
}

async function getOrdersForCustomer(customerId: number) {
  return dbAll<OrderRow[]>(
    `
      SELECT *
      FROM orders
      WHERE customer_id = ?
      ORDER BY datetime(created_at) ASC, id ASC
    `,
    [customerId],
  );
}

async function getOrdersForCustomers(customerIds: number[]) {
  if (!customerIds.length) return [];
  const placeholders = customerIds.map(() => '?').join(', ');
  return dbAll<OrderRow[]>(
    `SELECT * FROM orders WHERE customer_id IN (${placeholders}) ORDER BY customer_id ASC, datetime(created_at) ASC, id ASC`,
    customerIds,
  );
}

async function getOrderAttachments(orderId: number) {
  const [finance, logistics, customs, production, packing, orderDocuments, productionPhotos] = await Promise.all([
    dbAll<Record<string, unknown>[]>(`
      SELECT
        a.id AS attachmentId,
        'finance' AS sourceModule,
        f.id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM attachments a
      INNER JOIN finance_records f ON a.entity_type = 'finance' AND a.entity_id = f.id
      WHERE f.order_id = ?
      ORDER BY a.id ASC
    `, [orderId]),
    dbAll<Record<string, unknown>[]>(`
      SELECT
        a.id AS attachmentId,
        'logistics' AS sourceModule,
        l.id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM attachments a
      INNER JOIN logistics_records l ON a.entity_type = 'logistics' AND a.entity_id = l.id
      WHERE l.order_id = ?
      ORDER BY a.id ASC
    `, [orderId]),
    dbAll<Record<string, unknown>[]>(`
      SELECT
        a.id AS attachmentId,
        'customs' AS sourceModule,
        c.id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM attachments a
      INNER JOIN customs_records c ON a.entity_type = 'customs' AND a.entity_id = c.id
      WHERE c.order_id = ?
      ORDER BY a.id ASC
    `, [orderId]),
    dbAll<Record<string, unknown>[]>(`
      SELECT
        a.id AS attachmentId,
        'production' AS sourceModule,
        pl.id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM attachments a
      INNER JOIN production_logs pl ON a.entity_type = 'production_log' AND a.entity_id = pl.id
      INNER JOIN production_plans pp ON pp.id = pl.plan_id
      WHERE pp.order_id = ?
      ORDER BY a.id ASC
    `, [orderId]),
    dbAll<Record<string, unknown>[]>(`
      SELECT
        a.id AS attachmentId,
        'packing' AS sourceModule,
        pr.id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM packing_records pr
      INNER JOIN attachments a ON a.id = pr.attachment_id
      WHERE pr.order_id = ?
      ORDER BY a.id ASC
    `, [orderId]),
    dbAll<Record<string, unknown>[]>(`
      SELECT
        a.id AS attachmentId,
        'order_document' AS sourceModule,
        a.entity_id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM attachments a
      WHERE a.entity_type = 'order_document' AND a.entity_id = ?
      ORDER BY a.id ASC
    `, [orderId]),
    dbAll<Record<string, unknown>[]>(`
      SELECT
        a.id AS attachmentId,
        'production_photo' AS sourceModule,
        a.entity_id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM attachments a
      WHERE a.entity_type = 'production_photo' AND a.entity_id = ?
      ORDER BY a.id ASC
    `, [orderId]),
  ]);

  return [...finance, ...logistics, ...customs, ...production, ...packing, ...orderDocuments, ...productionPhotos] as AttachmentExportRow[];
}

async function getUnlinkedAttachments() {
  return dbAll<AttachmentExportRow[]>(`
    SELECT DISTINCT
      a.id AS attachmentId,
      COALESCE(a.entity_type, 'unlinked') AS sourceModule,
      a.entity_id AS sourceRecordId,
      a.file_name AS originalFileName,
      a.stored_name AS storedName,
      a.mime_type AS mimeType,
      a.file_size AS fileSize,
      a.file_path AS filePath,
      a.created_at AS createdAt,
      a.entity_type AS entityType,
      a.entity_id AS entityId
    FROM attachments a
    LEFT JOIN finance_records f ON a.entity_type = 'finance' AND a.entity_id = f.id
    LEFT JOIN logistics_records l ON a.entity_type = 'logistics' AND a.entity_id = l.id
    LEFT JOIN customs_records c ON a.entity_type = 'customs' AND a.entity_id = c.id
    LEFT JOIN production_logs pl ON a.entity_type = 'production_log' AND a.entity_id = pl.id
    LEFT JOIN production_plans pp ON pp.id = pl.plan_id
    LEFT JOIN packing_records pr ON pr.attachment_id = a.id
    WHERE COALESCE(f.order_id, l.order_id, c.order_id, pp.order_id, pr.order_id) IS NULL
    ORDER BY a.id ASC
  `);
}

async function buildOrderDetails(orderIds: number[]): Promise<Map<number, any>> {
  if (!orderIds.length) return new Map();

  const ph = orderIds.map(() => '?').join(', ');

  // Phase 1: Fetch all batch data that depends on order IDs
  const [orderRows, itemRows, financeRows, logisticsRows, packingRows, customsRows, planRows, summaryRows, pendingCountRows] =
    await Promise.all([
      dbAll<Record<string, unknown>[]>(
        `SELECT o.*, c.name AS customer_name, c.display_id AS customer_display_id, c.country AS customer_country, c.contact AS customer_contact, c.logistics_preference AS customer_logistics_preference, c.payment_terms AS customer_payment_terms, cu.name AS created_by_name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id LEFT JOIN users cu ON cu.id = o.created_by WHERE o.id IN (${ph})`,
        orderIds,
      ),
      dbAll<Record<string, unknown>[]>(
        `SELECT * FROM order_items WHERE order_id IN (${ph}) ORDER BY order_id ASC, id ASC`,
        orderIds,
      ),
      dbAll<Record<string, unknown>[]>(
        `SELECT f.*, p.name AS partner_name, p.partner_type AS partner_type, u.name AS created_by_name FROM finance_records f LEFT JOIN partners p ON p.id = f.partner_id LEFT JOIN users u ON u.id = f.created_by WHERE f.order_id IN (${ph}) ORDER BY f.order_id ASC, datetime(f.created_at) DESC, f.id DESC`,
        orderIds,
      ),
      dbAll<Record<string, unknown>[]>(
        `SELECT l.*, u.name AS created_by_name FROM logistics_records l LEFT JOIN users u ON u.id = l.created_by WHERE l.order_id IN (${ph}) ORDER BY l.order_id ASC, CASE WHEN segment_type = 'domestic' THEN 0 ELSE 1 END ASC, CASE WHEN shipping_date IS NULL OR shipping_date = '' THEN 1 ELSE 0 END ASC, l.shipping_date DESC, datetime(l.created_at) DESC, l.id DESC`,
        orderIds,
      ),
      dbAll<Record<string, unknown>[]>(
        `SELECT pr.*, a.stored_name, a.file_path FROM packing_records pr LEFT JOIN attachments a ON a.id = pr.attachment_id WHERE pr.order_id IN (${ph}) ORDER BY pr.order_id ASC, pr.id ASC`,
        orderIds,
      ),
      dbAll<Record<string, unknown>[]>(
        `SELECT c.*, u.name AS created_by_name FROM customs_records c LEFT JOIN users u ON u.id = c.created_by WHERE c.order_id IN (${ph})`,
        orderIds,
      ),
      dbAll<Record<string, unknown>[]>(
        `SELECT pp.*, p.name AS partner_name, p.partner_type AS partner_type, p.country AS partner_country, p.contact AS partner_contact, u.name AS created_by_name FROM production_plans pp LEFT JOIN partners p ON p.id = pp.partner_id LEFT JOIN users u ON u.id = pp.created_by WHERE pp.order_id IN (${ph})`,
        orderIds,
      ),
      dbAll<Record<string, unknown>[]>(
        `SELECT order_id, type, currency, payment_category, COALESCE(SUM(amount), 0) AS total FROM finance_records WHERE order_id IN (${ph}) AND status = 'completed' GROUP BY order_id, type, currency, payment_category`,
        orderIds,
      ),
      dbAll<Record<string, unknown>[]>(
        `SELECT order_id, COUNT(*) AS count FROM finance_records WHERE order_id IN (${ph}) AND status = 'pending' GROUP BY order_id`,
        orderIds,
      ),
    ]);

  if (!orderRows.length) return new Map();

  // Phase 2: Production logs (depends on plan IDs from Phase 1)
  const planIds = planRows.map((r) => Number(r.id)).filter((id) => id > 0);
  let logRows: Record<string, unknown>[] = [];
  if (planIds.length) {
    const planPh = planIds.map(() => '?').join(', ');
    logRows = await dbAll<Record<string, unknown>[]>(
      `SELECT pl.*, u.name AS created_by_name FROM production_logs pl LEFT JOIN users u ON u.id = pl.created_by WHERE pl.plan_id IN (${planPh}) ORDER BY pl.plan_id ASC, datetime(pl.created_at) DESC`,
      planIds,
    );
  }

  // Phase 3: Group data by order_id
  const itemsByOrder = new Map<number, Record<string, unknown>[]>();
  for (const row of itemRows) {
    const oid = Number(row.order_id);
    if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, []);
    itemsByOrder.get(oid)!.push(row);
  }

  const financeByOrder = new Map<number, Record<string, unknown>[]>();
  for (const row of financeRows) {
    const oid = Number(row.order_id);
    if (!financeByOrder.has(oid)) financeByOrder.set(oid, []);
    financeByOrder.get(oid)!.push(row);
  }

  const logisticsByOrder = new Map<number, Record<string, unknown>[]>();
  for (const row of logisticsRows) {
    const oid = Number(row.order_id);
    if (!logisticsByOrder.has(oid)) logisticsByOrder.set(oid, []);
    logisticsByOrder.get(oid)!.push(row);
  }

  const packingByOrder = new Map<number, Record<string, unknown>[]>();
  for (const row of packingRows) {
    const oid = Number(row.order_id);
    if (!packingByOrder.has(oid)) packingByOrder.set(oid, []);
    packingByOrder.get(oid)!.push(row);
  }

  const customsByOrder = new Map<number, Record<string, unknown>>();
  for (const row of customsRows) {
    customsByOrder.set(Number(row.order_id), row);
  }

  const planByOrder = new Map<number, Record<string, unknown>>();
  for (const row of planRows) {
    planByOrder.set(Number(row.order_id), row);
  }

  const logsByPlanId = new Map<number, Record<string, unknown>[]>();
  for (const row of logRows) {
    const pid = Number(row.plan_id);
    if (!logsByPlanId.has(pid)) logsByPlanId.set(pid, []);
    logsByPlanId.get(pid)!.push(row);
  }

  const summaryByOrder = new Map<number, Record<string, unknown>[]>();
  for (const row of summaryRows) {
    const oid = Number(row.order_id);
    if (!summaryByOrder.has(oid)) summaryByOrder.set(oid, []);
    summaryByOrder.get(oid)!.push(row);
  }

  const pendingCountByOrder = new Map<number, number>();
  for (const row of pendingCountRows) {
    pendingCountByOrder.set(Number(row.order_id), Number(row.count));
  }

  // Phase 4: Batch attachment queries
  const allFinanceIds: number[] = [];
  financeByOrder.forEach((records) => {
    for (const r of records) allFinanceIds.push(Number(r.id));
  });
  const allLogisticsIds: number[] = [];
  logisticsByOrder.forEach((records) => {
    for (const r of records) allLogisticsIds.push(Number(r.id));
  });
  const allCustomsIds: number[] = [];
  customsByOrder.forEach((r) => allCustomsIds.push(Number(r.id)));
  const allLogIds = logRows.map((r) => Number(r.id));

  async function getAttachmentCountMap(entityType: string, entityIds: number[]): Promise<Map<number, number>> {
    if (!entityIds.length) return new Map();
    const eph = entityIds.map(() => '?').join(', ');
    const rows = await dbAll<Record<string, unknown>[]>(
      `SELECT entity_id, COUNT(*) AS count FROM attachments WHERE entity_type = ? AND entity_id IN (${eph}) GROUP BY entity_id`,
      [entityType, ...entityIds],
    );
    const m = new Map<number, number>();
    for (const row of rows) {
      m.set(Number(row.entity_id), Number(row.count));
    }
    return m;
  }

  const [financeAttachmentCounts, logisticsAttachmentCounts, customsAttachmentCounts] = await Promise.all([
    getAttachmentCountMap('finance', allFinanceIds),
    getAttachmentCountMap('logistics', allLogisticsIds),
    getAttachmentCountMap('customs', allCustomsIds),
  ]);

  // Phase 5: Assemble detail objects
  function normalizeStatus(s: string) {
    if (s === 'confirmed') return 'production';
    if (s === 'shipped') return 'shipping';
    return s;
  }

  const result = new Map<number, any>();

  for (const order of orderRows) {
    const orderId = Number(order.id);
    const orderItems = itemsByOrder.get(orderId) || [];
    const orderFinanceRecords = financeByOrder.get(orderId) || [];
    const orderLogisticsRecords = logisticsByOrder.get(orderId) || [];
    const orderPackingRecords = packingByOrder.get(orderId) || [];
    const customsRow = customsByOrder.get(orderId) || null;
    const planRow = planByOrder.get(orderId) || null;
    const orderSummaryData = summaryByOrder.get(orderId) || [];
    const pendingCount = pendingCountByOrder.get(orderId) || 0;

    // Compute financial summary
    const receiptsByCurrency: Record<string, number> = {};
    const paymentsByCurrency: Record<string, number> = {};
    const freightByCurrency: Record<string, number> = {};

    for (const row of orderSummaryData) {
      const cur = String(row.currency || 'USD');
      if (row.type === 'receipt') {
        receiptsByCurrency[cur] = (receiptsByCurrency[cur] || 0) + Number(row.total);
      } else {
        paymentsByCurrency[cur] = (paymentsByCurrency[cur] || 0) + Number(row.total);
        if (String(row.payment_category) === 'freight') {
          freightByCurrency[cur] = (freightByCurrency[cur] || 0) + Number(row.total);
        }
      }
    }

    const orderAmount = Number(order.total_amount) || 0;
    const receiptTotal = receiptsByCurrency.USD || 0;

    let paymentStatus: string;
    if (receiptTotal <= 0) {
      paymentStatus = 'unpaid';
    } else if (receiptTotal >= orderAmount && orderAmount > 0) {
      paymentStatus = 'paid';
    } else {
      paymentStatus = 'partial';
    }

    const outstandingAmount = Math.max(orderAmount - receiptTotal, 0);
    const settled = outstandingAmount <= 0 && orderAmount > 0;

    // Compute latest logistics
    const getTimelineValue = (rec: Record<string, unknown>) => {
      const rawValue = String(rec.shipping_date || rec.created_at || '');
      return rawValue ? new Date(rawValue).getTime() : 0;
    };
    const sortedLogistics = [...orderLogisticsRecords].sort((left, right) => getTimelineValue(right) - getTimelineValue(left));
    const domesticLogisticsRecord = orderLogisticsRecords.find((item) => item.segment_type === 'domestic') || null;
    const internationalLogisticsRecord = orderLogisticsRecords.find((item) => item.segment_type !== 'domestic') || null;
    const latestLogistics = sortedLogistics[0] || internationalLogisticsRecord || domesticLogisticsRecord || null;

    // Compute production logs for this order's plan
    let productionLogs: Record<string, unknown>[] = [];
    if (planRow) {
      productionLogs = logsByPlanId.get(Number(planRow.id)) || [];
    }

    // Finance attachment total
    let financeAttachmentTotal = 0;
    for (const rec of orderFinanceRecords) {
      financeAttachmentTotal += financeAttachmentCounts.get(Number(rec.id)) || 0;
    }

    // Logistics attachment total
    let logisticsAttachmentTotal = 0;
    for (const rec of orderLogisticsRecords) {
      logisticsAttachmentTotal += logisticsAttachmentCounts.get(Number(rec.id)) || 0;
    }

    const customsAttachmentCount = customsRow ? customsAttachmentCounts.get(Number(customsRow.id)) || 0 : 0;

    result.set(orderId, {
      order: {
        ...order,
        status: normalizeStatus(String(order.status || 'draft')),
        deliveryDate: order.delivery_date || null,
        freightAmount: Number(order.freight_amount) || 0,
        miscAmount: Number(order.misc_amount) || 0,
        createdByName: order.created_by_name || null,
      },
      customer: {
        id: order.customer_id,
        display_id: order.customer_display_id,
        name: order.customer_name,
        country: order.customer_country,
        contact: order.customer_contact,
        logisticsPreference: order.customer_logistics_preference,
        paymentTerms: order.customer_payment_terms,
      },
      items: orderItems.map((item) => ({
        ...item,
        hsCode: item.hs_code || null,
        imageUrl: item.image_url || null,
      })),
      financeRecords: orderFinanceRecords.map((record) => ({
        ...record,
        recordCategory: record.record_category || record.payment_category || (record.type === 'receipt' ? 'deposit' : 'other'),
        partnerId: record.partner_id || null,
        partnerName: record.partner_name || null,
        createdAt: record.created_at,
        createdByName: record.created_by_name || null,
        attachmentCount: financeAttachmentCounts.get(Number(record.id)) || 0,
      })),
      logisticsRecords: orderLogisticsRecords.map((record) => ({
        ...record,
        segmentType: record.segment_type || 'international',
        freightForwarder: record.freight_forwarder || null,
        trackingNo: record.tracking_no,
        packingDetails: record.packing_details,
        shippingDate: record.shipping_date,
        packageCount: record.package_count,
        volumeCbm: record.volume_cbm,
        grossWeightKg: record.gross_weight_kg,
        transportMode: record.transport_mode,
        vesselVoyage: record.vessel_voyage,
        billNo: record.bill_no,
        etd: record.etd,
        eta: record.eta,
        recipientAddress: record.recipient_address,
        packageSize: record.package_size,
        remark: record.remark,
        createdAt: record.created_at,
        createdByName: record.created_by_name || null,
        attachmentCount: logisticsAttachmentCounts.get(Number(record.id)) || 0,
      })),
      packingRecords: orderPackingRecords.map((record) => {
        const storedNameVal = String(record.stored_name || '').trim();
        const displayName = storedNameVal || String(record.file_path || '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
        return {
          id: record.id,
          packageCount: String(record.package_count || ''),
          packageSize: String(record.package_size || ''),
          grossWeight: String(record.gross_weight || ''),
          netWeight: String(record.net_weight || ''),
          attachmentId: record.attachment_id,
          imageUrl: record.attachment_id && displayName
            ? `/api/files/${Number(record.attachment_id)}/${encodeURIComponent(displayName)}`
            : null,
        };
      }),
      customs: customsRow
        ? {
            ...customsRow,
            brokerName: customsRow.broker_name,
            declarationNo: customsRow.declaration_no,
            declarationDate: customsRow.declaration_date,
            releaseDate: customsRow.release_date,
            tradeMode: customsRow.trade_mode,
            createdAt: customsRow.created_at,
            updatedAt: customsRow.updated_at,
            createdByName: customsRow.created_by_name || null,
            attachmentCount: customsAttachmentCount,
          }
        : null,
      productionPlan: planRow
        ? {
            ...planRow,
            partnerId: planRow.partner_id,
            partnerName: planRow.partner_name,
            partnerType: planRow.partner_type,
            partnerCountry: planRow.partner_country,
            partnerContact: planRow.partner_contact,
            orderDate: planRow.order_date,
            estimatedDeliveryDate: planRow.estimated_delivery_date,
            productionStatus: planRow.production_status,
            inspectionStatus: planRow.inspection_status,
            updatedAt: planRow.updated_at,
            createdByName: planRow.created_by_name || null,
            logs: productionLogs.map((l) => ({
              ...l,
              logDate: l.log_date,
              createdByName: l.created_by_name,
            })),
          }
        : null,
      summary: {
        receiptsByCurrency,
        paymentsByCurrency,
        freightByCurrency,
        pendingFinanceCount: pendingCount || 0,
        latestLogisticsStatus: latestLogistics?.status || null,
        latestShippingDate: latestLogistics?.shipping_date || null,
        paidAmount: receiptsByCurrency.USD || 0,
        outstandingAmount,
        paymentStatus,
        settled,
        attachmentsSummary: {
          finance: financeAttachmentTotal,
          logistics: logisticsAttachmentTotal,
          customs: customsAttachmentCount,
        },
      },
    });
  }

  return result;
}

async function buildCustomerArchive(writer: ZipStreamWriter) {
  const customers = await getCustomersForArchive();
  const customerIds = customers.map(c => Number(c.id));
  const allOrders = await getOrdersForCustomers(customerIds);

  const ordersByCustomer = new Map<number, OrderRow[]>();
  for (const order of allOrders) {
    const cid = Number(order.customer_id);
    if (!ordersByCustomer.has(cid)) ordersByCustomer.set(cid, []);
    ordersByCustomer.get(cid)!.push(order);
  }

  const allOrderIds = allOrders.map(o => Number(o.id));
  const orderDetailsMap = await buildOrderDetails(allOrderIds);

  for (const customer of customers) {
    const orders = ordersByCustomer.get(Number(customer.id)) || [];
    const customerDirName = `customers/${sanitizeArchiveSegment(customer.name, 'customer')}_${customer.id}`;
    // Customer XLSX (customer overview + contacts + followups + order list)
    const customerXlsx = await buildCustomerXlsx(customer, orders, orderDetailsMap);
    await writer.addBuffer(`${customerDirName}/客户信息.xlsx`, await customerXlsx.xlsx.writeBuffer() as unknown as Buffer);

    for (const order of orders) {
      const detail = orderDetailsMap.get(Number(order.id));
      if (!detail) {
        continue;
      }
      const exportDetail = detail as ExportOrderDetail;

      const orderDirName = `${customerDirName}/orders/${sanitizeArchiveSegment(order.display_id, 'order')}_${order.id}`;

      // Single XLSX per order with all details
      const orderXlsx = await buildOrderXlsx(exportDetail);
      await writer.addBuffer(`${orderDirName}/订单详情.xlsx`, await orderXlsx.xlsx.writeBuffer() as unknown as Buffer);

      const attachmentRows = await getOrderAttachments(Number(order.id));
      const manifestRows: Record<string, unknown>[] = [];
      const folderNameUsage = new Map<string, Set<string>>();

      for (const attachment of attachmentRows) {
        const attachmentDir = `${orderDirName}/attachments/${attachment.sourceModule}`;
        if (!folderNameUsage.has(attachmentDir)) {
          folderNameUsage.set(attachmentDir, new Set<string>());
        }
        const preferredName = sanitizeArchiveFileName(attachment.originalFileName || attachment.storedName, `attachment_${attachment.attachmentId}`);
        const exportedFileName = uniqueFileName(preferredName, folderNameUsage.get(attachmentDir)!);
        const absolutePath = await resolveExistingAttachmentPath(attachment.filePath);
        const missing = !absolutePath;

        manifestRows.push({
          attachmentId: attachment.attachmentId,
          sourceModule: attachment.sourceModule,
          sourceRecordId: attachment.sourceRecordId || '',
          originalFileName: attachment.originalFileName,
          exportedFileName,
          mimeType: attachment.mimeType || '',
          fileSize: attachment.fileSize || '',
          createdAt: attachment.createdAt || '',
          missing: missing ? 'true' : 'false',
        });

        if (!missing) {
          await writer.addFile(`${attachmentDir}/${exportedFileName}`, absolutePath);
        }
      }

      await writer.addBuffer(
        `${orderDirName}/attachments_manifest.csv`,
        buildCsvBufferFromRows(ATTACHMENT_MANIFEST_HEADERS, manifestRows),
      );
    }
  }

  const unlinkedAttachments = await getUnlinkedAttachments();
  const unlinkedDir = '_unlinked_attachments';
  const usedFileNames = new Set<string>();
  const unlinkedRows: Record<string, unknown>[] = [];

  for (const attachment of unlinkedAttachments) {
    const preferredName = sanitizeArchiveFileName(attachment.originalFileName || attachment.storedName, `attachment_${attachment.attachmentId}`);
    const exportedFileName = uniqueFileName(preferredName, usedFileNames);
    const absolutePath = await resolveExistingAttachmentPath(attachment.filePath);
    const missing = !absolutePath;

    unlinkedRows.push({
      attachmentId: attachment.attachmentId,
      entityType: attachment.entityType || attachment.sourceModule || '',
      entityId: attachment.entityId || attachment.sourceRecordId || '',
      originalFileName: attachment.originalFileName,
      storedName: attachment.storedName,
      mimeType: attachment.mimeType || '',
      fileSize: attachment.fileSize || '',
      createdAt: attachment.createdAt || '',
      missing: missing ? 'true' : 'false',
    });

    if (!missing) {
      await writer.addFile(`${unlinkedDir}/${exportedFileName}`, absolutePath);
    }
  }

  if (unlinkedRows.length > 0) {
    await writer.addBuffer(
      `${unlinkedDir}/unlinked_attachments.csv`,
      buildCsvBufferFromRows(UNLINKED_HEADERS, unlinkedRows),
    );
  }
}

export async function streamCustomerArchiveZip(res: Response) {
  const writer = new ZipStreamWriter(res as unknown as ZipSink);
  await buildCustomerArchive(writer);
  await writer.finalize();
}

export function getExportFileName(format: 'customer-archive' | 'zip-csv' = 'customer-archive', now = new Date()) {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  if (format === 'zip-csv') {
    return `crm-export-${date}-${time}.zip`;
  }
  return `crm-customer-archive-${date}-${time}.zip`;
}
