const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let serverProcess = null;

const isDev = process.env.NODE_ENV !== 'production' || process.argv.includes('--dev');
const PORT = process.env.PORT || 3000;
const SERVER_URL = `http://localhost:${PORT}`;

function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', 'server.ts');

    serverProcess = spawn('npx', ['tsx', serverPath], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(PORT),
        DB_DRIVER: 'sqlite',
        HOST: '127.0.0.1',
        NODE_ENV: isDev ? 'development' : 'production',
        SQLITE_PATH: path.join(app.getPath('userData'), 'data', 'crm.db'),
        UPLOADS_DIR: path.join(app.getPath('userData'), 'uploads'),
        JWT_SECRET: process.env.JWT_SECRET || 'electron-desktop-app-jwt-secret-min-32-chars!!',
        ALLOW_INSECURE_COOKIES: 'true',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(text);

      if (text.includes('Local:') || text.includes('listening')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    serverProcess.on('error', reject);
    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Fallback: poll health endpoint
    let attempts = 0;
    const pollInterval = setInterval(() => {
      attempts++;
      http.get(`${SERVER_URL}/api/health`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(pollInterval);
          resolve();
        }
      }).on('error', () => {
        // Server not ready yet
      });

      if (attempts > 60) {
        clearInterval(pollInterval);
        reject(new Error('Server failed to start within 30 seconds'));
      }
    }, 500);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

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

app.whenReady().then(async () => {
  try {
    console.log('[electron] Starting server...');
    await startServer();
    console.log('[electron] Server ready, creating window...');
    createWindow();
  } catch (err) {
    console.error('[electron] Failed to start:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});

app.on('before-quit', () => {
  stopServer();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
