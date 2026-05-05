import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import path from 'path';
import { PROJECT_ROOT } from '../paths.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const DEFAULT_KEY = 'smart-trade-erp-default-secret-key-32'; // 必须是 32 字节

function getEncryptionKey() {
  const key = process.env.DB_ENCRYPTION_KEY || DEFAULT_KEY;
  return Buffer.from(key.padEnd(32, '0').slice(0, 32));
}

/**
 * 加密字符串
 */
export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * 解密字符串
 */
export function decrypt(cipherText: string): string {
  if (!cipherText) return '';
  try {
    const data = Buffer.from(cipherText, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch (error) {
    // 如果解密失败，可能是旧的明文数据，原样返回（兼容性考虑）
    return cipherText;
  }
}

const BLOCKED_SUFFIXES = ['.env', '.pem', '.key'];
const BLOCKED_SEGMENTS = new Set(['.git']);

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isPathInside(parentPath: string, targetPath: string) {
  const relative = path.relative(parentPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function shouldBlockPath(rawPath: string) {
  const candidates = [rawPath, safeDecode(rawPath)].map((value) => value.toLowerCase());

  return candidates.some((candidate) => {
    if (candidate === '/uploads' || candidate.startsWith('/uploads/')) {
      return true;
    }

    const segments = candidate.split('/').filter(Boolean);
    return segments.some((segment) => BLOCKED_SEGMENTS.has(segment) || BLOCKED_SUFFIXES.some((suffix) => segment.endsWith(suffix)));
  });
}

export function blockSensitivePaths(req: Request, res: Response, next: NextFunction) {
  const requestPath = req.originalUrl.split('?')[0] || req.path || '/';
  if (shouldBlockPath(requestPath)) {
    return res.status(404).end();
  }
  next();
}

export function assertStorageOutsideStaticRoots(dbPath: string, uploadsDir: string) {
  const distRoot = path.resolve(PROJECT_ROOT, 'dist');
  const publicRoot = path.resolve(PROJECT_ROOT, 'public');
  const checks = [
    { label: 'CRM_DB_PATH', target: path.resolve(dbPath) },
    { label: 'UPLOADS_DIR', target: path.resolve(uploadsDir) },
  ];

  for (const check of checks) {
    if (isPathInside(distRoot, check.target) || isPathInside(publicRoot, check.target)) {
      throw new Error(`${check.label} 不能位于 dist/ 或 public/ 静态目录内`);
    }
  }
}
