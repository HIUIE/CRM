import fs from 'fs/promises';
import { Router } from 'express';
import { dbGet } from '../lib/db.js';
import { getStoredNameFromRecord, isSafeStoredName, resolveAttachmentAbsolutePath, sanitizeDownloadFilename } from '../lib/files.js';
import { fail, handleRouteError } from '../lib/http.js';

export function createFilesRouter() {
  const router = Router();

  router.get('/:id/:storedName', async (req, res) => {
    const attachmentId = Number(req.params.id);
    const storedName = String(req.params.storedName || '').trim();

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
      }>(`SELECT file_name, stored_name, mime_type, file_path FROM attachments WHERE id = ?`, [attachmentId]);

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
