import { dbRun } from './db.js';
import { sanitizeForAI } from './sanitizer.js';
import { logger } from './logger.js';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type AuditEntity = 'ORDER' | 'CUSTOMER' | 'FINANCE' | 'PARTNER' | 'LOGISTICS' | 'CUSTOMS' | 'USER' | 'TASK';

export async function logAction(params: {
  userId: number | null;
  userName: string | null;
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string | number;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  try {
    // 【核心加固】在存入审计数据库前，强制对快照进行脱敏处理，防止 PII（个人身份信息）永久固化在日志中
    const safeOld = params.oldValue ? sanitizeForAI(params.oldValue) : null;
    const safeNew = params.newValue ? sanitizeForAI(params.newValue) : null;

    await dbRun(
      `
        INSERT INTO audit_logs (user_id, user_name, action_type, entity_type, entity_id, old_value, new_value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        params.userId,
        params.userName,
        params.action,
        params.entityType,
        String(params.entityId),
        safeOld ? JSON.stringify(safeOld) : null,
        safeNew ? JSON.stringify(safeNew) : null,
      ]
    );
  } catch (error) {
    logger.error({ err: error }, 'Failed to log audit trail');
  }
}

/**
 * P3: 归档旧的审计日志
 * 将超过指定天数（默认 365 天）的日志移动到归档表。
 */
export async function archiveAuditLogs(daysThreshold = 365) {
  const { withTransaction } = await import('./db.js');
  try {
    const moved = await withTransaction(async (tx) => {
      // Postgres-specific efficient move
      const sql = `
        WITH moved_rows AS (
          DELETE FROM audit_logs
          WHERE created_at < CURRENT_TIMESTAMP - interval '${daysThreshold} days'
          RETURNING *
        )
        INSERT INTO audit_logs_archive (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip, user_agent, created_at)
        SELECT id, user_id, user_name, action_type, entity_type, entity_id, old_value, new_value, ip, user_agent, created_at
        FROM moved_rows;
      `;
      return await tx.run(sql);
    });
    return { success: true, count: moved?.changes || 0 };
  } catch (error) {
    logger.error({ err: error }, 'Failed to archive audit logs');
    throw error;
  }
}
