import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs/promises';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import apiRouter from './api.js';
import { escapeHtml, normalizeBrandText, sanitizeBrandAssetUrl } from './lib/brand.js';
import { blockSensitivePaths } from './lib/security.js';
import { PROJECT_ROOT, UPLOADS_DIR } from './paths.js';
import { getSettingValue } from './services/settings.js';
import { logger } from './lib/logger.js';

const BRAND_DIR = path.join(PROJECT_ROOT, 'data', 'brand');

let brandCache: { siteName: string; siteLogo: string; siteFavicon: string } | null = null;
let brandCacheTime = 0;
const BRAND_CACHE_TTL = 3600000; // 1 hour

export function invalidateBrandCache() {
  brandCache = null;
  brandCacheTime = 0;
}

async function getBrandSettings() {
  const now = Date.now();
  if (!brandCache || now - brandCacheTime > BRAND_CACHE_TTL) {
    const [siteName, siteLogo, siteFavicon] = await Promise.all([
      getSettingValue('site_name', 'SmartTrade AI CRM'),
      getSettingValue('site_logo', '/logo.png'),
      getSettingValue('site_favicon', ''),
    ]);
    brandCache = {
      siteName: normalizeBrandText(siteName, 'SmartTrade AI CRM'),
      siteLogo: sanitizeBrandAssetUrl(siteLogo, '/logo.png'),
      siteFavicon: sanitizeBrandAssetUrl(siteFavicon, ''),
    };
    brandCacheTime = now;
  }
  return brandCache;
}

function injectBrandHtml(html: string, brand: { siteName: string; siteLogo: string; siteFavicon: string }) {
  const faviconLink = brand.siteFavicon
    ? `<link rel="icon" href="${escapeHtml(brand.siteFavicon)}" />`
    : '<link rel="icon" href="/logo.png" />';
  return html
    .replace('<title>SmartTrade AI CRM</title>', `<title>${escapeHtml(brand.siteName)}</title>`)
    .replace('</head>', `${faviconLink}\n</head>`);
}

export async function createApp() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const tempDir = path.join(UPLOADS_DIR, 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  
  // Cleanup old temp files on startup
  try {
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      await fs.unlink(path.join(tempDir, file)).catch(() => {});
    }
  } catch (e) {
    logger.warn({ err: e }, 'Failed to cleanup temp directory on startup');
  }

  const app = express();
  app.disable('x-powered-by');
  const cspDirectives = {
    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
    "script-src": ["'self'"],
    "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
    "img-src": ["'self'", "data:", "blob:"],
    "connect-src": ["'self'"],
  };
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production'
      ? { directives: cspDirectives }
      : { directives: cspDirectives, reportOnly: true },
  }));
  app.use(blockSensitivePaths);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRouter);
  app.use('/brand', express.static(BRAND_DIR, {
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    },
  }));

  // Global error handler for uncaught async errors (Express 4 does not catch promise rejections).
  // express-async-errors patches route handlers so rejected promises land here.
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, '[Unhandled Route Error]');
    const status = err.status || 500;
    const clientMessage = process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';
    res.status(status).json({ error: clientMessage });
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
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        // Vite puts hashed assets in the /assets/ folder, they are immutable
        if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          // HTML and other root files must never be cached — stale HTML points to dead assets after updates
          res.setHeader('Cache-Control', 'no-store');
        }
      }
    }));
    app.use(async (req, res) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Endpoint not found' });
        return;
      }
      try {
        const htmlPath = path.join(distPath, 'index.html');
        let html = await fs.readFile(htmlPath, 'utf-8');
        const brand = await getBrandSettings();
        html = injectBrandHtml(html, brand);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.send(html);
      } catch {
        res.sendFile(path.join(distPath, 'index.html'), {
          headers: { 'Cache-Control': 'no-store' },
        });
      }
    });
  }

  return app;
}
