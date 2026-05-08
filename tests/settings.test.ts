import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import pkg from 'pg';

const { Pool } = pkg;

describe('Settings Service Integration Tests', () => {
  before(async () => {
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
    process.env.JWT_SECRET = 'test-secret-for-settings-tests';
    process.env.NODE_ENV = 'test';

    const { initPgTables } = await import('../server/db-pg.js');
    await initPgTables();
  });

  after(async () => {
    const { default: activePool } = await import('../server/db-pg.js');
    await activePool.end();
  });

  test('getSettingValue returns fallback when key does not exist', async () => {
    const { getSettingValue } = await import('../server/services/settings.js');
    const value = await getSettingValue('nonexistent_key', 'default_val');
    assert.strictEqual(value, 'default_val');
  });

  test('setSettingValue and getSettingValue round-trip', async () => {
    const { setSettingValue, getSettingValue } = await import('../server/services/settings.js');

    await setSettingValue('test_key', 'test_value');
    const value = await getSettingValue('test_key');
    assert.strictEqual(value, 'test_value');
  });

  test('setSettingValue overwrites existing value', async () => {
    const { setSettingValue, getSettingValue } = await import('../server/services/settings.js');

    await setSettingValue('test_overwrite', 'first_value');
    await setSettingValue('test_overwrite', 'second_value');
    const value = await getSettingValue('test_overwrite');
    assert.strictEqual(value, 'second_value');
  });

  test('sensitive keys (ai_api_key) are encrypted at rest', async () => {
    const { setSettingValue, getSettingValue } = await import('../server/services/settings.js');
    const { dbGet } = await import('../server/lib/db.js');

    const apiKey = 'sk-abc123-secret-key-value';
    await setSettingValue('ai_api_key', apiKey);

    // Read back through service (decrypted)
    const decrypted = await getSettingValue('ai_api_key');
    assert.strictEqual(decrypted, apiKey, 'Service should return decrypted value');

    // Read raw from DB (should be encrypted, not plaintext)
    const raw = await dbGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['ai_api_key']);
    assert.ok(raw, 'Raw row should exist');
    assert.notStrictEqual(raw.value, apiKey, 'Raw DB value should NOT be plaintext');
    assert.match(raw.value, /^[A-Za-z0-9+/]+={0,2}$/, 'Encrypted value should be base64');
  });

  test('sensitive keys (webhook_secret) are encrypted at rest', async () => {
    const { setSettingValue, getSettingValue } = await import('../server/services/settings.js');
    const { dbGet } = await import('../server/lib/db.js');

    const secret = 'whsec_my_webhook_secret_12345';
    await setSettingValue('webhook_secret', secret);

    const decrypted = await getSettingValue('webhook_secret');
    assert.strictEqual(decrypted, secret);

    const raw = await dbGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['webhook_secret']);
    assert.notStrictEqual(raw!.value, secret);
  });

  test('non-sensitive keys are stored as plaintext', async () => {
    const { setSettingValue } = await import('../server/services/settings.js');
    const { dbGet } = await import('../server/lib/db.js');

    await setSettingValue('site_name', 'My Company CRM');
    const raw = await dbGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['site_name']);
    assert.strictEqual(raw!.value, 'My Company CRM', 'Non-sensitive settings should be plaintext');
  });

  test('getOrderNumberPrefix returns default when not set', async () => {
    const { getOrderNumberPrefix } = await import('../server/services/settings.js');
    const prefix = await getOrderNumberPrefix();
    assert.strictEqual(prefix, 'ORD-');
  });

  test('getOrderNumberPrefix returns custom value when set', async () => {
    const { setSettingValue, getOrderNumberPrefix } = await import('../server/services/settings.js');
    await setSettingValue('order_number_prefix', 'CQBX-');
    const prefix = await getOrderNumberPrefix();
    assert.strictEqual(prefix, 'CQBX-');
  });
});
