/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // P12: Ensure all critical entities have updated_at for reconciliation and audit
  const tables = [
    'orders',
    'customers',
    'partners',
    'finance_records',
    'logistics_records',
    'customs_records',
    'tasks',
    'users'
  ];

  for (const table of tables) {
    pgm.sql(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  }
};

export const down = (pgm) => {
  // Irreversible; removing columns can break code relying on them
};
