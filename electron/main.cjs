const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

// ── Config ────────────────────────────────────────────────────────
const isDev = !app.isPackaged;
const PORT = process.env.PORT || 3000;
const SERVER_URL = `http://localhost:${PORT}`;

// Set env before importing server (server.ts reads these on startup)
process.env.HOST = '127.0.0.1';
process.env.PORT = String(PORT);
process.env.NODE_ENV = isDev ? 'development' : 'production';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'electron-desktop-app-jwt-secret-min-32-chars!!';
process.env.ALLOW_INSECURE_COOKIES = 'true';
process.env.UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(app.getPath('userData'), 'uploads');

let mainWindow = null;

// ── Wait for server to be ready ────────────────────────────────────
function waitForServer(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = () => {
      http.get(`${SERVER_URL}/api/health`, (res) => {
        if (res.statusCode === 200) return resolve();
        retry();
      }).on('error', retry);

      function retry() {
        if (Date.now() - start > timeoutMs) {
          return reject(new Error('Server did not start within 30s'));
        }
        setTimeout(poll, 300);
      }
    };
    poll();
  });
}

// ── Window ─────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'SmartTrade CRM',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App lifecycle ──────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    // Dynamic import of server.ts — tsx/esm loader handles TypeScript
    // server.ts auto-starts on import (calls startServer() at top level)
    await import('../server.ts');

    await waitForServer();
    createWindow();
  } catch (err) {
    console.error('[electron] Startup failed:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
