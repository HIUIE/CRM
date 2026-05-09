import type { Express } from 'express';
import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { dbAll, dbGet, dbRun } from '../lib/db.js';
import { checkOrderAccess, requireAdmin, requireAuth, type AuthedRequest } from '../lib/auth.js';
import { buildAttachmentUrl, resolveAttachmentAbsolutePath, validateFileMagicBytes } from '../lib/files.js';
import { fail, handleRouteError } from '../lib/http.js';
import { UPLOADS_DIR } from '../paths.js';
import { bindAttachmentsToEntity, getAttachmentsByEntity, deleteAttachmentRows } from '../services/attachments.js';
import { readLogisticsPayload } from '../services/payloads.js';
import { readString, readPagination, buildLimitOffset } from '../lib/values.js';

// Allowed MIME types for upload (whitelist approach)
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/msword',
  'text/csv',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, callback) => {
      try {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        callback(null, UPLOADS_DIR);
      } catch (error) {
        callback(error as Error, UPLOADS_DIR);
      }
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname || '');
      callback(null, `${Date.now()}-${randomUUID()}${extension}`);
    },
  }),
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new Error('不支持上传此类型的文件'));
      return;
    }
    callback(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 6,
  },
});

export function createLogisticsRouter() {
  const router = Router();
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const q = readString(req.query.q);
  const status = readString(req.query.status);
  const startDate = readString(req.query.start_date);
  const endDate = readString(req.query.end_date);

  let whereSql = 'WHERE l.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL)';
  const params: (string | number | null | undefined)[] = [];

  if (req.user?.role !== 'admin') {
    whereSql += ' AND (l.created_by = ? OR o.created_by = ?)';
    params.push(req.user?.id, req.user?.id);
  }

  if (q) {
    whereSql += ` AND (o.display_id LIKE ? OR l.carrier LIKE ? OR l.tracking_no LIKE ? OR c.name LIKE ?)`;
    const p = `%${q}%`;
    params.push(p, p, p, p);
  }
  if (status) {
    whereSql += ` AND l.status = ?`;
    params.push(status);
  }
  const filterDateExpr = `COALESCE(NULLIF(l.shipping_date, ''), date(l.created_at)::text)`;
  if (startDate) {
    whereSql += ` AND ${filterDateExpr} >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    whereSql += ` AND ${filterDateExpr} <= ?`;
    params.push(endDate);
  }

    try {
      const records = await dbAll<Record<string, unknown>[]>(`
        SELECT
          l.*,
          o.display_id AS order_display_id,
          o.status AS order_status,
          c.name AS customer_name,
          u.name AS created_by_name
        FROM logistics_records l
        LEFT JOIN orders o ON l.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN users u ON u.id = l.created_by
        ${whereSql}
        ORDER BY
          COALESCE(NULLIF(l.shipping_date, ''), date(l.created_at)::text) DESC,
          datetime(l.created_at) DESC,
          CASE WHEN l.segment_type = 'domestic' THEN 0 ELSE 1 END ASC
        ${buildLimitOffset(readPagination(req.query as Record<string, unknown>), params)}
      `, params);
      const attachments = await getAttachmentsByEntity('logistics', records.map((record) => Number(record.id)));
      res.json(
        records.map((record) => ({
          ...record,
          segmentType: record.segment_type || 'international',
          packageCount: record.package_count,
          volumeCbm: record.volume_cbm,
          grossWeightKg: record.gross_weight_kg,
          transportMode: record.transport_mode,
          vesselVoyage: record.vessel_voyage,
          billNo: record.bill_no,
          trackingHistory: record.tracking_history || [],
          lastTrackedAt: record.last_tracked_at,
          createdByName: record.created_by_name || null,
          attachments: attachments.get(Number(record.id)) || [],
          attachmentCount: (attachments.get(Number(record.id)) || []).length,
        })),
      );
    } catch (error) {
      return handleRouteError(res, error, '读取物流数据失败');
    }
  });

  router.post('/', requireAuth, async (req: AuthedRequest, res) => {
    const result = await readLogisticsPayload(req.body || {});
    if ('error' in result) {
      return fail(res, 400, result.error!, 'INVALID_LOGISTICS_PAYLOAD');
    }

    try {
      if (!(await checkOrderAccess(req, result.payload.orderId))) {
        return fail(res, 404, '订单不存在或无权访问', 'ORDER_NOT_FOUND');
      }
      const created = await dbRun(
        `
          INSERT INTO logistics_records (
            order_id, tracking_no, carrier, freight_forwarder, freight_forwarder_partner_id, packing_details, status, shipping_date, segment_type,
            package_count, volume_cbm, gross_weight_kg, incoterm, transport_mode, vessel_voyage, bill_no, etd, eta,
            recipient_address, package_size, remark, created_by, updated_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
        [
          result.payload.orderId,
          result.payload.trackingNo,
          result.payload.carrier,
          result.payload.freightForwarder,
          result.payload.freightForwarderPartnerId,
          result.payload.packingDetails,
          result.payload.status,
          result.payload.shippingDate || null,
          result.payload.segmentType,
          result.payload.packageCount,
          result.payload.volumeCbm,
          result.payload.grossWeightKg,
          result.payload.incoterm,
          result.payload.transportMode,
          result.payload.vesselVoyage,
          result.payload.billNo,
          result.payload.etd || null,
          result.payload.eta || null,
          result.payload.recipientAddress,
          result.payload.packageSize,
          result.payload.remark,
          req.user?.id || null,
          req.user?.id || null,
        ],
      );
      await bindAttachmentsToEntity('logistics', created.lastID as number, result.payload.attachmentIds, req.user);
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, '保存物流数据失败');
    }
  });

  router.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
    const recordId = Number(req.params.id);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return fail(res, 400, '物流记录编号无效', 'INVALID_LOGISTICS_ID');
    }

    const result = await readLogisticsPayload(req.body || {});
    if ('error' in result) {
      return fail(res, 400, result.error!, 'INVALID_LOGISTICS_PAYLOAD');
    }

    try {
      const existing = await dbGet<{ order_id: number }>(`SELECT order_id FROM logistics_records WHERE id = ? AND deleted_at IS NULL`, [recordId]);
      if (!existing) {
        return fail(res, 404, '物流记录不存在', 'LOGISTICS_NOT_FOUND');
      }
      if (!(await checkOrderAccess(req, existing.order_id)) || !(await checkOrderAccess(req, result.payload.orderId))) {
        return fail(res, 404, '订单不存在或无权访问', 'ORDER_NOT_FOUND');
      }
      const updated = await dbRun(
        `
          UPDATE logistics_records
          SET order_id = ?, tracking_no = ?, carrier = ?, freight_forwarder = ?, freight_forwarder_partner_id = ?, packing_details = ?, status = ?, shipping_date = ?, segment_type = ?,
              package_count = ?, volume_cbm = ?, gross_weight_kg = ?, incoterm = ?, transport_mode = ?, vessel_voyage = ?, bill_no = ?, etd = ?, eta = ?,
              recipient_address = ?, package_size = ?, remark = ?, updated_by = ?
          WHERE id = ?
        `,
        [
          result.payload.orderId,
          result.payload.trackingNo,
          result.payload.carrier,
          result.payload.freightForwarder,
          result.payload.freightForwarderPartnerId,
          result.payload.packingDetails,
          result.payload.status,
          result.payload.shippingDate || null,
          result.payload.segmentType,
          result.payload.packageCount,
          result.payload.volumeCbm,
          result.payload.grossWeightKg,
          result.payload.incoterm,
          result.payload.transportMode,
          result.payload.vesselVoyage,
          result.payload.billNo,
          result.payload.etd || null,
          result.payload.eta || null,
          result.payload.recipientAddress,
          result.payload.packageSize,
          result.payload.remark,
          req.user?.id || null,
          recordId,
        ],
      );
      if (!updated.changes) {
        return fail(res, 404, '物流记录不存在', 'LOGISTICS_NOT_FOUND');
      }
      await bindAttachmentsToEntity('logistics', recordId, result.payload.attachmentIds, req.user);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新物流记录失败');
    }
  });

  router.patch('/:id/status', requireAuth, async (req: AuthedRequest, res) => {
    const recordId = Number(req.params.id);
    const status = String(req.body?.status || '').trim();

    if (!Number.isInteger(recordId) || recordId <= 0) {
      return fail(res, 400, '物流记录编号无效', 'INVALID_LOGISTICS_ID');
    }
    if (!['preparing', 'shipped', 'arrived'].includes(status)) {
      return fail(res, 400, '物流状态不正确', 'INVALID_LOGISTICS_STATUS');
    }

    try {
      const existing = await dbGet<{ order_id: number }>(`SELECT order_id FROM logistics_records WHERE id = ? AND deleted_at IS NULL`, [recordId]);
      if (!existing) {
        return fail(res, 404, '物流记录不存在', 'LOGISTICS_NOT_FOUND');
      }
      if (!(await checkOrderAccess(req, existing.order_id))) {
        return fail(res, 404, '物流记录不存在或无权访问', 'LOGISTICS_NOT_FOUND');
      }
      const result = await dbRun(`UPDATE logistics_records SET status = ?, updated_by = ? WHERE id = ?`, [
        status,
        req.user?.id || null,
        recordId,
      ]);
      if (!result.changes) {
        return fail(res, 404, '物流记录不存在', 'LOGISTICS_NOT_FOUND');
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新物流状态失败');
    }
  });

  router.post('/:id/track', requireAuth, async (req: AuthedRequest, res) => {
    const recordId = Number(req.params.id);
    try {
      const record = await dbGet<{ tracking_no: string; carrier: string; order_id: number }>(`SELECT tracking_no, carrier, order_id FROM logistics_records WHERE id = ? AND deleted_at IS NULL`, [recordId]);
      if (!record || !record.tracking_no) return fail(res, 400, '暂无运单号，无法追踪');
      if (!(await checkOrderAccess(req, record.order_id))) {
        return fail(res, 404, '物流记录不存在或无权访问', 'LOGISTICS_NOT_FOUND');
      }

      // P14: Simulate track result (Mock 17track / Aftership integration)
      const mockHistory = [
        { time: new Date().toISOString(), status: '已起运', location: '起运港' },
        { time: new Date(Date.now() - 86400000).toISOString(), status: '集货中', location: '前置仓' }
      ];

      await dbRun(
        `UPDATE logistics_records SET tracking_history = ?, last_tracked_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [JSON.stringify(mockHistory), recordId]
      );
      res.json({ success: true, history: mockHistory });
    } catch (error) {
      return handleRouteError(res, error, '追踪轨迹失败');
    }
  });

  router.post('/attachments', requireAuth, upload.array('files', 6), async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) {
      return fail(res, 400, '请至少上传一个附件', 'INVALID_ATTACHMENTS');
    }

    try {
      const uploaded = [];
      for (const file of files) {
        const magicValid = await validateFileMagicBytes(file.path, file.mimetype);
        if (!magicValid) {
          await fs.unlink(file.path).catch(() => {});
          return fail(res, 400, `文件类型不匹配: ${file.originalname}`, 'FILE_MAGIC_MISMATCH');
        }
        const result = await dbRun(
          `
            INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
          `,
          [null, null, file.originalname, file.filename, file.mimetype, file.size, file.filename, (req as AuthedRequest).user?.id || null],
        );
        uploaded.push({
          id: result.lastID,
          fileName: file.originalname,
          filePath: file.filename,
          storedName: file.filename,
          url: buildAttachmentUrl(result.lastID as number, file.filename),
          mimeType: file.mimetype,
          fileSize: file.size,
        });
      }
      res.status(201).json(uploaded);
    } catch (error) {
      return handleRouteError(res, error, '附件上传失败');
    }
  });

  router.delete('/attachments/:id', requireAdmin, async (req, res) => {
    const attachmentId = Number(req.params.id);
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return fail(res, 400, '附件编号无效', 'INVALID_ATTACHMENT_ID');
    }

    try {
      const existing = await dbGet<{ file_path: string }>(`SELECT file_path FROM attachments WHERE id = ?`, [attachmentId]);
      if (!existing) {
        return fail(res, 404, '附件不存在', 'ATTACHMENT_NOT_FOUND');
      }
      const fullPath = resolveAttachmentAbsolutePath(existing.file_path);
      if (fullPath) {
        try {
          await fs.unlink(fullPath);
        } catch (_error) {
          // ignore missing physical file
        }
      }
      await dbRun(`DELETE FROM attachments WHERE id = ?`, [attachmentId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除附件失败');
    }
  });

  router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    const recordId = Number(req.params.id);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return fail(res, 400, '物流记录编号无效', 'INVALID_LOGISTICS_ID');
    }

    try {
      const existing = await dbGet<{ id: number }>(`SELECT id FROM logistics_records WHERE id = ?`, [recordId]);
      if (!existing) {
        return fail(res, 404, '物流记录不存在', 'LOGISTICS_NOT_FOUND');
      }

      await deleteAttachmentRows('logistics', recordId);
      await dbRun(`DELETE FROM logistics_records WHERE id = ?`, [recordId]);

      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除物流记录失败');
    }
  });

  return router;
}
