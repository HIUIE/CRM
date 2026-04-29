import pkg from 'pg';
const { Pool } = pkg;

/**
 * Shared PostgreSQL connection pool — single instance for the entire app.
 * Imported by server/lib/db.ts to avoid creating duplicate pools.
 */
export const pgPool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE || 'smarttrade_crm',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000,
});

import { runner } from 'node-pg-migrate';
import path from 'path';
import { fileURLToPath } from 'url';

const pool = pgPool;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initPgTables() {
  const client = await pool.connect();
  try {
    // Basic connectivity check
    await client.query('SELECT 1');
  } finally {
    client.release();
  }

  const migrationsDir = path.join(__dirname, '..', 'migrations');

  await runner({
    databaseUrl: {
      host: process.env.PG_HOST || 'localhost',
      port: Number(process.env.PG_PORT) || 5432,
      database: process.env.PG_DATABASE || 'smarttrade_crm',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
    },
    dir: migrationsDir,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: (msg: string) => console.log(`[db] ${msg}`)
  });
}

export const pgDb = {
  async query<T>(text: string, params?: unknown[]): Promise<T> {
    const result = await pool.query(text, params);
    return result.rows as T;
  },
  async end() {
    await pool.end();
  },
};

export default pool;
