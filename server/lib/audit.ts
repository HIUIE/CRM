import { db } from '../db.js';

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
        params.oldValue ? JSON.stringify(params.oldValue) : null,
        params.newValue ? JSON.stringify(params.newValue) : null,
      ]
    );
  } catch (error) {
    console.error('Failed to log audit trail:', error);
  }
}
