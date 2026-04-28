import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE || 'smarttrade_crm',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000,
});

// Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
function pgParams(sql: string, params: any[]): [string, any[]] {
  let idx = 0;
  const converted = sql.replace(/\?/g, () => `$${++idx}`);
  return [converted, params];
}

// PostgreSQL-specific SQL helpers
export const SQL = {
  now: () => 'NOW()',
  date: (col: string, fmt?: string) => {
    if (!fmt) return col;
    return `TO_CHAR(${col}, '${fmt.replace(/%[Ymd]/g, m => ({'%Y': 'YYYY', '%m': 'MM', '%d': 'DD'})[m] || m)}')`;
  },
  daysBetween: (col: string) => `EXTRACT(DAY FROM NOW() - ${col})::INTEGER`,
};

export async function dbAll<T = any[]>(sql: string, params: any[] = []): Promise<T> {
  const [q, p] = pgParams(sql, params);
  const result = await pool.query(q, p);
  return result.rows as T;
}

export async function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  const [q, p] = pgParams(sql, params);
  const result = await pool.query(q, p);
  return result.rows[0] as T | undefined;
}

export async function dbRun(sql: string, params: any[] = []) {
  const [q, p] = pgParams(sql, params);
  const result = await pool.query(q, p);
  return { changes: result.rowCount || 0, lastID: 0 };
}

export async function dbExec(sql: string) {
  await pool.query(sql);
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
  const result = await pool.query(
    `SELECT column_name AS name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
    [table],
  );
  return result.rows;
}
