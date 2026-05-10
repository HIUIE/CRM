import { Router } from 'express';
import { dbAll, dbGet, dbRun, SQL } from '../lib/db.js';
import { requireAdmin, requireAuth, type AuthedRequest, getDataScopeConstraint } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readPartnerPayload } from '../services/payloads.js';

export function createPartnersRouter() {
  const router = Router();

  async function canAccessPartner(req: AuthedRequest, partnerId: number) {
    const [scopeSql, scopeParams] = getDataScopeConstraint(req.user, 'p');
    const partner = await dbGet<{ id: number }>(
      `SELECT p.id FROM partners p WHERE p.id = ? AND p.deleted_at IS NULL ${scopeSql}`,
      [partnerId, ...scopeParams],
    );
    return Boolean(partner);
  }

  router.get('/', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { readPagination, buildLimitOffset } = await import('../lib/values.js');
      const params: unknown[] = [];
      const [scopeSql, scopeParams] = getDataScopeConstraint(req.user, 'p');
      params.push(...scopeParams);

      const partners = await dbAll(`
        SELECT
          p.*,
          u.name AS created_by_name
        FROM partners p
        LEFT JOIN users u ON u.id = p.created_by
        WHERE p.deleted_at IS NULL ${scopeSql}
        ORDER BY datetime(p.created_at) DESC, p.id DESC
        ${buildLimitOffset(readPagination(req.query as Record<string, unknown>), params)}
      `, params);
      res.json(partners);
    } catch (error) {
      return handleRouteError(res, error, '读取伙伴数据失败');
    }
  });

  router.post('/', requireAuth, async (req: AuthedRequest, res) => {
    const result = await readPartnerPayload(req.body || {});
    if ('error' in result) {
      return fail(res, 400, result.error!, 'INVALID_PARTNER_PAYLOAD');
    }

    try {
      const created = await dbRun(
        `
          INSERT INTO partners (name, partner_type, country, contact, contact_person, address, rating, payment_terms, remark, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
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

  router.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
    const partnerId = Number(req.params.id);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return fail(res, 400, '伙伴编号无效', 'INVALID_PARTNER_ID');
    }

    const result = await readPartnerPayload(req.body || {});
    if ('error' in result) {
      return fail(res, 400, result.error!, 'INVALID_PARTNER_PAYLOAD');
    }

    try {
      if (!(await canAccessPartner(req, partnerId))) {
        return fail(res, 404, '伙伴不存在', 'PARTNER_NOT_FOUND');
      }
      const updated = await dbRun(
        `
          UPDATE partners
          SET name = ?, partner_type = ?, country = ?, contact = ?, contact_person = ?, address = ?, rating = ?, payment_terms = ?, remark = ?, updated_by = ?
          WHERE id = ? AND deleted_at IS NULL
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

  router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
    const partnerId = Number(req.params.id);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return fail(res, 400, '伙伴编号无效', 'INVALID_PARTNER_ID');
    }

    try {
      const [scopeSql, scopeParams] = getDataScopeConstraint(req.user, 'p');
      const partner = await dbGet(`
        SELECT p.*, u.name AS created_by_name
        FROM partners p LEFT JOIN users u ON u.id = p.created_by
        WHERE p.id = ? AND p.deleted_at IS NULL ${scopeSql}
      `, [partnerId, ...scopeParams]);

      if (!partner) {
        return fail(res, 404, '伙伴不存在', 'PARTNER_NOT_FOUND');
      }

      // Data scope for staff users on related entity queries
      const [relScopeSql, relScopeParams] = getDataScopeConstraint(req.user, 'o');

      // Orders linked via production_plans (factory)
      const productionOrders = await dbAll(`
        SELECT o.id, o.display_id, o.status, COALESCE(NULLIF(o.currency, ''), 'USD') AS currency, o.total_amount, o.product_summary, o.created_at,
               pp.production_status, pp.inspection_status, pp.order_date AS prod_order_date,
               pp.estimated_delivery_date
        FROM production_plans pp
        JOIN orders o ON o.id = pp.order_id
        WHERE pp.partner_id = ?${relScopeSql}
        ORDER BY datetime(pp.created_at) DESC
      `, [partnerId, ...relScopeParams]);

      // Finance records linked to this partner
      const financeRecords = await dbAll(`
        SELECT fr.*, o.display_id AS order_display_id
        FROM finance_records fr
        LEFT JOIN orders o ON o.id = fr.order_id
        WHERE fr.partner_id = ?${relScopeSql}
        ORDER BY datetime(fr.created_at) DESC
      `, [partnerId, ...relScopeParams]);

      // Orders linked via logistics_records (forwarder)
      let logisticsRecords: any[] = [];
      try {
        logisticsRecords = await dbAll(`
          SELECT lr.*, o.display_id AS order_display_id, o.status AS order_status
          FROM logistics_records lr
          LEFT JOIN orders o ON o.id = lr.order_id
          WHERE lr.freight_forwarder_partner_id = ? AND lr.deleted_at IS NULL${relScopeSql}
          ORDER BY datetime(lr.created_at) DESC
        `, [partnerId, ...relScopeParams]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('freight_forwarder_partner_id')) {
          throw error;
        }
        logisticsRecords = [];
      }

      // Orders linked via finance_records (forwarder/customs_broker)
      const financeOrderIds = [...new Set(financeRecords.map((r: any) => r.order_id).filter(Boolean))];
      const logisticsOrderIds = [...new Set(logisticsRecords.map((r: any) => r.order_id).filter(Boolean))];
      const linkedOrderIds = [...new Set([...financeOrderIds, ...logisticsOrderIds])];
      let linkedOrders: any[] = [];
      if (linkedOrderIds.length) {
        const placeholders = linkedOrderIds.map(() => '?').join(',');
        linkedOrders = await dbAll(
          `SELECT id, display_id, status, COALESCE(NULLIF(currency, ''), 'USD') AS currency, total_amount, product_summary, created_at FROM orders WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
          linkedOrderIds,
        );
      }

      // Monthly order counts (this year)
      const thisMonth = new Date().toISOString().slice(0, 7);
      const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7);

      const monthlyStats = await dbAll(`
        SELECT ${SQL.date('pp.created_at', '%Y-%m')} AS month, COUNT(*) AS count
        FROM production_plans pp
        JOIN orders o ON o.id = pp.order_id
        WHERE pp.partner_id = ? AND o.deleted_at IS NULL${relScopeSql}
        GROUP BY month ORDER BY month DESC LIMIT 12
      `, [partnerId, ...relScopeParams]);

      const thisMonthCount = monthlyStats.find((m: any) => m.month === thisMonth)?.count || 0;
      const lastMonthCount = monthlyStats.find((m: any) => m.month === lastMonth)?.count || 0;

      // Combine all orders (production + logistics + finance-linked), deduplicate
      const allOrderMap = new Map<number, any>();
      for (const o of productionOrders) { allOrderMap.set(o.id, { ...o, linkType: 'production' }); }
      for (const o of linkedOrders) {
        const linkType = logisticsOrderIds.includes(o.id) ? 'logistics' : 'finance';
        if (!allOrderMap.has(o.id)) {
          allOrderMap.set(o.id, { ...o, linkType });
        }
      }

      const partnerContacts = await dbAll(`SELECT * FROM partner_contacts WHERE partner_id = ? ORDER BY is_primary DESC, id ASC`, [partnerId]);

      res.json({
        partner,
        contacts: partnerContacts,
        orders: [...allOrderMap.values()],
        financeRecords,
        logisticsRecords,
        summary: {
          totalOrders: allOrderMap.size,
          thisMonthCount,
          lastMonthCount,
          totalFinanceAmount: financeRecords.reduce((s: number, r: any) => s + Number(r.amount || 0), 0),
          productionCount: productionOrders.length,
          logisticsCount: logisticsRecords.length,
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

  // ==================== Partner Contacts (P8) ====================

  router.post('/:id/contacts', requireAuth, async (req: AuthedRequest, res) => {
    const partnerId = Number(req.params.id);
    const { name, title, email, phone, isPrimary, remark } = req.body;
    if (!name) return fail(res, 400, '联系人姓名不能为空');

    try {
      if (!Number.isInteger(partnerId) || partnerId <= 0 || !(await canAccessPartner(req, partnerId))) {
        return fail(res, 404, '伙伴不存在', 'PARTNER_NOT_FOUND');
      }
      if (isPrimary) {
        await dbRun(`UPDATE partner_contacts SET is_primary = false WHERE partner_id = ?`, [partnerId]);
      }
      const result = await dbRun(
        `INSERT INTO partner_contacts (partner_id, name, title, email, phone, is_primary, remark) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [partnerId, name, title, email, phone, !!isPrimary, remark]
      );
      res.status(201).json({ id: result.lastID });
    } catch (error) {
      return handleRouteError(res, error, '创建联系人失败');
    }
  });

  router.patch('/contacts/:contactId', requireAuth, async (req: AuthedRequest, res) => {
    const contactId = Number(req.params.contactId);
    const { name, title, email, phone, isPrimary, remark } = req.body;

    try {
      const existing = await dbGet<{ partner_id: number }>(`SELECT partner_id FROM partner_contacts WHERE id = ?`, [contactId]);
      if (!existing) return fail(res, 404, '联系人不存在');
      if (!(await canAccessPartner(req, existing.partner_id))) {
        return fail(res, 404, '联系人不存在', 'PARTNER_CONTACT_NOT_FOUND');
      }

      if (isPrimary) {
        await dbRun(`UPDATE partner_contacts SET is_primary = false WHERE partner_id = ?`, [existing.partner_id]);
      }

      await dbRun(
        `UPDATE partner_contacts SET name = COALESCE(?, name), title = ?, email = ?, phone = ?, is_primary = ?, remark = ? WHERE id = ?`,
        [name, title, email, phone, !!isPrimary, remark, contactId]
      );
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新联系人失败');
    }
  });

  router.delete('/contacts/:contactId', requireAuth, async (req: AuthedRequest, res) => {
    const contactId = Number(req.params.contactId);
    try {
      const existing = await dbGet<{ partner_id: number }>(`SELECT partner_id FROM partner_contacts WHERE id = ?`, [contactId]);
      if (!existing || !(await canAccessPartner(req, existing.partner_id))) {
        return fail(res, 404, '联系人不存在', 'PARTNER_CONTACT_NOT_FOUND');
      }
      await dbRun(`DELETE FROM partner_contacts WHERE id = ?`, [contactId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除联系人失败');
    }
  });

  return router;
}
