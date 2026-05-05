import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import pkg from 'pg';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

const { Pool } = pkg;

describe('Auth Route Integration Tests', () => {
  let app: Awaited<ReturnType<typeof import('../server/app.js').createApp>>;
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  let csrfCookie: string;

  before(async () => {
    // 1. Setup test database
    const setupPool = new Pool({
      host: process.env.PG_HOST || '127.0.0.1',
      port: Number(process.env.PG_PORT) || 5432,
      database: 'postgres',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
    });

    try {
      await setupPool.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = 'smarttrade_crm_test'
        AND pid <> pg_backend_pid();
      `);
      await setupPool.query('DROP DATABASE IF EXISTS smarttrade_crm_test');
      await setupPool.query('CREATE DATABASE smarttrade_crm_test');
    } finally {
      await setupPool.end();
    }

    process.env.PG_DATABASE = 'smarttrade_crm_test';
    process.env.JWT_SECRET = 'test-secret-for-auth-tests';
    process.env.NODE_ENV = 'test';

    const { initPgTables } = await import('../server/db-pg.js');
    await initPgTables();

    // Insert a test user with a known password
    const { dbRun } = await import('../server/lib/db.js');
    const passwordHash = await bcrypt.hash('TestPass123', 10);
    await dbRun(
      `INSERT INTO users (username, password, role, name, active) VALUES (?, ?, ?, ?, ?)`,
      ['testuser', passwordHash, 'staff', 'Test User', 1],
    );
    // Insert an admin user
    const adminHash = await bcrypt.hash('AdminPass456', 10);
    await dbRun(
      `INSERT INTO users (username, password, role, name, active) VALUES (?, ?, ?, ?, ?)`,
      ['adminuser', adminHash, 'admin', 'Admin User', 1],
    );

    const { createApp } = await import('../server/app.js');
    app = await createApp();
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error: any) => error ? reject(error) : resolve())
      );
    }
    const { default: activePool } = await import('../server/db-pg.js');
    await activePool.end();
  });

  function startServer(): Promise<void> {
    return new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  }

  async function doLogin(username: string, password: string) {
    // First, hit /api/settings/basic to get CSRF cookie
    const csrfResp = await fetch(`${baseUrl}/api/settings/basic`);
    const setCookieHeader = csrfResp.headers.get('set-cookie') || '';
    const csrfMatch = setCookieHeader.match(/csrf_token=([^;]+)/);
    csrfCookie = csrfMatch ? csrfMatch[1] : '';

    const loginResp = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfCookie ? { 'X-CSRF-Token': csrfCookie } : {}),
      },
      body: JSON.stringify({ username, password }),
    });
    return loginResp;
  }

  // ──────────────────────────────────────────────
  // Tests
  // ──────────────────────────────────────────────

  test('POST /api/auth/login — success with valid credentials', async () => {
    await startServer();
    const loginResp = await doLogin('testuser', 'TestPass123');

    assert.strictEqual(loginResp.status, 200);
    const body = await loginResp.json() as any;
    assert.ok(body.user, 'Response should include user object');
    assert.strictEqual(body.user.username, 'testuser');
    assert.strictEqual(body.user.role, 'staff');
    assert.strictEqual(body.user.name, 'Test User');

    // Should have set auth cookie and CSRF cookie
    const cookies = loginResp.headers.get('set-cookie') || '';
    assert.ok(cookies.includes('token='), 'Should set auth cookie');
    assert.ok(cookies.includes('csrf_token='), 'Should set CSRF cookie');
  });

  test('POST /api/auth/login — fails with wrong password', async () => {
    const resp = await doLogin('testuser', 'WrongPassword!!');
    assert.strictEqual(resp.status, 401);
    const body = await resp.json() as any;
    assert.ok(body.error, 'Should return error object');
  });

  test('POST /api/auth/login — fails with nonexistent user', async () => {
    const resp = await doLogin('nonexistent', 'SomePassword1');
    assert.strictEqual(resp.status, 401);
  });

  test('POST /api/auth/login — fails with empty credentials', async () => {
    const resp = await doLogin('', '');
    assert.strictEqual(resp.status, 400);
  });

  test('GET /api/auth/me — returns current user when authenticated', async () => {
    // Login first
    const loginResp = await doLogin('adminuser', 'AdminPass456');
    const setCookie = loginResp.headers.get('set-cookie') || '';

    // Extract auth cookie
    const tokenMatch = setCookie.match(/token=([^;]+)/);
    const authCookie = tokenMatch ? `token=${tokenMatch[1]}` : '';

    const meResp = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: authCookie },
    });
    assert.strictEqual(meResp.status, 200);
    const body = await meResp.json() as any;
    assert.strictEqual(body.user.username, 'adminuser');
    assert.strictEqual(body.user.role, 'admin');
  });

  test('GET /api/auth/me — returns 401 when not authenticated', async () => {
    const resp = await fetch(`${baseUrl}/api/auth/me`);
    assert.strictEqual(resp.status, 401);
  });

  test('POST /api/auth/logout — invalidates token', async () => {
    // Login
    const loginResp = await doLogin('testuser', 'TestPass123');
    const setCookie = loginResp.headers.get('set-cookie') || '';
    const tokenMatch = setCookie.match(/token=([^;]+)/);
    const authCookie = `token=${tokenMatch![1]}`;
    const csrfValue = setCookie.match(/csrf_token=([^;]+)/)?.[1] || '';

    // Logout
    const logoutResp = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: authCookie,
        'X-CSRF-Token': csrfValue,
      },
    });
    assert.strictEqual(logoutResp.status, 200);

    // Token should now be invalidated (token_version incremented)
    const meResp = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: authCookie },
    });
    assert.strictEqual(meResp.status, 401);
  });

  test('CSRF protection blocks requests without token', async () => {
    // Login to get auth cookie
    const loginResp = await doLogin('testuser', 'TestPass123');
    const setCookie = loginResp.headers.get('set-cookie') || '';
    const tokenMatch = setCookie.match(/token=([^;]+)/);
    const authCookie = `token=${tokenMatch![1]}`;

    // POST without CSRF token should fail
    const resp = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: authCookie },
    });
    assert.strictEqual(resp.status, 403);
    const body = await resp.json() as any;
    // Should indicate CSRF
    const errStr = typeof body.error === 'string' ? body.error : body.error?.message || '';
    assert.ok(errStr.includes('CSRF') || errStr.includes('安全'), 'Should mention CSRF/安全验证');
  });

  test('Rate limiting on login endpoint', async () => {
    // Rapid login attempts should eventually be rate limited
    // (We count from the beginning; need enough attempts to hit the limit)
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testuser', password: 'WrongPassword' }),
        })
      );
    }
    const results = await Promise.all(promises);
    const rateLimited = results.some(r => r.status === 429);
    assert.ok(rateLimited, 'Some requests should be rate limited (429)');
  });
});
