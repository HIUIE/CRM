import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbGet, dbRun } from '../lib/db.js';
import { clearAuthCookie, clearCsrfCookie, csrfProtection, getCookieOptions, requireAuth, setCsrfCookie, signAuthToken, verifyAuthToken, type AuthedRequest } from '../lib/auth.js';
import { handleRouteError, fail } from '../lib/http.js';
import { readString } from '../lib/values.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

async function checkLoginRateLimit(ip: string): Promise<boolean> {
  const now = Date.now();
  const row = await dbGet<{ count: number; reset_at: number }>(
    `SELECT count, reset_at FROM login_attempts WHERE ip = ?`,
    [ip],
  );
  if (!row || now > row.reset_at) {
    await dbRun(
      `INSERT INTO login_attempts (ip, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(ip) DO UPDATE SET count = 1, reset_at = EXCLUDED.reset_at`,
      [ip, now + LOGIN_WINDOW_MS],
    );
    return true;
  }
  if (row.count >= MAX_LOGIN_ATTEMPTS) return false;
  await dbRun(`UPDATE login_attempts SET count = count + 1 WHERE ip = ?`, [ip]);
  return true;
}

export function createAuthRouter() {
  const router = Router();

  router.post('/login', async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!(await checkLoginRateLimit(ip))) {
      return fail(res, 429, '登录尝试过于频繁，请 15 分钟后再试', 'RATE_LIMITED');
    }

    const username = readString(req.body?.username);
    const password = readString(req.body?.password, 128);

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
        token_version: number;
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

      const token = signAuthToken(
        { id: user.id, role: user.role, username: user.username, name: user.name },
        user.token_version,
      );
      // Clear rate limit on successful login
      await dbRun(`DELETE FROM login_attempts WHERE ip = ?`, [ip]);
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

  router.post('/logout', csrfProtection, async (req, res) => {
    // Increment token_version to invalidate all existing tokens for this user
    const token = req.cookies.token;
    if (token) {
      try {
        const decoded = verifyAuthToken(token);
        await dbRun(`UPDATE users SET token_version = token_version + 1 WHERE id = ?`, [decoded.id]);
      } catch {
        // Token invalid or expired — silently accept (best-effort revocation)
      }
    }
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
