export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

    UPDATE orders
      SET currency = 'USD'
      WHERE currency IS NULL OR currency = '';

    CREATE INDEX IF NOT EXISTS idx_orders_currency
      ON orders (currency);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_orders_currency;
    ALTER TABLE orders
      DROP COLUMN IF EXISTS currency;
  `);
};
