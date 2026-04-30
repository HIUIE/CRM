/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE logistics_records
      ADD COLUMN IF NOT EXISTS freight_forwarder_partner_id INTEGER;

    CREATE INDEX IF NOT EXISTS idx_logistics_forwarder_partner
      ON logistics_records (freight_forwarder_partner_id)
      WHERE freight_forwarder_partner_id IS NOT NULL;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_logistics_forwarder_partner;
    ALTER TABLE logistics_records
      DROP COLUMN IF EXISTS freight_forwarder_partner_id;
  `);
};
