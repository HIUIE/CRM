import fs from 'fs/promises';
import { Router } from 'express';
import { dbGet } from '../lib/db.js';
import { logAction } from '../lib/audit.js';
import { getStoredNameFromRecord, isSafeStoredName, resolveAttachmentAbsolutePath, sanitizeDownloadFilename } from '../lib/files.js';
import { fail, handleRouteError } from '../lib/http.js';
import type { AuthedRequest } from '../lib/auth.js';

async function canAccessEntity(user: AuthedRequest['user'], entityType: string, entityId: string): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'admin') return true;
  // Staff users: verify they own or are assigned the linked entity
  const scopeQueries: Record<string, string> = {
    ORDER: `SELECT 1 FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE (o.display_id = ? OR CAST(o.id AS TEXT) = ?) AND (o.created_by = ? OR c.owner_user_id = ?) AND o.deleted_at IS NULL`,
    CUSTOMER: `SELECT 1 FROM customers WHERE display_id = ? AND (owner_user_id = ? OR created_by = ?) AND deleted_at IS NULL`,
    FINANCE: `SELECT 1 FROM finance_records f LEFT JOIN orders o ON o.id = f.order_id LEFT JOIN customers c ON c.id = o.customer_id WHERE f.id = ? AND (f.created_by = ? OR o.created_by = ? OR c.owner_user_id = ?)`,
    LOGISTICS: `SELECT 1 FROM logistics_records l LEFT JOIN orders o ON o.id = l.order_id LEFT JOIN customers c ON c.id = o.customer_id WHERE l.id = ? AND (l.created_by = ? OR o.created_by = ? OR c.owner_user_id = ?)`,
    CUSTOMS: `SELECT 1 FROM customs_records cr LEFT JOIN orders o ON o.id = cr.order_id LEFT JOIN customers c ON c.id = o.customer_id WHERE cr.id = ? AND (cr.created_by = ? OR o.created_by = ? OR c.owner_user_id = ?)`,
    PRODUCTION: `SELECT 1 FROM production_plans pp LEFT JOIN orders o ON o.id = pp.order_id LEFT JOIN customers c ON c.id = o.customer_id WHERE pp.id = ? AND (pp.created_by = ? OR o.created_by = ? OR c.owner_user_id = ?)`,
    PRODUCTION_PHOTO: `SELECT 1 FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ? AND (o.created_by = ? OR c.owner_user_id = ?) AND o.deleted_at IS NULL`,
    ORDER_DOCUMENT: `SELECT 1 FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ? AND (o.created_by = ? OR c.owner_user_id = ?) AND o.deleted_at IS NULL`,
    PACKING: `SELECT 1 FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ? AND (o.created_by = ? OR c.owner_user_id = ?) AND o.deleted_at IS NULL`,
    TASK: `SELECT 1 FROM tasks WHERE id = ? AND (created_by = ? OR assignee_id = ?)`,
  };
  const upperType = entityType.toUpperCase();
  const sql = scopeQueries[upperType];
  if (!sql) return false; // Unknown entity types — deny
  const row = await dbGet<{ 1: number }>(
    sql,
    upperType === 'ORDER'
      ? [entityId, entityId, user.id, user.id]
      : ['FINANCE', 'LOGISTICS', 'CUSTOMS', 'PRODUCTION'].includes(upperType)
        ? [entityId, user.id, user.id, user.id]
        : [entityId, user.id, user.id],
  );
  return Boolean(row);
}

async function canAccessUnboundAttachment(user: AuthedRequest['user'], attachmentId: number, uploadedBy: number | null): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const packingRow = await dbGet<{ allowed: number }>(
    `
      SELECT 1 AS allowed
      FROM packing_records pr
      JOIN orders o ON o.id = pr.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE pr.attachment_id = ?
        AND o.deleted_at IS NULL
        AND (o.created_by = ? OR c.owner_user_id = ?)
      LIMIT 1
    `,
    [attachmentId, user.id, user.id],
  );
  if (packingRow) return true;

  return uploadedBy === user.id;
}

async function verifyEntityExists(entityType: string, entityId: string): Promise<boolean> {
  const queries: Record<string, string> = {
    ORDER: `SELECT 1 FROM orders WHERE display_id = ? AND deleted_at IS NULL`,
    CUSTOMER: `SELECT 1 FROM customers WHERE display_id = ? AND deleted_at IS NULL`,
    FINANCE: `SELECT 1 FROM finance_records WHERE id = ?`,
    LOGISTICS: `SELECT 1 FROM logistics_records WHERE id = ?`,
    CUSTOMS: `SELECT 1 FROM customs_records WHERE id = ?`,
    PRODUCTION: `SELECT 1 FROM production_plans WHERE id = ?`,
    PRODUCTION_PHOTO: `SELECT 1 FROM orders WHERE id = ? AND deleted_at IS NULL`,
    ORDER_DOCUMENT: `SELECT 1 FROM orders WHERE id = ? AND deleted_at IS NULL`,
    PACKING: `SELECT 1 FROM orders WHERE id = ? AND deleted_at IS NULL`,
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
        uploaded_by: number | null;
      }>(`SELECT file_name, stored_name, mime_type, file_path, entity_type, entity_id, uploaded_by FROM attachments WHERE id = ?`, [attachmentId]);

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

      if (!attachment.entity_type || !attachment.entity_id) {
        if (!(await canAccessUnboundAttachment(authUser, attachmentId, attachment.uploaded_by))) {
          return fail(res, 403, '无权访问此附件', 'ATTACHMENT_ACCESS_DENIED');
        }
      } else if (!(await canAccessEntity(authUser, attachment.entity_type, attachment.entity_id))) {
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
      void logAction({
        userId: authUser?.id || null,
        userName: authUser?.name || null,
        action: 'DOWNLOAD',
        entityType: 'ATTACHMENT',
        entityId: attachmentId,
        newValue: {
          fileName: originalFileName,
          entityType: attachment.entity_type,
          entityId: attachment.entity_id,
        },
      });
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
