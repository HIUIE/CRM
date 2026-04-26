import { db } from '../db.js';
import { sanitizeForAI } from './sanitizer.js';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type AuditEntity = 'ORDER' | 'CUSTOMER' | 'FINANCE' | 'PARTNER' | 'LOGISTICS' | 'CUSTOMS' | 'USER';

export async function logAction(params: {
  userId: number | null;
  userName: string | null;
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string | number;
  oldValue?: any;
  newValue?: any;
}) {
  try {
    // 【核心加固】在存入审计数据库前，强制对快照进行脱敏处理，防止 PII（个人身份信息）永久固化在日志中
    const safeOld = params.oldValue ? sanitizeForAI(params.oldValue) : null;
    const safeNew = params.newValue ? sanitizeForAI(params.newValue) : null;

    await db.run(
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
    console.error('Failed to log audit trail:', error);
  }
}
