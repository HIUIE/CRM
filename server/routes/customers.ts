import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin, type AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readString } from '../lib/values.js';

export function createCustomersRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const customers = await db.all(`
        SELECT
          c.*,
          u.name AS created_by_name,
          COUNT(o.id) AS order_count
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id
        LEFT JOIN users u ON u.id = c.created_by
        GROUP BY c.id
        ORDER BY datetime(c.created_at) DESC, c.id DESC
      `);
      res.json(customers);
    } catch (error) {
      return handleRouteError(res, error, '读取客户数据失败');
    }
  });

  router.post('/', async (req: AuthedRequest, res) => {
    const name = readString(req.body?.name);
    const country = readString(req.body?.country);
    const contact = readString(req.body?.contact);
    const logisticsPreference = readString(req.body?.logisticsPreference);
    const paymentTerms = readString(req.body?.paymentTerms);

    if (!name || !country || !contact) {
      return fail(res, 400, '请完整填写客户名称、国家和联系信息', 'INVALID_CUSTOMER_PAYLOAD');
    }

    try {
      const result = await db.run(
        `
          INSERT INTO customers (name, country, contact, logistics_preference, payment_terms, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [name, country, contact, logisticsPreference, paymentTerms, req.user?.id || null, req.user?.id || null],
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
    const logisticsPreference = readString(req.body?.logisticsPreference);
    const paymentTerms = readString(req.body?.paymentTerms);

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
          SET name = ?, country = ?, contact = ?, logistics_preference = ?, payment_terms = ?, updated_by = ?
          WHERE id = ?
        `,
        [name, country, contact, logisticsPreference, paymentTerms, req.user?.id || null, customerId],
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
