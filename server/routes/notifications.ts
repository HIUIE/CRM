import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { handleRouteError } from '../lib/http.js';

export function createNotificationsRouter() {
  const router = Router();

  // Get unread count
  router.get('/unread-count', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const result = await db.get<{ count: number }>(
        `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0`,
        [req.user?.id]
      );
      res.json({ count: result?.count || 0 });
    } catch (error) {
      return handleRouteError(res, error, '读取消息统计失败');
    }
  });

  // Get all for user
  router.get('/', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const logs = await db.all(`
        SELECT * FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `, [req.user?.id]);
      res.json(logs);
    } catch (error) {
      return handleRouteError(res, error, '读取消息列表失败');
    }
  });

  // Mark all as read
  router.post('/read-all', requireAuth, async (req: AuthedRequest, res) => {
    try {
      await db.run(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [req.user?.id]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '标记消息失败');
    }
  });

  return router;
}
