import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin, type AuthedRequest } from '../lib/auth.js';
import { logAction } from '../lib/audit.js';
import { fail, handleRouteError } from '../lib/http.js';
import { bindAttachmentsToEntity, deleteAttachmentRows } from '../services/attachments.js';
import { buildOrderDetail } from '../services/order-detail.js';
import {
  readOrderItemPayload,
  readOrderPayload,
  readProductionLogPayload,
  readProductionPayload,
} from '../services/payloads.js';
import { readString } from '../lib/values.js';

// 核心逻辑：生成下一个建议单号
async function generateNextDisplayId() {
  const now = new Date();
  const datePart = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const pattern = `CQBX-${now.getFullYear()}-${datePart}%`;

  const lastOrder = await db.get<{ display_id: string }>(
    `SELECT display_id FROM orders WHERE display_id LIKE ? ORDER BY display_id DESC LIMIT 1`,
    [pattern]
  );

  let nextSerial = 1;
  if (lastOrder?.display_id) {
    const lastSerialStr = lastOrder.display_id.slice(-2);
    const lastSerial = parseInt(lastSerialStr, 10);
    if (!isNaN(lastSerial)) nextSerial = lastSerial + 1;
  }
  return `CQBX-${now.getFullYear()}-${datePart}${String(nextSerial).padStart(2, '0')}`;
}

async function syncOrderProductSummary(orderId: number) {
  const items = await db.all<{ subtotal: number }[]>(`SELECT subtotal FROM order_items WHERE order_id = ?`, [orderId]);
  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  const productSummary = (await db.all<{ product_name: string }[]>(`SELECT product_name FROM order_items WHERE order_id = ?`, [orderId]))
    .map(i => i.product_name)
    .join(', ');
  
  await db.run(`UPDATE orders SET total_amount = ?, product_summary = ? WHERE id = ?`, [totalAmount, productSummary, orderId]);
}

