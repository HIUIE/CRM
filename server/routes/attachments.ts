import type { Express } from 'express';
import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { requireAdmin } from '../lib/auth.js';
import { buildAttachmentUrl, resolveAttachmentAbsolutePath } from '../lib/files.js';
import { fail, handleRouteError } from '../lib/http.js';
import { UPLOADS_DIR } from '../paths.js';

function sanitizePathSegment(value: unknown, fallback: string) {
  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return normalized || fallback;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, callback) => {
      const customerId = sanitizePathSegment(req.body.customerId, 'general');
      const orderId = sanitizePathSegment(req.body.orderId, 'misc');
      const targetDir = path.join(UPLOADS_DIR, `customer_${customerId}`, `order_${orderId}`);
      try {
        await fs.mkdir(targetDir, { recursive: true });
        callback(null, targetDir);
      } catch (error) {
        callback(error as Error, targetDir);
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

export function createAttachmentsRouter() {
  const router = Router();

  router.post('/', upload.array('files', 6), async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    const customerId = sanitizePathSegment(req.body.customerId, 'general');
    const orderId = sanitizePathSegment(req.body.orderId, 'misc');

    if (!files.length) {
      return fail(res, 400, '请至少上传一个附件', 'INVALID_ATTACHMENTS');
    }

    try {
      const uploaded = [];
      const entityType = req.body.entityType || null;
      const entityId = req.body.entityId || null;
      const remark = req.body.remark || null;

      for (const file of files) {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const relativePath = path.posix.join(`customer_${customerId}`, `order_${orderId}`, file.filename);
        const result = await db.run(
          `
            INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path, remark)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [entityType, entityId, originalName, file.filename, file.mimetype, file.size, relativePath, remark],
        );
        uploaded.push({
          id: result.lastID,
          fileName: originalName,
          filePath: relativePath,
          storedName: file.filename,
          url: buildAttachmentUrl(result.lastID as number, file.filename),
          mimeType: file.mimetype,
          fileSize: file.size,
          remark: remark,
        });
      }
      res.status(201).json(uploaded);
    } catch (error) {
      return handleRouteError(res, error, '附件上传失败');
    }
  });

  router.delete('/:id', requireAdmin, async (req, res) => {
    const attachmentId = Number(req.params.id);
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return fail(res, 400, '附件编号无效', 'INVALID_ATTACHMENT_ID');
    }

    try {
      const existing = await db.get<{ file_path: string }>(`SELECT file_path FROM attachments WHERE id = ?`, [attachmentId]);
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
      await db.run(`DELETE FROM attachments WHERE id = ?`, [attachmentId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '删除附件失败');
    }
  });

  return router;
}
