import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs/promises';
import cookieParser from 'cookie-parser';
import apiRouter from './api.js';
import { PROJECT_ROOT, UPLOADS_DIR } from './paths.js';

export async function createApp() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/api', apiRouter);

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
