/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // P10: Consistent Soft Delete
  pgm.addColumns('order_items', {
    deleted_at: { type: 'timestamp', null: true }
  });
  pgm.addColumns('customs_records', {
    deleted_at: { type: 'timestamp', null: true }
  });

  // P7: Exchange Rate Snapshot
  pgm.addColumns('orders', {
    exchange_rate_snapshot: { type: 'real', default: 7.2 }
  });
  pgm.addColumns('finance_records', {
    exchange_rate_snapshot: { type: 'real', default: 1.0 }
  });

  // P8: Multi-contact support for partners
  pgm.createTable('partner_contacts', {
    id: 'id',
    partner_id: {
      type: 'integer',
      notNull: true,
      references: '"partners"',
      onDelete: 'CASCADE'
    },
    name: { type: 'text', notNull: true },
    title: { type: 'text' },
    email: { type: 'text' },
    phone: { type: 'text' },
    is_primary: { type: 'boolean', default: false },
    remark: { type: 'text' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Migrate existing partner contact info to the new table if applicable
  // Existing 'partners' table has 'contact' column (string)
  pgm.sql(`
    INSERT INTO partner_contacts (partner_id, name, is_primary)
    SELECT id, COALESCE(NULLIF(contact, ''), '默认联系人'), true
    FROM partners
    WHERE contact IS NOT NULL AND contact != ''
  `);
};

export const down = (pgm) => {
  pgm.dropTable('partner_contacts');
  pgm.dropColumns('finance_records', ['exchange_rate_snapshot']);
  pgm.dropColumns('orders', ['exchange_rate_snapshot']);
  pgm.dropColumns('customs_records', ['deleted_at']);
  pgm.dropColumns('order_items', ['deleted_at']);
};
