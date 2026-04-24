import type { Express } from 'express';
import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { requireAdmin } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, callback) => {
      const customerId = req.body.customerId || 'general';
      const orderId = req.body.orderId || 'misc';
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
    const customerId = req.body.customerId || 'general';
    const orderId = req.body.orderId || 'misc';

    if (!files.length) {
      return fail(res, 400, '请至少上传一个附件', 'INVALID_ATTACHMENTS');
    }

    try {
      const uploaded = [];
      for (const file of files) {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const relativePath = `uploads/customer_${customerId}/order_${orderId}/${file.filename}`;
        const result = await db.run(
          `
            INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [null, null, originalName, file.filename, file.mimetype, file.size, relativePath],
        );
        uploaded.push({
          id: result.lastID,
          fileName: originalName,
          filePath: relativePath,
          url: `/${relativePath}`,
          mimeType: file.mimetype,
          fileSize: file.size,
        });
      }
      res.status(201).json(uploaded);
    } catch (error) {
      return handleRouteError(res, error, '附件上传失败');
    }
  });

  router.get('/download-direct/:id', async (req, res) => {
    const attachmentId = Number(req.params.id);
    try {
      const attachment = await db.get<{ file_path: string; mime_type: string }>(
        `SELECT file_path, mime_type FROM attachments WHERE id = ?`,
        [attachmentId]
      );
      if (!attachment || !attachment.file_path) return res.status(404).end();
      const fullPath = path.join(__dirname, '..', '..', attachment.file_path);
      res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
      res.sendFile(fullPath);
    } catch (error) {
      res.status(500).end();
    }
  });

  router.delete('/:id', async (req, res) => {
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
