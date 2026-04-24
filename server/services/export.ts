import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import type { Response } from 'express';
import { db } from '../db.js';
import { resolveAttachmentAbsolutePath } from '../lib/files.js';
import { ZipStreamWriter, createZipBuffer } from '../lib/zip.js';
import { buildOrderDetail } from './order-detail.js';

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
];

const ORDER_ITEMS_HEADERS = ['id', 'product_name', 'specification', 'quantity', 'unit', 'unit_price', 'subtotal', 'image_url', 'created_at'];
const FINANCE_HEADERS = ['id', 'type', 'recordCategory', 'amount', 'currency', 'status', 'target', 'remark', 'partnerId', 'partnerName', 'createdAt', 'createdByName'];
const LOGISTICS_HEADERS = ['id', 'segmentType', 'carrier', 'trackingNo', 'status', 'shippingDate', 'packingDetails', 'packageCount', 'volumeCbm', 'grossWeightKg', 'incoterm', 'transportMode', 'vesselVoyage', 'billNo', 'etd', 'eta', 'recipientAddress', 'packageSize', 'remark', 'createdAt', 'createdByName'];
const PRODUCTION_LOG_HEADERS = ['id', 'planId', 'content', 'logDate', 'createdByName', 'createdAt'];
const PACKING_HEADERS = ['id', 'packageCount', 'packageSize', 'grossWeight', 'netWeight', 'attachmentId', 'imageUrl'];
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

function orderJsonForExport(detail: any) {
  return {
    exportedAt: new Date().toISOString(),
    order: detail.order,
    customer: detail.customer,
    summary: detail.summary,
    customs: detail.customs
      ? {
          id: detail.customs.id,
          status: detail.customs.status,
          brokerName: detail.customs.brokerName,
          declarationNo: detail.customs.declarationNo,
          declarationDate: detail.customs.declarationDate,
          releaseDate: detail.customs.releaseDate,
          tradeMode: detail.customs.tradeMode,
          remark: detail.customs.remark,
          updatedAt: detail.customs.updatedAt,
          createdByName: detail.customs.createdByName,
          attachmentCount: detail.customs.attachmentCount || 0,
        }
      : null,
    productionPlan: detail.productionPlan
      ? {
          id: detail.productionPlan.id,
          partnerId: detail.productionPlan.partnerId,
          partnerName: detail.productionPlan.partnerName,
          partnerType: detail.productionPlan.partnerType,
          partnerCountry: detail.productionPlan.partnerCountry,
          partnerContact: detail.productionPlan.partnerContact,
          orderDate: detail.productionPlan.orderDate,
          estimatedDeliveryDate: detail.productionPlan.estimatedDeliveryDate,
          productionStatus: detail.productionPlan.productionStatus,
          inspectionStatus: detail.productionPlan.inspectionStatus,
          remark: detail.productionPlan.remark,
          updatedAt: detail.productionPlan.updatedAt,
          createdByName: detail.productionPlan.createdByName,
          logCount: detail.productionPlan.logs?.length || 0,
        }
      : null,
    logisticsOverview: (detail.logisticsRecords || []).map((record) => ({
      id: record.id,
      segmentType: record.segmentType,
      carrier: record.carrier,
      trackingNo: record.trackingNo,
      status: record.status,
      shippingDate: record.shippingDate,
      attachmentCount: record.attachmentCount || 0,
    })),
  };
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
  const rows = await db.all<{ name: string }[]>(`PRAGMA table_info(${table})`);
  return rows.map((row) => row.name);
}

