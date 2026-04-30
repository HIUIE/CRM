import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { initPgTables, pgDb } from '../server/db-pg.js';
import { dbGet, dbRun } from '../server/lib/db.js';
import { bootstrapInitialAdmin } from '../server/bootstrap.js';

async function upsertUser(username: string, password: string, role: 'admin' | 'staff', name: string) {
  const hash = await bcrypt.hash(password, 10);
  const existing = await dbGet<{ id: number }>(`SELECT id FROM users WHERE username = ?`, [username]);
  if (existing) {
    await dbRun(
      `UPDATE users SET password = ?, role = ?, name = ?, active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [hash, role, name, existing.id],
    );
    return existing.id;
  }
  const created = await dbRun(
    `INSERT INTO users (username, password, role, name, active) VALUES (?, ?, ?, ?, 1) RETURNING id`,
    [username, hash, role, name],
  );
  return created.lastID;
}

async function main() {
  await initPgTables();
  await bootstrapInitialAdmin();

  const rootPassword = process.env.INITIAL_ADMIN_PASSWORD || 'smoke-root-password';
  const adminId = await upsertUser('root', rootPassword, 'admin', 'Super Admin');
  const staffId = await upsertUser('staff.demo', 'staff123', 'staff', 'Staff Demo');

  const customer = await dbGet<{ id: number }>(`SELECT id FROM customers WHERE display_id = ?`, ['CUST-DEMO-001']);
  const customerId = customer?.id ?? (await dbRun(
    `INSERT INTO customers (display_id, name, country, contact, logistics_preference, payment_terms, source_channel, intent_products, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    ['CUST-DEMO-001', 'Demo Trading Co.', 'US', 'demo@example.com', 'Sea freight', '30% deposit / 70% balance', 'demo', 'Industrial valves', adminId],
  )).lastID;

  const partner = await dbGet<{ id: number }>(`SELECT id FROM partners WHERE name = ? AND deleted_at IS NULL`, ['Demo Factory']);
  const partnerId = partner?.id ?? (await dbRun(
    `INSERT INTO partners (name, partner_type, country, contact, payment_terms, remark, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    ['Demo Factory', 'supplier', 'CN', 'factory@example.com', 'T/T', 'Smoke-test supplier', adminId],
  )).lastID;

  const orderDisplayId = 'CQBX-2026-000003';
  const order = await dbGet<{ id: number }>(`SELECT id FROM orders WHERE display_id = ?`, [orderDisplayId]);
  const orderId = order?.id ?? (await dbRun(
    `INSERT INTO orders (display_id, customer_id, status, details, total_amount, product_summary, delivery_date, freight_amount, misc_amount, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [orderDisplayId, customerId, 'shipping', 'Demo order for release smoke checks', 12800, 'Industrial valves', '2026-05-20', 850, 120, adminId, adminId],
  )).lastID;

  const item = await dbGet<{ id: number }>(`SELECT id FROM order_items WHERE order_id = ? LIMIT 1`, [orderId]);
  if (!item) {
    await dbRun(
      `INSERT INTO order_items (order_id, product_name, specification, hs_code, quantity, unit, unit_price, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, 'Industrial valve', 'DN50 stainless steel', '8481804090', 100, 'pcs', 128, 12800],
    );
  }

  const finance = await dbGet<{ id: number }>(`SELECT id FROM finance_records WHERE order_id = ? LIMIT 1`, [orderId]);
  if (!finance) {
    await dbRun(
      `INSERT INTO finance_records (order_id, partner_id, type, amount, target, status, remark, currency, payment_category, record_category, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, null, 'receipt', 3840, 'Demo Trading Co.', 'completed', '30% deposit', 'USD', 'deposit', 'order', adminId],
    );
  }

  const logistics = await dbGet<{ id: number }>(`SELECT id FROM logistics_records WHERE order_id = ? LIMIT 1`, [orderId]);
  if (!logistics) {
    await dbRun(
      `INSERT INTO logistics_records (order_id, tracking_no, carrier, freight_forwarder, packing_details, status, shipping_date, segment_type, package_count, volume_cbm, gross_weight_kg, incoterm, transport_mode, bill_no, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, 'DEMO-TRACK-001', 'Demo Carrier', 'Demo Forwarder', '10 cartons', 'shipped', '2026-04-25', 'international', 10, 2.4, 520, 'FOB', 'sea', 'BL-DEMO-001', adminId],
    );
  }

  const task = await dbGet<{ id: number }>(`SELECT id FROM tasks WHERE title = ?`, ['Confirm demo shipment']);
  if (!task) {
    await dbRun(
      `INSERT INTO tasks (title, assignee_id, due_date, priority, status, entity_type, entity_id, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Confirm demo shipment', staffId, '2026-05-01', 'P1', 'todo', 'order', orderDisplayId, 'Smoke-test task for UI navigation.', adminId],
    );
  }

  await pgDb.end();
}

main().catch(async (error) => {
  console.error(error);
  await pgDb.end().catch(() => {});
  process.exit(1);
});
