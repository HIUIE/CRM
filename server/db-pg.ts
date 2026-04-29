import pkg from 'pg';
const { Pool } = pkg;

function buildPgConfig() {
  // Support DATABASE_URL connection string (common for cloud providers like Neon/Supabase)
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    };
  }

  const ssl = process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

  return {
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT) || 5432,
    database: process.env.PG_DATABASE || 'smarttrade_crm',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    ssl,
    max: 10,
    idleTimeoutMillis: 30000,
  };
}

const pgConfig = buildPgConfig();

/**
 * Shared PostgreSQL connection pool — single instance for the entire app.
 * Imported by server/lib/db.ts to avoid creating duplicate pools.
 */
export const pgPool = new Pool(pgConfig);

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

  const ssl = process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

  await runner({
    databaseUrl: process.env.DATABASE_URL || {
      host: process.env.PG_HOST || 'localhost',
      port: Number(process.env.PG_PORT) || 5432,
      database: process.env.PG_DATABASE || 'smarttrade_crm',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
      ssl,
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
