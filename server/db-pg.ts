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

  const ssl = process.env.PG_SSL === 'true'
    ? { rejectUnauthorized: process.env.PG_SSL_ALLOW_SELF_SIGNED !== 'true' }
    : undefined;

  return {
    host: process.env.PG_HOST || '127.0.0.1',
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
pgPool.on('error', (err) => {
  console.error('[pg-pool] Unexpected error on idle client:', err.message);
});

import { runner } from 'node-pg-migrate';
import path from 'path';
import { fileURLToPath } from 'url';

const pool = pgPool;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initPgTables() {
  // P11: Safety check moved here to ensure env is loaded via env.ts/dotenv
  const hasAuth = process.env.DATABASE_URL || process.env.PG_PASSWORD;
  if (!hasAuth) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境必须设置 PG_PASSWORD 或 DATABASE_URL');
    }
    console.warn('[db] 注意：未检测到 PG_PASSWORD，将尝试无密码连接数据库。');
  }

  const migrationsDir = path.join(__dirname, '..', 'migrations');

  const ssl = process.env.PG_SSL === 'true'
    ? { rejectUnauthorized: process.env.PG_SSL_ALLOW_SELF_SIGNED !== 'true' }
    : undefined;

  // 1. Run migrations first to ensure tables like 'users' exist
  await runner({
    databaseUrl: process.env.DATABASE_URL || {
      host: process.env.PG_HOST || '127.0.0.1',
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

  // 2. Perform manual schema adjustments after tables are created
  const client = await pool.connect();
  try {
    // Basic connectivity check
    await client.query('SELECT 1');
    // Ensure token_version column exists for JWT revocation support
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1');
    // Ensure alibaba_order_no column exists for orders
    await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS alibaba_order_no TEXT');
    // Persistent login rate limiter table
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        ip TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at BIGINT NOT NULL
      )
    `);
  } finally {
    client.release();
  }
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
