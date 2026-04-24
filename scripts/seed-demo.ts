import bcrypt from 'bcryptjs';
import { initDb, db, DB_PATH } from '../server/db.js';

async function ensureStaffUser() {
  const existing = await db.get<{ id: number }>(`SELECT id FROM users WHERE username = ?`, ['staff.demo']);
  if (existing) {
    return existing.id;
  }

  const hash = await bcrypt.hash('staff123', 10);
  const created = await db.run(
    `INSERT INTO users (username, password, role, name, active) VALUES (?, ?, ?, ?, 1)`,
    ['staff.demo', hash, 'staff', 'Demo Staff'],
  );
  return created.lastID as number;
}

async function ensurePartner(userId: number) {
  const existing = await db.get<{ id: number }>(`SELECT id FROM partners WHERE name = ?`, ['Demo Factory']);
  if (existing) {
    return existing.id;
  }

  const created = await db.run(
    `INSERT INTO partners (name, partner_type, country, contact, payment_terms, remark, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Demo Factory', 'factory', 'China', 'factory@example.com', '30/70', '演示工厂数据', userId, userId],
  );
  return created.lastID as number;
}

async function ensureCustomer(userId: number) {
  const existing = await db.get<{ id: number }>(`SELECT id FROM customers WHERE name = ?`, ['Low Keng Fatt']);
  if (existing) {
    return existing.id;
  }

  const created = await db.run(
    `INSERT INTO customers (name, country, contact, logistics_preference, payment_terms, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Low Keng Fatt', 'Singapore', 'flow@active-acoustic.com', 'FOB Ningbo', '30/70', userId, userId],
  );
  return created.lastID as number;
}

async function ensureOrder(customerId: number, partnerId: number, userId: number) {
  const existing = await db.get<{ id: number }>(`SELECT id FROM orders WHERE display_id = ?`, ['CQBX-2026-000003']);
  if (existing) {
    return existing.id;
  }

  const created = await db.run(
    `INSERT INTO orders (display_id, customer_id, status, details, total_amount, product_summary, delivery_date, freight_amount, misc_amount, created_by, updated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['CQBX-2026-000003', customerId, 'production', '演示订单：声学面板项目', 12000, 'Active Acoustic Panel / Foam 50mm', '2026-05-12', 0, 0, userId, userId, '2026-04-22 15:52:45'],
  );
  const orderId = created.lastID as number;

  await db.run(
    `INSERT INTO order_items (order_id, product_name, specification, quantity, unit, unit_price, subtotal, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, 'Active Acoustic Panel', 'AA-PNL-1200', 100, 'pcs', 50, 5000, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85'],
  );
  await db.run(
    `INSERT INTO order_items (order_id, product_name, specification, quantity, unit, unit_price, subtotal, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, 'Acoustic Foam 50mm', 'AA-FOAM-50', 200, 'pcs', 20, 4000, 'https://images.unsplash.com/photo-1513694203232-719a280e022f'],
  );
  await db.run(
    `INSERT INTO finance_records (order_id, type, amount, target, status, remark, currency, payment_category, record_category, created_by, updated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, 'receipt', 3000, 'Low Keng Fatt', 'completed', '演示首付款', 'USD', 'receipt', 'deposit', userId, userId, '2026-04-22 16:00:00'],
  );
  await db.run(
    `INSERT INTO finance_records (order_id, partner_id, type, amount, target, status, remark, currency, payment_category, record_category, created_by, updated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, partnerId, 'payment', 1200, 'Demo Factory', 'pending', '演示工厂货款', 'CNY', 'goods', 'goods', userId, userId, '2026-04-22 16:05:00'],
  );
  await db.run(
    `INSERT INTO production_plans (order_id, partner_id, order_date, estimated_delivery_date, production_status, inspection_status, remark, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, partnerId, '2026-04-23', '2026-05-01', 'in_progress', 'pending', '演示生产计划', userId, userId],
  );
  await db.run(
    `INSERT INTO customs_records (order_id, status, broker_name, declaration_no, declaration_date, remark, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, 'preparing', 'Demo Broker', 'DEC-DEMO-01', '2026-04-26', '演示报关信息', userId, userId],
  );
  await db.run(
    `INSERT INTO logistics_records (order_id, tracking_no, carrier, packing_details, status, shipping_date, segment_type, created_by, updated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, 'CN-DEMO-001', '顺丰', '2 箱', 'shipped', '2026-04-24', 'domestic', userId, userId, '2026-04-24 10:00:00'],
  );

  return orderId;
}

async function main() {
  await initDb();

  const root = await db.get<{ id: number }>(`SELECT id FROM users WHERE username = 'root'`);
  const ownerId = root?.id || (await ensureStaffUser());
  await ensureStaffUser();
  const partnerId = await ensurePartner(ownerId);
  const customerId = await ensureCustomer(ownerId);
  const orderId = await ensureOrder(customerId, partnerId, ownerId);

  console.log('Demo seed ready');
  console.log(`Database: ${DB_PATH}`);
  console.log(`Order: CQBX-2026-000003 (id=${orderId})`);
  console.log('Staff login: staff.demo / staff123');

  await db.close();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await db.close();
  } catch (_closeError) {
    // ignore close failures
  }
  process.exit(1);
});
