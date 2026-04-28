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
import { getSettingValue } from './services/settings.js';

const BRAND_DIR = path.join(PROJECT_ROOT, 'data', 'brand');

let brandCache: { siteName: string; siteLogo: string; siteFavicon: string } | null = null;
let brandCacheTime = 0;
const BRAND_CACHE_TTL = 5000; // 5 seconds

async function getBrandSettings() {
  const now = Date.now();
  if (!brandCache || now - brandCacheTime > BRAND_CACHE_TTL) {
    const [siteName, siteLogo, siteFavicon] = await Promise.all([
      getSettingValue('site_name', 'SmartTrade AI CRM'),
      getSettingValue('site_logo', '/logo.png'),
      getSettingValue('site_favicon', ''),
    ]);
    brandCache = { siteName, siteLogo, siteFavicon };
    brandCacheTime = now;
  }
  return brandCache;
}

function injectBrandHtml(html: string, brand: { siteName: string; siteLogo: string; siteFavicon: string }) {
  const faviconLink = brand.siteFavicon
    ? `<link rel="icon" href="${brand.siteFavicon}" />`
    : '<link rel="icon" href="/logo.png" />';
  return html
    .replace('<title>SmartTrade AI CRM</title>', `<title>${brand.siteName}</title>`)
    .replace('</head>', `${faviconLink}\n</head>`);
}

export async function createApp() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(path.join(UPLOADS_DIR, 'temp'), { recursive: true });

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
    // Inject brand settings into Vite-served HTML
    app.use(async (req, res, next) => {
      if (req.method === 'GET' && req.accepts('html')) {
        const originalSend = res.send.bind(res);
        res.send = function (body: any) {
          if (typeof body === 'string' && body.includes('<title>')) {
            getBrandSettings().then(brand => {
              originalSend(injectBrandHtml(body, brand));
            }).catch(() => originalSend(body));
          } else {
            originalSend(body);
          }
          return res as any;
        };
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(PROJECT_ROOT, 'dist');
    app.use(express.static(distPath));
    app.use('*', async (_req, res) => {
      try {
        const htmlPath = path.join(distPath, 'index.html');
        let html = await fs.readFile(htmlPath, 'utf-8');
        const brand = await getBrandSettings();
        html = injectBrandHtml(html, brand);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      } catch {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  return app;
}
