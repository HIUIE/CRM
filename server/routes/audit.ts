import { Router } from 'express';
import { dbAll, dbRun } from '../lib/db.js';
import { requireAdmin, type AuthedRequest } from '../lib/auth.js';
import { handleRouteError } from '../lib/http.js';

export function createAuditRouter() {
  const router = Router();

  router.get('/', requireAdmin, async (req: AuthedRequest, res) => {
    try {
      // Auto-prune: keep only last 30 days of audit logs to prevent unbounded growth
      await dbRun(`DELETE FROM audit_logs WHERE datetime(created_at) < datetime('now', '-30 days')`);

      const logs = await dbAll(`
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
