import 'dotenv/config';
import { createApp } from './server/app.js';
import { initPgTables } from './server/db-pg.js';
import { UPLOADS_DIR } from './server/paths.js';

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
    console.log(`Mode: ${process.env.NODE_ENV === 'production' ? 'production' : 'development'}`);
    console.log(`Database: PostgreSQL ${dbHost}/${dbName}`);
    console.log(`Uploads: ${UPLOADS_DIR}`);
    console.log(`Local: http://localhost:${PORT}`);
    if (HOST === '0.0.0.0') {
      console.log(`LAN: http://<this-machine-ip>:${PORT}`);
    } else {
      console.log(`Host: http://${HOST}:${PORT}`);
    }
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the existing service or set a different PORT.`);
    } else if (error.code === 'EPERM') {
      console.error(`Permission denied while listening on ${HOST}:${PORT}. Try another PORT/HOST or run from a normal terminal.`);
    } else {
      console.error(error);
    }
    process.exit(1);
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
