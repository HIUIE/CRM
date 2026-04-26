import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin, type AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { bindAttachmentsToEntity, deleteAttachmentRows, getAttachmentsByEntity } from '../services/attachments.js';
import { readFinancePayload } from '../services/payloads.js';
import { readString } from '../lib/values.js';
import { logAction } from '../lib/audit.js';

export function createFinanceRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = readString(req.query.q);
    const startDate = readString(req.query.start_date);
    const endDate = readString(req.query.end_date);

    let whereSql = 'WHERE 1=1';
    const params: unknown[] = [];

    if (q) {
      whereSql += ` AND (o.display_id LIKE ? OR c.name LIKE ? OR p.name LIKE ? OR f.target LIKE ? OR f.remark LIKE ?)`;
      const p = `%${q}%`;
      params.push(p, p, p, p, p);
    }
    if (startDate) {
      whereSql += ` AND f.created_at >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      whereSql += ` AND f.created_at <= ?`;
      params.push(endDate);
    }

    try {
      const records = await db.all<Record<string, unknown>[]>(`
        SELECT
          f.*,
          p.name AS partner_name,
          o.display_id AS order_display_id,
          c.name AS customer_name,
          u.name AS created_by_name
        FROM finance_records f
        LEFT JOIN partners p ON p.id = f.partner_id
        LEFT JOIN orders o ON f.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN users u ON u.id = f.created_by
        ${whereSql}
        ORDER BY datetime(f.created_at) DESC, f.id DESC
      `, params);
      const attachments = await getAttachmentsByEntity('finance', records.map((record) => Number(record.id)));
      res.json(
        records.map((record) => ({
          ...record,
          recordCategory: record.record_category || record.payment_category || (record.type === 'receipt' ? 'deposit' : 'other'),
          partnerId: record.partner_id || null,
          partner_name: record.partner_name || null,
          createdByName: record.created_by_name || null,
          attachments: attachments.get(Number(record.id)) || [],
          attachmentCount: (attachments.get(Number(record.id)) || []).length,
        })),
      );
    } catch (error) {
      return handleRouteError(res, error, '读取财务数据失败');
    }
  });

  router.post('/', async (req: AuthedRequest, res) => {
    const result = await readFinancePayload(req.body || {});
    if ('error' in result) {
      return fail(res, 400, result.error, 'INVALID_FINANCE_PAYLOAD');
    }

    try {
      const created = await db.run(
        `
          INSERT INTO finance_records (order_id, type, amount, target, status, remark, currency, payment_category, record_category, partner_id, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          result.payload.orderId,
          result.payload.type,
          result.payload.amount,
          result.payload.target,
          result.payload.status,
          result.payload.remark,
          result.payload.currency,
          result.payload.paymentCategory,
          result.payload.recordCategory,
          result.payload.partnerId,
          req.user?.id || null,
          req.user?.id || null,
        ],
      );
      await bindAttachmentsToEntity('finance', created.lastID as number, result.payload.attachmentIds);

      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: 'CREATE',
        entityType: 'FINANCE',
        entityId: created.lastID,
        newValue: result.payload
      });

      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, '保存财务数据失败');
    }
  });

  router.patch('/:id', async (req: AuthedRequest, res) => {
    const recordId = Number(req.params.id);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return fail(res, 400, '财务记录编号无效', 'INVALID_FINANCE_ID');
    }

    const result = await readFinancePayload(req.body || {});
    if ('error' in result) {
      return fail(res, 400, result.error, 'INVALID_FINANCE_PAYLOAD');
    }

    try {
      const updated = await db.run(
        `
          UPDATE finance_records
          SET order_id = ?, type = ?, amount = ?, target = ?, status = ?, remark = ?, currency = ?, payment_category = ?, record_category = ?, partner_id = ?, updated_by = ?
          WHERE id = ?
        `,
        [
          result.payload.orderId,
          result.payload.type,
          result.payload.amount,
          result.payload.target,
          result.payload.status,
          result.payload.remark,
          result.payload.currency,
          result.payload.paymentCategory,
          result.payload.recordCategory,
          result.payload.partnerId,
          req.user?.id || null,
          recordId,
        ],
      );
      if (!updated.changes) {
        return fail(res, 404, '财务记录不存在', 'FINANCE_NOT_FOUND');
      }
      await bindAttachmentsToEntity('finance', recordId, result.payload.attachmentIds);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新财务记录失败');
    }
  });

  router.delete('/:id', requireAdmin, async (req: AuthedRequest, res) => {
    const recordId = Number(req.params.id);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return fail(res, 400, '财务记录编号无效', 'INVALID_FINANCE_ID');
    }

    try {
      const record = await db.get(`SELECT id, type, amount, currency FROM finance_records WHERE id = ?`, [recordId]);
      if (!record) return fail(res, 404, '财务记录不存在', 'FINANCE_NOT_FOUND');

      await deleteAttachmentRows('finance', recordId);
      const result = await db.run(`DELETE FROM finance_records WHERE id = ?`, [recordId]);
      if (!result.changes) {
        return fail(res, 404, '财务记录不存在', 'FINANCE_NOT_FOUND');
      }

      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: 'DELETE',
        entityType: 'FINANCE',
        entityId: recordId,
        oldValue: { type: record.type, amount: record.amount, currency: record.currency },
      });

      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除财务记录失败');
    }
  });

  return router;
}
