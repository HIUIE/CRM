import { Router } from 'express';
import { dbAll, dbGet, dbRun, SQL } from '../lib/db.js';
import { requireAdmin, type AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readPartnerPayload } from '../services/payloads.js';

export function createPartnersRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const { readPagination, buildLimitOffset } = await import('../lib/values.js');
      const partners = await dbAll(`
        SELECT
          p.*,
          u.name AS created_by_name
        FROM partners p
        LEFT JOIN users u ON u.id = p.created_by
        WHERE p.deleted_at IS NULL
        ORDER BY datetime(p.created_at) DESC, p.id DESC
        ${buildLimitOffset(readPagination(req.query as Record<string, unknown>))}
      `);
      res.json(partners);
    } catch (error) {
      return handleRouteError(res, error, '读取伙伴数据失败');
    }
  });

  router.post('/', async (req: AuthedRequest, res) => {
    const result = await readPartnerPayload(req.body || {});
    if ('error' in result) {
      return fail(res, 400, result.error!, 'INVALID_PARTNER_PAYLOAD');
    }

    try {
      const created = await dbRun(
        `
          INSERT INTO partners (name, partner_type, country, contact, contact_person, address, rating, payment_terms, remark, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          result.payload.name,
          result.payload.partnerType,
          result.payload.country,
          result.payload.contact,
          result.payload.contactPerson,
          result.payload.address,
          result.payload.rating,
          result.payload.paymentTerms,
          result.payload.remark,
          req.user?.id || null,
          req.user?.id || null,
        ],
      );
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, '创建伙伴失败');
    }
  });

  router.patch('/:id', async (req: AuthedRequest, res) => {
    const partnerId = Number(req.params.id);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return fail(res, 400, '伙伴编号无效', 'INVALID_PARTNER_ID');
    }

    const result = await readPartnerPayload(req.body || {});
    if ('error' in result) {
      return fail(res, 400, result.error!, 'INVALID_PARTNER_PAYLOAD');
    }

    try {
      const updated = await dbRun(
        `
          UPDATE partners
          SET name = ?, partner_type = ?, country = ?, contact = ?, contact_person = ?, address = ?, rating = ?, payment_terms = ?, remark = ?, updated_by = ?
          WHERE id = ?
        `,
        [
          result.payload.name,
          result.payload.partnerType,
          result.payload.country,
          result.payload.contact,
          result.payload.contactPerson,
          result.payload.address,
          result.payload.rating,
          result.payload.paymentTerms,
          result.payload.remark,
          req.user?.id || null,
          partnerId,
        ],
      );
      if (!updated.changes) {
        return fail(res, 404, '伙伴不存在', 'PARTNER_NOT_FOUND');
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新伙伴失败');
    }
  });

  router.get('/:id', async (req: AuthedRequest, res) => {
    const partnerId = Number(req.params.id);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return fail(res, 400, '伙伴编号无效', 'INVALID_PARTNER_ID');
    }

    try {
      const partner = await dbGet(`
        SELECT p.*, u.name AS created_by_name
        FROM partners p LEFT JOIN users u ON u.id = p.created_by
        WHERE p.id = ?
      `, [partnerId]);

      if (!partner) {
        return fail(res, 404, '伙伴不存在', 'PARTNER_NOT_FOUND');
      }

      // Orders linked via production_plans (factory)
      const productionOrders = await dbAll(`
        SELECT o.id, o.display_id, o.status, o.total_amount, o.product_summary, o.created_at,
               pp.production_status, pp.inspection_status, pp.order_date AS prod_order_date,
               pp.estimated_delivery_date
        FROM production_plans pp
        JOIN orders o ON o.id = pp.order_id
        WHERE pp.partner_id = ?
        ORDER BY datetime(pp.created_at) DESC
      `, [partnerId]);

      // Finance records linked to this partner
      const financeRecords = await dbAll(`
        SELECT fr.*, o.display_id AS order_display_id
        FROM finance_records fr
        LEFT JOIN orders o ON o.id = fr.order_id
        WHERE fr.partner_id = ?
        ORDER BY datetime(fr.created_at) DESC
      `, [partnerId]);

      // Orders linked via finance_records (forwarder/customs_broker)
      const financeOrderIds = [...new Set(financeRecords.map((r: any) => r.order_id).filter(Boolean))];
      let financeOrders: any[] = [];
      if (financeOrderIds.length) {
        financeOrders = await dbAll(
          `SELECT id, display_id, status, total_amount, product_summary, created_at FROM orders WHERE id IN (${financeOrderIds.join(',')})`
        );
      }

      // Monthly order counts (this year)
      const thisMonth = new Date().toISOString().slice(0, 7);
      const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7);

      const monthlyStats = await dbAll(`
        SELECT ${SQL.date('pp.created_at', '%Y-%m')} AS month, COUNT(*) AS count
        FROM production_plans pp
        WHERE pp.partner_id = ?
        GROUP BY month ORDER BY month DESC LIMIT 12
      `, [partnerId]);

      const thisMonthCount = monthlyStats.find((m: any) => m.month === thisMonth)?.count || 0;
      const lastMonthCount = monthlyStats.find((m: any) => m.month === lastMonth)?.count || 0;

      // Combine all orders (production + finance-linked), deduplicate
      const allOrderMap = new Map<number, any>();
      for (const o of productionOrders) { allOrderMap.set(o.id, { ...o, linkType: 'production' }); }
      for (const o of financeOrders) {
        if (!allOrderMap.has(o.id)) {
          allOrderMap.set(o.id, { ...o, linkType: 'finance' });
        }
      }

      res.json({
        partner,
        orders: [...allOrderMap.values()],
        financeRecords,
        summary: {
          totalOrders: allOrderMap.size,
          thisMonthCount,
          lastMonthCount,
          totalFinanceAmount: financeRecords.reduce((s: number, r: any) => s + Number(r.amount || 0), 0),
          productionCount: productionOrders.length,
        },
      });
    } catch (error) {
      return handleRouteError(res, error, '读取伙伴详情失败');
    }
  });

  router.delete('/:id', requireAdmin, async (req, res) => {
    const partnerId = Number(req.params.id);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return fail(res, 400, '伙伴编号无效', 'INVALID_PARTNER_ID');
    }

    try {
      const linkedFinance = await dbGet<{ count: number }>(`SELECT COUNT(*) AS count FROM finance_records WHERE partner_id = ?`, [partnerId]);
      const linkedProduction = await dbGet<{ count: number }>(`SELECT COUNT(*) AS count FROM production_plans WHERE partner_id = ?`, [partnerId]);

      if ((linkedFinance?.count || 0) > 0 || (linkedProduction?.count || 0) > 0) {
        return fail(res, 409, '该伙伴已被财务或生产安排引用，暂时不能删除', 'PARTNER_IN_USE');
      }

      const deleted = await dbRun(`UPDATE partners SET deleted_at = ${SQL.now()} WHERE id = ?`, [partnerId]);
      if (!deleted.changes) {
        return fail(res, 404, '伙伴不存在', 'PARTNER_NOT_FOUND');
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除伙伴失败');
    }
  });

  return router;
}
