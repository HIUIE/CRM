/**
 * @type {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_orders_customer_deleted_created
      ON orders (customer_id, deleted_at, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_finance_order_status_deleted
      ON finance_records (order_id, status, deleted_at);

    CREATE INDEX IF NOT EXISTS idx_logistics_order_deleted_created
      ON logistics_records (order_id, deleted_at, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_attachments_entity_created
      ON attachments (entity_type, entity_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_tasks_entity_assignee
      ON tasks (entity_type, entity_id, assignee_id);

    CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
      ON notifications (user_id, is_read, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_production_plans_order
      ON production_plans (order_id);

    CREATE INDEX IF NOT EXISTS idx_customer_followups_customer_created
      ON customer_followups (customer_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_order_follow_ups_order_created
      ON order_follow_ups (order_id, created_at DESC);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_order_follow_ups_order_created;
    DROP INDEX IF EXISTS idx_customer_followups_customer_created;
    DROP INDEX IF EXISTS idx_production_plans_order;
    DROP INDEX IF EXISTS idx_notifications_user_read_created;
    DROP INDEX IF EXISTS idx_tasks_entity_assignee;
    DROP INDEX IF EXISTS idx_attachments_entity_created;
    DROP INDEX IF EXISTS idx_logistics_order_deleted_created;
    DROP INDEX IF EXISTS idx_finance_order_status_deleted;
    DROP INDEX IF EXISTS idx_orders_customer_deleted_created;
  `);
};
