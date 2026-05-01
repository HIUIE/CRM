import { Router } from 'express';
import { dbAll, dbRun, SQL } from '../lib/db.js';
import { requireAdmin, type AuthedRequest } from '../lib/auth.js';
import { handleRouteError } from '../lib/http.js';

export function createAuditRouter() {
  const router = Router();

  router.get('/', requireAdmin, async (req: AuthedRequest, res) => {
    try {
      // Auto-prune: keep only last 30 days of audit logs to prevent unbounded growth
      await dbRun(`DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '30 days'`);

      const userId = req.query.userId;
      const entityType = req.query.entityType;
      const entityId = req.query.entityId;

      let sql = 'SELECT * FROM audit_logs WHERE 1=1';
      const params = [];

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }
      if (entityType) {
        sql += ' AND entity_type = ?';
        params.push(entityType);
      }
      if (entityId) {
        sql += ' AND entity_id = ?';
        params.push(entityId);
      }

      sql += ' ORDER BY created_at DESC';

      const { readPagination, buildLimitOffset } = await import('../lib/values.js');
      const pagination = readPagination(req.query as Record<string, unknown>);
      sql += buildLimitOffset(pagination, params);

      const logs = await dbAll(sql, params);
      res.json(logs);
    } catch (error) {
      return handleRouteError(res, error, '读取审计日志失败');
    }
  });

  return router;
}
