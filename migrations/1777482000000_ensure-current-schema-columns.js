/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * Bring databases created by older app versions up to the current column set.
 *
 * The initial migration uses CREATE TABLE IF NOT EXISTS, which is fine for a
 * fresh install but does not add newer columns to existing tables.
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS display_id TEXT,
      ADD COLUMN IF NOT EXISTS logistics_preference TEXT,
      ADD COLUMN IF NOT EXISTS payment_terms TEXT,
      ADD COLUMN IF NOT EXISTS source_channel TEXT,
      ADD COLUMN IF NOT EXISTS intent_products TEXT,
      ADD COLUMN IF NOT EXISTS created_by INTEGER,
      ADD COLUMN IF NOT EXISTS updated_by INTEGER,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

    ALTER TABLE partners
      ADD COLUMN IF NOT EXISTS partner_type TEXT,
      ADD COLUMN IF NOT EXISTS country TEXT,
      ADD COLUMN IF NOT EXISTS contact TEXT,
      ADD COLUMN IF NOT EXISTS payment_terms TEXT,
      ADD COLUMN IF NOT EXISTS remark TEXT,
      ADD COLUMN IF NOT EXISTS created_by INTEGER,
      ADD COLUMN IF NOT EXISTS updated_by INTEGER,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS display_id TEXT,
      ADD COLUMN IF NOT EXISTS customer_id INTEGER,
      ADD COLUMN IF NOT EXISTS status TEXT,
      ADD COLUMN IF NOT EXISTS details TEXT,
      ADD COLUMN IF NOT EXISTS total_amount REAL,
      ADD COLUMN IF NOT EXISTS product_summary TEXT,
      ADD COLUMN IF NOT EXISTS delivery_date TEXT,
      ADD COLUMN IF NOT EXISTS key_milestone TEXT,
      ADD COLUMN IF NOT EXISTS freight_amount REAL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS misc_amount REAL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS quick_notes TEXT,
      ADD COLUMN IF NOT EXISTS created_by INTEGER,
      ADD COLUMN IF NOT EXISTS updated_by INTEGER,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

    ALTER TABLE finance_records
      ADD COLUMN IF NOT EXISTS order_id INTEGER,
      ADD COLUMN IF NOT EXISTS partner_id INTEGER,
      ADD COLUMN IF NOT EXISTS type TEXT,
      ADD COLUMN IF NOT EXISTS amount REAL,
      ADD COLUMN IF NOT EXISTS target TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT,
      ADD COLUMN IF NOT EXISTS remark TEXT,
      ADD COLUMN IF NOT EXISTS currency TEXT,
      ADD COLUMN IF NOT EXISTS payment_category TEXT,
      ADD COLUMN IF NOT EXISTS record_category TEXT,
      ADD COLUMN IF NOT EXISTS created_by INTEGER,
      ADD COLUMN IF NOT EXISTS updated_by INTEGER,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

    ALTER TABLE logistics_records
      ADD COLUMN IF NOT EXISTS order_id INTEGER,
      ADD COLUMN IF NOT EXISTS tracking_no TEXT,
      ADD COLUMN IF NOT EXISTS carrier TEXT,
      ADD COLUMN IF NOT EXISTS freight_forwarder TEXT,
      ADD COLUMN IF NOT EXISTS freight_forwarder_partner_id INTEGER,
      ADD COLUMN IF NOT EXISTS packing_details TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT,
      ADD COLUMN IF NOT EXISTS shipping_date TEXT,
      ADD COLUMN IF NOT EXISTS segment_type TEXT,
      ADD COLUMN IF NOT EXISTS package_count REAL,
      ADD COLUMN IF NOT EXISTS volume_cbm REAL,
      ADD COLUMN IF NOT EXISTS gross_weight_kg REAL,
      ADD COLUMN IF NOT EXISTS incoterm TEXT,
      ADD COLUMN IF NOT EXISTS transport_mode TEXT,
      ADD COLUMN IF NOT EXISTS vessel_voyage TEXT,
      ADD COLUMN IF NOT EXISTS bill_no TEXT,
      ADD COLUMN IF NOT EXISTS etd TEXT,
      ADD COLUMN IF NOT EXISTS eta TEXT,
      ADD COLUMN IF NOT EXISTS recipient_address TEXT,
      ADD COLUMN IF NOT EXISTS package_size TEXT,
      ADD COLUMN IF NOT EXISTS remark TEXT,
      ADD COLUMN IF NOT EXISTS created_by INTEGER,
      ADD COLUMN IF NOT EXISTS updated_by INTEGER,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

    ALTER TABLE customs_records
      ADD COLUMN IF NOT EXISTS order_id INTEGER,
      ADD COLUMN IF NOT EXISTS status TEXT,
      ADD COLUMN IF NOT EXISTS broker_name TEXT,
      ADD COLUMN IF NOT EXISTS declaration_no TEXT,
      ADD COLUMN IF NOT EXISTS declaration_date TEXT,
      ADD COLUMN IF NOT EXISTS release_date TEXT,
      ADD COLUMN IF NOT EXISTS remark TEXT,
      ADD COLUMN IF NOT EXISTS created_by INTEGER,
      ADD COLUMN IF NOT EXISTS updated_by INTEGER,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE attachments
      ADD COLUMN IF NOT EXISTS entity_type TEXT,
      ADD COLUMN IF NOT EXISTS entity_id INTEGER,
      ADD COLUMN IF NOT EXISTS file_name TEXT,
      ADD COLUMN IF NOT EXISTS stored_name TEXT,
      ADD COLUMN IF NOT EXISTS mime_type TEXT,
      ADD COLUMN IF NOT EXISTS file_size INTEGER,
      ADD COLUMN IF NOT EXISTS file_path TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS remark TEXT;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS assignee_id INTEGER,
      ADD COLUMN IF NOT EXISTS due_date TEXT,
      ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'P2',
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo',
      ADD COLUMN IF NOT EXISTS entity_type TEXT,
      ADD COLUMN IF NOT EXISTS entity_id TEXT,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS attachment_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS created_by INTEGER,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);
};

export const down = () => {
  // Intentionally irreversible; removing compatibility columns can destroy user data.
};
