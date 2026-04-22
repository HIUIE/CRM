import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-preview-only';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const ORDER_STATUSES = ['draft', 'production', 'customs', 'shipping', 'completed'] as const;
const FINANCE_TYPES = ['receipt', 'payment'] as const;
const FINANCE_STATUSES = ['pending', 'completed'] as const;
const PAYMENT_CATEGORIES = ['receipt', 'freight', 'goods', 'other'] as const;
const RECORD_CATEGORIES = ['deposit', 'balance', 'goods', 'freight', 'customs', 'other'] as const;
const LOGISTICS_STATUSES = ['preparing', 'shipped', 'arrived'] as const;
const LOGISTICS_SEGMENTS = ['domestic', 'international'] as const;
const CUSTOMS_STATUSES = ['not_started', 'preparing', 'submitted', 'inspected', 'released'] as const;
const ATTACHMENT_ENTITY_TYPES = ['finance', 'customs', 'logistics'] as const;
const CURRENCIES = ['USD', 'CNY'] as const;
const PARTNER_TYPES = ['factory', 'forwarder', 'customs_broker', 'other'] as const;
const PRODUCTION_STATUSES = ['not_started', 'scheduled', 'in_progress', 'ready'] as const;
const INSPECTION_STATUSES = ['pending', 'passed', 'failed'] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];
type FinanceType = (typeof FINANCE_TYPES)[number];
type FinanceStatus = (typeof FINANCE_STATUSES)[number];
type PaymentCategory = (typeof PAYMENT_CATEGORIES)[number];
type RecordCategory = (typeof RECORD_CATEGORIES)[number];
type LogisticsStatus = (typeof LOGISTICS_STATUSES)[number];
type LogisticsSegment = (typeof LOGISTICS_SEGMENTS)[number];
type CustomsStatus = (typeof CUSTOMS_STATUSES)[number];
type AttachmentEntityType = (typeof ATTACHMENT_ENTITY_TYPES)[number];
type Currency = (typeof CURRENCIES)[number];
type PartnerType = (typeof PARTNER_TYPES)[number];
type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];
type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

