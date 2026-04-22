import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DB_PATH = path.join(__dirname, '..', 'erp_database_v2.sqlite');

export let db: Database;

async function ensureColumn(table: string, column: string, definition: string) {
  const columns = await db.all<{ name: string }[]>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function runMigrations() {
  await db.exec('PRAGMA foreign_keys = ON;');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      name TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      country TEXT,
      contact TEXT,
      logistics_preference TEXT,
      payment_terms TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      partner_type TEXT NOT NULL,
      country TEXT,
      contact TEXT,
      payment_terms TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_id TEXT UNIQUE,
      customer_id INTEGER,
      status TEXT,
      details TEXT,
      total_amount REAL,
      product_summary TEXT,
      delivery_date TEXT,
      key_milestone TEXT,
      freight_amount REAL DEFAULT 0,
      misc_amount REAL DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      specification TEXT,
      quantity REAL NOT NULL,
      unit TEXT,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS finance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      partner_id INTEGER,
      type TEXT,
      amount REAL,
      target TEXT,
      status TEXT,
      remark TEXT,
      currency TEXT,
      payment_category TEXT,
      record_category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(partner_id) REFERENCES partners(id)
    );

    CREATE TABLE IF NOT EXISTS logistics_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      tracking_no TEXT,
      carrier TEXT,
      packing_details TEXT,
      status TEXT,
      shipping_date TEXT,
      segment_type TEXT,
      package_count REAL,
      volume_cbm REAL,
      gross_weight_kg REAL,
      incoterm TEXT,
      transport_mode TEXT,
      vessel_voyage TEXT,
      bill_no TEXT,
      etd TEXT,
      eta TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS customs_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      status TEXT,
      broker_name TEXT,
      declaration_no TEXT,
      declaration_date TEXT,
      release_date TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS production_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      partner_id INTEGER,
      order_date TEXT,
      estimated_delivery_date TEXT,
      production_status TEXT,
      inspection_status TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(partner_id) REFERENCES partners(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT,
      entity_id INTEGER,
      file_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      file_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await ensureColumn('orders', 'product_summary', 'TEXT');
  await ensureColumn('orders', 'delivery_date', 'TEXT');
  await ensureColumn('orders', 'key_milestone', 'TEXT');
  await ensureColumn('orders', 'freight_amount', 'REAL DEFAULT 0');
  await ensureColumn('orders', 'misc_amount', 'REAL DEFAULT 0');
  await ensureColumn('order_items', 'image_url', 'TEXT');
  await ensureColumn('finance_records', 'partner_id', 'INTEGER');
  await ensureColumn('finance_records', 'currency', 'TEXT');
  await ensureColumn('finance_records', 'payment_category', 'TEXT');
  await ensureColumn('finance_records', 'record_category', 'TEXT');
  await ensureColumn('logistics_records', 'shipping_date', 'TEXT');
  await ensureColumn('logistics_records', 'segment_type', 'TEXT');
  await ensureColumn('logistics_records', 'package_count', 'REAL');
  await ensureColumn('logistics_records', 'volume_cbm', 'REAL');
  await ensureColumn('logistics_records', 'gross_weight_kg', 'REAL');
  await ensureColumn('logistics_records', 'incoterm', 'TEXT');
  await ensureColumn('logistics_records', 'transport_mode', 'TEXT');
  await ensureColumn('logistics_records', 'vessel_voyage', 'TEXT');
  await ensureColumn('logistics_records', 'bill_no', 'TEXT');
  await ensureColumn('logistics_records', 'etd', 'TEXT');
  await ensureColumn('logistics_records', 'eta', 'TEXT');
  await ensureColumn('logistics_records', 'remark', 'TEXT');

  await db.run(
    `
      UPDATE finance_records
      SET currency = CASE
        WHEN type = 'receipt' THEN 'USD'
        ELSE 'CNY'
      END
      WHERE currency IS NULL OR TRIM(currency) = ''
    `,
  );

  await db.run(
    `
      UPDATE finance_records
      SET payment_category = CASE
        WHEN type = 'receipt' THEN 'receipt'
        ELSE 'other'
      END
      WHERE payment_category IS NULL OR TRIM(payment_category) = ''
    `,
  );

  await db.run(
    `
      UPDATE finance_records
      SET record_category = CASE
        WHEN type = 'receipt' THEN 'deposit'
        WHEN payment_category = 'freight' THEN 'freight'
        WHEN payment_category = 'goods' THEN 'goods'
        ELSE 'other'
      END
      WHERE record_category IS NULL OR TRIM(record_category) = ''
    `,
  );

  await db.run(
    `
      UPDATE orders
      SET product_summary = SUBSTR(TRIM(details), 1, 120)
      WHERE (product_summary IS NULL OR TRIM(product_summary) = '')
        AND details IS NOT NULL
        AND TRIM(details) != ''
    `,
  );

  await db.run(
    `
      UPDATE orders
      SET freight_amount = 0
      WHERE freight_amount IS NULL
    `,
  );

  await db.run(
    `
      UPDATE orders
      SET misc_amount = 0
      WHERE misc_amount IS NULL
    `,
  );

  await db.run(
    `
      UPDATE orders
      SET status = CASE
        WHEN status = 'confirmed' THEN 'production'
        WHEN status = 'shipped' THEN 'shipping'
        ELSE status
      END
      WHERE status IN ('confirmed', 'shipped')
    `,
  );

  await db.run(
    `
      UPDATE logistics_records
      SET segment_type = 'international'
      WHERE segment_type IS NULL OR TRIM(segment_type) = ''
    `,
  );

  const ordersWithoutDisplayId = await db.all<{ id: number; created_at: string }[]>(
    `SELECT id, created_at FROM orders WHERE display_id IS NULL OR TRIM(display_id) = ''`,
  );
  for (const order of ordersWithoutDisplayId) {
    const year = new Date(order.created_at).getFullYear();
    const displayId = `ORD-${year}-${String(order.id).padStart(6, '0')}`;
    await db.run(`UPDATE orders SET display_id = ? WHERE id = ?`, [displayId, order.id]);
  }
}

async function seedRootUser() {
  const root = await db.get<{ id: number }>(`SELECT id FROM users WHERE username = ?`, ['root']);
  if (!root) {
    const hash = await bcrypt.hash('root', 10);
    await db.run(
      `INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)`,
      ['root', hash, 'admin', 'Super Admin'],
    );
  }
}

export async function initDb() {
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  await runMigrations();
  await seedRootUser();
}