async function buildLegacyCsvBuffer(definition: LegacyExportDefinition) {
  const [columns, rows] = await Promise.all([
    getTableColumns(definition.table),
    db.all<Record<string, unknown>[]>(definition.query),
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
  return db.all<CustomerRow[]>(`
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
  return db.all<OrderRow[]>(
    `
      SELECT *
      FROM orders
      WHERE customer_id = ?
      ORDER BY datetime(created_at) ASC, id ASC
    `,
    [customerId],
  );
}

async function getOrderAttachments(orderId: number) {
  const [finance, logistics, customs, production, packing] = await Promise.all([
    db.all<Record<string, unknown>[]>(`
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
    db.all<Record<string, unknown>[]>(`
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
    db.all<Record<string, unknown>[]>(`
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
    db.all<Record<string, unknown>[]>(`
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
    db.all<Record<string, unknown>[]>(`
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
  ]);

  return [...finance, ...logistics, ...customs, ...production, ...packing] as AttachmentExportRow[];
}

async function getUnlinkedAttachments() {
  return db.all<AttachmentExportRow[]>(`
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

async function buildCustomerArchive(writer: ZipStreamWriter) {
  const customers = await getCustomersForArchive();

  for (const customer of customers) {
    const orders = await getOrdersForCustomer(Number(customer.id));
    const customerDirName = `customers/${sanitizeArchiveSegment(customer.name, 'customer')}_${customer.id}`;
    const customerJson = {
      exportedAt: new Date().toISOString(),
      customer: {
        id: customer.id,
        name: customer.name,
        country: customer.country || null,
        contact: customer.contact || null,
        logisticsPreference: customer.logistics_preference || null,
        paymentTerms: customer.payment_terms || null,
        createdAt: customer.created_at || null,
      },
      summary: {
        orderCount: Number(customer.order_count) || 0,
        orders: orders.map((order) => ({
          id: order.id,
          displayId: order.display_id,
          status: order.status || null,
          totalAmount: order.total_amount || 0,
          createdAt: order.created_at || null,
        })),
      },
    };

    await writer.addBuffer(`${customerDirName}/customer.json`, Buffer.from(`${JSON.stringify(customerJson, null, 2)}\n`, 'utf8'));

    for (const order of orders) {
      const detail = await buildOrderDetail(Number(order.id));
      if (!detail) {
        continue;
      }
      const exportDetail = detail as any;

      const orderDirName = `${customerDirName}/orders/${sanitizeArchiveSegment(order.display_id, 'order')}_${order.id}`;
      await writer.addBuffer(`${orderDirName}/order.json`, Buffer.from(`${JSON.stringify(orderJsonForExport(exportDetail), null, 2)}\n`, 'utf8'));

      await writer.addBuffer(
        `${orderDirName}/order_items.csv`,
        buildCsvBufferFromRows(
          ORDER_ITEMS_HEADERS,
          (exportDetail.items || []).map((item: any) => ({
            id: item.id,
            product_name: item.product_name,
            specification: item.specification || '',
            quantity: item.quantity,
            unit: item.unit || '',
            unit_price: item.unit_price,
            subtotal: item.subtotal,
            image_url: item.imageUrl || '',
            created_at: item.created_at || '',
          })),
        ),
      );

      await writer.addBuffer(
        `${orderDirName}/finance_records.csv`,
        buildCsvBufferFromRows(
          FINANCE_HEADERS,
          (exportDetail.financeRecords || []).map((record: any) => ({
            id: record.id,
            type: record.type,
            recordCategory: record.recordCategory || '',
            amount: record.amount,
            currency: record.currency,
            status: record.status,
            target: record.target || '',
            remark: record.remark || '',
            partnerId: record.partnerId || '',
            partnerName: record.partnerName || '',
            createdAt: record.createdAt || '',
            createdByName: record.createdByName || '',
          })),
        ),
      );

      await writer.addBuffer(
        `${orderDirName}/logistics_records.csv`,
        buildCsvBufferFromRows(
          LOGISTICS_HEADERS,
          (exportDetail.logisticsRecords || []).map((record: any) => ({
            id: record.id,
            segmentType: record.segmentType,
            carrier: record.carrier,
            trackingNo: record.trackingNo,
            status: record.status,
            shippingDate: record.shippingDate || '',
            packingDetails: record.packingDetails || '',
            packageCount: record.packageCount || '',
            volumeCbm: record.volumeCbm || '',
            grossWeightKg: record.grossWeightKg || '',
            incoterm: record.incoterm || '',
            transportMode: record.transportMode || '',
            vesselVoyage: record.vesselVoyage || '',
            billNo: record.billNo || '',
            etd: record.etd || '',
            eta: record.eta || '',
            recipientAddress: record.recipientAddress || '',
            packageSize: record.packageSize || '',
            remark: record.remark || '',
            createdAt: record.createdAt || '',
            createdByName: record.createdByName || '',
          })),
        ),
      );

      if (exportDetail.customs) {
        await writer.addBuffer(
          `${orderDirName}/customs_record.json`,
          Buffer.from(`${JSON.stringify(exportDetail.customs, null, 2)}\n`, 'utf8'),
        );
      }

      if (exportDetail.productionPlan) {
        const { logs = [], ...planWithoutLogs } = exportDetail.productionPlan;
        await writer.addBuffer(
          `${orderDirName}/production_plan.json`,
          Buffer.from(`${JSON.stringify({ ...planWithoutLogs, logCount: logs.length }, null, 2)}\n`, 'utf8'),
        );
      }

      if (exportDetail.productionPlan?.logs?.length) {
        await writer.addBuffer(
          `${orderDirName}/production_logs.csv`,
          buildCsvBufferFromRows(
            PRODUCTION_LOG_HEADERS,
            exportDetail.productionPlan.logs.map((log: any) => ({
              id: log.id,
              planId: log.planId,
              content: log.content,
              logDate: log.logDate || '',
              createdByName: log.createdByName || '',
              createdAt: log.createdAt || '',
            })),
          ),
        );
      }

      if (exportDetail.packingRecords?.length) {
        await writer.addBuffer(
          `${orderDirName}/packing_records.csv`,
          buildCsvBufferFromRows(
            PACKING_HEADERS,
            exportDetail.packingRecords.map((record: any) => ({
              id: record.id || '',
              packageCount: record.packageCount || '',
              packageSize: record.packageSize || '',
              grossWeight: record.grossWeight || '',
              netWeight: record.netWeight || '',
              attachmentId: record.attachmentId || '',
              imageUrl: record.imageUrl || '',
            })),
          ),
        );
      }

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
  const writer = new ZipStreamWriter(res as any);
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
