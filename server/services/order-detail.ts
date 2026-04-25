import type { Currency, FinanceType, PaymentCategory } from '../domain.js';
import { db } from '../db.js';
import { buildAttachmentUrl, getStoredNameFromRecord } from '../lib/files.js';
import { normalizeOrderStatus } from '../lib/values.js';
import { getAttachmentsByEntity } from './attachments.js';

function getTimelineValue(record: Record<string, unknown>) {
  const rawValue = String(record.shipping_date || record.created_at || '');
  return rawValue ? new Date(rawValue).getTime() : 0;
}

export async function buildOrderDetail(idOrNo: number | string) {
  const isId = typeof idOrNo === 'number' || /^\d+$/.test(String(idOrNo));
  const sql = `
    SELECT
      o.*,
      c.name AS customer_name,
      c.display_id AS customer_display_id,
      c.country AS customer_country,
      c.contact AS customer_contact,
      c.logistics_preference AS customer_logistics_preference,
      c.payment_terms AS customer_payment_terms,
      cu.name AS created_by_name
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN users cu ON cu.id = o.created_by
    WHERE ${isId ? 'o.id' : 'o.display_id'} = ?
  `;

  const order = await db.get<Record<string, unknown>>(sql, [idOrNo]);
  if (!order) {
    return null;
  }

  const orderId = Number(order.id);

  const items = await db.all<Record<string, unknown>[]>(`
    SELECT *
    FROM order_items
    WHERE order_id = ?
    ORDER BY id ASC
  `, [orderId]);

  const financeRecords = await db.all<Record<string, unknown>[]>(`
    SELECT
      f.*,
      p.name AS partner_name,
      p.partner_type AS partner_type,
      u.name AS created_by_name
    FROM finance_records f
    LEFT JOIN partners p ON p.id = f.partner_id
    LEFT JOIN users u ON u.id = f.created_by
    WHERE f.order_id = ?
    ORDER BY datetime(f.created_at) DESC, f.id DESC
  `, [orderId]);

  const logisticsRecords = await db.all<Record<string, unknown>[]>(`
    SELECT
      l.*,
      u.name AS created_by_name
    FROM logistics_records l
    LEFT JOIN users u ON u.id = l.created_by
    WHERE l.order_id = ?
    ORDER BY
      CASE WHEN segment_type = 'domestic' THEN 0 ELSE 1 END ASC,
      CASE WHEN shipping_date IS NULL OR shipping_date = '' THEN 1 ELSE 0 END ASC,
      l.shipping_date DESC,
      datetime(l.created_at) DESC,
      id DESC
    `, [orderId]);

  const packingRecords = await db.all<Record<string, unknown>[]>(
    `
      SELECT pr.*, a.stored_name, a.file_path
      FROM packing_records pr
      LEFT JOIN attachments a ON a.id = pr.attachment_id
      WHERE pr.order_id = ?
      ORDER BY pr.id ASC
    `,
    [orderId],
  );

  const customs = await db.get<Record<string, unknown>>(
    `
      SELECT
        c.*,
        u.name AS created_by_name
      FROM customs_records c
      LEFT JOIN users u ON u.id = c.created_by
      WHERE c.order_id = ?
      LIMIT 1
    `,
    [orderId],
  );

  const productionPlan = await db.get<Record<string, unknown>>(
    `
      SELECT
        pp.*,
        p.name AS partner_name,
        p.partner_type AS partner_type,
        p.country AS partner_country,
        p.contact AS partner_contact,
        u.name AS created_by_name
      FROM production_plans pp
      LEFT JOIN partners p ON p.id = pp.partner_id
      LEFT JOIN users u ON u.id = pp.created_by
      WHERE pp.order_id = ?
      LIMIT 1
    `,
    [orderId],
  );

  let productionLogs: Record<string, unknown>[] = [];
  if (productionPlan) {
    productionLogs = await db.all(
      `
        SELECT pl.*, u.name as created_by_name
        FROM production_logs pl
        LEFT JOIN users u ON u.id = pl.created_by
        WHERE pl.plan_id = ?
        ORDER BY datetime(pl.created_at) DESC
      `,
      [productionPlan.id],
    );
  }

  const summaryRows = await db.all<{ type: FinanceType; currency: string; payment_category: PaymentCategory; total: number }[]>(`
    SELECT type, currency, payment_category, COALESCE(SUM(amount), 0) AS total
    FROM finance_records
    WHERE order_id = ? AND status = 'completed'
    GROUP BY type, currency, payment_category
  `, [orderId]);

  const receiptsByCurrency: Record<string, number> = {};
  const paymentsByCurrency: Record<string, number> = {};
  const freightByCurrency: Record<string, number> = {};

  for (const row of summaryRows) {
    const cur = row.currency || 'USD';
    if (row.type === 'receipt') {
      receiptsByCurrency[cur] = (receiptsByCurrency[cur] || 0) + row.total;
    } else {
      paymentsByCurrency[cur] = (paymentsByCurrency[cur] || 0) + row.total;
      if (row.payment_category === 'freight') {
        freightByCurrency[cur] = (freightByCurrency[cur] || 0) + row.total;
      }
    }
  }

  const pendingFinanceCount = await db.get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM finance_records WHERE order_id = ? AND status = 'pending'`,
    [orderId],
  );

  const domesticLogisticsRecord = logisticsRecords.find((item) => item.segment_type === 'domestic') || null;
  const internationalLogisticsRecord = logisticsRecords.find((item) => item.segment_type !== 'domestic') || null;
  const latestLogistics =
    [...logisticsRecords].sort((left, right) => getTimelineValue(right) - getTimelineValue(left))[0] ||
    internationalLogisticsRecord ||
    domesticLogisticsRecord ||
    null;
  const orderAmount = Number(order.total_amount) || 0;
  const receiptTotal = receiptsByCurrency.USD || 0;
  const paymentStatus =
    receiptTotal <= 0
      ? 'unpaid'
      : receiptTotal >= orderAmount && orderAmount > 0
        ? 'paid'
        : 'partial';
  const outstandingAmount = Math.max(orderAmount - receiptTotal, 0);
  const settled = outstandingAmount <= 0 && orderAmount > 0;

  const financeAttachments = await getAttachmentsByEntity('finance', financeRecords.map((record) => Number(record.id)));
  const logisticsAttachments = await getAttachmentsByEntity('logistics', logisticsRecords.map((record) => Number(record.id)));
  const customsAttachments = customs ? await getAttachmentsByEntity('customs', [Number(customs.id)]) : new Map<number, Record<string, unknown>[]>();
  const productionLogAttachments = productionPlan ? await getAttachmentsByEntity('production_log', productionLogs.map(l => Number(l.id))) : new Map<number, Record<string, unknown>[]>();

  return {
    order: {
      ...order,
      status: normalizeOrderStatus(String(order.status || 'draft')),
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
    items: items.map((item) => ({
      ...item,
      hsCode: item.hs_code || null,
      imageUrl: item.image_url || null,
    })),
    financeRecords: financeRecords.map((record) => ({
      ...record,
      recordCategory: record.record_category || record.payment_category || (record.type === 'receipt' ? 'deposit' : 'other'),
      partnerId: record.partner_id || null,
      partnerName: record.partner_name || null,
      createdAt: record.created_at,
      createdByName: record.created_by_name || null,
      attachments: financeAttachments.get(Number(record.id)) || [],
      attachmentCount: (financeAttachments.get(Number(record.id)) || []).length,
    })),
    productionPlan: productionPlan
      ? {
          ...productionPlan,
          partnerId: productionPlan.partner_id,
          partnerName: productionPlan.partner_name,
          partnerType: productionPlan.partner_type,
          partnerCountry: productionPlan.partner_country,
          partnerContact: productionPlan.partner_contact,
          orderDate: productionPlan.order_date,
          estimatedDeliveryDate: productionPlan.estimated_delivery_date,
          productionStatus: productionPlan.production_status,
          inspectionStatus: productionPlan.inspection_status,
          updatedAt: productionPlan.updated_at,
          createdByName: productionPlan.created_by_name || null,
          logs: productionLogs.map(l => ({
            ...l,
            logDate: l.log_date,
            createdByName: l.created_by_name,
            attachments: productionLogAttachments.get(Number(l.id)) || []
          }))
        }
      : null,
    logisticsRecords: logisticsRecords.map((record) => ({
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
      attachments: logisticsAttachments.get(Number(record.id)) || [],
      attachmentCount: (logisticsAttachments.get(Number(record.id)) || []).length,
    })),
    customs: customs
      ? {
          ...customs,
          brokerName: customs.broker_name,
          declarationNo: customs.declaration_no,
          declarationDate: customs.declaration_date,
          releaseDate: customs.release_date,
          tradeMode: customs.trade_mode,
          createdAt: customs.created_at,
          updatedAt: customs.updated_at,
          createdByName: customs.created_by_name || null,
          attachments: customsAttachments.get(Number(customs.id)) || [],
          attachmentCount: (customsAttachments.get(Number(customs.id)) || []).length,
        }
      : null,
    packingRecords: packingRecords.map((record) => ({
      id: record.id,
      packageCount: String(record.package_count || ''),
      packageSize: String(record.package_size || ''),
      grossWeight: String(record.gross_weight || ''),
      netWeight: String(record.net_weight || ''),
      attachmentId: record.attachment_id,
      imageUrl: record.attachment_id
        ? buildAttachmentUrl(Number(record.attachment_id), getStoredNameFromRecord(record.stored_name, record.file_path))
        : null,
    })),
    domesticLogistics: domesticLogisticsRecord ? {
          ...domesticLogisticsRecord,
          segmentType: domesticLogisticsRecord.segment_type || 'domestic',
          trackingNo: domesticLogisticsRecord.tracking_no,
          packingDetails: domesticLogisticsRecord.packing_details,
          shippingDate: domesticLogisticsRecord.shipping_date,
          packageCount: domesticLogisticsRecord.package_count,
          volumeCbm: domesticLogisticsRecord.volume_cbm,
          grossWeightKg: domesticLogisticsRecord.gross_weight_kg,
          transportMode: domesticLogisticsRecord.transport_mode,
          vesselVoyage: domesticLogisticsRecord.vessel_voyage,
          billNo: domesticLogisticsRecord.bill_no,
          createdAt: domesticLogisticsRecord.created_at,
          createdByName: domesticLogisticsRecord.created_by_name || null,
          attachments: logisticsAttachments.get(Number(domesticLogisticsRecord.id)) || [],
          attachmentCount: (logisticsAttachments.get(Number(domesticLogisticsRecord.id)) || []).length,
        }
      : null,
    internationalLogistics: internationalLogisticsRecord
      ? {
          ...internationalLogisticsRecord,
          segmentType: internationalLogisticsRecord.segment_type || 'international',
          trackingNo: internationalLogisticsRecord.tracking_no,
          packingDetails: internationalLogisticsRecord.packing_details,
          shippingDate: internationalLogisticsRecord.shipping_date,
          packageCount: internationalLogisticsRecord.package_count,
          volumeCbm: internationalLogisticsRecord.volume_cbm,
          grossWeightKg: internationalLogisticsRecord.gross_weight_kg,
          transportMode: internationalLogisticsRecord.transport_mode,
          vesselVoyage: internationalLogisticsRecord.vessel_voyage,
          billNo: internationalLogisticsRecord.bill_no,
          createdAt: internationalLogisticsRecord.created_at,
          createdByName: internationalLogisticsRecord.created_by_name || null,
          attachments: logisticsAttachments.get(Number(internationalLogisticsRecord.id)) || [],
          attachmentCount: (logisticsAttachments.get(Number(internationalLogisticsRecord.id)) || []).length,
        }
      : null,
    summary: {
      receiptsByCurrency,
      paymentsByCurrency,
      freightByCurrency,
      pendingFinanceCount: pendingFinanceCount?.count || 0,
      latestLogisticsStatus: latestLogistics?.status || null,
      latestShippingDate: latestLogistics?.shipping_date || null,
      paidAmount: receiptsByCurrency.USD,
      outstandingAmount,
      paymentStatus,
      settled,
      attachmentsSummary: {
        finance: financeRecords.reduce((sum, record) => sum + (financeAttachments.get(Number(record.id)) || []).length, 0),
        logistics: logisticsRecords.reduce((sum, record) => sum + (logisticsAttachments.get(Number(record.id)) || []).length, 0),
        customs: customs ? (customsAttachments.get(Number(customs.id)) || []).length : 0,
      },
    },
  };
}
