import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import type { AttachmentEntityType } from '../domain.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getAttachmentsByEntity(entityType: AttachmentEntityType, entityIds: number[]) {
  if (!entityIds.length) {
    return new Map<number, Record<string, unknown>[]>();
  }

  const placeholders = entityIds.map(() => '?').join(', ');
  const rows = await db.all<Record<string, unknown>[]>(
    `
      SELECT id, entity_type, entity_id, file_name, mime_type, file_size, file_path, created_at
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
      mimeType: row.mime_type,
      fileSize: row.file_size,
      filePath: row.file_path,
      url: row.file_path ? `/${String(row.file_path).replace(/^\/+/, '')}` : '',
      createdAt: row.created_at,
    });
  }

  return grouped;
}

export async function bindAttachmentsToEntity(entityType: AttachmentEntityType, entityId: number, attachmentIds: number[]) {
  if (!attachmentIds.length) {
    return;
  }

  const placeholders = attachmentIds.map(() => '?').join(', ');
  await db.run(
    `
      UPDATE attachments
      SET entity_type = ?, entity_id = ?
      WHERE id IN (${placeholders})
    `,
    [entityType, entityId, ...attachmentIds],
  );
}

export async function deleteAttachmentRows(entityType: AttachmentEntityType, entityId: number) {
  const attachments = await db.all<{ id: number; file_path: string }[]>(
    `SELECT id, file_path FROM attachments WHERE entity_type = ? AND entity_id = ?`,
    [entityType, entityId],
  );

  for (const attachment of attachments) {
    if (attachment.file_path) {
      const fullPath = path.join(__dirname, '..', '..', attachment.file_path);
      try {
        await fs.unlink(fullPath);
      } catch (_error) {
        // Ignore missing files; deleting the DB row is still correct.
      }
    }
  }

  await db.run(`DELETE FROM attachments WHERE entity_type = ? AND entity_id = ?`, [entityType, entityId]);
}