type AuthedRequest = Request & {
  user?: {
    id: number;
    role: string;
    username: string;
  };
};

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, callback) => {
      try {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        callback(null, UPLOADS_DIR);
      } catch (error) {
        callback(error as Error, UPLOADS_DIR);
      }
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname || '');
      callback(null, `${Date.now()}-${randomUUID()}${extension}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 6,
  },
});

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: (isProduction() ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  };
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: '请先登录后再操作' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthedRequest['user'];
    req.user = decoded;
    next();
  } catch (_error) {
    return res.status(401).json({ error: '登录状态已失效，请重新登录' });
  }
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(value: unknown) {
  const nextValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : NaN;
}

function isOneOf<T extends readonly string[]>(value: string, options: T): value is T[number] {
  return options.includes(value as T[number]);
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('AI 未返回有效内容');
  }

  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');
  const candidate =
    firstBrace >= 0 && lastBrace >= 0 ? withoutFence.slice(firstBrace, lastBrace + 1) : withoutFence;

  return JSON.parse(candidate);
}

function buildOrderParsingPrompt(text: string) {
  return `你是一个资深外贸业务助理。请从下面这段杂乱的客户消息或邮件中提取关键订单信息。
请以严格 JSON 格式返回，且只能返回 JSON，不要包含 markdown 代码块或额外说明：
{
  "customerName": "提取的客户或公司名，如果没有提取到则填 暂无",
  "country": "提取的国家，如果没有填 暂无",
  "logistics": "提取的物流要求，如果没有填 无",
  "payment": "付款方式，如 30%定金",
  "totalAmount": 只保留数字金额，如果没提到则填 0,
  "details": "关于商品规格、包装、要求等的详细摘要",
  "suggestedReply": "拟写一段简短、专业、得体的英文回复，可用于快速确认订单"
}
需要解析的内容如下：
"""
${text}
"""`;
}

function resolveAiProvider(model: string) {
  const normalized = model.toLowerCase();
  if (normalized.includes('gemini')) {
    return 'gemini';
  }
  if (normalized.includes('deepseek')) {
    return 'deepseek';
  }
  if (normalized.includes('gpt')) {
    return 'openai-compatible';
  }
  return 'openai-compatible';
}

async function runOpenAiCompatibleModel({
  model,
  apiKey,
  baseUrl,
  prompt,
}: {
  model: string;
  apiKey: string;
  baseUrl: string;
  prompt: string;
}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string };
        choices?: Array<{ message?: { content?: string | null } }>;
      }
    | null;

  if (!response.ok) {
    throw new Error(data?.error?.message || `兼容模型请求失败 (${response.status})`);
  }

  const content = data?.choices?.[0]?.message?.content || '';
  return parseJsonObject(content);
}

function normalizeOrderStatus(status: string) {
  if (status === 'confirmed') {
    return 'production';
  }
  if (status === 'shipped') {
    return 'shipping';
  }
  return status;
}

function readOptionalDate(value: unknown) {
  const text = readString(value);
  if (!text) {
    return '';
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '__invalid__';
}

function readAttachmentIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

async function getAttachmentsByEntity(entityType: AttachmentEntityType, entityIds: number[]) {
  if (!entityIds.length) {
    return new Map<number, Record<string, unknown>[]>();
  }

  const placeholders = entityIds.map(() => '?').join(', ');
  const rows = await db.all<Record<string, unknown>[]>(
    `
      SELECT id, entity_type, entity_id, file_name, mime_type, file_size, file_path, created_at
      FROM attachments
      WHERE entity_type = ? AND entity_id IN (${placeholders})
      ORDER BY datetime(created_at) DESC, id DESC
    `,
    [entityType, ...entityIds],
  );

  const grouped = new Map<number, Record<string, unknown>[]>();
  for (const row of rows) {
    const entityId = Number(row.entity_id);
    if (!grouped.has(entityId)) {
      grouped.set(entityId, []);
    }
    grouped.get(entityId)?.push({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      filePath: row.file_path,
      url: row.file_path ? `/${String(row.file_path).replace(/^\/+/, '')}` : '',
      createdAt: row.created_at,
    });
  }

  return grouped;
}

async function bindAttachmentsToEntity(entityType: AttachmentEntityType, entityId: number, attachmentIds: number[]) {
  if (!attachmentIds.length) {
    return;
  }

  const placeholders = attachmentIds.map(() => '?').join(', ');
  await db.run(
    `
      UPDATE attachments
      SET entity_type = ?, entity_id = ?
      WHERE id IN (${placeholders})
    `,
    [entityType, entityId, ...attachmentIds],
  );
}

async function deleteAttachmentRows(entityType: AttachmentEntityType, entityId: number) {
  const attachments = await db.all<{ id: number; file_path: string }[]>(
    `SELECT id, file_path FROM attachments WHERE entity_type = ? AND entity_id = ?`,
    [entityType, entityId],
  );

  for (const attachment of attachments) {
    if (attachment.file_path) {
      const fullPath = path.join(__dirname, '..', attachment.file_path);
      try {
        await fs.unlink(fullPath);
      } catch (_error) {
        // Ignore missing files; deleting the DB row is still correct.
      }
    }
  }

  await db.run(`DELETE FROM attachments WHERE entity_type = ? AND entity_id = ?`, [entityType, entityId]);
}

async function ensureOrderExists(orderId: number) {
  const order = await db.get<{ id: number }>(`SELECT id FROM orders WHERE id = ?`, [orderId]);
  return Boolean(order);
}

async function getSettingValue(key: string, fallback = '') {
  const setting = await db.get<{ value: string }>(`SELECT value FROM settings WHERE key = ?`, [key]);
  return setting?.value || fallback;
}

async function setSettingValue(key: string, value: string) {
  await db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

async function getOrderNumberPrefix() {
  const rawValue = (await getSettingValue('order_number_prefix', 'ORD-')).trim();
  return rawValue || 'ORD-';
}

async function ensurePartnerExists(partnerId: number) {
  const partner = await db.get<{ id: number; name: string; partner_type: PartnerType }>(
    `SELECT id, name, partner_type FROM partners WHERE id = ?`,
    [partnerId],
  );
  return partner || null;
}

async function syncOrderProductSummary(orderId: number) {
  const items = await db.all<{ product_name: string }[]>(
    `SELECT product_name FROM order_items WHERE order_id = ? ORDER BY id ASC LIMIT 3`,
    [orderId],
  );

  if (!items.length) {
    await db.run(`UPDATE orders SET product_summary = '' WHERE id = ?`, [orderId]);
    return;
  }

  const summary = items.map((item) => item.product_name).join(' / ');
  await db.run(`UPDATE orders SET product_summary = ? WHERE id = ?`, [summary, orderId]);
}

function monthFromDateInput(value: string) {
  return /^\d{4}-\d{2}$/.test(value) ? value : '';
}

async function readPartnerPayload(body: Record<string, unknown>) {
  const name = readString(body.name);
  const partnerType = readString(body.partnerType);
  const country = readString(body.country);
  const contact = readString(body.contact);
  const paymentTerms = readString(body.paymentTerms);
  const remark = readString(body.remark);

  if (!name) {
    return { error: '请填写伙伴名称' };
  }
  if (!isOneOf(partnerType, PARTNER_TYPES)) {
    return { error: '伙伴类型不正确' };
  }

  return {
    payload: {
      name,
      partnerType: partnerType as PartnerType,
      country,
      contact,
      paymentTerms,
      remark,
    },
  };
}

async function readProductionPayload(body: Record<string, unknown>, orderId: number) {
  const partnerIdInput = readNumber(body.partnerId);
  const orderDate = readOptionalDate(body.orderDate);
  const estimatedDeliveryDate = readOptionalDate(body.estimatedDeliveryDate);
  const productionStatus = readString(body.productionStatus);
  const inspectionStatus = readString(body.inspectionStatus);
  const remark = readString(body.remark);

  if (!(await ensureOrderExists(orderId))) {
    return { error: '关联订单不存在' };
  }
  if (!Number.isInteger(partnerIdInput) || partnerIdInput <= 0) {
    return { error: '请选择生产伙伴' };
  }
  const partner = await ensurePartnerExists(partnerIdInput);
  if (!partner) {
    return { error: '所选伙伴不存在' };
  }
  if (!['factory', 'other'].includes(partner.partner_type)) {
    return { error: '生产安排仅支持选择工厂或其他供应商' };
  }
  if (orderDate === '__invalid__' || estimatedDeliveryDate === '__invalid__') {
    return { error: '生产日期格式不正确' };
  }
  if (!isOneOf(productionStatus, PRODUCTION_STATUSES)) {
    return { error: '生产状态不正确' };
  }
  if (!isOneOf(inspectionStatus, INSPECTION_STATUSES)) {
    return { error: '验货状态不正确' };
  }

  return {
    payload: {
      orderId,
      partnerId: partnerIdInput,
      partnerName: partner.name,
      orderDate: orderDate || '',
      estimatedDeliveryDate: estimatedDeliveryDate || '',
      productionStatus: productionStatus as ProductionStatus,
      inspectionStatus: inspectionStatus as InspectionStatus,
      remark,
    },
  };
}

async function readOrderPayload(body: Record<string, unknown>) {
  const customerId = readNumber(body.customerId);
  const productSummary = readString(body.productSummary);
  const details = readString(body.details);
  const totalAmount = readNumber(body.totalAmount);
  const deliveryDate = readOptionalDate(body.deliveryDate);
  const keyMilestone = readString(body.keyMilestone);
  const freightAmountInput = readNumber(body.freightAmount);
  const miscAmountInput = readNumber(body.miscAmount);
  const freightAmount = Number.isFinite(freightAmountInput) ? freightAmountInput : 0;
  const miscAmount = Number.isFinite(miscAmountInput) ? miscAmountInput : 0;

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return { error: '请选择有效客户' };
  }
  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    return { error: '订单金额必须大于或等于 0' };
  }
  if (deliveryDate === '__invalid__') {
    return { error: '交货期格式不正确' };
  }
  if (!Number.isFinite(freightAmount) || freightAmount < 0) {
    return { error: '运费必须大于或等于 0' };
  }
  if (!Number.isFinite(miscAmount) || miscAmount < 0) {
    return { error: '杂费必须大于或等于 0' };
  }

  const customer = await db.get<{ id: number }>(`SELECT id FROM customers WHERE id = ?`, [customerId]);
  if (!customer) {
    return { error: '客户不存在，请先创建客户档案' };
  }

  return {
    payload: {
      customerId,
      productSummary,
      details,
      totalAmount,
      deliveryDate,
      keyMilestone,
      freightAmount,
      miscAmount,
    },
  };
}

async function readOrderItemPayload(body: Record<string, unknown>, orderId: number) {
  const productName = readString(body.productName);
  const specification = readString(body.specification);
  const unit = readString(body.unit);
  const quantity = readNumber(body.quantity);
  const unitPrice = readNumber(body.unitPrice);
  const subtotalInput = readNumber(body.subtotal);
  const imageUrl = readString(body.imageUrl);
  const subtotal = Number.isFinite(subtotalInput) ? subtotalInput : quantity * unitPrice;

  if (!(await ensureOrderExists(orderId))) {
    return { error: '订单不存在' };
  }
  if (!productName) {
    return { error: '请填写产品名称' };
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: '数量必须大于 0' };
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return { error: '单价必须大于或等于 0' };
  }
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return { error: '小计必须大于或等于 0' };
  }

  return {
    payload: {
      orderId,
      productName,
      specification,
      quantity,
      unit,
      unitPrice,
      subtotal,
      imageUrl,
    },
  };
}

async function readFinancePayload(body: Record<string, unknown>) {
  const orderId = readNumber(body.orderId);
  const partnerIdInput = readNumber(body.partnerId);
  const type = readString(body.type);
  const amount = readNumber(body.amount);
  const currency = readString(body.currency).toUpperCase();
  const target = readString(body.target);
  const status = readString(body.status);
  const remark = readString(body.remark);
  const paymentCategoryInput = readString(body.paymentCategory);
  const recordCategoryInput = readString(body.recordCategory);
  const attachmentIds = readAttachmentIds(body.attachmentIds);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { error: '请选择有效的关联订单' };
  }
  if (!(await ensureOrderExists(orderId))) {
    return { error: '关联订单不存在' };
  }
  if (!isOneOf(type, FINANCE_TYPES)) {
    return { error: '账单类型不正确' };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: '金额必须大于 0' };
  }
  if (!isOneOf(currency, CURRENCIES)) {
    return { error: '币种仅支持 USD 或 CNY' };
  }
  if (!isOneOf(status, FINANCE_STATUSES)) {
    return { error: '财务状态不正确' };
  }

  const partnerId = Number.isInteger(partnerIdInput) && partnerIdInput > 0 ? partnerIdInput : null;
  const partner = partnerId ? await ensurePartnerExists(partnerId) : null;
  if (partnerId && !partner) {
    return { error: '收款方不存在，请先维护伙伴档案' };
  }

  const recordCategory =
    recordCategoryInput && isOneOf(recordCategoryInput, RECORD_CATEGORIES)
      ? (recordCategoryInput as RecordCategory)
      : type === 'receipt'
        ? 'deposit'
        : paymentCategoryInput === 'freight'
          ? 'freight'
          : paymentCategoryInput === 'goods'
            ? 'goods'
            : 'other';

  const paymentCategory =
    type === 'receipt'
      ? 'receipt'
      : recordCategory === 'freight'
        ? 'freight'
        : recordCategory === 'goods'
          ? 'goods'
          : 'other';

  if (type === 'payment' && !isOneOf(paymentCategory, PAYMENT_CATEGORIES)) {
    return { error: '付款分类不正确' };
  }
  if (!isOneOf(recordCategory, RECORD_CATEGORIES)) {
    return { error: '款项类型不正确' };
  }

  return {
    payload: {
      orderId,
      partnerId,
      type: type as FinanceType,
      amount,
      currency: currency as Currency,
      target: target || partner?.name || '',
      status: status as FinanceStatus,
      remark,
      paymentCategory: paymentCategory as PaymentCategory,
      recordCategory,
      attachmentIds,
    },
  };
}

async function readLogisticsPayload(body: Record<string, unknown>) {
  const orderId = readNumber(body.orderId);
  const trackingNo = readString(body.trackingNo);
  const carrier = readString(body.carrier);
  const packingDetails = readString(body.packingDetails);
  const status = readString(body.status);
  const shippingDate = readString(body.shippingDate);
  const segmentTypeInput = readString(body.segmentType);
  const packageCount = readNumber(body.packageCount);
  const volumeCbm = readNumber(body.volumeCbm);
  const grossWeightKg = readNumber(body.grossWeightKg);
  const incoterm = readString(body.incoterm);
  const transportMode = readString(body.transportMode);
  const vesselVoyage = readString(body.vesselVoyage);
  const billNo = readString(body.billNo);
  const etd = readOptionalDate(body.etd);
  const eta = readOptionalDate(body.eta);
  const remark = readString(body.remark);
  const attachmentIds = readAttachmentIds(body.attachmentIds);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { error: '请选择有效的关联订单' };
  }
  if (!(await ensureOrderExists(orderId))) {
    return { error: '关联订单不存在' };
  }
  if (!carrier) {
    return { error: '请填写物流公司或承运方' };
  }
  if (!isOneOf(status, LOGISTICS_STATUSES)) {
    return { error: '物流状态不正确' };
  }
  const segmentType = isOneOf(segmentTypeInput, LOGISTICS_SEGMENTS)
    ? (segmentTypeInput as LogisticsSegment)
    : 'international';
  if (!packingDetails && segmentType !== 'domestic') {
    return { error: '请填写装箱或包装明细' };
  }
  if (shippingDate && !/^\d{4}-\d{2}-\d{2}$/.test(shippingDate)) {
    return { error: '发货日期格式不正确' };
  }
  if (status !== 'preparing' && !shippingDate) {
    return { error: '运输中或已到货时必须填写发货日期' };
  }
  if (etd === '__invalid__' || eta === '__invalid__') {
    return { error: 'ETD / ETA 日期格式不正确' };
  }

  return {
    payload: {
      orderId,
      trackingNo,
      carrier,
      packingDetails,
      status: status as LogisticsStatus,
      shippingDate,
      segmentType,
      packageCount: Number.isFinite(packageCount) ? packageCount : null,
      volumeCbm: Number.isFinite(volumeCbm) ? volumeCbm : null,
      grossWeightKg: Number.isFinite(grossWeightKg) ? grossWeightKg : null,
      incoterm,
      transportMode,
      vesselVoyage,
      billNo,
      etd: etd || '',
      eta: eta || '',
      remark,
      attachmentIds,
    },
  };
}

async function readCustomsPayload(body: Record<string, unknown>) {
  const orderId = readNumber(body.orderId);
  const status = readString(body.status);
  const brokerName = readString(body.brokerName);
  const declarationNo = readString(body.declarationNo);
  const declarationDate = readOptionalDate(body.declarationDate);
  const releaseDate = readOptionalDate(body.releaseDate);
  const remark = readString(body.remark);
  const attachmentIds = readAttachmentIds(body.attachmentIds);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { error: '请选择有效的关联订单' };
  }
  if (!(await ensureOrderExists(orderId))) {
    return { error: '关联订单不存在' };
  }
  if (!isOneOf(status, CUSTOMS_STATUSES)) {
    return { error: '报关状态不正确' };
  }
  if (declarationDate === '__invalid__' || releaseDate === '__invalid__') {
    return { error: '报关日期格式不正确' };
  }

  return {
    payload: {
      orderId,
      status: status as CustomsStatus,
      brokerName,
      declarationNo,
      declarationDate: declarationDate || '',
      releaseDate: releaseDate || '',
      remark,
      attachmentIds,
    },
  };
}

async function buildOrderDetail(orderId: number) {
  const order = await db.get<Record<string, unknown>>(`
    SELECT
      o.*,
      c.name AS customer_name,
      c.country AS customer_country,
      c.contact AS customer_contact,
      c.logistics_preference AS customer_logistics_preference,
      c.payment_terms AS customer_payment_terms
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.id = ?
  `, [orderId]);

  if (!order) {
    return null;
  }

  const items = await db.all<Record<string, unknown>[]>(`
    SELECT *
    FROM order_items
    WHERE order_id = ?
    ORDER BY id ASC
  `, [orderId]);

  const financeRecords = await db.all<Record<string, unknown>[]>(`
    SELECT
      f.*,
      p.name AS partner_name,
      p.partner_type AS partner_type
    FROM finance_records f
    LEFT JOIN partners p ON p.id = f.partner_id
    WHERE f.order_id = ?
    ORDER BY datetime(f.created_at) DESC, f.id DESC
  `, [orderId]);

  const logisticsRecords = await db.all<Record<string, unknown>[]>(`
    SELECT *
    FROM logistics_records
    WHERE order_id = ?
    ORDER BY
      CASE WHEN segment_type = 'domestic' THEN 0 ELSE 1 END ASC,
      CASE WHEN shipping_date IS NULL OR shipping_date = '' THEN 1 ELSE 0 END ASC,
      shipping_date DESC,
      datetime(created_at) DESC,
      id DESC
  `, [orderId]);

  const customs = await db.get<Record<string, unknown>>(
    `
      SELECT *
      FROM customs_records
      WHERE order_id = ?
      LIMIT 1
    `,
    [orderId],
  );

  const productionPlan = await db.get<Record<string, unknown>>(
    `
      SELECT
        pp.*,
        p.name AS partner_name,
        p.partner_type AS partner_type,
        p.country AS partner_country,
        p.contact AS partner_contact
      FROM production_plans pp
      LEFT JOIN partners p ON p.id = pp.partner_id
      WHERE pp.order_id = ?
      LIMIT 1
    `,
    [orderId],
  );

  const summaryRows = await db.all<{ type: FinanceType; currency: Currency; payment_category: PaymentCategory; total: number }[]>(`
    SELECT type, currency, payment_category, COALESCE(SUM(amount), 0) AS total
    FROM finance_records
    WHERE order_id = ? AND status = 'completed'
    GROUP BY type, currency, payment_category
  `, [orderId]);

  const receiptsByCurrency: Record<Currency, number> = { USD: 0, CNY: 0 };
  const paymentsByCurrency: Record<Currency, number> = { USD: 0, CNY: 0 };
  const freightByCurrency: Record<Currency, number> = { USD: 0, CNY: 0 };

  for (const row of summaryRows) {
    if (row.type === 'receipt') {
      receiptsByCurrency[row.currency] += row.total;
    } else {
      paymentsByCurrency[row.currency] += row.total;
      if (row.payment_category === 'freight') {
        freightByCurrency[row.currency] += row.total;
      }
    }
  }

  const pendingFinanceCount = await db.get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM finance_records WHERE order_id = ? AND status = 'pending'`,
    [orderId],
  );

  const domesticLogisticsRecord = logisticsRecords.find((item) => item.segment_type === 'domestic') || null;
  const internationalLogisticsRecord = logisticsRecords.find((item) => item.segment_type !== 'domestic') || null;
  const latestLogistics = logisticsRecords[0] || internationalLogisticsRecord || domesticLogisticsRecord || null;
  const orderAmount = Number(order.total_amount) || 0;
  const receiptTotal = receiptsByCurrency.USD;
  const paymentStatus =
    receiptTotal <= 0
      ? 'unpaid'
      : receiptTotal >= orderAmount && orderAmount > 0
        ? 'paid'
        : 'partial';
  const outstandingAmount = Math.max(orderAmount - receiptsByCurrency.USD, 0);
  const settled = outstandingAmount <= 0 && orderAmount > 0;

  const financeAttachments = await getAttachmentsByEntity(
    'finance',
    financeRecords.map((record) => Number(record.id)),
  );
  const logisticsAttachments = await getAttachmentsByEntity(
    'logistics',
    logisticsRecords.map((record) => Number(record.id)),
  );
  const customsAttachments = customs ? await getAttachmentsByEntity('customs', [Number(customs.id)]) : new Map<number, Record<string, unknown>[]>();

  return {
    order: {
      ...order,
      status: normalizeOrderStatus(String(order.status || 'draft')),
      deliveryDate: order.delivery_date || null,
      keyMilestone: order.key_milestone || null,
      freightAmount: Number(order.freight_amount) || 0,
      miscAmount: Number(order.misc_amount) || 0,
    },
    customer: {
      id: order.customer_id,
      name: order.customer_name,
      country: order.customer_country,
      contact: order.customer_contact,
      logisticsPreference: order.customer_logistics_preference,
      paymentTerms: order.customer_payment_terms,
    },
    items: items.map((item) => ({
      ...item,
      imageUrl: item.image_url || null,
    })),
    financeRecords: financeRecords.map((record) => ({
      ...record,
      recordCategory: record.record_category || record.payment_category || (record.type === 'receipt' ? 'deposit' : 'other'),
      partnerId: record.partner_id || null,
      partnerName: record.partner_name || null,
      createdAt: record.created_at,
      attachments: financeAttachments.get(Number(record.id)) || [],
      attachmentCount: (financeAttachments.get(Number(record.id)) || []).length,
    })),
    productionPlan: productionPlan
      ? {
          ...productionPlan,
          partnerId: productionPlan.partner_id,
          partnerName: productionPlan.partner_name,
          partnerType: productionPlan.partner_type,
          partnerCountry: productionPlan.partner_country,
          partnerContact: productionPlan.partner_contact,
          orderDate: productionPlan.order_date,
          estimatedDeliveryDate: productionPlan.estimated_delivery_date,
          productionStatus: productionPlan.production_status,
          inspectionStatus: productionPlan.inspection_status,
          updatedAt: productionPlan.updated_at,
        }
      : null,
    logisticsRecords: logisticsRecords.map((record) => ({
      ...record,
      segmentType: record.segment_type || 'international',
      trackingNo: record.tracking_no,
      packingDetails: record.packing_details,
      shippingDate: record.shipping_date,
      packageCount: record.package_count,
      volumeCbm: record.volume_cbm,
      grossWeightKg: record.gross_weight_kg,
      incoterm: record.incoterm,
      transportMode: record.transport_mode,
      vesselVoyage: record.vessel_voyage,
      billNo: record.bill_no,
      etd: record.etd,
      eta: record.eta,
      remark: record.remark,
      createdAt: record.created_at,
      attachments: logisticsAttachments.get(Number(record.id)) || [],
      attachmentCount: (logisticsAttachments.get(Number(record.id)) || []).length,
    })),
    customs: customs
      ? {
          ...customs,
          brokerName: customs.broker_name,
          declarationNo: customs.declaration_no,
          declarationDate: customs.declaration_date,
          releaseDate: customs.release_date,
          createdAt: customs.created_at,
          updatedAt: customs.updated_at,
          attachments: customsAttachments.get(Number(customs.id)) || [],
          attachmentCount: (customsAttachments.get(Number(customs.id)) || []).length,
        }
      : null,
    domesticLogistics: domesticLogisticsRecord
      ? {
          ...domesticLogisticsRecord,
          segmentType: domesticLogisticsRecord.segment_type || 'domestic',
          trackingNo: domesticLogisticsRecord.tracking_no,
          packingDetails: domesticLogisticsRecord.packing_details,
          shippingDate: domesticLogisticsRecord.shipping_date,
          packageCount: domesticLogisticsRecord.package_count,
          volumeCbm: domesticLogisticsRecord.volume_cbm,
          grossWeightKg: domesticLogisticsRecord.gross_weight_kg,
          transportMode: domesticLogisticsRecord.transport_mode,
          vesselVoyage: domesticLogisticsRecord.vessel_voyage,
          billNo: domesticLogisticsRecord.bill_no,
          createdAt: domesticLogisticsRecord.created_at,
          attachments: logisticsAttachments.get(Number(domesticLogisticsRecord.id)) || [],
          attachmentCount: (logisticsAttachments.get(Number(domesticLogisticsRecord.id)) || []).length,
        }
      : null,
    internationalLogistics: internationalLogisticsRecord
      ? {
          ...internationalLogisticsRecord,
          segmentType: internationalLogisticsRecord.segment_type || 'international',
          trackingNo: internationalLogisticsRecord.tracking_no,
          packingDetails: internationalLogisticsRecord.packing_details,
          shippingDate: internationalLogisticsRecord.shipping_date,
          packageCount: internationalLogisticsRecord.package_count,
          volumeCbm: internationalLogisticsRecord.volume_cbm,
          grossWeightKg: internationalLogisticsRecord.gross_weight_kg,
          transportMode: internationalLogisticsRecord.transport_mode,
          vesselVoyage: internationalLogisticsRecord.vessel_voyage,
          billNo: internationalLogisticsRecord.bill_no,
          createdAt: internationalLogisticsRecord.created_at,
          attachments: logisticsAttachments.get(Number(internationalLogisticsRecord.id)) || [],
          attachmentCount: (logisticsAttachments.get(Number(internationalLogisticsRecord.id)) || []).length,
        }
      : null,
    summary: {
      receiptsByCurrency,
      paymentsByCurrency,
      freightByCurrency,
      pendingFinanceCount: pendingFinanceCount?.count || 0,
      latestLogisticsStatus: latestLogistics?.status || null,
      latestShippingDate: latestLogistics?.shipping_date || null,
      paidAmount: receiptsByCurrency.USD,
      outstandingAmount,
      paymentStatus,
      settled,
      attachmentsSummary: {
        finance: financeRecords.reduce((sum, record) => sum + (financeAttachments.get(Number(record.id)) || []).length, 0),
        logistics: logisticsRecords.reduce((sum, record) => sum + (logisticsAttachments.get(Number(record.id)) || []).length, 0),
        customs: customs ? (customsAttachments.get(Number(customs.id)) || []).length : 0,
      },
    },
  };
}

