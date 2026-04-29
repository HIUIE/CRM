import 'dotenv/config';
import { createApp } from './server/app.js';
import { initPgTables } from './server/db-pg.js';
import { UPLOADS_DIR } from './server/paths.js';
import { logger } from './server/lib/logger.js';

function requireProductionEnv() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'super-secret-key-for-preview-only') {
    throw new Error('生产环境必须设置 JWT_SECRET');
  }
}

async function startServer() {
  requireProductionEnv();
  const dbHost = process.env.PG_HOST || 'localhost';
  const dbName = process.env.PG_DATABASE || 'smarttrade_crm';
  await initPgTables();

  const app = await createApp();
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  const server = app.listen(PORT, HOST, () => {
    logger.info(`Mode: ${process.env.NODE_ENV === 'production' ? 'production' : 'development'}`);
    logger.info(`Database: PostgreSQL ${dbHost}/${dbName}`);
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
