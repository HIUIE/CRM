import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';

type DbModule = typeof import('../server/db.js');
type AuthModule = typeof import('../server/lib/auth.js');
type PayloadsModule = typeof import('../server/services/payloads.js');
type OrderDetailModule = typeof import('../server/services/order-detail.js');
type UsersRouteModule = typeof import('../server/routes/users.js');
type FilesRouteModule = typeof import('../server/routes/files.js');
type SettingsRouteModule = typeof import('../server/routes/settings.js');
type SecurityModule = typeof import('../server/lib/security.js');
type PathsModule = typeof import('../server/paths.js');
type ApiModule = typeof import('../server/api.js');

let tempDir = '';
let dbModule: DbModule;
let authModule: AuthModule;
let payloadsModule: PayloadsModule;
let orderDetailModule: OrderDetailModule;
let usersRouteModule: UsersRouteModule;
let filesRouteModule: FilesRouteModule;
let settingsRouteModule: SettingsRouteModule;
let securityModule: SecurityModule;
let pathsModule: PathsModule;
let apiModule: ApiModule;

class MockResponse {
  statusCode = 200;
  body: unknown = null;
  clearedCookie = false;
  headers = new Map<string, string>();
  rawBody: Buffer | null = null;
  private chunks: Buffer[] = [];
  sentFilePath = '';

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

  setHeader(name: string, value: string) {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }

  getHeader(name: string) {
    return this.headers.get(name.toLowerCase());
  }

  type(value: string) {
    this.setHeader('content-type', value);
    return this;
  }

  end(payload?: string | Buffer) {
    if (Buffer.isBuffer(payload)) {
      this.chunks.push(payload);
    } else if (typeof payload === 'string') {
      this.chunks.push(Buffer.from(payload));
    }
    this.rawBody = this.chunks.length ? Buffer.concat(this.chunks) : Buffer.alloc(0);
    return this;
  }

  write(payload: Buffer | string) {
    this.chunks.push(Buffer.isBuffer(payload) ? payload : Buffer.from(payload));
    this.rawBody = Buffer.concat(this.chunks);
    return true;
  }

  sendFile(filePath: string) {
    this.sentFilePath = filePath;
    this.rawBody = readFileSync(filePath);
    return this;
  }
}

function getFinalRouteHandler(router: any, routePath: string, method: string) {
  return getRouteHandlers(router, routePath, method).at(-1) as (req: any, res: any) => Promise<unknown>;
}

function getRouteHandlers(router: any, routePath: string, method: string) {
  const layer = router.stack.find((entry: any) => entry.route?.path === routePath && entry.route.methods?.[method]);
  assert(layer, `Expected route ${method.toUpperCase()} ${routePath}`);
  return layer.route.stack.map((routeLayer: any) => routeLayer.handle);
}

async function runHandlers(handlers: Array<(req: any, res: any, next: () => void | Promise<void>) => unknown>, req: any, res: MockResponse) {
  const dispatch = async (index: number): Promise<void> => {
    const handler = handlers[index];
    if (!handler) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let nextCalled = false;
      const finish = (error?: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      try {
        const result = handler(req, res as any, () => {
          nextCalled = true;
          void dispatch(index + 1).then(() => finish(), reject);
        });
        Promise.resolve(result).then(() => {
          if (!nextCalled) {
            finish();
          }
        }, reject);
      } catch (error) {
        reject(error);
      }
    });
  };

  await dispatch(0);
}