router.post('/auth/login', async (req, res) => {
  const username = readString(req.body?.username);
  const password = readString(req.body?.password);

  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  try {
    const user = await db.get<{ id: number; username: string; role: string; name: string; password: string }>(
      `SELECT * FROM users WHERE username = ?`,
      [username],
    );
    if (!user) {
      return res.status(401).json({ error: '无效的用户名或密码' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '无效的用户名或密码' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' },
    );

    res.cookie('token', token, getCookieOptions());
    res.json({
      user: { id: user.id, username: user.username, role: user.role, name: user.name },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

router.post('/auth/logout', (_req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction(),
    sameSite: (isProduction() ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  });
  res.json({ success: true });
});

router.get('/auth/me', async (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const user = await db.get<{ id: number; username: string; role: string; name: string }>(
      `SELECT id, username, role, name FROM users WHERE id = ?`,
      [decoded.id],
    );
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ user });
  } catch (_error) {
    res.status(401).json({ error: '无效的令牌' });
  }
});

router.get('/settings/ai', requireAuth, async (_req, res) => {
  try {
    const modelSetting = await db.get<{ value: string }>(`SELECT value FROM settings WHERE key = 'current_ai_model'`);
    const keySetting = await db.get<{ value: string }>(`SELECT value FROM settings WHERE key = 'ai_api_key'`);
    const baseSetting = await db.get<{ value: string }>(`SELECT value FROM settings WHERE key = 'ai_base_url'`);

    res.json({
      model: modelSetting?.value || 'gemini-2.5-flash',
      apiKey: keySetting?.value ? '***' : '',
      hasApiKey: Boolean(keySetting?.value || process.env.GEMINI_API_KEY),
      baseUrl: baseSetting?.value || '',
    });
  } catch (_error) {
    res.status(500).json({ error: '无法读取设置' });
  }
});

router.post('/settings/ai', requireAuth, async (req, res) => {
  const model = readString(req.body?.model) || 'gemini-2.5-flash';
  const apiKey = readString(req.body?.apiKey);
  const baseUrl = readString(req.body?.baseUrl);

  try {
    await db.run(
      `INSERT INTO settings (key, value) VALUES ('current_ai_model', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [model],
    );

    if (apiKey && apiKey !== '***') {
      await db.run(
        `INSERT INTO settings (key, value) VALUES ('ai_api_key', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [apiKey],
      );
    }

    await db.run(
      `INSERT INTO settings (key, value) VALUES ('ai_base_url', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [baseUrl],
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '保存设置失败' });
  }
});

router.get('/settings/document', requireAuth, async (_req, res) => {
  try {
    const prefix = await getOrderNumberPrefix();
    res.json({ orderNumberPrefix: prefix });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '读取单据编码规则失败' });
  }
});

router.post('/settings/document', requireAuth, async (req, res) => {
  const prefix = readString(req.body?.orderNumberPrefix) || 'ORD-';

  try {
    await setSettingValue('order_number_prefix', prefix);
    res.json({ success: true, orderNumberPrefix: prefix });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '保存单据编码规则失败' });
  }
});

router.get('/dashboard', requireAuth, async (_req, res) => {
  try {
    const overview = await db.get<{
      totalOrders: number;
      activeOrders: number;
      draftOrders: number;
      completedOrders: number;
    }>(`
      SELECT
        COUNT(*) AS totalOrders,
        SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) AS activeOrders,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draftOrders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedOrders
      FROM orders
    `);

    const financeRows = await db.all<{ type: FinanceType; currency: Currency; total: number }[]>(`
      SELECT type, currency, COALESCE(SUM(amount), 0) AS total
      FROM finance_records
      WHERE status = 'completed'
      GROUP BY type, currency
    `);

    const pendingFinance = await db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM finance_records WHERE status = 'pending'`,
    );
    const pendingLogistics = await db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM logistics_records WHERE status != 'arrived'`,
    );

    const recentFinance = await db.all(`
      SELECT
        f.*,
        o.display_id AS order_display_id,
        c.name AS customer_name
      FROM finance_records f
      LEFT JOIN orders o ON f.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY datetime(f.created_at) DESC, f.id DESC
      LIMIT 6
    `);

    const recentLogistics = await db.all(`
      SELECT
        l.*,
        o.display_id AS order_display_id,
        c.name AS customer_name
      FROM logistics_records l
      LEFT JOIN orders o ON l.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY COALESCE(l.shipping_date, l.created_at) DESC, l.id DESC
      LIMIT 6
    `);

    const financeSummary = financeRows.reduce<Record<FinanceType, Partial<Record<Currency, number>>>>(
      (accumulator, row) => {
        if (!accumulator[row.type]) {
          accumulator[row.type] = {};
        }
        accumulator[row.type][row.currency] = row.total;
        return accumulator;
      },
      { receipt: {}, payment: {} },
    );

    res.json({
      overview: {
        totalOrders: overview?.totalOrders || 0,
        activeOrders: overview?.activeOrders || 0,
        draftOrders: overview?.draftOrders || 0,
        completedOrders: overview?.completedOrders || 0,
      },
      financeSummary,
      pendingFinanceCount: pendingFinance?.count || 0,
      pendingLogisticsCount: pendingLogistics?.count || 0,
      recentFinance,
      recentLogistics,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '读取控制台数据失败' });
  }
});

router.get('/customers', requireAuth, async (_req, res) => {
  try {
    const customers = await db.all(`
      SELECT
        c.*,
        COUNT(o.id) AS order_count
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      GROUP BY c.id
      ORDER BY datetime(c.created_at) DESC, c.id DESC
    `);
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '读取客户数据失败' });
  }
});

router.post('/customers', requireAuth, async (req: AuthedRequest, res) => {
  const name = readString(req.body?.name);
  const country = readString(req.body?.country);
  const contact = readString(req.body?.contact);
  const logisticsPreference = readString(req.body?.logisticsPreference);
  const paymentTerms = readString(req.body?.paymentTerms);

  if (!name || !country || !contact) {
    return res.status(400).json({ error: '请完整填写客户名称、国家和联系信息' });
  }

  try {
    const result = await db.run(
      `
        INSERT INTO customers (name, country, contact, logistics_preference, payment_terms, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [name, country, contact, logisticsPreference, paymentTerms, req.user?.id || null],
    );

    res.status(201).json({ id: result.lastID });
  } catch (error: any) {
    console.error('Insert Customer Error:', error);
    res.status(500).json({ error: error.message || '创建客户失败' });
  }
});

router.patch('/customers/:id', requireAuth, async (req, res) => {
  const customerId = Number(req.params.id);
  const name = readString(req.body?.name);
  const country = readString(req.body?.country);
  const contact = readString(req.body?.contact);
  const logisticsPreference = readString(req.body?.logisticsPreference);
  const paymentTerms = readString(req.body?.paymentTerms);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({ error: '客户编号无效' });
  }
  if (!name || !country || !contact) {
    return res.status(400).json({ error: '请完整填写客户名称、国家和联系信息' });
  }

  try {
    const result = await db.run(
      `
        UPDATE customers
        SET name = ?, country = ?, contact = ?, logistics_preference = ?, payment_terms = ?
        WHERE id = ?
      `,
      [name, country, contact, logisticsPreference, paymentTerms, customerId],
    );
    if (!result.changes) {
      return res.status(404).json({ error: '客户不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '更新客户失败' });
  }
});

router.delete('/customers/:id', requireAuth, async (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({ error: '客户编号无效' });
  }

  try {
    const linkedOrders = await db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM orders WHERE customer_id = ?`,
      [customerId],
    );

    if ((linkedOrders?.count || 0) > 0) {
      return res.status(409).json({ error: '该客户下仍有关联订单，不能删除' });
    }

    const result = await db.run(`DELETE FROM customers WHERE id = ?`, [customerId]);
    if (!result.changes) {
      return res.status(404).json({ error: '客户不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '删除客户失败' });
  }
});

router.get('/partners', requireAuth, async (_req, res) => {
  try {
    const partners = await db.all(`
      SELECT *
      FROM partners
      ORDER BY datetime(created_at) DESC, id DESC
    `);
    res.json(partners);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '读取伙伴数据失败' });
  }
});

router.post('/partners', requireAuth, async (req, res) => {
  const result = await readPartnerPayload(req.body || {});
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const created = await db.run(
      `
        INSERT INTO partners (name, partner_type, country, contact, payment_terms, remark)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        result.payload.name,
        result.payload.partnerType,
        result.payload.country,
        result.payload.contact,
        result.payload.paymentTerms,
        result.payload.remark,
      ],
    );
    res.status(201).json({ id: created.lastID });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '创建伙伴失败' });
  }
});

