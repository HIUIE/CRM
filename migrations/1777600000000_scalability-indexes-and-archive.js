/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // P11: Key Path Index Optimization
  
  // Orders: optimize filtering by status, deletion flag, and sorting by creation date
  pgm.createIndex('orders', ['deleted_at', 'status', 'created_at'], { name: 'idx_orders_query_path' });
  
  // Finance: similar composite index for dashboard aggregations
  pgm.createIndex('finance_records', ['deleted_at', 'status', 'created_at', 'type'], { name: 'idx_finance_query_path' });

  // Audit Logs: optimize lookups by entity type and ID (very common in Detail pages)
  pgm.createIndex('audit_logs', ['entity_type', 'entity_id'], { name: 'idx_audit_logs_entity' });

  // P3: Create archive table for audit logs
  pgm.createTable('audit_logs_archive', {
    id: 'id',
    user_id: { type: 'integer' },
    user_name: { type: 'text' },
    action: { type: 'text', notNull: true },
    entity_type: { type: 'text', notNull: true },
    entity_id: { type: 'integer' },
    old_value: { type: 'jsonb' },
    new_value: { type: 'jsonb' },
    ip: { type: 'text' },
    user_agent: { type: 'text' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });
  pgm.createIndex('audit_logs_archive', ['created_at'], { name: 'idx_audit_logs_archive_date' });
};

export const down = (pgm) => {
  pgm.dropTable('audit_logs_archive');
  pgm.dropIndex('audit_logs', [], { name: 'idx_audit_logs_entity' });
  pgm.dropIndex('finance_records', [], { name: 'idx_finance_query_path' });
  pgm.dropIndex('orders', [], { name: 'idx_orders_query_path' });
};