async function requireAuthed(req: any, res: MockResponse) {
  let passed = false;
  await authModule.requireAuth(req, res as any, () => {
    passed = true;
  });
  return passed;
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

function getAuthCookie(user: { id: number; username: string; role: 'admin' | 'staff' }) {
  return `token=${authModule.signAuthToken(user)}`;
}

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-tests-'));
  process.env.CRM_DB_PATH = path.join(tempDir, 'crm-test.sqlite');
  process.env.UPLOADS_DIR = path.join(tempDir, 'uploads');
  process.env.NODE_ENV = 'test';

  dbModule = await import('../server/db.js');
  await dbModule.initDb();
  authModule = await import('../server/lib/auth.js');
  payloadsModule = await import('../server/services/payloads.js');
  orderDetailModule = await import('../server/services/order-detail.js');
  usersRouteModule = await import('../server/routes/users.js');
  filesRouteModule = await import('../server/routes/files.js');
  settingsRouteModule = await import('../server/routes/settings.js');
  securityModule = await import('../server/lib/security.js');
  pathsModule = await import('../server/paths.js');
  apiModule = await import('../server/api.js');
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

test('admin export is restricted and returns a zip archive', async () => {
  const root = await getRootUser();
  const password = await bcrypt.hash('secret123', 10);
  const created = await dbModule.db.run(
    `INSERT INTO users (username, password, role, name, active) VALUES (?, ?, ?, ?, 1)`,
    ['staff-export', password, 'staff', 'Staff Export'],
  );
  const uploadsRoot = process.env.UPLOADS_DIR as string;
  const exportHandlers = getRouteHandlers(settingsRouteModule.createSettingsRouter(), '/export', 'get');

  const customer = await dbModule.db.run(
    `INSERT INTO customers (name, country, contact, created_by, updated_by) VALUES (?, ?, ?, ?, ?)`,
    ['ACME/Export', 'USA', 'ops@acme.test', root.id, root.id],
  );
  const order = await dbModule.db.run(
    `INSERT INTO orders (display_id, customer_id, status, details, total_amount, freight_amount, misc_amount, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['ORD/2026:000001', customer.lastID, 'production', 'Archive export order', 1800, 50, 10, root.id, root.id],
  );
  await dbModule.db.run(
    `INSERT INTO order_items (order_id, product_name, specification, quantity, unit, unit_price, subtotal, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [order.lastID, 'Archive Panel', 'AR-01', 10, 'pcs', 100, 1000, 'https://example.com/panel.png'],
  );
  const finance = await dbModule.db.run(
    `INSERT INTO finance_records (order_id, type, amount, target, status, remark, currency, payment_category, record_category, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [order.lastID, 'receipt', 500, 'ACME/Export', 'completed', 'finance attached', 'USD', 'receipt', 'deposit', root.id, root.id],
  );
  const logistics = await dbModule.db.run(
    `INSERT INTO logistics_records (order_id, tracking_no, carrier, packing_details, status, shipping_date, segment_type, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [order.lastID, 'TRACK-1', 'UPS', '2 boxes', 'shipped', '2026-04-24', 'domestic', root.id, root.id],
  );
  const customs = await dbModule.db.run(
    `INSERT INTO customs_records (order_id, status, broker_name, declaration_no, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?)`,
    [order.lastID, 'submitted', 'Broker', 'DEC-22', root.id, root.id],
  );
  const productionPlan = await dbModule.db.run(
    `INSERT INTO production_plans (order_id, partner_id, order_date, estimated_delivery_date, production_status, inspection_status, remark, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [order.lastID, null, '2026-04-20', '2026-05-01', 'in_progress', 'pending', 'production run', root.id, root.id],
  );
  const productionLog = await dbModule.db.run(
    `INSERT INTO production_logs (plan_id, content, created_by) VALUES (?, ?, ?)`,
    [productionPlan.lastID, 'line started', root.id],
  );

  const financePath = path.join(uploadsRoot, 'exports', 'receipt.pdf');
  const logisticsPath = path.join(uploadsRoot, 'exports', 'logistics.pdf');
  const customsPath = path.join(uploadsRoot, 'exports', 'customs.pdf');
  const productionPath = path.join(uploadsRoot, 'exports', 'production.pdf');
  const packingPath = path.join(uploadsRoot, 'exports', 'box.png');
  const orphanPath = path.join(uploadsRoot, 'exports', 'orphan.txt');
  await fs.mkdir(path.dirname(financePath), { recursive: true });
  await fs.writeFile(financePath, Buffer.from('%PDF-finance\n', 'utf8'));
  await fs.writeFile(logisticsPath, Buffer.from('%PDF-logistics\n', 'utf8'));
  await fs.writeFile(customsPath, Buffer.from('%PDF-customs\n', 'utf8'));
  await fs.writeFile(productionPath, Buffer.from('%PDF-production\n', 'utf8'));
  await fs.writeFile(packingPath, Buffer.from('PNG-box\n', 'utf8'));
  await fs.writeFile(orphanPath, Buffer.from('orphan-file\n', 'utf8'));

  await dbModule.db.run(
    `INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['finance', finance.lastID, 'receipt.pdf', 'receipt.pdf', 'application/pdf', 12, 'exports/receipt.pdf'],
  );
  await dbModule.db.run(
    `INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['finance', finance.lastID, 'receipt.pdf', 'receipt-copy.pdf', 'application/pdf', 0, 'exports/missing-receipt.pdf'],
  );
  await dbModule.db.run(
    `INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['logistics', logistics.lastID, 'logistics.pdf', 'logistics.pdf', 'application/pdf', 14, 'exports/logistics.pdf'],
  );
  await dbModule.db.run(
    `INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['customs', customs.lastID, 'customs.pdf', 'customs.pdf', 'application/pdf', 13, 'exports/customs.pdf'],
  );
  await dbModule.db.run(
    `INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['production_log', productionLog.lastID, 'production.pdf', 'production.pdf', 'application/pdf', 16, 'exports/production.pdf'],
  );
  const packingAttachment = await dbModule.db.run(
    `INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [null, null, 'box.png', 'box.png', 'image/png', 8, 'exports/box.png'],
  );
  await dbModule.db.run(
    `INSERT INTO packing_records (order_id, package_count, package_size, gross_weight, net_weight, attachment_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [order.lastID, 2, '40x40x40', 20, 18, packingAttachment.lastID],
  );
  await dbModule.db.run(
    `INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [null, null, 'orphan.txt', 'orphan.txt', 'text/plain', 12, 'exports/orphan.txt'],
  );

  const unauthenticatedReq: any = { query: { format: 'customer-archive' }, cookies: {} };
  const unauthenticatedRes = new MockResponse();
  await authModule.requireAuth(unauthenticatedReq, unauthenticatedRes as any, () => {
    throw new Error('unauthenticated request should not continue');
  });
  assert.equal(unauthenticatedRes.statusCode, 401);

  const staffReq: any = {
    query: { format: 'customer-archive' },
    cookies: { token: getAuthCookie({ id: created.lastID as number, username: 'staff-export', role: 'staff' }).replace('token=', '') },
  };
  const staffRes = new MockResponse();
  assert.equal(await requireAuthed(staffReq, staffRes), true);
  await runHandlers(exportHandlers as any, staffReq, staffRes);
  assert.equal(staffRes.statusCode, 403);

  const adminReq: any = {
    query: { format: 'customer-archive' },
    cookies: { token: getAuthCookie(root).replace('token=', '') },
  };
  const adminRes = new MockResponse();
  assert.equal(await requireAuthed(adminReq, adminRes), true);
  await runHandlers(exportHandlers as any, adminReq, adminRes);
  assert.equal(adminRes.statusCode, 200);
  assert.match(adminRes.getHeader('content-type') || '', /application\/zip/i);
  assert.match(adminRes.getHeader('content-disposition') || '', /crm-customer-archive-\d{8}-\d{6}\.zip/);

  const archive = adminRes.rawBody || Buffer.alloc(0);
  const archiveText = archive.toString('utf8');
  assert.match(archiveText, new RegExp(`customers/ACME_Export_${customer.lastID}/customer\\.json`));
  assert.match(archiveText, new RegExp(`customers/ACME_Export_${customer.lastID}/orders/ORD_2026_000001_${order.lastID}/order\\.json`));
  assert.match(archiveText, /order_items\.csv/);
  assert.match(archiveText, /finance_records\.csv/);
  assert.match(archiveText, /logistics_records\.csv/);
  assert.match(archiveText, /customs_record\.json/);
  assert.match(archiveText, /production_plan\.json/);
  assert.match(archiveText, /production_logs\.csv/);
  assert.match(archiveText, /packing_records\.csv/);
  assert.match(archiveText, /attachments\/finance\/receipt\.pdf/);
  assert.match(archiveText, /attachments\/finance\/receipt \(2\)\.pdf/);
  assert.match(archiveText, /attachments\/packing\/box\.png/);
  assert.match(archiveText, /attachments_manifest\.csv/);
  assert.match(archiveText, /_unlinked_attachments\/orphan\.txt/);
  assert.match(archiveText, /_unlinked_attachments\/unlinked_attachments\.csv/);
  assert.match(archiveText, /%PDF-finance/);
  assert.match(archiveText, /orphan-file/);
  assert.match(archiveText, /missing/);
  assert.match(archiveText, /true/);
  assert.equal(archive.length > 0, true);
});

test('protected file gateway enforces auth and blocks traversal patterns', async () => {
  const root = await getRootUser();
  const uploadsRoot = process.env.UPLOADS_DIR as string;
  const fileBody = Buffer.from('%PDF-1.4\nsecure-file\n', 'utf8');
  const relativePath = 'uploads/receipt.pdf';
  const physicalPath = path.join(uploadsRoot, 'receipt.pdf');
  const fileHandlers = getRouteHandlers(filesRouteModule.createFilesRouter(), '/:id/:storedName(*)', 'get');

  await fs.mkdir(path.dirname(physicalPath), { recursive: true });
  await fs.writeFile(physicalPath, fileBody);

  const attachment = await dbModule.db.run(
    `INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['finance', 1, 'receipt.pdf', 'receipt.pdf', 'application/pdf', fileBody.length, relativePath],
  );
  const attachmentId = attachment.lastID as number;

  const unauthenticatedReq: any = { params: { id: String(attachmentId), storedName: 'receipt.pdf' }, cookies: {} };
  const unauthenticatedRes = new MockResponse();
  await authModule.requireAuth(unauthenticatedReq, unauthenticatedRes as any, () => {
    throw new Error('unauthenticated request should not continue');
  });
  assert.equal(unauthenticatedRes.statusCode, 401);

  const encodedTraversalReq: any = {
    params: { id: String(attachmentId), storedName: '../receipt.pdf' },
    cookies: { token: getAuthCookie(root).replace('token=', '') },
  };
  const encodedTraversalRes = new MockResponse();
  assert.equal(await requireAuthed(encodedTraversalReq, encodedTraversalRes), true);
  await runHandlers(fileHandlers as any, encodedTraversalReq, encodedTraversalRes);
  assert.equal(encodedTraversalRes.statusCode, 400);

  const nestedTraversalReq: any = {
    params: { id: String(attachmentId), storedName: 'a/b.pdf' },
    cookies: { token: getAuthCookie(root).replace('token=', '') },
  };
  const nestedTraversalRes = new MockResponse();
  assert.equal(await requireAuthed(nestedTraversalReq, nestedTraversalRes), true);
  await runHandlers(fileHandlers as any, nestedTraversalReq, nestedTraversalRes);
  assert.equal(nestedTraversalRes.statusCode, 400);

  const validReq: any = {
    params: { id: String(attachmentId), storedName: 'receipt.pdf' },
    cookies: { token: getAuthCookie(root).replace('token=', '') },
  };
  const validRes = new MockResponse();
  assert.equal(await requireAuthed(validReq, validRes), true);
  await runHandlers(fileHandlers as any, validReq, validRes);
  assert.equal(validRes.statusCode, 200);
  assert.match(validRes.getHeader('content-type') || '', /application\/pdf/i);
  assert.equal((validRes.rawBody || Buffer.alloc(0)).equals(fileBody), true);
});

test('app blocks legacy uploads and sensitive file probes', async () => {
  const blockedPaths = ['/uploads/receipt.pdf', '/.env', '/foo.sqlite', '/.git/config', '/public/test.db'];

  for (const blockedPath of blockedPaths) {
    const req: any = { originalUrl: blockedPath, path: blockedPath };
    const res = new MockResponse();
    securityModule.blockSensitivePaths(req, res as any, () => {
      throw new Error(`Expected ${blockedPath} to be blocked`);
    });
    assert.equal(res.statusCode, 404, `Expected ${blockedPath} to be blocked`);
  }

  const healthHandler = getFinalRouteHandler(apiModule.default, '/health', 'get');
  const healthRes = new MockResponse();
  await healthHandler({}, healthRes as any);
  assert.equal(healthRes.statusCode, 200);
  const body = healthRes.body as Record<string, unknown>;
  assert.equal('dbPath' in body, false);
  assert.equal('uploadsPath' in body, false);
  assert.equal('uploadsUrl' in body, false);
});

test('production storage paths cannot live inside dist or public', async () => {
  assert.throws(
    () => securityModule.assertStorageOutsideStaticRoots(path.join(pathsModule.PROJECT_ROOT, 'dist', 'crm.sqlite'), path.join(tempDir, 'uploads')),
    /CRM_DB_PATH 不能位于 dist\/ 或 public\/ 静态目录内/,
  );

  assert.throws(
    () => securityModule.assertStorageOutsideStaticRoots(path.join(tempDir, 'crm.sqlite'), path.join(pathsModule.PROJECT_ROOT, 'public', 'uploads')),
    /UPLOADS_DIR 不能位于 dist\/ 或 public\/ 静态目录内/,
  );
});
