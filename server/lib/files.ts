import path from 'path';
import fs from 'fs/promises';
import { UPLOADS_DIR } from '../paths.js';

const SAFE_STORED_NAME = /^[A-Za-z0-9._-]+$/;

function isPathInside(parentPath: string, targetPath: string) {
  const relative = path.relative(parentPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function buildAttachmentUrl(attachmentId: number, storedName: string) {
  return `/api/files/${attachmentId}/${encodeURIComponent(storedName)}`;
}

export function isSafeStoredName(value: string) {
  return Boolean(value) &&
    SAFE_STORED_NAME.test(value) &&
    path.basename(value) === value &&
    !value.includes('..') &&
    !/[\\/\0]/.test(value);
}

export function normalizeAttachmentRelativePath(filePath: string) {
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) {
    return '';
  }
  return normalized.startsWith('uploads/') ? normalized.slice('uploads/'.length) : normalized;
}

export function resolveAttachmentAbsolutePath(filePath: string) {
  const normalized = normalizeAttachmentRelativePath(filePath);
  if (!normalized || normalized.includes('\0')) {
    return null;
  }

  const uploadsRoot = path.resolve(UPLOADS_DIR);
  const absolutePath = path.resolve(uploadsRoot, normalized);
  return isPathInside(uploadsRoot, absolutePath) ? absolutePath : null;
}

export function getStoredNameFromRecord(storedName: unknown, filePath: unknown) {
  const explicitStoredName = String(storedName || '').trim();
  if (explicitStoredName) {
    return explicitStoredName;
  }
  return path.basename(normalizeAttachmentRelativePath(String(filePath || '')));
}

export function sanitizeDownloadFilename(fileName: string) {
  const fallback = String(fileName || 'download').replace(/["\\]/g, '_').replace(/[^\x20-\x7E]/g, '_').trim();
  return fallback || 'download';
}

// Magic byte signatures for common file types
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'application/zip': [[0x50, 0x4B, 0x03, 0x04]],
  'application/x-zip-compressed': [[0x50, 0x4B, 0x03, 0x04]],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4B, 0x03, 0x04]],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]],
  'application/vnd.ms-excel': [[0xD0, 0xCF, 0x11, 0xE0]],
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0]],
};

export async function validateFileMagicBytes(filePath: string, claimedMimeType: string): Promise<boolean> {
  const signatures = MAGIC_BYTES[claimedMimeType];
  if (!signatures) return true; // No magic byte check defined — accept (already filtered by MIME allowlist)

  try {
    const fd = await fs.open(filePath, 'r');
    const buf = Buffer.alloc(8);
    await fd.read(buf, 0, 8, 0);
    await fd.close();

    return signatures.some((sig) => sig.every((byte, i) => buf[i] === byte));
  } catch {
    return false;
  }
}
