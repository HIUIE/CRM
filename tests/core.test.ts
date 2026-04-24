import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import bcrypt from 'bcryptjs';

type DbModule = typeof import('../server/db.js');
type AuthModule = typeof import('../server/lib/auth.js');
type PayloadsModule = typeof import('../server/services/payloads.js');
type OrderDetailModule = typeof import('../server/services/order-detail.js');
type UsersRouteModule = typeof import('../server/routes/users.js');

let tempDir = '';
let dbModule: DbModule;
let authModule: AuthModule;
let payloadsModule: PayloadsModule;
let orderDetailModule: OrderDetailModule;
let usersRouteModule: UsersRouteModule;

class MockResponse {
  statusCode = 200;
  body: unknown = null;
  clearedCookie = false;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(payload: unknown) {
    this.body = payload;
    return this;
  }

  clearCookie() {
    this.clearedCookie = true;
    return this;
  }

  cookie() {
    return this;
  }
}

function getFinalRouteHandler(router: any, routePath: string, method: string) {
  const layer = router.stack.find((entry: any) => entry.route?.path === routePath && entry.route.methods?.[method]);
  assert(layer, `Expected route ${method.toUpperCase()} ${routePath}`);
  const routeLayer = layer.route.stack[layer.route.stack.length - 1];
  return routeLayer.handle as (req: any, res: any) => Promise<unknown>;
}

async function resetDatabase() {
  const { db } = dbModule;
  await db.exec(`
    DELETE FROM attachments;
    DELETE FROM production_plans;
    DELETE FROM customs_records;
    DELETE FROM logistics_records;
    DELETE FROM finance_records;
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM partners;
    DELETE FROM customers;
    DELETE FROM settings;
    DELETE FROM users WHERE username != 'root';
    UPDATE users SET active = 1, role = 'admin', name = 'Super Admin' WHERE username = 'root';
  `);
}

async function getRootUser() {
  const root = await dbModule.db.get<{ id: number; username: string; role: 'admin' | 'staff' }>(
    `SELECT id, username, role FROM users WHERE username = 'root'`,
  );
  assert(root);
  return root;
}

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-tests-'));
  process.env.CRM_DB_PATH = path.join(tempDir, 'crm-test.sqlite');
  process.env.NODE_ENV = 'test';

  dbModule = await import('../server/db.js');
  await dbModule.initDb();
  authModule = await import('../server/lib/auth.js');
  payloadsModule = await import('../server/services/payloads.js');
  orderDetailModule = await import('../server/services/order-detail.js');
  usersRouteModule = await import('../server/routes/users.js');
});

beforeEach(async () => {
  await resetDatabase();
});

after(async () => {
  await dbModule.db.close();
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('requireAuth accepts active users and rejects disabled users', async () => {
  const { db } = dbModule;
  const password = await bcrypt.hash('secret123', 10);
  const created = await db.run(
    `INSERT INTO users (username, password, role, name, active) VALUES (?, ?, ?, ?, 1)`,
    ['staff-a', password, 'staff', 'Staff A'],
  );
  const userId = created.lastID as number;

  const token = authModule.signAuthToken({ id: userId, username: 'staff-a', role: 'staff' });
  const req: any = { cookies: { token } };
  const res = new MockResponse();
  let nextCalled = false;

  await authModule.requireAuth(req, res as any, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user?.id, userId);

  await db.run(`UPDATE users SET active = 0 WHERE id = ?`, [userId]);
  const disabledReq: any = { cookies: { token } };
  const disabledRes = new MockResponse();

  await authModule.requireAuth(disabledReq, disabledRes as any, () => {
    throw new Error('disabled user should not pass auth');
  });

  assert.equal(disabledRes.statusCode, 401);
  assert.deepEqual(disabledRes.body, {
    error: {
      code: 'ACCOUNT_DISABLED',
      message: '账号已停用，请联系管理员',
    },
  });
});

test('requireAdmin blocks staff users', async () => {
  const req: any = {
    user: {
      id: 2,
      username: 'staff-b',
      role: 'staff',
    },
  };
  const res = new MockResponse();

  authModule.requireAdmin(req, res as any, () => {
    throw new Error('staff user should not pass admin check');
  });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: {
      code: 'ADMIN_REQUIRED',
      message: '仅管理员可执行此操作',
    },
  });
});