router.patch('/partners/:id', requireAuth, async (req, res) => {
  const partnerId = Number(req.params.id);
  if (!Number.isInteger(partnerId) || partnerId <= 0) {
    return res.status(400).json({ error: '伙伴编号无效' });
  }

  const result = await readPartnerPayload(req.body || {});
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const updated = await db.run(
      `
        UPDATE partners
        SET name = ?, partner_type = ?, country = ?, contact = ?, payment_terms = ?, remark = ?
        WHERE id = ?
      `,
      [
        result.payload.name,
        result.payload.partnerType,
        result.payload.country,
        result.payload.contact,
        result.payload.paymentTerms,
        result.payload.remark,
        partnerId,
      ],
    );
    if (!updated.changes) {
      return res.status(404).json({ error: '伙伴不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '更新伙伴失败' });
  }
});

router.delete('/partners/:id', requireAuth, async (req, res) => {
  const partnerId = Number(req.params.id);
  if (!Number.isInteger(partnerId) || partnerId <= 0) {
    return res.status(400).json({ error: '伙伴编号无效' });
  }

  try {
    const linkedFinance = await db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM finance_records WHERE partner_id = ?`,
      [partnerId],
    );
    const linkedProduction = await db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM production_plans WHERE partner_id = ?`,
      [partnerId],
    );

    if ((linkedFinance?.count || 0) > 0 || (linkedProduction?.count || 0) > 0) {
      return res.status(409).json({ error: '该伙伴已被财务或生产安排引用，暂时不能删除' });
    }

    const deleted = await db.run(`DELETE FROM partners WHERE id = ?`, [partnerId]);
    if (!deleted.changes) {
      return res.status(404).json({ error: '伙伴不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '删除伙伴失败' });
  }
});

router.get('/orders', requireAuth, async (req, res) => {
  const q = readString(req.query.q);
  const product = readString(req.query.product);
  const country = readString(req.query.country);
  const status = readString(req.query.status);
  const customerId = readString(req.query.customerId);
  const orderMonth = monthFromDateInput(readString(req.query.orderMonth));
  const shippingMonth = monthFromDateInput(readString(req.query.shippingMonth));

  const where: string[] = [];
  const params: unknown[] = [];

  if (customerId) {
    where.push(`o.customer_id = ?`);
    params.push(Number(customerId));
  }
  if (country) {
    where.push(`c.country = ?`);
    params.push(country);
  }
  if (status && isOneOf(status, ORDER_STATUSES)) {
    where.push(`o.status = ?`);
    params.push(status);
  }
  if (orderMonth) {
    where.push(`strftime('%Y-%m', o.created_at) = ?`);
    params.push(orderMonth);
  }
  if (shippingMonth) {
    where.push(`
      EXISTS (
        SELECT 1
        FROM logistics_records l
        WHERE l.order_id = o.id
          AND l.shipping_date IS NOT NULL
          AND substr(l.shipping_date, 1, 7) = ?
      )
    `);
    params.push(shippingMonth);
  }
  if (q) {
    const pattern = `%${q}%`;
    where.push(`
      (
        o.display_id LIKE ?
        OR c.name LIKE ?
        OR c.country LIKE ?
        OR COALESCE(o.product_summary, '') LIKE ?
        OR COALESCE(o.details, '') LIKE ?
        OR EXISTS (
          SELECT 1
          FROM order_items oi
          WHERE oi.order_id = o.id
            AND (oi.product_name LIKE ? OR COALESCE(oi.specification, '') LIKE ?)
        )
      )
    `);
    params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }
  if (product) {
    const productPattern = `%${product}%`;
    where.push(`
      (
        COALESCE(o.product_summary, '') LIKE ?
        OR EXISTS (
          SELECT 1
          FROM order_items oi
          WHERE oi.order_id = o.id
            AND (oi.product_name LIKE ? OR COALESCE(oi.specification, '') LIKE ?)
        )
      )
    `);
    params.push(productPattern, productPattern, productPattern);
  }

  const sql = `
    SELECT
      o.id,
      o.display_id,
      o.customer_id,
      o.status,
      o.total_amount,
      o.details,
      o.product_summary,
      o.created_at,
      c.name AS customer_name,
      c.country AS customer_country,
      (
        SELECT COUNT(*)
        FROM finance_records f
        WHERE f.order_id = o.id
      ) AS finance_count,
      (
        SELECT COUNT(*)
        FROM finance_records f
        WHERE f.order_id = o.id AND f.status = 'pending'
      ) AS pending_finance_count,
      COALESCE((
        SELECT SUM(f.amount)
        FROM finance_records f
        WHERE f.order_id = o.id
          AND f.type = 'receipt'
          AND f.status = 'completed'
          AND f.currency = 'USD'
      ), 0) AS completed_receipt_usd,
      COALESCE((
        SELECT SUM(f.amount)
        FROM finance_records f
        WHERE f.order_id = o.id
          AND f.type = 'payment'
          AND f.status = 'completed'
          AND f.currency = 'CNY'
      ), 0) AS completed_payment_cny,
      (
        SELECT l.status
        FROM logistics_records l
        WHERE l.order_id = o.id
        ORDER BY COALESCE(l.shipping_date, l.created_at) DESC, l.id DESC
        LIMIT 1
      ) AS latest_logistics_status,
      (
        SELECT l.tracking_no
        FROM logistics_records l
        WHERE l.order_id = o.id
        ORDER BY COALESCE(l.shipping_date, l.created_at) DESC, l.id DESC
        LIMIT 1
      ) AS latest_tracking_no,
      (
        SELECT COUNT(*)
        FROM logistics_records l
        WHERE l.order_id = o.id
      ) AS logistics_count,
      MAX(
        o.created_at,
        COALESCE((SELECT MAX(created_at) FROM finance_records f WHERE f.order_id = o.id), o.created_at),
        COALESCE((SELECT MAX(COALESCE(l.shipping_date, l.created_at)) FROM logistics_records l WHERE l.order_id = o.id), o.created_at),
        COALESCE((SELECT MAX(created_at) FROM order_items oi WHERE oi.order_id = o.id), o.created_at)
      ) AS latest_activity_at
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY latest_activity_at DESC, o.id DESC
  `;

  try {
    const orders = await db.all(sql, params);
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '读取订单数据失败' });
  }
});

router.get('/orders/:id', requireAuth, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: '订单编号无效' });
  }

  try {
    const detail = await buildOrderDetail(orderId);
    if (!detail) {
      return res.status(404).json({ error: '订单不存在' });
    }
    res.json(detail);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '读取订单详情失败' });
  }
});

