export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE attachments
      ADD COLUMN IF NOT EXISTS uploaded_by INTEGER;

    CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by
      ON attachments (uploaded_by);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_attachments_uploaded_by;
    ALTER TABLE attachments
      DROP COLUMN IF EXISTS uploaded_by;
  `);
};