test('user management route creates a user and protects root from being disabled', async () => {
  const router = usersRouteModule.createUsersRouter();
  const createHandler = getFinalRouteHandler(router, '/', 'post');
  const updateHandler = getFinalRouteHandler(router, '/:id', 'patch');
  const resetPasswordHandler = getFinalRouteHandler(router, '/:id/reset-password', 'post');

  const createReq: any = {
    body: {
      username: 'team.staff',
      name: 'Team Staff',
      role: 'staff',
      password: 'secret123',
    },
  };
  const createRes = new MockResponse();
  await createHandler(createReq, createRes as any);

  assert.equal(createRes.statusCode, 201);
  const createdUser = await dbModule.db.get<{ id: number; username: string; role: string }>(
    `SELECT id, username, role FROM users WHERE username = 'team.staff'`,
  );
  assert(createdUser);
  assert.equal(createdUser.role, 'staff');

  const resetReq: any = {
    params: { id: String(createdUser.id) },
    body: { password: 'newpass123' },
  };
  const resetRes = new MockResponse();
  await resetPasswordHandler(resetReq, resetRes as any);
  assert.equal(resetRes.statusCode, 200);

  const hashed = await dbModule.db.get<{ password: string }>(`SELECT password FROM users WHERE id = ?`, [createdUser.id]);
  assert(hashed);
  assert.equal(await bcrypt.compare('newpass123', hashed.password), true);

  const root = await getRootUser();
  const protectReq: any = {
    params: { id: String(root.id) },
    body: { name: 'Super Admin', role: 'admin', active: false },
  };
  const protectRes = new MockResponse();
  await updateHandler(protectReq, protectRes as any);

  assert.equal(protectRes.statusCode, 409);
  assert.deepEqual(protectRes.body, {
    error: {
      code: 'ROOT_PROTECTED',
      message: '默认管理员账号不能停用',
    },
  });
});

