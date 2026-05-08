import fs from 'fs/promises';
import { dbAll, dbRun } from '../lib/db.js';
import type { AttachmentEntityType } from '../domain.js';
import { buildAttachmentUrl, getStoredNameFromRecord, resolveAttachmentAbsolutePath } from '../lib/files.js';

export async function getAttachmentsByEntity(entityType: AttachmentEntityType, entityIds: number[]) {
  if (!entityIds.length) {
    return new Map<number, Record<string, unknown>[]>();
  }

  const placeholders = entityIds.map(() => '?').join(', ');
  const rows = await dbAll<Record<string, unknown>[]>(
    `
      SELECT id, entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path, remark, created_at
      FROM attachments
      WHERE entity_type = ? AND entity_id IN (${placeholders})
      ORDER BY datetime(created_at) DESC, id DESC
    `,
    [entityType, ...entityIds],
  );

  const grouped = new Map<number, Record<string, unknown>[]>();
  for (const row of rows) {
    const entityId = Number(row.entity_id);
    if (!grouped.has(entityId)) {
      grouped.set(entityId, []);
    }
    grouped.get(entityId)?.push({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      fileName: row.file_name,
      storedName: getStoredNameFromRecord(row.stored_name, row.file_path),
      mimeType: row.mime_type,
      fileSize: row.file_size,
      filePath: row.file_path,
      url: buildAttachmentUrl(Number(row.id), getStoredNameFromRecord(row.stored_name, row.file_path)),
      createdAt: row.created_at,
      remark: row.remark,
    });
  }

  return grouped;
}

export async function bindAttachmentsToEntity(entityType: AttachmentEntityType, entityId: number, attachmentIds: number[]) {
  // First, unbind all currently bound attachments for this entity that are NOT in the new list
  const placeholders = attachmentIds.length > 0 ? attachmentIds.map(() => '?').join(', ') : null;
  const unbindSql = placeholders 
    ? `UPDATE attachments SET entity_type = NULL, entity_id = NULL WHERE entity_type = ? AND entity_id = ? AND id NOT IN (${placeholders})`
    : `UPDATE attachments SET entity_type = NULL, entity_id = NULL WHERE entity_type = ? AND entity_id = ?`;
  const unbindParams = placeholders ? [entityType, entityId, ...attachmentIds] : [entityType, entityId];
  
  await dbRun(unbindSql, unbindParams);

  if (attachmentIds.length > 0) {
    const bindPlaceholders = attachmentIds.map(() => '?').join(', ');
    await dbRun(
      `
        UPDATE attachments
        SET entity_type = ?, entity_id = ?
        WHERE id IN (${bindPlaceholders})
          AND (entity_type IS NULL OR (entity_type = ? AND entity_id = ?))
      `,
      [entityType, entityId, ...attachmentIds, entityType, entityId],
    );
  }
}

export async function deleteAttachmentRows(entityType: AttachmentEntityType, entityId: number) {
  const attachments = await dbAll<{ id: number; file_path: string }[]>(
    `SELECT id, file_path FROM attachments WHERE entity_type = ? AND entity_id = ?`,
    [entityType, entityId],
  );

  for (const attachment of attachments) {
    if (attachment.file_path) {
      const fullPath = resolveAttachmentAbsolutePath(attachment.file_path);
      if (!fullPath) {
        continue;
      }
      try {
        await fs.unlink(fullPath);
      } catch (_error) {
        // Ignore missing files; deleting the DB row is still correct.
      }
    }
  }

  await dbRun(`DELETE FROM attachments WHERE entity_type = ? AND entity_id = ?`, [entityType, entityId]);
}
