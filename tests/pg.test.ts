import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import pkg from 'pg';
import type { AddressInfo } from 'node:net';

const { Pool } = pkg;

describe('PostgreSQL Integration Tests', () => {
  before(async () => {
    // 1. Setup the test database
    const setupPool = new Pool({
      host: process.env.PG_HOST || '127.0.0.1',
      port: Number(process.env.PG_PORT) || 5432,
      database: 'postgres', // connect to default db to manage databases
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
    });
    
    try {
      // Disconnect other sessions to drop database cleanly if needed
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

    // 2. Override process.env so backend imports use the test database
    process.env.PG_DATABASE = 'smarttrade_crm_test';
    process.env.JWT_SECRET = 'test-secret-for-integration-tests';
    // Mute migration logs during tests
    process.env.NODE_ENV = 'test';

    // 3. Import and run migrations
    const { initPgTables } = await import('../server/db-pg.js');
    await initPgTables();
  });

  after(async () => {
    // Close the pool used by the application
    const { default: activePool } = await import('../server/db-pg.js');
    await activePool.end();
  });

  test('Database connection and migration verification', async () => {
    const { dbTableInfo } = await import('../server/lib/db.js');
    
    const usersTable = await dbTableInfo('users');
    assert.ok(usersTable.length > 0, 'Users table should be created by migrations');
    
    const hasActiveCol = usersTable.some(col => col.name === 'active');
    assert.ok(hasActiveCol, 'Users table should have the active column');
  });

  test('CRUD operations via db helper (dbRun, dbGet, dbAll)', async () => {
    const { dbRun, dbGet, dbAll } = await import('../server/lib/db.js');
    
    // Clear out settings table (default initial data might exist)
    await dbRun('DELETE FROM settings');

    // 1. Create (dbRun)
    const insertResult = await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', ['theme', 'dark']);
    assert.strictEqual(insertResult.changes, 1, 'Should insert exactly 1 row');

    // 2. Read One (dbGet)
    const row = await dbGet<{ key: string; value: string }>('SELECT * FROM settings WHERE key = ?', ['theme']);
    assert.ok(row, 'Should return the inserted row');
    assert.strictEqual(row.value, 'dark', 'Value should match');

    // 3. Read Multiple (dbAll)
    await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', ['language', 'zh-CN']);
    const rows = await dbAll<{ key: string; value: string }[]>('SELECT * FROM settings ORDER BY key ASC');
    assert.strictEqual(rows.length, 2, 'Should return exactly 2 rows');
    assert.strictEqual(rows[0].key, 'language');
    assert.strictEqual(rows[1].key, 'theme');

    // 4. Update
    const updateResult = await dbRun('UPDATE settings SET value = ? WHERE key = ?', ['light', 'theme']);
    assert.strictEqual(updateResult.changes, 1, 'Should update 1 row');
    const updatedRow = await dbGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['theme']);
    assert.strictEqual(updatedRow?.value, 'light', 'Value should be updated');

    // 5. Delete
    const deleteResult = await dbRun('DELETE FROM settings WHERE key = ?', ['theme']);
    assert.strictEqual(deleteResult.changes, 1, 'Should delete 1 row');
  });

  test('Transaction management (withTransaction)', async () => {
    const { dbRun, dbGet, withTransaction } = await import('../server/lib/db.js');
    
    // Test successful transaction
    await withTransaction(async (tx) => {
      await tx.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['tx_key1', 'v1']);
      await tx.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['tx_key2', 'v2']);
    });
    
    const row1 = await dbGet('SELECT * FROM settings WHERE key = ?', ['tx_key1']);
    assert.ok(row1, 'Row 1 should be committed');
    
    // Test aborted transaction (rollback)
    try {
      await withTransaction(async (tx) => {
        await tx.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['tx_key3', 'v3']);
        // Trigger an intentional error
        throw new Error('Intentional rollback');
      });
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.strictEqual(err.message, 'Intentional rollback');
    }
    
    const row3 = await dbGet('SELECT * FROM settings WHERE key = ?', ['tx_key3']);
    assert.strictEqual(row3, undefined, 'Row 3 should NOT be committed due to rollback');
  });

  test('JSONB functionality for order_profits', async () => {
    const { dbRun, dbGet } = await import('../server/lib/db.js');
    
    // Insert a mock customer and order to satisfy foreign keys
    const customerInsert = await dbRun('INSERT INTO customers (display_id, name) VALUES (?, ?) RETURNING id', ['C001', 'Test Customer']);
    const customerId = (await dbGet('SELECT id FROM customers WHERE display_id = ?', ['C001'])).id;
    
    await dbRun('INSERT INTO orders (id, display_id, customer_id) VALUES (?, ?, ?)', [999, 'ORD-TEST', customerId]);

    const profitData = { receipts: [], invoiceAmount: 1000, refundRate: 13 };
    
    // Test inserting JSONB via stringify
    await dbRun(
      'INSERT INTO order_profits (order_id, data) VALUES (?, ?)', 
      [999, JSON.stringify(profitData)]
    );
    
    // Read it back
    const profitRow = await dbGet<{ data: any }>('SELECT data FROM order_profits WHERE order_id = ?', [999]);
    assert.ok(profitRow);
    
    // node-pg parses JSON/JSONB natively
    const parsed = typeof profitRow.data === 'string' ? JSON.parse(profitRow.data) : profitRow.data;
    assert.strictEqual(parsed.invoiceAmount, 1000, 'JSONB data should be accurately preserved');
  });

  test('Soft-deleted orders are hidden from customer 360 and order detail', async () => {
    const { dbRun, dbGet } = await import('../server/lib/db.js');
    const { buildOrderDetail } = await import('../server/services/order-detail.js');

    await dbRun('INSERT INTO customers (display_id, name, country) VALUES (?, ?, ?)', ['C-SOFT-001', 'Soft Delete Customer', 'CN']);
    const customer = await dbGet<{ id: number }>('SELECT id FROM customers WHERE display_id = ?', ['C-SOFT-001']);
    assert.ok(customer);

    await dbRun(
      'INSERT INTO orders (display_id, customer_id, status, total_amount, product_summary, deleted_at) VALUES (?, ?, ?, ?, ?, NOW())',
      ['ORD-SOFT-001', customer.id, 'draft', 100, 'Hidden product'],
    );

    const orderDetail = await buildOrderDetail('ORD-SOFT-001');
    assert.strictEqual(orderDetail, null, 'Soft-deleted order detail should not be readable');

    const activeOrderCount = await dbGet<{ count: number }>(
      'SELECT COUNT(*) AS count FROM orders WHERE customer_id = ? AND deleted_at IS NULL',
      [customer.id],
    );
    assert.strictEqual(Number(activeOrderCount?.count || 0), 0, 'Soft-deleted orders should not block customer deletion');
  });

  test('Dashboard endpoint excludes soft-deleted orders without SQL errors', async () => {
    const { dbRun, dbGet } = await import('../server/lib/db.js');
    const bcrypt = await import('bcryptjs');
    const { createApp } = await import('../server/app.js');

    const passwordHash = await bcrypt.hash('dashboard-pass', 10);
    await dbRun(
      'INSERT INTO users (username, password, role, name, active) VALUES (?, ?, ?, ?, ?)',
      ['dashboard-admin', passwordHash, 'admin', 'Dashboard Admin', 1],
    );
    await dbRun('INSERT INTO customers (display_id, name, country) VALUES (?, ?, ?)', ['C-DASH-001', 'Dashboard Customer', 'CN']);
    const customer = await dbGet<{ id: number }>('SELECT id FROM customers WHERE display_id = ?', ['C-DASH-001']);
    assert.ok(customer);
    await dbRun(
      'INSERT INTO orders (display_id, customer_id, status, total_amount, product_summary, deleted_at) VALUES (?, ?, ?, ?, ?, NOW())',
      ['ORD-DASH-DELETED', customer.id, 'shipping', 200, 'Deleted dashboard product'],
    );
    const activeOrderCount = await dbGet<{ count: number }>('SELECT COUNT(*) AS count FROM orders WHERE deleted_at IS NULL');

    const app = await createApp();
    const server = app.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      const loginResponse = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'dashboard-admin', password: 'dashboard-pass' }),
      });
      assert.strictEqual(loginResponse.status, 200);
      const cookie = loginResponse.headers.get('set-cookie')?.match(/token=[^;]+/)?.[0];
      assert.ok(cookie, 'Login should set auth cookie');

      const dashboardResponse = await fetch(`http://127.0.0.1:${port}/api/dashboard`, {
        headers: { Cookie: cookie },
      });
      assert.strictEqual(dashboardResponse.status, 200);
      const dashboard = await dashboardResponse.json() as { overview: { totalOrders: number }; activities: Array<{ order_display_id?: string }> };
      assert.strictEqual(Number(dashboard.overview.totalOrders), Number(activeOrderCount?.count || 0));
      assert.ok(!dashboard.activities.some((item) => item.order_display_id === 'ORD-DASH-DELETED'));
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
