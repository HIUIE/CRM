import fs from 'fs/promises';
import { Router } from 'express';
import { dbGet } from '../lib/db.js';
import { getStoredNameFromRecord, isSafeStoredName, resolveAttachmentAbsolutePath, sanitizeDownloadFilename } from '../lib/files.js';
import { fail, handleRouteError } from '../lib/http.js';
import type { AuthedRequest } from '../lib/auth.js';

async function canAccessEntity(user: AuthedRequest['user'], entityType: string, entityId: string): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'admin') return true;
  // Staff users: verify they own or are assigned the linked entity
  const scopeQueries: Record<string, string> = {
    ORDER: `SELECT 1 FROM orders WHERE display_id = ? AND created_by = ? AND deleted_at IS NULL`,
    CUSTOMER: `SELECT 1 FROM customers WHERE display_id = ? AND created_by = ? AND deleted_at IS NULL`,
    FINANCE: `SELECT 1 FROM finance_records f LEFT JOIN orders o ON o.id = f.order_id WHERE f.id = ? AND (f.created_by = ? OR o.created_by = ?)`,
    LOGISTICS: `SELECT 1 FROM logistics_records l LEFT JOIN orders o ON o.id = l.order_id WHERE l.id = ? AND (l.created_by = ? OR o.created_by = ?)`,
    CUSTOMS: `SELECT 1 FROM customs_records c LEFT JOIN orders o ON o.id = c.order_id WHERE c.id = ? AND (c.created_by = ? OR o.created_by = ?)`,
    PRODUCTION: `SELECT 1 FROM production_plans pp LEFT JOIN orders o ON o.id = pp.order_id WHERE pp.id = ? AND (pp.created_by = ? OR o.created_by = ?)`,
    TASK: `SELECT 1 FROM tasks WHERE id = ? AND (created_by = ? OR assignee_id = ?)`,
  };
  const upperType = entityType.toUpperCase();
  const sql = scopeQueries[upperType];
  if (!sql) return false; // Unknown entity types — deny
  const row = await dbGet<{ 1: number }>(sql, [entityId, user.id, user.id]);
  return Boolean(row);
}

async function verifyEntityExists(entityType: string, entityId: string): Promise<boolean> {
  const queries: Record<string, string> = {
    ORDER: `SELECT 1 FROM orders WHERE display_id = ? AND deleted_at IS NULL`,
    CUSTOMER: `SELECT 1 FROM customers WHERE display_id = ? AND deleted_at IS NULL`,
    FINANCE: `SELECT 1 FROM finance_records WHERE id = ?`,
    LOGISTICS: `SELECT 1 FROM logistics_records WHERE id = ?`,
    CUSTOMS: `SELECT 1 FROM customs_records WHERE id = ?`,
    PRODUCTION: `SELECT 1 FROM production_plans WHERE id = ?`,
    PACKING: `SELECT 1 FROM packing_records WHERE id = ?`,
    TASK: `SELECT 1 FROM tasks WHERE id = ? AND deleted_at IS NULL`,
  };
  const sql = queries[entityType.toUpperCase()];
  if (!sql) return true; // Unknown entity types pass through — not a security boundary
  const row = await dbGet<{ 1: number }>(sql, [entityId]);
  return Boolean(row);
}

export function createFilesRouter() {
  const router = Router();

  router.get('/:id/:storedName', async (req, res) => {
    const attachmentId = Number(req.params.id);
    const storedName = String(req.params.storedName || '').trim();
    const authUser = (req as AuthedRequest).user;

    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return fail(res, 400, '附件编号无效', 'INVALID_ATTACHMENT_ID');
    }
    if (!isSafeStoredName(storedName)) {
      return fail(res, 400, '文件名参数非法', 'INVALID_FILE_NAME');
    }

    try {
      const attachment = await dbGet<{
        file_name: string;
        stored_name: string | null;
        mime_type: string | null;
        file_path: string;
        entity_type: string | null;
        entity_id: string | null;
      }>(`SELECT file_name, stored_name, mime_type, file_path, entity_type, entity_id FROM attachments WHERE id = ?`, [attachmentId]);

      if (!attachment) {
        return fail(res, 404, '附件不存在', 'ATTACHMENT_NOT_FOUND');
      }

      const actualStoredName = getStoredNameFromRecord(attachment.stored_name, attachment.file_path);
      if (actualStoredName !== storedName) {
        return fail(res, 404, '附件不存在', 'ATTACHMENT_NOT_FOUND');
      }

      const absolutePath = resolveAttachmentAbsolutePath(attachment.file_path);
      if (!absolutePath) {
        return fail(res, 404, '附件不存在', 'ATTACHMENT_NOT_FOUND');
      }

      if (attachment.entity_type && attachment.entity_id && !(await canAccessEntity(authUser, attachment.entity_type, attachment.entity_id))) {
        return fail(res, 403, '无权访问此附件', 'ATTACHMENT_ACCESS_DENIED');
      }

      // Verify the linked entity still exists and is not soft-deleted
      if (attachment.entity_type && attachment.entity_id) {
        const entityExists = await verifyEntityExists(attachment.entity_type, attachment.entity_id);
        if (!entityExists) {
          return fail(res, 404, '附件关联的记录不存在或已删除', 'ATTACHMENT_ENTITY_DELETED');
        }
      }

      await fs.access(absolutePath);
      const originalFileName = attachment.file_name || actualStoredName;
      const fallbackName = sanitizeDownloadFilename(originalFileName);

      res.setHeader(
        'Content-Disposition',
        `inline; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(originalFileName)}`,
      );
      res.type(attachment.mime_type || 'application/octet-stream');
      res.sendFile(absolutePath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return fail(res, 404, '附件不存在', 'ATTACHMENT_NOT_FOUND');
      }
      return handleRouteError(res, error, '读取附件失败');
    }
  });

  return router;
}
