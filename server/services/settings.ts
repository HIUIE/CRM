import { dbGet, dbRun } from '../lib/db.js';
import { decrypt, encrypt } from '../lib/security.js';

const SENSITIVE_KEYS = new Set(['ai_api_key', 'webhook_secret']);

export async function getSettingValue(key: string, fallback = '') {
  const setting = await dbGet<{ value: string }>(`SELECT value FROM settings WHERE key = ?`, [key]);
  const value = setting?.value || fallback;
  
  if (SENSITIVE_KEYS.has(key)) {
    return decrypt(value);
  }
  return value;
}

export async function setSettingValue(key: string, value: string) {
  let valueToStore = value;
  if (SENSITIVE_KEYS.has(key)) {
    valueToStore = encrypt(value);
  }

  await dbRun(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, valueToStore],
  );
}

export async function getOrderNumberPrefix() {
  const rawValue = (await getSettingValue('order_number_prefix', 'ORD-')).trim();
  return rawValue || 'ORD-';
}
