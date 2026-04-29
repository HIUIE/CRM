import type { Express } from 'express';
import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { dbAll, dbGet, dbRun } from '../lib/db.js';
import type { AuthedRequest } from '../lib/auth.js';
import { buildAttachmentUrl } from '../lib/files.js';
import { fail, handleRouteError } from '../lib/http.js';
import { UPLOADS_DIR } from '../paths.js';
import { bindAttachmentsToEntity, getAttachmentsByEntity } from '../services/attachments.js';
import { readCustomsPayload } from '../services/payloads.js';

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
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
});

function mapCustomsRecord(record: any, attachments: any[] = []) {
  return {
    id: record.id,
    orderId: record.order_id,
    status: record.status,
    brokerName: record.broker_name,
    declarationNo: record.declaration_no,
    declarationDate: record.declaration_date,
    releaseDate: record.release_date,
    tradeMode: record.trade_mode,
    remark: record.remark,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    createdByName: record.created_by_name || null,
    attachments,
    attachmentCount: attachments.length,
  };
}

export function createCustomsRouter() {
  const router = Router();

  router.get('/orders/:id/customs', async (req, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return fail(res, 400, '订单编号无效', 'INVALID_ORDER_ID');
    }

    try {
      const record = await dbGet<Record<string, unknown>>(
        `
          SELECT
            c.*,
            u.name AS created_by_name
          FROM customs_records c
          LEFT JOIN users u ON u.id = c.created_by
          WHERE c.order_id = ?
          LIMIT 1
        `,
        [orderId],
      );
      if (!record) {
        return res.json(null);
      }
      const attachments = await getAttachmentsByEntity('customs', [Number(record.id)]);
      const attList = attachments.get(Number(record.id)) || [];
      res.json(mapCustomsRecord(record, attList));
    } catch (error) {
      return handleRouteError(res, error, '读取报关信息失败');
    }
  });

  router.post('/orders/:id/customs', async (req: AuthedRequest, res) => {
    const orderId = Number(req.params.id);
    const result = await readCustomsPayload({ ...(req.body || {}), orderId });
    if ('error' in result) {
      return fail(res, 400, result.error!, 'INVALID_CUSTOMS_PAYLOAD');
    }

    try {
      const existing = await dbGet<{ id: number }>(`SELECT id FROM customs_records WHERE order_id = ?`, [orderId]);
      if (existing) {
        return fail(res, 409, '该订单已有报关信息，请直接编辑', 'CUSTOMS_ALREADY_EXISTS');
      }
      const created = await dbRun(
        `
          INSERT INTO customs_records (order_id, status, broker_name, declaration_no, declaration_date, release_date, trade_mode, remark, created_by, updated_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          RETURNING id
        `,
        [
          result.payload.orderId,
          result.payload.status,
          result.payload.brokerName,
          result.payload.declarationNo,
          result.payload.declarationDate || null,
          result.payload.releaseDate || null,
          result.payload.tradeMode,
          result.payload.remark,
          req.user?.id || null,
          req.user?.id || null,
        ],
      );
      await bindAttachmentsToEntity('customs', created.lastID as number, result.payload.attachmentIds);
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, '保存报关信息失败');
    }
  });

  router.patch('/customs/:id', async (req: AuthedRequest, res) => {
    const customsId = Number(req.params.id);
    if (!Number.isInteger(customsId) || customsId <= 0) {
      return fail(res, 400, '报关记录编号无效', 'INVALID_CUSTOMS_ID');
    }

    const existing = await dbGet<{ order_id: number }>(`SELECT order_id FROM customs_records WHERE id = ?`, [customsId]);
    if (!existing) {
      return fail(res, 404, '报关记录不存在', 'CUSTOMS_NOT_FOUND');
    }

    const result = await readCustomsPayload({ ...(req.body || {}), orderId: existing.order_id });
    if ('error' in result) {
      return fail(res, 400, result.error!, 'INVALID_CUSTOMS_PAYLOAD');
    }

    try {
      await dbRun(
        `
          UPDATE customs_records
          SET status = ?, broker_name = ?, declaration_no = ?, declaration_date = ?, release_date = ?, trade_mode = ?, remark = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          result.payload.status,
          result.payload.brokerName,
          result.payload.declarationNo,
          result.payload.declarationDate || null,
          result.payload.releaseDate || null,
          result.payload.tradeMode,
          result.payload.remark,
          req.user?.id || null,
          customsId,
        ],
      );
      await bindAttachmentsToEntity('customs', customsId, result.payload.attachmentIds);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新报关信息失败');
    }
  });

  router.post('/customs/:id/attachments', upload.array('files', 6), async (req, res) => {
    const customsId = Number(req.params.id);
    if (!Number.isInteger(customsId) || customsId <= 0) {
      return fail(res, 400, '报关记录编号无效', 'INVALID_CUSTOMS_ID');
    }

    const existing = await dbGet<{ id: number }>(`SELECT id FROM customs_records WHERE id = ?`, [customsId]);
    if (!existing) {
      return fail(res, 404, '报关记录不存在', 'CUSTOMS_NOT_FOUND');
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) {
      return fail(res, 400, '请至少上传一个附件', 'INVALID_ATTACHMENTS');
    }

    try {
      const uploaded = [];
      for (const file of files) {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const result = await dbRun(
          `
            INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          ['customs', customsId, originalName, file.filename, file.mimetype, file.size, file.filename],
        );
        uploaded.push({
          id: result.lastID,
          fileName: originalName,
          filePath: file.filename,
          storedName: file.filename,
          url: buildAttachmentUrl(result.lastID as number, file.filename),
          mimeType: file.mimetype,
          fileSize: file.size,
        });
      }

      res.status(201).json(uploaded);
    } catch (error) {
      return handleRouteError(res, error, '上传报关附件失败');
    }
  });

  return router;
}
