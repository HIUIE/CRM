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

// Convert SQLite queries to PostgreSQL-compatible SQL.
function pgParams(sql: string, params: any[]): [string, any[]] {
  let idx = 0;
  const _sql = sql; // keep original for GROUP BY analysis (before transforms)
  const result = sql
    // Convert ? to $1, $2, ...
    .replace(/\?/g, () => `$${++idx}`)
    // Strip datetime(col) → col (PG sorts TIMESTAMP natively)
    .replace(/\bdatetime\((\w+(?:\.\w+)?)\)/g, '$1')
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
