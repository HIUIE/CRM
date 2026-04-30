import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbGet } from '../lib/db.js';
import { clearAuthCookie, clearCsrfCookie, getCookieOptions, requireAuth, setCsrfCookie, signAuthToken, type AuthedRequest } from '../lib/auth.js';
import { handleRouteError, fail } from '../lib/http.js';
import { readString } from '../lib/values.js';

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) return false;
  entry.count++;
  return true;
}

// Periodic cleanup of stale entries
const loginRateLimitCleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, 60 * 1000);
loginRateLimitCleanup.unref?.();

export function createAuthRouter() {
  const router = Router();

  router.post('/login', async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkLoginRateLimit(ip)) {
      return fail(res, 429, '登录尝试过于频繁，请 15 分钟后再试', 'RATE_LIMITED');
    }

    const username = readString(req.body?.username);
    const password = readString(req.body?.password);

    if (!username || !password) {
      return fail(res, 400, '请输入用户名和密码', 'INVALID_LOGIN');
    }

    try {
      const user = await dbGet<{
        id: number;
        username: string;
        role: 'admin' | 'staff';
        name: string;
        password: string;
        active: number | null;
      }>(`SELECT * FROM users WHERE username = ?`, [username]);

      if (!user) {
        return fail(res, 401, '无效的用户名或密码', 'INVALID_CREDENTIALS');
      }
      if (user.active === 0) {
        return fail(res, 403, '账号已停用，请联系管理员', 'ACCOUNT_DISABLED');
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return fail(res, 401, '无效的用户名或密码', 'INVALID_CREDENTIALS');
      }

      const token = signAuthToken({ id: user.id, role: user.role, username: user.username, name: user.name });
      res.cookie('token', token, getCookieOptions());
      setCsrfCookie(res);
      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
          active: user.active !== 0,
        },
      });
    } catch (error) {
      return handleRouteError(res, error, '服务器内部错误');
    }
  });

  router.post('/logout', (_req, res) => {
    clearAuthCookie(res);
    clearCsrfCookie(res);
    res.json({ success: true });
  });

  router.get('/me', async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
      return fail(res, 401, '未登录', 'AUTH_REQUIRED');
    }

    try {
      requireAuth(req as AuthedRequest, res, async () => {
        const userId = (req as AuthedRequest).user!.id;
        const user = await dbGet<{
          id: number;
          username: string;
          role: 'admin' | 'staff';
          name: string;
          active: number | null;
        }>(
          `SELECT id, username, role, name, active FROM users WHERE id = ?`,
          [userId],
        );
        if (!user) {
          clearAuthCookie(res);
          return fail(res, 404, '用户不存在', 'USER_NOT_FOUND');
        }
        res.json({
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name,
            active: user.active !== 0,
          },
        });
      });
    } catch (error) {
      return handleRouteError(res, error, '读取当前登录信息失败');
    }
  });

  return router;
}
