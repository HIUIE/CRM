import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbAll, dbGet, dbRun } from '../lib/db.js';
import { USER_ROLES } from '../domain.js';
import { requireAdmin, requireAuth, type AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { logAction } from '../lib/audit.js';
import { isOneOf, readString, validatePasswordStrength } from '../lib/values.js';

export function createUsersRouter() {
  const router = Router();

  router.get('/', requireAuth, async (_req, res) => {
    try {
      const users = await dbAll(`
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

  router.post('/', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
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
    const strength = validatePasswordStrength(password);
    if (!strength.isValid) {
      return fail(res, 400, strength.message, 'INVALID_PASSWORD');
    }
    if (!isOneOf(role, USER_ROLES)) {
      return fail(res, 400, '角色不正确', 'INVALID_ROLE');
    }

    try {
      const existing = await dbGet<{ id: number }>(`SELECT id FROM users WHERE username = ?`, [username]);
      if (existing) {
        return fail(res, 409, '用户名已存在', 'USERNAME_EXISTS');
      }

      const hash = await bcrypt.hash(password, 10);
      const created = await dbRun(
        `INSERT INTO users (username, password, role, name, active) VALUES (?, ?, ?, ?, 1)`,
        [username, hash, role, name],
      );
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, '创建用户失败');
    }
  });

  router.patch('/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
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
      const existing = await dbGet<{ id: number; username: string; role: string; active: number }>(
        `SELECT id, username, role, active FROM users WHERE id = ?`,
        [userId],
      );
      if (!existing) {
        return fail(res, 404, '用户不存在', 'USER_NOT_FOUND');
      }
      const isSelf = req.user?.id === userId;
      if (existing.username === 'root' && active === 0) {
        return fail(res, 409, '默认管理员账号不能停用', 'ROOT_PROTECTED');
      }
      if (isSelf && active === 0) {
        return fail(res, 409, '不能停用当前登录账号，请使用其他管理员账号操作', 'SELF_DEACTIVATE_BLOCKED');
      }
      if (isSelf && existing.role === 'admin' && role !== 'admin') {
        return fail(res, 409, '不能直接降低当前登录管理员账号权限，请使用其他管理员账号操作', 'SELF_DEMOTE_BLOCKED');
      }
      if (existing.role === 'admin' && (role !== 'admin' || active === 0)) {
        const adminCount = await dbGet<{ count: number }>(
          `SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active != 0`,
        );
        if ((adminCount?.count || 0) <= 1) {
          return fail(res, 409, '系统至少需要保留一个启用中的管理员账号', 'LAST_ADMIN_BLOCKED');
        }
      }

      await dbRun(
        `UPDATE users SET name = ?, role = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [name, role, active, userId],
      );
      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        newValue: { action: 'update_user', targetUser: existing.username, role, active: active !== 0, self: isSelf },
      });
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新用户失败');
    }
  });

  router.post('/:id/reset-password', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
    const userId = Number(req.params.id);
    const password = readString(req.body?.password);
    const confirmPassword = readString(req.body?.confirmPassword);

    if (!Number.isInteger(userId) || userId <= 0) {
      return fail(res, 400, '用户编号无效', 'INVALID_USER_ID');
    }
    const strength = validatePasswordStrength(password);
    if (!strength.isValid) {
      return fail(res, 400, strength.message, 'INVALID_PASSWORD');
    }
    // Require admin to confirm their own password as CSRF/second-factor check
    if (!confirmPassword) {
      return fail(res, 400, '请输入您的当前密码以确认此操作', 'CONFIRM_PASSWORD_REQUIRED');
    }
    const admin = await dbGet<{ password: string }>(`SELECT password FROM users WHERE id = ?`, [req.user?.id]);
    if (!admin || !(await bcrypt.compare(confirmPassword, admin.password))) {
      return fail(res, 403, '当前密码验证失败，请检查输入的密码是否正确', 'ADMIN_CONFIRM_FAILED');
    }

    try {
      const existing = await dbGet<{ id: number; name: string }>(`SELECT id, name FROM users WHERE id = ?`, [userId]);
      if (!existing) {
        return fail(res, 404, '用户不存在', 'USER_NOT_FOUND');
      }
      const hash = await bcrypt.hash(password, 10);
      // Increment token_version to invalidate all existing sessions for this user
      await dbRun(
        `UPDATE users SET password = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [hash, userId],
      );
      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        newValue: { action: 'reset_password', targetUser: existing.name, selfReset: req.user?.id === userId },
      });
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '重置密码失败');
    }
  });

  return router;
}
