import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

const port = Number(process.env.SMOKE_PORT || 3137);
const baseUrl = `http://127.0.0.1:${port}`;
const rootPassword = 'smoke-root-password';

type CookieJar = {
  cookie: string;
};

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
    child.on('error', reject);
  });
}

class SmokeSkipped extends Error {}

function startServer(env: NodeJS.ProcessEnv) {
  let logs = '';
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    logs += String(chunk);
    process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    logs += String(chunk);
    process.stderr.write(chunk);
  });
  return {
    child,
    getLogs: () => logs,
  };
}

async function waitForHealth(server: ReturnType<typeof startServer>) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (server.child.exitCode !== null) {
      const logs = server.getLogs();
      if (logs.includes('listen EPERM') || logs.includes('Permission denied while listening')) {
        throw new SmokeSkipped('Current environment does not allow listening on a local port; network smoke skipped.');
      }
      throw new Error(`Production server exited early with code ${server.child.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Timed out waiting for production server');
}

async function request(pathname: string, jar?: CookieJar, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (jar?.cookie) {
    headers.set('Cookie', jar.cookie);
  }
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${pathname} returned ${response.status}: ${body.slice(0, 300)}`);
  }
  return response;
}

async function login(username: string, password: string) {
  const response = await request('/api/auth/login', undefined, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) {
    throw new Error(`Login for ${username} did not set auth cookie`);
  }
  return { cookie };
}

async function assertSpaRoute(pathname: string, jar: CookieJar) {
  const response = await request(pathname, jar);
  const html = await response.text();
  if (!html.includes('<div id="root"></div>')) {
    throw new Error(`${pathname} did not return the SPA shell`);
  }
}

async function getSmokeOrderPath(jar: CookieJar) {
  const response = await request('/api/orders', jar);
  const orders = await response.json() as Array<{ display_id?: string; id?: number }>;
  const order = orders.find((item) => item.display_id || item.id);
  if (!order) {
    throw new Error('Smoke seed did not create any orders');
  }
  return `/orders/${encodeURIComponent(String(order.display_id || order.id))}`;
}

async function runHttpSmoke() {
  const admin = await login('root', rootPassword);
  await request('/api/auth/me', admin);
  const orderPath = await getSmokeOrderPath(admin);

  for (const route of [
    '/',
    '/dashboard',
    '/customers',
    '/partners',
    '/orders',
    orderPath,
    '/finance',
    '/logistics',
    '/ai',
    '/settings',
    '/help',
  ]) {
    await assertSpaRoute(route, admin);
  }

  for (const endpoint of [
    '/api/health',
    '/api/dashboard',
    '/api/customers',
    '/api/partners',
    '/api/orders',
    `/api${orderPath}`,
    '/api/finance',
    '/api/logistics',
    '/api/settings/ai',
    '/api/settings/document',
    '/api/users',
  ]) {
    await request(endpoint, admin);
  }

  const staff = await login('staff.demo', 'staff123');
  const forbidden = await fetch(`${baseUrl}/api/settings/document`, {
    headers: { Cookie: staff.cookie },
  });
  if (forbidden.status !== 403) {
    throw new Error(`Staff settings access expected 403, got ${forbidden.status}`);
  }
}

async function maybeRunBrowserSmoke() {
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
    const { chromium } = await dynamicImport('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('console', (message: any) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    page.on('pageerror', (error: Error) => errors.push(error.message));
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="text"]', 'root');
    await page.fill('input[type="password"]', rootPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 10000 }).catch(async () => {
      await page.waitForLoadState('networkidle');
    });
    const orderPath = await getSmokeOrderPath({ cookie: await page.context().cookies().then((cookies: any[]) => cookies.map((c) => `${c.name}=${c.value}`).join('; ')) });
    for (const route of ['/dashboard', '/customers', '/partners', '/orders', orderPath, '/finance', '/logistics', '/ai', '/settings', '/help']) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      const rootVisible = await page.locator('#root').isVisible();
      if (!rootVisible) {
        throw new Error(`Browser route ${route} did not render #root`);
      }
    }
    await browser.close();
    if (errors.length) {
      throw new Error(`Browser console errors:\n${errors.join('\n')}`);
    }
    console.log('Browser smoke passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Cannot find package') || message.includes('Executable doesn')) {
      console.warn(`Browser smoke skipped: ${message}`);
      return;
    }
    throw error;
  }
}

async function main() {
  const distIndex = path.join(process.cwd(), 'dist', 'index.html');
  await fs.access(distIndex);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-smoke-'));
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    HOST: '127.0.0.1',
    PG_HOST: process.env.PG_HOST === 'localhost' || !process.env.PG_HOST ? '127.0.0.1' : process.env.PG_HOST,
    UPLOADS_DIR: path.join(tempDir, 'uploads'),
    JWT_SECRET: 'smoke-ui-jwt-secret-for-production-checks-2026',
    INITIAL_ADMIN_PASSWORD: rootPassword,
    COOKIE_SECURE: 'false',
    ALLOW_INSECURE_COOKIES: 'true',
  };

  let server: ReturnType<typeof startServer> | null = null;
  try {
    await run(process.execPath, ['--import', 'tsx', 'scripts/seed-demo.ts'], env);
    server = startServer(env);
    await waitForHealth(server);
    await runHttpSmoke();
    await maybeRunBrowserSmoke();
    console.log('UI smoke passed');
  } catch (error) {
    if (error instanceof SmokeSkipped) {
      console.warn(error.message);
      return;
    }
    throw error;
  } finally {
    if (server) {
      server.child.kill('SIGTERM');
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
