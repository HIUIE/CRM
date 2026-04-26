import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DB_PATH = process.env.CRM_DB_PATH || path.join(__dirname, '..', 'erp_database_v2.sqlite');

export let db: Database;

async function ensureColumn(table: string, column: string, definition: string) {
  const columns = await db.all<{ name: string }[]>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    const safeDefinition = definition.replace(/\s+DEFAULT\s+CURRENT_TIMESTAMP/i, '');
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${safeDefinition}`);
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
      name TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_id TEXT UNIQUE,
      name TEXT,
      country TEXT,
      contact TEXT,
      logistics_preference TEXT,
      payment_terms TEXT,
      source_channel TEXT,
      intent_products TEXT,
      created_by INTEGER,
      updated_by INTEGER,
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
      created_by INTEGER,
      updated_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      updated_by INTEGER,
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
      created_by INTEGER,
      updated_by INTEGER,
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
      created_by INTEGER,
      updated_by INTEGER,
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
      created_by INTEGER,
      updated_by INTEGER,
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
      created_by INTEGER,
      updated_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(partner_id) REFERENCES partners(id)
    );

    CREATE TABLE IF NOT EXISTS production_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(plan_id) REFERENCES production_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS packing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      package_count REAL,
      package_size TEXT,
      gross_weight REAL,
      net_weight REAL,
      attachment_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(attachment_id) REFERENCES attachments(id) ON DELETE SET NULL
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

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action_type TEXT, -- CREATE, UPDATE, DELETE
      entity_type TEXT, -- ORDER, CUSTOMER, FINANCE, etc.
      entity_id TEXT,
      old_value TEXT, -- JSON
      new_value TEXT, -- JSON
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customer_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      title TEXT,
      email TEXT,
      contact TEXT,
      is_primary INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customer_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      channel TEXT DEFAULT 'other',
      created_by INTEGER,
      created_by_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      assignee_id INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      priority TEXT DEFAULT 'P2', -- P0, P1, P2
      status TEXT DEFAULT 'todo', -- todo, in_progress, done
      entity_type TEXT, -- ORDER, CUSTOMER
      entity_id TEXT,
      description TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(assignee_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS order_follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      attachment_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY(attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
    );
  `);

  await ensureColumn('task_attachments', 'comment_id', 'INTEGER');
  await ensureColumn('tasks', 'comment_count', 'INTEGER DEFAULT 0');
  await ensureColumn('tasks', 'attachment_count', 'INTEGER DEFAULT 0');
  await ensureColumn('orders', 'delivery_date', 'TEXT');
  await ensureColumn('orders', 'key_milestone', 'TEXT');
  await ensureColumn('orders', 'freight_amount', 'REAL DEFAULT 0');
  await ensureColumn('orders', 'misc_amount', 'REAL DEFAULT 0');
  await ensureColumn('orders', 'updated_by', 'INTEGER');
  await ensureColumn('order_items', 'image_url', 'TEXT');
  await ensureColumn('users', 'active', 'INTEGER DEFAULT 1');
  await ensureColumn('users', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn('users', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn('partners', 'created_by', 'INTEGER');
  await ensureColumn('partners', 'updated_by', 'INTEGER');
  await ensureColumn('partners', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn('customers', 'updated_by', 'INTEGER');
  await ensureColumn('customers', 'display_id', 'TEXT');
  await ensureColumn('customers', 'source_channel', 'TEXT');
  await ensureColumn('customers', 'intent_products', 'TEXT');
  await ensureColumn('customer_contacts', 'email', 'TEXT');
  await ensureColumn('customer_contacts', 'is_primary', 'INTEGER DEFAULT 0');
  await ensureColumn('finance_records', 'partner_id', 'INTEGER');
  await ensureColumn('finance_records', 'currency', 'TEXT');
  await ensureColumn('finance_records', 'payment_category', 'TEXT');
  await ensureColumn('finance_records', 'record_category', 'TEXT');
  await ensureColumn('finance_records', 'created_by', 'INTEGER');
  await ensureColumn('finance_records', 'updated_by', 'INTEGER');
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
  await ensureColumn('logistics_records', 'created_by', 'INTEGER');
  await ensureColumn('logistics_records', 'updated_by', 'INTEGER');
  await ensureColumn('customs_records', 'created_by', 'INTEGER');
  await ensureColumn('customs_records', 'updated_by', 'INTEGER');
  await ensureColumn('production_plans', 'created_by', 'INTEGER');
  await ensureColumn('production_plans', 'updated_by', 'INTEGER');
  await ensureColumn('packing_records', 'attachment_id', 'INTEGER');
  await ensureColumn('attachments', 'remark', 'TEXT');

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

  await db.run(
    `
      UPDATE users
      SET active = 1
      WHERE active IS NULL
    `,
  );

  await db.run(
    `
      UPDATE users
      SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
      WHERE created_at IS NULL OR updated_at IS NULL
    `,
  );

  await db.run(
    `
      UPDATE partners
      SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
      WHERE updated_at IS NULL
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

  // Generate display_id for customers that don't have one
  const customersWithoutDisplayId = await db.all<{ id: number; created_at: string }[]>(
    `SELECT id, created_at FROM customers WHERE display_id IS NULL OR TRIM(display_id) = ''`,
  );
  for (const customer of customersWithoutDisplayId) {
    const year = new Date(customer.created_at).getFullYear();
    const displayId = `CUST-${year}-${String(customer.id).padStart(6, '0')}`;
    await db.run(`UPDATE customers SET display_id = ? WHERE id = ?`, [displayId, customer.id]);
  }
}

async function seedRootUser() {
  const root = await db.get<{ id: number }>(`SELECT id FROM users WHERE username = ?`, ['root']);
  if (!root) {
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'root');
    if (!initialPassword) {
      throw new Error('生产环境首次初始化必须设置 INITIAL_ADMIN_PASSWORD');
    }
    const hash = await bcrypt.hash(initialPassword, 10);
    await db.run(
      `INSERT INTO users (username, password, role, name, active) VALUES (?, ?, ?, ?, 1)`,
      ['root', hash, 'admin', 'Super Admin'],
    );
  } else {
    await db.run(`UPDATE users SET active = 1 WHERE username = 'root'`);
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
