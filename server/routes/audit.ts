import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin, type AuthedRequest } from '../lib/auth.js';
import { handleRouteError } from '../lib/http.js';

export function createAuditRouter() {
  const router = Router();

  router.get('/', requireAdmin, async (req: AuthedRequest, res) => {
    try {
      const logs = await db.all(`
        SELECT * FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 200
      `);
      res.json(logs);
    } catch (error) {
      return handleRouteError(res, error, '读取审计日志失败');
    }
  });

  return router;
}