test('payload readers enforce partner and order validation rules', async () => {
  const root = await getRootUser();
  const customer = await dbModule.db.run(
    `INSERT INTO customers (name, country, contact, created_by, updated_by) VALUES (?, ?, ?, ?, ?)`,
    ['Acme Corp', 'USA', 'ops@acme.test', root.id, root.id],
  );
  const order = await dbModule.db.run(
    `INSERT INTO orders (display_id, customer_id, status, details, total_amount, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['ORD-2026-000001', customer.lastID, 'draft', 'demo', 1000, root.id, root.id],
  );
  const forwarder = await dbModule.db.run(
    `INSERT INTO partners (name, partner_type, created_by, updated_by) VALUES (?, ?, ?, ?)`,
    ['Fast Forward', 'forwarder', root.id, root.id],
  );
  const factory = await dbModule.db.run(
    `INSERT INTO partners (name, partner_type, created_by, updated_by) VALUES (?, ?, ?, ?)`,
    ['Best Factory', 'factory', root.id, root.id],
  );

  const invalidProduction = await payloadsModule.readProductionPayload(
    {
      partnerId: forwarder.lastID,
      orderDate: '2026-04-23',
      estimatedDeliveryDate: '2026-05-01',
      productionStatus: 'scheduled',
      inspectionStatus: 'pending',
    },
    order.lastID as number,
  );
  assert.deepEqual(invalidProduction, { error: '生产安排仅支持选择工厂或其他供应商' });

  const validProduction = await payloadsModule.readProductionPayload(
    {
      partnerId: factory.lastID,
      orderDate: '2026-04-23',
      estimatedDeliveryDate: '2026-05-01',
      productionStatus: 'scheduled',
      inspectionStatus: 'pending',
      remark: 'ready for line',
    },
    order.lastID as number,
  );
  assert('payload' in validProduction);
  assert.equal(validProduction.payload.partnerName, 'Best Factory');

  const validFinance = await payloadsModule.readFinancePayload({
    orderId: order.lastID,
    type: 'payment',
    amount: 300,
    currency: 'CNY',
    target: '',
    partnerId: factory.lastID,
    status: 'completed',
    recordCategory: 'goods',
    remark: 'supplier payment',
  });
  assert('payload' in validFinance);
  assert.equal(validFinance.payload.partnerId, factory.lastID);
  assert.equal(validFinance.payload.target, 'Best Factory');
});

test('buildOrderDetail returns unified summary, attachments and creator metadata', async () => {
  const root = await getRootUser();
  const customer = await dbModule.db.run(
    `INSERT INTO customers (name, country, contact, logistics_preference, payment_terms, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Low Keng Fatt', 'Singapore', 'flow@active-acoustic.com', 'FOB Ningbo', '30/70', root.id, root.id],
  );
  const partner = await dbModule.db.run(
    `INSERT INTO partners (name, partner_type, country, contact, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['Demo Factory', 'factory', 'China', 'factory@example.com', root.id, root.id],
  );
  const order = await dbModule.db.run(
    `INSERT INTO orders (display_id, customer_id, status, details, total_amount, freight_amount, misc_amount, created_by, updated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['CQBX-2026-000003', customer.lastID, 'confirmed', 'Acoustic panels', 12000, 500, 120, root.id, root.id, '2026-04-22 15:52:45'],
  );
  await dbModule.db.run(
    `INSERT INTO order_items (order_id, product_name, specification, quantity, unit, unit_price, subtotal, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [order.lastID, 'Active Acoustic Panel', 'AA-PNL-1200', 100, 'pcs', 50, 5000, 'https://example.com/panel.png'],
  );
  const receipt = await dbModule.db.run(
    `INSERT INTO finance_records (order_id, partner_id, type, amount, target, status, remark, currency, payment_category, record_category, created_by, updated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [order.lastID, null, 'receipt', 3000, 'Low Keng Fatt', 'completed', 'deposit paid', 'USD', 'receipt', 'deposit', root.id, root.id, '2026-04-22 16:00:00'],
  );
  const payment = await dbModule.db.run(
    `INSERT INTO finance_records (order_id, partner_id, type, amount, target, status, remark, currency, payment_category, record_category, created_by, updated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [order.lastID, partner.lastID, 'payment', 1000, 'Demo Factory', 'completed', 'freight', 'CNY', 'freight', 'freight', root.id, root.id, '2026-04-22 16:05:00'],
  );
  const domesticLogistics = await dbModule.db.run(
    `INSERT INTO logistics_records (order_id, tracking_no, carrier, packing_details, status, shipping_date, segment_type, created_by, updated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [order.lastID, 'CN123', '顺丰', '2 箱', 'shipped', '2026-04-24', 'domestic', root.id, root.id, '2026-04-24 09:00:00'],
  );
  await dbModule.db.run(
    `INSERT INTO logistics_records (order_id, tracking_no, carrier, packing_details, status, shipping_date, segment_type, incoterm, transport_mode, vessel_voyage, bill_no, etd, eta, created_by, updated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [order.lastID, 'BL2026', 'COSCO', 'export lot', 'preparing', '2026-04-28', 'international', 'FOB', 'sea', 'V001', 'BILL-1', '2026-04-29', '2026-05-12', root.id, root.id, '2026-04-25 10:00:00'],
  );
  const customs = await dbModule.db.run(
    `INSERT INTO customs_records (order_id, status, broker_name, declaration_no, declaration_date, remark, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [order.lastID, 'submitted', 'Ningbo Broker', 'DEC-1', '2026-04-25', 'submitted to customs', root.id, root.id],
  );
  await dbModule.db.run(
    `INSERT INTO production_plans (order_id, partner_id, order_date, estimated_delivery_date, production_status, inspection_status, remark, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [order.lastID, partner.lastID, '2026-04-23', '2026-05-01', 'in_progress', 'pending', 'line booked', root.id, root.id],
  );
  await dbModule.db.run(
    `INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, file_path) VALUES (?, ?, ?, ?, ?)`,
    ['finance', receipt.lastID, 'receipt.pdf', 'receipt.pdf', 'uploads/receipt.pdf'],
  );
  await dbModule.db.run(
    `INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, file_path) VALUES (?, ?, ?, ?, ?)`,
    ['logistics', domesticLogistics.lastID, 'packing-list.pdf', 'packing-list.pdf', 'uploads/packing-list.pdf'],
  );
  await dbModule.db.run(
    `INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, file_path) VALUES (?, ?, ?, ?, ?)`,
    ['customs', customs.lastID, 'customs-release.pdf', 'customs-release.pdf', 'uploads/customs-release.pdf'],
  );

  const detail = await orderDetailModule.buildOrderDetail('CQBX-2026-000003');
  assert(detail);
  assert.equal(detail.order.status, 'production');
  assert.equal(detail.order.createdByName, 'Super Admin');
  assert.equal(detail.summary.paymentStatus, 'partial');
  assert.equal(detail.summary.outstandingAmount, 9000);
  assert.equal(detail.summary.latestLogisticsStatus, 'preparing');
  assert.equal(detail.summary.attachmentsSummary.finance, 1);
  assert.equal(detail.summary.attachmentsSummary.logistics, 1);
  assert.equal(detail.summary.attachmentsSummary.customs, 1);
  assert.equal(detail.financeRecords.length, 2);
  assert.equal(detail.financeRecords[0].createdByName, 'Super Admin');
  assert.equal(detail.customs?.attachmentCount, 1);
  assert.equal(detail.productionPlan?.partnerName, 'Demo Factory');
  assert.equal(detail.domesticLogistics?.trackingNo, 'CN123');
  assert.equal(detail.internationalLogistics?.billNo, 'BILL-1');
  assert.equal(detail.customer.name, 'Low Keng Fatt');

  const receiptRecord = detail.financeRecords.find((record: any) => record.id === payment.lastID);
  assert(receiptRecord);
  assert.equal(receiptRecord.partnerName, 'Demo Factory');
});
