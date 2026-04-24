import { Router } from 'express';
import { db } from '../db.js';
import { ORDER_STATUSES } from '../domain.js';
import type { AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { isOneOf, monthFromDateInput, normalizeOrderStatus, readString } from '../lib/values.js';
import { ensurePartnerExists, syncOrderProductSummary } from '../services/entities.js';
import { buildOrderDetail } from '../services/order-detail.js';
import { readOrderItemPayload, readOrderPayload, readProductionPayload } from '../services/payloads.js';
import { getOrderNumberPrefix } from '../services/settings.js';

export function createOrdersRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = readString(req.query.q);
    const product = readString(req.query.product);
    const country = readString(req.query.country);
    const status = readString(req.query.status);
    const customerId = readString(req.query.customerId);
    const orderMonth = monthFromDateInput(readString(req.query.orderMonth));
    const shippingMonth = monthFromDateInput(readString(req.query.shippingMonth));

    const where: string[] = [];
    const params: unknown[] = [];

    if (customerId) {
      where.push(`o.customer_id = ?`);
      params.push(Number(customerId));
    }
    if (country) {
      where.push(`c.country = ?`);
      params.push(country);
    }
    if (status && isOneOf(status, ORDER_STATUSES)) {
      where.push(`o.status = ?`);
      params.push(status);
    }
    if (orderMonth) {
      where.push(`strftime('%Y-%m', o.created_at) = ?`);
      params.push(orderMonth);
    }
    if (shippingMonth) {
      where.push(`
        EXISTS (
          SELECT 1
          FROM logistics_records l
          WHERE l.order_id = o.id
            AND l.shipping_date IS NOT NULL
            AND substr(l.shipping_date, 1, 7) = ?
        )
      `);
      params.push(shippingMonth);
    }
    if (q) {
      const pattern = `%${q}%`;
      where.push(`
        (
          o.display_id LIKE ?
          OR c.name LIKE ?
          OR c.country LIKE ?
          OR COALESCE(o.product_summary, '') LIKE ?
          OR COALESCE(o.details, '') LIKE ?
          OR EXISTS (
            SELECT 1
            FROM order_items oi
            WHERE oi.order_id = o.id
              AND (oi.product_name LIKE ? OR COALESCE(oi.specification, '') LIKE ?)
          )
        )
      `);
      params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
    }
    if (product) {
      const productPattern = `%${product}%`;
      where.push(`
        (
          COALESCE(o.product_summary, '') LIKE ?
          OR EXISTS (
            SELECT 1
            FROM order_items oi
            WHERE oi.order_id = o.id
              AND (oi.product_name LIKE ? OR COALESCE(oi.specification, '') LIKE ?)
          )
        )
      `);
      params.push(productPattern, productPattern, productPattern);
    }

    const sql = `
      SELECT
        o.id,
        o.display_id,
        o.customer_id,
        o.status,
        o.total_amount,
        o.details,
        o.product_summary,
        o.created_at,
        c.name AS customer_name,
        c.country AS customer_country,
        u.name AS created_by_name,
        (
          SELECT COUNT(*)
          FROM finance_records f
          WHERE f.order_id = o.id
        ) AS finance_count,
        (
          SELECT COUNT(*)
          FROM finance_records f
          WHERE f.order_id = o.id AND f.status = 'pending'
        ) AS pending_finance_count,
        COALESCE((
          SELECT SUM(f.amount)
          FROM finance_records f
          WHERE f.order_id = o.id
            AND f.type = 'receipt'
            AND f.status = 'completed'
            AND f.currency = 'USD'
        ), 0) AS completed_receipt_usd,
        COALESCE((
          SELECT SUM(f.amount)
          FROM finance_records f
          WHERE f.order_id = o.id
            AND f.type = 'payment'
            AND f.status = 'completed'
            AND f.currency = 'CNY'
        ), 0) AS completed_payment_cny,
        (
          SELECT l.status
          FROM logistics_records l
          WHERE l.order_id = o.id
          ORDER BY COALESCE(l.shipping_date, l.created_at) DESC, l.id DESC
          LIMIT 1
        ) AS latest_logistics_status,
        (
          SELECT l.tracking_no
          FROM logistics_records l
          WHERE l.order_id = o.id
          ORDER BY COALESCE(l.shipping_date, l.created_at) DESC, l.id DESC
          LIMIT 1
        ) AS latest_tracking_no,
        (
          SELECT COUNT(*)
          FROM logistics_records l
          WHERE l.order_id = o.id
        ) AS logistics_count,
        MAX(
          o.created_at,
          COALESCE((SELECT MAX(created_at) FROM finance_records f WHERE f.order_id = o.id), o.created_at),
          COALESCE((SELECT MAX(COALESCE(l.shipping_date, l.created_at)) FROM logistics_records l WHERE l.order_id = o.id), o.created_at),
          COALESCE((SELECT MAX(created_at) FROM order_items oi WHERE oi.order_id = o.id), o.created_at)
        ) AS latest_activity_at
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN users u ON u.id = o.created_by
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY latest_activity_at DESC, o.id DESC
    `;

    try {
      const orders = await db.all(sql, params);
      res.json(orders);
    } catch (error) {
      return handleRouteError(res, error, '读取订单数据失败');
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const detail = await buildOrderDetail(req.params.id);
      if (!detail) {
        return fail(res, 404, '订单不存在', 'ORDER_NOT_FOUND');
      }
      res.json(detail);
    } catch (error) {
      return handleRouteError(res, error, '读取订单详情失败');
    }
  });

  router.post('/', async (req: AuthedRequest, res) => {
    const result = await readOrderPayload(req.body || {});
    if ('error' in result) {
      return fail(res, 400, result.error, 'INVALID_ORDER_PAYLOAD');
    }

    try {
      const prefix = await getOrderNumberPrefix();
      const created = await db.run(
        `
          INSERT INTO orders (customer_id, status, details, total_amount, product_summary, delivery_date, freight_amount, misc_amount, created_by, updated_by)
          VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          result.payload.customerId,
          result.payload.details,
          result.payload.totalAmount,
          result.payload.productSummary,
          result.payload.deliveryDate || null,
          result.payload.freightAmount,
          result.payload.miscAmount,
          req.user?.id || null,
          req.user?.id || null,
        ],
      );

      const orderId = created.lastID as number;
      const displayId = `${prefix}${new Date().getFullYear()}-${String(orderId).padStart(6, '0')}`;
      await db.run(`UPDATE orders SET display_id = ? WHERE id = ?`, [displayId, orderId]);
      res.status(201).json({ id: orderId, display_id: displayId });
    } catch (error) {
      return handleRouteError(res, error, '创建订单失败');
    }
  });

  router.patch('/:id', async (req: AuthedRequest, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return fail(res, 400, '订单编号无效', 'INVALID_ORDER_ID');
    }

    const result = await readOrderPayload(req.body || {});
    if ('error' in result) {
      return fail(res, 400, result.error, 'INVALID_ORDER_PAYLOAD');
    }

    try {
      const updated = await db.run(
        `
          UPDATE orders
          SET customer_id = ?, details = ?, total_amount = ?, product_summary = ?, delivery_date = ?, freight_amount = ?, misc_amount = ?, updated_by = ?
          WHERE id = ?
        `,
        [
          result.payload.customerId,
          result.payload.details,
          result.payload.totalAmount,
          result.payload.productSummary,
          result.payload.deliveryDate || null,
          result.payload.freightAmount,
          result.payload.miscAmount,
          req.user?.id || null,
          orderId,
        ],
      );
      if (!updated.changes) {
        return fail(res, 404, '订单不存在', 'ORDER_NOT_FOUND');
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新订单失败');
    }
  });

  router.patch('/:id/status', async (req: AuthedRequest, res) => {
    const orderId = Number(req.params.id);
    const status = normalizeOrderStatus(readString(req.body?.status));

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return fail(res, 400, '订单编号无效', 'INVALID_ORDER_ID');
    }
    if (!isOneOf(status, ORDER_STATUSES)) {
      return fail(res, 400, '订单状态不正确', 'INVALID_ORDER_STATUS');
    }

    try {
      const result = await db.run(`UPDATE orders SET status = ?, updated_by = ? WHERE id = ?`, [status, req.user?.id || null, orderId]);
      if (!result.changes) {
        return fail(res, 404, '订单不存在', 'ORDER_NOT_FOUND');
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新订单状态失败');
    }
  });

  router.post('/:id/items', async (req, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return fail(res, 400, '订单编号无效', 'INVALID_ORDER_ID');
    }

    const result = await readOrderItemPayload(req.body || {}, orderId);
    if ('error' in result) {
      return fail(res, 400, result.error, 'INVALID_ORDER_ITEM_PAYLOAD');
    }

    try {
      const created = await db.run(
        `
          INSERT INTO order_items (order_id, product_name, specification, quantity, unit, unit_price, subtotal, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          result.payload.orderId,
          result.payload.productName,
          result.payload.specification,
          result.payload.quantity,
          result.payload.unit,
          result.payload.unitPrice,
          result.payload.subtotal,
          result.payload.imageUrl,
        ],
      );
      await syncOrderProductSummary(orderId);
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, '新增产品明细失败');
    }
  });

  router.patch('/items/:id', async (req, res) => {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return fail(res, 400, '产品明细编号无效', 'INVALID_ORDER_ITEM_ID');
    }

    const existing = await db.get<{ order_id: number }>(`SELECT order_id FROM order_items WHERE id = ?`, [itemId]);
    if (!existing) {
      return fail(res, 404, '产品明细不存在', 'ORDER_ITEM_NOT_FOUND');
    }

    const result = await readOrderItemPayload(req.body || {}, existing.order_id);
    if ('error' in result) {
      return fail(res, 400, result.error, 'INVALID_ORDER_ITEM_PAYLOAD');
    }

    try {
      await db.run(
        `
          UPDATE order_items
          SET product_name = ?, specification = ?, quantity = ?, unit = ?, unit_price = ?, subtotal = ?, image_url = ?
          WHERE id = ?
        `,
        [
          result.payload.productName,
          result.payload.specification,
          result.payload.quantity,
          result.payload.unit,
          result.payload.unitPrice,
          result.payload.subtotal,
          result.payload.imageUrl,
          itemId,
        ],
      );
      await syncOrderProductSummary(existing.order_id);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新产品明细失败');
    }
  });

  router.delete('/items/:id', async (req, res) => {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return fail(res, 400, '产品明细编号无效', 'INVALID_ORDER_ITEM_ID');
    }

    const existing = await db.get<{ order_id: number }>(`SELECT order_id FROM order_items WHERE id = ?`, [itemId]);
    if (!existing) {
      return fail(res, 404, '产品明细不存在', 'ORDER_ITEM_NOT_FOUND');
    }

    try {
      await db.run(`DELETE FROM order_items WHERE id = ?`, [itemId]);
      await syncOrderProductSummary(existing.order_id);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除产品明细失败');
    }
  });

  router.get('/:id/production', async (req, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return fail(res, 400, '订单编号无效', 'INVALID_ORDER_ID');
    }

    try {
      const record = await db.get<Record<string, unknown>>(
        `
          SELECT
            pp.*,
            p.name AS partner_name,
            p.partner_type AS partner_type
          FROM production_plans pp
          LEFT JOIN partners p ON p.id = pp.partner_id
          WHERE pp.order_id = ?
          LIMIT 1
        `,
        [orderId],
      );
      res.json(
        record
          ? {
              ...record,
              partnerId: record.partner_id,
              partnerName: record.partner_name,
              orderDate: record.order_date,
              estimatedDeliveryDate: record.estimated_delivery_date,
              productionStatus: record.production_status,
              inspectionStatus: record.inspection_status,
              updatedAt: record.updated_at,
            }
          : null,
      );
    } catch (error) {
      return handleRouteError(res, error, '读取生产安排失败');
    }
  });

  router.post('/:id/production', async (req: AuthedRequest, res) => {
    const orderId = Number(req.params.id);
    const result = await readProductionPayload(req.body || {}, orderId);
    if ('error' in result) {
      return fail(res, 400, result.error, 'INVALID_PRODUCTION_PAYLOAD');
    }

    try {
      const existing = await db.get<{ id: number }>(`SELECT id FROM production_plans WHERE order_id = ?`, [orderId]);
      if (existing) {
        return fail(res, 409, '该订单已有生产安排，请直接编辑', 'PRODUCTION_ALREADY_EXISTS');
      }

      const created = await db.run(
        `
          INSERT INTO production_plans (
            order_id, partner_id, order_date, estimated_delivery_date, production_status, inspection_status, remark, created_by, updated_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          result.payload.orderId,
          result.payload.partnerId,
          result.payload.orderDate || null,
          result.payload.estimatedDeliveryDate || null,
          result.payload.productionStatus,
          result.payload.inspectionStatus,
          result.payload.remark,
          req.user?.id || null,
          req.user?.id || null,
        ],
      );
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, '保存生产安排失败');
    }
  });

  router.patch('/production/:id', async (req: AuthedRequest, res) => {
    const productionId = Number(req.params.id);
    if (!Number.isInteger(productionId) || productionId <= 0) {
      return fail(res, 400, '生产安排编号无效', 'INVALID_PRODUCTION_ID');
    }

    const existing = await db.get<{ order_id: number }>(`SELECT order_id FROM production_plans WHERE id = ?`, [productionId]);
    if (!existing) {
      return fail(res, 404, '生产安排不存在', 'PRODUCTION_NOT_FOUND');
    }

    const result = await readProductionPayload(req.body || {}, existing.order_id);
    if ('error' in result) {
      return fail(res, 400, result.error, 'INVALID_PRODUCTION_PAYLOAD');
    }

    try {
      await db.run(
        `
          UPDATE production_plans
          SET partner_id = ?, order_date = ?, estimated_delivery_date = ?, production_status = ?, inspection_status = ?, remark = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          result.payload.partnerId,
          result.payload.orderDate || null,
          result.payload.estimatedDeliveryDate || null,
          result.payload.productionStatus,
          result.payload.inspectionStatus,
          result.payload.remark,
          req.user?.id || null,
          productionId,
        ],
      );
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新生产安排失败');
    }
  });

  return router;
}
