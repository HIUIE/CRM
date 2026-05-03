import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database | null = null;

function resolveDbPath(): string {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;
  const dataDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, 'crm.db');
}

function runMigrations(database: Database.Database) {
  // SQLite-compatible schema — equivalent to the PostgreSQL migrations
  database.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      name TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
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
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      partner_type TEXT NOT NULL,
      country TEXT,
      contact TEXT,
      payment_terms TEXT,
      remark TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_id TEXT UNIQUE,
      customer_id INTEGER REFERENCES customers(id),
      status TEXT,
      details TEXT,
      total_amount REAL,
      product_summary TEXT,
      delivery_date TEXT,
      key_milestone TEXT,
      freight_amount REAL DEFAULT 0,
      misc_amount REAL DEFAULT 0,
      quick_notes TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      specification TEXT,
      hs_code TEXT,
      quantity REAL NOT NULL,
      unit TEXT,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      image_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS finance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id),
      partner_id INTEGER REFERENCES partners(id),
      type TEXT,
      amount REAL,
      target TEXT,
      status TEXT,
      remark TEXT,
      currency TEXT,
      payment_category TEXT,
      record_category TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS logistics_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id),
      tracking_no TEXT,
      carrier TEXT,
      freight_forwarder TEXT,
      freight_forwarder_partner_id INTEGER REFERENCES partners(id),
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
      recipient_address TEXT,
      package_size TEXT,
      remark TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS customs_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT,
      broker_name TEXT,
      declaration_no TEXT,
      declaration_date TEXT,
      release_date TEXT,
      remark TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_profits (
      order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS production_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      partner_id INTEGER REFERENCES partners(id),
      order_date TEXT,
      estimated_delivery_date TEXT,
      production_status TEXT,
      inspection_status TEXT,
      remark TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS production_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      log_date TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS packing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      package_count REAL,
      package_size TEXT,
      gross_weight REAL,
      net_weight REAL,
      attachment_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now')),
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action_type TEXT,
      entity_type TEXT,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      title TEXT,
      email TEXT,
      contact TEXT,
      is_primary INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      channel TEXT DEFAULT 'other',
      created_by INTEGER REFERENCES users(id),
      created_by_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      assignee_id INTEGER NOT NULL REFERENCES users(id),
      due_date TEXT NOT NULL,
      priority TEXT DEFAULT 'P2',
      status TEXT DEFAULT 'todo',
      entity_type TEXT,
      entity_id TEXT,
      description TEXT,
      comment_count INTEGER DEFAULT 0,
      attachment_count INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      attachment_id INTEGER NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      comment_id INTEGER
    );

    -- Business indexes (SQLite creates indexes for PKs/UNIQUEs automatically)
    CREATE INDEX IF NOT EXISTS idx_orders_customer_deleted ON orders (customer_id, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_finance_order_status ON finance_records (order_id, status);
    CREATE INDEX IF NOT EXISTS idx_logistics_order_deleted ON logistics_records (order_id, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments (entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_entity_assignee ON tasks (entity_type, entity_id, assignee_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_production_plans_order ON production_plans (order_id);
    CREATE INDEX IF NOT EXISTS idx_customer_followups_customer ON customer_followups (customer_id);
    CREATE INDEX IF NOT EXISTS idx_order_follow_ups_order ON order_follow_ups (order_id);
    CREATE INDEX IF NOT EXISTS idx_logistics_forwarder ON logistics_records (freight_forwarder_partner_id);

    -- Seed defaults
    INSERT OR IGNORE INTO settings (key, value) VALUES ('site_name', 'SmartTrade AI CRM');
    INSERT OR IGNORE INTO users (username, password, role, name, active)
      VALUES ('root', '$2a$10$w8.223Yx9c1t79119nQ1jOPR/r2qY2kS.D71p5G.k8h/bZ3YI3eOq', 'admin', 'Super Admin', 1);
  `);
}

export function initSqliteDatabase() {
  const dbPath = resolveDbPath();
  db = new Database(dbPath);

  // Performance pragmas
  db.pragma('journal_mode=WAL');
  db.pragma('foreign_keys=ON');
  db.pragma('busy_timeout=5000');

  runMigrations(db);
  console.log(`[db] SQLite database ready at ${dbPath}`);
}

export function getSqliteDb(): Database.Database {
  if (!db) throw new Error('SQLite database not initialized. Call initSqliteDatabase() first.');
  return db;
}

export function closeSqliteDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * SQLite executor compatible with the db.ts abstraction layer.
 * SQLite uses ? placeholders natively, so no conversion is needed.
 */
export function createSqliteExecutor(database: Database.Database) {
  return {
    query(sql: string, params: any[] = []) {
      const stmt = database.prepare(sql);
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT')
        || sql.trim().toUpperCase().startsWith('WITH')
        || sql.trim().toUpperCase().startsWith('PRAGMA');
      const isReturning = sql.toUpperCase().includes('RETURNING');

      if (isSelect || isReturning) {
        return { rows: stmt.all(...params) };
      }

      // For INSERT/UPDATE/DELETE, use run()
      const result = stmt.run(...params);
      return { rows: [], rowCount: result.changes, lastID: Number(result.lastInsertRowid) };
    },
  };
}
