export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS input_invoices (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      supplier_name TEXT,
      invoice_no TEXT,
      invoice_type TEXT NOT NULL DEFAULT 'vat_special',
      invoice_status TEXT NOT NULL DEFAULT 'pending',
      invoice_amount_cny NUMERIC DEFAULT 0,
      verified_amount_cny NUMERIC DEFAULT 0,
      invoice_date TEXT,
      remark TEXT,
      waived_by INTEGER REFERENCES users(id),
      waived_at TIMESTAMP,
      waived_reason TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_input_invoices_order_id
      ON input_invoices (order_id)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_input_invoices_status
      ON input_invoices (invoice_status)
      WHERE deleted_at IS NULL;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_input_invoices_status;
    DROP INDEX IF EXISTS idx_input_invoices_order_id;
    DROP TABLE IF EXISTS input_invoices;
  `);
};
