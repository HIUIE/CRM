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

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required. Set a strong random string in production.');
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
    JWT_SECRET!,
    { expiresIn: '24h' },
  );
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, JWT_SECRET!) as unknown as AuthUser;
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

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return fail(res, 401, '请先登录后再操作', 'AUTH_REQUIRED');
  }
  if (req.user.role !== 'admin') {
    return fail(res, 403, '仅管理员可执行此操作', 'ADMIN_REQUIRED');
  }
  next();
}
