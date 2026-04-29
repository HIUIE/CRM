/**
 * @type {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // 1. Enable the pg_trgm extension for fuzzy search indexing
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pg_trgm');

  // 2. Add GIN indexes for Customers (fuzzy search on name, display_id, and contact)
  pgm.sql(`
    CREATE INDEX idx_customers_search_gin ON customers USING gin (
      name gin_trgm_ops, 
      display_id gin_trgm_ops, 
      contact gin_trgm_ops
    )
  `);

  // 3. Add GIN indexes for Orders (fuzzy search on display_id and product_summary)
  pgm.sql(`
    CREATE INDEX idx_orders_search_gin ON orders USING gin (
      display_id gin_trgm_ops, 
      product_summary gin_trgm_ops
    )
  `);

  // 4. Add GIN indexes for Tasks (fuzzy search on title and description)
  pgm.sql(`
    CREATE INDEX idx_tasks_search_gin ON tasks USING gin (
      title gin_trgm_ops, 
      description gin_trgm_ops
    )
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_tasks_search_gin');
  pgm.sql('DROP INDEX IF EXISTS idx_orders_search_gin');
  pgm.sql('DROP INDEX IF EXISTS idx_customers_search_gin');
  pgm.sql('DROP EXTENSION IF EXISTS pg_trgm');
};
