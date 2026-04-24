import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin, type AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readString } from '../lib/values.js';

export function createCustomersRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const timeRange = readString(req.query.timeRange);
    let timeFilter = '';
    const params: unknown[] = [];

    if (timeRange && timeRange !== 'all') {
      let interval = '';
      switch (timeRange) {
        case 'week': interval = '-7 days'; break;
        case 'month': interval = '-1 month'; break; case 'last_month': interval = '-2 month'; break;
        case '3months': interval = '-3 months'; break;
        case '6months': interval = '-6 months'; break;
        case 'year': interval = '-1 year'; break;
      }
      if (interval) {
        timeFilter = `WHERE c.created_at >= datetime('now', ?)`;
        params.push(interval);
      }
    }

    try {
      const customers = await db.all(`
        SELECT
          c.*,
          u.name AS created_by_name,
          COUNT(o.id) AS order_count
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id
        LEFT JOIN users u ON u.id = c.created_by
        ${timeFilter}
        GROUP BY c.id
        ORDER BY datetime(c.created_at) DESC, c.id DESC
      `, params);
      res.json(customers);
    } catch (error) {
      return handleRouteError(res, error, '读取客户数据失败');
    }
  });

  router.post('/', async (req: AuthedRequest, res) => {
    const name = readString(req.body?.name);
    const country = readString(req.body?.country);
    const contact = readString(req.body?.contact);
    const sourceChannel = readString(req.body?.sourceChannel);
    const intentProducts = readString(req.body?.intentProducts);

    if (!name || !country || !contact) {
      return fail(res, 400, '请完整填写客户名称、国家和联系信息', 'INVALID_CUSTOMER_PAYLOAD');
    }

    try {
      const result = await db.run(
        `
          INSERT INTO customers (name, country, contact, source_channel, intent_products, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [name, country, contact, sourceChannel, intentProducts, req.user?.id || null, req.user?.id || null],
      );
      res.status(201).json({ id: result.lastID });
    } catch (error) {
      return handleRouteError(res, error, '创建客户失败');
    }
  });

  router.patch('/:id', async (req: AuthedRequest, res) => {
    const customerId = Number(req.params.id);
    const name = readString(req.body?.name);
    const country = readString(req.body?.country);
    const contact = readString(req.body?.contact);
    const sourceChannel = readString(req.body?.sourceChannel);
    const intentProducts = readString(req.body?.intentProducts);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return fail(res, 400, '客户编号无效', 'INVALID_CUSTOMER_ID');
    }
    if (!name || !country || !contact) {
      return fail(res, 400, '请完整填写客户名称、国家和联系信息', 'INVALID_CUSTOMER_PAYLOAD');
    }

    try {
      const result = await db.run(
        `
          UPDATE customers
          SET name = ?, country = ?, contact = ?, source_channel = ?, intent_products = ?, updated_by = ?
          WHERE id = ?
        `,
        [name, country, contact, sourceChannel, intentProducts, req.user?.id || null, customerId],
      );
      if (!result.changes) {
        return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新客户失败');
    }
  });

  router.delete('/:id', requireAdmin, async (req, res) => {
    const customerId = Number(req.params.id);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return fail(res, 400, '客户编号无效', 'INVALID_CUSTOMER_ID');
    }

    try {
      const linkedOrders = await db.get<{ count: number }>(`SELECT COUNT(*) AS count FROM orders WHERE customer_id = ?`, [customerId]);
      if ((linkedOrders?.count || 0) > 0) {
        return fail(res, 409, '该客户下仍有关联订单，不能删除', 'CUSTOMER_HAS_ORDERS');
      }

      const result = await db.run(`DELETE FROM customers WHERE id = ?`, [customerId]);
      if (!result.changes) {
        return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除客户失败');
    }
  });

  return router;
}
