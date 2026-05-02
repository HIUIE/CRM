var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/db-pg.ts
var db_pg_exports = {};
__export(db_pg_exports, {
  default: () => db_pg_default,
  initPgTables: () => initPgTables,
  pgDb: () => pgDb,
  pgPool: () => pgPool
});
import pkg from "pg";
import { runner } from "node-pg-migrate";
import path from "path";
import { fileURLToPath } from "url";
function buildPgConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 3e4
    };
  }
  const ssl = process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : void 0;
  return {
    host: process.env.PG_HOST || "127.0.0.1",
    port: Number(process.env.PG_PORT) || 5432,
    database: process.env.PG_DATABASE || "smarttrade_crm",
    user: process.env.PG_USER || "postgres",
    password: process.env.PG_PASSWORD || "",
    ssl,
    max: 10,
    idleTimeoutMillis: 3e4
  };
}
async function initPgTables() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
  const migrationsDir = path.join(__dirname, "..", "migrations");
  const ssl = process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : void 0;
  await runner({
    databaseUrl: process.env.DATABASE_URL || {
      host: process.env.PG_HOST || "127.0.0.1",
      port: Number(process.env.PG_PORT) || 5432,
      database: process.env.PG_DATABASE || "smarttrade_crm",
      user: process.env.PG_USER || "postgres",
      password: process.env.PG_PASSWORD || "",
      ssl
    },
    dir: migrationsDir,
    direction: "up",
    migrationsTable: "pgmigrations",
    log: (msg) => console.log(`[db] ${msg}`)
  });
}
var Pool, pgConfig, pgPool, pool, __filename, __dirname, pgDb, db_pg_default;
var init_db_pg = __esm({
  "server/db-pg.ts"() {
    "use strict";
    ({ Pool } = pkg);
    pgConfig = buildPgConfig();
    pgPool = new Pool(pgConfig);
    pool = pgPool;
    __filename = fileURLToPath(import.meta.url);
    __dirname = path.dirname(__filename);
    pgDb = {
      async query(text, params) {
        const result = await pool.query(text, params);
        return result.rows;
      },
      async end() {
        await pool.end();
      }
    };
    db_pg_default = pool;
  }
});

// server/db-sqlite.ts
var db_sqlite_exports = {};
__export(db_sqlite_exports, {
  closeSqliteDatabase: () => closeSqliteDatabase,
  createSqliteExecutor: () => createSqliteExecutor,
  getSqliteDb: () => getSqliteDb,
  initSqliteDatabase: () => initSqliteDatabase
});
import Database from "better-sqlite3";
import path2 from "path";
import fs from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";
function resolveDbPath() {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;
  const dataDir = path2.join(__dirname2, "..", "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return path2.join(dataDir, "crm.db");
}
function runMigrations(database) {
  database.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      name TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_id TEXT UNIQUE,
      name TEXT,
      country TEXT,
      contact TEXT,
      logistics_preference TEXT,
      payment_terms TEXT,
      source_channel TEXT,
      intent_products TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      partner_type TEXT NOT NULL,
      country TEXT,
      contact TEXT,
      payment_terms TEXT,
      remark TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_id TEXT UNIQUE,
      customer_id INTEGER REFERENCES customers(id),
      status TEXT,
      details TEXT,
      total_amount REAL,
      product_summary TEXT,
      delivery_date TEXT,
      key_milestone TEXT,
      freight_amount REAL DEFAULT 0,
      misc_amount REAL DEFAULT 0,
      quick_notes TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      specification TEXT,
      hs_code TEXT,
      quantity REAL NOT NULL,
      unit TEXT,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      image_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS finance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id),
      partner_id INTEGER REFERENCES partners(id),
      type TEXT,
      amount REAL,
      target TEXT,
      status TEXT,
      remark TEXT,
      currency TEXT,
      payment_category TEXT,
      record_category TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS logistics_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id),
      tracking_no TEXT,
      carrier TEXT,
      freight_forwarder TEXT,
      freight_forwarder_partner_id INTEGER REFERENCES partners(id),
      packing_details TEXT,
      status TEXT,
      shipping_date TEXT,
      segment_type TEXT,
      package_count REAL,
      volume_cbm REAL,
      gross_weight_kg REAL,
      incoterm TEXT,
      transport_mode TEXT,
      vessel_voyage TEXT,
      bill_no TEXT,
      etd TEXT,
      eta TEXT,
      recipient_address TEXT,
      package_size TEXT,
      remark TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS customs_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT,
      broker_name TEXT,
      declaration_no TEXT,
      declaration_date TEXT,
      release_date TEXT,
      remark TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_profits (
      order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS production_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      partner_id INTEGER REFERENCES partners(id),
      order_date TEXT,
      estimated_delivery_date TEXT,
      production_status TEXT,
      inspection_status TEXT,
      remark TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS production_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      log_date TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS packing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      package_count REAL,
      package_size TEXT,
      gross_weight REAL,
      net_weight REAL,
      attachment_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT,
      entity_id INTEGER,
      file_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      file_path TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action_type TEXT,
      entity_type TEXT,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      title TEXT,
      email TEXT,
      contact TEXT,
      is_primary INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      channel TEXT DEFAULT 'other',
      created_by INTEGER REFERENCES users(id),
      created_by_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      assignee_id INTEGER NOT NULL REFERENCES users(id),
      due_date TEXT NOT NULL,
      priority TEXT DEFAULT 'P2',
      status TEXT DEFAULT 'todo',
      entity_type TEXT,
      entity_id TEXT,
      description TEXT,
      comment_count INTEGER DEFAULT 0,
      attachment_count INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      attachment_id INTEGER NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      comment_id INTEGER
    );

    -- Business indexes (SQLite creates indexes for PKs/UNIQUEs automatically)
    CREATE INDEX IF NOT EXISTS idx_orders_customer_deleted ON orders (customer_id, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_finance_order_status ON finance_records (order_id, status);
    CREATE INDEX IF NOT EXISTS idx_logistics_order_deleted ON logistics_records (order_id, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments (entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_entity_assignee ON tasks (entity_type, entity_id, assignee_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_production_plans_order ON production_plans (order_id);
    CREATE INDEX IF NOT EXISTS idx_customer_followups_customer ON customer_followups (customer_id);
    CREATE INDEX IF NOT EXISTS idx_order_follow_ups_order ON order_follow_ups (order_id);
    CREATE INDEX IF NOT EXISTS idx_logistics_forwarder ON logistics_records (freight_forwarder_partner_id);

    -- Seed defaults
    INSERT OR IGNORE INTO settings (key, value) VALUES ('site_name', 'SmartTrade AI CRM');
    INSERT OR IGNORE INTO users (username, password, role, name, active)
      VALUES ('root', '$2a$10$w8.223Yx9c1t79119nQ1jOPR/r2qY2kS.D71p5G.k8h/bZ3YI3eOq', 'admin', 'Super Admin', 1);
  `);
}
function initSqliteDatabase() {
  const dbPath = resolveDbPath();
  db = new Database(dbPath);
  db.pragma("journal_mode=WAL");
  db.pragma("foreign_keys=ON");
  db.pragma("busy_timeout=5000");
  runMigrations(db);
  console.log(`[db] SQLite database ready at ${dbPath}`);
}
function getSqliteDb() {
  if (!db) throw new Error("SQLite database not initialized. Call initSqliteDatabase() first.");
  return db;
}
function closeSqliteDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
function createSqliteExecutor(database) {
  return {
    query(sql, params = []) {
      const stmt = database.prepare(sql);
      const isSelect = sql.trim().toUpperCase().startsWith("SELECT") || sql.trim().toUpperCase().startsWith("WITH") || sql.trim().toUpperCase().startsWith("PRAGMA");
      const isReturning = sql.toUpperCase().includes("RETURNING");
      if (isSelect || isReturning) {
        return { rows: stmt.all(...params) };
      }
      const result = stmt.run(...params);
      return { rows: [], rowCount: result.changes, lastID: Number(result.lastInsertRowid) };
    }
  };
}
var __filename2, __dirname2, db;
var init_db_sqlite = __esm({
  "server/db-sqlite.ts"() {
    "use strict";
    __filename2 = fileURLToPath2(import.meta.url);
    __dirname2 = path2.dirname(__filename2);
    db = null;
  }
});

// server/lib/db.ts
async function getPgPool() {
  if (!pgPool2) {
    const mod = await Promise.resolve().then(() => (init_db_pg(), db_pg_exports));
    pgPool2 = mod.pgPool;
  }
  return pgPool2;
}
async function getSqliteDb2() {
  if (!sqliteDb) {
    const mod = await Promise.resolve().then(() => (init_db_sqlite(), db_sqlite_exports));
    sqliteDb = mod.getSqliteDb();
  }
  return sqliteDb;
}
function prepareQuery(sql, params) {
  if (!isPg) return [sql, params];
  let idx = 0;
  const _sql = sql;
  const result = sql.replace(/\?/g, () => `$${++idx}`).replace(/\bdatetime\((\w+(?:\.\w+)?)\)/g, "$1").replace(/\bLIKE\b/g, "ILIKE").replace(/\bAS\s+([a-z]+[A-Z][a-zA-Z]*)\b/g, 'AS "$1"').replace(/GROUP BY (\w+)\.id(?!,)/g, (match, tbl) => {
    const hasUser = _sql.includes("LEFT JOIN users u") || _sql.includes("JOIN users u");
    const extras = [];
    if (hasUser && tbl !== "u") extras.push("u.name");
    if (extras.length) return `GROUP BY ${tbl}.id, ${extras.join(", ")}`;
    return match;
  });
  return [result, params];
}
function createSqliteExecutor2(db2) {
  return {
    async all(sql, params = []) {
      const [q, p] = prepareQuery(sql, params);
      return db2.prepare(q).all(...p);
    },
    async get(sql, params = []) {
      const [q, p] = prepareQuery(sql, params);
      return db2.prepare(q).get(...p);
    },
    async run(sql, params = []) {
      const [q, p] = prepareQuery(sql, params);
      const upper = q.trim().toUpperCase();
      const isSelect = upper.startsWith("SELECT") || upper.startsWith("WITH");
      const isReturning = upper.includes("RETURNING");
      if (isSelect || isReturning) {
        const rows = db2.prepare(q).all(...p);
        return { changes: rows.length, lastID: rows[0]?.id ?? 0 };
      }
      const result = db2.prepare(q).run(...p);
      return { changes: result.changes, lastID: Number(result.lastInsertRowid) };
    },
    async exec(sql) {
      db2.exec(sql);
    }
  };
}
async function createPgExecutor(client) {
  const pool2 = client || await getPgPool();
  return {
    async all(sql, params = []) {
      const [q, p] = prepareQuery(sql, params);
      const result = await pool2.query(q, p);
      return result.rows;
    },
    async get(sql, params = []) {
      const [q, p] = prepareQuery(sql, params);
      const result = await pool2.query(q, p);
      return result.rows[0];
    },
    async run(sql, params = []) {
      const [q, p] = prepareQuery(sql, params);
      const result = await pool2.query(q, p);
      const lastID = result.rows && result.rows[0] && result.rows[0].id ? Number(result.rows[0].id) : 0;
      return { changes: result.rowCount || 0, lastID };
    },
    async exec(sql) {
      await pool2.query(sql);
    }
  };
}
async function getExecutor() {
  if (_executor) return _executor;
  if (isPg) {
    _executor = await createPgExecutor();
  } else {
    const db2 = await getSqliteDb2();
    _executor = createSqliteExecutor2(db2);
  }
  return _executor;
}
async function dbAll(sql, params = []) {
  return (await getExecutor()).all(sql, params);
}
async function dbGet(sql, params = []) {
  return (await getExecutor()).get(sql, params);
}
async function dbRun(sql, params = []) {
  return (await getExecutor()).run(sql, params);
}
async function dbTableInfo(table) {
  if (isPg) {
    const pool2 = await getPgPool();
    const result = await pool2.query(`
      SELECT column_name as name
      FROM information_schema.columns
      WHERE table_name = $1
    `, [table]);
    return result.rows;
  } else {
    const db2 = await getSqliteDb2();
    const rows = db2.prepare(`PRAGMA table_info(${table})`).all();
    return rows.map((r) => ({ name: r.name }));
  }
}
async function withTransaction(work) {
  if (isPg) {
    const pool2 = await getPgPool();
    const client = await pool2.connect();
    try {
      await client.query("BEGIN");
      const executor = await createPgExecutor(client);
      const result = await work(executor);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db2 = await getSqliteDb2();
    db2.exec("BEGIN");
    try {
      const executor = createSqliteExecutor2(db2);
      const result = await work(executor);
      db2.exec("COMMIT");
      return result;
    } catch (error) {
      db2.exec("ROLLBACK");
      throw error;
    }
  }
}
var DRIVER, isPg, pgPool2, sqliteDb, SQL, _executor;
var init_db = __esm({
  "server/lib/db.ts"() {
    "use strict";
    DRIVER = (process.env.DB_DRIVER || "sqlite").toLowerCase();
    isPg = DRIVER === "pg";
    pgPool2 = null;
    sqliteDb = null;
    SQL = isPg ? {
      now: () => "NOW()",
      date: (col, fmt) => {
        if (!fmt) return col;
        return `TO_CHAR(${col}, '${fmt.replace(/%[Ymd]/g, (m) => ({ "%Y": "YYYY", "%m": "MM", "%d": "DD" })[m] || m)}')`;
      },
      daysBetween: (col) => `EXTRACT(DAY FROM NOW() - ${col})::INTEGER`,
      monthsAgo: (n) => `NOW() - INTERVAL '${n} months'`
    } : {
      now: () => "datetime('now')",
      date: (col, fmt) => {
        if (!fmt) return col;
        const mapping = { "%Y": "%Y", "%m": "%m", "%d": "%d" };
        const sqliteFmt = fmt.replace(/%[Ymd]/g, (m) => mapping[m] || m);
        return `strftime('${sqliteFmt}', ${col})`;
      },
      daysBetween: (col) => `CAST(julianday('now') - julianday(${col}) AS INTEGER)`,
      monthsAgo: (n) => `datetime('now', '-${n} months')`
    };
    _executor = null;
  }
});

// server/lib/logger.ts
import pino from "pino";
var logger;
var init_logger = __esm({
  "server/lib/logger.ts"() {
    "use strict";
    logger = pino({
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      transport: process.env.NODE_ENV !== "production" ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname"
        }
      } : void 0
    });
  }
});

// server/lib/http.ts
function fail(res, status, message, code = "REQUEST_FAILED") {
  return res.status(status).json({
    error: {
      code,
      message
    }
  });
}
function handleRouteError(res, error, fallbackMessage, req) {
  if (error instanceof AppError) {
    return fail(res, error.status, error.message, error.code);
  }
  const message = error instanceof Error ? error.message : String(error);
  const logMeta = {
    method: req?.method,
    path: req?.originalUrl,
    userId: req?.user?.id,
    err: error
  };
  logger.error(logMeta, `[Route Error] ${fallbackMessage}`);
  const clientMessage = process.env.NODE_ENV === "production" ? fallbackMessage : `${fallbackMessage}: ${message}`;
  return fail(res, 500, clientMessage, "INTERNAL_ERROR");
}
var AppError;
var init_http = __esm({
  "server/lib/http.ts"() {
    "use strict";
    init_logger();
    AppError = class extends Error {
      constructor(status, message, code = "REQUEST_FAILED") {
        super(message);
        this.status = status;
        this.code = code;
      }
    };
  }
});

// server/lib/auth.ts
import crypto from "crypto";
import jwt from "jsonwebtoken";
function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}
function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    // Must be readable by JS (apiFetch reads it)
    secure: isCookieSecure(),
    sameSite: "strict",
    path: "/",
    maxAge: 24 * 60 * 60 * 1e3
  };
}
function setCsrfCookie(res) {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE, token, getCsrfCookieOptions());
  return token;
}
function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE, getCsrfCookieOptions());
}
function validateCsrf(req, res) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return true;
  }
  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.headers["x-csrf-token"];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    fail(res, 403, "\u5B89\u5168\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u91CD\u8BD5", "CSRF_INVALID");
    return false;
  }
  return true;
}
function csrfProtection(req, res, next) {
  if (!validateCsrf(req, res)) return;
  next();
}
function isCookieSecure() {
  return process.env.COOKIE_SECURE === "true";
}
function getSameSite() {
  return isCookieSecure() ? "none" : "lax";
}
function getCookieOptions() {
  return {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: getSameSite(),
    path: "/",
    maxAge: 24 * 60 * 60 * 1e3
  };
}
function clearAuthCookie(res) {
  res.clearCookie("token", {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: getSameSite(),
    path: "/"
  });
  clearCsrfCookie(res);
}
function signAuthToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "24h" });
}
function verifyAuthToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
async function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return fail(res, 401, "\u8BF7\u5148\u767B\u5F55\u540E\u518D\u64CD\u4F5C", "AUTH_REQUIRED");
  }
  try {
    const decoded = verifyAuthToken(token);
    const currentUser = await dbGet(
      `SELECT id, active FROM users WHERE id = ?`,
      [decoded.id]
    );
    if (!currentUser || currentUser.active === 0) {
      clearAuthCookie(res);
      clearCsrfCookie(res);
      return fail(res, 401, "\u8D26\u53F7\u5DF2\u505C\u7528\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458", "ACCOUNT_DISABLED");
    }
    req.user = decoded;
    if (!req.cookies.csrf_token) {
      setCsrfCookie(res);
    }
    next();
  } catch (_error) {
    clearAuthCookie(res);
    clearCsrfCookie(res);
    return fail(res, 401, "\u767B\u5F55\u72B6\u6001\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55", "AUTH_EXPIRED");
  }
}
function requireAdmin(req, res, next) {
  if (!req.user) {
    return fail(res, 401, "\u8BF7\u5148\u767B\u5F55\u540E\u518D\u64CD\u4F5C", "AUTH_REQUIRED");
  }
  if (req.user.role !== "admin") {
    return fail(res, 403, "\u4EC5\u7BA1\u7406\u5458\u53EF\u6267\u884C\u6B64\u64CD\u4F5C", "ADMIN_REQUIRED");
  }
  next();
}
var JWT_SECRET, CSRF_COOKIE;
var init_auth = __esm({
  "server/lib/auth.ts"() {
    "use strict";
    init_db();
    init_http();
    JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error("FATAL: JWT_SECRET environment variable is required. Set a strong random string in production.");
    }
    CSRF_COOKIE = "csrf_token";
  }
});

// server/lib/values.ts
var values_exports = {};
__export(values_exports, {
  buildLimitOffset: () => buildLimitOffset,
  isOneOf: () => isOneOf,
  monthFromDateInput: () => monthFromDateInput,
  normalizeOrderStatus: () => normalizeOrderStatus,
  readAttachmentIds: () => readAttachmentIds,
  readNumber: () => readNumber,
  readOptionalDate: () => readOptionalDate,
  readPagination: () => readPagination,
  readString: () => readString
});
function readString(value, maxLength = 1e4) {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > maxLength ? s.slice(0, maxLength) : s;
}
function readNumber(value) {
  const nextValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : NaN;
}
function isOneOf(value, options2) {
  return options2.includes(value);
}
function readOptionalDate(value) {
  const text = readString(value);
  if (!text) {
    return "";
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "__invalid__";
}
function readAttachmentIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);
}
function monthFromDateInput(value) {
  return /^\d{4}-\d{2}$/.test(value) ? value : "";
}
function normalizeOrderStatus(status) {
  if (status === "confirmed") {
    return "production";
  }
  if (status === "shipped") {
    return "shipping";
  }
  return status;
}
function readPagination(query) {
  const page = Math.max(1, Math.floor(readNumber(query.page) || 1));
  const rawSize = Math.floor(readNumber(query.pageSize) || 200);
  const pageSize = Math.min(Math.max(1, rawSize), 500);
  return { page, pageSize, offset: (page - 1) * pageSize };
}
function buildLimitOffset(pagination, params) {
  params.push(pagination.pageSize, pagination.offset);
  return ` LIMIT ? OFFSET ?`;
}
var init_values = __esm({
  "server/lib/values.ts"() {
    "use strict";
  }
});

// server/lib/socket.ts
var socket_exports = {};
__export(socket_exports, {
  emitToAll: () => emitToAll,
  emitToUser: () => emitToUser,
  getIO: () => getIO,
  initSocket: () => initSocket
});
import { Server } from "socket.io";
function parseCookieHeader(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) continue;
    cookies[rawKey] = decodeURIComponent(rawValue.join("=") || "");
  }
  return cookies;
}
function getAllowedSocketOrigins() {
  return (process.env.SOCKET_CORS_ORIGIN || process.env.CORS_ORIGIN || "").split(",").map((origin) => origin.trim()).filter(Boolean);
}
function initSocket(server) {
  const allowedOrigins = getAllowedSocketOrigins();
  io = new Server(server, allowedOrigins.length ? {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST"]
    }
  } : {});
  io.use(async (socket, next) => {
    try {
      const token = parseCookieHeader(socket.request.headers.cookie).token;
      if (!token) {
        return next(new Error("AUTH_REQUIRED"));
      }
      const user = verifyAuthToken(token);
      const currentUser = await dbGet(
        `SELECT id, active FROM users WHERE id = ?`,
        [user.id]
      );
      if (!currentUser || currentUser.active === 0) {
        return next(new Error("ACCOUNT_DISABLED"));
      }
      socket.data.user = user;
      next();
    } catch (_error) {
      next(new Error("AUTH_EXPIRED"));
    }
  });
  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(`user-${user.id}`);
    logger.info({ socketId: socket.id, userId: user.id }, "[Socket] User connected");
    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id, userId: user.id }, "[Socket] User disconnected");
    });
  });
  return io;
}
function getIO() {
  if (!io) {
    return null;
  }
  return io;
}
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user-${userId}`).emit(event, data);
  }
}
function emitToAll(event, data) {
  if (io) {
    io.emit(event, data);
  }
}
var io;
var init_socket = __esm({
  "server/lib/socket.ts"() {
    "use strict";
    init_db();
    init_logger();
    init_auth();
    io = null;
  }
});

// server.ts
import "dotenv/config";

// server/app.ts
import express from "express";
import path10 from "path";
import fs11 from "fs/promises";
import cookieParser from "cookie-parser";
import helmet from "helmet";

// server/api.ts
import { Router as Router18 } from "express";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";

// server/swagger.ts
import swaggerJsdoc from "swagger-jsdoc";
var options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SmartTrade AI CRM API",
      version: "1.1.0",
      description: "\u5916\u8D38 CRM/ERP \u7CFB\u7EDF\u540E\u7AEF API"
    },
    servers: [{ url: "/api" }]
  },
  apis: ["./server/routes/*.ts"]
};
var swaggerSpec = swaggerJsdoc(options);

// server/lib/brand.ts
function stripControlChars(value) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
}
function normalizeBrandText(value, fallback, maxLength = 120) {
  const normalized = stripControlChars(String(value || "")).slice(0, maxLength);
  return normalized || fallback;
}
function sanitizeBrandAssetUrl(value, fallback = "") {
  const normalized = stripControlChars(String(value || ""));
  if (!normalized) {
    return fallback;
  }
  if (/[<>"'`]/.test(normalized)) {
    return fallback;
  }
  if (/^(javascript|data):/i.test(normalized)) {
    return fallback;
  }
  if (normalized.startsWith("/")) {
    return normalized;
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return fallback;
}
function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// server/api.ts
init_auth();

// server/routes/ai.ts
import { Router } from "express";

// server/services/ai.ts
import { GoogleGenAI } from "@google/genai";

// server/services/json.ts
function parseJsonObject(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("AI \u672A\u8FD4\u56DE\u6709\u6548\u5185\u5BB9");
  }
  const withoutFence = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  const candidate = firstBrace >= 0 && lastBrace >= 0 ? withoutFence.slice(firstBrace, lastBrace + 1) : withoutFence;
  return JSON.parse(candidate);
}

// server/lib/sanitizer.ts
var SENSITIVE_FIELD_KEYS = [
  "name",
  "customer_name",
  "contact_person",
  "partner_name",
  "email",
  "contact",
  "phone",
  "address",
  "recipient_address",
  "broker_name",
  "tracking_no",
  "bill_no",
  "declaration_no",
  "file_name",
  "target",
  "title",
  "passport_no",
  "bank_info",
  "id_card"
];
function scrubText(text) {
  if (!text || typeof text !== "string") return text;
  return text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_HIDDEN]").replace(/\+?\d{8,15}/g, "[SENSITIVE_DATA_HIDDEN]").replace(/\b\d{16,19}\b/g, "[CARD_HIDDEN]");
}
function sanitizeForAI(data) {
  if (data === null || data === void 0) return data;
  if (typeof data === "string") {
    return scrubText(data);
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForAI(item));
  }
  if (typeof data === "object" && data !== null) {
    const obj = data;
    const sanitized = {};
    for (const key in obj) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELD_KEYS.includes(lowerKey)) {
        const val = obj[key];
        if (!val) {
          sanitized[key] = val;
        } else if (lowerKey.includes("email")) {
          sanitized[key] = "[EMAIL_REDACTED]";
        } else if (lowerKey.includes("phone") || lowerKey.includes("contact")) {
          sanitized[key] = "[CONTACT_REDACTED]";
        } else if (lowerKey.includes("address")) {
          const parts = String(val).split(",");
          sanitized[key] = parts.length > 1 ? `[STREET_REDACTED], ${parts[parts.length - 1].trim()}` : "[ADDRESS_REDACTED]";
        } else {
          sanitized[key] = `[${key.toUpperCase()}_REDACTED]`;
        }
      } else if (typeof obj[key] === "string") {
        sanitized[key] = scrubText(obj[key]);
      } else {
        sanitized[key] = sanitizeForAI(obj[key]);
      }
    }
    return sanitized;
  }
  return data;
}

// server/services/ai.ts
function resolveAiProvider(model) {
  const normalized = model.toLowerCase();
  if (normalized.includes("gemini")) {
    return "gemini";
  }
  if (normalized.includes("deepseek")) {
    return "deepseek";
  }
  if (normalized.includes("gpt")) {
    return "openai-compatible";
  }
  return "openai-compatible";
}
function resolveAiProviderApiKey(provider, configuredKey) {
  const fromSettings = (configuredKey || "").trim();
  if (fromSettings) return fromSettings;
  if (provider === "gemini") return (process.env.GEMINI_API_KEY || process.env.AI_API_KEY || "").trim();
  if (provider === "deepseek") return (process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY || "").trim();
  return (process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "").trim();
}
async function runOpenAiCompatibleModel({
  model,
  apiKey,
  baseUrl,
  prompt,
  jsonMode = true
  // 默认开启，但允许关闭
}) {
  let normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  if (normalizedBaseUrl.includes("deepseek.com")) {
    normalizedBaseUrl = normalizedBaseUrl.replace(/\/v1$/, "");
  } else if (normalizedBaseUrl.includes("api.openai.com") && !normalizedBaseUrl.endsWith("/v1")) {
    normalizedBaseUrl += "/v1";
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6e4);
  try {
    const body = {
      model,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }]
    };
    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }
    const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "SmartTrade-CRM/2.0",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage += `: ${errorJson.error?.message || errorText}`;
      } catch (_e) {
        errorMessage += `: ${errorText}`;
      }
      throw new Error(`AI \u670D\u52A1\u7AEF\u8FD4\u56DE\u9519\u8BEF (${errorMessage})`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    if (!jsonMode) {
      return content;
    }
    const cleanContent = content.replace(/```json\n?/, "").replace(/\n?```/, "").trim();
    return parseJsonObject(cleanContent);
  } finally {
    clearTimeout(timeoutId);
  }
}
function buildOrderParsingPrompt(text) {
  const safeText = sanitizeForAI(text);
  return `\u4F60\u662F\u4E00\u4E2A\u8D44\u6DF1\u5916\u8D38\u4E1A\u52A1\u52A9\u7406\u3002\u8BF7\u4ECE\u4E0B\u9762\u8FD9\u6BB5\u6742\u4E71\u7684\u5BA2\u6237\u6D88\u606F\u6216\u90AE\u4EF6\u4E2D\u63D0\u53D6\u5173\u952E\u8BA2\u5355\u4FE1\u606F\u3002
\u8BF7\u4EE5\u4E25\u683C JSON \u683C\u5F0F\u8FD4\u56DE\uFF0C\u4E14\u53EA\u80FD\u8FD4\u56DE JSON\uFF0C\u4E0D\u8981\u5305\u542B markdown \u4EE3\u7801\u5757\u6216\u989D\u5916\u8BF4\u660E\uFF1A
{
  "customerName": "\u63D0\u53D6\u7684\u5BA2\u6237\u6216\u516C\u53F8\u540D\uFF0C\u5982\u679C\u6CA1\u6709\u63D0\u53D6\u5230\u5219\u586B \u6682\u65E0",
  "country": "\u63D0\u53D6\u7684\u56FD\u5BB6\uFF0C\u5982\u679C\u6CA1\u6709\u586B \u6682\u65E0",
  "logistics": "\u63D0\u53D6\u7684\u7269\u6D41\u8981\u6C42\uFF0C\u5982\u679C\u6CA1\u6709\u586B \u65E0",
  "payment": "\u4ED8\u6B3E\u65B9\u5F0F\uFF0C\u5982 30%\u5B9A\u91D1",
  "totalAmount": \u53EA\u4FDD\u7559\u6570\u5B57\u91D1\u989D\uFF0C\u5982\u679C\u6CA1\u63D0\u5230\u5219\u586B 0,
  "details": "\u5173\u4E8E\u5546\u54C1\u89C4\u683C\u3001\u5305\u88C5\u3001\u8981\u6C42\u7B49\u7684\u8BE6\u7EC6\u6458\u8981",
  "suggestedReply": "\u62DF\u5199\u4E00\u6BB5\u7B80\u77ED\u3001\u4E13\u4E1A\u3001\u5F97\u4F53\u7684\u82F1\u6587\u56DE\u590D\uFF0C\u53EF\u7528\u4E8E\u5FEB\u901F\u786E\u8BA4\u8BA2\u5355"
}
\u9700\u8981\u89E3\u6790\u7684\u5185\u5BB9\u5982\u4E0B\uFF1A
"""
${safeText}
"""`;
}
function buildOrderAnalysisPrompt(data) {
  const safeData = sanitizeForAI(data);
  const dataJson = JSON.stringify(safeData, null, 2);
  return `\u4F60\u662F\u4E00\u4E2A\u8D44\u6DF1\u7684\u56FD\u9645\u8D38\u6613\u4E0E\u4F9B\u5E94\u94FE\u4E13\u5BB6\u3002\u8BF7\u6839\u636E\u4EE5\u4E0B\u8BA2\u5355\u6570\u636E\u8FDB\u884C\u6DF1\u5EA6\u5206\u6790\uFF0C\u8BC6\u522B\u6F5C\u5728\u98CE\u9669\u5E76\u7ED9\u51FA\u6267\u884C\u5EFA\u8BAE\u3002

\u6570\u636E\u8BE6\u60C5\uFF08\u5DF2\u4E25\u683C\u8131\u654F\uFF0C\u4E0D\u542B\u4EFB\u4F55\u771F\u5B9E\u59D3\u540D\u3001\u7535\u8BDD\u6216\u8BE6\u7EC6\u95E8\u724C\uFF09\uFF1A
${dataJson}

\u8BF7\u4E25\u683C\u6309\u4EE5\u4E0B JSON \u683C\u5F0F\u8FD4\u56DE\u5206\u6790\u7ED3\u679C\uFF0C\u4E0D\u8981\u5305\u542B\u4EFB\u4F55 Markdown \u683C\u5F0F\uFF1A
{
  "score": 85,
  "risks": [
    { "level": "high", "content": "\u98CE\u9669\u63CF\u8FF0" }
  ],
  "suggestions": [
    { "content": "\u5EFA\u8BAE\u5185\u5BB9" }
  ],
  "summary": "\u4E00\u53E5\u8BDD\u6838\u5FC3\u603B\u7ED3"
}

\u5206\u6790\u91CD\u70B9\uFF1A
1. \u652F\u4ED8\u98CE\u9669\uFF1A\u662F\u5426\u903E\u671F\u672A\u4ED8\uFF0C\u6536\u6B3E\u6BD4\u4F8B\u662F\u5426\u8FC7\u4F4E\u3002
2. \u7269\u6D41\u98CE\u9669\uFF1A\u4EA4\u671F\u662F\u5426\u4E34\u8FD1\uFF0C\u7269\u6D41\u662F\u5426\u6709\u66F4\u65B0\u3002
3. \u62A5\u5173\u98CE\u9669\uFF1A\u662F\u5426\u53CA\u65F6\u5F55\u5165\u62A5\u5173\u5355\u53F7\u3002
4. \u751F\u4EA7\u8FDB\u5EA6\uFF1A\u5DE5\u5382\u4EA4\u671F\u662F\u5426\u6B63\u5E38\u3002`;
}
function sanitizeOrderData(data) {
  return sanitizeForAI(data);
}
async function runGeminiModel(model, apiKey, prompt, jsonMode = true) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });
  const text = response.text || "";
  if (!jsonMode) {
    return text;
  }
  return parseJsonObject(text);
}

