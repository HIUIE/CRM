import pkg from 'pg';
import { pgPool } from '../db-pg.js';

const { Pool } = pkg;
type PgClient = InstanceType<typeof Pool> extends { connect: () => Promise<infer T> } ? T : never;

// Reuse the single shared PG pool from db-pg.ts (avoids duplicate connection pools)
const pool = pgPool;

// Convert standard SQL queries with ? to PostgreSQL-compatible $1, $2, etc.
function pgParams(sql: string, params: any[]): [string, any[]] {
  let idx = 0;
  const _sql = sql; // keep original for GROUP BY analysis (before transforms)
  const result = sql
    // Convert ? to $1, $2, ...
    .replace(/\?/g, () => `$${++idx}`)
    // Strip datetime(col) → col (PG sorts TIMESTAMP natively)
    .replace(/\bdatetime\((\w+(?:\.\w+)?)\)/g, '$1')
    // Convert LIKE to ILIKE for case-insensitive search (works great with pg_trgm GIN indexes)
    .replace(/\bLIKE\b/g, 'ILIKE')
    // Quote camelCase aliases: " AS fooBar" → " AS \"fooBar\""
    .replace(/\bAS\s+([a-z]+[A-Z][a-zA-Z]*)\b/g, 'AS "$1"')
    // Auto-expand GROUP BY c.id to include joined columns (PG requires all non-aggregate cols)
    .replace(/GROUP BY (\w+)\.id(?!,)/g, (match, tbl) => {
      const hasUser = _sql.includes('LEFT JOIN users u') || _sql.includes('JOIN users u');
      const extras: string[] = [];
      if (hasUser && tbl !== 'u') extras.push('u.name');
      if (extras.length) return `GROUP BY ${tbl}.id, ${extras.join(', ')}`;
      return match;
    });
  return [result, params];
}

// PostgreSQL-specific SQL helpers
export const SQL = {
  now: () => 'NOW()',
  date: (col: string, fmt?: string) => {
    if (!fmt) return col;
    return `TO_CHAR(${col}, '${fmt.replace(/%[Ymd]/g, m => ({'%Y': 'YYYY', '%m': 'MM', '%d': 'DD'})[m] || m)}')`;
  },
  daysBetween: (col: string) => `EXTRACT(DAY FROM NOW() - ${col})::INTEGER`,
  monthsAgo: (n: number) => `NOW() - INTERVAL '${n} months'`,
};

type DbExecutor = {
  all: <T = any[]>(sql: string, params?: any[]) => Promise<T>;
  get: <T = any>(sql: string, params?: any[]) => Promise<T | undefined>;
  run: (sql: string, params?: any[]) => Promise<{ changes: number; lastID: number }>;
  exec: (sql: string) => Promise<void>;
};

function createExecutor(executor?: { query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number }> }): DbExecutor {
  return {
    async all<T = any[]>(sql: string, params: any[] = []) {
      const [q, p] = pgParams(sql, params);
      const result = await (executor || pool).query(q, p);
      return result.rows as T;
    },
    async get<T = any>(sql: string, params: any[] = []) {
      const [q, p] = pgParams(sql, params);
      const result = await (executor || pool).query(q, p);
      return result.rows[0] as T | undefined;
    },
    async run(sql: string, params: any[] = []) {
      const [q, p] = pgParams(sql, params);
      const result = await (executor || pool).query(q, p);
      return { changes: result.rowCount || 0, lastID: 0 };
    },
    async exec(sql: string) {
      await (executor || pool).query(sql);
    },
  };
}

export type TransactionExecutor = DbExecutor;
const defaultExecutor = createExecutor();

export async function dbAll<T = any[]>(sql: string, params: any[] = []): Promise<T> {
  return defaultExecutor.all<T>(sql, params);
}

export async function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return defaultExecutor.get<T>(sql, params);
}

export async function dbRun(sql: string, params: any[] = []) {
  return defaultExecutor.run(sql, params);
}

export async function dbExec(sql: string) {
  return defaultExecutor.exec(sql);
}

export async function dbBegin() {
  await pool.query('BEGIN');
}

export async function dbCommit() {
  await pool.query('COMMIT');
}

export async function dbRollback() {
  await pool.query('ROLLBACK');
}

export async function dbTableInfo(table: string): Promise<{ name: string }[]> {
  const result = await pool.query(`
    SELECT column_name as name 
    FROM information_schema.columns 
    WHERE table_name = $1
  `, [table]);
  return result.rows;
}

export async function withTransaction<T>(work: (executor: TransactionExecutor) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(createExecutor(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