router.post('/orders', requireAuth, async (req: AuthedRequest, res) => {
  const result = await readOrderPayload(req.body || {});
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const prefix = await getOrderNumberPrefix();
    const created = await db.run(
      `
        INSERT INTO orders (customer_id, status, details, total_amount, product_summary, delivery_date, key_milestone, freight_amount, misc_amount, created_by)
        VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        result.payload.customerId,
        result.payload.details,
        result.payload.totalAmount,
        result.payload.productSummary,
        result.payload.deliveryDate || null,
        result.payload.keyMilestone,
        result.payload.freightAmount,
        result.payload.miscAmount,
        req.user?.id || null,
      ],
    );

    const orderId = created.lastID as number;
    const displayId = `${prefix}${new Date().getFullYear()}-${String(orderId).padStart(6, '0')}`;
    await db.run(`UPDATE orders SET display_id = ? WHERE id = ?`, [displayId, orderId]);

    res.status(201).json({ id: orderId, display_id: displayId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '创建订单失败' });
  }
});

router.patch('/orders/:id', requireAuth, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: '订单编号无效' });
  }

  const result = await readOrderPayload(req.body || {});
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const updated = await db.run(
      `
        UPDATE orders
        SET customer_id = ?, details = ?, total_amount = ?, product_summary = ?, delivery_date = ?, key_milestone = ?, freight_amount = ?, misc_amount = ?
        WHERE id = ?
      `,
      [
        result.payload.customerId,
        result.payload.details,
        result.payload.totalAmount,
        result.payload.productSummary,
        result.payload.deliveryDate || null,
        result.payload.keyMilestone,
        result.payload.freightAmount,
        result.payload.miscAmount,
        orderId,
      ],
    );
    if (!updated.changes) {
      return res.status(404).json({ error: '订单不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '更新订单失败' });
  }
});

router.patch('/orders/:id/status', requireAuth, async (req, res) => {
  const orderId = Number(req.params.id);
  const status = normalizeOrderStatus(readString(req.body?.status));

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: '订单编号无效' });
  }
  if (!isOneOf(status, ORDER_STATUSES)) {
    return res.status(400).json({ error: '订单状态不正确' });
  }

  try {
    const result = await db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status as OrderStatus, orderId]);
    if (!result.changes) {
      return res.status(404).json({ error: '订单不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '更新订单状态失败' });
  }
});

router.post('/orders/:id/items', requireAuth, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: '订单编号无效' });
  }

  const result = await readOrderItemPayload(req.body || {}, orderId);
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const created = await db.run(
      `
        INSERT INTO order_items (order_id, product_name, specification, quantity, unit, unit_price, subtotal, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        result.payload.orderId,
        result.payload.productName,
        result.payload.specification,
        result.payload.quantity,
        result.payload.unit,
        result.payload.unitPrice,
        result.payload.subtotal,
        result.payload.imageUrl,
      ],
    );
    await syncOrderProductSummary(orderId);
    res.status(201).json({ id: created.lastID });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '新增产品明细失败' });
  }
});

