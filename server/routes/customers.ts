import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { requireAdmin, type AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readString } from '../lib/values.js';
import { logAction } from '../lib/audit.js';

export function createCustomersRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = readString(req.query.q);
    const startDate = readString(req.query.start_date);
    const endDate = readString(req.query.end_date);

    let whereSql = 'WHERE 1=1';
    const params: any[] = [];

    if (q) {
      whereSql += ` AND (c.name LIKE ? OR c.country LIKE ? OR c.contact LIKE ?)`;
      const p = `%${q}%`;
      params.push(p, p, p);
    }
    if (startDate) {
      whereSql += ` AND c.created_at >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      whereSql += ` AND c.created_at <= ?`;
      params.push(endDate);
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
        ${whereSql}
        GROUP BY c.id
        ORDER BY datetime(c.created_at) DESC, c.id DESC
      `, params);
      res.json(customers);
    } catch (error) {
      return handleRouteError(res, error, '读取客户数据失败');
    }
  });

  // GET customer by display_id or numeric id
  router.get('/:id', async (req, res) => {
    const rawId = req.params.id;
    const isDisplayId = rawId.startsWith('CUST-');

    try {
      const customer = await db.get(`
        SELECT c.*, u.name AS created_by_name
        FROM customers c
        LEFT JOIN users u ON u.id = c.created_by
        WHERE ${isDisplayId ? 'c.display_id = ?' : 'c.id = ?'}
      `, [isDisplayId ? rawId : Number(rawId)]);

      if (!customer) {
        return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');
      }

      const customerId = customer.id;

      const orders = await db.all(`
        SELECT 
          id, display_id, status, total_amount, product_summary, created_at,
          (SELECT COALESCE(SUM(amount), 0) FROM finance_records WHERE order_id = orders.id AND type = 'receipt' AND status = 'completed') as paid_amount
        FROM orders
        WHERE customer_id = ?
        ORDER BY created_at DESC
      `, [customerId]);

      const finance_records = await db.all(`
        SELECT
          f.id, f.type, f.amount, f.currency, f.status, f.target, f.created_at, f.remark,
          o.display_id as order_display_id, o.product_summary
        FROM finance_records f
        LEFT JOIN orders o ON o.id = f.order_id
        WHERE o.customer_id = ?
        ORDER BY f.created_at DESC
      `, [customerId]);

      const activities = await db.all(`
        SELECT 'finance' as type, f.id, o.display_id as order_display_id, 
          CASE WHEN f.type = 'receipt' THEN '收款完成' ELSE '付款完成' END as title,
          '' as desc, f.created_at,
          CASE WHEN f.type = 'receipt' THEN '+' ELSE '-' END || f.currency || ' ' || f.amount as value,
          CASE WHEN f.type = 'receipt' THEN 'text-emerald-500' ELSE 'text-red-500' END as valueColor
        FROM finance_records f JOIN orders o ON f.order_id = o.id
        WHERE f.status = 'completed' AND o.customer_id = ?
        UNION ALL
        SELECT 'logistics' as type, l.id, o.display_id as order_display_id, 
          '物流更新' as title, '货物已发出 · ' || l.carrier as desc, l.created_at,
          CASE WHEN l.status = 'arrived' THEN '已送达' WHEN l.status = 'shipped' THEN '运输中' ELSE '备货中' END as value,
          'text-slate-500' as valueColor
        FROM logistics_records l JOIN orders o ON l.order_id = o.id
        WHERE o.customer_id = ?
        UNION ALL
        SELECT 'customs' as type, cr.id, o.display_id as order_display_id, 
          '报关完成' as title, '报关单号 ' || cr.declaration_no as desc, cr.created_at,
          '' as value, '' as valueColor
        FROM customs_records cr JOIN orders o ON cr.order_id = o.id
        WHERE o.customer_id = ?
        UNION ALL
        SELECT 'order' as type, o.id, o.display_id as order_display_id, 
          '新建订单' as title, o.product_summary as desc, o.created_at,
          'USD ' || o.total_amount as value,
          'text-primary-navy dark:text-white' as valueColor
        FROM orders o
        WHERE o.customer_id = ?
        ORDER BY 6 DESC
        LIMIT 10
      `, [customerId, customerId, customerId, customerId]);

      const contacts = await db.all(`
        SELECT id, name, title, email, contact, is_primary
        FROM customer_contacts
        WHERE customer_id = ?
        ORDER BY is_primary DESC, created_at ASC
      `, [customerId]);

      const followups = await db.all(`
        SELECT id, content, channel, created_by_name, created_at
        FROM customer_followups
        WHERE customer_id = ?
        ORDER BY created_at DESC
      `, [customerId]);

      res.json({ ...customer, orders, finance_records, activities, contacts, followups });
    } catch (error) {
      return handleRouteError(res, error, '读取客户详情失败');
    }
  });

  router.post('/', async (req: AuthedRequest, res) => {
    const name = readString(req.body?.name);
    const country = readString(req.body?.country);
    const contact = readString(req.body?.contact);
    const sourceChannel = readString(req.body?.sourceChannel);
    const intentProducts = readString(req.body?.intentProducts);

    if (!name || !country) {
      return fail(res, 400, '请完整填写客户名称和国家信息', 'INVALID_CUSTOMER_PAYLOAD');
    }

    try {
      const result = await db.run(
        `INSERT INTO customers (name, country, contact, source_channel, intent_products, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, country, contact, sourceChannel, intentProducts, req.user?.id || null, req.user?.id || null],
      );

      const customerId = result.lastID as number;
      const year = new Date().getFullYear();
      const displayId = `CUST-${year}-${String(customerId).padStart(6, '0')}`;
      await db.run(`UPDATE customers SET display_id = ? WHERE id = ?`, [displayId, customerId]);

      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: 'CREATE',
        entityType: 'CUSTOMER',
        entityId: customerId,
        newValue: { name, country, contact, sourceChannel, intentProducts }
      });

      res.status(201).json({ id: customerId, displayId });
    } catch (error) {
      return handleRouteError(res, error, '创建客户失败');
    }
  });

  router.patch('/:id', async (req: AuthedRequest, res) => {
    const rawId = req.params.id;
    const isDisplayId = rawId.startsWith('CUST-');
    const name = readString(req.body?.name);
    const country = readString(req.body?.country);
    const contact = readString(req.body?.contact);
    const sourceChannel = readString(req.body?.sourceChannel);
    const intentProducts = readString(req.body?.intentProducts);

    if (!name || !country) {
      return fail(res, 400, '请完整填写客户名称和国家信息', 'INVALID_CUSTOMER_PAYLOAD');
    }

    try {
      const existing = await db.get<{ id: number }>(`SELECT id FROM customers WHERE ${isDisplayId ? 'display_id = ?' : 'id = ?'}`, [isDisplayId ? rawId : Number(rawId)]);
      if (!existing) return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');
      const customerId = existing.id;

      const oldVal = await db.get(`SELECT * FROM customers WHERE id = ?`, [customerId]);

      await db.run(
        `UPDATE customers SET name = ?, country = ?, contact = ?, source_channel = ?, intent_products = ?, updated_by = ? WHERE id = ?`,
        [name, country, contact, sourceChannel, intentProducts, req.user?.id || null, customerId],
      );

      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: 'UPDATE',
        entityType: 'CUSTOMER',
        entityId: customerId,
        oldValue: oldVal,
        newValue: { name, country, contact, sourceChannel, intentProducts }
      });

      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新客户失败');
    }
  });

  router.delete('/:id', requireAdmin, async (req, res) => {
    const rawId = req.params.id;
    const isDisplayId = rawId.startsWith('CUST-');

    try {
      const existing = await db.get<{ id: number }>(`SELECT id FROM customers WHERE ${isDisplayId ? 'display_id = ?' : 'id = ?'}`, [isDisplayId ? rawId : Number(rawId)]);
      if (!existing) return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');
      const customerId = existing.id;

      const linkedOrders = await db.get<{ count: number }>(`SELECT COUNT(*) AS count FROM orders WHERE customer_id = ?`, [customerId]);
      if ((linkedOrders?.count || 0) > 0) {
        return fail(res, 409, '该客户下仍有关联订单，不能删除', 'CUSTOMER_HAS_ORDERS');
      }

      const oldVal = await db.get(`SELECT * FROM customers WHERE id = ?`, [customerId]);
      const result = await db.run(`DELETE FROM customers WHERE id = ?`, [customerId]);
      if (!result.changes) return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');

      if (oldVal) {
        await logAction({
          userId: (req as any).user?.id || null,
          userName: (req as any).user?.name || null,
          action: 'DELETE',
          entityType: 'CUSTOMER',
          entityId: customerId,
          oldValue: oldVal
        });
      }

      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除客户失败');
    }
  });

  // --- Contacts sub-resource ---

  router.get('/:customerId/contacts', async (req, res) => {
    const rawId = req.params.customerId;
    const isDisplayId = rawId.startsWith('CUST-');
    try {
      const customer = await db.get<{ id: number }>(`SELECT id FROM customers WHERE ${isDisplayId ? 'display_id = ?' : 'id = ?'}`, [isDisplayId ? rawId : Number(rawId)]);
      if (!customer) return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');
      const contacts = await db.all(`SELECT * FROM customer_contacts WHERE customer_id = ? ORDER BY is_primary DESC, created_at ASC`, [customer.id]);
      res.json(contacts);
    } catch (error) {
      return handleRouteError(res, error, '读取联系人失败');
    }
  });

  router.post('/:customerId/contacts', async (req: AuthedRequest, res) => {
    const rawId = req.params.customerId;
    const isDisplayId = rawId.startsWith('CUST-');
    const name = readString(req.body?.name);
    const title = readString(req.body?.title);
    const email = readString(req.body?.email);
    const contact = readString(req.body?.contact);
    const isPrimary = req.body?.isPrimary ? 1 : 0;

    if (!name) return fail(res, 400, '姓名不能为空', 'INVALID_CONTACT_PAYLOAD');

    try {
      const customer = await db.get<{ id: number }>(`SELECT id FROM customers WHERE ${isDisplayId ? 'display_id = ?' : 'id = ?'}`, [isDisplayId ? rawId : Number(rawId)]);
      if (!customer) return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');

      if (isPrimary) {
        await db.run(`UPDATE customer_contacts SET is_primary = 0 WHERE customer_id = ?`, [customer.id]);
      }

      const result = await db.run(
        `INSERT INTO customer_contacts (customer_id, name, title, email, contact, is_primary) VALUES (?, ?, ?, ?, ?, ?)`,
        [customer.id, name, title, email, contact, isPrimary]
      );
      res.status(201).json({ id: result.lastID });
    } catch (error) {
      return handleRouteError(res, error, '添加联系人失败');
    }
  });

  router.patch('/:customerId/contacts/:contactId', async (req: AuthedRequest, res) => {
    const contactId = Number(req.params.contactId);
    const rawCustomerId = req.params.customerId;
    const isDisplayId = rawCustomerId.startsWith('CUST-');
    const name = readString(req.body?.name);
    const title = readString(req.body?.title);
    const email = readString(req.body?.email);
    const contact = readString(req.body?.contact);
    const isPrimary = req.body?.isPrimary ? 1 : 0;

    if (!name) return fail(res, 400, '姓名不能为空', 'INVALID_CONTACT_PAYLOAD');

    try {
      const customer = await db.get<{ id: number }>(`SELECT id FROM customers WHERE ${isDisplayId ? 'display_id = ?' : 'id = ?'}`, [isDisplayId ? rawCustomerId : Number(rawCustomerId)]);
      if (!customer) return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');

      if (isPrimary) {
        await db.run(`UPDATE customer_contacts SET is_primary = 0 WHERE customer_id = ?`, [customer.id]);
      }

      await db.run(
        `UPDATE customer_contacts SET name = ?, title = ?, email = ?, contact = ?, is_primary = ? WHERE id = ? AND customer_id = ?`,
        [name, title, email, contact, isPrimary, contactId, customer.id]
      );
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新联系人失败');
    }
  });

  router.delete('/:customerId/contacts/:contactId', async (req, res) => {
    const contactId = Number(req.params.contactId);
    try {
      await db.run(`DELETE FROM customer_contacts WHERE id = ?`, [contactId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除联系人失败');
    }
  });

  // --- Follow-ups sub-resource ---

  router.get('/:customerId/followups', async (req, res) => {
    const rawId = req.params.customerId;
    const isDisplayId = rawId.startsWith('CUST-');
    try {
      const customer = await db.get<{ id: number }>(`SELECT id FROM customers WHERE ${isDisplayId ? 'display_id = ?' : 'id = ?'}`, [isDisplayId ? rawId : Number(rawId)]);
      if (!customer) return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');
      const followups = await db.all(`SELECT * FROM customer_followups WHERE customer_id = ? ORDER BY created_at DESC`, [customer.id]);
      res.json(followups);
    } catch (error) {
      return handleRouteError(res, error, '读取跟进记录失败');
    }
  });

  router.post('/:customerId/followups', async (req: AuthedRequest, res) => {
    const rawId = req.params.customerId;
    const isDisplayId = rawId.startsWith('CUST-');
    const content = readString(req.body?.content);
    const channel = readString(req.body?.channel) || 'other';

    if (!content) return fail(res, 400, '跟进内容不能为空', 'INVALID_FOLLOWUP_PAYLOAD');

    try {
      const customer = await db.get<{ id: number }>(`SELECT id FROM customers WHERE ${isDisplayId ? 'display_id = ?' : 'id = ?'}`, [isDisplayId ? rawId : Number(rawId)]);
      if (!customer) return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');

      const result = await db.run(
        `INSERT INTO customer_followups (customer_id, content, channel, created_by, created_by_name) VALUES (?, ?, ?, ?, ?)`,
        [customer.id, content, channel, req.user?.id || null, req.user?.name || null]
      );
      res.status(201).json({ id: result.lastID });
    } catch (error) {
      return handleRouteError(res, error, '添加跟进记录失败');
    }
  });

  router.delete('/:customerId/followups/:followupId', requireAdmin, async (req, res) => {
    const followupId = Number(req.params.followupId);
    try {
      await db.run(`DELETE FROM customer_followups WHERE id = ?`, [followupId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除跟进记录失败');
    }
  });

  return router;
}
