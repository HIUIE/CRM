import type { NextFunction, Request, Response } from 'express';
import path from 'path';
import { PROJECT_ROOT } from '../paths.js';

const BLOCKED_SUFFIXES = ['.env', '.db', '.sqlite', '.sqlite3', '.pem', '.key'];
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
