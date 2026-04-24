import { db } from '../db.js';

export async function getSettingValue(key: string, fallback = '') {
  const setting = await db.get<{ value: string }>(`SELECT value FROM settings WHERE key = ?`, [key]);
  return setting?.value || fallback;
}

export async function setSettingValue(key: string, value: string) {
  await db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function getOrderNumberPrefix() {
  const rawValue = (await getSettingValue('order_number_prefix', 'ORD-')).trim();
  return rawValue || 'ORD-';
}