export function createOrdersRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const customerId = Number(req.query.customerId);
    const status = readString(req.query.status);
    const q = readString(req.query.q);
    const startDate = readString(req.query.start_date);
    const endDate = readString(req.query.end_date);

    let sql = `
      SELECT 
        o.*, 
        c.name AS customer_name,
        c.country AS customer_country,
        (SELECT COUNT(*) FROM finance_records WHERE order_id = o.id AND status = 'pending') AS pending_finance_count,
        COALESCE((
          SELECT SUM(f.amount) 
          FROM finance_records f 
          WHERE f.order_id = o.id AND f.type = 'receipt' AND f.status = 'completed' AND f.currency = 'USD'
        ), 0) AS completed_receipt_usd
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE 1=1
    `;
    const params: (string | number | null | undefined)[] = [];

    if (customerId) {
      sql += ` AND o.customer_id = ?`;
      params.push(customerId);
    }
    if (status) {
      sql += ` AND o.status = ?`;
      params.push(status);
    }
    if (q) {
      sql += ` AND (o.display_id LIKE ? OR o.product_summary LIKE ? OR c.name LIKE ?)`;
      const p = `%${q}%`;
      params.push(p, p, p);
    }

    if (startDate) {
      sql += ` AND o.created_at >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND o.created_at <= ?`;
      params.push(endDate);
    }
    sql += ` ORDER BY datetime(o.created_at) DESC, o.id DESC`;

    try {
      const orders = await db.all(sql, params);
      res.json(orders);
    } catch (error) {
      return handleRouteError(res, error, '读取订单列表失败');
    }
  });

  // 新增：获取下一个建议单号，供前端预填
  router.get('/next-display-id', async (_req, res) => {
    try {
      const nextId = await generateNextDisplayId();
      res.json({ nextId });
    } catch (error) {
      return handleRouteError(res, error, '生成单号建议失败');
    }
  });

  router.get('/:id', async (req, res) => {
    const orderNo = req.params.id;
    try {
      const detail = await buildOrderDetail(orderNo);
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
    if ('error' in result) return fail(res, 400, result.error);

    try {
      await db.run('BEGIN TRANSACTION');

      // 逻辑升级：优先使用前端传来的 displayId，如果没有（或为空）再自动生成
      let displayId = result.payload.displayId;
      if (!displayId || !displayId.trim()) {
        displayId = await generateNextDisplayId();
      } else {
        // 检查用户手动输入的单号是否冲突
        const existing = await db.get(`SELECT id FROM orders WHERE display_id = ?`, [displayId]);
        if (existing) {
          await db.run('ROLLBACK');
          return fail(res, 400, `创建失败：单号 ${displayId} 已存在，请核对后重新输入！`, 'ORDER_ID_CONFLICT');
        }
      }

      const created = await db.run(
        `INSERT INTO orders (display_id, customer_id, status, details, total_amount, product_summary, delivery_date, freight_amount, misc_amount, created_by, updated_by) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [displayId, result.payload.customerId, result.payload.details, result.payload.totalAmount, result.payload.productSummary, result.payload.deliveryDate || null, result.payload.freightAmount, result.payload.miscAmount, req.user?.id || null, req.user?.id || null]
      );

      await db.run('COMMIT');
      res.status(201).json({ id: created.lastID, display_id: displayId });
    } catch (error) {
      await db.run('ROLLBACK');
      // 捕获 SQLite 唯一索引冲突（双保险）
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return fail(res, 400, '创建失败：该订单单号已存在，请核对！', 'ORDER_ID_CONFLICT');
      }
      return handleRouteError(res, error, '创建订单失败');
    }
  });

  router.patch('/:id', async (req: AuthedRequest, res) => {
    const orderId = Number(req.params.id);
    const result = await readOrderPayload(req.body || {});
    if ('error' in result) return fail(res, 400, result.error);

    try {
      await db.run('BEGIN TRANSACTION');
      await db.run(
        `UPDATE orders SET customer_id = ?, status = ?, details = ?, total_amount = ?, product_summary = ?, delivery_date = ?, freight_amount = ?, misc_amount = ?, updated_by = ? WHERE id = ?`,
        [result.payload.customerId, result.payload.status, result.payload.details, result.payload.totalAmount, result.payload.productSummary, result.payload.deliveryDate || null, result.payload.freightAmount, result.payload.miscAmount, req.user?.id || null, orderId]
      );

      const deletedIds = (req.body.deletedItemIds || []) as number[];
      if (deletedIds.length > 0) {
        await db.run(`DELETE FROM order_items WHERE id IN (${deletedIds.map(() => '?').join(',')})`, deletedIds);
      }

      const items = (req.body.items || []) as Array<{
        id?: number;
        productName: string;
        specification: string;
        hsCode?: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        subtotal: number;
        imageUrl?: string;
      }>;
      for (const item of items) {
        if (item.id) {
          await db.run(`UPDATE order_items SET product_name = ?, specification = ?, hs_code = ?, quantity = ?, unit = ?, unit_price = ?, subtotal = ?, image_url = ? WHERE id = ?`,
            [item.productName, item.specification, item.hsCode, item.quantity, item.unit, item.unitPrice, item.subtotal, item.imageUrl, item.id]);
        } else {
          await db.run(`INSERT INTO order_items (order_id, product_name, specification, hs_code, quantity, unit, unit_price, subtotal, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, item.productName, item.specification, item.hsCode, item.quantity, item.unit, item.unitPrice, item.subtotal, item.imageUrl]);
        }
      }

      await db.run('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await db.run('ROLLBACK');
      return handleRouteError(res, error, '更新订单失败');
    }
  });

  router.delete('/:id', requireAdmin, async (req: AuthedRequest, res) => {
    const orderId = Number(req.params.id);
    try {
      const order = await db.get<{ display_id: string }>(`SELECT display_id FROM orders WHERE id = ?`, [orderId]);
      if (!order) return fail(res, 404, '订单不存在');

      await db.run('BEGIN TRANSACTION');
      await db.run(`DELETE FROM order_items WHERE order_id = ?`, [orderId]);
      await db.run(`DELETE FROM finance_records WHERE order_id = ?`, [orderId]);
      await db.run(`DELETE FROM logistics_records WHERE order_id = ?`, [orderId]);
      await db.run(`DELETE FROM production_plans WHERE order_id = ?`, [orderId]);
      await db.run(`DELETE FROM customs_records WHERE order_id = ?`, [orderId]);
      await db.run(`DELETE FROM packing_records WHERE order_id = ?`, [orderId]);

      await db.run(`DELETE FROM orders WHERE id = ?`, [orderId]);
      await db.run('COMMIT');

      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: 'DELETE',
        entityType: 'ORDER',
        entityId: orderId,
        oldValue: { display_id: order.display_id },
      });

      res.json({ success: true });
    } catch (error) {
      await db.run('ROLLBACK');
      return handleRouteError(res, error, '删除订单失败');
    }
  });

  router.delete('/items/:id', requireAdmin, async (req, res) => {
    const itemId = Number(req.params.id);
    const existing = await db.get<{ order_id: number }>(`SELECT order_id FROM order_items WHERE id = ?`, [itemId]);
    if (!existing) return fail(res, 404, '条目不存在');
    try {
      await db.run(`DELETE FROM order_items WHERE id = ?`, [itemId]);
      await syncOrderProductSummary(existing.order_id);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除失败');
    }
  });

  router.get('/:id/production', async (req, res) => {
    const orderId = Number(req.params.id);
    try {
      const record = await db.get<any>(`SELECT pp.*, p.name AS partner_name FROM production_plans pp LEFT JOIN partners p ON p.id = pp.partner_id WHERE pp.order_id = ?`, [orderId]);
      if (!record) return res.json(null);
      const logs = await db.all(`SELECT pl.*, u.name as created_by_name FROM production_logs pl LEFT JOIN users u ON u.id = pl.created_by WHERE pl.plan_id = ? ORDER BY pl.created_at DESC`, [record.id]);
      res.json({ ...record, partnerId: record.partner_id, partnerName: record.partner_name, logs: logs.map(l => ({ ...l, createdByName: l.created_by_name })) });
    } catch (error) {
      return handleRouteError(res, error, '读取失败');
    }
  });

  router.post('/production/:id/logs', async (req: AuthedRequest, res) => {
    const planId = Number(req.params.id);
    const result = await readProductionLogPayload(req.body || {});
    if ('error' in result) return fail(res, 400, result.error);
    try {
      const created = await db.run(`INSERT INTO production_logs (plan_id, content, log_date, created_by) VALUES (?, ?, ?, ?)`, [planId, result.payload.content, result.payload.logDate || null, req.user?.id || null]);
      await bindAttachmentsToEntity('production_log', created.lastID as number, result.payload.attachmentIds);
      res.status(201).json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '添加失败');
    }
  });

  router.patch('/:id/packing', async (req: AuthedRequest, res) => {
    const orderId = Number(req.params.id);
    const items = req.body.items || [];
    try {
      await db.run(`DELETE FROM packing_records WHERE order_id = ?`, [orderId]);
      for (const item of items) {
        await db.run(`INSERT INTO packing_records (order_id, package_count, package_size, gross_weight, net_weight, attachment_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, Number(item.packageCount), item.packageSize, item.grossWeight, item.netWeight, item.attachmentId || null]);
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '失败');
    }
  });

  // ==================== Profit/Margin Data ====================

  router.get('/:id/profit', async (req, res) => {
    const orderId = Number(req.params.id);
    try {
      const row = await db.get<{ value: string }>(`SELECT value FROM settings WHERE key = ?`, [`order_profit_${orderId}`]);
      const data = row ? JSON.parse(row.value) : {};
      res.json({
        grossUsd: data.grossUsd || 0,
        bankFees: data.bankFees || 0,
        exchangeRate: data.exchangeRate || 7.2,
        factoryCostCny: data.factoryCostCny || 0,
        domesticFees: data.domesticFees || 0,
        freightUsd: data.freightUsd || 0,
        customsMisc: data.customsMisc || 0,
      });
    } catch (error) {
      return handleRouteError(res, error, '读取利润数据失败');
    }
  });

  router.post('/:id/profit', requireAdmin, async (req: AuthedRequest, res) => {
    const orderId = Number(req.params.id);
    const data = {
      grossUsd: Number(req.body.grossUsd) || 0,
      bankFees: Number(req.body.bankFees) || 0,
      exchangeRate: Number(req.body.exchangeRate) || 7.2,
      factoryCostCny: Number(req.body.factoryCostCny) || 0,
      domesticFees: Number(req.body.domesticFees) || 0,
      freightUsd: Number(req.body.freightUsd) || 0,
      customsMisc: Number(req.body.customsMisc) || 0,
    };
    try {
      await db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [`order_profit_${orderId}`, JSON.stringify(data)],
      );
      res.json({ success: true, ...data });
    } catch (error) {
      return handleRouteError(res, error, '保存利润数据失败');
    }
  });

  router.patch('/:id/quick-notes', async (req: AuthedRequest, res) => {
    try {
      await db.run(`UPDATE orders SET quick_notes = ? WHERE id = ?`, [req.body.content, req.params.id]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新失败');
    }
  });

  // 跟进时间轴
  router.get('/:id/follow-ups', async (req, res) => {
    const orderId = Number(req.params.id);
    try {
      const rows = await db.all(
        `SELECT of.*, u.name AS created_by_name FROM order_follow_ups of LEFT JOIN users u ON u.id = of.created_by WHERE of.order_id = ? ORDER BY datetime(of.created_at) DESC, of.id DESC`,
        [orderId],
      );
      res.json(rows);
    } catch (error) {
      return handleRouteError(res, error, '读取跟进记录失败');
    }
  });

  router.post('/:id/follow-ups', async (req: AuthedRequest, res) => {
    const orderId = Number(req.params.id);
    const content = String(req.body.content || '').trim();
    if (!content) {
      return fail(res, 400, '内容不能为空');
    }
    try {
      await db.run(
        `INSERT INTO order_follow_ups (order_id, content, created_by) VALUES (?, ?, ?)`,
        [orderId, content, req.user?.id || null],
      );
      res.status(201).json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '保存跟进记录失败');
    }
  });

  router.post('/:id/production', async (req: AuthedRequest, res) => {
    const orderId = Number(req.params.id);
    const result = await readProductionPayload(req.body || {}, orderId);
    if ('error' in result) return fail(res, 400, result.error);
    try {
      const created = await db.run(`INSERT INTO production_plans (order_id, partner_id, order_date, estimated_delivery_date, production_status, inspection_status, remark, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, result.payload.partnerId, result.payload.orderDate || null, result.payload.estimatedDeliveryDate || null, result.payload.productionStatus, result.payload.inspectionStatus, result.payload.remark, req.user?.id || null, req.user?.id || null]);
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, '保存失败');
    }
  });

  router.patch('/production/:id', async (req: AuthedRequest, res) => {
    const productionId = Number(req.params.id);
    try {
      const existing = await db.get<{ order_id: number }>(
        `SELECT order_id FROM production_plans WHERE id = ?`,
        [productionId]
      );
      if (!existing) {
        return fail(res, 404, '排产计划不存在');
      }

      const result = await readProductionPayload(req.body || {}, existing.order_id);
      if ('error' in result) return fail(res, 400, result.error);

      await db.run(
        `UPDATE production_plans SET partner_id = ?, order_date = ?, estimated_delivery_date = ?, production_status = ?, inspection_status = ?, remark = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [
          result.payload.partnerId,
          result.payload.orderDate || null,
          result.payload.estimatedDeliveryDate || null,
          result.payload.productionStatus,
          result.payload.inspectionStatus,
          result.payload.remark,
          req.user?.id || null,
          productionId
        ]
      );
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新排产计划失败');
    }
  });

  return router;
}
