import path from 'path';
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
