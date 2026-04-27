import 'express-async-errors';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs/promises';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import apiRouter from './api.js';
import { blockSensitivePaths } from './lib/security.js';
import { PROJECT_ROOT, UPLOADS_DIR } from './paths.js';

const BRAND_DIR = path.join(PROJECT_ROOT, 'data', 'brand');

export async function createApp() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(blockSensitivePaths);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRouter);
  app.use('/brand', express.static(BRAND_DIR));

  // Global error handler for uncaught async errors (Express 4 does not catch promise rejections).
  // express-async-errors patches route handlers so rejected promises land here.
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Unhandled Route Error]', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal Server Error' });
  });

  if (process.env.NODE_ENV === 'test') {
    return app;
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '127.0.0.1' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(PROJECT_ROOT, 'dist');
    app.use(express.static(distPath));
    app.use('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}
