import { Router } from 'express';
import { dbAll, dbGet, dbRun, SQL, withTransaction } from '../lib/db.js';
import { requireAdmin, requireAuth, type AuthedRequest, getDataScopeConstraint } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readString, readPagination, buildLimitOffset, calculateSimilarity } from '../lib/values.js';
import { logAction } from '../lib/audit.js';
import { createNotification } from '../lib/notifications.js';

function generateCustomerDisplayId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hash = Math.random().toString(36).slice(2, 8);
  return `cust-${date}-${hash}`;
}

export function createCustomersRouter() {
  const router = Router();

  router.get('/', requireAuth, async (req: AuthedRequest, res) => {
    const q = readString(req.query.q);
    const startDate = readString(req.query.start_date);
    const endDate = readString(req.query.end_date);

    let whereSql = 'WHERE c.deleted_at IS NULL';
    const params: (string | number | null | undefined)[] = [];

    const [scopeSql, scopeParams] = getDataScopeConstraint(req.user, 'c', 'owner_user_id');
    whereSql += scopeSql;
    params.push(...scopeParams);

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
      // P11: Ensure end_date covers the full day (23:59:59)
      whereSql += ` AND c.created_at <= ?`;
      params.push(`${endDate} 23:59:59`);
    }

    try {
      const customers = await dbAll(`
        SELECT
          c.*,
          u.name AS created_by_name,
          ou.name AS owner_user_name,
          COUNT(o.id) AS order_count
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.deleted_at IS NULL
        LEFT JOIN users u ON u.id = c.created_by
        LEFT JOIN users ou ON ou.id = c.owner_user_id
        ${whereSql}
        GROUP BY c.id, u.name, ou.name
        ORDER BY datetime(c.created_at) DESC, c.id DESC
        ${buildLimitOffset(readPagination(req.query as Record<string, unknown>), params)}
      `, params);
      res.json(customers);
    } catch (error) {
      return handleRouteError(res, error, '读取客户数据失败');
    }
  });

  router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
    const customerIdOrDisplay = req.params.id as string;
    
    try {
      const [scopeSql, scopeParams] = getDataScopeConstraint(req.user, 'c', 'owner_user_id');
      // Try by display_id first, then by id (PG can't compare int = text)
      const isNumeric = /^\d+$/.test(customerIdOrDisplay);
      const customer = await dbGet(`
        SELECT c.*, u.name AS created_by_name, ou.name AS owner_user_name
        FROM customers c
        LEFT JOIN users u ON u.id = c.created_by
        LEFT JOIN users ou ON ou.id = c.owner_user_id
        WHERE c.deleted_at IS NULL
          ${scopeSql}
          AND (
            LOWER(c.display_id) = LOWER(?)
            ${isNumeric ? 'OR c.id = ?' : ''}
          )
      `, [...scopeParams, ...(isNumeric ? [customerIdOrDisplay, Number(customerIdOrDisplay)] : [customerIdOrDisplay])]);

      if (!customer) {
        return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');
      }

      const actualId = customer.id;

      const [orders, finance_records, followups, system_activities, tasks, contacts, transfer_logs] = await Promise.all([
        dbAll(`
          SELECT 
            id, display_id, status, total_amount, product_summary, created_at,
            (SELECT COALESCE(SUM(amount), 0) FROM finance_records WHERE order_id = orders.id AND type = 'receipt' AND status = 'completed' AND deleted_at IS NULL) as paid_amount
          FROM orders
          WHERE customer_id = ? AND deleted_at IS NULL
          ORDER BY created_at DESC
        `, [actualId]),
        dbAll(`
          SELECT
            f.id, f.type, f.amount, f.currency, f.status, f.target, f.created_at, f.remark,
            o.display_id as order_display_id, o.product_summary
          FROM finance_records f
          LEFT JOIN orders o ON o.id = f.order_id
          WHERE o.customer_id = ? AND o.deleted_at IS NULL AND f.deleted_at IS NULL
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
          WHERE o.customer_id = ? AND o.deleted_at IS NULL
          ORDER BY created_at DESC
        `, [actualId, actualId]),
        dbAll(`
          SELECT 'finance' as type, f.id, o.display_id as order_display_id, 
            CASE WHEN f.type = 'receipt' THEN '收款完成' ELSE '付款完成' END as title,
            '' as desc, f.created_at,
            CASE WHEN f.type = 'receipt' THEN '+' ELSE '-' END || f.currency || ' ' || f.amount as value,
            CASE WHEN f.type = 'receipt' THEN 'text-emerald-500' ELSE 'text-red-500' END as valueColor
          FROM finance_records f JOIN orders o ON f.order_id = o.id
          WHERE f.status = 'completed' AND o.customer_id = ? AND o.deleted_at IS NULL AND f.deleted_at IS NULL
          UNION ALL
          SELECT 'logistics' as type, l.id, o.display_id as order_display_id, 
            '物流更新' as title, '货物已发出 · ' || l.carrier as desc, l.created_at,
            CASE WHEN l.status = 'arrived' THEN '已送达' WHEN l.status = 'shipped' THEN '运输中' ELSE '备货中' END as value,
            'text-slate-500' as valueColor
          FROM logistics_records l JOIN orders o ON l.order_id = o.id
          WHERE o.customer_id = ? AND o.deleted_at IS NULL AND l.deleted_at IS NULL
          UNION ALL
          SELECT 'customs' as type, cr.id, o.display_id as order_display_id, 
            '报关完成' as title, '报关单号 ' || cr.declaration_no as desc, cr.created_at,
            '' as value, '' as valueColor
          FROM customs_records cr JOIN orders o ON cr.order_id = o.id
          WHERE o.customer_id = ? AND o.deleted_at IS NULL
          UNION ALL
          SELECT 'order' as type, o.id, o.display_id as order_display_id, 
            '新建订单' as title, o.product_summary as desc, o.created_at,
            'USD ' || o.total_amount as value,
            'text-primary-navy dark:text-white' as valueColor
          FROM orders o
          WHERE o.customer_id = ? AND o.deleted_at IS NULL
          ORDER BY 6 DESC
          LIMIT 20
        `, [actualId, actualId, actualId, actualId]),
        dbAll(`
          SELECT
            t.*,
            u.name as assignee_name,
            'CUSTOMER' as source_type,
            NULL as source_order_id,
            NULL as source_order_display_id
          FROM tasks t
          JOIN users u ON t.assignee_id = u.id
          WHERE t.entity_type = 'CUSTOMER' AND t.entity_id IN (?, ?)
          UNION ALL
          SELECT
            t.*,
            u.name as assignee_name,
            'ORDER' as source_type,
            o.id as source_order_id,
            o.display_id as source_order_display_id
          FROM tasks t
          JOIN users u ON t.assignee_id = u.id
          JOIN orders o ON t.entity_type = 'ORDER' AND t.entity_id = o.display_id
          WHERE o.customer_id = ? AND o.deleted_at IS NULL
          ORDER BY due_date ASC, created_at DESC
        `, [String(actualId), customer.display_id || String(actualId), actualId]),
        dbAll(`SELECT * FROM customer_contacts WHERE customer_id = ?`, [actualId]),
        dbAll(`
          SELECT ctl.*, fu.name AS from_user_name, tu.name AS to_user_name, bu.name AS transferred_by_name
          FROM customer_transfer_logs ctl
          LEFT JOIN users fu ON fu.id = ctl.from_user_id
          LEFT JOIN users tu ON tu.id = ctl.to_user_id
          LEFT JOIN users bu ON bu.id = ctl.transferred_by
          WHERE ctl.customer_id = ?
          ORDER BY datetime(ctl.transferred_at) DESC, ctl.id DESC
        `, [actualId])
      ]);

      res.json({ ...customer, orders, finance_records, system_activities, followups, contacts, tasks, transfer_logs });
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
    const requestedOwnerId = Number(req.body?.ownerUserId || req.body?.owner_user_id);

    if (!name || !country) {
      return fail(res, 400, '请完整填写客户名称和国家信息', 'INVALID_CUSTOMER_PAYLOAD');
    }

    try {
      // P9: Check for similar existing customer names to prevent duplicates
      const existingCustomers = await dbAll<{ name: string }[]>(`SELECT name FROM customers WHERE deleted_at IS NULL`);
      for (const existing of existingCustomers) {
        if (calculateSimilarity(name, existing.name) > 0.85) {
          return fail(res, 409, `创建失败：发现名称极度相似的已有客户 "${existing.name}"，请核对是否重复录入。`, 'CUSTOMER_DUPLICATE_SUSPECTED');
        }
      }

      const displayId = generateCustomerDisplayId();
      let ownerUserId = req.user?.id || null;
      if (req.user?.role === 'admin' && Number.isInteger(requestedOwnerId) && requestedOwnerId > 0) {
        const owner = await dbGet<{ id: number }>(`SELECT id FROM users WHERE id = ? AND active != 0`, [requestedOwnerId]);
        if (!owner) return fail(res, 400, '客户负责人无效或已停用', 'INVALID_CUSTOMER_OWNER');
        ownerUserId = owner.id;
      }
      const result = await dbRun(
        `
          INSERT INTO customers (display_id, name, country, contact, source_channel, intent_products, owner_user_id, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
        [displayId, name, country, contact, sourceChannel, intentProducts, ownerUserId, req.user?.id || null, req.user?.id || null],
      );

      const customerId = result.lastID;

      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: 'CREATE',
        entityType: 'CUSTOMER',
        entityId: customerId,
        newValue: { name, country, contact, sourceChannel, intentProducts, ownerUserId, display_id: displayId }
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
      const [scopeSql, scopeParams] = getDataScopeConstraint(req.user, 'c', 'owner_user_id');
      const customer = await dbGet(`SELECT id FROM customers c WHERE c.deleted_at IS NULL ${scopeSql} AND (c.id = ? OR c.display_id = ?)`, [...scopeParams, customerId, customerId]);
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
    const customerId = Number(req.params.id);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return fail(res, 400, '无效的客户编号', 'INVALID_CUSTOMER_ID');
    }
    const name = readString(req.body?.name);
    const country = readString(req.body?.country);
    const contact = readString(req.body?.contact);
    const sourceChannel = readString(req.body?.sourceChannel);
    const intentProducts = readString(req.body?.intentProducts);

    if (!name || !country) {
      return fail(res, 400, '请完整填写客户名称和国家信息', 'INVALID_CUSTOMER_PAYLOAD');
    }

    try {
      const [scopeSql, scopeParams] = getDataScopeConstraint(req.user, 'c', 'owner_user_id');
      const oldVal = await dbGet(`SELECT * FROM customers c WHERE c.deleted_at IS NULL ${scopeSql} AND (c.id = ? OR c.display_id = ?)`, [...scopeParams, customerId, String(req.params.id)]);
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

  router.post('/:id/transfer', requireAdmin, async (req: AuthedRequest, res) => {
    const customerId = Number(req.params.id);
    const toUserId = Number(req.body?.toUserId || req.body?.to_user_id);
    const reason = readString(req.body?.reason, 1000);
    const syncOpenOrders = req.body?.syncOpenOrders !== false;
    const syncOpenTasks = req.body?.syncOpenTasks !== false;
    if (!Number.isInteger(customerId) || customerId <= 0) return fail(res, 400, '无效的客户编号', 'INVALID_CUSTOMER_ID');
    if (!Number.isInteger(toUserId) || toUserId <= 0) return fail(res, 400, '请选择新负责人', 'INVALID_OWNER');
    if (!reason) return fail(res, 400, '请填写转交原因', 'TRANSFER_REASON_REQUIRED');

    try {
      const customer = await dbGet<{ id: number; display_id: string; name: string; owner_user_id: number | null }>(
        `SELECT id, display_id, name, owner_user_id FROM customers WHERE id = ? AND deleted_at IS NULL`,
        [customerId],
      );
      if (!customer) return fail(res, 404, '客户不存在', 'CUSTOMER_NOT_FOUND');
      if (customer.owner_user_id === toUserId) return fail(res, 409, '新负责人不能与当前负责人相同', 'SAME_OWNER');
      const toUser = await dbGet<{ id: number; name: string; active: number }>(
        `SELECT id, name, active FROM users WHERE id = ? AND active != 0`,
        [toUserId],
      );
      if (!toUser) return fail(res, 400, '新负责人无效或已停用', 'INVALID_OWNER');

      const result = await withTransaction(async (tx) => {
        await tx.run(`UPDATE customers SET owner_user_id = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [toUserId, req.user?.id || null, customer.id]);
        const log = await tx.run(
          `INSERT INTO customer_transfer_logs (customer_id, from_user_id, to_user_id, reason, sync_open_orders, sync_open_tasks, transferred_by)
           VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
          [customer.id, customer.owner_user_id || null, toUserId, reason, syncOpenOrders ? 1 : 0, syncOpenTasks ? 1 : 0, req.user?.id || null],
        );
        let ordersUpdated = 0;
        let tasksUpdated = 0;
        if (syncOpenOrders) {
          const orderUpdate = await tx.run(
            `UPDATE orders SET created_by = ?, updated_by = ? WHERE customer_id = ? AND deleted_at IS NULL AND status != 'completed'`,
            [toUserId, req.user?.id || null, customer.id],
          );
          ordersUpdated = orderUpdate.changes || 0;
        }
        if (syncOpenTasks) {
          const taskUpdate = await tx.run(
            `UPDATE tasks SET assignee_id = ? WHERE status != 'done' AND (
              (entity_type = 'CUSTOMER' AND entity_id IN (?, ?))
              OR (entity_type = 'ORDER' AND entity_id IN (SELECT display_id FROM orders WHERE customer_id = ? AND deleted_at IS NULL AND status != 'completed'))
            )`,
            [toUserId, customer.display_id || String(customer.id), String(customer.id), customer.id],
          );
          tasksUpdated = taskUpdate.changes || 0;
        }
        return { transferLogId: log.lastID, ordersUpdated, tasksUpdated };
      });

      await createNotification({
        userId: toUserId,
        title: '收到新客户',
        message: `你收到一个新客户：${customer.name}。${result.ordersUpdated} 个未完成订单、${result.tasksUpdated} 个待办任务已同步转交。`,
        link: `/customers/detail/${String(customer.display_id || customer.id).toLowerCase()}`,
      });
      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: 'UPDATE',
        entityType: 'CUSTOMER',
        entityId: customer.id,
        newValue: { action: 'transfer_customer', fromUserId: customer.owner_user_id, toUserId, reason, syncOpenOrders, syncOpenTasks, ...result },
      });
      res.json({ success: true, ...result });
    } catch (error) {
      return handleRouteError(res, error, '转交客户失败');
    }
  });

  router.delete('/:id', requireAdmin, async (req: AuthedRequest, res) => {
    const customerId = Number(req.params.id);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return fail(res, 400, '无效的客户编号', 'INVALID_CUSTOMER_ID');
    }
    try {
      const customer = await dbGet(`SELECT id FROM customers WHERE deleted_at IS NULL AND (id = ? OR display_id = ?)`, [customerId, String(req.params.id)]);
      if (!customer) return fail(res, 404, '客户不存在');

      const linkedOrders = await dbGet<{ count: number }>(`SELECT COUNT(*) AS count FROM orders WHERE customer_id = ? AND deleted_at IS NULL`, [customer.id]);
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
