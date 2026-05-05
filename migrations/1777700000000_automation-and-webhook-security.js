/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // P14: Automatic Logistics Tracking support
  pgm.addColumns('logistics_records', {
    tracking_history: { type: 'jsonb' },
    last_tracked_at: { type: 'timestamp', null: true }
  });

  // P4: Webhook Security support
  // No table change needed, just adding a common key to settings later
};

export const down = (pgm) => {
  pgm.dropColumns('logistics_records', ['tracking_history', 'last_tracked_at']);
};
