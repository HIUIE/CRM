import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export let db: Database;

export async function initDb() {
  db = await open({
    filename: path.join(__dirname, '..', 'erp_database_v2.sqlite'),
    driver: sqlite3.Database
  });

  // Init tables
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

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_id TEXT UNIQUE,
      customer_id INTEGER,
      status TEXT,
      details TEXT,
      total_amount REAL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS finance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      type TEXT,
      amount REAL,
      target TEXT,
      status TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS logistics_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      tracking_no TEXT,
      carrier TEXT,
      packing_details TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    );
  `);

  // Seed root user
  const root = await db.get(`SELECT id FROM users WHERE username = ?`, ['root']);
  if (!root) {
    const hash = await bcrypt.hash('root', 10);
    await db.run(
      `INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)`,
      ['root', hash, 'admin', 'Super Admin']
    );
  }
}
