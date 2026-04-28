import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pkg from 'pg';
import path from 'path';

const { Pool } = pkg;
const pgPool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE || 'smarttrade_crm',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
});

// Ensure columns exist that the old schema has but PG schema might be missing
async function ensureColumns() {
  const missingCols: Record<string, [string, string][]> = {
    orders: [['quick_notes', 'TEXT']],
    order_items: [['hs_code', 'TEXT']],
    partners: [['rating', 'INTEGER DEFAULT 0'], ['contact_person', 'TEXT'], ['address', 'TEXT']],
    customs_records: [['trade_mode', 'TEXT'], ['declaration_no', 'TEXT'], ['declaration_date', 'TEXT'], ['release_date', 'TEXT']],
    production_logs: [['log_date', 'TEXT']],
    tasks: [['comment_count', 'INTEGER DEFAULT 0'], ['attachment_count', 'INTEGER DEFAULT 0']],
    packing_records: [['gross_weight', 'REAL'], ['net_weight', 'REAL'], ['package_size', 'TEXT']],
  };
  for (const [table, cols] of Object.entries(missingCols)) {
    for (const [col, type] of cols) {
      try { await pgPool.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch { /* exists */ }
    }
  }
}

function cleanVal(val: unknown, col: string): any {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === '') return null;
  // Convert empty strings to null for numeric/real columns
  const numericCols = ['rating', 'package_count', 'volume_cbm', 'gross_weight_kg', 'incoterm',
    'package_size', 'gross_weight', 'net_weight', 'comment_count', 'attachment_count'];
  if (numericCols.some(c => col.endsWith(c)) && s === '') return null;
  return val;
}

async function migrate() {
  const sqlitePath = process.env.CRM_DB_PATH || path.join(process.cwd(), 'data', 'erp_database_v2.sqlite');
  console.log('Reading SQLite:', sqlitePath);
  const sqlite = await open({ filename: sqlitePath, driver: sqlite3.Database });

  // Initialize tables first
  const { initPgTables } = await import('../server/db-pg.js');
  await initPgTables();

  await ensureColumns();

  // Migrate in dependency order (parents before children to avoid FK errors)
  const tableOrder = [
    'users', 'settings', 'customers', 'partners', 'orders',
    'order_items', 'finance_records', 'production_plans', 'production_logs',
    'logistics_records', 'customs_records', 'packing_records', 'attachments',
    'audit_logs', 'customer_contacts', 'customer_followups',
    'tasks', 'task_comments', 'task_attachments',
    'notifications', 'order_follow_ups',
  ];

  // Temporarily disable FK constraints for the migration
  await pgPool.query('SET session_replication_role = replica');

  for (const table of tableOrder) {
    const rows = await sqlite.all(`SELECT * FROM ${table}`);
    if (!rows.length) { console.log(`  ${table}: 0 rows`); continue; }

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const cols = columns.join(', ');
    const insertSql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    let inserted = 0;
    for (const row of rows) {
      try {
        const vals = columns.map(c => cleanVal((row as any)[c], c));
        await pgPool.query(insertSql, vals);
        inserted++;
      } catch (err: any) {
        // Try without ON CONFLICT for detailed error
        try {
          const vals = columns.map(c => cleanVal((row as any)[c], c));
          await pgPool.query(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, vals);
          inserted++;
        } catch { /* skip problematic rows */ }
      }
    }
    console.log(`  ${table}: ${rows.length} rows, ${inserted} inserted`);
  }

  // Re-enable FK constraints
  await pgPool.query('SET session_replication_role = origin');

  // Fix sequences
  for (const table of tableOrder) {
    try { await pgPool.query(`SELECT setval('${table}_id_seq', (SELECT COALESCE(MAX(id), 1) FROM ${table}))`); } catch { /* skip */ }
  }

  console.log('\n✅ Migration complete!');
  await sqlite.close();
  await pgPool.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
