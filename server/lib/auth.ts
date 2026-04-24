import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import type { UserRole } from '../domain.js';
import { fail } from './http.js';

export type AuthUser = {
  id: number;
  role: UserRole;
  username: string;
};

export type AuthedRequest = Request & {
  user?: AuthUser;
};

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-preview-only';

function isCookieSecure() {
  return process.env.COOKIE_SECURE === 'true';
}

function getSameSite() {
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
}

export function signAuthToken(user: AuthUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies.token;
  if (!token) {
    return fail(res, 401, '请先登录后再操作', 'AUTH_REQUIRED');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    const currentUser = await db.get<{ id: number; active: number | null }>(
      `SELECT id, active FROM users WHERE id = ?`,
      [decoded.id],
    );
    if (!currentUser || currentUser.active === 0) {
      clearAuthCookie(res);
      return fail(res, 401, '账号已停用，请联系管理员', 'ACCOUNT_DISABLED');
    }
    req.user = decoded;
    next();
  } catch (_error) {
    clearAuthCookie(res);
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
