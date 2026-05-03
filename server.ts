import 'dotenv/config';
import { createApp } from './server/app.js';
import { bootstrapInitialAdmin } from './server/bootstrap.js';
import { UPLOADS_DIR } from './server/paths.js';
import { logger } from './server/lib/logger.js';
import { startAutoBackupScheduler } from './server/services/backup.js';

const DB_DRIVER = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
const isPg = DB_DRIVER === 'pg';

const WEAK_JWT_SECRETS = new Set([
  'super-secret-key-for-preview-only',
  'dev-jwt-secret-do-not-use-in-production',
  'replace-with-a-long-random-secret',
  'local-development-jwt-secret-change-me-2026-04-30',
]);

function checkWeakSecrets() {
  const jwtSecret = (process.env.JWT_SECRET || '').trim();
  if (jwtSecret && WEAK_JWT_SECRETS.has(jwtSecret)) {
    throw new Error('JWT_SECRET 使用了已知弱密钥，请更换为强随机字符串 (openssl rand -base64 48)');
  }
  if (process.env.NODE_ENV !== 'production' && jwtSecret && jwtSecret.length < 32) {
    logger.warn('JWT_SECRET 长度不足 32 位，生产环境将被拒绝启动');
  }
}

function requireProductionEnv() {
  if (process.env.NODE_ENV !== 'production') {
    checkWeakSecrets();
    return;
  }
  const jwtSecret = (process.env.JWT_SECRET || '').trim();
  if (!jwtSecret || WEAK_JWT_SECRETS.has(jwtSecret) || jwtSecret.length < 32) {
    throw new Error('生产环境必须设置长度至少 32 位的强随机 JWT_SECRET');
  }
  if (process.env.COOKIE_SECURE !== 'true' && process.env.ALLOW_INSECURE_COOKIES !== 'true') {
    throw new Error('生产环境必须启用 COOKIE_SECURE=true；仅本地/LAN HTTP 调试可显式设置 ALLOW_INSECURE_COOKIES=true');
  }
}

let dbCloseHandler: (() => Promise<void>) | null = null;

export function onClose(fn: () => Promise<void>) {
  dbCloseHandler = fn;
}

export async function closeDatabase() {
  if (dbCloseHandler) await dbCloseHandler();
}

async function startServer() {
  requireProductionEnv();

  // ── Database init ──────────────────────────────────────────────
  if (isPg) {
    const { initPgTables } = await import('./server/db-pg.js');
    await initPgTables();
  } else {
    const { initSqliteDatabase, closeSqliteDatabase } = await import('./server/db-sqlite.js');
    initSqliteDatabase();
    onClose(async () => { closeSqliteDatabase(); });
  }

  await bootstrapInitialAdmin();
  await startAutoBackupScheduler();

  // Background audit-log pruning (once per day)
  const { dbRun } = await import('./server/lib/db.js');
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    dbRun(`DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '30 days'`).catch(() => {});
  }, ONE_DAY_MS).unref();

  const app = await createApp();
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '127.0.0.1';

  const { createServer } = await import('http');
  const { initSocket } = await import('./server/lib/socket.js');

  const httpServer = createServer(app);
  initSocket(httpServer);

  const server = httpServer.listen(PORT, HOST, () => {
    logger.info(`Mode: ${process.env.NODE_ENV === 'production' ? 'production' : 'development'}`);
    if (isPg) {
      const dbHost = process.env.PG_HOST || '127.0.0.1';
      const dbName = process.env.PG_DATABASE || 'smarttrade_crm';
      logger.info(`Database: PostgreSQL ${dbHost}/${dbName}`);
    } else {
      logger.info(`Database: SQLite (${process.env.SQLITE_PATH || 'data/crm.db'})`);
    }
    logger.info(`Uploads: ${UPLOADS_DIR}`);
    logger.info(`Local: http://localhost:${PORT}`);
    if (HOST === '0.0.0.0') {
      logger.info(`LAN: http://<this-machine-ip>:${PORT}`);
    } else {
      logger.info(`Host: http://${HOST}:${PORT}`);
    }
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Stop the existing service or set a different PORT.`);
    } else if (error.code === 'EPERM') {
      logger.error(`Permission denied while listening on ${HOST}:${PORT}. Try another PORT/HOST or run from a normal terminal.`);
    } else {
      logger.error({ err: error }, 'Server error');
    }
    process.exit(1);
  });
}

startServer().catch((error) => {
  logger.error({ err: error }, 'Failed to start server');
  process.exit(1);
});
