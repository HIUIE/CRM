import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin, type AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readPartnerPayload } from '../services/payloads.js';

export function createPartnersRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const partners = await db.all(`
        SELECT
          p.*,
          u.name AS created_by_name
        FROM partners p
        LEFT JOIN users u ON u.id = p.created_by
        ORDER BY datetime(p.created_at) DESC, p.id DESC
      `);
      res.json(partners);
    } catch (error) {
      return handleRouteError(res, error, '读取伙伴数据失败');
    }
  });

  router.post('/', async (req: AuthedRequest, res) => {
    const result = await readPartnerPayload(req.body || {});
    if ('error' in result) {
      return fail(res, 400, result.error, 'INVALID_PARTNER_PAYLOAD');
    }

    try {
      const created = await db.run(
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
      return fail(res, 400, result.error, 'INVALID_PARTNER_PAYLOAD');
    }

    try {
      const updated = await db.run(
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

  router.delete('/:id', requireAdmin, async (req, res) => {
    const partnerId = Number(req.params.id);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return fail(res, 400, '伙伴编号无效', 'INVALID_PARTNER_ID');
    }

    try {
      const linkedFinance = await db.get<{ count: number }>(`SELECT COUNT(*) AS count FROM finance_records WHERE partner_id = ?`, [partnerId]);
      const linkedProduction = await db.get<{ count: number }>(`SELECT COUNT(*) AS count FROM production_plans WHERE partner_id = ?`, [partnerId]);

      if ((linkedFinance?.count || 0) > 0 || (linkedProduction?.count || 0) > 0) {
        return fail(res, 409, '该伙伴已被财务或生产安排引用，暂时不能删除', 'PARTNER_IN_USE');
      }

      const deleted = await db.run(`DELETE FROM partners WHERE id = ?`, [partnerId]);
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
