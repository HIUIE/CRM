import { db as sqliteDb } from '../db.js';
import pool from '../db-pg.js';

const USE_PG = process.env.DB_TYPE === 'pg';

// SQL compatibility helpers
export const SQL = {
  now: () => USE_PG ? 'NOW()' : "datetime('now')",
  date: (col: string, fmt?: string) => {
    if (!fmt) return col;
    return USE_PG
      ? `TO_CHAR(${col}, '${fmt.replace('%Y', 'YYYY').replace('%m', 'MM').replace('%d', 'DD')}')`
      : `strftime('${fmt}', ${col})`;
  },
  daysBetween: (col: string) => USE_PG
    ? `EXTRACT(DAY FROM NOW() - ${col})::INTEGER`
    : `CAST((julianday('now') - julianday(${col})) AS INTEGER)`,
  concat: (...args: string[]) => args.join(USE_PG ? ' || ' : ' || '),
  limit: (n: number) => USE_PG ? `LIMIT ${n}` : `LIMIT ${n}`,
};

// Unified query interface
export async function dbAll<T = any[]>(sql: string, params: any[] = []): Promise<T> {
  if (USE_PG) {
    const result = await pool.query(sql, params);
    return result.rows as T;
  }
  return sqliteDb.all<T>(sql, params);
}

export async function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  if (USE_PG) {
    const result = await pool.query(sql, params);
    return result.rows[0] as T | undefined;
  }
  return sqliteDb.get<T>(sql, params);
}

export async function dbRun(sql: string, params: any[] = []) {
  if (USE_PG) {
    const result = await pool.query(sql, params);
    return { changes: result.rowCount || 0, lastID: 0 };
  }
  return sqliteDb.run(sql, params);
}

export async function dbExec(sql: string) {
  if (USE_PG) {
    await pool.query(sql);
    return;
  }
  await sqliteDb.exec(sql);
}

export async function dbBegin() {
  if (USE_PG) {
    await pool.query('BEGIN');
    return;
  }
  await sqliteDb.exec('BEGIN TRANSACTION');
}

export async function dbCommit() {
  if (USE_PG) {
    await pool.query('COMMIT');
    return;
  }
  await sqliteDb.exec('COMMIT');
}

export async function dbRollback() {
  if (USE_PG) {
    await pool.query('ROLLBACK');
    return;
  }
  await sqliteDb.exec('ROLLBACK');
}

// Table info (for CSV export)
export async function dbTableInfo(table: string): Promise<{ name: string }[]> {
  if (USE_PG) {
    const result = await pool.query(
      `SELECT column_name AS name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [table],
    );
    return result.rows;
  }
  return sqliteDb.all<{ name: string }[]>(`PRAGMA table_info(${table})`);
}