// server/services/ai-tools.ts
init_db();
var AI_TOOLS = {
  create_task: {
    description: "\u521B\u5EFA\u65B0\u4EFB\u52A1\u5E76\u6307\u6D3E\u7ED9\u6307\u5B9A\u6210\u5458",
    params: "title (\u4EFB\u52A1\u6807\u9898), assignee_username (\u8D1F\u8D23\u4EBA\u7528\u6237\u540D), due_date (\u622A\u6B62\u65E5\u671F YYYY-MM-DD), priority (P0/P1/P2, \u9ED8\u8BA4 P2), description (\u63CF\u8FF0, \u53EF\u9009)",
    mutating: true,
    handler: async (p, context) => {
      const user = await dbGet("SELECT id FROM users WHERE username = ? AND active != 0", [p.assignee_username]);
      if (!user) return { success: false, message: `\u672A\u627E\u5230\u7528\u6237"${p.assignee_username}"` };
      await dbRun(
        `INSERT INTO tasks (title, assignee_id, due_date, priority, status, description, created_by) VALUES (?, ?, ?, ?, 'todo', ?, ?)`,
        [p.title, user.id, p.due_date, p.priority || "P2", p.description || "", context.userId]
      );
      return { success: true, message: `\u4EFB\u52A1"${p.title}"\u5DF2\u521B\u5EFA\uFF0C\u6307\u6D3E\u7ED9 ${p.assignee_username}` };
    }
  },
  create_followup: {
    description: "\u4E3A\u6307\u5B9A\u5BA2\u6237\u6DFB\u52A0\u8DDF\u8FDB\u8BB0\u5F55",
    params: "customer_id (\u5BA2\u6237ID), content (\u8DDF\u8FDB\u5185\u5BB9), channel (\u6E20\u9053,\u5982\u7535\u8BDD/\u90AE\u4EF6/\u4F1A\u9762, \u53EF\u9009)",
    mutating: true,
    handler: async (p, context) => {
      const customer = await dbGet("SELECT id, display_id, name FROM customers WHERE deleted_at IS NULL AND (id = ? OR display_id = ?)", [p.customer_id, p.customer_id]);
      if (!customer) return { success: false, message: `\u672A\u627E\u5230\u5BA2\u6237"${p.customer_id}"` };
      await dbRun(
        `INSERT INTO customer_followups (customer_id, content, channel, created_by) VALUES (?, ?, ?, ?)`,
        [customer.id, p.content, p.channel || "other", context.userId]
      );
      return { success: true, message: `\u5BA2\u6237"${customer.name}"\u7684\u8DDF\u8FDB\u8BB0\u5F55\u5DF2\u6DFB\u52A0` };
    }
  },
  add_production_log: {
    description: "\u4E3A\u6307\u5B9A\u8BA2\u5355\u6DFB\u52A0\u751F\u4EA7\u8FDB\u5EA6\u65E5\u5FD7",
    params: "order_id (\u8BA2\u5355ID), content (\u8FDB\u5EA6\u5185\u5BB9)",
    mutating: true,
    handler: async (p, context) => {
      const plan = await dbGet(
        `SELECT pp.id FROM production_plans pp INNER JOIN orders o ON o.id = pp.order_id WHERE pp.order_id = ? AND o.deleted_at IS NULL`,
        [Number(p.order_id)]
      );
      if (!plan) return { success: false, message: `\u8BA2\u5355 ${p.order_id} \u6682\u65E0\u751F\u4EA7\u5B89\u6392\uFF0C\u8BF7\u5148\u521B\u5EFA\u751F\u4EA7\u8BA1\u5212` };
      await dbRun(
        `INSERT INTO production_logs (plan_id, content, created_by) VALUES (?, ?, ?)`,
        [plan.id, p.content, context.userId]
      );
      return { success: true, message: `\u8BA2\u5355 ${p.order_id} \u7684\u751F\u4EA7\u65E5\u5FD7\u5DF2\u8BB0\u5F55` };
    }
  },
  get_order_status: {
    description: "\u67E5\u8BE2\u6307\u5B9A\u8BA2\u5355\u7684\u5B8C\u6574\u72B6\u6001\u6458\u8981",
    params: "order_no (\u8BA2\u5355\u663E\u793A\u7F16\u53F7, \u5982 ORD-2026-...)",
    handler: async (p) => {
      const order = await dbGet(`
        SELECT o.*, c.name AS customer_name, c.country
        FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.display_id = ? AND o.deleted_at IS NULL
      `, [p.order_no]);
      if (!order) return { success: false, message: `\u672A\u627E\u5230\u8BA2\u5355 ${p.order_no}` };
      const finance = await dbAll("SELECT type, SUM(amount) AS total FROM finance_records WHERE order_id = ? AND deleted_at IS NULL GROUP BY type", [order.id]);
      const logistics = await dbAll("SELECT COUNT(*) AS count, status FROM logistics_records WHERE order_id = ? AND deleted_at IS NULL GROUP BY status", [order.id]);
      const production = await dbGet("SELECT production_status, inspection_status FROM production_plans WHERE order_id = ?", [order.id]);
      return {
        success: true,
        message: `\u8BA2\u5355 ${p.order_no} \u5F53\u524D\u72B6\u6001\uFF1A${order.status}\uFF0C\u5BA2\u6237\uFF1A${order.customer_name}\uFF0C\u91D1\u989D\uFF1A$${Number(order.total_amount).toLocaleString()}${production ? `\uFF0C\u751F\u4EA7\uFF1A${production.production_status}` : ""}`,
        data: { order, finance, logistics, production: production || null }
      };
    }
  },
  list_tasks: {
    description: "\u67E5\u770B\u5F53\u524D\u6240\u6709\u5F85\u529E\u4EFB\u52A1",
    params: "\u65E0 (\u65E0\u9700\u53C2\u6570)",
    handler: async () => {
      const tasks = await dbAll("SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.status != 'done' ORDER BY datetime(t.created_at) DESC LIMIT 10");
      if (!tasks.length) return { success: true, message: "\u5F53\u524D\u6CA1\u6709\u5F85\u529E\u4EFB\u52A1\u3002" };
      const lines = tasks.map((t) => `#${t.id} ${t.title}\uFF08\u8D1F\u8D23\u4EBA\uFF1A${t.assignee_name}\uFF0C\u4F18\u5148\u7EA7\uFF1A${t.priority}\uFF0C\u622A\u6B62\uFF1A${t.due_date}\uFF09`);
      return { success: true, message: `\u5F53\u524D\u6709 ${tasks.length} \u4E2A\u5F85\u529E\u4EFB\u52A1\uFF1A
${lines.join("\n")}` };
    }
  },
  list_overdue_payments: {
    description: "\u67E5\u770B\u6240\u6709\u903E\u671F\u672A\u6536\u6B3E\u9879",
    params: "\u65E0 (\u65E0\u9700\u53C2\u6570)",
    handler: async () => {
      const items = await dbAll(`
        SELECT *
        FROM (
          SELECT o.display_id, c.name AS customer_name, o.total_amount, o.created_at,
            COALESCE((SELECT SUM(amount) FROM finance_records WHERE order_id = o.id AND type = 'receipt' AND status = 'completed' AND deleted_at IS NULL), 0) AS paid
          FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
          WHERE o.status != 'completed' AND o.deleted_at IS NULL
        ) overdue_orders
        WHERE paid < total_amount
        ORDER BY created_at ASC
      `);
      if (!items.length) return { success: true, message: "\u6CA1\u6709\u903E\u671F\u672A\u6536\u6B3E\u3002" };
      const lines = items.map((i) => `${i.display_id} ${i.customer_name} \u5E94\u6536 $${Number(i.total_amount).toLocaleString()} \u5DF2\u6536 $${Number(i.paid).toLocaleString()}`);
      return { success: true, message: `\u4EE5\u4E0B ${items.length} \u7B14\u8BA2\u5355\u5C1A\u672A\u7ED3\u6E05\uFF1A
${lines.join("\n")}` };
    }
  },
  list_customers: {
    description: "\u67E5\u770B\u5BA2\u6237\u5217\u8868",
    params: "keyword (\u5173\u952E\u8BCD\u641C\u7D22, \u53EF\u9009)",
    handler: async (p) => {
      const sql = p.keyword ? `SELECT id, name, country FROM customers WHERE deleted_at IS NULL AND (name LIKE ? OR country LIKE ?) ORDER BY created_at DESC LIMIT 10` : `SELECT id, name, country FROM customers WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`;
      const params = p.keyword ? [`%${p.keyword}%`, `%${p.keyword}%`] : [];
      const customers = await dbAll(sql, params);
      if (!customers.length) return { success: true, message: "\u672A\u627E\u5230\u5339\u914D\u7684\u5BA2\u6237\u3002" };
      const lines = customers.map((c) => `#${c.id} ${c.name}\uFF08${c.country || "\u672A\u77E5\u56FD\u5BB6"}\uFF09`);
      return { success: true, message: `\u627E\u5230 ${customers.length} \u4E2A\u5BA2\u6237\uFF1A
${lines.join("\n")}` };
    }
  }
};
var AI_TOOLS_SYSTEM_PROMPT = `\u4F60\u662F\u4E00\u4E2A\u5D4C\u5165\u5728 SmartTrade CRM \u7CFB\u7EDF\u4E2D\u7684 AI \u4E1A\u52A1\u52A9\u624B\u3002\u9664\u4E86\u56DE\u7B54\u95EE\u9898\uFF0C\u4F60\u8FD8\u53EF\u4EE5\u6267\u884C\u4EE5\u4E0B\u64CD\u4F5C\uFF1A

${Object.entries(AI_TOOLS).map(([name, tool]) => `- ${name}: ${tool.description}\u3002\u53C2\u6570\uFF1A${tool.params}`).join("\n")}

\u5982\u679C\u4F60\u68C0\u6D4B\u5230\u7528\u6237\u60F3\u8981\u6267\u884C\u64CD\u4F5C\uFF0C\u8C03\u7528\u6B63\u786E\u7684\u5DE5\u5177\u5E76\u8FD4\u56DE\u7ED3\u679C\u3002\u5982\u679C\u7528\u6237\u53EA\u662F\u63D0\u95EE\uFF0C\u76F4\u63A5\u56DE\u7B54\u5373\u53EF\u3002
\u56DE\u7B54\u65F6\u4FDD\u6301\u4E13\u4E1A\u3001\u7B80\u6D01\uFF0C\u4F7F\u7528\u4E2D\u6587\u3002`;

// server/services/order-detail.ts
init_db();

// server/lib/files.ts
import path4 from "path";

// server/paths.ts
import path3 from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
var __filename3 = fileURLToPath3(import.meta.url);
var __dirname3 = path3.dirname(__filename3);
var PROJECT_ROOT = path3.join(__dirname3, "..");
var UPLOADS_DIR = process.env.UPLOADS_DIR || path3.join(PROJECT_ROOT, "uploads");

