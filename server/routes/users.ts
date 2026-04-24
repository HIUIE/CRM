import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { USER_ROLES } from '../domain.js';
import { requireAdmin } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { isOneOf, readString } from '../lib/values.js';

export function createUsersRouter() {
  const router = Router();

  router.get('/', requireAdmin, async (_req, res) => {
    try {
      const users = await db.all(`
        SELECT id, username, role, name, active, created_at
        FROM users
        ORDER BY role = 'admin' DESC, datetime(created_at) DESC, id DESC
      `);
      res.json(
        users.map((user) => ({
          ...user,
          active: user.active !== 0,
        })),
      );
    } catch (error) {
      return handleRouteError(res, error, '读取用户列表失败');
    }
  });

  router.post('/', requireAdmin, async (req, res) => {
    const username = readString(req.body?.username).toLowerCase();
    const password = readString(req.body?.password);
    const name = readString(req.body?.name);
    const role = readString(req.body?.role);

    if (!username || !password || !name) {
      return fail(res, 400, '请完整填写用户名、姓名和密码', 'INVALID_USER_PAYLOAD');
    }
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      return fail(res, 400, '用户名仅支持 3-32 位字母、数字、点、下划线或中横线', 'INVALID_USERNAME');
    }
    if (password.length < 6) {
      return fail(res, 400, '密码至少需要 6 位', 'INVALID_PASSWORD');
    }
    if (!isOneOf(role, USER_ROLES)) {
      return fail(res, 400, '角色不正确', 'INVALID_ROLE');
    }

    try {
      const existing = await db.get<{ id: number }>(`SELECT id FROM users WHERE username = ?`, [username]);
      if (existing) {
        return fail(res, 409, '用户名已存在', 'USERNAME_EXISTS');
      }

      const hash = await bcrypt.hash(password, 10);
      const created = await db.run(
        `INSERT INTO users (username, password, role, name, active) VALUES (?, ?, ?, ?, 1)`,
        [username, hash, role, name],
      );
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, '创建用户失败');
    }
  });

  router.patch('/:id', requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    const name = readString(req.body?.name);
    const role = readString(req.body?.role);
    const active = req.body?.active === false || req.body?.active === 0 ? 0 : 1;

    if (!Number.isInteger(userId) || userId <= 0) {
      return fail(res, 400, '用户编号无效', 'INVALID_USER_ID');
    }
    if (!name) {
      return fail(res, 400, '请填写姓名', 'INVALID_USER_PAYLOAD');
    }
    if (!isOneOf(role, USER_ROLES)) {
      return fail(res, 400, '角色不正确', 'INVALID_ROLE');
    }

    try {
      const existing = await db.get<{ id: number; username: string }>(`SELECT id, username FROM users WHERE id = ?`, [userId]);
      if (!existing) {
        return fail(res, 404, '用户不存在', 'USER_NOT_FOUND');
      }
      if (existing.username === 'root' && active === 0) {
        return fail(res, 409, '默认管理员账号不能停用', 'ROOT_PROTECTED');
      }

      await db.run(
        `UPDATE users SET name = ?, role = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [name, role, active, userId],
      );
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新用户失败');
    }
  });

  router.post('/:id/reset-password', requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    const password = readString(req.body?.password);

    if (!Number.isInteger(userId) || userId <= 0) {
      return fail(res, 400, '用户编号无效', 'INVALID_USER_ID');
    }
    if (password.length < 6) {
      return fail(res, 400, '密码至少需要 6 位', 'INVALID_PASSWORD');
    }

    try {
      const existing = await db.get<{ id: number }>(`SELECT id FROM users WHERE id = ?`, [userId]);
      if (!existing) {
        return fail(res, 404, '用户不存在', 'USER_NOT_FOUND');
      }
      const hash = await bcrypt.hash(password, 10);
      await db.run(`UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [hash, userId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '重置密码失败');
    }
  });

  return router;
}
