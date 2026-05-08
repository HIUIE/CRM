/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS alibaba_order_no TEXT;
  `);
};

export const down = (pgm) => {
  // Irreversible
};