// server/lib/files.ts
var SAFE_STORED_NAME = /^[A-Za-z0-9._-]+$/;
function isPathInside(parentPath, targetPath) {
  const relative = path4.relative(parentPath, targetPath);
  return relative === "" || !relative.startsWith("..") && !path4.isAbsolute(relative);
}
function buildAttachmentUrl(attachmentId, storedName) {
  return `/api/files/${attachmentId}/${encodeURIComponent(storedName)}`;
}
function isSafeStoredName(value) {
  return Boolean(value) && SAFE_STORED_NAME.test(value) && path4.basename(value) === value && !value.includes("..") && !/[\\/\0]/.test(value);
}
function normalizeAttachmentRelativePath(filePath) {
  const normalized = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) {
    return "";
  }
  return normalized.startsWith("uploads/") ? normalized.slice("uploads/".length) : normalized;
}
function resolveAttachmentAbsolutePath(filePath) {
  const normalized = normalizeAttachmentRelativePath(filePath);
  if (!normalized || normalized.includes("\0")) {
    return null;
  }
  const uploadsRoot = path4.resolve(UPLOADS_DIR);
  const absolutePath = path4.resolve(uploadsRoot, normalized);
  return isPathInside(uploadsRoot, absolutePath) ? absolutePath : null;
}
function getStoredNameFromRecord(storedName, filePath) {
  const explicitStoredName = String(storedName || "").trim();
  if (explicitStoredName) {
    return explicitStoredName;
  }
  return path4.basename(normalizeAttachmentRelativePath(String(filePath || "")));
}
function sanitizeDownloadFilename(fileName) {
  const fallback = String(fileName || "download").replace(/["\\]/g, "_").replace(/[^\x20-\x7E]/g, "_").trim();
  return fallback || "download";
}

// server/services/order-detail.ts
init_values();

// server/services/attachments.ts
init_db();
import fs2 from "fs/promises";
async function getAttachmentsByEntity(entityType, entityIds) {
  if (!entityIds.length) {
    return /* @__PURE__ */ new Map();
  }
  const placeholders = entityIds.map(() => "?").join(", ");
  const rows = await dbAll(
    `
      SELECT id, entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path, created_at
      FROM attachments
      WHERE entity_type = ? AND entity_id IN (${placeholders})
      ORDER BY datetime(created_at) DESC, id DESC
    `,
    [entityType, ...entityIds]
  );
  const grouped = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const entityId = Number(row.entity_id);
    if (!grouped.has(entityId)) {
      grouped.set(entityId, []);
    }
    grouped.get(entityId)?.push({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      fileName: row.file_name,
      storedName: getStoredNameFromRecord(row.stored_name, row.file_path),
      mimeType: row.mime_type,
      fileSize: row.file_size,
      filePath: row.file_path,
      url: buildAttachmentUrl(Number(row.id), getStoredNameFromRecord(row.stored_name, row.file_path)),
      createdAt: row.created_at
    });
  }
  return grouped;
}
async function bindAttachmentsToEntity(entityType, entityId, attachmentIds) {
  const placeholders = attachmentIds.length > 0 ? attachmentIds.map(() => "?").join(", ") : null;
  const unbindSql = placeholders ? `UPDATE attachments SET entity_type = NULL, entity_id = NULL WHERE entity_type = ? AND entity_id = ? AND id NOT IN (${placeholders})` : `UPDATE attachments SET entity_type = NULL, entity_id = NULL WHERE entity_type = ? AND entity_id = ?`;
  const unbindParams = placeholders ? [entityType, entityId, ...attachmentIds] : [entityType, entityId];
  await dbRun(unbindSql, unbindParams);
  if (attachmentIds.length > 0) {
    const bindPlaceholders = attachmentIds.map(() => "?").join(", ");
    await dbRun(
      `
        UPDATE attachments
        SET entity_type = ?, entity_id = ?
        WHERE id IN (${bindPlaceholders})
      `,
      [entityType, entityId, ...attachmentIds]
    );
  }
}
async function deleteAttachmentRows(entityType, entityId) {
  const attachments = await dbAll(
    `SELECT id, file_path FROM attachments WHERE entity_type = ? AND entity_id = ?`,
    [entityType, entityId]
  );
  for (const attachment of attachments) {
    if (attachment.file_path) {
      const fullPath = resolveAttachmentAbsolutePath(attachment.file_path);
      if (!fullPath) {
        continue;
      }
      try {
        await fs2.unlink(fullPath);
      } catch (_error) {
      }
    }
  }
  await dbRun(`DELETE FROM attachments WHERE entity_type = ? AND entity_id = ?`, [entityType, entityId]);
}

// server/services/order-detail.ts
function getTimelineValue(record) {
  const rawValue = String(record.shipping_date || record.created_at || "");
  return rawValue ? new Date(rawValue).getTime() : 0;
}
async function buildOrderDetail(idOrNo) {
  const isId = typeof idOrNo === "number" || /^\d+$/.test(String(idOrNo));
  const sql = `
    SELECT
      o.*,
      c.name AS customer_name,
      c.display_id AS customer_display_id,
      c.country AS customer_country,
      c.contact AS customer_contact,
      c.logistics_preference AS customer_logistics_preference,
      c.payment_terms AS customer_payment_terms,
      cu.name AS created_by_name
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN users cu ON cu.id = o.created_by
    WHERE ${isId ? "o.id" : "LOWER(o.display_id)"} = ?
      AND o.deleted_at IS NULL
  `;
  const order = await dbGet(sql, [isId ? idOrNo : String(idOrNo).toLowerCase()]);
  if (!order) {
    return null;
  }
  const orderId = Number(order.id);
  const items = await dbAll(`
    SELECT *
    FROM order_items
    WHERE order_id = ?
    ORDER BY id ASC
  `, [orderId]);
  const financeRecords = await dbAll(`
    SELECT
      f.*,
      p.name AS partner_name,
      p.partner_type AS partner_type,
      u.name AS created_by_name
    FROM finance_records f
    LEFT JOIN partners p ON p.id = f.partner_id
    LEFT JOIN users u ON u.id = f.created_by
    WHERE f.order_id = ? AND f.deleted_at IS NULL
    ORDER BY datetime(f.created_at) DESC, f.id DESC
  `, [orderId]);
  let logisticsRecords = [];
  try {
    logisticsRecords = await dbAll(`
      SELECT
        l.*,
        fp.name AS freight_forwarder_partner_name,
        fp.partner_type AS freight_forwarder_partner_type,
        fp.country AS freight_forwarder_partner_country,
        fp.contact AS freight_forwarder_partner_contact,
        u.name AS created_by_name
      FROM logistics_records l
      LEFT JOIN partners fp ON fp.id = l.freight_forwarder_partner_id
      LEFT JOIN users u ON u.id = l.created_by
      WHERE l.order_id = ? AND l.deleted_at IS NULL
      ORDER BY
        CASE WHEN segment_type = 'domestic' THEN 0 ELSE 1 END ASC,
        CASE WHEN shipping_date IS NULL OR shipping_date = '' THEN 1 ELSE 0 END ASC,
        l.shipping_date DESC,
        datetime(l.created_at) DESC,
        id DESC
      `, [orderId]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("freight_forwarder_partner_id")) {
      throw error;
    }
    logisticsRecords = await dbAll(`
      SELECT
        l.*,
        NULL AS freight_forwarder_partner_id,
        NULL AS freight_forwarder_partner_name,
        NULL AS freight_forwarder_partner_type,
        NULL AS freight_forwarder_partner_country,
        NULL AS freight_forwarder_partner_contact,
        u.name AS created_by_name
      FROM logistics_records l
      LEFT JOIN users u ON u.id = l.created_by
      WHERE l.order_id = ? AND l.deleted_at IS NULL
      ORDER BY
        CASE WHEN segment_type = 'domestic' THEN 0 ELSE 1 END ASC,
        CASE WHEN shipping_date IS NULL OR shipping_date = '' THEN 1 ELSE 0 END ASC,
        l.shipping_date DESC,
        datetime(l.created_at) DESC,
        id DESC
      `, [orderId]);
  }
  const packingRecords = await dbAll(
    `
      SELECT pr.*, a.stored_name, a.file_path
      FROM packing_records pr
      LEFT JOIN attachments a ON a.id = pr.attachment_id
      WHERE pr.order_id = ?
      ORDER BY pr.id ASC
    `,
    [orderId]
  );
  const customs = await dbGet(
    `
      SELECT
        c.*,
        u.name AS created_by_name
      FROM customs_records c
      LEFT JOIN users u ON u.id = c.created_by
      WHERE c.order_id = ?
      LIMIT 1
    `,
    [orderId]
  );
  const productionPlan = await dbGet(
    `
      SELECT
        pp.*,
        p.name AS partner_name,
        p.partner_type AS partner_type,
        p.country AS partner_country,
        p.contact AS partner_contact,
        u.name AS created_by_name
      FROM production_plans pp
      LEFT JOIN partners p ON p.id = pp.partner_id
      LEFT JOIN users u ON u.id = pp.created_by
      WHERE pp.order_id = ?
      LIMIT 1
    `,
    [orderId]
  );
  let productionLogs = [];
  if (productionPlan) {
    productionLogs = await dbAll(
      `
        SELECT pl.*, u.name as created_by_name
        FROM production_logs pl
        LEFT JOIN users u ON u.id = pl.created_by
        WHERE pl.plan_id = ?
        ORDER BY datetime(pl.created_at) DESC
      `,
      [productionPlan.id]
    );
  }
  const summaryRows = await dbAll(`
    SELECT type, currency, payment_category, COALESCE(SUM(amount), 0) AS total
    FROM finance_records
    WHERE order_id = ? AND status = 'completed' AND deleted_at IS NULL
    GROUP BY type, currency, payment_category
  `, [orderId]);
  const receiptsByCurrency = {};
  const paymentsByCurrency = {};
  const freightByCurrency = {};
  for (const row of summaryRows) {
    const cur = row.currency || "USD";
    if (row.type === "receipt") {
      receiptsByCurrency[cur] = (receiptsByCurrency[cur] || 0) + row.total;
    } else {
      paymentsByCurrency[cur] = (paymentsByCurrency[cur] || 0) + row.total;
      if (row.payment_category === "freight") {
        freightByCurrency[cur] = (freightByCurrency[cur] || 0) + row.total;
      }
    }
  }
  const pendingFinanceCount = await dbGet(
    `SELECT COUNT(*) AS count FROM finance_records WHERE order_id = ? AND status = 'pending' AND deleted_at IS NULL`,
    [orderId]
  );
  const domesticLogisticsRecord = logisticsRecords.find((item) => item.segment_type === "domestic") || null;
  const internationalLogisticsRecord = logisticsRecords.find((item) => item.segment_type !== "domestic") || null;
  const latestLogistics = [...logisticsRecords].sort((left, right) => getTimelineValue(right) - getTimelineValue(left))[0] || internationalLogisticsRecord || domesticLogisticsRecord || null;
  const orderAmount = Number(order.total_amount) || 0;
  const receiptTotal = receiptsByCurrency.USD || 0;
  const paymentStatus = receiptTotal <= 0 ? "unpaid" : receiptTotal >= orderAmount && orderAmount > 0 ? "paid" : "partial";
  const outstandingAmount = Math.max(orderAmount - receiptTotal, 0);
  const settled = outstandingAmount <= 0 && orderAmount > 0;
  const financeAttachments = await getAttachmentsByEntity("finance", financeRecords.map((record) => Number(record.id)));
  const logisticsAttachments = await getAttachmentsByEntity("logistics", logisticsRecords.map((record) => Number(record.id)));
  const customsAttachments = customs ? await getAttachmentsByEntity("customs", [Number(customs.id)]) : /* @__PURE__ */ new Map();
  const productionLogAttachments = productionPlan ? await getAttachmentsByEntity("production_log", productionLogs.map((l) => Number(l.id))) : /* @__PURE__ */ new Map();
  const productionPhotos = await getAttachmentsByEntity("production_photo", [orderId]);
  const orderDocuments = await getAttachmentsByEntity("order_document", [orderId]);
  const followUps = await dbAll(
    `SELECT of.*, u.name AS created_by_name FROM order_follow_ups of LEFT JOIN users u ON u.id = of.created_by WHERE of.order_id = ? ORDER BY datetime(of.created_at) DESC, of.id DESC`,
    [orderId]
  );
  const tasks = await dbAll(
    `SELECT t.*, u.name as assignee_name
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.entity_type = 'ORDER' AND t.entity_id = ?
     ORDER BY CASE WHEN t.status = 'done' THEN 1 ELSE 0 END, t.due_date ASC, t.created_at DESC`,
    [String(orderId)]
  );
  return {
    order: {
      ...order,
      status: normalizeOrderStatus(String(order.status || "draft")),
      deliveryDate: order.delivery_date || null,
      freightAmount: Number(order.freight_amount) || 0,
      miscAmount: Number(order.misc_amount) || 0,
      createdByName: order.created_by_name || null
    },
    customer: {
      id: order.customer_id,
      display_id: order.customer_display_id,
      name: order.customer_name,
      country: order.customer_country,
      contact: order.customer_contact,
      logisticsPreference: order.customer_logistics_preference,
      paymentTerms: order.customer_payment_terms
    },
    items: items.map((item) => ({
      ...item,
      hsCode: item.hs_code || null,
      imageUrl: item.image_url || null
    })),
    financeRecords: financeRecords.map((record) => ({
      ...record,
      recordCategory: record.record_category || record.payment_category || (record.type === "receipt" ? "deposit" : "other"),
      partnerId: record.partner_id || null,
      partnerName: record.partner_name || null,
      createdAt: record.created_at,
      createdByName: record.created_by_name || null,
      attachments: financeAttachments.get(Number(record.id)) || [],
      attachmentCount: (financeAttachments.get(Number(record.id)) || []).length
    })),
    productionPlan: productionPlan ? {
      ...productionPlan,
      partnerId: productionPlan.partner_id,
      partnerName: productionPlan.partner_name,
      partnerType: productionPlan.partner_type,
      partnerCountry: productionPlan.partner_country,
      partnerContact: productionPlan.partner_contact,
      orderDate: productionPlan.order_date,
      estimatedDeliveryDate: productionPlan.estimated_delivery_date,
      productionStatus: productionPlan.production_status,
      inspectionStatus: productionPlan.inspection_status,
      updatedAt: productionPlan.updated_at,
      createdByName: productionPlan.created_by_name || null,
      photos: productionPhotos.get(orderId) || [],
      logs: productionLogs.map((l) => ({
        ...l,
        logDate: l.log_date,
        createdByName: l.created_by_name,
        attachments: productionLogAttachments.get(Number(l.id)) || []
      }))
    } : null,
    logisticsRecords: logisticsRecords.map((record) => ({
      ...record,
      segmentType: record.segment_type || "international",
      freightForwarder: record.freight_forwarder || null,
      freightForwarderPartnerId: record.freight_forwarder_partner_id || null,
      freightForwarderPartnerName: record.freight_forwarder_partner_name || null,
      freightForwarderPartnerType: record.freight_forwarder_partner_type || null,
      freightForwarderPartnerCountry: record.freight_forwarder_partner_country || null,
      freightForwarderPartnerContact: record.freight_forwarder_partner_contact || null,
      trackingNo: record.tracking_no,
      packingDetails: record.packing_details,
      shippingDate: record.shipping_date,
      packageCount: record.package_count,
      volumeCbm: record.volume_cbm,
      grossWeightKg: record.gross_weight_kg,
      transportMode: record.transport_mode,
      vesselVoyage: record.vessel_voyage,
      billNo: record.bill_no,
      etd: record.etd,
      eta: record.eta,
      recipientAddress: record.recipient_address,
      packageSize: record.package_size,
      remark: record.remark,
      createdAt: record.created_at,
      createdByName: record.created_by_name || null,
      attachments: logisticsAttachments.get(Number(record.id)) || [],
      attachmentCount: (logisticsAttachments.get(Number(record.id)) || []).length
    })),
    customs: customs ? {
      ...customs,
      brokerName: customs.broker_name,
      declarationNo: customs.declaration_no,
      declarationDate: customs.declaration_date,
      releaseDate: customs.release_date,
      tradeMode: customs.trade_mode,
      createdAt: customs.created_at,
      updatedAt: customs.updated_at,
      createdByName: customs.created_by_name || null,
      attachments: customsAttachments.get(Number(customs.id)) || [],
      attachmentCount: (customsAttachments.get(Number(customs.id)) || []).length
    } : null,
    packingRecords: packingRecords.map((record) => ({
      id: record.id,
      packageCount: String(record.package_count || ""),
      packageSize: String(record.package_size || ""),
      grossWeight: String(record.gross_weight || ""),
      netWeight: String(record.net_weight || ""),
      attachmentId: record.attachment_id,
      imageUrl: record.attachment_id ? buildAttachmentUrl(Number(record.attachment_id), getStoredNameFromRecord(record.stored_name, record.file_path)) : null
    })),
    domesticLogistics: domesticLogisticsRecord ? {
      ...domesticLogisticsRecord,
      segmentType: domesticLogisticsRecord.segment_type || "domestic",
      trackingNo: domesticLogisticsRecord.tracking_no,
      packingDetails: domesticLogisticsRecord.packing_details,
      shippingDate: domesticLogisticsRecord.shipping_date,
      packageCount: domesticLogisticsRecord.package_count,
      volumeCbm: domesticLogisticsRecord.volume_cbm,
      grossWeightKg: domesticLogisticsRecord.gross_weight_kg,
      transportMode: domesticLogisticsRecord.transport_mode,
      vesselVoyage: domesticLogisticsRecord.vessel_voyage,
      billNo: domesticLogisticsRecord.bill_no,
      createdAt: domesticLogisticsRecord.created_at,
      createdByName: domesticLogisticsRecord.created_by_name || null,
      attachments: logisticsAttachments.get(Number(domesticLogisticsRecord.id)) || [],
      attachmentCount: (logisticsAttachments.get(Number(domesticLogisticsRecord.id)) || []).length
    } : null,
    internationalLogistics: internationalLogisticsRecord ? {
      ...internationalLogisticsRecord,
      segmentType: internationalLogisticsRecord.segment_type || "international",
      trackingNo: internationalLogisticsRecord.tracking_no,
      packingDetails: internationalLogisticsRecord.packing_details,
      shippingDate: internationalLogisticsRecord.shipping_date,
      packageCount: internationalLogisticsRecord.package_count,
      volumeCbm: internationalLogisticsRecord.volume_cbm,
      grossWeightKg: internationalLogisticsRecord.gross_weight_kg,
      transportMode: internationalLogisticsRecord.transport_mode,
      vesselVoyage: internationalLogisticsRecord.vessel_voyage,
      billNo: internationalLogisticsRecord.bill_no,
      createdAt: internationalLogisticsRecord.created_at,
      createdByName: internationalLogisticsRecord.created_by_name || null,
      attachments: logisticsAttachments.get(Number(internationalLogisticsRecord.id)) || [],
      attachmentCount: (logisticsAttachments.get(Number(internationalLogisticsRecord.id)) || []).length
    } : null,
    orderDocuments: orderDocuments.get(orderId) || [],
    followUps: followUps.map((l) => ({
      id: l.id,
      content: l.content,
      createdByName: l.created_by_name,
      createdAt: l.created_at
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      assignee_name: t.assignee_name,
      due_date: t.due_date,
      priority: t.priority,
      status: t.status,
      description: t.description
    })),
    summary: {
      receiptsByCurrency,
      paymentsByCurrency,
      freightByCurrency,
      pendingFinanceCount: pendingFinanceCount?.count || 0,
      latestLogisticsStatus: latestLogistics?.status || null,
      latestShippingDate: latestLogistics?.shipping_date || null,
      paidAmount: receiptsByCurrency.USD || 0,
      outstandingAmount,
      paymentStatus,
      settled,
      attachmentsSummary: {
        finance: financeRecords.reduce((sum, record) => sum + (financeAttachments.get(Number(record.id)) || []).length, 0),
        logistics: logisticsRecords.reduce((sum, record) => sum + (logisticsAttachments.get(Number(record.id)) || []).length, 0),
        customs: customs ? (customsAttachments.get(Number(customs.id)) || []).length : 0
      }
    }
  };
}

// server/services/settings.ts
init_db();
async function getSettingValue(key, fallback = "") {
  const setting = await dbGet(`SELECT value FROM settings WHERE key = ?`, [key]);
  return setting?.value || fallback;
}
async function setSettingValue(key, value) {
  await dbRun(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}
async function getOrderNumberPrefix() {
  const rawValue = (await getSettingValue("order_number_prefix", "ORD-")).trim();
  return rawValue || "ORD-";
}

// server/routes/ai.ts
init_values();
init_http();
async function resolveModel() {
  const selectedModel = (await getSettingValue("current_ai_model", "deepseek-v4-flash")).trim();
  const provider = resolveAiProvider(selectedModel);
  const apiKey = resolveAiProviderApiKey(provider, await getSettingValue("ai_api_key"));
  const configuredBaseUrl = readString(await getSettingValue("ai_base_url"));
  let baseUrl = configuredBaseUrl;
  if (!baseUrl) {
    if (provider === "deepseek") baseUrl = "https://api.deepseek.com";
    else if (provider === "openai-compatible") baseUrl = "https://api.openai.com";
  }
  if (!apiKey) throw new Error("AI_API_KEY_MISSING");
  return { selectedModel, provider, apiKey: apiKey || "", baseUrl };
}
function findToolCall(text) {
  const match = text.match(/\[ACTION:\s*(\w+)\s*(.*?)\]/s);
  if (!match) return null;
  const tool = match[1];
  const raw = match[2].trim();
  const params = {};
  const paramRegex = /(\w+)\s*=\s*"([^"]*)"/g;
  let pm;
  while ((pm = paramRegex.exec(raw)) !== null) {
    params[pm[1]] = pm[2];
  }
  return AI_TOOLS[tool] ? { tool, params } : null;
}
function readPendingAction(raw) {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw;
  const tool = readString(candidate.tool);
  if (!tool || !AI_TOOLS[tool]) return null;
  const params = {};
  if (candidate.params && typeof candidate.params === "object") {
    for (const [key, value] of Object.entries(candidate.params)) {
      params[key] = readString(value);
    }
  }
  return { tool, params };
}
function describeToolCall(toolCall) {
  const tool = AI_TOOLS[toolCall.tool];
  const params = Object.entries(toolCall.params).filter(([, value]) => value).map(([key, value]) => `${key}=${value}`).join("\uFF0C");
  return `${tool.description}${params ? `\uFF08${params}\uFF09` : ""}`;
}
async function executeToolCall(req, toolCall) {
  const tool = AI_TOOLS[toolCall.tool];
  if (!tool) {
    throw new Error("AI_TOOL_NOT_FOUND");
  }
  if (tool.requiredRole && req.user?.role !== tool.requiredRole) {
    throw new Error("AI_TOOL_FORBIDDEN");
  }
  return tool.handler(toolCall.params, { userId: req.user.id, role: req.user.role });
}
function createAiRouter() {
  const router2 = Router();
  router2.post("/chat", async (req, res) => {
    const message = readString(req.body?.message);
    const pendingAction = readPendingAction(req.body?.pendingAction);
    const confirmAction = req.body?.confirmAction === true;
    if (!message && !pendingAction) return fail(res, 400, "\u8BF7\u8F93\u5165\u5BF9\u8BDD\u5185\u5BB9", "INVALID_AI_INPUT");
    try {
      if (pendingAction) {
        if (!confirmAction) {
          return res.json({
            content: `\u8BF7\u786E\u8BA4\u662F\u5426\u6267\u884C\uFF1A${describeToolCall(pendingAction)}`,
            requiresConfirmation: true,
            pendingAction
          });
        }
        const toolResult = await executeToolCall(req, pendingAction);
        return res.json({ content: toolResult.message, action: { tool: pendingAction.tool, result: toolResult } });
      }
      const { selectedModel, provider, apiKey, baseUrl } = await resolveModel();
      const safeMessage = sanitizeOrderData(message);
      const prompt = `${AI_TOOLS_SYSTEM_PROMPT}

\u7528\u6237\u6D88\u606F\uFF1A
"""
${safeMessage}
"""

\u5982\u679C\u4F60\u9700\u8981\u6267\u884C\u64CD\u4F5C\uFF0C\u8BF7\u4EE5 [ACTION: \u5DE5\u5177\u540D \u53C2\u6570\u540D="\u53C2\u6570\u503C"] \u7684\u683C\u5F0F\u8F93\u51FA\u3002\u4F8B\u5982\u521B\u5EFA\u4EFB\u52A1\uFF1A[ACTION: create_task title="\u6D4B\u8BD5\u4EFB\u52A1" assignee_username="root" due_date="2026-05-01"]\u3002\u5982\u679C\u9700\u8981\u67E5\u6570\u636E\u4E5F\u540C\u7406\u3002\u4E0D\u6267\u884C\u64CD\u4F5C\u65F6\u76F4\u63A5\u56DE\u590D\u5373\u53EF\u3002`;
      const result = provider === "gemini" ? await runGeminiModel(selectedModel, apiKey, prompt, false) : await runOpenAiCompatibleModel({ model: selectedModel, apiKey, baseUrl, prompt, jsonMode: false });
      const rawContent = typeof result === "string" ? result : result.content || result.summary || JSON.stringify(result);
      const toolCall = findToolCall(rawContent);
      if (toolCall) {
        if (AI_TOOLS[toolCall.tool].mutating && !confirmAction) {
          return res.json({
            content: `AI \u8BF7\u6C42\u6267\u884C\uFF1A${describeToolCall(toolCall)}\u3002\u8BF7\u786E\u8BA4\u540E\u518D\u6267\u884C\u3002`,
            requiresConfirmation: true,
            pendingAction: toolCall
          });
        }
        const toolResult = await executeToolCall(req, toolCall);
        const summaryPrompt = `\u4F60\u521A\u521A\u6267\u884C\u4E86\u64CD\u4F5C"${toolCall.tool}"\uFF0C\u7ED3\u679C\u662F\uFF1A${toolResult.message}\u3002\u8BF7\u7528\u81EA\u7136\u8BED\u8A00\u7B80\u8981\u544A\u77E5\u7528\u6237\u7ED3\u679C\uFF0C\u4FDD\u6301\u4E13\u4E1A\u7B80\u6D01\u3002`;
        const summaryResult = provider === "gemini" ? await runGeminiModel(selectedModel, apiKey, summaryPrompt, false) : await runOpenAiCompatibleModel({ model: selectedModel, apiKey, baseUrl, prompt: summaryPrompt, jsonMode: false });
        const summary = typeof summaryResult === "string" ? summaryResult : summaryResult.content || toolResult.message;
        const cleanSummary = summary.replace(/\[ACTION:.*?\]/gs, "").trim();
        res.json({ content: cleanSummary || toolResult.message, action: { tool: toolCall.tool, result: toolResult } });
        return;
      }
      const content = rawContent.replace(/\[ACTION:.*?\]/gs, "").trim();
      res.json({ content: content || "\u5DF2\u6536\u5230\u60A8\u7684\u6D88\u606F\u3002" });
    } catch (error) {
      if (error.message === "AI_API_KEY_MISSING") {
        return fail(res, 400, "\u8BF7\u5148\u5728\u7CFB\u7EDF\u8BBE\u7F6E\u4E2D\u914D\u7F6E\u53EF\u7528\u7684 AI API Key", "AI_KEY_MISSING");
      }
      if (error.message === "AI_TOOL_FORBIDDEN") {
        return fail(res, 403, "\u5F53\u524D\u8D26\u53F7\u65E0\u6743\u6267\u884C\u8BE5 AI \u64CD\u4F5C", "AI_TOOL_FORBIDDEN");
      }
      return handleRouteError(res, error, "AI \u52A9\u624B\u6682\u65F6\u65E0\u6CD5\u54CD\u5E94");
    }
  });
  router2.post("/parse-order", async (req, res) => {
    const text = readString(req.body?.text);
    if (!text) return fail(res, 400, "\u8BF7\u5148\u8F93\u5165\u5BA2\u6237\u6D88\u606F\u5185\u5BB9", "INVALID_AI_INPUT");
    try {
      const { selectedModel, provider, apiKey, baseUrl } = await resolveModel();
      const prompt = buildOrderParsingPrompt(text);
      const result = provider === "gemini" ? await runGeminiModel(selectedModel, apiKey, prompt) : await runOpenAiCompatibleModel({ model: selectedModel, apiKey, baseUrl, prompt });
      res.json(result);
    } catch (error) {
      return handleRouteError(res, error, "\u8BA2\u5355\u89E3\u6790\u5931\u8D25");
    }
  });
  router2.post("/analyze-order", async (req, res) => {
    const orderNo = readString(req.body?.orderNo);
    if (!orderNo) return fail(res, 400, "\u8BF7\u63D0\u4F9B\u8BA2\u5355\u7F16\u53F7", "INVALID_AI_INPUT");
    try {
      const rawData = await buildOrderDetail(orderNo);
      if (!rawData) return fail(res, 404, "\u8BA2\u5355\u4E0D\u5B58\u5728");
      const { selectedModel, provider, apiKey, baseUrl } = await resolveModel();
      const prompt = buildOrderAnalysisPrompt(sanitizeOrderData(rawData));
      const result = provider === "gemini" ? await runGeminiModel(selectedModel, apiKey, prompt) : await runOpenAiCompatibleModel({ model: selectedModel, apiKey, baseUrl, prompt });
      res.json(result);
    } catch (error) {
      return handleRouteError(res, error, "\u98CE\u9669\u5206\u6790\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/attachments.ts
init_db();
init_auth();
import { Router as Router2 } from "express";
import multer from "multer";
import fs3 from "fs/promises";
import path5 from "path";
import { randomUUID } from "crypto";
init_http();
function sanitizePathSegment(value, fallback) {
  const normalized = String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return normalized || fallback;
}
var BLOCKED_MIME_TYPES = /* @__PURE__ */ new Set([
  "text/html",
  "application/xhtml+xml",
  "application/javascript",
  "text/javascript",
  "image/svg+xml",
  "application/x-httpd-php",
  "application/x-msdownload",
  "application/x-executable"
]);
var upload = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, callback) => {
      const customerId = sanitizePathSegment(req.body.customerId, "general");
      const orderId = sanitizePathSegment(req.body.orderId, "misc");
      const targetDir = path5.join(UPLOADS_DIR, `customer_${customerId}`, `order_${orderId}`);
      try {
        await fs3.mkdir(targetDir, { recursive: true });
        callback(null, targetDir);
      } catch (error) {
        callback(error, targetDir);
      }
    },
    filename: (_req, file, callback) => {
      const extension = path5.extname(file.originalname || "");
      callback(null, `${Date.now()}-${randomUUID()}${extension}`);
    }
  }),
  fileFilter: (_req, file, callback) => {
    if (BLOCKED_MIME_TYPES.has(file.mimetype)) {
      callback(new Error(`\u4E0D\u5141\u8BB8\u4E0A\u4F20\u6B64\u7C7B\u578B\u7684\u6587\u4EF6: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 6
  }
});
function createAttachmentsRouter() {
  const router2 = Router2();
  router2.post("/", upload.array("files", 6), async (req, res) => {
    const files = req.files || [];
    const customerId = sanitizePathSegment(req.body.customerId, "general");
    const orderId = sanitizePathSegment(req.body.orderId, "misc");
    if (!files.length) {
      return fail(res, 400, "\u8BF7\u81F3\u5C11\u4E0A\u4F20\u4E00\u4E2A\u9644\u4EF6", "INVALID_ATTACHMENTS");
    }
    try {
      const uploaded = [];
      const entityType = req.body.entityType || null;
      const entityId = req.body.entityId || null;
      const remark = req.body.remark || null;
      for (const file of files) {
        const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
        const relativePath = path5.posix.join(`customer_${customerId}`, `order_${orderId}`, file.filename);
        const result = await dbRun(
          `
            INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path, remark)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
          `,
          [entityType, entityId, originalName, file.filename, file.mimetype, file.size, relativePath, remark]
        );
        uploaded.push({
          id: result.lastID,
          fileName: originalName,
          filePath: relativePath,
          storedName: file.filename,
          url: buildAttachmentUrl(result.lastID, file.filename),
          mimeType: file.mimetype,
          fileSize: file.size,
          remark
        });
      }
      res.status(201).json(uploaded);
    } catch (error) {
      return handleRouteError(res, error, "\u9644\u4EF6\u4E0A\u4F20\u5931\u8D25");
    }
  });
  router2.delete("/:id", requireAdmin, async (req, res) => {
    const attachmentId = Number(req.params.id);
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return fail(res, 400, "\u9644\u4EF6\u7F16\u53F7\u65E0\u6548", "INVALID_ATTACHMENT_ID");
    }
    try {
      const existing = await dbGet(`SELECT file_path FROM attachments WHERE id = ?`, [attachmentId]);
      if (!existing) {
        return fail(res, 404, "\u9644\u4EF6\u4E0D\u5B58\u5728", "ATTACHMENT_NOT_FOUND");
      }
      const fullPath = resolveAttachmentAbsolutePath(existing.file_path);
      if (fullPath) {
        try {
          await fs3.unlink(fullPath);
        } catch (_error) {
        }
      }
      await dbRun(`DELETE FROM attachments WHERE id = ?`, [attachmentId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u5220\u9664\u9644\u4EF6\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/auth.ts
init_db();
init_auth();
init_http();
init_values();
import { Router as Router3 } from "express";
import bcrypt from "bcryptjs";
var loginAttempts = /* @__PURE__ */ new Map();
var MAX_LOGIN_ATTEMPTS = 5;
var LOGIN_WINDOW_MS = 15 * 60 * 1e3;
function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) return false;
  entry.count++;
  return true;
}
var loginRateLimitCleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, 60 * 1e3);
loginRateLimitCleanup.unref?.();
function createAuthRouter() {
  const router2 = Router3();
  router2.post("/login", async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkLoginRateLimit(ip)) {
      return fail(res, 429, "\u767B\u5F55\u5C1D\u8BD5\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7 15 \u5206\u949F\u540E\u518D\u8BD5", "RATE_LIMITED");
    }
    const username = readString(req.body?.username);
    const password = readString(req.body?.password);
    if (!username || !password) {
      return fail(res, 400, "\u8BF7\u8F93\u5165\u7528\u6237\u540D\u548C\u5BC6\u7801", "INVALID_LOGIN");
    }
    try {
      const user = await dbGet(`SELECT * FROM users WHERE username = ?`, [username]);
      if (!user) {
        return fail(res, 401, "\u65E0\u6548\u7684\u7528\u6237\u540D\u6216\u5BC6\u7801", "INVALID_CREDENTIALS");
      }
      if (user.active === 0) {
        return fail(res, 403, "\u8D26\u53F7\u5DF2\u505C\u7528\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458", "ACCOUNT_DISABLED");
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return fail(res, 401, "\u65E0\u6548\u7684\u7528\u6237\u540D\u6216\u5BC6\u7801", "INVALID_CREDENTIALS");
      }
      const token = signAuthToken({ id: user.id, role: user.role, username: user.username, name: user.name });
      res.cookie("token", token, getCookieOptions());
      setCsrfCookie(res);
      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
          active: user.active !== 0
        }
      });
    } catch (error) {
      return handleRouteError(res, error, "\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF");
    }
  });
  router2.post("/logout", (_req, res) => {
    clearAuthCookie(res);
    clearCsrfCookie(res);
    res.json({ success: true });
  });
  router2.get("/me", async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
      return fail(res, 401, "\u672A\u767B\u5F55", "AUTH_REQUIRED");
    }
    try {
      requireAuth(req, res, async () => {
        const userId = req.user.id;
        const user = await dbGet(
          `SELECT id, username, role, name, active FROM users WHERE id = ?`,
          [userId]
        );
        if (!user) {
          clearAuthCookie(res);
          return fail(res, 404, "\u7528\u6237\u4E0D\u5B58\u5728", "USER_NOT_FOUND");
        }
        res.json({
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name,
            active: user.active !== 0
          }
        });
      });
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u5F53\u524D\u767B\u5F55\u4FE1\u606F\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/customers.ts
init_db();
init_auth();
init_http();
init_values();
import { Router as Router4 } from "express";

// server/lib/audit.ts
init_db();
init_logger();
async function logAction(params) {
  try {
    const safeOld = params.oldValue ? sanitizeForAI(params.oldValue) : null;
    const safeNew = params.newValue ? sanitizeForAI(params.newValue) : null;
    await dbRun(
      `
        INSERT INTO audit_logs (user_id, user_name, action_type, entity_type, entity_id, old_value, new_value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        params.userId,
        params.userName,
        params.action,
        params.entityType,
        String(params.entityId),
        safeOld ? JSON.stringify(safeOld) : null,
        safeNew ? JSON.stringify(safeNew) : null
      ]
    );
  } catch (error) {
    logger.error({ err: error }, "Failed to log audit trail");
  }
}

// server/routes/customers.ts
function generateCustomerDisplayId() {
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "");
  const hash = Math.random().toString(36).slice(2, 8);
  return `cust-${date}-${hash}`;
}
function createCustomersRouter() {
  const router2 = Router4();
  router2.get("/", requireAuth, async (req, res) => {
    const q = readString(req.query.q);
    const startDate = readString(req.query.start_date);
    const endDate = readString(req.query.end_date);
    let whereSql = "WHERE c.deleted_at IS NULL";
    const params = [];
    if (q) {
      whereSql += ` AND (c.name LIKE ? OR c.country LIKE ? OR c.contact LIKE ? OR c.display_id LIKE ?)`;
      const p = `%${q}%`;
      params.push(p, p, p, p);
    }
    if (startDate) {
      whereSql += ` AND c.created_at >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      whereSql += ` AND c.created_at <= ?`;
      params.push(endDate);
    }
    try {
      const customers = await dbAll(`
        SELECT
          c.*,
          u.name AS created_by_name,
          COUNT(o.id) AS order_count
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.deleted_at IS NULL
        LEFT JOIN users u ON u.id = c.created_by
        ${whereSql}
        GROUP BY c.id
        ORDER BY datetime(c.created_at) DESC, c.id DESC
        ${buildLimitOffset(readPagination(req.query), params)}
      `, params);
      res.json(customers);
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u5BA2\u6237\u6570\u636E\u5931\u8D25");
    }
  });
  router2.get("/:id", requireAuth, async (req, res) => {
    const customerIdOrDisplay = req.params.id;
    try {
      const isNumeric = /^\d+$/.test(customerIdOrDisplay);
      const customer = await dbGet(`
        SELECT c.*, u.name AS created_by_name
        FROM customers c
        LEFT JOIN users u ON u.id = c.created_by
        WHERE c.deleted_at IS NULL
          AND (
            LOWER(c.display_id) = LOWER(?)
            ${isNumeric ? "OR c.id = ?" : ""}
          )
      `, isNumeric ? [customerIdOrDisplay, Number(customerIdOrDisplay)] : [customerIdOrDisplay]);
      if (!customer) {
        return fail(res, 404, "\u5BA2\u6237\u4E0D\u5B58\u5728", "CUSTOMER_NOT_FOUND");
      }
      const actualId = customer.id;
      const [orders, finance_records, followups, system_activities, tasks, contacts] = await Promise.all([
        dbAll(`
          SELECT 
            id, display_id, status, total_amount, product_summary, created_at,
            (SELECT COALESCE(SUM(amount), 0) FROM finance_records WHERE order_id = orders.id AND type = 'receipt' AND status = 'completed' AND deleted_at IS NULL) as paid_amount
          FROM orders
          WHERE customer_id = ? AND deleted_at IS NULL
          ORDER BY created_at DESC
        `, [actualId]),
        dbAll(`
          SELECT
            f.id, f.type, f.amount, f.currency, f.status, f.target, f.created_at, f.remark,
            o.display_id as order_display_id, o.product_summary
          FROM finance_records f
          LEFT JOIN orders o ON o.id = f.order_id
          WHERE o.customer_id = ? AND o.deleted_at IS NULL AND f.deleted_at IS NULL
          ORDER BY f.created_at DESC
        `, [actualId]),
        dbAll(`
          SELECT f.id, f.content, f.created_at, f.created_by, f.created_by_name,
                 NULL as source_order_id, NULL as source_order_display_id
          FROM customer_followups f
          WHERE f.customer_id = ?
          UNION ALL
          SELECT ofu.id, ofu.content, ofu.created_at, ofu.created_by,
                 COALESCE(u.name, '\u7CFB\u7EDF') as created_by_name,
                 ofu.order_id as source_order_id, o.display_id as source_order_display_id
          FROM order_follow_ups ofu
          JOIN orders o ON ofu.order_id = o.id
          LEFT JOIN users u ON ofu.created_by = u.id
          WHERE o.customer_id = ? AND o.deleted_at IS NULL
          ORDER BY created_at DESC
        `, [actualId, actualId]),
        dbAll(`
          SELECT 'finance' as type, f.id, o.display_id as order_display_id, 
            CASE WHEN f.type = 'receipt' THEN '\u6536\u6B3E\u5B8C\u6210' ELSE '\u4ED8\u6B3E\u5B8C\u6210' END as title,
            '' as desc, f.created_at,
            CASE WHEN f.type = 'receipt' THEN '+' ELSE '-' END || f.currency || ' ' || f.amount as value,
            CASE WHEN f.type = 'receipt' THEN 'text-emerald-500' ELSE 'text-red-500' END as valueColor
          FROM finance_records f JOIN orders o ON f.order_id = o.id
          WHERE f.status = 'completed' AND o.customer_id = ? AND o.deleted_at IS NULL AND f.deleted_at IS NULL
          UNION ALL
          SELECT 'logistics' as type, l.id, o.display_id as order_display_id, 
            '\u7269\u6D41\u66F4\u65B0' as title, '\u8D27\u7269\u5DF2\u53D1\u51FA \xB7 ' || l.carrier as desc, l.created_at,
            CASE WHEN l.status = 'arrived' THEN '\u5DF2\u9001\u8FBE' WHEN l.status = 'shipped' THEN '\u8FD0\u8F93\u4E2D' ELSE '\u5907\u8D27\u4E2D' END as value,
            'text-slate-500' as valueColor
          FROM logistics_records l JOIN orders o ON l.order_id = o.id
          WHERE o.customer_id = ? AND o.deleted_at IS NULL AND l.deleted_at IS NULL
          UNION ALL
          SELECT 'customs' as type, cr.id, o.display_id as order_display_id, 
            '\u62A5\u5173\u5B8C\u6210' as title, '\u62A5\u5173\u5355\u53F7 ' || cr.declaration_no as desc, cr.created_at,
            '' as value, '' as valueColor
          FROM customs_records cr JOIN orders o ON cr.order_id = o.id
          WHERE o.customer_id = ? AND o.deleted_at IS NULL
          UNION ALL
          SELECT 'order' as type, o.id, o.display_id as order_display_id, 
            '\u65B0\u5EFA\u8BA2\u5355' as title, o.product_summary as desc, o.created_at,
            'USD ' || o.total_amount as value,
            'text-primary-navy dark:text-white' as valueColor
          FROM orders o
          WHERE o.customer_id = ? AND o.deleted_at IS NULL
          ORDER BY 6 DESC
          LIMIT 20
        `, [actualId, actualId, actualId, actualId]),
        dbAll(`
          SELECT
            t.*,
            u.name as assignee_name,
            'CUSTOMER' as source_type,
            NULL as source_order_id,
            NULL as source_order_display_id
          FROM tasks t
          JOIN users u ON t.assignee_id = u.id
          WHERE t.entity_type = 'CUSTOMER' AND t.entity_id = ?
          UNION ALL
          SELECT
            t.*,
            u.name as assignee_name,
            'ORDER' as source_type,
            o.id as source_order_id,
            o.display_id as source_order_display_id
          FROM tasks t
          JOIN users u ON t.assignee_id = u.id
          JOIN orders o ON t.entity_type = 'ORDER' AND t.entity_id = o.display_id
          WHERE o.customer_id = ? AND o.deleted_at IS NULL
          ORDER BY due_date ASC, created_at DESC
        `, [actualId, actualId]),
        dbAll(`SELECT * FROM customer_contacts WHERE customer_id = ?`, [actualId])
      ]);
      res.json({ ...customer, orders, finance_records, system_activities, followups, contacts, tasks });
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u5BA2\u6237\u8BE6\u60C5\u5931\u8D25");
    }
  });
  router2.post("/", requireAuth, async (req, res) => {
    const name = readString(req.body?.name);
    const country = readString(req.body?.country);
    const contact = readString(req.body?.contact);
    const sourceChannel = readString(req.body?.sourceChannel);
    const intentProducts = readString(req.body?.intentProducts);
    if (!name || !country) {
      return fail(res, 400, "\u8BF7\u5B8C\u6574\u586B\u5199\u5BA2\u6237\u540D\u79F0\u548C\u56FD\u5BB6\u4FE1\u606F", "INVALID_CUSTOMER_PAYLOAD");
    }
    try {
      const displayId = generateCustomerDisplayId();
      const result = await dbRun(
        `
          INSERT INTO customers (display_id, name, country, contact, source_channel, intent_products, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
        [displayId, name, country, contact, sourceChannel, intentProducts, req.user?.id || null, req.user?.id || null]
      );
      const customerId = result.lastID;
      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: "CREATE",
        entityType: "CUSTOMER",
        entityId: customerId,
        newValue: { name, country, contact, sourceChannel, intentProducts, display_id: displayId }
      });
      res.status(201).json({ id: customerId, displayId });
    } catch (error) {
      return handleRouteError(res, error, "\u521B\u5EFA\u5BA2\u6237\u5931\u8D25");
    }
  });
  router2.post("/:id/followups", requireAuth, async (req, res) => {
    const customerId = req.params.id;
    const content = readString(req.body?.content);
    if (!content) return fail(res, 400, "\u8BF7\u8F93\u5165\u8DDF\u8FDB\u5185\u5BB9");
    try {
      const customer = await dbGet(`SELECT id FROM customers WHERE deleted_at IS NULL AND (id = ? OR display_id = ?)`, [customerId, customerId]);
      if (!customer) return fail(res, 404, "\u5BA2\u6237\u4E0D\u5B58\u5728");
      await dbRun(
        `INSERT INTO customer_followups (customer_id, content, created_by, created_by_name) VALUES (?, ?, ?, ?)`,
        [customer.id, content, req.user?.id, req.user?.name]
      );
      res.status(201).json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u4FDD\u5B58\u8DDF\u8FDB\u8BB0\u5F55\u5931\u8D25");
    }
  });
  router2.patch("/:id", requireAuth, async (req, res) => {
    const customerId = req.params.id;
    const name = readString(req.body?.name);
    const country = readString(req.body?.country);
    const contact = readString(req.body?.contact);
    const sourceChannel = readString(req.body?.sourceChannel);
    const intentProducts = readString(req.body?.intentProducts);
    if (!name || !country) {
      return fail(res, 400, "\u8BF7\u5B8C\u6574\u586B\u5199\u5BA2\u6237\u540D\u79F0\u548C\u56FD\u5BB6\u4FE1\u606F", "INVALID_CUSTOMER_PAYLOAD");
    }
    try {
      const oldVal = await dbGet(`SELECT * FROM customers WHERE deleted_at IS NULL AND (id = ? OR display_id = ?)`, [customerId, customerId]);
      if (!oldVal) return fail(res, 404, "\u5BA2\u6237\u4E0D\u5B58\u5728", "CUSTOMER_NOT_FOUND");
      await dbRun(
        `
          UPDATE customers
          SET name = ?, country = ?, contact = ?, source_channel = ?, intent_products = ?, updated_by = ?
          WHERE id = ?
        `,
        [name, country, contact, sourceChannel, intentProducts, req.user?.id || null, oldVal.id]
      );
      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: "UPDATE",
        entityType: "CUSTOMER",
        entityId: oldVal.id,
        oldValue: oldVal,
        newValue: { name, country, contact, sourceChannel, intentProducts }
      });
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u66F4\u65B0\u5BA2\u6237\u5931\u8D25");
    }
  });
  router2.delete("/:id", requireAdmin, async (req, res) => {
    const customerId = req.params.id;
    try {
      const customer = await dbGet(`SELECT id FROM customers WHERE deleted_at IS NULL AND (id = ? OR display_id = ?)`, [customerId, customerId]);
      if (!customer) return fail(res, 404, "\u5BA2\u6237\u4E0D\u5B58\u5728");
      const linkedOrders = await dbGet(`SELECT COUNT(*) AS count FROM orders WHERE customer_id = ? AND deleted_at IS NULL`, [customer.id]);
      if ((linkedOrders?.count || 0) > 0) {
        return fail(res, 409, "\u8BE5\u5BA2\u6237\u4E0B\u4ECD\u6709\u5173\u8054\u8BA2\u5355\uFF0C\u4E0D\u80FD\u5220\u9664", "CUSTOMER_HAS_ORDERS");
      }
      const oldVal = await dbGet(`SELECT * FROM customers WHERE id = ?`, [customer.id]);
      const result = await dbRun(`UPDATE customers SET deleted_at = ${SQL.now()} WHERE id = ?`, [customer.id]);
      if (!result.changes) {
        return fail(res, 404, "\u5BA2\u6237\u4E0D\u5B58\u5728", "CUSTOMER_NOT_FOUND");
      }
      if (oldVal) {
        await logAction({
          userId: req.user?.id ?? null,
          userName: req.user?.name ?? null,
          action: "DELETE",
          entityType: "CUSTOMER",
          entityId: customer.id,
          oldValue: oldVal
        });
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u5220\u9664\u5BA2\u6237\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/customs.ts
init_db();
import { Router as Router5 } from "express";
import multer2 from "multer";
import fs4 from "fs/promises";
import path6 from "path";
import { randomUUID as randomUUID2 } from "crypto";
init_http();

// server/domain.ts
var USER_ROLES = ["admin", "staff"];
var ORDER_STATUSES = ["draft", "production", "customs", "shipping", "completed"];
var FINANCE_TYPES = ["receipt", "payment"];
var FINANCE_STATUSES = ["pending", "completed"];
var PAYMENT_CATEGORIES = ["receipt", "freight", "goods", "other"];
var RECORD_CATEGORIES = ["deposit", "balance", "goods", "freight", "customs", "other"];
var LOGISTICS_STATUSES = ["preparing", "shipped", "arrived"];
var LOGISTICS_SEGMENTS = ["domestic", "international"];
var CUSTOMS_STATUSES = ["not_started", "preparing", "submitted", "inspected", "released"];
var PARTNER_TYPES = ["factory", "forwarder", "customs_broker", "other"];
var PRODUCTION_STATUSES = ["not_started", "scheduled", "in_progress", "ready"];
var INSPECTION_STATUSES = ["pending", "passed", "failed"];

// server/services/payloads.ts
init_db();

// server/services/entities.ts
init_db();
async function ensureOrderExists(orderId) {
  const order = await dbGet(`SELECT id FROM orders WHERE id = ? AND deleted_at IS NULL`, [orderId]);
  return Boolean(order);
}
async function ensurePartnerExists(partnerId) {
  const partner = await dbGet(
    `SELECT id, name, partner_type FROM partners WHERE id = ?`,
    [partnerId]
  );
  return partner || null;
}

// server/services/payloads.ts
init_values();
async function readPartnerPayload(body) {
  const name = readString(body.name, 200);
  const partnerType = readString(body.partnerType, 50);
  const country = readString(body.country, 100);
  const contact = readString(body.contact, 200);
  const contactPerson = readString(body.contactPerson, 100);
  const address = readString(body.address, 500);
  const rating = readNumber(body.rating);
  const paymentTerms = readString(body.paymentTerms, 300);
  const remark = readString(body.remark, 5e3);
  if (!name) {
    return { error: "\u8BF7\u586B\u5199\u4F19\u4F34\u540D\u79F0" };
  }
  if (!isOneOf(partnerType, PARTNER_TYPES)) {
    return { error: "\u4F19\u4F34\u7C7B\u578B\u4E0D\u6B63\u786E" };
  }
  return {
    payload: {
      name,
      partnerType,
      country,
      contact,
      contactPerson,
      address,
      rating,
      paymentTerms,
      remark
    }
  };
}
async function readProductionPayload(body, orderId) {
  const partnerIdInput = readNumber(body.partnerId);
  const orderDate = readOptionalDate(body.orderDate);
  const estimatedDeliveryDate = readOptionalDate(body.estimatedDeliveryDate);
  const productionStatus = readString(body.productionStatus, 50);
  const inspectionStatus = readString(body.inspectionStatus, 50);
  const remark = readString(body.remark, 5e3);
  const attachmentIds = readAttachmentIds(body.attachmentIds);
  if (!await ensureOrderExists(orderId)) {
    return { error: "\u5173\u8054\u8BA2\u5355\u4E0D\u5B58\u5728" };
  }
  if (!Number.isInteger(partnerIdInput) || partnerIdInput <= 0) {
    return { error: "\u8BF7\u9009\u62E9\u751F\u4EA7\u4F19\u4F34" };
  }
  const partner = await ensurePartnerExists(partnerIdInput);
  if (!partner) {
    return { error: "\u6240\u9009\u4F19\u4F34\u4E0D\u5B58\u5728" };
  }
  if (!["factory", "other"].includes(partner.partner_type)) {
    return { error: "\u751F\u4EA7\u5B89\u6392\u4EC5\u652F\u6301\u9009\u62E9\u5DE5\u5382\u6216\u5176\u4ED6\u4F9B\u5E94\u5546" };
  }
  if (orderDate === "__invalid__" || estimatedDeliveryDate === "__invalid__") {
    return { error: "\u751F\u4EA7\u65E5\u671F\u683C\u5F0F\u4E0D\u6B63\u786E" };
  }
  if (!isOneOf(productionStatus, PRODUCTION_STATUSES)) {
    return { error: "\u751F\u4EA7\u72B6\u6001\u4E0D\u6B63\u786E" };
  }
  if (!isOneOf(inspectionStatus, INSPECTION_STATUSES)) {
    return { error: "\u9A8C\u8D27\u72B6\u6001\u4E0D\u6B63\u786E" };
  }
  return {
    payload: {
      orderId,
      partnerId: partnerIdInput,
      partnerName: partner.name,
      orderDate: orderDate || "",
      estimatedDeliveryDate: estimatedDeliveryDate || "",
      productionStatus,
      inspectionStatus,
      remark,
      attachmentIds
    }
  };
}
async function readOrderPayload(body) {
  const customerId = readNumber(body.customerId);
  const displayId = readString(body.displayId, 50);
  const status = readString(body.status, 50);
  const productSummary = readString(body.productSummary, 2e3);
  const details = readString(body.details, 1e4);
  const totalAmount = readNumber(body.totalAmount);
  const deliveryDate = readOptionalDate(body.deliveryDate);
  const freightAmountInput = readNumber(body.freightAmount);
  const miscAmountInput = readNumber(body.miscAmount);
  const freightAmount = Number.isFinite(freightAmountInput) ? freightAmountInput : 0;
  const miscAmount = Number.isFinite(miscAmountInput) ? miscAmountInput : 0;
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return { error: "\u8BF7\u9009\u62E9\u6709\u6548\u5BA2\u6237" };
  }
  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    return { error: "\u8BA2\u5355\u91D1\u989D\u5FC5\u987B\u5927\u4E8E\u6216\u7B49\u4E8E 0" };
  }
  if (deliveryDate === "__invalid__") {
    return { error: "\u4EA4\u8D27\u671F\u683C\u5F0F\u4E0D\u6B63\u786E" };
  }
  if (!Number.isFinite(freightAmount) || freightAmount < 0) {
    return { error: "\u8FD0\u8D39\u5FC5\u987B\u5927\u4E8E\u6216\u7B49\u4E8E 0" };
  }
  if (!Number.isFinite(miscAmount) || miscAmount < 0) {
    return { error: "\u6742\u8D39\u5FC5\u987B\u5927\u4E8E\u6216\u7B49\u4E8E 0" };
  }
  const customer = await dbGet(`SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL`, [customerId]);
  if (!customer) {
    return { error: "\u5BA2\u6237\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5148\u521B\u5EFA\u5BA2\u6237\u6863\u6848" };
  }
  return {
    payload: {
      customerId,
      displayId,
      status: status || "draft",
      productSummary,
      details,
      totalAmount,
      deliveryDate,
      freightAmount,
      miscAmount
    }
  };
}
async function readFinancePayload(body) {
  const orderId = readNumber(body.orderId);
  const partnerIdInput = readNumber(body.partnerId);
  const type = readString(body.type, 50);
  const amount = readNumber(body.amount);
  const currency = readString(body.currency, 10).toUpperCase();
  const target = readString(body.target, 300);
  const status = readString(body.status, 50);
  const remark = readString(body.remark, 5e3);
  const paymentCategoryInput = readString(body.paymentCategory, 50);
  const recordCategoryInput = readString(body.recordCategory, 50);
  const attachmentIds = readAttachmentIds(body.attachmentIds);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { error: "\u8BF7\u9009\u62E9\u6709\u6548\u7684\u5173\u8054\u8BA2\u5355" };
  }
  const orderCustomer = await dbGet(
    `SELECT c.id, c.name, c.display_id
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.id = ? AND o.deleted_at IS NULL AND c.deleted_at IS NULL`,
    [orderId]
  );
  if (!orderCustomer) {
    return { error: "\u5173\u8054\u8BA2\u5355\u4E0D\u5B58\u5728" };
  }
  if (!isOneOf(type, FINANCE_TYPES)) {
    return { error: "\u8D26\u5355\u7C7B\u578B\u4E0D\u6B63\u786E" };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "\u91D1\u989D\u5FC5\u987B\u5927\u4E8E 0" };
  }
  if (!currency) {
    return { error: "\u8BF7\u586B\u5199\u5E01\u79CD" };
  }
  if (!isOneOf(status, FINANCE_STATUSES)) {
    return { error: "\u8D22\u52A1\u72B6\u6001\u4E0D\u6B63\u786E" };
  }
  const partnerId = type === "payment" && Number.isInteger(partnerIdInput) && partnerIdInput > 0 ? partnerIdInput : null;
  const partner = partnerId ? await ensurePartnerExists(partnerId) : null;
  if (partnerId && !partner) {
    return { error: "\u4ED8\u6B3E\u5BF9\u8C61\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5148\u7EF4\u62A4\u4F19\u4F34\u6863\u6848" };
  }
  const normalizedTarget = type === "receipt" ? orderCustomer.name || orderCustomer.display_id || "" : partner?.name || target;
  if (type === "payment" && !partnerId && !normalizedTarget) {
    return { error: "\u4ED8\u6B3E\u65F6\u8BF7\u9009\u62E9\u5408\u4F5C\u4F19\u4F34\u6216\u586B\u5199\u4ED8\u6B3E\u5BF9\u8C61" };
  }
  const recordCategory = recordCategoryInput && isOneOf(recordCategoryInput, RECORD_CATEGORIES) ? recordCategoryInput : type === "receipt" ? "deposit" : paymentCategoryInput === "freight" ? "freight" : paymentCategoryInput === "goods" ? "goods" : "other";
  const paymentCategory = type === "receipt" ? "receipt" : recordCategory === "freight" ? "freight" : recordCategory === "goods" ? "goods" : recordCategory === "other" || recordCategory === "customs" || recordCategory === "balance" || recordCategory === "deposit" ? "other" : "other";
  if (type === "payment" && !isOneOf(paymentCategory, PAYMENT_CATEGORIES)) {
    return { error: "\u4ED8\u6B3E\u5206\u7C7B\u4E0D\u6B63\u786E" };
  }
  if (!isOneOf(recordCategory, RECORD_CATEGORIES)) {
    return { error: "\u6B3E\u9879\u7C7B\u578B\u4E0D\u6B63\u786E" };
  }
  return {
    payload: {
      orderId,
      partnerId,
      type,
      amount,
      currency,
      target: normalizedTarget,
      status,
      remark,
      paymentCategory,
      recordCategory,
      attachmentIds
    }
  };
}
async function readLogisticsPayload(body) {
  const orderId = readNumber(body.orderId);
  const trackingNo = readString(body.trackingNo, 100);
  const carrier = readString(body.carrier, 200);
  const freightForwarder = readString(body.freightForwarder, 200);
  const freightForwarderPartnerId = readNumber(body.freightForwarderPartnerId);
  const packingDetails = readString(body.packingDetails, 3e3);
  const status = readString(body.status, 50);
  const shippingDate = readString(body.shippingDate, 30);
  const segmentTypeInput = readString(body.segmentType, 50);
  const packageCount = readNumber(body.packageCount);
  const volumeCbm = readNumber(body.volumeCbm);
  const grossWeightKg = readNumber(body.grossWeightKg);
  const incoterm = readString(body.incoterm, 30);
  const transportMode = readString(body.transportMode, 50);
  const vesselVoyage = readString(body.vesselVoyage, 100);
  const billNo = readString(body.billNo, 100);
  const etd = readOptionalDate(body.etd);
  const eta = readOptionalDate(body.eta);
  const remark = readString(body.remark, 5e3);
  const attachmentIds = readAttachmentIds(body.attachmentIds);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { error: "\u8BF7\u9009\u62E9\u6709\u6548\u7684\u5173\u8054\u8BA2\u5355" };
  }
  if (!await ensureOrderExists(orderId)) {
    return { error: "\u5173\u8054\u8BA2\u5355\u4E0D\u5B58\u5728" };
  }
  if (!carrier) {
    return { error: "\u8BF7\u586B\u5199\u7269\u6D41\u516C\u53F8\u6216\u627F\u8FD0\u65B9" };
  }
  let freightForwarderPartner;
  if (Number.isInteger(freightForwarderPartnerId) && freightForwarderPartnerId > 0) {
    freightForwarderPartner = await dbGet(
      `SELECT id, name, partner_type FROM partners WHERE id = ? AND deleted_at IS NULL`,
      [freightForwarderPartnerId]
    );
    if (!freightForwarderPartner) {
      return { error: "\u9009\u62E9\u7684\u8D27\u8FD0\u4EE3\u7406\u4E0D\u5B58\u5728" };
    }
    if (freightForwarderPartner.partner_type !== "forwarder") {
      return { error: "\u8D27\u8FD0\u4EE3\u7406\u5FC5\u987B\u9009\u62E9\u8D27\u4EE3\u7C7B\u578B\u7684\u5408\u4F5C\u4F19\u4F34" };
    }
  }
  if (!isOneOf(status, LOGISTICS_STATUSES)) {
    return { error: "\u7269\u6D41\u72B6\u6001\u4E0D\u6B63\u786E" };
  }
  const segmentType = isOneOf(segmentTypeInput, LOGISTICS_SEGMENTS) ? segmentTypeInput : "international";
  if (shippingDate && !/^\d{4}-\d{2}-\d{2}$/.test(shippingDate)) {
    return { error: "\u53D1\u8D27\u65E5\u671F\u683C\u5F0F\u4E0D\u6B63\u786E" };
  }
  if (status !== "preparing" && !shippingDate) {
    return { error: "\u8FD0\u8F93\u4E2D\u6216\u5DF2\u5230\u8D27\u65F6\u5FC5\u987B\u586B\u5199\u53D1\u8D27\u65E5\u671F" };
  }
  if (etd === "__invalid__" || eta === "__invalid__") {
    return { error: "ETD / ETA \u65E5\u671F\u683C\u5F0F\u4E0D\u6B63\u786E" };
  }
  return {
    payload: {
      orderId,
      trackingNo,
      carrier,
      freightForwarder: freightForwarderPartner?.name || freightForwarder,
      freightForwarderPartnerId: freightForwarderPartner?.id || null,
      packingDetails,
      status,
      shippingDate,
      segmentType,
      packageCount: Number.isFinite(packageCount) ? packageCount : null,
      volumeCbm: Number.isFinite(volumeCbm) ? volumeCbm : null,
      grossWeightKg: Number.isFinite(grossWeightKg) ? grossWeightKg : null,
      incoterm,
      transportMode,
      vesselVoyage,
      billNo,
      etd: etd || "",
      eta: eta || "",
      recipientAddress: readString(body.recipientAddress, 500),
      packageSize: readString(body.packageSize, 300),
      remark,
      attachmentIds
    }
  };
}
async function readCustomsPayload(body) {
  const orderId = readNumber(body.orderId);
  const status = readString(body.status, 50);
  const brokerName = readString(body.brokerName, 200);
  const declarationNo = readString(body.declarationNo, 100);
  const declarationDate = readOptionalDate(body.declarationDate);
  const releaseDate = readOptionalDate(body.releaseDate);
  const tradeMode = readString(body.tradeMode, 50);
  const remark = readString(body.remark, 5e3);
  const attachmentIds = readAttachmentIds(body.attachmentIds);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { error: "\u8BF7\u9009\u62E9\u6709\u6548\u7684\u5173\u8054\u8BA2\u5355" };
  }
  if (!await ensureOrderExists(orderId)) {
    return { error: "\u5173\u8054\u8BA2\u5355\u4E0D\u5B58\u5728" };
  }
  if (!isOneOf(status, CUSTOMS_STATUSES)) {
    return { error: "\u62A5\u5173\u72B6\u6001\u4E0D\u6B63\u786E" };
  }
  if (declarationDate === "__invalid__" || releaseDate === "__invalid__") {
    return { error: "\u62A5\u5173\u65E5\u671F\u683C\u5F0F\u4E0D\u6B63\u786E" };
  }
  return {
    payload: {
      orderId,
      status,
      brokerName,
      declarationNo,
      declarationDate: declarationDate || "",
      releaseDate: releaseDate || "",
      tradeMode,
      remark,
      attachmentIds
    }
  };
}
async function readProductionLogPayload(body) {
  const content = readString(body.content, 5e3);
  const logDate = readOptionalDate(body.logDate);
  const attachmentIds = readAttachmentIds(body.attachmentIds);
  if (!content) {
    return { error: "\u8BF7\u586B\u5199\u8FDB\u5EA6\u63CF\u8FF0" };
  }
  if (logDate === "__invalid__") {
    return { error: "\u65E5\u671F\u683C\u5F0F\u4E0D\u6B63\u786E" };
  }
  return {
    payload: {
      content,
      logDate: logDate || "",
      attachmentIds
    }
  };
}

