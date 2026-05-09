export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id);

    UPDATE customers
      SET owner_user_id = created_by
      WHERE owner_user_id IS NULL AND created_by IS NOT NULL;

    CREATE TABLE IF NOT EXISTS customer_transfer_logs (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      from_user_id INTEGER REFERENCES users(id),
      to_user_id INTEGER NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      sync_open_orders INTEGER DEFAULT 1,
      sync_open_tasks INTEGER DEFAULT 1,
      transferred_by INTEGER REFERENCES users(id),
      transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_customers_owner_user_id
      ON customers (owner_user_id)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_customer_transfer_logs_customer
      ON customer_transfer_logs (customer_id, transferred_at DESC);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_customer_transfer_logs_customer;
    DROP INDEX IF EXISTS idx_customers_owner_user_id;
    DROP TABLE IF EXISTS customer_transfer_logs;
    ALTER TABLE customers
      DROP COLUMN IF EXISTS owner_user_id;
  `);
};