router.patch('/order-items/:id', requireAuth, async (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ error: '产品明细编号无效' });
  }

  const existing = await db.get<{ order_id: number }>(`SELECT order_id FROM order_items WHERE id = ?`, [itemId]);
  if (!existing) {
    return res.status(404).json({ error: '产品明细不存在' });
  }

  const result = await readOrderItemPayload(req.body || {}, existing.order_id);
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    await db.run(
      `
        UPDATE order_items
        SET product_name = ?, specification = ?, quantity = ?, unit = ?, unit_price = ?, subtotal = ?, image_url = ?
        WHERE id = ?
      `,
      [
        result.payload.productName,
        result.payload.specification,
        result.payload.quantity,
        result.payload.unit,
        result.payload.unitPrice,
        result.payload.subtotal,
        result.payload.imageUrl,
        itemId,
      ],
    );
    await syncOrderProductSummary(existing.order_id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '更新产品明细失败' });
  }
});

router.delete('/order-items/:id', requireAuth, async (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ error: '产品明细编号无效' });
  }

  const existing = await db.get<{ order_id: number }>(`SELECT order_id FROM order_items WHERE id = ?`, [itemId]);
  if (!existing) {
    return res.status(404).json({ error: '产品明细不存在' });
  }

  try {
    await db.run(`DELETE FROM order_items WHERE id = ?`, [itemId]);
    await syncOrderProductSummary(existing.order_id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '删除产品明细失败' });
  }
});

router.get('/orders/:id/production', requireAuth, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: '订单编号无效' });
  }

  try {
    const record = await db.get<Record<string, unknown>>(
      `
        SELECT
          pp.*,
          p.name AS partner_name,
          p.partner_type AS partner_type
        FROM production_plans pp
        LEFT JOIN partners p ON p.id = pp.partner_id
        WHERE pp.order_id = ?
        LIMIT 1
      `,
      [orderId],
    );
    res.json(
      record
        ? {
            ...record,
            partnerId: record.partner_id,
            partnerName: record.partner_name,
            orderDate: record.order_date,
            estimatedDeliveryDate: record.estimated_delivery_date,
            productionStatus: record.production_status,
            inspectionStatus: record.inspection_status,
            updatedAt: record.updated_at,
          }
        : null,
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '读取生产安排失败' });
  }
});

