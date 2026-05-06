/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // P13: Fix schema drifts where code expects columns that were never added to migrations
  
  // Partners table missing fields
  pgm.sql(`
    ALTER TABLE partners 
      ADD COLUMN IF NOT EXISTS contact_person TEXT,
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0
  `);

  // Customs table missing fields
  pgm.sql(`
    ALTER TABLE customs_records 
      ADD COLUMN IF NOT EXISTS trade_mode TEXT
  `);

  // Logistics table missing fields
  pgm.sql(`
    ALTER TABLE logistics_records 
      ADD COLUMN IF NOT EXISTS recipient_address TEXT,
      ADD COLUMN IF NOT EXISTS package_size TEXT
  `);

  // Users table (ensure token_version is also in migrations, not just manual init)
  pgm.sql(`
    ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1
  `);
};

export const down = (pgm) => {
  // Irreversible
};
