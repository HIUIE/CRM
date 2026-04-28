import type { PartnerType } from '../domain.js';
import { dbAll, dbGet, dbRun } from '../lib/db.js';

export async function ensureOrderExists(orderId: number) {
  const order = await dbGet<{ id: number }>(`SELECT id FROM orders WHERE id = ?`, [orderId]);
  return Boolean(order);
}

export async function ensurePartnerExists(partnerId: number) {
  const partner = await dbGet<{ id: number; name: string; partner_type: PartnerType }>(
    `SELECT id, name, partner_type FROM partners WHERE id = ?`,
    [partnerId],
  );
  return partner || null;
}

export async function syncOrderProductSummary(orderId: number) {
  const items = await dbAll<{ product_name: string }[]>(
    `SELECT product_name FROM order_items WHERE order_id = ? ORDER BY id ASC LIMIT 3`,
    [orderId],
  );

  if (!items.length) {
    await dbRun(`UPDATE orders SET product_summary = '' WHERE id = ?`, [orderId]);
    return;
  }

  const summary = items.map((item) => item.product_name).join(' / ');
  await dbRun(`UPDATE orders SET product_summary = ? WHERE id = ?`, [summary, orderId]);
}
