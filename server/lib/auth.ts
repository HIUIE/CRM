import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { dbGet, dbRun } from './db.js';
import type { UserRole } from '../domain.js';
import { fail } from './http.js';

export type AuthUser = {
  id: number;
  role: UserRole;
  username: string;
  name: string;
  tokenVersion?: number;
};

export type AuthedRequest = Request & {
  user?: AuthUser;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is required. Set a strong random string in production.');
  }
  return secret;
}

// CSRF Protection: double-submit cookie pattern
const CSRF_COOKIE = 'csrf_token';

function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getCsrfCookieOptions() {
  return {
    httpOnly: false, // Must be readable by JS (apiFetch reads it)
    secure: isCookieSecure(),
    sameSite: getSameSite(),
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  };
}

export function setCsrfCookie(res: Response) {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE, token, getCsrfCookieOptions());
  return token;
}

export function clearCsrfCookie(res: Response) {
  res.clearCookie(CSRF_COOKIE, getCsrfCookieOptions());
}

export function validateCsrf(req: AuthedRequest, res: Response): boolean {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true; // Safe methods don't need CSRF check
  }
  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.headers['x-csrf-token'] as string | undefined;
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    fail(res, 403, '安全验证失败，请刷新页面重试', 'CSRF_INVALID');
    return false;
  }
  return true;
}

// CSRF middleware for state-changing requests
export function csrfProtection(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!validateCsrf(req, res)) return;
  next();
}

function isCookieSecure() {
  return process.env.COOKIE_SECURE === 'true';
}

function getSameSite(): 'none' | 'lax' {
  return isCookieSecure() ? 'none' : 'lax';
}

export function getCookieOptions() {
  return {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: getSameSite() as 'none' | 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  };
}

export function clearAuthCookie(res: Response) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: getSameSite() as 'none' | 'lax',
    path: '/',
  });
  clearCsrfCookie(res);
}

export function signAuthToken(user: AuthUser, tokenVersion?: number) {
  return jwt.sign(
    { ...user, tokenVersion: tokenVersion ?? 1 },
    getJwtSecret(),
    { expiresIn: '24h' },
  );
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, getJwtSecret()) as unknown as AuthUser;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies.token;
  if (!token) {
    return fail(res, 401, '请先登录后再操作', 'AUTH_REQUIRED');
  }

  try {
    const decoded = verifyAuthToken(token);
    const currentUser = await dbGet<{ id: number; active: number | null; token_version: number }>(
      `SELECT id, active, token_version FROM users WHERE id = ?`,
      [decoded.id],
    );
    if (!currentUser || currentUser.active === 0) {
      clearAuthCookie(res);
      clearCsrfCookie(res);
      return fail(res, 401, '账号已停用，请联系管理员', 'ACCOUNT_DISABLED');
    }
    // JWT revocation: if token version doesn't match, the token has been invalidated
    if ((decoded.tokenVersion || 1) !== currentUser.token_version) {
      clearAuthCookie(res);
      clearCsrfCookie(res);
      return fail(res, 401, '登录状态已失效，请重新登录', 'AUTH_EXPIRED');
    }
    req.user = decoded;
    // Ensure CSRF cookie exists on each authenticated request
    if (!req.cookies.csrf_token) {
      setCsrfCookie(res);
    }
    next();
  } catch (_error) {
    clearAuthCookie(res);
    clearCsrfCookie(res);
    return fail(res, 401, '登录状态已失效，请重新登录', 'AUTH_EXPIRED');
  }
}

export function getAdminRole() {
  return 'admin';
}

/**
 * 获取数据隔离的 SQL 约束条件
 * @param user 当前登录用户
 * @param tableAlias 表别名，默认为 t
 * @param creatorField 归属人字段名，默认为 created_by
 * @returns [sqlFragment, params]
 */
export function getDataScopeConstraint(user: any, tableAlias = 't', creatorField = 'created_by'): [string, any[]] {
  if (!user) return [' AND 1=0', []]; // 未登录，无权访问
  if (user.role === 'admin') return ['', []]; // 管理员可见全量

  // 业务员只能看到自己创建的数据
  return [` AND ${tableAlias}.${creatorField} = ?`, [user.id]];
}

/**
 * 校验用户是否有权访问特定订单
 */
export async function checkOrderAccess(req: AuthedRequest, orderId: number | string) {
  const { dbGet } = await import('./db.js');
  const [scopeSql, scopeParams] = getDataScopeConstraint(req.user, 'o');
  const isNumeric = (typeof orderId === 'number' && Number.isFinite(orderId)) || (typeof orderId === 'string' && /^\d+$/.test(orderId));
  const sql = `SELECT id FROM orders o WHERE o.deleted_at IS NULL ${scopeSql} AND (${isNumeric ? 'o.id = ? OR ' : ''}LOWER(o.display_id) = LOWER(?))`;
  const params = [...scopeParams, ...(isNumeric ? [Number(orderId), String(orderId)] : [String(orderId)])];
  return await dbGet(sql, params);
}

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return fail(res, 401, '请先登录后再操作', 'AUTH_REQUIRED');
  }
  if (req.user.role !== 'admin') {
    return fail(res, 403, '仅管理员可执行此操作', 'ADMIN_REQUIRED');
  }
  next();
}

