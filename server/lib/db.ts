import Database from 'better-sqlite3';

// ── Backend selection ──────────────────────────────────────────────
const DRIVER = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
const isPg = DRIVER === 'pg';

// ── Runtime backend references (lazy init) ─────────────────────────
let pgPool: any = null;
let sqliteDb: Database.Database | null = null;

async function getPgPool() {
  if (!pgPool) {
    const mod = await import('../db-pg.js');
    pgPool = mod.pgPool;
  }
  return pgPool;
}

async function getSqliteDb(): Promise<Database.Database> {
  if (!sqliteDb) {
    const mod = await import('../db-sqlite.js');
    sqliteDb = mod.getSqliteDb();
  }
  return sqliteDb!;
}

// ── SQL helpers (dialect-aware) ────────────────────────────────────
export const SQL = isPg
  ? {
      now: () => 'NOW()',
      date: (col: string, fmt?: string) => {
        if (!fmt) return col;
        return `TO_CHAR(${col}, '${fmt.replace(/%[Ymd]/g, (m: string) => ({ '%Y': 'YYYY', '%m': 'MM', '%d': 'DD' } as Record<string, string>)[m] || m)}')`;
      },
      daysBetween: (col: string) => `EXTRACT(DAY FROM NOW() - ${col})::INTEGER`,
      monthsAgo: (n: number) => `NOW() - INTERVAL '${n} months'`,
    }
  : {
      now: () => "datetime('now')",
      date: (col: string, fmt?: string) => {
        if (!fmt) return col;
        const mapping: Record<string, string> = { '%Y': '%Y', '%m': '%m', '%d': '%d' };
        const sqliteFmt = fmt.replace(/%[Ymd]/g, (m) => mapping[m] || m);
        return `strftime('${sqliteFmt}', ${col})`;
      },
      daysBetween: (col: string) => `CAST(julianday('now') - julianday(${col}) AS INTEGER)`,
      monthsAgo: (n: number) => `datetime('now', '-${n} months')`,
    };

// ── Parameter helpers ──────────────────────────────────────────────
function prepareQuery(sql: string, params: any[]): [string, any[]] {
  if (!isPg) return [sql, params];

  let idx = 0;
  const _sql = sql;
  const result = sql
    .replace(/\?/g, () => `$${++idx}`)
    .replace(/\bdatetime\((\w+(?:\.\w+)?)\)/g, '$1')
    .replace(/\bLIKE\b/g, 'ILIKE')
    .replace(/\bAS\s+([a-z]+[A-Z][a-zA-Z]*)\b/g, 'AS "$1"')
    .replace(/GROUP BY (\w+)\.id(?!,)/g, (match, tbl) => {
      const hasUser = _sql.includes('LEFT JOIN users u') || _sql.includes('JOIN users u');
      const extras: string[] = [];
      if (hasUser && tbl !== 'u') extras.push('u.name');
      if (extras.length) return `GROUP BY ${tbl}.id, ${extras.join(', ')}`;
      return match;
    });
  return [result, params];
}

// ── Executor factory ───────────────────────────────────────────────
interface DbExecutor {
  all<T = any[]>(sql: string, params?: any[]): Promise<T>;
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  run(sql: string, params?: any[]): Promise<{ changes: number; lastID: number }>;
  exec(sql: string): Promise<void>;
}

function createSqliteExecutor(db: Database.Database): DbExecutor {
  return {
    async all<T>(sql: string, params: any[] = []) {
      const [q, p] = prepareQuery(sql, params);
      return db.prepare(q).all(...p) as T;
    },
    async get<T>(sql: string, params: any[] = []) {
      const [q, p] = prepareQuery(sql, params);
      return db.prepare(q).get(...p) as T | undefined;
    },
    async run(sql: string, params: any[] = []) {
      const [q, p] = prepareQuery(sql, params);
      const upper = q.trim().toUpperCase();
      const isSelect = upper.startsWith('SELECT') || upper.startsWith('WITH');
      const isReturning = upper.includes('RETURNING');

      if (isSelect || isReturning) {
        const rows = db.prepare(q).all(...p) as any[];
        return { changes: rows.length, lastID: rows[0]?.id ?? 0 };
      }
      const result = db.prepare(q).run(...p);
      return { changes: result.changes, lastID: Number(result.lastInsertRowid) };
    },
    async exec(sql: string) {
      db.exec(sql);
    },
  };
}

async function createPgExecutor(client?: any): Promise<DbExecutor> {
  const pool = client || (await getPgPool());
  return {
    async all<T>(sql: string, params: any[] = []) {
      const [q, p] = prepareQuery(sql, params);
      const result = await pool.query(q, p);
      return result.rows as T;
    },
    async get<T>(sql: string, params: any[] = []) {
      const [q, p] = prepareQuery(sql, params);
      const result = await pool.query(q, p);
      return result.rows[0] as T | undefined;
    },
    async run(sql: string, params: any[] = []) {
      const [q, p] = prepareQuery(sql, params);
      const result = await pool.query(q, p);
      const lastID = (result.rows && result.rows[0] && result.rows[0].id) ? Number(result.rows[0].id) : 0;
      return { changes: result.rowCount || 0, lastID };
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
  };
}

// ── Default executor (lazy) ────────────────────────────────────────
let _executor: DbExecutor | null = null;

async function getExecutor(): Promise<DbExecutor> {
  if (_executor) return _executor;
  if (isPg) {
    _executor = await createPgExecutor();
  } else {
    const db = await getSqliteDb();
    _executor = createSqliteExecutor(db);
  }
  return _executor;
}

// ── Public API ─────────────────────────────────────────────────────
export async function dbAll<T = any[]>(sql: string, params: any[] = []): Promise<T> {
  return (await getExecutor()).all<T>(sql, params);
}

export async function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return (await getExecutor()).get<T>(sql, params);
}

export async function dbRun(sql: string, params: any[] = []) {
  return (await getExecutor()).run(sql, params);
}

export async function dbExec(sql: string) {
  return (await getExecutor()).exec(sql);
}
export async function dbBegin() {
  if (isPg) {
    const pool = await getPgPool();
    await pool.query('BEGIN');
  } else {
    (await getSqliteDb()).exec('BEGIN');
  }
}

export async function dbCommit() {
  if (isPg) {
    const pool = await getPgPool();
    await pool.query('COMMIT');
  } else {
    (await getSqliteDb()).exec('COMMIT');
  }
}

export async function dbRollback() {
  if (isPg) {
    const pool = await getPgPool();
    await pool.query('ROLLBACK');
  } else {
    (await getSqliteDb()).exec('ROLLBACK');
  }
}

export async function dbTableInfo(table: string): Promise<{ name: string }[]> {
  if (isPg) {
    const pool = await getPgPool();
    const result = await pool.query(`
      SELECT column_name as name
      FROM information_schema.columns
      WHERE table_name = $1
    `, [table]);
    return result.rows;
  } else {
    const db = await getSqliteDb();
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
    return rows.map((r: any) => ({ name: r.name }));
  }
}

export type TransactionExecutor = DbExecutor;

export async function withTransaction<T>(work: (executor: TransactionExecutor) => Promise<T>): Promise<T> {
  if (isPg) {
    const pool = await getPgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const executor = await createPgExecutor(client);
      const result = await work(executor);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = await getSqliteDb();
    db.exec('BEGIN');
    try {
      const executor = createSqliteExecutor(db);
      const result = await work(executor);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