// server/routes/customs.ts
var BLOCKED_MIME_TYPES2 = /* @__PURE__ */ new Set([
  "text/html",
  "application/xhtml+xml",
  "application/javascript",
  "text/javascript",
  "image/svg+xml",
  "application/x-httpd-php",
  "application/x-msdownload",
  "application/x-executable"
]);
var upload2 = multer2({
  storage: multer2.diskStorage({
    destination: async (_req, _file, callback) => {
      try {
        await fs4.mkdir(UPLOADS_DIR, { recursive: true });
        callback(null, UPLOADS_DIR);
      } catch (error) {
        callback(error, UPLOADS_DIR);
      }
    },
    filename: (_req, file, callback) => {
      const extension = path6.extname(file.originalname || "");
      callback(null, `${Date.now()}-${randomUUID2()}${extension}`);
    }
  }),
  fileFilter: (_req, file, callback) => {
    if (BLOCKED_MIME_TYPES2.has(file.mimetype)) {
      callback(new Error(`\u4E0D\u5141\u8BB8\u4E0A\u4F20\u6B64\u7C7B\u578B\u7684\u6587\u4EF6: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 6 }
});
function mapCustomsRecord(record, attachments = []) {
  return {
    id: record.id,
    orderId: record.order_id,
    status: record.status,
    brokerName: record.broker_name,
    declarationNo: record.declaration_no,
    declarationDate: record.declaration_date,
    releaseDate: record.release_date,
    tradeMode: record.trade_mode,
    remark: record.remark,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    createdByName: record.created_by_name || null,
    attachments,
    attachmentCount: attachments.length
  };
}
function createCustomsRouter() {
  const router2 = Router5();
  router2.get("/orders/:id/customs", async (req, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return fail(res, 400, "\u8BA2\u5355\u7F16\u53F7\u65E0\u6548", "INVALID_ORDER_ID");
    }
    try {
      const record = await dbGet(
        `
          SELECT
            c.*,
            u.name AS created_by_name
          FROM customs_records c
          JOIN orders o ON o.id = c.order_id
          LEFT JOIN users u ON u.id = c.created_by
          WHERE c.order_id = ? AND o.deleted_at IS NULL
          LIMIT 1
        `,
        [orderId]
      );
      if (!record) {
        return res.json(null);
      }
      const attachments = await getAttachmentsByEntity("customs", [Number(record.id)]);
      const attList = attachments.get(Number(record.id)) || [];
      res.json(mapCustomsRecord(record, attList));
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u62A5\u5173\u4FE1\u606F\u5931\u8D25");
    }
  });
  router2.post("/orders/:id/customs", async (req, res) => {
    const orderId = Number(req.params.id);
    const result = await readCustomsPayload({ ...req.body || {}, orderId });
    if ("error" in result) {
      return fail(res, 400, result.error, "INVALID_CUSTOMS_PAYLOAD");
    }
    try {
      const existing = await dbGet(`SELECT id FROM customs_records WHERE order_id = ?`, [orderId]);
      if (existing) {
        return fail(res, 409, "\u8BE5\u8BA2\u5355\u5DF2\u6709\u62A5\u5173\u4FE1\u606F\uFF0C\u8BF7\u76F4\u63A5\u7F16\u8F91", "CUSTOMS_ALREADY_EXISTS");
      }
      const created = await dbRun(
        `
          INSERT INTO customs_records (order_id, status, broker_name, declaration_no, declaration_date, release_date, trade_mode, remark, created_by, updated_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          RETURNING id
        `,
        [
          result.payload.orderId,
          result.payload.status,
          result.payload.brokerName,
          result.payload.declarationNo,
          result.payload.declarationDate || null,
          result.payload.releaseDate || null,
          result.payload.tradeMode,
          result.payload.remark,
          req.user?.id || null,
          req.user?.id || null
        ]
      );
      await bindAttachmentsToEntity("customs", created.lastID, result.payload.attachmentIds);
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, "\u4FDD\u5B58\u62A5\u5173\u4FE1\u606F\u5931\u8D25");
    }
  });
  router2.patch("/customs/:id", async (req, res) => {
    const customsId = Number(req.params.id);
    if (!Number.isInteger(customsId) || customsId <= 0) {
      return fail(res, 400, "\u62A5\u5173\u8BB0\u5F55\u7F16\u53F7\u65E0\u6548", "INVALID_CUSTOMS_ID");
    }
    const existing = await dbGet(`SELECT order_id FROM customs_records WHERE id = ?`, [customsId]);
    if (!existing) {
      return fail(res, 404, "\u62A5\u5173\u8BB0\u5F55\u4E0D\u5B58\u5728", "CUSTOMS_NOT_FOUND");
    }
    const result = await readCustomsPayload({ ...req.body || {}, orderId: existing.order_id });
    if ("error" in result) {
      return fail(res, 400, result.error, "INVALID_CUSTOMS_PAYLOAD");
    }
    try {
      await dbRun(
        `
          UPDATE customs_records
          SET status = ?, broker_name = ?, declaration_no = ?, declaration_date = ?, release_date = ?, trade_mode = ?, remark = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          result.payload.status,
          result.payload.brokerName,
          result.payload.declarationNo,
          result.payload.declarationDate || null,
          result.payload.releaseDate || null,
          result.payload.tradeMode,
          result.payload.remark,
          req.user?.id || null,
          customsId
        ]
      );
      await bindAttachmentsToEntity("customs", customsId, result.payload.attachmentIds);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u66F4\u65B0\u62A5\u5173\u4FE1\u606F\u5931\u8D25");
    }
  });
  router2.post("/customs/:id/attachments", upload2.array("files", 6), async (req, res) => {
    const customsId = Number(req.params.id);
    if (!Number.isInteger(customsId) || customsId <= 0) {
      return fail(res, 400, "\u62A5\u5173\u8BB0\u5F55\u7F16\u53F7\u65E0\u6548", "INVALID_CUSTOMS_ID");
    }
    const existing = await dbGet(`SELECT id FROM customs_records WHERE id = ?`, [customsId]);
    if (!existing) {
      return fail(res, 404, "\u62A5\u5173\u8BB0\u5F55\u4E0D\u5B58\u5728", "CUSTOMS_NOT_FOUND");
    }
    const files = req.files || [];
    if (!files.length) {
      return fail(res, 400, "\u8BF7\u81F3\u5C11\u4E0A\u4F20\u4E00\u4E2A\u9644\u4EF6", "INVALID_ATTACHMENTS");
    }
    try {
      const uploaded = [];
      for (const file of files) {
        const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
        const result = await dbRun(
          `
            INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING id
          `,
          ["customs", customsId, originalName, file.filename, file.mimetype, file.size, file.filename]
        );
        uploaded.push({
          id: result.lastID,
          fileName: originalName,
          filePath: file.filename,
          storedName: file.filename,
          url: buildAttachmentUrl(result.lastID, file.filename),
          mimeType: file.mimetype,
          fileSize: file.size
        });
      }
      res.status(201).json(uploaded);
    } catch (error) {
      return handleRouteError(res, error, "\u4E0A\u4F20\u62A5\u5173\u9644\u4EF6\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/dashboard.ts
init_db();
init_http();
import { Router as Router6 } from "express";
function createDashboardRouter() {
  const router2 = Router6();
  router2.get("/", async (_req, res) => {
    try {
      const overview = await dbGet(`
        SELECT
          COUNT(*) AS totalOrders,
          SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) AS activeOrders
        FROM orders
        WHERE deleted_at IS NULL
      `);
      const financeStats = await dbGet(`
        SELECT
          SUM(CASE WHEN f.status = 'completed' AND f.type = 'receipt' AND f.currency = 'USD' THEN f.amount ELSE 0 END) as receiptUsd,
          SUM(CASE WHEN f.status = 'pending' AND f.type = 'receipt' AND f.currency = 'USD' THEN f.amount ELSE 0 END) as pendingReceiptUsd,
          SUM(CASE WHEN f.status = 'pending' AND f.type = 'receipt' THEN 1 ELSE 0 END) as pendingCount
        FROM finance_records f
        LEFT JOIN orders o ON o.id = f.order_id
        WHERE f.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL)
      `);
      const activeLogistics = await dbGet(
        `
          SELECT COUNT(*) AS count
          FROM logistics_records l
          JOIN orders o ON o.id = l.order_id
          WHERE l.status != 'arrived' AND l.deleted_at IS NULL AND o.deleted_at IS NULL
        `
      );
      const overduePayments = await dbAll(`
        SELECT
          f.id, o.display_id as order_display_id, c.name as customer_name, f.amount, f.currency, f.created_at,
          ${SQL.daysBetween("f.created_at")} as days_pending
        FROM finance_records f
        JOIN orders o ON f.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE f.type = 'receipt' AND f.status = 'pending' AND f.deleted_at IS NULL AND o.deleted_at IS NULL
        ORDER BY f.created_at ASC
        LIMIT 3
      `);
      const missingCustoms = await dbAll(`
        SELECT
          o.id, o.display_id as order_display_id, c.name as customer_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN customs_records cr ON cr.order_id = o.id
        WHERE o.status IN ('customs', 'shipping') AND cr.id IS NULL AND o.deleted_at IS NULL
        LIMIT 2
      `);
      const missingLogistics = await dbAll(`
        SELECT
          o.id, o.display_id as order_display_id, c.name as customer_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN logistics_records lr ON lr.order_id = o.id
        WHERE o.status IN ('shipping') AND lr.id IS NULL AND o.deleted_at IS NULL
        LIMIT 2
      `);
      const todos = [
        ...overduePayments.map((p) => ({
          id: `payment-${p.id}`,
          type: "payment_overdue",
          order_display_id: p.order_display_id,
          customer_name: p.customer_name,
          desc: `\u672A\u6536\u6B3E ${p.currency} ${p.amount}`,
          days: Math.max(0, p.days_pending),
          actionLabel: "\u53BB\u50AC\u6B3E",
          urgency: "high"
        })),
        ...missingCustoms.map((c) => ({
          id: `customs-${c.id}`,
          type: "customs_missing",
          order_display_id: c.order_display_id,
          customer_name: c.customer_name,
          desc: "\u7F3A\u5C11\u5546\u4E1A\u53D1\u7968\u3001\u88C5\u7BB1\u5355",
          days: 0,
          actionLabel: "\u53BB\u4E0A\u4F20",
          urgency: "medium"
        })),
        ...missingLogistics.map((l) => ({
          id: `logistics-${l.id}`,
          type: "logistics_pending",
          order_display_id: l.order_display_id,
          customer_name: l.customer_name,
          desc: "\u5DF2\u53D1\u8FD0\uFF0C\u5F85\u521B\u5EFA\u7269\u6D41\u5355",
          days: 0,
          actionLabel: "\u521B\u5EFA\u7269\u6D41",
          urgency: "medium"
        }))
      ].slice(0, 5);
      const activitiesRows = await dbAll(`
        SELECT 'finance' as type, f.id, o.display_id, c.name as customer_name,
          CASE WHEN f.type = 'receipt' THEN '\u6536\u6B3E\u5B8C\u6210' ELSE '\u4ED8\u6B3E\u5B8C\u6210' END as title,
          '' as desc, f.created_at as created_at,
          CASE WHEN f.type = 'receipt' THEN '+' ELSE '-' END || f.currency || ' ' || f.amount as value,
          CASE WHEN f.type = 'receipt' THEN 'text-emerald-500' ELSE 'text-red-500' END as valueColor
        FROM finance_records f JOIN orders o ON f.order_id = o.id LEFT JOIN customers c ON o.customer_id = c.id
        WHERE f.status = 'completed' AND f.deleted_at IS NULL AND o.deleted_at IS NULL
        UNION ALL
        SELECT 'logistics' as type, l.id, o.display_id, c.name as customer_name,
          '\u7269\u6D41\u66F4\u65B0' as title, '\u8D27\u7269\u5DF2\u53D1\u51FA \xB7 ' || l.carrier as desc, l.created_at,
          CASE WHEN l.status = 'arrived' THEN '\u5DF2\u9001\u8FBE' WHEN l.status = 'shipped' THEN '\u8FD0\u8F93\u4E2D' ELSE '\u5907\u8D27\u4E2D' END as value,
          'text-slate-500' as valueColor
        FROM logistics_records l JOIN orders o ON l.order_id = o.id LEFT JOIN customers c ON o.customer_id = c.id
        WHERE l.deleted_at IS NULL AND o.deleted_at IS NULL
        UNION ALL
        SELECT 'customs' as type, cr.id, o.display_id, c.name as customer_name,
          '\u62A5\u5173\u5B8C\u6210' as title, '\u62A5\u5173\u5355\u53F7 ' || cr.declaration_no as desc, cr.created_at,
          '' as value, '' as valueColor
        FROM customs_records cr JOIN orders o ON cr.order_id = o.id LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.deleted_at IS NULL
        UNION ALL
        SELECT 'order' as type, o.id, o.display_id, c.name as customer_name,
          '\u65B0\u5EFA\u8BA2\u5355' as title, o.product_summary as desc, o.created_at,
          'USD ' || o.total_amount as value,
          'text-primary-navy dark:text-white' as valueColor
        FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.deleted_at IS NULL
        ORDER BY 7 DESC
        LIMIT 8
      `);
      const activities = activitiesRows.map((a) => ({
        ...a,
        order_display_id: a.display_id
      }));
      const statusRows = await dbAll(`
        SELECT status, COUNT(*) as count FROM orders WHERE deleted_at IS NULL GROUP BY status
      `);
      const totalOrders = overview?.totalOrders || 0;
      const COLORS = {
        "draft": "#94A3B8",
        // slate-400
        "production": "#0F172A",
        // primary-navy
        "customs": "#EAB308",
        // yellow-500
        "shipping": "#3B82F6",
        // blue-500
        "completed": "#10B981"
        // emerald-500
      };
      const LABELS = {
        "draft": "\u5F85\u786E\u8BA4",
        "production": "\u751F\u4EA7\u4E2D",
        "customs": "\u62A5\u5173\u4E2D",
        "shipping": "\u8FD0\u8F93\u4E2D",
        "completed": "\u5DF2\u5B8C\u6210"
      };
      const statusDistribution = statusRows.map((r) => ({
        status: r.status,
        label: LABELS[r.status] || r.status,
        count: r.count,
        percentage: totalOrders > 0 ? Math.round(r.count / totalOrders * 1e3) / 10 : 0,
        color: COLORS[r.status] || "#CBD5E1"
      })).sort((a, b) => b.count - a.count);
      const monthlyTrends = await dbAll(`
        SELECT
          ${SQL.date("created_at", "%Y-%m")} AS month,
          COUNT(*) AS orders,
          COALESCE(SUM(total_amount), 0) AS revenue
        FROM orders
        WHERE created_at >= ${SQL.monthsAgo(6)} AND deleted_at IS NULL
        GROUP BY month ORDER BY month ASC
      `);
      const profitTrends = await dbAll(`
        SELECT
          ${SQL.date("f.created_at", "%Y-%m")} AS month,
          SUM(CASE WHEN f.type = 'receipt' AND f.status = 'completed' THEN 
            CASE WHEN f.currency = 'CNY' THEN f.amount / 7.2 ELSE f.amount END
          ELSE 0 END) AS revenue,
          SUM(CASE WHEN f.type = 'payment' AND f.status = 'completed' THEN 
            CASE WHEN f.currency = 'CNY' THEN f.amount / 7.2 ELSE f.amount END
          ELSE 0 END) AS cost
        FROM finance_records f
        LEFT JOIN orders o ON o.id = f.order_id
        WHERE f.created_at >= ${SQL.monthsAgo(6)} AND f.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL)
        GROUP BY month ORDER BY month ASC
      `);
      const trendsWithProfit = profitTrends.map((t) => ({
        ...t,
        profit: t.revenue - t.cost
      }));
      const currentMonth = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
      const lastMonthDate = /* @__PURE__ */ new Date();
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      const lastMonth = lastMonthDate.toISOString().slice(0, 7);
      const getMonthStats = (month) => trendsWithProfit.find((t) => t.month === month) || { revenue: 0, profit: 0 };
      const currStats = getMonthStats(currentMonth);
      const prevStats = getMonthStats(lastMonth);
      const calcGrowth = (curr, prev) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Math.round((curr - prev) / prev * 1e3) / 10;
      };
      const growth = {
        revenue: calcGrowth(currStats.revenue, prevStats.revenue),
        profit: calcGrowth(currStats.profit, prevStats.profit)
      };
      const customerCount = await dbGet(`SELECT COUNT(*) AS count FROM customers WHERE deleted_at IS NULL`);
      const profitRows = await dbAll(`
        SELECT o.id as order_id, o.display_id, c.name as customer_name, op.data
        FROM order_profits op
        JOIN orders o ON o.id = op.order_id
        JOIN customers c ON c.id = o.customer_id
        WHERE o.deleted_at IS NULL
        ORDER BY op.updated_at DESC
        LIMIT 20
      `);
      const risks = [];
      for (const row of profitRows) {
        const d = row.data;
        if (!d || !d.receipts) continue;
        const receiptsTotalCny = (d.receipts || []).reduce((sum, r) => sum + (r.net || 0) * (r.exchangeRate || 7.2), 0);
        const freightCny = d.freightCurrency === "USD" ? (d.freightValue || 0) * (d.receipts?.[0]?.exchangeRate || 7.2) : d.freightValue || 0;
        const totalCost = (d.factoryCostCny || 0) + (d.domesticFees || 0) + freightCny + (d.customsMisc || 0) + (d.miscFees || []).reduce((s, f) => s + (f.amount || 0), 0);
        const profit = receiptsTotalCny + (d.otherIncomeCny || 0) - totalCost;
        const margin = d.invoiceAmount > 0 ? profit / d.invoiceAmount * 100 : 0;
        if (margin < 8 && margin > 0) {
          risks.push({ orderId: row.order_id, displayId: row.display_id, customerName: row.customer_name, riskType: "low_margin", value: Math.round(margin * 10) / 10, threshold: 8 });
        }
        if (freightCny > (d.factoryCostCny || 0) && (d.factoryCostCny || 0) > 0) {
          risks.push({ orderId: row.order_id, displayId: row.display_id, customerName: row.customer_name, riskType: "freight_inversion", value: Math.round(freightCny), threshold: Math.round(d.factoryCostCny) });
        }
      }
      res.json({
        overview: {
          totalOrders,
          activeOrders: overview?.activeOrders || 0,
          receiptUsd: financeStats?.receiptUsd || 0,
          pendingReceiptUsd: financeStats?.pendingReceiptUsd || 0,
          pendingFinanceCount: financeStats?.pendingCount || 0,
          activeLogistics: activeLogistics?.count || 0,
          customerCount: customerCount?.count || 0,
          estProfit: currStats.profit,
          growth,
          risks
        },
        todos,
        activities,
        statusDistribution,
        monthlyTrends,
        profitTrends: trendsWithProfit
      });
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u63A7\u5236\u53F0\u6570\u636E\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/finance.ts
init_db();
init_auth();
init_http();
import { Router as Router7 } from "express";
init_values();
function createFinanceRouter() {
  const router2 = Router7();
  router2.get("/", async (req, res) => {
    const q = readString(req.query.q);
    const startDate = readString(req.query.start_date);
    const endDate = readString(req.query.end_date);
    let whereSql = "WHERE f.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL)";
    const params = [];
    if (q) {
      whereSql += ` AND (o.display_id LIKE ? OR c.name LIKE ? OR p.name LIKE ? OR f.target LIKE ? OR f.remark LIKE ?)`;
      const p = `%${q}%`;
      params.push(p, p, p, p, p);
    }
    if (startDate) {
      whereSql += ` AND f.created_at >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      whereSql += ` AND f.created_at <= ?`;
      params.push(endDate);
    }
    try {
      const records = await dbAll(`
        SELECT
          f.*,
          p.name AS partner_name,
          o.display_id AS order_display_id,
          c.name AS customer_name,
          u.name AS created_by_name
        FROM finance_records f
        LEFT JOIN partners p ON p.id = f.partner_id
        LEFT JOIN orders o ON f.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN users u ON u.id = f.created_by
        ${whereSql}
        ORDER BY datetime(f.created_at) DESC, f.id DESC
        ${buildLimitOffset(readPagination(req.query), params)}
      `, params);
      const attachments = await getAttachmentsByEntity("finance", records.map((record) => Number(record.id)));
      res.json(
        records.map((record) => ({
          ...record,
          recordCategory: record.record_category || record.payment_category || (record.type === "receipt" ? "deposit" : "other"),
          partnerId: record.partner_id || null,
          partner_name: record.partner_name || null,
          createdByName: record.created_by_name || null,
          attachments: attachments.get(Number(record.id)) || [],
          attachmentCount: (attachments.get(Number(record.id)) || []).length
        }))
      );
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u8D22\u52A1\u6570\u636E\u5931\u8D25");
    }
  });
  router2.post("/", requireAdmin, async (req, res) => {
    const result = await readFinancePayload(req.body || {});
    if ("error" in result) {
      return fail(res, 400, result.error, "INVALID_FINANCE_PAYLOAD");
    }
    try {
      const created = await dbRun(
        `
          INSERT INTO finance_records (order_id, type, amount, target, status, remark, currency, payment_category, record_category, partner_id, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
        [
          result.payload.orderId,
          result.payload.type,
          result.payload.amount,
          result.payload.target,
          result.payload.status,
          result.payload.remark,
          result.payload.currency,
          result.payload.paymentCategory,
          result.payload.recordCategory,
          result.payload.partnerId,
          req.user?.id || null,
          req.user?.id || null
        ]
      );
      await bindAttachmentsToEntity("finance", created.lastID, result.payload.attachmentIds);
      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: "CREATE",
        entityType: "FINANCE",
        entityId: created.lastID,
        newValue: result.payload
      });
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, "\u4FDD\u5B58\u8D22\u52A1\u6570\u636E\u5931\u8D25");
    }
  });
  router2.patch("/:id", requireAdmin, async (req, res) => {
    const recordId = Number(req.params.id);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return fail(res, 400, "\u8D22\u52A1\u8BB0\u5F55\u7F16\u53F7\u65E0\u6548", "INVALID_FINANCE_ID");
    }
    const result = await readFinancePayload(req.body || {});
    if ("error" in result) {
      return fail(res, 400, result.error, "INVALID_FINANCE_PAYLOAD");
    }
    try {
      const updated = await dbRun(
        `
          UPDATE finance_records
          SET order_id = ?, type = ?, amount = ?, target = ?, status = ?, remark = ?, currency = ?, payment_category = ?, record_category = ?, partner_id = ?, updated_by = ?
          WHERE id = ?
        `,
        [
          result.payload.orderId,
          result.payload.type,
          result.payload.amount,
          result.payload.target,
          result.payload.status,
          result.payload.remark,
          result.payload.currency,
          result.payload.paymentCategory,
          result.payload.recordCategory,
          result.payload.partnerId,
          req.user?.id || null,
          recordId
        ]
      );
      if (!updated.changes) {
        return fail(res, 404, "\u8D22\u52A1\u8BB0\u5F55\u4E0D\u5B58\u5728", "FINANCE_NOT_FOUND");
      }
      await bindAttachmentsToEntity("finance", recordId, result.payload.attachmentIds);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u66F4\u65B0\u8D22\u52A1\u8BB0\u5F55\u5931\u8D25");
    }
  });
  router2.delete("/:id", requireAdmin, async (req, res) => {
    const recordId = Number(req.params.id);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return fail(res, 400, "\u8D22\u52A1\u8BB0\u5F55\u7F16\u53F7\u65E0\u6548", "INVALID_FINANCE_ID");
    }
    try {
      const record = await dbGet(`SELECT id, type, amount, currency FROM finance_records WHERE id = ?`, [recordId]);
      if (!record) return fail(res, 404, "\u8D22\u52A1\u8BB0\u5F55\u4E0D\u5B58\u5728", "FINANCE_NOT_FOUND");
      await deleteAttachmentRows("finance", recordId);
      const result = await dbRun(`DELETE FROM finance_records WHERE id = ?`, [recordId]);
      if (!result.changes) {
        return fail(res, 404, "\u8D22\u52A1\u8BB0\u5F55\u4E0D\u5B58\u5728", "FINANCE_NOT_FOUND");
      }
      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: "DELETE",
        entityType: "FINANCE",
        entityId: recordId,
        oldValue: { type: record.type, amount: record.amount, currency: record.currency }
      });
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u5220\u9664\u8D22\u52A1\u8BB0\u5F55\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/files.ts
init_db();
import fs5 from "fs/promises";
import { Router as Router8 } from "express";
init_http();
function createFilesRouter() {
  const router2 = Router8();
  router2.get("/:id/:storedName", async (req, res) => {
    const attachmentId = Number(req.params.id);
    const storedName = String(req.params.storedName || "").trim();
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return fail(res, 400, "\u9644\u4EF6\u7F16\u53F7\u65E0\u6548", "INVALID_ATTACHMENT_ID");
    }
    if (!isSafeStoredName(storedName)) {
      return fail(res, 400, "\u6587\u4EF6\u540D\u53C2\u6570\u975E\u6CD5", "INVALID_FILE_NAME");
    }
    try {
      const attachment = await dbGet(`SELECT file_name, stored_name, mime_type, file_path FROM attachments WHERE id = ?`, [attachmentId]);
      if (!attachment) {
        return fail(res, 404, "\u9644\u4EF6\u4E0D\u5B58\u5728", "ATTACHMENT_NOT_FOUND");
      }
      const actualStoredName = getStoredNameFromRecord(attachment.stored_name, attachment.file_path);
      if (actualStoredName !== storedName) {
        return fail(res, 404, "\u9644\u4EF6\u4E0D\u5B58\u5728", "ATTACHMENT_NOT_FOUND");
      }
      const absolutePath = resolveAttachmentAbsolutePath(attachment.file_path);
      if (!absolutePath) {
        return fail(res, 404, "\u9644\u4EF6\u4E0D\u5B58\u5728", "ATTACHMENT_NOT_FOUND");
      }
      await fs5.access(absolutePath);
      const originalFileName = attachment.file_name || actualStoredName;
      const fallbackName = sanitizeDownloadFilename(originalFileName);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(originalFileName)}`
      );
      res.type(attachment.mime_type || "application/octet-stream");
      res.sendFile(absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        return fail(res, 404, "\u9644\u4EF6\u4E0D\u5B58\u5728", "ATTACHMENT_NOT_FOUND");
      }
      return handleRouteError(res, error, "\u8BFB\u53D6\u9644\u4EF6\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/logistics.ts
init_db();
init_auth();
import { Router as Router9 } from "express";
import multer3 from "multer";
import fs6 from "fs/promises";
import path7 from "path";
import { randomUUID as randomUUID3 } from "crypto";
init_http();
init_values();
var BLOCKED_MIME_TYPES3 = /* @__PURE__ */ new Set([
  "text/html",
  "application/xhtml+xml",
  "application/javascript",
  "text/javascript",
  "image/svg+xml",
  "application/x-httpd-php",
  "application/x-msdownload",
  "application/x-executable"
]);
var upload3 = multer3({
  storage: multer3.diskStorage({
    destination: async (_req, _file, callback) => {
      try {
        await fs6.mkdir(UPLOADS_DIR, { recursive: true });
        callback(null, UPLOADS_DIR);
      } catch (error) {
        callback(error, UPLOADS_DIR);
      }
    },
    filename: (_req, file, callback) => {
      const extension = path7.extname(file.originalname || "");
      callback(null, `${Date.now()}-${randomUUID3()}${extension}`);
    }
  }),
  fileFilter: (_req, file, callback) => {
    if (BLOCKED_MIME_TYPES3.has(file.mimetype)) {
      callback(new Error(`\u4E0D\u5141\u8BB8\u4E0A\u4F20\u6B64\u7C7B\u578B\u7684\u6587\u4EF6: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 6
  }
});
function createLogisticsRouter() {
  const router2 = Router9();
  router2.get("/", async (req, res) => {
    const q = readString(req.query.q);
    const status = readString(req.query.status);
    const startDate = readString(req.query.start_date);
    const endDate = readString(req.query.end_date);
    let whereSql = "WHERE l.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL)";
    const params = [];
    if (q) {
      whereSql += ` AND (o.display_id LIKE ? OR l.carrier LIKE ? OR l.tracking_no LIKE ? OR c.name LIKE ?)`;
      const p = `%${q}%`;
      params.push(p, p, p, p);
    }
    if (status) {
      whereSql += ` AND l.status = ?`;
      params.push(status);
    }
    const filterDateExpr = `COALESCE(NULLIF(l.shipping_date, ''), date(l.created_at)::text)`;
    if (startDate) {
      whereSql += ` AND ${filterDateExpr} >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      whereSql += ` AND ${filterDateExpr} <= ?`;
      params.push(endDate);
    }
    try {
      const records = await dbAll(`
        SELECT
          l.*,
          o.display_id AS order_display_id,
          o.status AS order_status,
          c.name AS customer_name,
          u.name AS created_by_name
        FROM logistics_records l
        LEFT JOIN orders o ON l.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN users u ON u.id = l.created_by
        ${whereSql}
        ORDER BY
          COALESCE(NULLIF(l.shipping_date, ''), date(l.created_at)::text) DESC,
          datetime(l.created_at) DESC,
          CASE WHEN l.segment_type = 'domestic' THEN 0 ELSE 1 END ASC
        ${buildLimitOffset(readPagination(req.query), params)}
      `, params);
      const attachments = await getAttachmentsByEntity("logistics", records.map((record) => Number(record.id)));
      res.json(
        records.map((record) => ({
          ...record,
          segmentType: record.segment_type || "international",
          packageCount: record.package_count,
          volumeCbm: record.volume_cbm,
          grossWeightKg: record.gross_weight_kg,
          transportMode: record.transport_mode,
          vesselVoyage: record.vessel_voyage,
          billNo: record.bill_no,
          createdByName: record.created_by_name || null,
          attachments: attachments.get(Number(record.id)) || [],
          attachmentCount: (attachments.get(Number(record.id)) || []).length
        }))
      );
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u7269\u6D41\u6570\u636E\u5931\u8D25");
    }
  });
  router2.post("/", async (req, res) => {
    const result = await readLogisticsPayload(req.body || {});
    if ("error" in result) {
      return fail(res, 400, result.error, "INVALID_LOGISTICS_PAYLOAD");
    }
    try {
      const created = await dbRun(
        `
          INSERT INTO logistics_records (
            order_id, tracking_no, carrier, freight_forwarder, freight_forwarder_partner_id, packing_details, status, shipping_date, segment_type,
            package_count, volume_cbm, gross_weight_kg, incoterm, transport_mode, vessel_voyage, bill_no, etd, eta,
            recipient_address, package_size, remark, created_by, updated_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
        [
          result.payload.orderId,
          result.payload.trackingNo,
          result.payload.carrier,
          result.payload.freightForwarder,
          result.payload.freightForwarderPartnerId,
          result.payload.packingDetails,
          result.payload.status,
          result.payload.shippingDate || null,
          result.payload.segmentType,
          result.payload.packageCount,
          result.payload.volumeCbm,
          result.payload.grossWeightKg,
          result.payload.incoterm,
          result.payload.transportMode,
          result.payload.vesselVoyage,
          result.payload.billNo,
          result.payload.etd || null,
          result.payload.eta || null,
          result.payload.recipientAddress,
          result.payload.packageSize,
          result.payload.remark,
          req.user?.id || null,
          req.user?.id || null
        ]
      );
      await bindAttachmentsToEntity("logistics", created.lastID, result.payload.attachmentIds);
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, "\u4FDD\u5B58\u7269\u6D41\u6570\u636E\u5931\u8D25");
    }
  });
  router2.patch("/:id", async (req, res) => {
    const recordId = Number(req.params.id);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return fail(res, 400, "\u7269\u6D41\u8BB0\u5F55\u7F16\u53F7\u65E0\u6548", "INVALID_LOGISTICS_ID");
    }
    const result = await readLogisticsPayload(req.body || {});
    if ("error" in result) {
      return fail(res, 400, result.error, "INVALID_LOGISTICS_PAYLOAD");
    }
    try {
      const updated = await dbRun(
        `
          UPDATE logistics_records
          SET order_id = ?, tracking_no = ?, carrier = ?, freight_forwarder = ?, freight_forwarder_partner_id = ?, packing_details = ?, status = ?, shipping_date = ?, segment_type = ?,
              package_count = ?, volume_cbm = ?, gross_weight_kg = ?, incoterm = ?, transport_mode = ?, vessel_voyage = ?, bill_no = ?, etd = ?, eta = ?,
              recipient_address = ?, package_size = ?, remark = ?, updated_by = ?
          WHERE id = ?
        `,
        [
          result.payload.orderId,
          result.payload.trackingNo,
          result.payload.carrier,
          result.payload.freightForwarder,
          result.payload.freightForwarderPartnerId,
          result.payload.packingDetails,
          result.payload.status,
          result.payload.shippingDate || null,
          result.payload.segmentType,
          result.payload.packageCount,
          result.payload.volumeCbm,
          result.payload.grossWeightKg,
          result.payload.incoterm,
          result.payload.transportMode,
          result.payload.vesselVoyage,
          result.payload.billNo,
          result.payload.etd || null,
          result.payload.eta || null,
          result.payload.recipientAddress,
          result.payload.packageSize,
          result.payload.remark,
          req.user?.id || null,
          recordId
        ]
      );
      if (!updated.changes) {
        return fail(res, 404, "\u7269\u6D41\u8BB0\u5F55\u4E0D\u5B58\u5728", "LOGISTICS_NOT_FOUND");
      }
      await bindAttachmentsToEntity("logistics", recordId, result.payload.attachmentIds);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u66F4\u65B0\u7269\u6D41\u8BB0\u5F55\u5931\u8D25");
    }
  });
  router2.patch("/:id/status", async (req, res) => {
    const recordId = Number(req.params.id);
    const status = String(req.body?.status || "").trim();
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return fail(res, 400, "\u7269\u6D41\u8BB0\u5F55\u7F16\u53F7\u65E0\u6548", "INVALID_LOGISTICS_ID");
    }
    if (!["preparing", "shipped", "arrived"].includes(status)) {
      return fail(res, 400, "\u7269\u6D41\u72B6\u6001\u4E0D\u6B63\u786E", "INVALID_LOGISTICS_STATUS");
    }
    try {
      const result = await dbRun(`UPDATE logistics_records SET status = ?, updated_by = ? WHERE id = ?`, [
        status,
        req.user?.id || null,
        recordId
      ]);
      if (!result.changes) {
        return fail(res, 404, "\u7269\u6D41\u8BB0\u5F55\u4E0D\u5B58\u5728", "LOGISTICS_NOT_FOUND");
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u66F4\u65B0\u7269\u6D41\u72B6\u6001\u5931\u8D25");
    }
  });
  router2.post("/attachments", upload3.array("files", 6), async (req, res) => {
    const files = req.files || [];
    if (!files.length) {
      return fail(res, 400, "\u8BF7\u81F3\u5C11\u4E0A\u4F20\u4E00\u4E2A\u9644\u4EF6", "INVALID_ATTACHMENTS");
    }
    try {
      const uploaded = [];
      for (const file of files) {
        const result = await dbRun(
          `
            INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING id
          `,
          [null, null, file.originalname, file.filename, file.mimetype, file.size, file.filename]
        );
        uploaded.push({
          id: result.lastID,
          fileName: file.originalname,
          filePath: file.filename,
          storedName: file.filename,
          url: buildAttachmentUrl(result.lastID, file.filename),
          mimeType: file.mimetype,
          fileSize: file.size
        });
      }
      res.status(201).json(uploaded);
    } catch (error) {
      return handleRouteError(res, error, "\u9644\u4EF6\u4E0A\u4F20\u5931\u8D25");
    }
  });
  router2.delete("/attachments/:id", requireAdmin, async (req, res) => {
    const attachmentId = Number(req.params.id);
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return fail(res, 400, "\u9644\u4EF6\u7F16\u53F7\u65E0\u6548", "INVALID_ATTACHMENT_ID");
    }
    try {
      const existing = await dbGet(`SELECT file_path FROM attachments WHERE id = ?`, [attachmentId]);
      if (!existing) {
        return fail(res, 404, "\u9644\u4EF6\u4E0D\u5B58\u5728", "ATTACHMENT_NOT_FOUND");
      }
      const fullPath = resolveAttachmentAbsolutePath(existing.file_path);
      if (fullPath) {
        try {
          await fs6.unlink(fullPath);
        } catch (_error) {
        }
      }
      await dbRun(`DELETE FROM attachments WHERE id = ?`, [attachmentId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u5220\u9664\u9644\u4EF6\u5931\u8D25");
    }
  });
  router2.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
    const recordId = Number(req.params.id);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return fail(res, 400, "\u7269\u6D41\u8BB0\u5F55\u7F16\u53F7\u65E0\u6548", "INVALID_LOGISTICS_ID");
    }
    try {
      const existing = await dbGet(`SELECT id FROM logistics_records WHERE id = ?`, [recordId]);
      if (!existing) {
        return fail(res, 404, "\u7269\u6D41\u8BB0\u5F55\u4E0D\u5B58\u5728", "LOGISTICS_NOT_FOUND");
      }
      await deleteAttachmentRows("logistics", recordId);
      await dbRun(`DELETE FROM logistics_records WHERE id = ?`, [recordId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u5220\u9664\u7269\u6D41\u8BB0\u5F55\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/orders.ts
init_db();
init_auth();
import { Router as Router10 } from "express";
init_http();

// server/services/notifier.ts
var WEBHOOK_SETTING_KEY = "webhook_url";
async function getWebhookUrl() {
  return getSettingValue(WEBHOOK_SETTING_KEY, "");
}
async function sendWebhook(title, content) {
  const url = await getWebhookUrl();
  if (!url) return;
  const payload = {
    msgtype: "markdown",
    markdown: {
      content: `### ${title}
${content}
---
*SmartTrade AI CRM \u81EA\u52A8\u901A\u77E5*`
    }
  };
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
  }
}
async function notifyOrderCreated(displayId, customerName) {
  const baseUrl = process.env.PROJECT_URL || "";
  const link = baseUrl ? `[\u67E5\u770B\u8BA2\u5355](${baseUrl}/orders/${displayId.toLowerCase()})` : "";
  await sendWebhook("\u{1F4E6} \u65B0\u8BA2\u5355\u521B\u5EFA", `**\u8BA2\u5355\u53F7**: ${displayId}
**\u5BA2\u6237**: ${customerName}
${link}`);
}

// server/routes/orders.ts
init_values();
init_values();
async function generateNextDisplayId() {
  const now = /* @__PURE__ */ new Date();
  const datePart = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const pattern = `CQBX-${now.getFullYear()}-${datePart}%`;
  const lastOrder = await dbGet(
    `SELECT display_id FROM orders WHERE display_id LIKE ? ORDER BY display_id DESC LIMIT 1`,
    [pattern]
  );
  let nextSerial = 1;
  if (lastOrder?.display_id) {
    const lastSerialStr = lastOrder.display_id.slice(-2);
    const lastSerial = parseInt(lastSerialStr, 10);
    if (!isNaN(lastSerial)) nextSerial = lastSerial + 1;
  }
  return `CQBX-${now.getFullYear()}-${datePart}${String(nextSerial).padStart(2, "0")}`;
}
async function syncOrderProductSummary(orderId) {
  const items = await dbAll(`SELECT subtotal FROM order_items WHERE order_id = ?`, [orderId]);
  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  const productSummary = (await dbAll(`SELECT product_name FROM order_items WHERE order_id = ?`, [orderId])).map((i) => i.product_name).join(", ");
  await dbRun(`UPDATE orders SET total_amount = ?, product_summary = ? WHERE id = ?`, [totalAmount, productSummary, orderId]);
}
function createOrdersRouter() {
  const router2 = Router10();
  router2.get("/", async (req, res) => {
    const customerId = Number(req.query.customerId);
    const status = readString(req.query.status);
    const q = readString(req.query.q);
    const startDate = readString(req.query.start_date);
    const endDate = readString(req.query.end_date);
    let sql = `
      SELECT 
        o.*, 
        c.name AS customer_name,
        c.country AS customer_country,
        (SELECT COUNT(*) FROM finance_records WHERE order_id = o.id AND status = 'pending' AND deleted_at IS NULL) AS pending_finance_count,
        COALESCE((
          SELECT SUM(f.amount) 
          FROM finance_records f 
          WHERE f.order_id = o.id AND f.type = 'receipt' AND f.status = 'completed' AND f.currency = 'USD' AND f.deleted_at IS NULL
        ), 0) AS completed_receipt_usd
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.deleted_at IS NULL
    `;
    const params = [];
    if (customerId) {
      sql += ` AND o.customer_id = ?`;
      params.push(customerId);
    }
    if (status) {
      sql += ` AND o.status = ?`;
      params.push(status);
    }
    if (q) {
      sql += ` AND (o.display_id LIKE ? OR o.product_summary LIKE ? OR c.name LIKE ?)`;
      const p = `%${q}%`;
      params.push(p, p, p);
    }
    if (startDate) {
      sql += ` AND o.created_at >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND o.created_at <= ?`;
      params.push(endDate);
    }
    sql += ` ORDER BY datetime(o.created_at) DESC, o.id DESC`;
    const pagination = readPagination(req.query);
    sql += buildLimitOffset(pagination, params);
    try {
      const orders = await dbAll(sql, params);
      res.json(orders);
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u8BA2\u5355\u5217\u8868\u5931\u8D25");
    }
  });
  router2.get("/next-display-id", async (_req, res) => {
    try {
      const nextId = await generateNextDisplayId();
      res.json({ nextId });
    } catch (error) {
      return handleRouteError(res, error, "\u751F\u6210\u5355\u53F7\u5EFA\u8BAE\u5931\u8D25");
    }
  });
  router2.get("/:id", async (req, res) => {
    const orderNo = req.params.id;
    try {
      const detail = await buildOrderDetail(orderNo);
      if (!detail) {
        return fail(res, 404, "\u8BA2\u5355\u4E0D\u5B58\u5728", "ORDER_NOT_FOUND");
      }
      res.json(detail);
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u8BA2\u5355\u8BE6\u60C5\u5931\u8D25");
    }
  });
  router2.post("/", async (req, res) => {
    const result = await readOrderPayload(req.body || {});
    if ("error" in result) return fail(res, 400, result.error);
    try {
      let displayId = result.payload.displayId;
      const created = await withTransaction(async (tx) => {
        if (!displayId || !displayId.trim()) {
          displayId = await generateNextDisplayId();
        } else {
          const existing = await tx.get(`SELECT id FROM orders WHERE display_id = ?`, [displayId]);
          if (existing) {
            throw new Error(`ORDER_ID_CONFLICT:${displayId}`);
          }
        }
        return await tx.run(
          `INSERT INTO orders (display_id, customer_id, status, details, total_amount, product_summary, delivery_date, freight_amount, misc_amount, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
          [displayId, result.payload.customerId, ORDER_STATUSES[0], result.payload.details, result.payload.totalAmount, result.payload.productSummary, result.payload.deliveryDate || null, result.payload.freightAmount, result.payload.miscAmount, req.user?.id || null, req.user?.id || null]
        );
      });
      notifyOrderCreated(displayId, String(result.payload.customerId));
      res.status(201).json({ id: created.lastID, display_id: displayId });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("ORDER_ID_CONFLICT:")) {
        const conflictId = error.message.slice("ORDER_ID_CONFLICT:".length);
        return fail(res, 400, `\u521B\u5EFA\u5931\u8D25\uFF1A\u5355\u53F7 ${conflictId} \u5DF2\u5B58\u5728\uFF0C\u8BF7\u6838\u5BF9\u540E\u91CD\u65B0\u8F93\u5165\uFF01`, "ORDER_ID_CONFLICT");
      }
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        return fail(res, 400, "\u521B\u5EFA\u5931\u8D25\uFF1A\u8BE5\u8BA2\u5355\u5355\u53F7\u5DF2\u5B58\u5728\uFF0C\u8BF7\u6838\u5BF9\uFF01", "ORDER_ID_CONFLICT");
      }
      return handleRouteError(res, error, "\u521B\u5EFA\u8BA2\u5355\u5931\u8D25");
    }
  });
  router2.patch("/:id", async (req, res) => {
    const orderId = Number(req.params.id);
    const result = await readOrderPayload(req.body || {});
    if ("error" in result) return fail(res, 400, result.error);
    try {
      await withTransaction(async (tx) => {
        await tx.run(
          `UPDATE orders SET customer_id = ?, status = ?, details = ?, total_amount = ?, product_summary = ?, delivery_date = ?, freight_amount = ?, misc_amount = ?, updated_by = ? WHERE id = ?`,
          [result.payload.customerId, result.payload.status, result.payload.details, result.payload.totalAmount, result.payload.productSummary, result.payload.deliveryDate || null, result.payload.freightAmount, result.payload.miscAmount, req.user?.id || null, orderId]
        );
        const deletedIds = req.body.deletedItemIds || [];
        if (deletedIds.length > 0) {
          await tx.run(`DELETE FROM order_items WHERE id IN (${deletedIds.map(() => "?").join(",")})`, deletedIds);
        }
        const items = req.body.items || [];
        for (const item of items) {
          if (item.id) {
            await tx.run(
              `UPDATE order_items SET product_name = ?, specification = ?, hs_code = ?, quantity = ?, unit = ?, unit_price = ?, subtotal = ?, image_url = ? WHERE id = ?`,
              [item.productName, item.specification, item.hsCode, item.quantity, item.unit, item.unitPrice, item.subtotal, item.imageUrl, item.id]
            );
          } else {
            await tx.run(
              `INSERT INTO order_items (order_id, product_name, specification, hs_code, quantity, unit, unit_price, subtotal, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
              [orderId, item.productName, item.specification, item.hsCode, item.quantity, item.unit, item.unitPrice, item.subtotal, item.imageUrl]
            );
          }
        }
      });
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u66F4\u65B0\u8BA2\u5355\u5931\u8D25");
    }
  });
  router2.delete("/:id", requireAdmin, async (req, res) => {
    const orderId = Number(req.params.id);
    try {
      const order = await dbGet(`SELECT display_id FROM orders WHERE id = ?`, [orderId]);
      if (!order) return fail(res, 404, "\u8BA2\u5355\u4E0D\u5B58\u5728");
      await withTransaction(async (tx) => {
        await tx.run(`DELETE FROM order_items WHERE order_id = ?`, [orderId]);
        await tx.run(`UPDATE orders SET deleted_at = ${SQL.now()} WHERE id = ?`, [orderId]);
      });
      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: "DELETE",
        entityType: "ORDER",
        entityId: orderId,
        oldValue: { display_id: order.display_id }
      });
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u5220\u9664\u8BA2\u5355\u5931\u8D25");
    }
  });
  router2.delete("/items/:id", requireAdmin, async (req, res) => {
    const itemId = Number(req.params.id);
    const existing = await dbGet(`SELECT order_id FROM order_items WHERE id = ?`, [itemId]);
    if (!existing) return fail(res, 404, "\u6761\u76EE\u4E0D\u5B58\u5728");
    try {
      await dbRun(`DELETE FROM order_items WHERE id = ?`, [itemId]);
      await syncOrderProductSummary(existing.order_id);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u5220\u9664\u5931\u8D25");
    }
  });
  router2.post("/batch-delete", requireAdmin, async (req, res) => {
    const ids = req.body.ids || [];
    if (!ids.length) return fail(res, 400, "\u8BF7\u9009\u62E9\u8981\u5220\u9664\u7684\u8BA2\u5355", "INVALID_BATCH");
    if (ids.length > 100) return fail(res, 400, "\u5355\u6B21\u6700\u591A\u5220\u9664 100 \u6761\u8BA2\u5355", "BATCH_TOO_LARGE");
    try {
      await withTransaction(async (tx) => {
        for (const id of ids) {
          await tx.run(`DELETE FROM order_items WHERE order_id = ?`, [id]);
          await tx.run(`UPDATE orders SET deleted_at = ${SQL.now()} WHERE id = ?`, [id]);
        }
      });
      res.json({ success: true, deletedCount: ids.length });
    } catch (error) {
      return handleRouteError(res, error, "\u6279\u91CF\u5220\u9664\u5931\u8D25");
    }
  });
  router2.get("/:id/production", async (req, res) => {
    const orderId = Number(req.params.id);
    try {
      const record = await dbGet(`SELECT pp.*, p.name AS partner_name FROM production_plans pp LEFT JOIN partners p ON p.id = pp.partner_id WHERE pp.order_id = ?`, [orderId]);
      if (!record) return res.json(null);
      const logs = await dbAll(`SELECT pl.*, u.name as created_by_name FROM production_logs pl LEFT JOIN users u ON u.id = pl.created_by WHERE pl.plan_id = ? ORDER BY pl.created_at DESC`, [record.id]);
      res.json({ ...record, partnerId: record.partner_id, partnerName: record.partner_name, logs: logs.map((l) => ({ ...l, createdByName: l.created_by_name })) });
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u5931\u8D25");
    }
  });
  router2.post("/production/:id/logs", async (req, res) => {
    const planId = Number(req.params.id);
    const result = await readProductionLogPayload(req.body || {});
    if ("error" in result) return fail(res, 400, result.error);
    try {
      const created = await dbRun(`INSERT INTO production_logs (plan_id, content, log_date, created_by) VALUES (?, ?, ?, ?) RETURNING id`, [planId, result.payload.content, result.payload.logDate || null, req.user?.id || null]);
      await bindAttachmentsToEntity("production_log", created.lastID, result.payload.attachmentIds);
      res.status(201).json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u6DFB\u52A0\u5931\u8D25");
    }
  });
  router2.patch("/:id/packing", async (req, res) => {
    const orderId = Number(req.params.id);
    const items = req.body.items || [];
    try {
      await dbRun(`DELETE FROM packing_records WHERE order_id = ?`, [orderId]);
      for (const item of items) {
        await dbRun(
          `INSERT INTO packing_records (order_id, package_count, package_size, gross_weight, net_weight, attachment_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, Number(item.packageCount), item.packageSize, item.grossWeight, item.netWeight, item.attachmentId || null]
        );
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u5931\u8D25");
    }
  });
  router2.get("/:id/profit", async (req, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: "\u65E0\u6548\u7684\u8BA2\u5355\u7F16\u53F7" });
    }
    try {
      const row = await dbGet(`SELECT data FROM order_profits WHERE order_id = ?`, [orderId]);
      let data = {};
      if (row) {
        data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      } else {
        const oldRow = await dbGet(`SELECT value FROM settings WHERE key = ?`, [`order_profit_${orderId}`]);
        if (oldRow) {
          data = JSON.parse(oldRow.value);
          await dbRun(
            `INSERT INTO order_profits (order_id, data) VALUES (?, ?) ON CONFLICT(order_id) DO NOTHING`,
            [orderId, oldRow.value]
          );
        }
      }
      res.json({
        receipts: data.receipts || [{ amount: 0, currency: "USD", bankFees: 0, platformFees: 0, exchangeRate: 7.2 }],
        invoiceAmount: data.invoiceAmount || 0,
        refundRate: data.refundRate ?? 13,
        otherIncomeCny: data.otherIncomeCny || 0,
        factoryCostCny: data.factoryCostCny || 0,
        domesticFees: data.domesticFees || 0,
        freightValue: data.freightValue || 0,
        freightCurrency: data.freightCurrency || "USD",
        customsMisc: data.customsMisc || 0,
        miscFees: data.miscFees || []
      });
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u5229\u6DA6\u6570\u636E\u5931\u8D25");
    }
  });
  router2.post("/:id/profit", requireAdmin, async (req, res) => {
    const orderId = Number(req.params.id);
    const data = {
      receipts: Array.isArray(req.body.receipts) ? req.body.receipts.map((r) => ({
        amount: Number(r.amount) || 0,
        currency: r.currency === "CNY" ? "CNY" : "USD",
        bankFees: Number(r.bankFees) || 0,
        platformFees: Number(r.platformFees) || 0,
        exchangeRate: Number(r.exchangeRate) || (r.currency === "CNY" ? 1 : 7.2)
      })) : [{ amount: 0, currency: "USD", bankFees: 0, platformFees: 0, exchangeRate: 7.2 }],
      invoiceAmount: Number(req.body.invoiceAmount) || 0,
      refundRate: Number(req.body.refundRate) || 13,
      otherIncomeCny: Number(req.body.otherIncomeCny) || 0,
      factoryCostCny: Number(req.body.factoryCostCny) || 0,
      domesticFees: Number(req.body.domesticFees) || 0,
      freightValue: Number(req.body.freightValue) || 0,
      freightCurrency: req.body.freightCurrency === "CNY" ? "CNY" : "USD",
      customsMisc: Number(req.body.customsMisc) || 0,
      miscFees: Array.isArray(req.body.miscFees) ? req.body.miscFees : []
    };
    try {
      await dbRun(
        `INSERT INTO order_profits (order_id, data, updated_at) 
         VALUES (?, ?, CURRENT_TIMESTAMP) 
         ON CONFLICT(order_id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`,
        [orderId, JSON.stringify(data)]
      );
      await dbRun(`DELETE FROM settings WHERE key = ?`, [`order_profit_${orderId}`]);
      res.json({ success: true, ...data });
    } catch (error) {
      return handleRouteError(res, error, "\u4FDD\u5B58\u5229\u6DA6\u6570\u636E\u5931\u8D25");
    }
  });
  router2.patch("/:id/quick-notes", async (req, res) => {
    const content = readString(req.body?.content, 5e3);
    try {
      await dbRun(`UPDATE orders SET quick_notes = ? WHERE id = ?`, [content, req.params.id]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u66F4\u65B0\u5931\u8D25");
    }
  });
  router2.get("/:id/follow-ups", async (req, res) => {
    const orderId = Number(req.params.id);
    try {
      const rows = await dbAll(
        `SELECT of.*, u.name AS created_by_name FROM order_follow_ups of LEFT JOIN users u ON u.id = of.created_by WHERE of.order_id = ? ORDER BY datetime(of.created_at) DESC, of.id DESC`,
        [orderId]
      );
      res.json(rows);
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u8DDF\u8FDB\u8BB0\u5F55\u5931\u8D25");
    }
  });
  router2.post("/:id/follow-ups", async (req, res) => {
    const orderId = Number(req.params.id);
    const content = String(req.body.content || "").trim();
    if (!content) {
      return fail(res, 400, "\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A");
    }
    try {
      await dbRun(
        `INSERT INTO order_follow_ups (order_id, content, created_by) VALUES (?, ?, ?)`,
        [orderId, content, req.user?.id || null]
      );
      res.status(201).json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u4FDD\u5B58\u8DDF\u8FDB\u8BB0\u5F55\u5931\u8D25");
    }
  });
  router2.post("/:id/production", async (req, res) => {
    const orderId = Number(req.params.id);
    const result = await readProductionPayload(req.body || {}, orderId);
    if ("error" in result) return fail(res, 400, result.error);
    try {
      const created = await dbRun(
        `INSERT INTO production_plans (order_id, partner_id, order_date, estimated_delivery_date, production_status, inspection_status, remark, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [orderId, result.payload.partnerId, result.payload.orderDate || null, result.payload.estimatedDeliveryDate || null, result.payload.productionStatus, result.payload.inspectionStatus, result.payload.remark, req.user?.id || null, req.user?.id || null]
      );
      if (Array.isArray(req.body?.attachmentIds)) {
        await bindAttachmentsToEntity("production_photo", orderId, result.payload.attachmentIds);
      }
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, "\u4FDD\u5B58\u5931\u8D25");
    }
  });
  router2.patch("/production/:id", async (req, res) => {
    const productionId = Number(req.params.id);
    try {
      const existing = await dbGet(
        `SELECT order_id FROM production_plans WHERE id = ?`,
        [productionId]
      );
      if (!existing) {
        return fail(res, 404, "\u6392\u4EA7\u8BA1\u5212\u4E0D\u5B58\u5728");
      }
      const result = await readProductionPayload(req.body || {}, existing.order_id);
      if ("error" in result) return fail(res, 400, result.error);
      await dbRun(
        `UPDATE production_plans SET partner_id = ?, order_date = ?, estimated_delivery_date = ?, production_status = ?, inspection_status = ?, remark = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [
          result.payload.partnerId,
          result.payload.orderDate || null,
          result.payload.estimatedDeliveryDate || null,
          result.payload.productionStatus,
          result.payload.inspectionStatus,
          result.payload.remark,
          req.user?.id || null,
          productionId
        ]
      );
      if (Array.isArray(req.body?.attachmentIds)) {
        await bindAttachmentsToEntity("production_photo", existing.order_id, result.payload.attachmentIds);
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u66F4\u65B0\u6392\u4EA7\u8BA1\u5212\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/partners.ts
init_db();
init_auth();
init_http();
import { Router as Router11 } from "express";
function createPartnersRouter() {
  const router2 = Router11();
  router2.get("/", async (req, res) => {
    try {
      const { readPagination: readPagination2, buildLimitOffset: buildLimitOffset2 } = await Promise.resolve().then(() => (init_values(), values_exports));
      const params = [];
      const partners = await dbAll(`
        SELECT
          p.*,
          u.name AS created_by_name
        FROM partners p
        LEFT JOIN users u ON u.id = p.created_by
        WHERE p.deleted_at IS NULL
        ORDER BY datetime(p.created_at) DESC, p.id DESC
        ${buildLimitOffset2(readPagination2(req.query), params)}
      `, params);
      res.json(partners);
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u4F19\u4F34\u6570\u636E\u5931\u8D25");
    }
  });
  router2.post("/", async (req, res) => {
    const result = await readPartnerPayload(req.body || {});
    if ("error" in result) {
      return fail(res, 400, result.error, "INVALID_PARTNER_PAYLOAD");
    }
    try {
      const created = await dbRun(
        `
          INSERT INTO partners (name, partner_type, country, contact, contact_person, address, rating, payment_terms, remark, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
        [
          result.payload.name,
          result.payload.partnerType,
          result.payload.country,
          result.payload.contact,
          result.payload.contactPerson,
          result.payload.address,
          result.payload.rating,
          result.payload.paymentTerms,
          result.payload.remark,
          req.user?.id || null,
          req.user?.id || null
        ]
      );
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, "\u521B\u5EFA\u4F19\u4F34\u5931\u8D25");
    }
  });
  router2.patch("/:id", async (req, res) => {
    const partnerId = Number(req.params.id);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return fail(res, 400, "\u4F19\u4F34\u7F16\u53F7\u65E0\u6548", "INVALID_PARTNER_ID");
    }
    const result = await readPartnerPayload(req.body || {});
    if ("error" in result) {
      return fail(res, 400, result.error, "INVALID_PARTNER_PAYLOAD");
    }
    try {
      const updated = await dbRun(
        `
          UPDATE partners
          SET name = ?, partner_type = ?, country = ?, contact = ?, contact_person = ?, address = ?, rating = ?, payment_terms = ?, remark = ?, updated_by = ?
          WHERE id = ?
        `,
        [
          result.payload.name,
          result.payload.partnerType,
          result.payload.country,
          result.payload.contact,
          result.payload.contactPerson,
          result.payload.address,
          result.payload.rating,
          result.payload.paymentTerms,
          result.payload.remark,
          req.user?.id || null,
          partnerId
        ]
      );
      if (!updated.changes) {
        return fail(res, 404, "\u4F19\u4F34\u4E0D\u5B58\u5728", "PARTNER_NOT_FOUND");
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u66F4\u65B0\u4F19\u4F34\u5931\u8D25");
    }
  });
  router2.get("/:id", async (req, res) => {
    const partnerId = Number(req.params.id);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return fail(res, 400, "\u4F19\u4F34\u7F16\u53F7\u65E0\u6548", "INVALID_PARTNER_ID");
    }
    try {
      const partner = await dbGet(`
        SELECT p.*, u.name AS created_by_name
        FROM partners p LEFT JOIN users u ON u.id = p.created_by
        WHERE p.id = ?
      `, [partnerId]);
      if (!partner) {
        return fail(res, 404, "\u4F19\u4F34\u4E0D\u5B58\u5728", "PARTNER_NOT_FOUND");
      }
      const productionOrders = await dbAll(`
        SELECT o.id, o.display_id, o.status, o.total_amount, o.product_summary, o.created_at,
               pp.production_status, pp.inspection_status, pp.order_date AS prod_order_date,
               pp.estimated_delivery_date
        FROM production_plans pp
        JOIN orders o ON o.id = pp.order_id
        WHERE pp.partner_id = ?
        ORDER BY datetime(pp.created_at) DESC
      `, [partnerId]);
      const financeRecords = await dbAll(`
        SELECT fr.*, o.display_id AS order_display_id
        FROM finance_records fr
        LEFT JOIN orders o ON o.id = fr.order_id
        WHERE fr.partner_id = ?
        ORDER BY datetime(fr.created_at) DESC
      `, [partnerId]);
      let logisticsRecords = [];
      try {
        logisticsRecords = await dbAll(`
          SELECT lr.*, o.display_id AS order_display_id, o.status AS order_status
          FROM logistics_records lr
          LEFT JOIN orders o ON o.id = lr.order_id
          WHERE lr.freight_forwarder_partner_id = ? AND lr.deleted_at IS NULL
          ORDER BY datetime(lr.created_at) DESC
        `, [partnerId]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("freight_forwarder_partner_id")) {
          throw error;
        }
        logisticsRecords = [];
      }
      const financeOrderIds = [...new Set(financeRecords.map((r) => r.order_id).filter(Boolean))];
      const logisticsOrderIds = [...new Set(logisticsRecords.map((r) => r.order_id).filter(Boolean))];
      const linkedOrderIds = [.../* @__PURE__ */ new Set([...financeOrderIds, ...logisticsOrderIds])];
      let linkedOrders = [];
      if (linkedOrderIds.length) {
        linkedOrders = await dbAll(
          `SELECT id, display_id, status, total_amount, product_summary, created_at FROM orders WHERE id IN (${linkedOrderIds.join(",")})`
        );
      }
      const thisMonth = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
      const lastMonth = new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth() - 1, 1).toISOString().slice(0, 7);
      const monthlyStats = await dbAll(`
        SELECT ${SQL.date("pp.created_at", "%Y-%m")} AS month, COUNT(*) AS count
        FROM production_plans pp
        WHERE pp.partner_id = ?
        GROUP BY month ORDER BY month DESC LIMIT 12
      `, [partnerId]);
      const thisMonthCount = monthlyStats.find((m) => m.month === thisMonth)?.count || 0;
      const lastMonthCount = monthlyStats.find((m) => m.month === lastMonth)?.count || 0;
      const allOrderMap = /* @__PURE__ */ new Map();
      for (const o of productionOrders) {
        allOrderMap.set(o.id, { ...o, linkType: "production" });
      }
      for (const o of linkedOrders) {
        const linkType = logisticsOrderIds.includes(o.id) ? "logistics" : "finance";
        if (!allOrderMap.has(o.id)) {
          allOrderMap.set(o.id, { ...o, linkType });
        }
      }
      res.json({
        partner,
        orders: [...allOrderMap.values()],
        financeRecords,
        logisticsRecords,
        summary: {
          totalOrders: allOrderMap.size,
          thisMonthCount,
          lastMonthCount,
          totalFinanceAmount: financeRecords.reduce((s, r) => s + Number(r.amount || 0), 0),
          productionCount: productionOrders.length,
          logisticsCount: logisticsRecords.length
        }
      });
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u4F19\u4F34\u8BE6\u60C5\u5931\u8D25");
    }
  });
  router2.delete("/:id", requireAdmin, async (req, res) => {
    const partnerId = Number(req.params.id);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return fail(res, 400, "\u4F19\u4F34\u7F16\u53F7\u65E0\u6548", "INVALID_PARTNER_ID");
    }
    try {
      const linkedFinance = await dbGet(`SELECT COUNT(*) AS count FROM finance_records WHERE partner_id = ?`, [partnerId]);
      const linkedProduction = await dbGet(`SELECT COUNT(*) AS count FROM production_plans WHERE partner_id = ?`, [partnerId]);
      if ((linkedFinance?.count || 0) > 0 || (linkedProduction?.count || 0) > 0) {
        return fail(res, 409, "\u8BE5\u4F19\u4F34\u5DF2\u88AB\u8D22\u52A1\u6216\u751F\u4EA7\u5B89\u6392\u5F15\u7528\uFF0C\u6682\u65F6\u4E0D\u80FD\u5220\u9664", "PARTNER_IN_USE");
      }
      const deleted = await dbRun(`UPDATE partners SET deleted_at = ${SQL.now()} WHERE id = ?`, [partnerId]);
      if (!deleted.changes) {
        return fail(res, 404, "\u4F19\u4F34\u4E0D\u5B58\u5728", "PARTNER_NOT_FOUND");
      }
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u5220\u9664\u4F19\u4F34\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/settings.ts
init_auth();
import { Router as Router12 } from "express";
import multer4 from "multer";
import path8 from "path";
import fs9 from "fs/promises";
import { spawn } from "child_process";
init_http();
init_values();

// server/services/export.ts
init_db();
import { Buffer as Buffer3 } from "node:buffer";
import fs8 from "node:fs/promises";

// server/lib/zip.ts
import { Buffer as Buffer2 } from "node:buffer";
import fs7 from "node:fs";
import { once } from "node:events";
var CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let i = 0; i < 8; i += 1) {
    value = value & 1 ? 3988292384 ^ value >>> 1 : value >>> 1;
  }
  return value >>> 0;
});
function updateCrc32(crc, buffer) {
  for (const value of buffer) {
    crc = CRC32_TABLE[(crc ^ value) & 255] ^ crc >>> 8;
  }
  return crc >>> 0;
}
function crc32(buffer) {
  let crc = 4294967295;
  crc = updateCrc32(crc, buffer);
  return (crc ^ 4294967295) >>> 0;
}
function toDosDateTime(input) {
  const year = Math.max(input.getFullYear(), 1980);
  const dosTime = (input.getHours() & 31) << 11 | (input.getMinutes() & 63) << 5 | Math.floor(input.getSeconds() / 2);
  const dosDate = (year - 1980 & 127) << 9 | (input.getMonth() + 1 & 15) << 5 | input.getDate() & 31;
  return { dosTime, dosDate };
}
function buildLocalHeader(nameBuffer, checksum, size, dosTime, dosDate) {
  const localHeader = Buffer2.alloc(30);
  localHeader.writeUInt32LE(67324752, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(2048, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(dosTime, 10);
  localHeader.writeUInt16LE(dosDate, 12);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(size, 18);
  localHeader.writeUInt32LE(size, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);
  return localHeader;
}
function buildCentralHeader(entry, nameBuffer) {
  const centralHeader = Buffer2.alloc(46);
  centralHeader.writeUInt32LE(33639248, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(2048, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(entry.dosTime, 12);
  centralHeader.writeUInt16LE(entry.dosDate, 14);
  centralHeader.writeUInt32LE(entry.checksum, 16);
  centralHeader.writeUInt32LE(entry.size, 20);
  centralHeader.writeUInt32LE(entry.size, 24);
  centralHeader.writeUInt16LE(nameBuffer.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(entry.offset, 42);
  return centralHeader;
}
async function getFileChecksumAndSize(filePath) {
  let crc = 4294967295;
  let size = 0;
  for await (const chunk of fs7.createReadStream(filePath)) {
    const buffer = Buffer2.isBuffer(chunk) ? chunk : Buffer2.from(chunk);
    crc = updateCrc32(crc, buffer);
    size += buffer.length;
  }
  return {
    checksum: (crc ^ 4294967295) >>> 0,
    size
  };
}
function createZipBuffer(entries) {
  const now = /* @__PURE__ */ new Date();
  const { dosTime, dosDate } = toDosDateTime(now);
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBuffer = Buffer2.from(entry.name, "utf8");
    const dataBuffer = Buffer2.isBuffer(entry.data) ? entry.data : Buffer2.from(entry.data);
    const checksum = crc32(dataBuffer);
    const localHeader = buildLocalHeader(nameBuffer, checksum, dataBuffer.length, dosTime, dosDate);
    const centralHeader = buildCentralHeader(
      {
        name: entry.name,
        checksum,
        size: dataBuffer.length,
        offset,
        dosTime,
        dosDate
      },
      nameBuffer
    );
    localParts.push(localHeader, nameBuffer, dataBuffer);
    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }
  const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = Buffer2.alloc(22);
  endRecord.writeUInt32LE(101010256, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectorySize, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);
  return Buffer2.concat([...localParts, ...centralParts, endRecord]);
}
var ZipStreamWriter = class {
  constructor(sink) {
    this.sink = sink;
    this.entries = [];
    this.offset = 0;
  }
  async writeChunk(chunk) {
    const result = this.sink.write(chunk);
    this.offset += chunk.length;
    if (result === false && typeof this.sink.once === "function") {
      await once(this.sink, "drain");
    }
  }
  async addEntry(name, checksum, size, writeData, modifiedAt = /* @__PURE__ */ new Date()) {
    const { dosTime, dosDate } = toDosDateTime(modifiedAt);
    const nameBuffer = Buffer2.from(name, "utf8");
    const entryOffset = this.offset;
    await this.writeChunk(buildLocalHeader(nameBuffer, checksum, size, dosTime, dosDate));
    await this.writeChunk(nameBuffer);
    await writeData();
    this.entries.push({
      name,
      checksum,
      size,
      offset: entryOffset,
      dosTime,
      dosDate
    });
  }
  async addBuffer(name, data, modifiedAt = /* @__PURE__ */ new Date()) {
    const buffer = Buffer2.isBuffer(data) ? data : Buffer2.from(data);
    await this.addEntry(
      name,
      crc32(buffer),
      buffer.length,
      async () => {
        await this.writeChunk(buffer);
      },
      modifiedAt
    );
  }
  async addText(name, content, modifiedAt = /* @__PURE__ */ new Date()) {
    await this.addBuffer(name, Buffer2.from(content, "utf8"), modifiedAt);
  }
  async addFile(name, filePath, modifiedAt = /* @__PURE__ */ new Date()) {
    const { checksum, size } = await getFileChecksumAndSize(filePath);
    await this.addEntry(
      name,
      checksum,
      size,
      async () => {
        for await (const chunk of fs7.createReadStream(filePath)) {
          const buffer = Buffer2.isBuffer(chunk) ? chunk : Buffer2.from(chunk);
          await this.writeChunk(buffer);
        }
      },
      modifiedAt
    );
  }
  async finalize() {
    const centralParts = [];
    for (const entry of this.entries) {
      const nameBuffer = Buffer2.from(entry.name, "utf8");
      centralParts.push(buildCentralHeader(entry, nameBuffer), nameBuffer);
    }
    const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
    for (const part of centralParts) {
      await this.writeChunk(part);
    }
    const endRecord = Buffer2.alloc(22);
    endRecord.writeUInt32LE(101010256, 0);
    endRecord.writeUInt16LE(0, 4);
    endRecord.writeUInt16LE(0, 6);
    endRecord.writeUInt16LE(this.entries.length, 8);
    endRecord.writeUInt16LE(this.entries.length, 10);
    endRecord.writeUInt32LE(centralDirectorySize, 12);
    endRecord.writeUInt32LE(this.offset, 16);
    endRecord.writeUInt16LE(0, 20);
    this.sink.end?.(endRecord);
  }
};

// server/services/excel-export.ts
init_db();
import ExcelJS from "exceljs";
var HEADER_STYLE = {
  font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } },
  border: {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" }
  }
};
var ALT_ROW_FILL = {
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
};
async function addDataSheet(wb, name, query, params = []) {
  const rows = await dbAll(query, params);
  if (!rows.length) return;
  const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: "FF0F172A" } } });
  const columns = Object.keys(rows[0]);
  ws.columns = columns.map((c) => ({ header: c, key: c, width: Math.max(c.length * 2, 18) }));
  const headerRow = ws.getRow(1);
  columns.forEach((c, i) => {
    headerRow.getCell(i + 1).style = HEADER_STYLE;
  });
  rows.forEach((row, idx) => {
    const r = ws.addRow(row);
    if (idx % 2 === 1) r.eachCell((cell) => {
      cell.style = ALT_ROW_FILL;
    });
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: columns.length } };
}
async function buildExcelWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SmartTrade AI CRM";
  wb.created = /* @__PURE__ */ new Date();
  await addDataSheet(wb, "\u8BA2\u5355", `
    SELECT o.id, o.display_id, o.status, o.total_amount, o.freight_amount, o.misc_amount,
           o.product_summary, o.delivery_date, o.created_at,
           c.name AS customer_name, c.country AS customer_country,
           u.name AS created_by
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN users u ON u.id = o.created_by
    WHERE o.deleted_at IS NULL
    ORDER BY o.id ASC
  `);
  await addDataSheet(wb, "\u5546\u54C1\u660E\u7EC6", `
    SELECT oi.*, o.display_id AS order_no FROM order_items oi
    LEFT JOIN orders o ON o.id = oi.order_id WHERE o.deleted_at IS NULL ORDER BY oi.id ASC
  `);
  await addDataSheet(wb, "\u8D22\u52A1\u6D41\u6C34", `
    SELECT f.*, o.display_id AS order_no, c.name AS customer_name, p.name AS partner_name
    FROM finance_records f LEFT JOIN orders o ON o.id = f.order_id
    LEFT JOIN customers c ON c.id = o.customer_id LEFT JOIN partners p ON p.id = f.partner_id WHERE f.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL) ORDER BY f.id ASC
  `);
  await addDataSheet(wb, "\u7269\u6D41\u8BB0\u5F55", `
    SELECT l.*, o.display_id AS order_no, c.name AS customer_name
    FROM logistics_records l LEFT JOIN orders o ON o.id = l.order_id
    LEFT JOIN customers c ON c.id = o.customer_id WHERE l.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL) ORDER BY l.id ASC
  `);
  await addDataSheet(wb, "\u62A5\u5173\u8BB0\u5F55", `
    SELECT cr.*, o.display_id AS order_no, c.name AS customer_name
    FROM customs_records cr LEFT JOIN orders o ON o.id = cr.order_id
    LEFT JOIN customers c ON c.id = o.customer_id WHERE o.deleted_at IS NULL ORDER BY cr.id ASC
  `);
  await addDataSheet(wb, "\u751F\u4EA7\u5B89\u6392", `
    SELECT pp.*, o.display_id AS order_no, c.name AS customer_name, p.name AS partner_name
    FROM production_plans pp LEFT JOIN orders o ON o.id = pp.order_id
    LEFT JOIN customers c ON c.id = o.customer_id LEFT JOIN partners p ON p.id = pp.partner_id WHERE o.deleted_at IS NULL ORDER BY pp.id ASC
  `);
  await addDataSheet(wb, "\u88C5\u7BB1\u8BB0\u5F55", `
    SELECT pr.*, o.display_id AS order_no FROM packing_records pr
    LEFT JOIN orders o ON o.id = pr.order_id WHERE o.deleted_at IS NULL ORDER BY pr.id ASC
  `);
  await addDataSheet(wb, "\u5BA2\u6237", `
    SELECT c.*, COUNT(o.id) AS order_count FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.deleted_at IS NULL WHERE c.deleted_at IS NULL GROUP BY c.id ORDER BY c.id ASC
  `);
  await addDataSheet(wb, "\u5408\u4F5C\u4F19\u4F34", `
    SELECT p.*, u.name AS created_by FROM partners p
    LEFT JOIN users u ON u.id = p.created_by WHERE p.deleted_at IS NULL ORDER BY p.id ASC
  `);
  await addDataSheet(wb, "\u4EFB\u52A1", `
    SELECT t.*, a.name AS assignee_name, cu.name AS created_by_name FROM tasks t
    LEFT JOIN users a ON a.id = t.assignee_id LEFT JOIN users cu ON cu.id = t.created_by ORDER BY t.id ASC
  `);
  await addDataSheet(wb, "\u5BA2\u6237\u8DDF\u8FDB", `
    SELECT cf.*, c.name AS customer_name, u.name AS created_by_name
    FROM customer_followups cf LEFT JOIN customers c ON c.id = cf.customer_id
    LEFT JOIN users u ON u.id = cf.created_by WHERE c.deleted_at IS NULL ORDER BY cf.id ASC
  `);
  await addDataSheet(wb, "\u8BA2\u5355\u8DDF\u8FDB", `
    SELECT ofu.*, o.display_id AS order_no, u.name AS created_by_name
    FROM order_follow_ups ofu LEFT JOIN orders o ON o.id = ofu.order_id
    LEFT JOIN users u ON u.id = ofu.created_by WHERE o.deleted_at IS NULL ORDER BY ofu.id ASC
  `);
  return wb;
}
async function buildCustomerXlsx(customer, orders, orderDetailsMap) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SmartTrade AI CRM";
  wb.created = /* @__PURE__ */ new Date();
  const overview = wb.addWorksheet("\u5BA2\u6237\u6982\u89C8", { properties: { tabColor: { argb: "FF0F172A" } } });
  overview.columns = [
    { header: "\u5B57\u6BB5", key: "field", width: 25 },
    { header: "\u503C", key: "value", width: 40 }
  ];
  overview.getRow(1).eachCell((c) => c.style = HEADER_STYLE);
  const infoRows = [
    ["\u5BA2\u6237\u540D\u79F0", customer.name],
    ["\u56FD\u5BB6/\u5730\u533A", customer.country],
    ["\u8054\u7CFB\u65B9\u5F0F", customer.contact],
    ["\u5BA2\u6237\u7F16\u53F7", customer.display_id],
    ["\u6765\u6E90\u6E20\u9053", customer.source_channel],
    ["\u610F\u5411\u4EA7\u54C1", customer.intent_products],
    ["\u5EFA\u6863\u65F6\u95F4", customer.created_at],
    ["\u5173\u8054\u8BA2\u5355\u6570", String(orders.length)]
  ];
  infoRows.forEach(([field, value], idx) => {
    const r = overview.addRow({ field, value: value || "\u2014" });
    if (idx % 2 === 0) r.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    });
  });
  const contacts = await dbAll(`SELECT cc.*, c.name AS customer_name FROM customer_contacts cc LEFT JOIN customers c ON c.id = cc.customer_id WHERE cc.customer_id = ?`, [customer.id]);
  if (contacts.length) {
    const ws = wb.addWorksheet("\u8054\u7CFB\u4EBA", { properties: { tabColor: { argb: "FF0F172A" } } });
    const cols = Object.keys(contacts[0]);
    ws.columns = cols.map((c) => ({ header: c, key: c, width: 20 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    contacts.forEach((r, idx) => {
      const row = ws.addRow(r);
      if (idx % 2 === 1) row.eachCell((cell) => {
        cell.style = ALT_ROW_FILL;
      });
    });
  }
  const followups = await dbAll(`SELECT cf.*, u.name AS created_by_name FROM customer_followups cf LEFT JOIN users u ON u.id = cf.created_by WHERE cf.customer_id = ? ORDER BY datetime(cf.created_at) DESC`, [customer.id]);
  if (followups.length) {
    const ws = wb.addWorksheet("\u8DDF\u8FDB\u8BB0\u5F55", { properties: { tabColor: { argb: "FF0F172A" } } });
    const cols = ["content", "channel", "created_by_name", "created_at"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: 30 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    followups.forEach((r, idx) => {
      const row = ws.addRow({ content: r.content, channel: r.channel, created_by_name: r.created_by_name, created_at: r.created_at });
      if (idx % 2 === 1) row.eachCell((cell) => {
        cell.style = ALT_ROW_FILL;
      });
    });
  }
  if (orders.length) {
    const ws = wb.addWorksheet("\u8BA2\u5355\u4E00\u89C8", { properties: { tabColor: { argb: "FF0F172A" } } });
    const cols = ["display_id", "status", "total_amount", "product_summary", "delivery_date", "created_at"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: 20 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    orders.forEach((o, idx) => {
      const row = ws.addRow({ display_id: o.display_id, status: o.status, total_amount: o.total_amount, product_summary: o.product_summary, delivery_date: o.delivery_date, created_at: o.created_at });
      if (idx % 2 === 1) row.eachCell((cell) => {
        cell.style = ALT_ROW_FILL;
      });
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: orders.length + 1, column: cols.length } };
  }
  return wb;
}
async function buildOrderXlsx(detail) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SmartTrade AI CRM";
  wb.created = /* @__PURE__ */ new Date();
  const info = wb.addWorksheet("\u8BA2\u5355\u4FE1\u606F", { properties: { tabColor: { argb: "FF0F172A" } } });
  info.columns = [{ header: "\u5B57\u6BB5", key: "field", width: 25 }, { header: "\u503C", key: "value", width: 50 }];
  info.getRow(1).eachCell((c) => c.style = HEADER_STYLE);
  const order = detail.order || {};
  const customer = detail.customer || {};
  const infoData = [
    ["\u8BA2\u5355\u53F7", order.display_id],
    ["\u72B6\u6001", order.status],
    ["\u5BA2\u6237", customer.name],
    ["\u56FD\u5BB6", customer.country],
    ["\u8054\u7CFB\u4EBA", customer.contact],
    ["\u4EA7\u54C1\u6458\u8981", order.product_summary],
    ["\u603B\u91D1\u989D", `$${Number(order.total_amount).toLocaleString()}`],
    ["\u8FD0\u8D39", `$${Number(order.freight_amount).toLocaleString()}`],
    ["\u6742\u8D39", `$${Number(order.misc_amount).toLocaleString()}`],
    ["\u4EA4\u4ED8\u65E5\u671F", order.delivery_date || "\u2014"],
    ["\u521B\u5EFA\u65F6\u95F4", order.created_at]
  ];
  infoData.forEach(([field, value], idx) => {
    const r = info.addRow({ field, value });
    if (idx % 2 === 0) r.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    });
  });
  if (detail.items?.length) {
    const ws = wb.addWorksheet("\u5546\u54C1\u660E\u7EC6");
    const cols = ["product_name", "specification", "quantity", "unit", "unit_price", "subtotal"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: 20 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    detail.items.forEach((item, idx) => {
      const row = ws.addRow(item);
      if (idx % 2 === 1) row.eachCell((cell) => {
        cell.style = ALT_ROW_FILL;
      });
    });
  }
  if (detail.financeRecords?.length) {
    const ws = wb.addWorksheet("\u8D22\u52A1\u6D41\u6C34");
    const cols = ["type", "amount", "currency", "status", "recordCategory", "target", "partnerName", "remark", "createdAt"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: 18 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    detail.financeRecords.forEach((r, idx) => {
      const row = ws.addRow(r);
      if (idx % 2 === 1) row.eachCell((cell) => {
        cell.style = ALT_ROW_FILL;
      });
    });
  }
  if (detail.logisticsRecords?.length) {
    const ws = wb.addWorksheet("\u7269\u6D41\u8BB0\u5F55");
    const cols = ["segmentType", "carrier", "trackingNo", "status", "shippingDate", "transportMode", "vesselVoyage", "etd", "eta"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: 18 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    detail.logisticsRecords.forEach((r, idx) => {
      const row = ws.addRow(r);
      if (idx % 2 === 1) row.eachCell((cell) => {
        cell.style = ALT_ROW_FILL;
      });
    });
  }
  if (detail.customs) {
    const ws = wb.addWorksheet("\u62A5\u5173\u4FE1\u606F");
    ws.columns = [{ header: "\u5B57\u6BB5", key: "field", width: 25 }, { header: "\u503C", key: "value", width: 50 }];
    ws.getRow(1).eachCell((c2) => c2.style = HEADER_STYLE);
    const c = detail.customs;
    const customsData = [
      ["\u62A5\u5173\u5355\u53F7", c.declarationNo],
      ["\u72B6\u6001", c.status],
      ["\u8D38\u6613\u65B9\u5F0F", c.tradeMode],
      ["\u7533\u62A5\u65E5\u671F", c.declarationDate],
      ["\u653E\u884C\u65E5\u671F", c.releaseDate],
      ["\u5907\u6CE8", c.remark]
    ];
    customsData.forEach(([field, value], idx) => {
      const r = ws.addRow({ field, value: value || "\u2014" });
      if (idx % 2 === 0) r.eachCell((c2) => {
        c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    });
  }
  if (detail.productionPlan) {
    const ws = wb.addWorksheet("\u751F\u4EA7\u5B89\u6392");
    ws.columns = [{ header: "\u5B57\u6BB5", key: "field", width: 25 }, { header: "\u503C", key: "value", width: 50 }];
    ws.getRow(1).eachCell((c) => c.style = HEADER_STYLE);
    const p = detail.productionPlan;
    const prodData = [
      ["\u5408\u4F5C\u4F19\u4F34", p.partnerName],
      ["\u751F\u4EA7\u72B6\u6001", p.productionStatus],
      ["\u8D28\u68C0\u72B6\u6001", p.inspectionStatus],
      ["\u4E0B\u5355\u65E5\u671F", p.orderDate],
      ["\u9884\u8BA1\u4EA4\u4ED8", p.estimatedDeliveryDate],
      ["\u5907\u6CE8", p.remark]
    ];
    prodData.forEach(([field, value], idx) => {
      const r = ws.addRow({ field, value: value || "\u2014" });
      if (idx % 2 === 0) r.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    });
    if (p.logs?.length) {
      const logWs = wb.addWorksheet("\u751F\u4EA7\u65E5\u5FD7");
      const logCols = ["content", "logDate", "createdByName", "createdAt"];
      logWs.columns = logCols.map((c) => ({ header: c, key: c, width: 30 }));
      logCols.forEach((c, i) => logWs.getRow(1).getCell(i + 1).style = HEADER_STYLE);
      p.logs.forEach((log, idx) => {
        const row = logWs.addRow(log);
        if (idx % 2 === 1) row.eachCell((cell) => {
          cell.style = ALT_ROW_FILL;
        });
      });
    }
  }
  if (detail.packingRecords?.length) {
    const ws = wb.addWorksheet("\u88C5\u7BB1\u8BB0\u5F55");
    const cols = ["packageCount", "packageSize", "grossWeight", "netWeight"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: 18 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    detail.packingRecords.forEach((r, idx) => {
      const row = ws.addRow(r);
      if (idx % 2 === 1) row.eachCell((cell) => {
        cell.style = ALT_ROW_FILL;
      });
    });
  }
  const followups = await dbAll(
    `SELECT of.*, u.name AS created_by_name FROM order_follow_ups of LEFT JOIN users u ON u.id = of.created_by WHERE of.order_id = ? ORDER BY datetime(of.created_at) DESC`,
    [order.id]
  );
  if (followups.length) {
    const ws = wb.addWorksheet("\u8BA2\u5355\u8DDF\u8FDB");
    const cols = ["content", "created_by_name", "created_at"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: 40 }));
    cols.forEach((c, i) => ws.getRow(1).getCell(i + 1).style = HEADER_STYLE);
    followups.forEach((r, idx) => {
      const row = ws.addRow(r);
      if (idx % 2 === 1) row.eachCell((cell) => {
        cell.style = ALT_ROW_FILL;
      });
    });
  }
  return wb;
}

// server/services/export.ts
var LEGACY_EXPORTS = [
  {
    table: "customers",
    fileName: "customers.csv",
    query: `
      SELECT
        c.*,
        cu.name AS created_by_name,
        uu.name AS updated_by_name,
        COUNT(o.id) AS order_count
      FROM customers c
      LEFT JOIN users cu ON cu.id = c.created_by
      LEFT JOIN users uu ON uu.id = c.updated_by
      LEFT JOIN orders o ON o.customer_id = c.id AND o.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY c.id ASC
    `,
    extraColumns: ["created_by_name", "updated_by_name", "order_count"]
  },
  {
    table: "partners",
    fileName: "partners.csv",
    query: `
      SELECT
        p.*,
        cu.name AS created_by_name,
        uu.name AS updated_by_name
      FROM partners p
      LEFT JOIN users cu ON cu.id = p.created_by
      LEFT JOIN users uu ON uu.id = p.updated_by
      WHERE p.deleted_at IS NULL
      ORDER BY p.id ASC
    `,
    extraColumns: ["created_by_name", "updated_by_name"]
  },
  {
    table: "orders",
    fileName: "orders.csv",
    query: `
      SELECT
        o.*,
        c.name AS customer_name,
        c.country AS customer_country,
        cu.name AS created_by_name,
        uu.name AS updated_by_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN users cu ON cu.id = o.created_by
      LEFT JOIN users uu ON uu.id = o.updated_by
      WHERE o.deleted_at IS NULL
      ORDER BY o.id ASC
    `,
    extraColumns: ["customer_name", "customer_country", "created_by_name", "updated_by_name"]
  },
  {
    table: "order_items",
    fileName: "order_items.csv",
    query: `
      SELECT
        oi.*,
        o.display_id AS order_display_id,
        c.name AS customer_name
      FROM order_items oi
      LEFT JOIN orders o ON o.id = oi.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.deleted_at IS NULL
      ORDER BY oi.id ASC
    `,
    extraColumns: ["order_display_id", "customer_name"]
  },
  {
    table: "finance_records",
    fileName: "finance_records.csv",
    query: `
      SELECT
        f.*,
        o.display_id AS order_display_id,
        c.name AS customer_name,
        p.name AS partner_name,
        cu.name AS created_by_name,
        uu.name AS updated_by_name
      FROM finance_records f
      LEFT JOIN orders o ON o.id = f.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN partners p ON p.id = f.partner_id
      LEFT JOIN users cu ON cu.id = f.created_by
      LEFT JOIN users uu ON uu.id = f.updated_by
      WHERE f.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL)
      ORDER BY f.id ASC
    `,
    extraColumns: ["order_display_id", "customer_name", "partner_name", "created_by_name", "updated_by_name"]
  },
  {
    table: "logistics_records",
    fileName: "logistics_records.csv",
    query: `
      SELECT
        l.*,
        o.display_id AS order_display_id,
        c.name AS customer_name,
        cu.name AS created_by_name,
        uu.name AS updated_by_name
      FROM logistics_records l
      LEFT JOIN orders o ON o.id = l.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN users cu ON cu.id = l.created_by
      LEFT JOIN users uu ON uu.id = l.updated_by
      WHERE l.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL)
      ORDER BY l.id ASC
    `,
    extraColumns: ["order_display_id", "customer_name", "created_by_name", "updated_by_name"]
  },
  {
    table: "customs_records",
    fileName: "customs_records.csv",
    query: `
      SELECT
        cr.*,
        o.display_id AS order_display_id,
        c.name AS customer_name,
        cu.name AS created_by_name,
        uu.name AS updated_by_name
      FROM customs_records cr
      LEFT JOIN orders o ON o.id = cr.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN users cu ON cu.id = cr.created_by
      LEFT JOIN users uu ON uu.id = cr.updated_by
      WHERE o.deleted_at IS NULL
      ORDER BY cr.id ASC
    `,
    extraColumns: ["order_display_id", "customer_name", "created_by_name", "updated_by_name"]
  },
  {
    table: "production_plans",
    fileName: "production_plans.csv",
    query: `
      SELECT
        pp.*,
        o.display_id AS order_display_id,
        c.name AS customer_name,
        p.name AS partner_name,
        cu.name AS created_by_name,
        uu.name AS updated_by_name
      FROM production_plans pp
      LEFT JOIN orders o ON o.id = pp.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN partners p ON p.id = pp.partner_id
      LEFT JOIN users cu ON cu.id = pp.created_by
      LEFT JOIN users uu ON uu.id = pp.updated_by
      WHERE o.deleted_at IS NULL
      ORDER BY pp.id ASC
    `,
    extraColumns: ["order_display_id", "customer_name", "partner_name", "created_by_name", "updated_by_name"]
  },
  {
    table: "production_logs",
    fileName: "production_logs.csv",
    query: `
      SELECT
        pl.*,
        pp.order_id AS order_id,
        o.display_id AS order_display_id,
        c.name AS customer_name,
        cu.name AS created_by_name
      FROM production_logs pl
      LEFT JOIN production_plans pp ON pp.id = pl.plan_id
      LEFT JOIN orders o ON o.id = pp.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN users cu ON cu.id = pl.created_by
      WHERE o.deleted_at IS NULL
      ORDER BY pl.id ASC
    `,
    extraColumns: ["order_id", "order_display_id", "customer_name", "created_by_name"]
  },
  {
    table: "attachments",
    fileName: "attachments.csv",
    query: `
      SELECT
        a.*,
        o.display_id AS order_display_id,
        c.name AS customer_name
      FROM attachments a
      LEFT JOIN finance_records f ON a.entity_type = 'finance' AND a.entity_id = f.id
      LEFT JOIN logistics_records l ON a.entity_type = 'logistics' AND a.entity_id = l.id
      LEFT JOIN customs_records cr ON a.entity_type = 'customs' AND a.entity_id = cr.id
      LEFT JOIN production_logs pl ON a.entity_type = 'production_log' AND a.entity_id = pl.id
      LEFT JOIN production_plans pp ON pl.plan_id = pp.id
      LEFT JOIN packing_records pr ON a.id = pr.attachment_id
      LEFT JOIN orders o ON o.id = COALESCE(f.order_id, l.order_id, cr.order_id, pp.order_id, pr.order_id)
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id IS NULL OR o.deleted_at IS NULL
      ORDER BY a.id ASC
    `,
    extraColumns: ["order_display_id", "customer_name"]
  },
  {
    table: "order_items",
    fileName: "order_items.csv",
    query: `SELECT oi.*, o.display_id AS order_display_id FROM order_items oi LEFT JOIN orders o ON o.id = oi.order_id WHERE o.deleted_at IS NULL ORDER BY oi.id ASC`,
    extraColumns: ["order_display_id"]
  },
  {
    table: "packing_records",
    fileName: "packing_records.csv",
    query: `SELECT pr.*, o.display_id AS order_display_id FROM packing_records pr LEFT JOIN orders o ON o.id = pr.order_id WHERE o.deleted_at IS NULL ORDER BY pr.id ASC`,
    extraColumns: ["order_display_id"]
  },
  {
    table: "tasks",
    fileName: "tasks.csv",
    query: `SELECT t.*, u.name AS assignee_name, cu.name AS created_by_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id LEFT JOIN users cu ON cu.id = t.created_by ORDER BY t.id ASC`,
    extraColumns: ["assignee_name", "created_by_name"]
  },
  {
    table: "customer_contacts",
    fileName: "customer_contacts.csv",
    query: `SELECT cc.*, c.name AS customer_name FROM customer_contacts cc LEFT JOIN customers c ON c.id = cc.customer_id WHERE c.deleted_at IS NULL ORDER BY cc.id ASC`,
    extraColumns: ["customer_name"]
  },
  {
    table: "customer_followups",
    fileName: "customer_followups.csv",
    query: `SELECT cf.*, c.name AS customer_name, u.name AS created_by_name FROM customer_followups cf LEFT JOIN customers c ON c.id = cf.customer_id LEFT JOIN users u ON u.id = cf.created_by WHERE c.deleted_at IS NULL ORDER BY cf.id ASC`,
    extraColumns: ["customer_name", "created_by_name"]
  },
  {
    table: "order_follow_ups",
    fileName: "order_followups.csv",
    query: `SELECT ofu.*, o.display_id AS order_display_id, u.name AS created_by_name FROM order_follow_ups ofu LEFT JOIN orders o ON o.id = ofu.order_id LEFT JOIN users u ON u.id = ofu.created_by WHERE o.deleted_at IS NULL ORDER BY ofu.id ASC`,
    extraColumns: ["order_display_id", "created_by_name"]
  }
];
var ATTACHMENT_MANIFEST_HEADERS = ["attachmentId", "sourceModule", "sourceRecordId", "originalFileName", "exportedFileName", "mimeType", "fileSize", "createdAt", "missing"];
var UNLINKED_HEADERS = ["attachmentId", "entityType", "entityId", "originalFileName", "storedName", "mimeType", "fileSize", "createdAt", "missing"];
function escapeCsvValue(value) {
  if (value === null || value === void 0) {
    return "";
  }
  let text = String(value);
  if (/^[=\-+@]/.test(text)) {
    text = `	${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
function buildCsvBufferFromRows(headers, rows) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(","))
  ];
  return Buffer3.from(`\uFEFF${lines.join("\r\n")}\r
`, "utf8");
}
function sanitizeArchiveSegment(value, fallback) {
  const cleaned = String(value || "").trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, "_").replace(/^\.+/, "").replace(/[. ]+$/, "");
  return cleaned || fallback;
}
function sanitizeArchiveFileName(value, fallback) {
  return sanitizeArchiveSegment(value, fallback);
}
function uniqueFileName(preferredName, usedNames) {
  if (!usedNames.has(preferredName)) {
    usedNames.add(preferredName);
    return preferredName;
  }
  const dotIndex = preferredName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? preferredName.slice(0, dotIndex) : preferredName;
  const extension = dotIndex > 0 ? preferredName.slice(dotIndex) : "";
  let counter = 2;
  while (true) {
    const candidate = `${baseName} (${counter})${extension}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    counter += 1;
  }
}
async function resolveExistingAttachmentPath(filePath) {
  const absolutePath = resolveAttachmentAbsolutePath(filePath);
  if (!absolutePath) {
    return null;
  }
  try {
    await fs8.access(absolutePath);
    return absolutePath;
  } catch {
    return null;
  }
}
async function getTableColumns(table) {
  const rows = await dbTableInfo(table);
  return rows.map((row) => row.name);
}
async function buildLegacyCsvBuffer(definition) {
  const [columns, rows] = await Promise.all([
    getTableColumns(definition.table),
    dbAll(definition.query)
  ]);
  const headers = [...columns, ...definition.extraColumns || []];
  return buildCsvBufferFromRows(headers, rows);
}
async function buildLegacyExportZip() {
  const entries = await Promise.all(
    LEGACY_EXPORTS.map(async (definition) => ({
      name: definition.fileName,
      data: await buildLegacyCsvBuffer(definition)
    }))
  );
  return createZipBuffer(entries);
}
async function getCustomersForArchive() {
  return dbAll(`
    SELECT
      c.*,
      COUNT(o.id) AS order_count
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.deleted_at IS NULL
    WHERE c.deleted_at IS NULL
    GROUP BY c.id
    ORDER BY c.id ASC
  `);
}
async function getOrdersForCustomers(customerIds) {
  if (!customerIds.length) return [];
  const placeholders = customerIds.map(() => "?").join(", ");
  return dbAll(
    `SELECT * FROM orders WHERE customer_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY customer_id ASC, datetime(created_at) ASC, id ASC`,
    customerIds
  );
}
async function getOrderAttachments(orderId) {
  const [finance, logistics, customs, production, packing, orderDocuments, productionPhotos] = await Promise.all([
    dbAll(`
      SELECT
        a.id AS attachmentId,
        'finance' AS sourceModule,
        f.id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM attachments a
      INNER JOIN finance_records f ON a.entity_type = 'finance' AND a.entity_id = f.id
      WHERE f.order_id = ? AND f.deleted_at IS NULL
      ORDER BY a.id ASC
    `, [orderId]),
    dbAll(`
      SELECT
        a.id AS attachmentId,
        'logistics' AS sourceModule,
        l.id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM attachments a
      INNER JOIN logistics_records l ON a.entity_type = 'logistics' AND a.entity_id = l.id
      WHERE l.order_id = ? AND l.deleted_at IS NULL
      ORDER BY a.id ASC
    `, [orderId]),
    dbAll(`
      SELECT
        a.id AS attachmentId,
        'customs' AS sourceModule,
        c.id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM attachments a
      INNER JOIN customs_records c ON a.entity_type = 'customs' AND a.entity_id = c.id
      WHERE c.order_id = ?
      ORDER BY a.id ASC
    `, [orderId]),
    dbAll(`
      SELECT
        a.id AS attachmentId,
        'production' AS sourceModule,
        pl.id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM attachments a
      INNER JOIN production_logs pl ON a.entity_type = 'production_log' AND a.entity_id = pl.id
      INNER JOIN production_plans pp ON pp.id = pl.plan_id
      WHERE pp.order_id = ?
      ORDER BY a.id ASC
    `, [orderId]),
    dbAll(`
      SELECT
        a.id AS attachmentId,
        'packing' AS sourceModule,
        pr.id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM packing_records pr
      INNER JOIN attachments a ON a.id = pr.attachment_id
      WHERE pr.order_id = ?
      ORDER BY a.id ASC
    `, [orderId]),
    dbAll(`
      SELECT
        a.id AS attachmentId,
        'order_document' AS sourceModule,
        a.entity_id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM attachments a
      WHERE a.entity_type = 'order_document' AND a.entity_id = ?
      ORDER BY a.id ASC
    `, [orderId]),
    dbAll(`
      SELECT
        a.id AS attachmentId,
        'production_photo' AS sourceModule,
        a.entity_id AS sourceRecordId,
        a.file_name AS originalFileName,
        a.stored_name AS storedName,
        a.mime_type AS mimeType,
        a.file_size AS fileSize,
        a.file_path AS filePath,
        a.created_at AS createdAt
      FROM attachments a
      WHERE a.entity_type = 'production_photo' AND a.entity_id = ?
      ORDER BY a.id ASC
    `, [orderId])
  ]);
  return [...finance, ...logistics, ...customs, ...production, ...packing, ...orderDocuments, ...productionPhotos];
}
async function getUnlinkedAttachments() {
  return dbAll(`
    SELECT DISTINCT
      a.id AS attachmentId,
      COALESCE(a.entity_type, 'unlinked') AS sourceModule,
      a.entity_id AS sourceRecordId,
      a.file_name AS originalFileName,
      a.stored_name AS storedName,
      a.mime_type AS mimeType,
      a.file_size AS fileSize,
      a.file_path AS filePath,
      a.created_at AS createdAt,
      a.entity_type AS entityType,
      a.entity_id AS entityId
    FROM attachments a
    LEFT JOIN finance_records f ON a.entity_type = 'finance' AND a.entity_id = f.id
    LEFT JOIN logistics_records l ON a.entity_type = 'logistics' AND a.entity_id = l.id
    LEFT JOIN customs_records c ON a.entity_type = 'customs' AND a.entity_id = c.id
    LEFT JOIN production_logs pl ON a.entity_type = 'production_log' AND a.entity_id = pl.id
    LEFT JOIN production_plans pp ON pp.id = pl.plan_id
    LEFT JOIN packing_records pr ON pr.attachment_id = a.id
    WHERE COALESCE(f.order_id, l.order_id, c.order_id, pp.order_id, pr.order_id) IS NULL
    ORDER BY a.id ASC
  `);
}
async function buildOrderDetails(orderIds) {
  if (!orderIds.length) return /* @__PURE__ */ new Map();
  const ph = orderIds.map(() => "?").join(", ");
  const [orderRows, itemRows, financeRows, logisticsRows, packingRows, customsRows, planRows, summaryRows, pendingCountRows] = await Promise.all([
    dbAll(
      `SELECT o.*, c.name AS customer_name, c.display_id AS customer_display_id, c.country AS customer_country, c.contact AS customer_contact, c.logistics_preference AS customer_logistics_preference, c.payment_terms AS customer_payment_terms, cu.name AS created_by_name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id LEFT JOIN users cu ON cu.id = o.created_by WHERE o.id IN (${ph}) AND o.deleted_at IS NULL`,
      orderIds
    ),
    dbAll(
      `SELECT * FROM order_items WHERE order_id IN (${ph}) ORDER BY order_id ASC, id ASC`,
      orderIds
    ),
    dbAll(
      `SELECT f.*, p.name AS partner_name, p.partner_type AS partner_type, u.name AS created_by_name FROM finance_records f LEFT JOIN partners p ON p.id = f.partner_id LEFT JOIN users u ON u.id = f.created_by WHERE f.order_id IN (${ph}) AND f.deleted_at IS NULL ORDER BY f.order_id ASC, datetime(f.created_at) DESC, f.id DESC`,
      orderIds
    ),
    dbAll(
      `SELECT l.*, u.name AS created_by_name FROM logistics_records l LEFT JOIN users u ON u.id = l.created_by WHERE l.order_id IN (${ph}) AND l.deleted_at IS NULL ORDER BY l.order_id ASC, CASE WHEN segment_type = 'domestic' THEN 0 ELSE 1 END ASC, CASE WHEN shipping_date IS NULL OR shipping_date = '' THEN 1 ELSE 0 END ASC, l.shipping_date DESC, datetime(l.created_at) DESC, l.id DESC`,
      orderIds
    ),
    dbAll(
      `SELECT pr.*, a.stored_name, a.file_path FROM packing_records pr LEFT JOIN attachments a ON a.id = pr.attachment_id WHERE pr.order_id IN (${ph}) ORDER BY pr.order_id ASC, pr.id ASC`,
      orderIds
    ),
    dbAll(
      `SELECT c.*, u.name AS created_by_name FROM customs_records c LEFT JOIN users u ON u.id = c.created_by WHERE c.order_id IN (${ph})`,
      orderIds
    ),
    dbAll(
      `SELECT pp.*, p.name AS partner_name, p.partner_type AS partner_type, p.country AS partner_country, p.contact AS partner_contact, u.name AS created_by_name FROM production_plans pp LEFT JOIN partners p ON p.id = pp.partner_id LEFT JOIN users u ON u.id = pp.created_by WHERE pp.order_id IN (${ph})`,
      orderIds
    ),
    dbAll(
      `SELECT order_id, type, currency, payment_category, COALESCE(SUM(amount), 0) AS total FROM finance_records WHERE order_id IN (${ph}) AND status = 'completed' AND deleted_at IS NULL GROUP BY order_id, type, currency, payment_category`,
      orderIds
    ),
    dbAll(
      `SELECT order_id, COUNT(*) AS count FROM finance_records WHERE order_id IN (${ph}) AND status = 'pending' AND deleted_at IS NULL GROUP BY order_id`,
      orderIds
    )
  ]);
  if (!orderRows.length) return /* @__PURE__ */ new Map();
  const planIds = planRows.map((r) => Number(r.id)).filter((id) => id > 0);
  let logRows = [];
  if (planIds.length) {
    const planPh = planIds.map(() => "?").join(", ");
    logRows = await dbAll(
      `SELECT pl.*, u.name AS created_by_name FROM production_logs pl LEFT JOIN users u ON u.id = pl.created_by WHERE pl.plan_id IN (${planPh}) ORDER BY pl.plan_id ASC, datetime(pl.created_at) DESC`,
      planIds
    );
  }
  const itemsByOrder = /* @__PURE__ */ new Map();
  for (const row of itemRows) {
    const oid = Number(row.order_id);
    if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, []);
    itemsByOrder.get(oid).push(row);
  }
  const financeByOrder = /* @__PURE__ */ new Map();
  for (const row of financeRows) {
    const oid = Number(row.order_id);
    if (!financeByOrder.has(oid)) financeByOrder.set(oid, []);
    financeByOrder.get(oid).push(row);
  }
  const logisticsByOrder = /* @__PURE__ */ new Map();
  for (const row of logisticsRows) {
    const oid = Number(row.order_id);
    if (!logisticsByOrder.has(oid)) logisticsByOrder.set(oid, []);
    logisticsByOrder.get(oid).push(row);
  }
  const packingByOrder = /* @__PURE__ */ new Map();
  for (const row of packingRows) {
    const oid = Number(row.order_id);
    if (!packingByOrder.has(oid)) packingByOrder.set(oid, []);
    packingByOrder.get(oid).push(row);
  }
  const customsByOrder = /* @__PURE__ */ new Map();
  for (const row of customsRows) {
    customsByOrder.set(Number(row.order_id), row);
  }
  const planByOrder = /* @__PURE__ */ new Map();
  for (const row of planRows) {
    planByOrder.set(Number(row.order_id), row);
  }
  const logsByPlanId = /* @__PURE__ */ new Map();
  for (const row of logRows) {
    const pid = Number(row.plan_id);
    if (!logsByPlanId.has(pid)) logsByPlanId.set(pid, []);
    logsByPlanId.get(pid).push(row);
  }
  const summaryByOrder = /* @__PURE__ */ new Map();
  for (const row of summaryRows) {
    const oid = Number(row.order_id);
    if (!summaryByOrder.has(oid)) summaryByOrder.set(oid, []);
    summaryByOrder.get(oid).push(row);
  }
  const pendingCountByOrder = /* @__PURE__ */ new Map();
  for (const row of pendingCountRows) {
    pendingCountByOrder.set(Number(row.order_id), Number(row.count));
  }
  const allFinanceIds = [];
  financeByOrder.forEach((records) => {
    for (const r of records) allFinanceIds.push(Number(r.id));
  });
  const allLogisticsIds = [];
  logisticsByOrder.forEach((records) => {
    for (const r of records) allLogisticsIds.push(Number(r.id));
  });
  const allCustomsIds = [];
  customsByOrder.forEach((r) => allCustomsIds.push(Number(r.id)));
  const allLogIds = logRows.map((r) => Number(r.id));
  async function getAttachmentCountMap(entityType, entityIds) {
    if (!entityIds.length) return /* @__PURE__ */ new Map();
    const eph = entityIds.map(() => "?").join(", ");
    const rows = await dbAll(
      `SELECT entity_id, COUNT(*) AS count FROM attachments WHERE entity_type = ? AND entity_id IN (${eph}) GROUP BY entity_id`,
      [entityType, ...entityIds]
    );
    const m = /* @__PURE__ */ new Map();
    for (const row of rows) {
      m.set(Number(row.entity_id), Number(row.count));
    }
    return m;
  }
  const [financeAttachmentCounts, logisticsAttachmentCounts, customsAttachmentCounts] = await Promise.all([
    getAttachmentCountMap("finance", allFinanceIds),
    getAttachmentCountMap("logistics", allLogisticsIds),
    getAttachmentCountMap("customs", allCustomsIds)
  ]);
  function normalizeStatus(s) {
    if (s === "confirmed") return "production";
    if (s === "shipped") return "shipping";
    return s;
  }
  const result = /* @__PURE__ */ new Map();
  for (const order of orderRows) {
    const orderId = Number(order.id);
    const orderItems = itemsByOrder.get(orderId) || [];
    const orderFinanceRecords = financeByOrder.get(orderId) || [];
    const orderLogisticsRecords = logisticsByOrder.get(orderId) || [];
    const orderPackingRecords = packingByOrder.get(orderId) || [];
    const customsRow = customsByOrder.get(orderId) || null;
    const planRow = planByOrder.get(orderId) || null;
    const orderSummaryData = summaryByOrder.get(orderId) || [];
    const pendingCount = pendingCountByOrder.get(orderId) || 0;
    const receiptsByCurrency = {};
    const paymentsByCurrency = {};
    const freightByCurrency = {};
    for (const row of orderSummaryData) {
      const cur = String(row.currency || "USD");
      if (row.type === "receipt") {
        receiptsByCurrency[cur] = (receiptsByCurrency[cur] || 0) + Number(row.total);
      } else {
        paymentsByCurrency[cur] = (paymentsByCurrency[cur] || 0) + Number(row.total);
        if (String(row.payment_category) === "freight") {
          freightByCurrency[cur] = (freightByCurrency[cur] || 0) + Number(row.total);
        }
      }
    }
    const orderAmount = Number(order.total_amount) || 0;
    const receiptTotal = receiptsByCurrency.USD || 0;
    let paymentStatus;
    if (receiptTotal <= 0) {
      paymentStatus = "unpaid";
    } else if (receiptTotal >= orderAmount && orderAmount > 0) {
      paymentStatus = "paid";
    } else {
      paymentStatus = "partial";
    }
    const outstandingAmount = Math.max(orderAmount - receiptTotal, 0);
    const settled = outstandingAmount <= 0 && orderAmount > 0;
    const getTimelineValue2 = (rec) => {
      const rawValue = String(rec.shipping_date || rec.created_at || "");
      return rawValue ? new Date(rawValue).getTime() : 0;
    };
    const sortedLogistics = [...orderLogisticsRecords].sort((left, right) => getTimelineValue2(right) - getTimelineValue2(left));
    const domesticLogisticsRecord = orderLogisticsRecords.find((item) => item.segment_type === "domestic") || null;
    const internationalLogisticsRecord = orderLogisticsRecords.find((item) => item.segment_type !== "domestic") || null;
    const latestLogistics = sortedLogistics[0] || internationalLogisticsRecord || domesticLogisticsRecord || null;
    let productionLogs = [];
    if (planRow) {
      productionLogs = logsByPlanId.get(Number(planRow.id)) || [];
    }
    let financeAttachmentTotal = 0;
    for (const rec of orderFinanceRecords) {
      financeAttachmentTotal += financeAttachmentCounts.get(Number(rec.id)) || 0;
    }
    let logisticsAttachmentTotal = 0;
    for (const rec of orderLogisticsRecords) {
      logisticsAttachmentTotal += logisticsAttachmentCounts.get(Number(rec.id)) || 0;
    }
    const customsAttachmentCount = customsRow ? customsAttachmentCounts.get(Number(customsRow.id)) || 0 : 0;
    result.set(orderId, {
      order: {
        ...order,
        status: normalizeStatus(String(order.status || "draft")),
        deliveryDate: order.delivery_date || null,
        freightAmount: Number(order.freight_amount) || 0,
        miscAmount: Number(order.misc_amount) || 0,
        createdByName: order.created_by_name || null
      },
      customer: {
        id: order.customer_id,
        display_id: order.customer_display_id,
        name: order.customer_name,
        country: order.customer_country,
        contact: order.customer_contact,
        logisticsPreference: order.customer_logistics_preference,
        paymentTerms: order.customer_payment_terms
      },
      items: orderItems.map((item) => ({
        ...item,
        hsCode: item.hs_code || null,
        imageUrl: item.image_url || null
      })),
      financeRecords: orderFinanceRecords.map((record) => ({
        ...record,
        recordCategory: record.record_category || record.payment_category || (record.type === "receipt" ? "deposit" : "other"),
        partnerId: record.partner_id || null,
        partnerName: record.partner_name || null,
        createdAt: record.created_at,
        createdByName: record.created_by_name || null,
        attachmentCount: financeAttachmentCounts.get(Number(record.id)) || 0
      })),
      logisticsRecords: orderLogisticsRecords.map((record) => ({
        ...record,
        segmentType: record.segment_type || "international",
        freightForwarder: record.freight_forwarder || null,
        trackingNo: record.tracking_no,
        packingDetails: record.packing_details,
        shippingDate: record.shipping_date,
        packageCount: record.package_count,
        volumeCbm: record.volume_cbm,
        grossWeightKg: record.gross_weight_kg,
        transportMode: record.transport_mode,
        vesselVoyage: record.vessel_voyage,
        billNo: record.bill_no,
        etd: record.etd,
        eta: record.eta,
        recipientAddress: record.recipient_address,
        packageSize: record.package_size,
        remark: record.remark,
        createdAt: record.created_at,
        createdByName: record.created_by_name || null,
        attachmentCount: logisticsAttachmentCounts.get(Number(record.id)) || 0
      })),
      packingRecords: orderPackingRecords.map((record) => {
        const storedNameVal = String(record.stored_name || "").trim();
        const displayName = storedNameVal || String(record.file_path || "").replace(/\\/g, "/").split("/").filter(Boolean).pop() || "";
        return {
          id: record.id,
          packageCount: String(record.package_count || ""),
          packageSize: String(record.package_size || ""),
          grossWeight: String(record.gross_weight || ""),
          netWeight: String(record.net_weight || ""),
          attachmentId: record.attachment_id,
          imageUrl: record.attachment_id && displayName ? `/api/files/${Number(record.attachment_id)}/${encodeURIComponent(displayName)}` : null
        };
      }),
      customs: customsRow ? {
        ...customsRow,
        brokerName: customsRow.broker_name,
        declarationNo: customsRow.declaration_no,
        declarationDate: customsRow.declaration_date,
        releaseDate: customsRow.release_date,
        tradeMode: customsRow.trade_mode,
        createdAt: customsRow.created_at,
        updatedAt: customsRow.updated_at,
        createdByName: customsRow.created_by_name || null,
        attachmentCount: customsAttachmentCount
      } : null,
      productionPlan: planRow ? {
        ...planRow,
        partnerId: planRow.partner_id,
        partnerName: planRow.partner_name,
        partnerType: planRow.partner_type,
        partnerCountry: planRow.partner_country,
        partnerContact: planRow.partner_contact,
        orderDate: planRow.order_date,
        estimatedDeliveryDate: planRow.estimated_delivery_date,
        productionStatus: planRow.production_status,
        inspectionStatus: planRow.inspection_status,
        updatedAt: planRow.updated_at,
        createdByName: planRow.created_by_name || null,
        logs: productionLogs.map((l) => ({
          ...l,
          logDate: l.log_date,
          createdByName: l.created_by_name
        }))
      } : null,
      summary: {
        receiptsByCurrency,
        paymentsByCurrency,
        freightByCurrency,
        pendingFinanceCount: pendingCount || 0,
        latestLogisticsStatus: latestLogistics?.status || null,
        latestShippingDate: latestLogistics?.shipping_date || null,
        paidAmount: receiptsByCurrency.USD || 0,
        outstandingAmount,
        paymentStatus,
        settled,
        attachmentsSummary: {
          finance: financeAttachmentTotal,
          logistics: logisticsAttachmentTotal,
          customs: customsAttachmentCount
        }
      }
    });
  }
  return result;
}
async function buildCustomerArchive(writer) {
  const customers = await getCustomersForArchive();
  const customerIds = customers.map((c) => Number(c.id));
  const allOrders = await getOrdersForCustomers(customerIds);
  const ordersByCustomer = /* @__PURE__ */ new Map();
  for (const order of allOrders) {
    const cid = Number(order.customer_id);
    if (!ordersByCustomer.has(cid)) ordersByCustomer.set(cid, []);
    ordersByCustomer.get(cid).push(order);
  }
  const allOrderIds = allOrders.map((o) => Number(o.id));
  const orderDetailsMap = await buildOrderDetails(allOrderIds);
  for (const customer of customers) {
    const orders = ordersByCustomer.get(Number(customer.id)) || [];
    const customerDirName = `customers/${sanitizeArchiveSegment(customer.name, "customer")}_${customer.id}`;
    const customerXlsx = await buildCustomerXlsx(customer, orders, orderDetailsMap);
    await writer.addBuffer(`${customerDirName}/\u5BA2\u6237\u4FE1\u606F.xlsx`, await customerXlsx.xlsx.writeBuffer());
    for (const order of orders) {
      const detail = orderDetailsMap.get(Number(order.id));
      if (!detail) {
        continue;
      }
      const exportDetail = detail;
      const orderDirName = `${customerDirName}/orders/${sanitizeArchiveSegment(order.display_id, "order")}_${order.id}`;
      const orderXlsx = await buildOrderXlsx(exportDetail);
      await writer.addBuffer(`${orderDirName}/\u8BA2\u5355\u8BE6\u60C5.xlsx`, await orderXlsx.xlsx.writeBuffer());
      const attachmentRows = await getOrderAttachments(Number(order.id));
      const manifestRows = [];
      const folderNameUsage = /* @__PURE__ */ new Map();
      for (const attachment of attachmentRows) {
        const attachmentDir = `${orderDirName}/attachments/${attachment.sourceModule}`;
        if (!folderNameUsage.has(attachmentDir)) {
          folderNameUsage.set(attachmentDir, /* @__PURE__ */ new Set());
        }
        const preferredName = sanitizeArchiveFileName(attachment.originalFileName || attachment.storedName, `attachment_${attachment.attachmentId}`);
        const exportedFileName = uniqueFileName(preferredName, folderNameUsage.get(attachmentDir));
        const absolutePath = await resolveExistingAttachmentPath(attachment.filePath);
        const missing = !absolutePath;
        manifestRows.push({
          attachmentId: attachment.attachmentId,
          sourceModule: attachment.sourceModule,
          sourceRecordId: attachment.sourceRecordId || "",
          originalFileName: attachment.originalFileName,
          exportedFileName,
          mimeType: attachment.mimeType || "",
          fileSize: attachment.fileSize || "",
          createdAt: attachment.createdAt || "",
          missing: missing ? "true" : "false"
        });
        if (!missing) {
          await writer.addFile(`${attachmentDir}/${exportedFileName}`, absolutePath);
        }
      }
      await writer.addBuffer(
        `${orderDirName}/attachments_manifest.csv`,
        buildCsvBufferFromRows(ATTACHMENT_MANIFEST_HEADERS, manifestRows)
      );
    }
  }
  const unlinkedAttachments = await getUnlinkedAttachments();
  const unlinkedDir = "_unlinked_attachments";
  const usedFileNames = /* @__PURE__ */ new Set();
  const unlinkedRows = [];
  for (const attachment of unlinkedAttachments) {
    const preferredName = sanitizeArchiveFileName(attachment.originalFileName || attachment.storedName, `attachment_${attachment.attachmentId}`);
    const exportedFileName = uniqueFileName(preferredName, usedFileNames);
    const absolutePath = await resolveExistingAttachmentPath(attachment.filePath);
    const missing = !absolutePath;
    unlinkedRows.push({
      attachmentId: attachment.attachmentId,
      entityType: attachment.entityType || attachment.sourceModule || "",
      entityId: attachment.entityId || attachment.sourceRecordId || "",
      originalFileName: attachment.originalFileName,
      storedName: attachment.storedName,
      mimeType: attachment.mimeType || "",
      fileSize: attachment.fileSize || "",
      createdAt: attachment.createdAt || "",
      missing: missing ? "true" : "false"
    });
    if (!missing) {
      await writer.addFile(`${unlinkedDir}/${exportedFileName}`, absolutePath);
    }
  }
  if (unlinkedRows.length > 0) {
    await writer.addBuffer(
      `${unlinkedDir}/unlinked_attachments.csv`,
      buildCsvBufferFromRows(UNLINKED_HEADERS, unlinkedRows)
    );
  }
}
async function streamCustomerArchiveZip(res) {
  const writer = new ZipStreamWriter(res);
  await buildCustomerArchive(writer);
  await writer.finalize();
}
function getExportFileName(format = "customer-archive", now = /* @__PURE__ */ new Date()) {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const time = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
  if (format === "zip-csv") {
    return `crm-export-${date}-${time}.zip`;
  }
  return `crm-customer-archive-${date}-${time}.zip`;
}

// server/routes/settings.ts
var BRAND_DIR = path8.join(PROJECT_ROOT, "data", "brand");
var DEFAULT_SYSTEM_UPDATE_STATUS_PATH = path8.join(PROJECT_ROOT, "data", "system-update-status.json");
var MAX_UPDATE_HISTORY_ITEMS = 10;
var MAX_UPDATE_LOG_LINES = 120;
var createIdleUpdateStatus = () => ({
  id: "",
  phase: "idle",
  steps: [],
  logs: [],
  currentStep: "",
  error: "",
  startedAt: "",
  finishedAt: ""
});
var systemUpdateStatus = createIdleUpdateStatus();
var systemUpdateHistory = [];
var commandRunner = runCommand;
var restartScheduler = scheduleRestart;
var systemUpdateStatusPath = DEFAULT_SYSTEM_UPDATE_STATUS_PATH;
var systemUpdateStatusLoaded = false;
function isSystemUpdateRunning() {
  return systemUpdateStatus.phase === "running" || systemUpdateStatus.phase === "restarting";
}
async function persistSystemUpdateStatus() {
  await fs9.mkdir(path8.dirname(systemUpdateStatusPath), { recursive: true });
  const envelope = {
    current: systemUpdateStatus,
    history: systemUpdateHistory
  };
  await fs9.writeFile(systemUpdateStatusPath, JSON.stringify(envelope, null, 2), "utf8");
}
function appendUpdateLog(lines) {
  if (!lines.length) return;
  systemUpdateStatus.logs.push(...lines);
  if (systemUpdateStatus.logs.length > MAX_UPDATE_LOG_LINES) {
    systemUpdateStatus.logs = systemUpdateStatus.logs.slice(-MAX_UPDATE_LOG_LINES);
  }
}
function normalizeLoadedUpdateStatus(status) {
  const normalizedLogs = Array.isArray(status.logs) ? status.logs : [];
  if (status.phase === "restarting") {
    return {
      ...status,
      logs: normalizedLogs,
      phase: "completed",
      currentStep: "\u4E0A\u6B21\u66F4\u65B0\u5DF2\u5B8C\u6210\uFF0C\u670D\u52A1\u5DF2\u91CD\u65B0\u542F\u52A8",
      steps: [...status.steps, "\u4E0A\u6B21\u66F4\u65B0\u5DF2\u5B8C\u6210\uFF0C\u670D\u52A1\u5DF2\u91CD\u65B0\u542F\u52A8"]
    };
  }
  if (status.phase === "running") {
    return {
      ...status,
      logs: normalizedLogs,
      phase: "failed",
      error: status.error || "\u66F4\u65B0\u4EFB\u52A1\u5728\u670D\u52A1\u91CD\u542F\u524D\u4E2D\u65AD\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77",
      finishedAt: status.finishedAt || (/* @__PURE__ */ new Date()).toISOString(),
      currentStep: "\u68C0\u6D4B\u5230\u672A\u5B8C\u6210\u7684\u66F4\u65B0\u4EFB\u52A1\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77",
      steps: [...status.steps, "\u68C0\u6D4B\u5230\u672A\u5B8C\u6210\u7684\u66F4\u65B0\u4EFB\u52A1\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77"]
    };
  }
  return { ...status, logs: normalizedLogs };
}
function archiveUpdateStatus(status) {
  if (!status.id || status.phase === "idle") return;
  const archived = normalizeLoadedUpdateStatus(status);
  systemUpdateHistory = [
    archived,
    ...systemUpdateHistory.filter((entry) => entry.id !== archived.id)
  ].slice(0, MAX_UPDATE_HISTORY_ITEMS);
}
function normalizeLoadedEnvelope(data) {
  if (data && typeof data === "object" && "current" in data) {
    const envelope = data;
    const current = normalizeLoadedUpdateStatus(envelope.current ?? createIdleUpdateStatus());
    const history = Array.isArray(envelope.history) ? envelope.history.map((entry) => normalizeLoadedUpdateStatus(entry)) : [];
    return { current, history };
  }
  const legacyStatus = normalizeLoadedUpdateStatus(data ?? createIdleUpdateStatus());
  return {
    current: legacyStatus,
    history: legacyStatus.id && legacyStatus.phase !== "idle" ? [legacyStatus] : []
  };
}
async function ensureSystemUpdateStatusLoaded() {
  if (systemUpdateStatusLoaded) return;
  systemUpdateStatusLoaded = true;
  try {
    const raw = await fs9.readFile(systemUpdateStatusPath, "utf8");
    const parsed = JSON.parse(raw);
    const envelope = normalizeLoadedEnvelope(parsed);
    systemUpdateStatus = envelope.current;
    systemUpdateHistory = envelope.history;
  } catch {
    systemUpdateStatus = createIdleUpdateStatus();
    systemUpdateHistory = [];
  }
}
async function pushUpdateStep(step) {
  systemUpdateStatus.steps.push(step);
  systemUpdateStatus.currentStep = step;
  await persistSystemUpdateStatus();
}
function scheduleRestart() {
  setTimeout(() => process.exit(0), 1e3);
}
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: "pipe"
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(compactCommandOutput(stdout, stderr));
        return;
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code ?? "unknown"}`));
    });
  });
}
function compactCommandOutput(stdout, stderr) {
  const lines = `${stdout}
${stderr}`.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.slice(-20);
}
async function runSystemUpdateJob() {
  systemUpdateStatus = {
    id: `update-${Date.now()}`,
    phase: "running",
    steps: [],
    logs: [],
    currentStep: "\u51C6\u5907\u5F00\u59CB\u7CFB\u7EDF\u66F4\u65B0",
    error: "",
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    finishedAt: ""
  };
  await persistSystemUpdateStatus();
  const backupDir = path8.join(PROJECT_ROOT, `dist_backup_${Date.now()}`);
  const distDir = path8.join(PROJECT_ROOT, "dist");
  const commands = [
    { step: "\u6B63\u5728\u62C9\u53D6\u6700\u65B0\u4EE3\u7801...", command: "git", args: ["pull", "origin", "main"] },
    { step: "\u6B63\u5728\u5B89\u88C5\u4F9D\u8D56...", command: "npm", args: ["install"] },
    { step: "\u6B63\u5728\u6784\u5EFA\u524D\u7AEF...", command: "npm", args: ["run", "build"], isBuild: true }
  ];
  try {
    for (const item of commands) {
      if (item.isBuild) {
        try {
          await fs9.rename(distDir, backupDir);
        } catch (e) {
        }
      }
      await pushUpdateStep(item.step);
      appendUpdateLog([`$ ${item.command} ${item.args.join(" ")}`]);
      await persistSystemUpdateStatus();
      try {
        const output = await commandRunner(item.command, item.args);
        appendUpdateLog(Array.isArray(output) ? output : []);
        if (item.isBuild) {
          try {
            await fs9.rm(backupDir, { recursive: true, force: true });
          } catch (e) {
          }
        }
      } catch (err) {
        if (item.isBuild) {
          appendUpdateLog(["\u6784\u5EFA\u5931\u8D25\uFF0C\u6B63\u5728\u4ECE\u5907\u4EFD\u56DE\u6EDA\u524D\u7AEF\u4EA7\u7269..."]);
          try {
            await fs9.rm(distDir, { recursive: true, force: true });
            await fs9.rename(backupDir, distDir);
          } catch (e) {
          }
        }
        throw err;
      }
      await persistSystemUpdateStatus();
    }
    await pushUpdateStep("\u66F4\u65B0\u5B8C\u6210\uFF0C\u6B63\u5728\u91CD\u542F\u670D\u52A1...");
    systemUpdateStatus.phase = "restarting";
    systemUpdateStatus.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    archiveUpdateStatus(systemUpdateStatus);
    await persistSystemUpdateStatus();
    restartScheduler();
  } catch (error) {
    systemUpdateStatus.phase = "failed";
    systemUpdateStatus.error = error instanceof Error ? error.message : String(error);
    systemUpdateStatus.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    appendUpdateLog([`ERROR: ${systemUpdateStatus.error}`]);
    await pushUpdateStep("\u66F4\u65B0\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u9519\u8BEF\u4FE1\u606F");
    archiveUpdateStatus(systemUpdateStatus);
  }
}
var brandUpload = multer4({
  storage: multer4.diskStorage({
    destination: async (_req, _file, cb) => {
      await fs9.mkdir(BRAND_DIR, { recursive: true });
      cb(null, BRAND_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path8.extname(file.originalname) || ".png";
      cb(null, `${file.fieldname}${ext}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"];
    cb(null, allowed.includes(file.mimetype));
  }
});
function createSettingsRouter() {
  const router2 = Router12();
  router2.post("/brand/upload", requireAdmin, brandUpload.single("file"), async (req, res) => {
    if (!req.file) return fail(res, 400, "\u8BF7\u4E0A\u4F20\u56FE\u7247\u6587\u4EF6", "NO_FILE");
    const fileUrl = `/brand/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
  });
  router2.post("/basic", requireAdmin, async (req, res) => {
    const siteName = normalizeBrandText(readString(req.body?.siteName), "SmartTrade AI CRM");
    const siteSlogan = normalizeBrandText(readString(req.body?.siteSlogan), "\u4E13\u4E1A\u7684\u5916\u8D38\u4E1A\u52A1\u7BA1\u7406\u4E13\u5BB6", 160);
    const siteLogo = sanitizeBrandAssetUrl(readString(req.body?.siteLogo), "/logo.png");
    const siteFavicon = sanitizeBrandAssetUrl(readString(req.body?.siteFavicon), "");
    try {
      await setSettingValue("site_name", siteName);
      await setSettingValue("site_slogan", siteSlogan);
      await setSettingValue("site_logo", siteLogo);
      await setSettingValue("site_favicon", siteFavicon);
      invalidateBrandCache();
      res.json({ success: true, siteName, siteSlogan });
    } catch (error) {
      return handleRouteError(res, error, "\u4FDD\u5B58\u7AD9\u70B9\u8BBE\u7F6E\u5931\u8D25");
    }
  });
  router2.get("/ai", requireAuth, async (_req, res) => {
    try {
      const model = await getSettingValue("current_ai_model", "gemini-2.5-flash");
      const apiKey = await getSettingValue("ai_api_key");
      const baseUrl = await getSettingValue("ai_base_url");
      res.json({
        model,
        apiKey: apiKey ? "***" : "",
        hasApiKey: Boolean(apiKey || process.env.GEMINI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY),
        baseUrl
      });
    } catch (error) {
      return handleRouteError(res, error, "\u65E0\u6CD5\u8BFB\u53D6\u8BBE\u7F6E");
    }
  });
  router2.post("/ai", requireAdmin, async (req, res) => {
    const model = readString(req.body?.model) || "gemini-2.5-flash";
    const apiKey = readString(req.body?.apiKey);
    const baseUrl = readString(req.body?.baseUrl);
    try {
      await setSettingValue("current_ai_model", model);
      if (apiKey && apiKey !== "***") {
        await setSettingValue("ai_api_key", apiKey);
      }
      await setSettingValue("ai_base_url", baseUrl);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u4FDD\u5B58\u8BBE\u7F6E\u5931\u8D25");
    }
  });
  router2.get("/document", requireAdmin, async (_req, res) => {
    try {
      const prefix = await getOrderNumberPrefix();
      res.json({ orderNumberPrefix: prefix });
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u5355\u636E\u7F16\u7801\u89C4\u5219\u5931\u8D25");
    }
  });
  router2.post("/document", requireAdmin, async (req, res) => {
    const prefix = readString(req.body?.orderNumberPrefix) || "ORD-";
    try {
      await setSettingValue("order_number_prefix", prefix);
      res.json({ success: true, orderNumberPrefix: prefix });
    } catch (error) {
      return handleRouteError(res, error, "\u4FDD\u5B58\u5355\u636E\u7F16\u7801\u89C4\u5219\u5931\u8D25");
    }
  });
  router2.post("/ai/test", requireAdmin, async (_req, res) => {
    try {
      const selectedModel = (await getSettingValue("current_ai_model", "deepseek-v4-flash")).trim();
      const provider = resolveAiProvider(selectedModel);
      const apiKey = resolveAiProviderApiKey(provider, await getSettingValue("ai_api_key"));
      const configuredBaseUrl = await getSettingValue("ai_base_url");
      if (!apiKey) {
        return fail(res, 400, "\u672A\u914D\u7F6E API \u5BC6\u94A5\uFF0C\u65E0\u6CD5\u6D4B\u8BD5\u8FDE\u63A5", "AI_KEY_MISSING");
      }
      const testMessage = 'Respond with only the word "ok" if you can read this.';
      if (provider === "gemini") {
        const result = await runGeminiModel(selectedModel, apiKey || "", testMessage, false);
        res.json({ success: true, response: String(result).slice(0, 100) });
      } else {
        const compatBaseUrl = configuredBaseUrl || (provider === "deepseek" ? "https://api.deepseek.com" : "");
        const result = await runOpenAiCompatibleModel({
          model: selectedModel,
          apiKey: apiKey || "",
          baseUrl: compatBaseUrl,
          prompt: testMessage,
          jsonMode: false
        });
        res.json({ success: true, response: String(result).slice(0, 100) });
      }
    } catch (error) {
      return fail(res, 502, `\u8FDE\u63A5\u6D4B\u8BD5\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`, "AI_TEST_FAILED");
    }
  });
  router2.get("/webhook", requireAdmin, async (_req, res) => {
    const url = await getSettingValue("webhook_url", "");
    res.json({ webhookUrl: url });
  });
  router2.post("/webhook", requireAdmin, async (req, res) => {
    const url = readString(req.body?.webhookUrl);
    try {
      await setSettingValue("webhook_url", url);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u4FDD\u5B58\u5931\u8D25");
    }
  });
  router2.get("/check-update", requireAdmin, async (_req, res) => {
    try {
      const token = process.env.GITHUB_TOKEN || "";
      const url = "https://api.github.com/repos/HIUIE/CRM/commits?per_page=1";
      const headers = { "Accept": "application/vnd.github.v3+json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const ghRes = await fetch(url, { headers });
      if (!ghRes.ok) return res.json({ error: `GitHub API: ${ghRes.status}` });
      const data = await ghRes.json();
      if (Array.isArray(data) && data[0]?.sha) {
        res.json({ version: data[0].sha.slice(0, 7), buildTime: data[0].commit?.author?.date || "", commit: data[0].sha.slice(0, 7) });
      } else {
        res.json({ error: "\u65E0\u6CD5\u89E3\u6790\u7248\u672C\u4FE1\u606F" });
      }
    } catch (error) {
      return handleRouteError(res, error, "\u68C0\u67E5\u66F4\u65B0\u5931\u8D25");
    }
  });
  router2.get("/system/update/status", requireAdmin, async (_req, res) => {
    await ensureSystemUpdateStatusLoaded();
    res.json(systemUpdateStatus);
  });
  router2.get("/system/update/history", requireAdmin, async (_req, res) => {
    await ensureSystemUpdateStatusLoaded();
    res.json(systemUpdateHistory);
  });
  router2.post("/system/update", requireAdmin, async (_req, res) => {
    await ensureSystemUpdateStatusLoaded();
    if (process.env.ENABLE_SYSTEM_UPDATE !== "true") {
      return fail(res, 403, "\u7CFB\u7EDF\u66F4\u65B0\u5165\u53E3\u672A\u542F\u7528\uFF0C\u8BF7\u5728\u670D\u52A1\u5668\u73AF\u5883\u53D8\u91CF\u4E2D\u8BBE\u7F6E ENABLE_SYSTEM_UPDATE=true \u540E\u518D\u4F7F\u7528", "SYSTEM_UPDATE_DISABLED");
    }
    if (isSystemUpdateRunning()) {
      return fail(res, 409, "\u7CFB\u7EDF\u66F4\u65B0\u6B63\u5728\u8FDB\u884C\u4E2D\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", "SYSTEM_UPDATE_IN_PROGRESS");
    }
    try {
      void runSystemUpdateJob();
      res.status(202).json({
        success: true,
        message: "\u7CFB\u7EDF\u66F4\u65B0\u4EFB\u52A1\u5DF2\u542F\u52A8\uFF0C\u8BF7\u7A0D\u5019\u67E5\u770B\u8FDB\u5EA6",
        status: "running"
      });
    } catch (error) {
      return handleRouteError(res, error, "\u7CFB\u7EDF\u66F4\u65B0\u5931\u8D25");
    }
  });
  router2.get("/export/xlsx", requireAdmin, async (_req, res) => {
    try {
      const wb = await buildExcelWorkbook();
      const fileName = `SmartTrade_CRM_Export_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      await wb.xlsx.write(res);
      res.end();
    } catch (error) {
      return handleRouteError(res, error, "\u5BFC\u51FA Excel \u5931\u8D25");
    }
  });
  router2.get("/export", requireAdmin, async (req, res) => {
    const format = readString(req.query.format) || "customer-archive";
    if (!["customer-archive", "zip-csv"].includes(format)) {
      return res.status(400).json({
        error: {
          code: "INVALID_EXPORT_FORMAT",
          message: "\u4EC5\u652F\u6301 customer-archive \u6216 zip-csv \u5BFC\u51FA\u683C\u5F0F"
        }
      });
    }
    try {
      const fileName = getExportFileName(format);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      if (format === "zip-csv") {
        const zipBuffer = await buildLegacyExportZip();
        res.setHeader("Content-Length", String(zipBuffer.length));
        res.end(zipBuffer);
        return;
      }
      await streamCustomerArchiveZip(res);
    } catch (error) {
      return handleRouteError(res, error, "\u5BFC\u51FA\u6570\u636E\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/users.ts
init_db();
import { Router as Router13 } from "express";
import bcrypt2 from "bcryptjs";
init_auth();
init_http();
init_values();
function createUsersRouter() {
  const router2 = Router13();
  router2.get("/", requireAuth, async (_req, res) => {
    try {
      const users = await dbAll(`
        SELECT id, username, role, name, active, created_at
        FROM users
        ORDER BY role = 'admin' DESC, datetime(created_at) DESC, id DESC
      `);
      res.json(
        users.map((user) => ({
          ...user,
          active: user.active !== 0
        }))
      );
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u7528\u6237\u5217\u8868\u5931\u8D25");
    }
  });
  router2.post("/", requireAuth, requireAdmin, async (req, res) => {
    const username = readString(req.body?.username).toLowerCase();
    const password = readString(req.body?.password);
    const name = readString(req.body?.name);
    const role = readString(req.body?.role);
    if (!username || !password || !name) {
      return fail(res, 400, "\u8BF7\u5B8C\u6574\u586B\u5199\u7528\u6237\u540D\u3001\u59D3\u540D\u548C\u5BC6\u7801", "INVALID_USER_PAYLOAD");
    }
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      return fail(res, 400, "\u7528\u6237\u540D\u4EC5\u652F\u6301 3-32 \u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u70B9\u3001\u4E0B\u5212\u7EBF\u6216\u4E2D\u6A2A\u7EBF", "INVALID_USERNAME");
    }
    if (password.length < 6) {
      return fail(res, 400, "\u5BC6\u7801\u81F3\u5C11\u9700\u8981 6 \u4F4D", "INVALID_PASSWORD");
    }
    if (!isOneOf(role, USER_ROLES)) {
      return fail(res, 400, "\u89D2\u8272\u4E0D\u6B63\u786E", "INVALID_ROLE");
    }
    try {
      const existing = await dbGet(`SELECT id FROM users WHERE username = ?`, [username]);
      if (existing) {
        return fail(res, 409, "\u7528\u6237\u540D\u5DF2\u5B58\u5728", "USERNAME_EXISTS");
      }
      const hash = await bcrypt2.hash(password, 10);
      const created = await dbRun(
        `INSERT INTO users (username, password, role, name, active) VALUES (?, ?, ?, ?, 1)`,
        [username, hash, role, name]
      );
      res.status(201).json({ id: created.lastID });
    } catch (error) {
      return handleRouteError(res, error, "\u521B\u5EFA\u7528\u6237\u5931\u8D25");
    }
  });
  router2.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    const name = readString(req.body?.name);
    const role = readString(req.body?.role);
    const active = req.body?.active === false || req.body?.active === 0 ? 0 : 1;
    if (!Number.isInteger(userId) || userId <= 0) {
      return fail(res, 400, "\u7528\u6237\u7F16\u53F7\u65E0\u6548", "INVALID_USER_ID");
    }
    if (!name) {
      return fail(res, 400, "\u8BF7\u586B\u5199\u59D3\u540D", "INVALID_USER_PAYLOAD");
    }
    if (!isOneOf(role, USER_ROLES)) {
      return fail(res, 400, "\u89D2\u8272\u4E0D\u6B63\u786E", "INVALID_ROLE");
    }
    try {
      const existing = await dbGet(
        `SELECT id, username, role, active FROM users WHERE id = ?`,
        [userId]
      );
      if (!existing) {
        return fail(res, 404, "\u7528\u6237\u4E0D\u5B58\u5728", "USER_NOT_FOUND");
      }
      const isSelf = req.user?.id === userId;
      if (existing.username === "root" && active === 0) {
        return fail(res, 409, "\u9ED8\u8BA4\u7BA1\u7406\u5458\u8D26\u53F7\u4E0D\u80FD\u505C\u7528", "ROOT_PROTECTED");
      }
      if (isSelf && active === 0) {
        return fail(res, 409, "\u4E0D\u80FD\u505C\u7528\u5F53\u524D\u767B\u5F55\u8D26\u53F7\uFF0C\u8BF7\u4F7F\u7528\u5176\u4ED6\u7BA1\u7406\u5458\u8D26\u53F7\u64CD\u4F5C", "SELF_DEACTIVATE_BLOCKED");
      }
      if (isSelf && existing.role === "admin" && role !== "admin") {
        return fail(res, 409, "\u4E0D\u80FD\u76F4\u63A5\u964D\u4F4E\u5F53\u524D\u767B\u5F55\u7BA1\u7406\u5458\u8D26\u53F7\u6743\u9650\uFF0C\u8BF7\u4F7F\u7528\u5176\u4ED6\u7BA1\u7406\u5458\u8D26\u53F7\u64CD\u4F5C", "SELF_DEMOTE_BLOCKED");
      }
      if (existing.role === "admin" && (role !== "admin" || active === 0)) {
        const adminCount = await dbGet(
          `SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active != 0`
        );
        if ((adminCount?.count || 0) <= 1) {
          return fail(res, 409, "\u7CFB\u7EDF\u81F3\u5C11\u9700\u8981\u4FDD\u7559\u4E00\u4E2A\u542F\u7528\u4E2D\u7684\u7BA1\u7406\u5458\u8D26\u53F7", "LAST_ADMIN_BLOCKED");
        }
      }
      await dbRun(
        `UPDATE users SET name = ?, role = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [name, role, active, userId]
      );
      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: "UPDATE",
        entityType: "USER",
        entityId: userId,
        newValue: { action: "update_user", targetUser: existing.username, role, active: active !== 0, self: isSelf }
      });
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u66F4\u65B0\u7528\u6237\u5931\u8D25");
    }
  });
  router2.post("/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    const password = readString(req.body?.password);
    const confirmPassword = readString(req.body?.confirmPassword);
    if (!Number.isInteger(userId) || userId <= 0) {
      return fail(res, 400, "\u7528\u6237\u7F16\u53F7\u65E0\u6548", "INVALID_USER_ID");
    }
    if (password.length < 6) {
      return fail(res, 400, "\u5BC6\u7801\u81F3\u5C11\u9700\u8981 6 \u4F4D", "INVALID_PASSWORD");
    }
    if (!confirmPassword) {
      return fail(res, 400, "\u8BF7\u8F93\u5165\u60A8\u7684\u5F53\u524D\u5BC6\u7801\u4EE5\u786E\u8BA4\u6B64\u64CD\u4F5C", "CONFIRM_PASSWORD_REQUIRED");
    }
    const admin = await dbGet(`SELECT password FROM users WHERE id = ?`, [req.user?.id]);
    if (!admin || !await bcrypt2.compare(confirmPassword, admin.password)) {
      return fail(res, 403, "\u5F53\u524D\u5BC6\u7801\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8F93\u5165\u7684\u5BC6\u7801\u662F\u5426\u6B63\u786E", "ADMIN_CONFIRM_FAILED");
    }
    try {
      const existing = await dbGet(`SELECT id, name FROM users WHERE id = ?`, [userId]);
      if (!existing) {
        return fail(res, 404, "\u7528\u6237\u4E0D\u5B58\u5728", "USER_NOT_FOUND");
      }
      const hash = await bcrypt2.hash(password, 10);
      await dbRun(`UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [hash, userId]);
      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: "UPDATE",
        entityType: "USER",
        entityId: userId,
        newValue: { action: "reset_password", targetUser: existing.name, selfReset: req.user?.id === userId }
      });
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u91CD\u7F6E\u5BC6\u7801\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/audit.ts
init_db();
init_auth();
init_http();
import { Router as Router14 } from "express";
function createAuditRouter() {
  const router2 = Router14();
  router2.get("/", requireAdmin, async (req, res) => {
    try {
      await dbRun(`DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '30 days'`);
      const userId = req.query.userId;
      const entityType = req.query.entityType;
      const entityId = req.query.entityId;
      let sql = "SELECT * FROM audit_logs WHERE 1=1";
      const params = [];
      if (userId) {
        sql += " AND user_id = ?";
        params.push(userId);
      }
      if (entityType) {
        sql += " AND entity_type = ?";
        params.push(entityType);
      }
      if (entityId) {
        sql += " AND entity_id = ?";
        params.push(entityId);
      }
      sql += " ORDER BY created_at DESC";
      const { readPagination: readPagination2, buildLimitOffset: buildLimitOffset2 } = await Promise.resolve().then(() => (init_values(), values_exports));
      const pagination = readPagination2(req.query);
      sql += buildLimitOffset2(pagination, params);
      const logs = await dbAll(sql, params);
      res.json(logs);
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u5BA1\u8BA1\u65E5\u5FD7\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/tasks.ts
init_db();
init_auth();
init_http();
init_values();
import { Router as Router15 } from "express";

// server/lib/notifications.ts
init_db();
init_logger();
init_socket();
async function createNotification(params) {
  try {
    await dbRun(
      `
        INSERT INTO notifications (user_id, title, message, link)
        VALUES (?, ?, ?, ?)
      `,
      [params.userId, params.title, params.message || null, params.link || null]
    );
    emitToUser(params.userId, "new-notification", {
      title: params.title,
      message: params.message,
      link: params.link
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to create notification");
  }
}
async function notifyMention(userId, sourceName, entityType, entityId) {
  await createNotification({
    userId,
    title: `@\u63D0\u53CA\u63D0\u9192`,
    message: `${sourceName} \u5728 ${entityType} ${entityId} \u4E2D\u63D0\u53CA\u4E86\u4F60`,
    link: entityType === "ORDER" ? `/orders/${entityId}` : `/customers/detail/${entityId}`
  });
}

// server/routes/tasks.ts
async function loadAccessibleTask(taskId, user) {
  const task = await dbGet(`SELECT id, title, assignee_id, created_by FROM tasks WHERE id = ?`, [taskId]);
  if (!task) {
    return { error: "NOT_FOUND" };
  }
  if (user?.role === "admin" || task.assignee_id === user?.id || task.created_by === user?.id) {
    return { task };
  }
  return { error: "FORBIDDEN" };
}
function createTasksRouter() {
  const router2 = Router15();
  router2.get("/", requireAuth, async (req, res) => {
    const view = readString(req.query.view) || "assigned";
    const q = readString(req.query.q);
    const userId = req.user?.id;
    const role = req.user?.role;
    let whereSql = "WHERE 1=1";
    const params = [];
    if (q) {
      whereSql += " AND (t.title LIKE ? OR t.description LIKE ?)";
      const p = `%${q}%`;
      params.push(p, p);
    }
    if (view === "assigned") {
      whereSql += " AND t.assignee_id = ?";
      params.push(userId);
    } else if (view === "delegated") {
      whereSql += " AND t.created_by = ? AND t.assignee_id != ?";
      params.push(userId, userId);
    } else if (view === "all") {
      if (role !== "admin") {
        whereSql += " AND (t.assignee_id = ? OR t.created_by = ?)";
        params.push(userId, userId);
      }
    }
    try {
      const tasks = await dbAll(`
        SELECT t.*, u.name as assignee_name, u2.name as creator_name
        FROM tasks t
        JOIN users u ON t.assignee_id = u.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        ${whereSql}
        ORDER BY 
          CASE WHEN t.status = 'done' THEN 1 ELSE 0 END,
          t.due_date ASC,
          t.created_at DESC
        ${buildLimitOffset(readPagination(req.query), params)}
      `, params);
      res.json(tasks);
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u4EFB\u52A1\u5931\u8D25");
    }
  });
  router2.get("/:id", requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    try {
      const access = await loadAccessibleTask(taskId, req.user);
      if (access.error === "NOT_FOUND") return fail(res, 404, "\u4EFB\u52A1\u4E0D\u5B58\u5728");
      if (access.error === "FORBIDDEN") return fail(res, 403, "\u65E0\u6743\u8BBF\u95EE\u8BE5\u4EFB\u52A1", "TASK_FORBIDDEN");
      const task = await dbGet(`
        SELECT t.*, u.name as assignee_name, u2.name as creator_name
        FROM tasks t
        JOIN users u ON t.assignee_id = u.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        WHERE t.id = ?
      `, [taskId]);
      if (!task) return fail(res, 404, "\u4EFB\u52A1\u4E0D\u5B58\u5728");
      const comments = await dbAll(`
        SELECT c.*, u.name as creator_name
        FROM task_comments c
        JOIN users u ON c.created_by = u.id
        WHERE c.task_id = ?
        ORDER BY c.created_at ASC
      `, [taskId]);
      if (comments.length > 0) {
        const commentIds = comments.map((c) => c.id);
        const placeholders = commentIds.map(() => "?").join(",");
        const allAttachments = await dbAll(`
          SELECT a.*, ta.comment_id
          FROM attachments a
          JOIN task_attachments ta ON a.id = ta.attachment_id
          WHERE ta.comment_id IN (${placeholders})
        `, commentIds);
        const attsByCommentId = {};
        for (const att of allAttachments) {
          const cid = att.comment_id;
          if (!attsByCommentId[cid]) attsByCommentId[cid] = [];
          attsByCommentId[cid].push(att);
          delete att.comment_id;
        }
        for (const comment of comments) {
          comment.attachments = attsByCommentId[comment.id] || [];
        }
      } else {
        for (const comment of comments) {
          comment.attachments = [];
        }
      }
      res.json({ ...task, comments });
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u4EFB\u52A1\u8BE6\u60C5\u5931\u8D25");
    }
  });
  router2.post("/:id/comments", requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    const content = readString(req.body?.content);
    if (!content) return fail(res, 400, "\u8BF7\u8F93\u5165\u8BC4\u8BBA\u5185\u5BB9");
    try {
      const access = await loadAccessibleTask(taskId, req.user);
      if (access.error === "NOT_FOUND") return fail(res, 404, "\u4EFB\u52A1\u4E0D\u5B58\u5728");
      if (access.error === "FORBIDDEN") return fail(res, 403, "\u65E0\u6743\u8BBF\u95EE\u8BE5\u4EFB\u52A1", "TASK_FORBIDDEN");
      const task = access.task;
      const mentionedUserIds = /* @__PURE__ */ new Set();
      let shouldNotifyAssignee = false;
      await withTransaction(async (tx) => {
        const result = await tx.run(
          `INSERT INTO task_comments (task_id, content, created_by) VALUES (?, ?, ?)`,
          [taskId, content, req.user?.id]
        );
        const commentId = result.lastID;
        const attachmentIds = Array.isArray(req.body?.attachmentIds) ? req.body.attachmentIds : [];
        if (attachmentIds.length > 0) {
          for (const aid of attachmentIds) {
            await tx.run(
              `INSERT INTO task_attachments (task_id, attachment_id, comment_id) VALUES (?, ?, ?)`,
              [taskId, aid, commentId]
            );
          }
          await tx.run(`UPDATE tasks SET attachment_count = attachment_count + ? WHERE id = ?`, [attachmentIds.length, taskId]);
        }
        await tx.run(`UPDATE tasks SET comment_count = comment_count + 1 WHERE id = ?`, [taskId]);
        const mentions = content.match(/@([^ ]+)/g);
        if (mentions) {
          for (const m of mentions) {
            const name = m.slice(1);
            const mentionedUser = await tx.get(`SELECT id FROM users WHERE name = ?`, [name]);
            if (mentionedUser && mentionedUser.id !== req.user?.id) {
              mentionedUserIds.add(mentionedUser.id);
            }
          }
        }
        if (task.assignee_id !== req.user?.id) {
          shouldNotifyAssignee = true;
        }
      });
      for (const mentionedUserId of mentionedUserIds) {
        await notifyMention(mentionedUserId, req.user?.name || "\u6709\u4EBA", "TASK", String(taskId));
      }
      if (shouldNotifyAssignee) {
        await createNotification({
          userId: task.assignee_id,
          title: "\u4EFB\u52A1\u6709\u65B0\u8FDB\u5C55",
          message: `${req.user?.name} \u5728\u4EFB\u52A1\u201C${task.title}\u201D\u4E2D\u53D1\u8868\u4E86\u8BC4\u8BBA`,
          link: `/tasks?detail=${taskId}`
        });
      }
      res.status(201).json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u53D1\u8868\u8BC4\u8BBA\u5931\u8D25");
    }
  });
  router2.post("/", requireAuth, async (req, res) => {
    const title = readString(req.body?.title);
    const assigneeId = readNumber(req.body?.assigneeId);
    const dueDate = readString(req.body?.dueDate);
    const priority = readString(req.body?.priority) || "P2";
    const entityType = readString(req.body?.entityType);
    const entityId = readString(req.body?.entityId);
    const description = readString(req.body?.description);
    if (!title || !assigneeId || !dueDate) {
      return fail(res, 400, "\u8BF7\u5B8C\u6574\u586B\u5199\u4EFB\u52A1\u6807\u9898\u3001\u8D1F\u8D23\u4EBA\u548C\u622A\u6B62\u65E5\u671F", "INVALID_TASK_PAYLOAD");
    }
    try {
      const result = await dbRun(`
        INSERT INTO tasks (title, assignee_id, due_date, priority, entity_type, entity_id, description, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [title, assigneeId, dueDate, priority, entityType?.toUpperCase(), entityId, description, req.user?.id]);
      const taskId = result.lastID;
      if (assigneeId !== req.user?.id) {
        await createNotification({
          userId: assigneeId,
          title: "\u6536\u5230\u65B0\u6D3E\u53D1\u4EFB\u52A1",
          message: `${req.user?.name} \u6307\u6D3E\u7ED9\u4F60\u4E00\u4E2A\u65B0\u4EFB\u52A1\uFF1A${title}`,
          link: `/tasks?detail=${taskId}`
        });
      }
      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: "CREATE",
        entityType: "TASK",
        entityId: taskId,
        newValue: req.body
      });
      res.status(201).json({ id: taskId });
    } catch (error) {
      return handleRouteError(res, error, "\u521B\u5EFA\u4EFB\u52A1\u5931\u8D25");
    }
  });
  router2.patch("/:id/status", requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    const status = readString(req.body?.status);
    if (!["todo", "in_progress", "done"].includes(status)) {
      return fail(res, 400, "\u65E0\u6548\u7684\u72B6\u6001\u503C", "INVALID_STATUS");
    }
    try {
      const access = await loadAccessibleTask(taskId, req.user);
      if (access.error === "NOT_FOUND") return fail(res, 404, "\u4EFB\u52A1\u4E0D\u5B58\u5728");
      if (access.error === "FORBIDDEN") return fail(res, 403, "\u65E0\u6743\u8BBF\u95EE\u8BE5\u4EFB\u52A1", "TASK_FORBIDDEN");
      await dbRun(`UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, taskId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u66F4\u65B0\u4EFB\u52A1\u72B6\u6001\u5931\u8D25");
    }
  });
  router2.patch("/:id", requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    const assigneeId = readNumber(req.body?.assigneeId);
    const dueDate = readString(req.body?.dueDate);
    const priority = readString(req.body?.priority);
    const title = readString(req.body?.title);
    try {
      const access = await loadAccessibleTask(taskId, req.user);
      if (access.error === "NOT_FOUND") return fail(res, 404, "\u4EFB\u52A1\u4E0D\u5B58\u5728");
      if (access.error === "FORBIDDEN") return fail(res, 403, "\u65E0\u6743\u8BBF\u95EE\u8BE5\u4EFB\u52A1", "TASK_FORBIDDEN");
      await dbRun(`
        UPDATE tasks 
        SET assignee_id = COALESCE(?, assignee_id),
            due_date = COALESCE(?, due_date),
            priority = COALESCE(?, priority),
            title = COALESCE(?, title),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [assigneeId, dueDate, priority, title, taskId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u66F4\u65B0\u4EFB\u52A1\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/notifications.ts
init_db();
init_auth();
init_http();
import { Router as Router16 } from "express";
function createNotificationsRouter() {
  const router2 = Router16();
  router2.get("/unread-count", requireAuth, async (req, res) => {
    try {
      const result = await dbGet(
        `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0`,
        [req.user?.id]
      );
      res.json({ count: result?.count || 0 });
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u6D88\u606F\u7EDF\u8BA1\u5931\u8D25");
    }
  });
  router2.get("/", requireAuth, async (req, res) => {
    try {
      const logs = await dbAll(`
        SELECT * FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `, [req.user?.id]);
      res.json(logs);
    } catch (error) {
      return handleRouteError(res, error, "\u8BFB\u53D6\u6D88\u606F\u5217\u8868\u5931\u8D25");
    }
  });
  router2.post("/read-all", requireAuth, async (req, res) => {
    try {
      await dbRun(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [req.user?.id]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, "\u6807\u8BB0\u6D88\u606F\u5931\u8D25");
    }
  });
  return router2;
}

// server/routes/import.ts
init_logger();
init_db();
init_auth();
init_http();
init_values();
import { Router as Router17 } from "express";
import path9 from "path";
import fs10 from "fs/promises";
import { Readable } from "stream";
import multer5 from "multer";
import ExcelJS2 from "exceljs";
import AdmZip from "adm-zip";
var IMPORT_TEMP_DIR = path9.join(UPLOADS_DIR, "temp");
var MAX_IMPORT_FILE_SIZE = 25 * 1024 * 1024;
var MAX_ZIP_ENTRIES = 200;
var MAX_ZIP_UNCOMPRESSED_SIZE = 50 * 1024 * 1024;
var ALLOWED_IMPORT_EXTENSIONS = /* @__PURE__ */ new Set([".xlsx", ".csv", ".zip"]);
var ALLOWED_IMPORT_MIME_TYPES = /* @__PURE__ */ new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip"
]);
var upload4 = multer5({
  dest: IMPORT_TEMP_DIR,
  limits: { fileSize: MAX_IMPORT_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path9.extname(file.originalname || "").toLowerCase();
    const mimeAllowed = ALLOWED_IMPORT_MIME_TYPES.has(file.mimetype);
    if (!ALLOWED_IMPORT_EXTENSIONS.has(extension) || !mimeAllowed) {
      callback(new Error("UNSUPPORTED_IMPORT_FILE"));
      return;
    }
    callback(null, true);
  }
});
function handleImportUpload(req, res, next) {
  upload4.single("file")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer5.MulterError && error.code === "LIMIT_FILE_SIZE") {
      fail(res, 400, "\u5BFC\u5165\u6587\u4EF6\u4E0D\u80FD\u8D85\u8FC7 25MB", "IMPORT_FILE_TOO_LARGE");
      return;
    }
    fail(res, 400, "\u4EC5\u652F\u6301 CSV\u3001XLSX \u6216 ZIP \u5907\u4EFD\u6587\u4EF6", "UNSUPPORTED_IMPORT_FILE");
  });
}
function resolveImportTempFile(filename) {
  const safeName = readString(filename);
  if (!/^[a-zA-Z0-9_-]+$/.test(safeName)) {
    return null;
  }
  const tempDir = path9.resolve(IMPORT_TEMP_DIR);
  const filePath = path9.resolve(tempDir, safeName);
  if (filePath !== tempDir && filePath.startsWith(`${tempDir}${path9.sep}`)) {
    return filePath;
  }
  return null;
}
function validateZipEntries(zip) {
  const entries = zip.getEntries();
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error("ZIP_ENTRIES_LIMIT");
  }
  let totalSize = 0;
  for (const entry of entries) {
    if (entry.entryName.startsWith("/") || entry.entryName.includes("..")) {
      throw new Error("ZIP_ENTRY_PATH_INVALID");
    }
    totalSize += entry.header.size || 0;
    if (totalSize > MAX_ZIP_UNCOMPRESSED_SIZE) {
      throw new Error("ZIP_SIZE_LIMIT");
    }
  }
  return entries;
}
function createImportRouter() {
  const router2 = Router17();
  router2.post("/preview", requireAdmin, handleImportUpload, async (req, res) => {
    if (!req.file) return fail(res, 400, "\u8BF7\u9009\u62E9\u8981\u4E0A\u4F20\u7684\u6587\u4EF6");
    const isZip = path9.extname(req.file.originalname || "").toLowerCase() === ".zip";
    if (isZip) {
      try {
        const zip = new AdmZip(req.file.path);
        const entries = validateZipEntries(zip).map((e) => e.entryName);
        const isBackup = entries.includes("customers.csv") || entries.includes("orders.csv");
        return res.json({
          isZip: true,
          isBackup,
          entries,
          filename: req.file.filename,
          originalName: req.file.originalname
        });
      } catch (error) {
        try {
          await fs10.unlink(req.file.path);
        } catch {
        }
        return handleRouteError(res, error, "\u89E3\u6790\u538B\u7F29\u5305\u5931\u8D25");
      }
    }
    try {
      const workbook = new ExcelJS2.Workbook();
      const isCsv = req.file.originalname.endsWith(".csv");
      if (isCsv) {
        await workbook.csv.readFile(req.file.path);
      } else {
        await workbook.xlsx.readFile(req.file.path);
      }
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        try {
          await fs10.unlink(req.file.path);
        } catch {
        }
        return fail(res, 400, "\u6587\u4EF6\u5185\u5BB9\u4E3A\u7A7A");
      }
      const headers = [];
      const rows = [];
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.text;
      });
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && rowNumber <= 6) {
          const rowData = [];
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            rowData[colNumber - 1] = cell.value;
          });
          rows.push(rowData);
        }
      });
      res.json({ headers, rows, filename: req.file.filename, originalName: req.file.originalname });
    } catch (error) {
      try {
        await fs10.unlink(req.file.path);
      } catch {
      }
      return handleRouteError(res, error, "\u89E3\u6790\u6587\u4EF6\u5931\u8D25");
    }
  });
  router2.post("/execute", requireAdmin, async (req, res) => {
    const { filename, entityType, mapping, isBackup } = req.body;
    if (!filename) return fail(res, 400, "\u53C2\u6570\u4E0D\u5B8C\u6574");
    if (!isBackup && !["CUSTOMER", "ORDER"].includes(readString(entityType))) {
      return fail(res, 400, "\u5BFC\u5165\u5BF9\u8C61\u4E0D\u6B63\u786E", "INVALID_IMPORT_ENTITY");
    }
    const filePath = resolveImportTempFile(filename);
    if (!filePath) {
      return fail(res, 400, "\u5BFC\u5165\u6587\u4EF6\u540D\u65E0\u6548", "INVALID_IMPORT_FILE");
    }
    try {
      if (isBackup) {
        const result = await importBackup(filePath, req.user?.id);
        return res.json(result);
      }
      const workbook = new ExcelJS2.Workbook();
      const isCsv = filename.endsWith(".csv") || filename.includes("csv");
      try {
        if (isCsv) {
          await workbook.csv.readFile(filePath);
        } else {
          await workbook.xlsx.readFile(filePath);
        }
      } catch (e) {
        if (isCsv) await workbook.xlsx.readFile(filePath);
        else await workbook.csv.readFile(filePath);
      }
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) return fail(res, 400, "\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6\u5185\u5BB9");
      const headers = [];
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.text;
      });
      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      await withTransaction(async (tx) => {
        for (let i = 2; i <= worksheet.rowCount; i++) {
          const row = worksheet.getRow(i);
          if (!row.values || row.values.length <= 1) continue;
          const data = {};
          Object.entries(mapping).forEach(([systemField, fileHeader]) => {
            const colIndex = headers.indexOf(fileHeader);
            if (colIndex !== -1) {
              data[systemField] = row.getCell(colIndex + 1).value;
            }
          });
          try {
            if (entityType === "CUSTOMER") {
              await importCustomer(tx, data, req.user?.id);
            } else if (entityType === "ORDER") {
              await importOrder(tx, data, req.user?.id);
            }
            successCount++;
          } catch (e) {
            errorCount++;
            errors.push(`\u7B2C ${i} \u884C: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      });
      res.json({ successCount, errorCount, errors });
    } catch (error) {
      return handleRouteError(res, error, "\u5BFC\u5165\u5931\u8D25");
    } finally {
      try {
        await fs10.unlink(filePath);
      } catch (e) {
        logger.error({ err: e, filePath }, "Failed to cleanup import file");
      }
    }
  });
  return router2;
}
async function importBackup(zipPath, userId) {
  const zip = new AdmZip(zipPath);
  const entries = validateZipEntries(zip);
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  return await withTransaction(async (tx) => {
    const customerEntry = entries.find((e) => e.entryName === "customers.csv");
    if (customerEntry) {
      const content = customerEntry.getData().toString("utf8");
      const rows = await parseCsv(content);
      for (const row of rows) {
        try {
          await upsertCustomer(tx, row, userId);
          successCount++;
        } catch (e) {
          errorCount++;
          errors.push(`\u5BA2\u6237\u5BFC\u5165\u9519\u8BEF: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    const orderEntry = entries.find((e) => e.entryName === "orders.csv");
    if (orderEntry) {
      const content = orderEntry.getData().toString("utf8");
      const rows = await parseCsv(content);
      for (const row of rows) {
        try {
          await upsertOrder(tx, row, userId);
          successCount++;
        } catch (e) {
          errorCount++;
          errors.push(`\u8BA2\u5355\u5BFC\u5165\u9519\u8BEF: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    return { successCount, errorCount, errors };
  });
}
async function parseCsv(content) {
  const workbook = new ExcelJS2.Workbook();
  const stream = Readable.from(content);
  await workbook.csv.read(stream);
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) return [];
  const headers = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = cell.text.trim();
  });
  const result = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const rowData = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.text.trim();
        }
      });
      result.push(rowData);
    }
  });
  return result;
}
async function upsertCustomer(tx, data, userId) {
  const displayId = data.display_id || data.displayId;
  const name = data.name;
  if (!displayId || !name) return;
  const existing = await tx.get(`SELECT id FROM customers WHERE display_id = ?`, [displayId]);
  if (existing) {
    await tx.run(
      `UPDATE customers SET name = ?, country = ?, contact = ?, source_channel = ?, intent_products = ?, updated_by = ? WHERE id = ?`,
      [name, data.country, data.contact, data.source_channel || data.sourceChannel, data.intent_products || data.intentProducts, userId, existing.id]
    );
  } else {
    await tx.run(
      `INSERT INTO customers (display_id, name, country, contact, source_channel, intent_products, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [displayId, name, data.country, data.contact, data.source_channel || data.sourceChannel, data.intent_products || data.intentProducts, userId, userId]
    );
  }
}
async function upsertOrder(tx, data, userId) {
  const displayId = data.display_id || data.displayId;
  if (!displayId) return;
  const customerName = data.customer_name || data.customerName;
  const customer = await tx.get(`SELECT id FROM customers WHERE name = ? AND deleted_at IS NULL`, [customerName]);
  if (!customer) throw new Error(`\u627E\u4E0D\u5230\u8BA2\u5355\u5173\u8054\u7684\u5BA2\u6237: ${customerName}`);
  const existing = await tx.get(`SELECT id FROM orders WHERE display_id = ?`, [displayId]);
  if (existing) {
    await tx.run(
      `UPDATE orders SET customer_id = ?, status = ?, total_amount = ?, product_summary = ?, details = ?, updated_by = ? WHERE id = ?`,
      [customer.id, data.status, data.total_amount || data.totalAmount, data.product_summary || data.productSummary, data.details, userId, existing.id]
    );
  } else {
    await tx.run(
      `INSERT INTO orders (display_id, customer_id, status, total_amount, product_summary, details, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [displayId, customer.id, data.status, data.total_amount || data.totalAmount, data.product_summary || data.productSummary, data.details, userId, userId]
    );
  }
}
async function importCustomer(tx, data, userId) {
  const name = String(data.name || "").trim();
  const country = String(data.country || "").trim();
  if (!name || !country) throw new Error("\u7F3A\u5C11\u5FC5\u586B\u9879\uFF1A\u540D\u79F0\u6216\u56FD\u5BB6");
  const displayId = `cust-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 8)}`;
  await tx.run(
    `INSERT INTO customers (display_id, name, country, contact, source_channel, intent_products, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [displayId, name, country, data.contact, data.sourceChannel, data.intentProducts, userId, userId]
  );
}
async function importOrder(tx, data, userId) {
  const customerName = String(data.customerName || "").trim();
  if (!customerName) throw new Error("\u7F3A\u5C11\u5FC5\u586B\u9879\uFF1A\u5BA2\u6237\u540D\u79F0");
  const customer = await tx.get(`SELECT id FROM customers WHERE name = ? AND deleted_at IS NULL`, [customerName]);
  if (!customer) throw new Error(`\u672A\u627E\u5230\u5339\u914D\u7684\u5BA2\u6237: ${customerName}`);
  let displayId = String(data.displayId || "").trim();
  if (!displayId) {
    displayId = `ORD-IMP-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
  }
  const totalAmount = Number(data.totalAmount) || 0;
  const status = data.status || "draft";
  await tx.run(
    `INSERT INTO orders (display_id, customer_id, status, total_amount, product_summary, details, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [displayId, customer.id, status, totalAmount, data.productSummary, data.details, userId, userId]
  );
}

// server/api.ts
var globalLimiter = rateLimit({
  windowMs: 6e4,
  max: 200,
  // 200 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" } }
});
var aiLimiter = rateLimit({
  windowMs: 6e4,
  max: 10,
  // 10 AI requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "AI \u63A5\u53E3\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" } }
});
var heavyLimiter = rateLimit({
  windowMs: 6e4,
  max: 20,
  // 20 export/import requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "\u5BFC\u5165\u5BFC\u51FA\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" } }
});
var router = Router18();
var SERVER_START_TIME = Date.now();
router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    startupTime: SERVER_START_TIME
  });
});
router.use("/auth", createAuthRouter());
router.get("/settings/basic", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const siteName = await getSettingValue("site_name", "SmartTrade AI CRM");
    const siteSlogan = await getSettingValue("site_slogan", "");
    const siteLogo = await getSettingValue("site_logo", "");
    const siteFavicon = await getSettingValue("site_favicon", "");
    res.json({
      siteName: normalizeBrandText(siteName, "SmartTrade AI CRM"),
      siteSlogan: normalizeBrandText(siteSlogan, "", 160),
      siteLogo: sanitizeBrandAssetUrl(siteLogo, "/logo.png"),
      siteFavicon: sanitizeBrandAssetUrl(siteFavicon, "")
    });
  } catch (error) {
    res.json({ siteName: "SmartTrade AI CRM", siteSlogan: "", siteLogo: "/logo.png", siteFavicon: "" });
  }
});
router.use(requireAuth);
router.use(csrfProtection);
router.use(globalLimiter);
if (process.env.NODE_ENV !== "production") {
  router.use("/api-docs", requireAdmin, swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
}
router.use("/dashboard", createDashboardRouter());
router.use("/settings", createSettingsRouter());
router.use("/audit", createAuditRouter());
router.use("/users", createUsersRouter());
router.use("/tasks", createTasksRouter());
router.use("/notifications", createNotificationsRouter());
router.use("/customers", createCustomersRouter());
router.use("/partners", createPartnersRouter());
router.use("/orders", createOrdersRouter());
router.use("/finance", createFinanceRouter());
router.use("/logistics", createLogisticsRouter());
router.use("/files", createFilesRouter());
router.use("/import", heavyLimiter, createImportRouter());
router.use("/", createCustomsRouter());
router.use("/attachments", createAttachmentsRouter());
router.use("/ai", aiLimiter, createAiRouter());
var api_default = router;

// server/lib/security.ts
var BLOCKED_SUFFIXES = [".env", ".db", ".sqlite", ".sqlite3", ".pem", ".key"];
var BLOCKED_SEGMENTS = /* @__PURE__ */ new Set([".git"]);
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
function shouldBlockPath(rawPath) {
  const candidates = [rawPath, safeDecode(rawPath)].map((value) => value.toLowerCase());
  return candidates.some((candidate) => {
    if (candidate === "/uploads" || candidate.startsWith("/uploads/")) {
      return true;
    }
    const segments = candidate.split("/").filter(Boolean);
    return segments.some((segment) => BLOCKED_SEGMENTS.has(segment) || BLOCKED_SUFFIXES.some((suffix) => segment.endsWith(suffix)));
  });
}
function blockSensitivePaths(req, res, next) {
  const requestPath = req.originalUrl.split("?")[0] || req.path || "/";
  if (shouldBlockPath(requestPath)) {
    return res.status(404).end();
  }
  next();
}

// server/app.ts
init_logger();
var BRAND_DIR2 = path10.join(PROJECT_ROOT, "data", "brand");
var brandCache = null;
var brandCacheTime = 0;
var BRAND_CACHE_TTL = 36e5;
function invalidateBrandCache() {
  brandCache = null;
  brandCacheTime = 0;
}
async function getBrandSettings() {
  const now = Date.now();
  if (!brandCache || now - brandCacheTime > BRAND_CACHE_TTL) {
    const [siteName, siteLogo, siteFavicon] = await Promise.all([
      getSettingValue("site_name", "SmartTrade AI CRM"),
      getSettingValue("site_logo", "/logo.png"),
      getSettingValue("site_favicon", "")
    ]);
    brandCache = {
      siteName: normalizeBrandText(siteName, "SmartTrade AI CRM"),
      siteLogo: sanitizeBrandAssetUrl(siteLogo, "/logo.png"),
      siteFavicon: sanitizeBrandAssetUrl(siteFavicon, "")
    };
    brandCacheTime = now;
  }
  return brandCache;
}
function injectBrandHtml(html, brand) {
  const faviconLink = brand.siteFavicon ? `<link rel="icon" href="${escapeHtml(brand.siteFavicon)}" />` : '<link rel="icon" href="/logo.png" />';
  return html.replace("<title>SmartTrade AI CRM</title>", `<title>${escapeHtml(brand.siteName)}</title>`).replace("</head>", `${faviconLink}
</head>`);
}
async function createApp() {
  await fs11.mkdir(UPLOADS_DIR, { recursive: true });
  const tempDir = path10.join(UPLOADS_DIR, "temp");
  await fs11.mkdir(tempDir, { recursive: true });
  try {
    const files = await fs11.readdir(tempDir);
    for (const file of files) {
      await fs11.unlink(path10.join(tempDir, file)).catch(() => {
      });
    }
  } catch (e) {
    logger.warn({ err: e }, "Failed to cleanup temp directory on startup");
  }
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        "img-src": ["'self'", "data:", "blob:", "http:", "https:"],
        "connect-src": ["'self'"]
      }
    } : false,
    crossOriginEmbedderPolicy: false
  }));
  app.use(blockSensitivePaths);
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api", api_default);
  app.use("/brand", express.static(BRAND_DIR2, {
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }
  }));
  app.use((err, _req, res, _next) => {
    logger.error({ err }, "[Unhandled Route Error]");
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Internal Server Error" });
  });
  if (process.env.NODE_ENV === "test") {
    return app;
  }
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "127.0.0.1" },
      appType: "spa"
    });
    app.use(async (req, res, next) => {
      if (req.method === "GET" && req.accepts("html")) {
        const originalSend = res.send.bind(res);
        res.send = function(body) {
          if (typeof body === "string" && body.includes("<title>")) {
            getBrandSettings().then((brand) => {
              originalSend(injectBrandHtml(body, brand));
            }).catch(() => originalSend(body));
          } else {
            originalSend(body);
          }
          return res;
        };
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path10.join(PROJECT_ROOT, "dist");
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.includes("/assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "no-store");
        }
      }
    }));
    app.use(async (_req, res) => {
      try {
        const htmlPath = path10.join(distPath, "index.html");
        let html = await fs11.readFile(htmlPath, "utf-8");
        const brand = await getBrandSettings();
        html = injectBrandHtml(html, brand);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.send(html);
      } catch {
        res.sendFile(path10.join(distPath, "index.html"), {
          headers: { "Cache-Control": "no-store" }
        });
      }
    });
  }
  return app;
}

// server/bootstrap.ts
init_db();
import bcrypt3 from "bcryptjs";
var LEGACY_ROOT_PASSWORD = "root";
var PLACEHOLDER_ADMIN_PASSWORD = "replace-with-a-temporary-root-password";
async function bootstrapInitialAdmin() {
  const initialPassword = (process.env.INITIAL_ADMIN_PASSWORD || "").trim();
  const root = await dbGet(
    `SELECT id, password FROM users WHERE username = ?`,
    ["root"]
  );
  if (!root?.password) {
    return;
  }
  const stillUsingLegacyPassword = await bcrypt3.compare(LEGACY_ROOT_PASSWORD, root.password);
  if (!stillUsingLegacyPassword) {
    return;
  }
  if (!initialPassword || initialPassword === PLACEHOLDER_ADMIN_PASSWORD) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("\u751F\u4EA7\u73AF\u5883\u68C0\u6D4B\u5230 root \u4ECD\u4F7F\u7528\u9ED8\u8BA4\u5BC6\u7801\uFF0C\u8BF7\u8BBE\u7F6E INITIAL_ADMIN_PASSWORD \u5B8C\u6210\u521D\u59CB\u5316\u540E\u518D\u542F\u52A8");
    }
    return;
  }
  if (process.env.NODE_ENV === "production" && initialPassword.length < 12) {
    throw new Error("\u751F\u4EA7\u73AF\u5883 INITIAL_ADMIN_PASSWORD \u81F3\u5C11\u9700\u8981 12 \u4F4D");
  }
  const hash = await bcrypt3.hash(initialPassword, 10);
  await dbRun(`UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [hash, root.id]);
}

// server.ts
init_logger();
var DB_DRIVER = (process.env.DB_DRIVER || "sqlite").toLowerCase();
var isPg2 = DB_DRIVER === "pg";
var WEAK_JWT_SECRETS = /* @__PURE__ */ new Set([
  "super-secret-key-for-preview-only",
  "dev-jwt-secret-do-not-use-in-production",
  "replace-with-a-long-random-secret"
]);
function requireProductionEnv() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  const jwtSecret = (process.env.JWT_SECRET || "").trim();
  if (!jwtSecret || WEAK_JWT_SECRETS.has(jwtSecret) || jwtSecret.length < 32) {
    throw new Error("\u751F\u4EA7\u73AF\u5883\u5FC5\u987B\u8BBE\u7F6E\u957F\u5EA6\u81F3\u5C11 32 \u4F4D\u7684\u5F3A\u968F\u673A JWT_SECRET");
  }
  if (process.env.COOKIE_SECURE !== "true" && process.env.ALLOW_INSECURE_COOKIES !== "true") {
    throw new Error("\u751F\u4EA7\u73AF\u5883\u5FC5\u987B\u542F\u7528 COOKIE_SECURE=true\uFF1B\u4EC5\u672C\u5730/LAN HTTP \u8C03\u8BD5\u53EF\u663E\u5F0F\u8BBE\u7F6E ALLOW_INSECURE_COOKIES=true");
  }
}
var dbCloseHandler = null;
function onClose(fn) {
  dbCloseHandler = fn;
}
async function closeDatabase() {
  if (dbCloseHandler) await dbCloseHandler();
}
async function startServer() {
  requireProductionEnv();
  if (isPg2) {
    const { initPgTables: initPgTables2 } = await Promise.resolve().then(() => (init_db_pg(), db_pg_exports));
    await initPgTables2();
  } else {
    const { initSqliteDatabase: initSqliteDatabase2, closeSqliteDatabase: closeSqliteDatabase2 } = await Promise.resolve().then(() => (init_db_sqlite(), db_sqlite_exports));
    initSqliteDatabase2();
    onClose(async () => {
      closeSqliteDatabase2();
    });
  }
  await bootstrapInitialAdmin();
  const app = await createApp();
  const PORT = Number(process.env.PORT) || 3e3;
  const HOST = process.env.HOST || "0.0.0.0";
  const { createServer } = await import("http");
  const { initSocket: initSocket2 } = await Promise.resolve().then(() => (init_socket(), socket_exports));
  const httpServer = createServer(app);
  initSocket2(httpServer);
  const server = httpServer.listen(PORT, HOST, () => {
    logger.info(`Mode: ${process.env.NODE_ENV === "production" ? "production" : "development"}`);
    if (isPg2) {
      const dbHost = process.env.PG_HOST || "127.0.0.1";
      const dbName = process.env.PG_DATABASE || "smarttrade_crm";
      logger.info(`Database: PostgreSQL ${dbHost}/${dbName}`);
    } else {
      logger.info(`Database: SQLite (${process.env.SQLITE_PATH || "data/crm.db"})`);
    }
    logger.info(`Uploads: ${UPLOADS_DIR}`);
    logger.info(`Local: http://localhost:${PORT}`);
    if (HOST === "0.0.0.0") {
      logger.info(`LAN: http://<this-machine-ip>:${PORT}`);
    } else {
      logger.info(`Host: http://${HOST}:${PORT}`);
    }
  });
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      logger.error(`Port ${PORT} is already in use. Stop the existing service or set a different PORT.`);
    } else if (error.code === "EPERM") {
      logger.error(`Permission denied while listening on ${HOST}:${PORT}. Try another PORT/HOST or run from a normal terminal.`);
    } else {
      logger.error({ err: error }, "Server error");
    }
    process.exit(1);
  });
}
startServer().catch((error) => {
  logger.error({ err: error }, "Failed to start server");
  process.exit(1);
});
export {
  closeDatabase,
  onClose
};
