import type { Express } from 'express';
import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { requireAdmin, type AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { bindAttachmentsToEntity, getAttachmentsByEntity } from '../services/attachments.js';
import { readLogisticsPayload } from '../services/payloads.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

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
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 6,
  },
});

export function createLogisticsRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const records = await db.all<Record<string, unknown>[]>(`
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
        ORDER BY
          CASE WHEN l.segment_type = 'domestic' THEN 0 ELSE 1 END ASC,
          CASE WHEN l.shipping_date IS NULL OR l.shipping_date = '' THEN 1 ELSE 0 END ASC,
          l.shipping_date DESC,
          datetime(l.created_at) DESC,
          l.id DESC
      `);
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
          createdByName: record.created_by_name || null,
          attachments: attachments.get(Number(record.id)) || [],
          attachmentCount: (attachments.get(Number(record.id)) || []).length,
        })),
      );
    } catch (error) {
      return handleRouteError(res, error, '读取物流数据失败');
    }
  });

  router.post('/', async (req: AuthedRequest, res) => {
    const result = await readLogisticsPayload(req.body || {});
    if ('error' in result) {
      return fail(res, 400, result.error, 'INVALID_LOGISTICS_PAYLOAD');
    }

    try {
      const created = await db.run(
        `
          INSERT INTO logistics_records (
            order_id, tracking_no, carrier, packing_details, status, shipping_date, segment_type,
            package_count, volume_cbm, gross_weight_kg, incoterm, transport_mode, vessel_voyage, bill_no, etd, eta,
            recipient_address, package_size, remark, created_by, updated_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          result.payload.orderId,
          result.payload.trackingNo,
          result.payload.carrier,
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
      await bindAttachmentsToEntity('logistics', created.lastID as number, result.payload.attachmentIds);
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, '保存物流数据失败');
    }
  });

  router.patch('/:id', async (req: AuthedRequest, res) => {
    const recordId = Number(req.params.id);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return fail(res, 400, '物流记录编号无效', 'INVALID_LOGISTICS_ID');
    }

    const result = await readLogisticsPayload(req.body || {});
    if ('error' in result) {
      return fail(res, 400, result.error, 'INVALID_LOGISTICS_PAYLOAD');
    }

    try {
      const updated = await db.run(
        `
          UPDATE logistics_records
          SET order_id = ?, tracking_no = ?, carrier = ?, packing_details = ?, status = ?, shipping_date = ?, segment_type = ?,
              package_count = ?, volume_cbm = ?, gross_weight_kg = ?, incoterm = ?, transport_mode = ?, vessel_voyage = ?, bill_no = ?, etd = ?, eta = ?,
              recipient_address = ?, package_size = ?, remark = ?, updated_by = ?
          WHERE id = ?
        `,
        [
          result.payload.orderId,
          result.payload.trackingNo,
          result.payload.carrier,
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
      await bindAttachmentsToEntity('logistics', recordId, result.payload.attachmentIds);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新物流记录失败');
    }
  });

  router.patch('/:id/status', async (req: AuthedRequest, res) => {
    const recordId = Number(req.params.id);
    const status = String(req.body?.status || '').trim();

    if (!Number.isInteger(recordId) || recordId <= 0) {
      return fail(res, 400, '物流记录编号无效', 'INVALID_LOGISTICS_ID');
    }
    if (!['preparing', 'shipped', 'arrived'].includes(status)) {
      return fail(res, 400, '物流状态不正确', 'INVALID_LOGISTICS_STATUS');
    }

    try {
      const result = await db.run(`UPDATE logistics_records SET status = ?, updated_by = ? WHERE id = ?`, [
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

  router.post('/attachments', upload.array('files', 6), async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) {
      return fail(res, 400, '请至少上传一个附件', 'INVALID_ATTACHMENTS');
    }

    try {
      const uploaded = [];
      for (const file of files) {
        const result = await db.run(
          `
            INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [null, null, file.originalname, file.filename, file.mimetype, file.size, `uploads/${file.filename}`],
        );
        uploaded.push({
          id: result.lastID,
          fileName: file.originalname,
          filePath: `uploads/${file.filename}`,
          url: `/uploads/${file.filename}`,
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
      const existing = await db.get<{ file_path: string }>(`SELECT file_path FROM attachments WHERE id = ?`, [attachmentId]);
      if (!existing) {
        return fail(res, 404, '附件不存在', 'ATTACHMENT_NOT_FOUND');
      }
      const fullPath = path.join(UPLOADS_DIR, path.basename(existing.file_path || ''));
      try {
        await fs.unlink(fullPath);
      } catch (_error) {
        // ignore missing physical file
      }
      await db.run(`DELETE FROM attachments WHERE id = ?`, [attachmentId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除附件失败');
    }
  });

  return router;
}
