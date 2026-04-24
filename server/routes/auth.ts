import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { clearAuthCookie, getCookieOptions, requireAuth, signAuthToken } from '../lib/auth.js';
import { handleRouteError, fail } from '../lib/http.js';
import { readString } from '../lib/values.js';

export function createAuthRouter() {
  const router = Router();

  router.post('/login', async (req, res) => {
    const username = readString(req.body?.username);
    const password = readString(req.body?.password);

    if (!username || !password) {
      return fail(res, 400, '请输入用户名和密码', 'INVALID_LOGIN');
    }

    try {
      const user = await db.get<{
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

      const token = signAuthToken({ id: user.id, role: user.role, username: user.username });
      res.cookie('token', token, getCookieOptions());
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
    res.json({ success: true });
  });

  router.get('/me', async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
      return fail(res, 401, '未登录', 'AUTH_REQUIRED');
    }

    try {
      requireAuth(req as any, res, async () => {
        const userId = (req as any).user.id;
        const user = await db.get<{
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