router.post('/orders/:id/production', requireAuth, async (req, res) => {
  const orderId = Number(req.params.id);
  const result = await readProductionPayload(req.body || {}, orderId);
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const existing = await db.get<{ id: number }>(`SELECT id FROM production_plans WHERE order_id = ?`, [orderId]);
    if (existing) {
      return res.status(409).json({ error: '该订单已有生产安排，请直接编辑' });
    }

    const created = await db.run(
      `
        INSERT INTO production_plans (
          order_id, partner_id, order_date, estimated_delivery_date, production_status, inspection_status, remark
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        result.payload.orderId,
        result.payload.partnerId,
        result.payload.orderDate || null,
        result.payload.estimatedDeliveryDate || null,
        result.payload.productionStatus,
        result.payload.inspectionStatus,
        result.payload.remark,
      ],
    );
    res.status(201).json({ id: created.lastID });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '保存生产安排失败' });
  }
});

router.patch('/production/:id', requireAuth, async (req, res) => {
  const productionId = Number(req.params.id);
  if (!Number.isInteger(productionId) || productionId <= 0) {
    return res.status(400).json({ error: '生产安排编号无效' });
  }

  const existing = await db.get<{ order_id: number }>(`SELECT order_id FROM production_plans WHERE id = ?`, [productionId]);
  if (!existing) {
    return res.status(404).json({ error: '生产安排不存在' });
  }

  const result = await readProductionPayload(req.body || {}, existing.order_id);
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    await db.run(
      `
        UPDATE production_plans
        SET partner_id = ?, order_date = ?, estimated_delivery_date = ?, production_status = ?, inspection_status = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        result.payload.partnerId,
        result.payload.orderDate || null,
        result.payload.estimatedDeliveryDate || null,
        result.payload.productionStatus,
        result.payload.inspectionStatus,
        result.payload.remark,
        productionId,
      ],
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '更新生产安排失败' });
  }
});

router.get('/finance', requireAuth, async (_req, res) => {
  try {
    const records = await db.all<Record<string, unknown>[]>(`
      SELECT
        f.*,
        p.name AS partner_name,
        o.display_id AS order_display_id,
        c.name AS customer_name
      FROM finance_records f
      LEFT JOIN partners p ON p.id = f.partner_id
      LEFT JOIN orders o ON f.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY datetime(f.created_at) DESC, f.id DESC
    `);
    const attachments = await getAttachmentsByEntity(
      'finance',
      records.map((record) => Number(record.id)),
    );
    res.json(
      records.map((record) => ({
        ...record,
        recordCategory:
          record.record_category || record.payment_category || (record.type === 'receipt' ? 'deposit' : 'other'),
        partnerId: record.partner_id || null,
        partner_name: record.partner_name || null,
        attachments: attachments.get(Number(record.id)) || [],
        attachmentCount: (attachments.get(Number(record.id)) || []).length,
      })),
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '读取财务数据失败' });
  }
});

router.post('/finance', requireAuth, async (req, res) => {
  const result = await readFinancePayload(req.body || {});
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const created = await db.run(
      `
        INSERT INTO finance_records (order_id, type, amount, target, status, remark, currency, payment_category, partner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        result.payload.orderId,
        result.payload.type,
        result.payload.amount,
        result.payload.target,
        result.payload.status,
        result.payload.remark,
        result.payload.currency,
        result.payload.paymentCategory,
        result.payload.partnerId,
      ],
    );
    await db.run(`UPDATE finance_records SET record_category = ? WHERE id = ?`, [result.payload.recordCategory, created.lastID]);
    await bindAttachmentsToEntity('finance', created.lastID as number, result.payload.attachmentIds);
    res.status(201).json({ id: created.lastID });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '保存财务数据失败' });
  }
});

router.patch('/finance/:id', requireAuth, async (req, res) => {
  const recordId = Number(req.params.id);
  if (!Number.isInteger(recordId) || recordId <= 0) {
    return res.status(400).json({ error: '财务记录编号无效' });
  }

  const result = await readFinancePayload(req.body || {});
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const updated = await db.run(
      `
        UPDATE finance_records
        SET order_id = ?, type = ?, amount = ?, target = ?, status = ?, remark = ?, currency = ?, payment_category = ?, record_category = ?, partner_id = ?
        WHERE id = ?
      `,
      [
        result.payload.orderId,
        result.payload.type,
        result.payload.amount,
        result.payload.target,
        result.payload.status,
        result.payload.remark,
        result.payload.currency,
        result.payload.paymentCategory,
        result.payload.recordCategory,
        result.payload.partnerId,
        recordId,
      ],
    );
    if (!updated.changes) {
      return res.status(404).json({ error: '财务记录不存在' });
    }
    await bindAttachmentsToEntity('finance', recordId, result.payload.attachmentIds);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '更新财务记录失败' });
  }
});

router.delete('/finance/:id', requireAuth, async (req, res) => {
  const recordId = Number(req.params.id);
  if (!Number.isInteger(recordId) || recordId <= 0) {
    return res.status(400).json({ error: '财务记录编号无效' });
  }

  try {
    await deleteAttachmentRows('finance', recordId);
    const result = await db.run(`DELETE FROM finance_records WHERE id = ?`, [recordId]);
    if (!result.changes) {
      return res.status(404).json({ error: '财务记录不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '删除财务记录失败' });
  }
});

router.get('/logistics', requireAuth, async (_req, res) => {
  try {
    const records = await db.all<Record<string, unknown>[]>(`
      SELECT
        l.*,
        o.display_id AS order_display_id,
        o.status AS order_status,
        c.name AS customer_name
      FROM logistics_records l
      LEFT JOIN orders o ON l.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY
        CASE WHEN l.segment_type = 'domestic' THEN 0 ELSE 1 END ASC,
        CASE WHEN l.shipping_date IS NULL OR l.shipping_date = '' THEN 1 ELSE 0 END ASC,
        l.shipping_date DESC,
        datetime(l.created_at) DESC,
        l.id DESC
    `);
    const attachments = await getAttachmentsByEntity(
      'logistics',
      records.map((record) => Number(record.id)),
    );
    res.json(
      records.map((record) => ({
        ...record,
        segmentType: record.segment_type || 'international',
        packageCount: record.package_count,
        volumeCbm: record.volume_cbm,
        grossWeightKg: record.gross_weight_kg,
        transportMode: record.transport_mode,
        vesselVoyage: record.vessel_voyage,
        billNo: record.bill_no,
        attachments: attachments.get(Number(record.id)) || [],
        attachmentCount: (attachments.get(Number(record.id)) || []).length,
      })),
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '读取物流数据失败' });
  }
});

router.post('/logistics', requireAuth, async (req, res) => {
  const result = await readLogisticsPayload(req.body || {});
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const created = await db.run(
      `
        INSERT INTO logistics_records (
          order_id, tracking_no, carrier, packing_details, status, shipping_date, segment_type,
          package_count, volume_cbm, gross_weight_kg, incoterm, transport_mode, vessel_voyage, bill_no, etd, eta, remark
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        result.payload.orderId,
        result.payload.trackingNo,
        result.payload.carrier,
        result.payload.packingDetails,
        result.payload.status,
        result.payload.shippingDate || null,
        result.payload.segmentType,
        result.payload.packageCount,
        result.payload.volumeCbm,
        result.payload.grossWeightKg,
        result.payload.incoterm,
        result.payload.transportMode,
        result.payload.vesselVoyage,
        result.payload.billNo,
        result.payload.etd || null,
        result.payload.eta || null,
        result.payload.remark,
      ],
    );
    await bindAttachmentsToEntity('logistics', created.lastID as number, result.payload.attachmentIds);
    res.status(201).json({ id: created.lastID });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '保存物流数据失败' });
  }
});

router.patch('/logistics/:id', requireAuth, async (req, res) => {
  const recordId = Number(req.params.id);
  if (!Number.isInteger(recordId) || recordId <= 0) {
    return res.status(400).json({ error: '物流记录编号无效' });
  }

  const result = await readLogisticsPayload(req.body || {});
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const updated = await db.run(
      `
        UPDATE logistics_records
        SET order_id = ?, tracking_no = ?, carrier = ?, packing_details = ?, status = ?, shipping_date = ?, segment_type = ?,
            package_count = ?, volume_cbm = ?, gross_weight_kg = ?, incoterm = ?, transport_mode = ?, vessel_voyage = ?, bill_no = ?, etd = ?, eta = ?, remark = ?
        WHERE id = ?
      `,
      [
        result.payload.orderId,
        result.payload.trackingNo,
        result.payload.carrier,
        result.payload.packingDetails,
        result.payload.status,
        result.payload.shippingDate || null,
        result.payload.segmentType,
        result.payload.packageCount,
        result.payload.volumeCbm,
        result.payload.grossWeightKg,
        result.payload.incoterm,
        result.payload.transportMode,
        result.payload.vesselVoyage,
        result.payload.billNo,
        result.payload.etd || null,
        result.payload.eta || null,
        result.payload.remark,
        recordId,
      ],
    );
    if (!updated.changes) {
      return res.status(404).json({ error: '物流记录不存在' });
    }
    await bindAttachmentsToEntity('logistics', recordId, result.payload.attachmentIds);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '更新物流记录失败' });
  }
});

