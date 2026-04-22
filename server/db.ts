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
    filename: path.join(__dirname, '..', 'database.sqlite'),
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE,
      customer_id INTEGER,
      status TEXT, -- draft, confirmed, pending_shipment, shipped, completed
      total_amount REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
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
