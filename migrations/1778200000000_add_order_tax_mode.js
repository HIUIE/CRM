export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS tax_mode TEXT DEFAULT 'A';

    UPDATE orders
      SET tax_mode = 'A'
      WHERE tax_mode IS NULL OR tax_mode = '';

    CREATE INDEX IF NOT EXISTS idx_orders_tax_mode
      ON orders (tax_mode);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_orders_tax_mode;
    ALTER TABLE orders
      DROP COLUMN IF EXISTS tax_mode;
  `);
};