router.patch('/logistics/:id/status', requireAuth, async (req, res) => {
  const recordId = Number(req.params.id);
  const status = readString(req.body?.status);

  if (!Number.isInteger(recordId) || recordId <= 0) {
    return res.status(400).json({ error: '物流记录编号无效' });
  }
  if (!isOneOf(status, LOGISTICS_STATUSES)) {
    return res.status(400).json({ error: '物流状态不正确' });
  }

  try {
    const result = await db.run(`UPDATE logistics_records SET status = ? WHERE id = ?`, [
      status as LogisticsStatus,
      recordId,
    ]);
    if (!result.changes) {
      return res.status(404).json({ error: '物流记录不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '更新物流状态失败' });
  }
});

router.get('/orders/:id/customs', requireAuth, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: '订单编号无效' });
  }

  try {
    const record = await db.get<Record<string, unknown>>(`SELECT * FROM customs_records WHERE order_id = ? LIMIT 1`, [orderId]);
    if (!record) {
      return res.json(null);
    }
    const attachments = await getAttachmentsByEntity('customs', [Number(record.id)]);
    res.json({
      ...record,
      attachments: attachments.get(Number(record.id)) || [],
      attachmentCount: (attachments.get(Number(record.id)) || []).length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '读取报关信息失败' });
  }
});

router.post('/orders/:id/customs', requireAuth, async (req, res) => {
  const orderId = Number(req.params.id);
  const result = await readCustomsPayload({ ...(req.body || {}), orderId });
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const existing = await db.get<{ id: number }>(`SELECT id FROM customs_records WHERE order_id = ?`, [orderId]);
    if (existing) {
      return res.status(409).json({ error: '该订单已有报关信息，请直接编辑' });
    }
    const created = await db.run(
      `
        INSERT INTO customs_records (order_id, status, broker_name, declaration_no, declaration_date, release_date, remark, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [
        result.payload.orderId,
        result.payload.status,
        result.payload.brokerName,
        result.payload.declarationNo,
        result.payload.declarationDate || null,
        result.payload.releaseDate || null,
        result.payload.remark,
      ],
    );
    await bindAttachmentsToEntity('customs', created.lastID as number, result.payload.attachmentIds);
    res.status(201).json({ id: created.lastID });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '保存报关信息失败' });
  }
});

router.patch('/customs/:id', requireAuth, async (req, res) => {
  const customsId = Number(req.params.id);
  if (!Number.isInteger(customsId) || customsId <= 0) {
    return res.status(400).json({ error: '报关记录编号无效' });
  }

  const existing = await db.get<{ order_id: number }>(`SELECT order_id FROM customs_records WHERE id = ?`, [customsId]);
  if (!existing) {
    return res.status(404).json({ error: '报关记录不存在' });
  }

  const result = await readCustomsPayload({ ...(req.body || {}), orderId: existing.order_id });
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  try {
    await db.run(
      `
        UPDATE customs_records
        SET status = ?, broker_name = ?, declaration_no = ?, declaration_date = ?, release_date = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        result.payload.status,
        result.payload.brokerName,
        result.payload.declarationNo,
        result.payload.declarationDate || null,
        result.payload.releaseDate || null,
        result.payload.remark,
        customsId,
      ],
    );
    await bindAttachmentsToEntity('customs', customsId, result.payload.attachmentIds);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '更新报关信息失败' });
  }
});

router.post('/customs/:id/attachments', requireAuth, upload.array('files', 6), async (req, res) => {
  const customsId = Number(req.params.id);
  if (!Number.isInteger(customsId) || customsId <= 0) {
    return res.status(400).json({ error: '报关记录编号无效' });
  }

  const existing = await db.get<{ id: number }>(`SELECT id FROM customs_records WHERE id = ?`, [customsId]);
  if (!existing) {
    return res.status(404).json({ error: '报关记录不存在' });
  }

  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) {
    return res.status(400).json({ error: '请至少上传一个附件' });
  }

  try {
    const uploaded = [];
    for (const file of files) {
      const result = await db.run(
        `
          INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          'customs',
          customsId,
          file.originalname,
          file.filename,
          file.mimetype,
          file.size,
          `uploads/${file.filename}`,
        ],
      );

      uploaded.push({
        id: result.lastID,
        fileName: file.originalname,
        filePath: `uploads/${file.filename}`,
        url: `/uploads/${file.filename}`,
        mimeType: file.mimetype,
        fileSize: file.size,
      });
    }

    res.status(201).json(uploaded);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '上传报关附件失败' });
  }
});

router.post('/attachments', requireAuth, upload.array('files', 6), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) {
    return res.status(400).json({ error: '请至少上传一个附件' });
  }

  try {
    const uploaded = [];
    for (const file of files) {
      const result = await db.run(
        `
          INSERT INTO attachments (entity_type, entity_id, file_name, stored_name, mime_type, file_size, file_path)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          null,
          null,
          file.originalname,
          file.filename,
          file.mimetype,
          file.size,
          `uploads/${file.filename}`,
        ],
      );

      uploaded.push({
        id: result.lastID,
        fileName: file.originalname,
        filePath: `uploads/${file.filename}`,
        url: `/uploads/${file.filename}`,
        mimeType: file.mimetype,
        fileSize: file.size,
      });
    }

    res.status(201).json(uploaded);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '附件上传失败' });
  }
});

router.delete('/attachments/:id', requireAuth, async (req, res) => {
  const attachmentId = Number(req.params.id);
  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    return res.status(400).json({ error: '附件编号无效' });
  }

  try {
    const existing = await db.get<{ file_path: string }>(`SELECT file_path FROM attachments WHERE id = ?`, [attachmentId]);
    if (!existing) {
      return res.status(404).json({ error: '附件不存在' });
    }

    if (existing.file_path) {
      try {
        await fs.unlink(path.join(__dirname, '..', existing.file_path));
      } catch (_error) {
        // Ignore missing files during cleanup.
      }
    }

    await db.run(`DELETE FROM attachments WHERE id = ?`, [attachmentId]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '删除附件失败' });
  }
});

router.post('/ai/parse-order', requireAuth, async (req, res) => {
  const text = readString(req.body?.text);
  if (!text) {
    return res.status(400).json({ error: '请提供需要解析的文本' });
  }

  try {
    const keySetting = await db.get<{ value: string }>(`SELECT value FROM settings WHERE key = 'ai_api_key'`);
    const modelSetting = await db.get<{ value: string }>(`SELECT value FROM settings WHERE key = 'current_ai_model'`);
    const baseSetting = await db.get<{ value: string }>(`SELECT value FROM settings WHERE key = 'ai_base_url'`);
    const selectedModel = modelSetting?.value || 'gemini-2.5-flash';
    const provider = resolveAiProvider(selectedModel);
    const apiKey =
      keySetting?.value ||
      process.env.AI_API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.OPENAI_API_KEY;
    const configuredBaseUrl = readString(baseSetting?.value);
    const baseUrl =
      configuredBaseUrl ||
      (provider === 'deepseek'
        ? 'https://api.deepseek.com/v1'
        : provider === 'openai-compatible'
          ? 'https://api.openai.com/v1'
          : '');

    if (!apiKey) {
      return res.status(400).json({ error: '请先在系统设置中配置可用的 AI API Key' });
    }

    const prompt = buildOrderParsingPrompt(text);
    let result: unknown;

    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: prompt,
      });
      result = parseJsonObject(response.text || '');
    } else {
      if (!baseUrl) {
        return res.status(400).json({ error: '当前模型需要配置兼容的 Base URL' });
      }
      result = await runOpenAiCompatibleModel({
        model: selectedModel,
        apiKey,
        baseUrl,
        prompt,
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error('AI Parsing Error:', error);
    res.status(500).json({ error: `AI 解析失败: ${error.message}` });
  }
});

export default router;
