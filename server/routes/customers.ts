import { Router } from 'express';
import { dbAll, dbGet, dbRun, SQL } from '../lib/db.js';
import { requireAdmin, requireAuth, type AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readString, readPagination, buildLimitOffset } from '../lib/values.js';
import { logAction } from '../lib/audit.js';

function generateCustomerDisplayId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hash = Math.random().toString(36).slice(2, 8);
  return `cust-${date}-${hash}`;
}

export function createCustomersRouter() {
  const router = Router();

  router.get('/', requireAuth, async (req, res) => {
    const q = readString(req.query.q);
    const startDate = readString(req.query.start_date);
    const endDate = readString(req.query.end_date);

    let whereSql = 'WHERE c.deleted_at IS NULL';
    const params: (string | number | null | undefined)[] = [];

    if (q) {
      whereSql += ` AND (c.name LIKE ? OR c.country LIKE ? OR c.contact LIKE ? OR c.display_id LIKE ?)`;
      const p = `%${q}%`;
      params.push(p, p, p, p);
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
      const customers = await dbAll(`
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
        ${buildLimitOffset(readPagination(req.query as Record<string, unknown>))}
      `, params);
      res.json(customers);
    } catch (error) {
      return handleRouteError(res, error, '读取客户数据失败');
    }
  });

  router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
    const customerIdOrDisplay = req.params.id;
    
    try {
      // Try by display_id first, then by id (PG can't compare int = text)
      const isNumeric = /^\d+$/.test(customerIdOrDisplay);
      const customer = await dbGet(`
        SELECT c.*, u.name AS created_by_name
        FROM customers c
        LEFT JOIN users u ON u.id = c.created_by
        WHERE LOWER(c.display_id) = LOWER(?)
        ${isNumeric ? 'OR c.id = ?' : ''}
      `, isNumeric ? [customerIdOrDisplay, Number(customerIdOrDisplay)] : [customerIdOrDisplay]);

      if (!customer) {
        return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');
      }

      const actualId = customer.id;

      const [orders, finance_records, followups, system_activities, tasks, contacts] = await Promise.all([
        dbAll(`
          SELECT 
            id, display_id, status, total_amount, product_summary, created_at,
            (SELECT COALESCE(SUM(amount), 0) FROM finance_records WHERE order_id = orders.id AND type = 'receipt' AND status = 'completed') as paid_amount
          FROM orders
          WHERE customer_id = ?
          ORDER BY created_at DESC
        `, [actualId]),
        dbAll(`
          SELECT
            f.id, f.type, f.amount, f.currency, f.status, f.target, f.created_at, f.remark,
            o.display_id as order_display_id, o.product_summary
          FROM finance_records f
          LEFT JOIN orders o ON o.id = f.order_id
          WHERE o.customer_id = ?
          ORDER BY f.created_at DESC
        `, [actualId]),
        dbAll(`
          SELECT f.id, f.content, f.created_at, f.created_by, f.created_by_name,
                 NULL as source_order_id, NULL as source_order_display_id
          FROM customer_followups f
          WHERE f.customer_id = ?
          UNION ALL
          SELECT ofu.id, ofu.content, ofu.created_at, ofu.created_by,
                 COALESCE(u.name, '系统') as created_by_name,
                 ofu.order_id as source_order_id, o.display_id as source_order_display_id
          FROM order_follow_ups ofu
          JOIN orders o ON ofu.order_id = o.id
          LEFT JOIN users u ON ofu.created_by = u.id
          WHERE o.customer_id = ?
          ORDER BY created_at DESC
        `, [actualId, actualId]),
        dbAll(`
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
          LIMIT 20
        `, [actualId, actualId, actualId, actualId]),
        dbAll(`
          SELECT t.*, u.name as assignee_name
          FROM tasks t
          JOIN users u ON t.assignee_id = u.id
          WHERE t.entity_type = 'CUSTOMER' AND t.entity_id = ?
          ORDER BY t.due_date ASC
        `, [actualId]),
        dbAll(`SELECT * FROM customer_contacts WHERE customer_id = ?`, [actualId])
      ]);

      res.json({ ...customer, orders, finance_records, system_activities, followups, contacts, tasks });
    } catch (error) {
      return handleRouteError(res, error, '读取客户详情失败');
    }
  });

  router.post('/', requireAuth, async (req: AuthedRequest, res) => {
    const name = readString(req.body?.name);
    const country = readString(req.body?.country);
    const contact = readString(req.body?.contact);
    const sourceChannel = readString(req.body?.sourceChannel);
    const intentProducts = readString(req.body?.intentProducts);

    if (!name || !country) {
      return fail(res, 400, '请完整填写客户名称和国家信息', 'INVALID_CUSTOMER_PAYLOAD');
    }

    try {
      const displayId = generateCustomerDisplayId();
      const result = await dbRun(
        `
          INSERT INTO customers (display_id, name, country, contact, source_channel, intent_products, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [displayId, name, country, contact, sourceChannel, intentProducts, req.user?.id || null, req.user?.id || null],
      );

      const customerId = result.lastID;

      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: 'CREATE',
        entityType: 'CUSTOMER',
        entityId: customerId,
        newValue: { name, country, contact, sourceChannel, intentProducts, display_id: displayId }
      });

      res.status(201).json({ id: customerId, displayId });
    } catch (error) {
      return handleRouteError(res, error, '创建客户失败');
    }
  });

  router.post('/:id/followups', requireAuth, async (req: AuthedRequest, res) => {
    const customerId = req.params.id;
    const content = readString(req.body?.content);

    if (!content) return fail(res, 400, '请输入跟进内容');

    try {
      const customer = await dbGet(`SELECT id FROM customers WHERE id = ? OR display_id = ?`, [customerId, customerId]);
      if (!customer) return fail(res, 404, '客户不存在');

      await dbRun(
        `INSERT INTO customer_followups (customer_id, content, created_by, created_by_name) VALUES (?, ?, ?, ?)`,
        [customer.id, content, req.user?.id, req.user?.name]
      );

      res.status(201).json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '保存跟进记录失败');
    }
  });

  router.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
    const customerId = req.params.id;
    const name = readString(req.body?.name);
    const country = readString(req.body?.country);
    const contact = readString(req.body?.contact);
    const sourceChannel = readString(req.body?.sourceChannel);
    const intentProducts = readString(req.body?.intentProducts);

    if (!name || !country) {
      return fail(res, 400, '请完整填写客户名称和国家信息', 'INVALID_CUSTOMER_PAYLOAD');
    }

    try {
      const oldVal = await dbGet(`SELECT * FROM customers WHERE id = ? OR display_id = ?`, [customerId, customerId]);
      if (!oldVal) return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');

      await dbRun(
        `
          UPDATE customers
          SET name = ?, country = ?, contact = ?, source_channel = ?, intent_products = ?, updated_by = ?
          WHERE id = ?
        `,
        [name, country, contact, sourceChannel, intentProducts, req.user?.id || null, oldVal.id],
      );

      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: 'UPDATE',
        entityType: 'CUSTOMER',
        entityId: oldVal.id,
        oldValue: oldVal,
        newValue: { name, country, contact, sourceChannel, intentProducts }
      });

      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新客户失败');
    }
  });

  router.delete('/:id', requireAdmin, async (req: AuthedRequest, res) => {
    const customerId = req.params.id;
    try {
      const customer = await dbGet(`SELECT id FROM customers WHERE id = ? OR display_id = ?`, [customerId, customerId]);
      if (!customer) return fail(res, 404, '客户不存在');

      const linkedOrders = await dbGet<{ count: number }>(`SELECT COUNT(*) AS count FROM orders WHERE customer_id = ?`, [customer.id]);
      if ((linkedOrders?.count || 0) > 0) {
        return fail(res, 409, '该客户下仍有关联订单，不能删除', 'CUSTOMER_HAS_ORDERS');
      }

      const oldVal = await dbGet(`SELECT * FROM customers WHERE id = ?`, [customer.id]);
      const result = await dbRun(`UPDATE customers SET deleted_at = ${SQL.now()} WHERE id = ?`, [customer.id]);
      if (!result.changes) {
        return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');
      }

      if (oldVal) {
        await logAction({
          userId: req.user?.id ?? null,
          userName: req.user?.name ?? null,
          action: 'DELETE',
          entityType: 'CUSTOMER',
          entityId: customer.id,
          oldValue: oldVal
        });
      }

      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除客户失败');
    }
  });

  return router;
}
