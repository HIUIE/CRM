import {
  CURRENCIES,
  CUSTOMS_STATUSES,
  FINANCE_STATUSES,
  FINANCE_TYPES,
  INSPECTION_STATUSES,
  LOGISTICS_SEGMENTS,
  LOGISTICS_STATUSES,
  ORDER_STATUSES,
  TAX_MODES,
  PARTNER_TYPES,
  PAYMENT_CATEGORIES,
  PRODUCTION_STATUSES,
  RECORD_CATEGORIES,
  type Currency,
  type CustomsStatus,
  type FinanceStatus,
  type FinanceType,
  type InspectionStatus,
  type LogisticsSegment,
  type LogisticsStatus,
  type OrderStatus,
  type TaxMode,
  type PartnerType,
  type PaymentCategory,
  type ProductionStatus,
  type RecordCategory,
} from '../domain.js';
import { dbGet } from '../lib/db.js';
import { ensureOrderExists, ensurePartnerExists } from './entities.js';
import { isOneOf, readAttachmentIds, readNumber, readOptionalDate, readString } from '../lib/values.js';

export async function readPartnerPayload(body: Record<string, unknown>) {
  const name = readString(body.name, 200);
  const partnerType = readString(body.partnerType, 50);
  const country = readString(body.country, 100);
  const contact = readString(body.contact, 200);
  const contactPerson = readString(body.contactPerson, 100);
  const address = readString(body.address, 500);
  const rating = readNumber(body.rating);
  const paymentTerms = readString(body.paymentTerms, 300);
  const remark = readString(body.remark, 5000);

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
      contactPerson,
      address,
      rating,
      paymentTerms,
      remark,
    },
  };
}

export async function readProductionPayload(body: Record<string, unknown>, orderId: number) {
  const partnerIdInput = readNumber(body.partnerId);
  const orderDate = readOptionalDate(body.orderDate);
  const estimatedDeliveryDate = readOptionalDate(body.estimatedDeliveryDate);
  const productionStatus = readString(body.productionStatus, 50);
  const inspectionStatus = readString(body.inspectionStatus, 50);
  const remark = readString(body.remark, 5000);
  const attachmentIds = readAttachmentIds(body.attachmentIds);

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
      attachmentIds,
    },
  };
}

export async function readOrderPayload(body: Record<string, unknown>) {
  const customerId = readNumber(body.customerId);
  const displayId = readString(body.displayId, 50);
  const status = readString(body.status, 50);
  const productSummary = readString(body.productSummary, 2000);
  const details = readString(body.details, 10000);
  const totalAmount = readNumber(body.totalAmount);
  const currencyInput = readString(body.currency || body.settlementCurrency || 'USD', 10).toUpperCase();
  const deliveryDate = readOptionalDate(body.deliveryDate);
  const freightAmountInput = readNumber(body.freightAmount);
  const miscAmountInput = readNumber(body.miscAmount);
  const freightAmount = Number.isFinite(freightAmountInput) ? freightAmountInput : 0;
  const miscAmount = Number.isFinite(miscAmountInput) ? miscAmountInput : 0;
  const alibabaOrderNo = readString(body.alibabaOrderNo || body.alibaba_order_no, 100);
  const taxMode = readString(body.taxMode || body.tax_mode || 'A', 10).toUpperCase();

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return { error: '请选择有效客户' };
  }
  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    return { error: '订单金额必须大于或等于 0' };
  }
  if (!isOneOf(currencyInput, CURRENCIES)) {
    return { error: '订单结算币种不正确' };
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
  if (!isOneOf(taxMode, TAX_MODES)) {
    return { error: '订单业务模式不正确' };
  }

  const customer = await dbGet<{ id: number }>(`SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL`, [customerId]);
  if (!customer) {
    return { error: '客户不存在，请先创建客户档案' };
  }

  return {
    payload: {
      customerId,
      displayId,
      status: (status as OrderStatus) || 'draft',
      productSummary,
      details,
      totalAmount,
      currency: currencyInput as Currency,
      deliveryDate,
      freightAmount,
      miscAmount,
      alibabaOrderNo,
      taxMode: taxMode as TaxMode,
    },
  };
}

export async function readOrderItemPayload(body: Record<string, unknown>, orderId: number) {
  const productName = readString(body.productName, 500);
  const specification = readString(body.specification, 500);
  const hsCode = readString(body.hsCode, 50);
  const unit = readString(body.unit, 30);
  const quantity = readNumber(body.quantity);
  const unitPrice = readNumber(body.unitPrice);
  const subtotalInput = readNumber(body.subtotal);
  const imageUrl = readString(body.imageUrl, 500);
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
      hsCode,
      quantity,
      unit,
      unitPrice,
      subtotal,
      imageUrl,
    },
  };
}

export async function readFinancePayload(body: Record<string, unknown>) {
  const orderId = readNumber(body.orderId);
  const partnerIdInput = readNumber(body.partnerId);
  const type = readString(body.type, 50);
  const amount = readNumber(body.amount);
  const currency = readString(body.currency, 10).toUpperCase();
  const target = readString(body.target, 300);
  const status = readString(body.status, 50);
  const remark = readString(body.remark, 5000);
  const paymentCategoryInput = readString(body.paymentCategory, 50);
  const recordCategoryInput = readString(body.recordCategory, 50);
  const attachmentIds = readAttachmentIds(body.attachmentIds);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { error: '请选择有效的关联订单' };
  }
  const orderCustomer = await dbGet<{ id: number; name: string; display_id: string }>(
    `SELECT c.id, c.name, c.display_id
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.id = ? AND o.deleted_at IS NULL AND c.deleted_at IS NULL`,
    [orderId],
  );
  if (!orderCustomer) {
    return { error: '关联订单不存在' };
  }
  if (!isOneOf(type, FINANCE_TYPES)) {
    return { error: '账单类型不正确' };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: '金额必须大于 0' };
  }
  if (!currency) {
    return { error: '请填写币种' };
  }
  if (!isOneOf(currency, CURRENCIES)) {
    return { error: '币种不正确' };
  }
  if (!isOneOf(status, FINANCE_STATUSES)) {
    return { error: '财务状态不正确' };
  }

  const partnerId = type === 'payment' && Number.isInteger(partnerIdInput) && partnerIdInput > 0 ? partnerIdInput : null;
  const partner = partnerId ? await ensurePartnerExists(partnerId) : null;
  if (partnerId && !partner) {
    return { error: '付款对象不存在，请先维护伙伴档案' };
  }
  const normalizedTarget = type === 'receipt' ? (orderCustomer.name || orderCustomer.display_id || '') : (partner?.name || target);
  if (type === 'payment' && !partnerId && !normalizedTarget) {
    return { error: '付款时请选择合作伙伴或填写付款对象' };
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
          : recordCategory === 'other' || recordCategory === 'customs' || recordCategory === 'balance' || recordCategory === 'deposit'
            ? 'other'
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
      target: normalizedTarget,
      status: status as FinanceStatus,
      remark,
      paymentCategory: paymentCategory as PaymentCategory,
      recordCategory,
      attachmentIds,
    },
  };
}

export async function readLogisticsPayload(body: Record<string, unknown>) {
  const orderId = readNumber(body.orderId);
  const trackingNo = readString(body.trackingNo, 100);
  const carrier = readString(body.carrier, 200);
  const freightForwarder = readString(body.freightForwarder, 200);
  const freightForwarderPartnerId = readNumber(body.freightForwarderPartnerId);
  const packingDetails = readString(body.packingDetails, 3000);
  const status = readString(body.status, 50);
  const shippingDate = readString(body.shippingDate, 30);
  const segmentTypeInput = readString(body.segmentType, 50);
  const packageCount = readNumber(body.packageCount);
  const volumeCbm = readNumber(body.volumeCbm);
  const grossWeightKg = readNumber(body.grossWeightKg);
  const incoterm = readString(body.incoterm, 30);
  const transportMode = readString(body.transportMode, 50);
  const vesselVoyage = readString(body.vesselVoyage, 100);
  const billNo = readString(body.billNo, 100);
  const etd = readOptionalDate(body.etd);
  const eta = readOptionalDate(body.eta);
  const remark = readString(body.remark, 5000);
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
  let freightForwarderPartner: { id: number; name: string; partner_type: string } | undefined;
  if (Number.isInteger(freightForwarderPartnerId) && freightForwarderPartnerId > 0) {
    freightForwarderPartner = await dbGet<{ id: number; name: string; partner_type: string }>(
      `SELECT id, name, partner_type FROM partners WHERE id = ? AND deleted_at IS NULL`,
      [freightForwarderPartnerId],
    );
    if (!freightForwarderPartner) {
      return { error: '选择的货运代理不存在' };
    }
    if (freightForwarderPartner.partner_type !== 'forwarder') {
      return { error: '货运代理必须选择货代类型的合作伙伴' };
    }
  }
  if (!isOneOf(status, LOGISTICS_STATUSES)) {
    return { error: '物流状态不正确' };
  }
  const segmentType = isOneOf(segmentTypeInput, LOGISTICS_SEGMENTS)
    ? (segmentTypeInput as LogisticsSegment)
    : 'international';
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
      freightForwarder: freightForwarderPartner?.name || freightForwarder,
      freightForwarderPartnerId: freightForwarderPartner?.id || null,
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
      recipientAddress: readString(body.recipientAddress, 500),
      packageSize: readString(body.packageSize, 300),
      remark,
      attachmentIds,
    },
  };
}

export async function readCustomsPayload(body: Record<string, unknown>) {
  const orderId = readNumber(body.orderId);
  const status = readString(body.status, 50);
  const brokerName = readString(body.brokerName, 200);
  const declarationNo = readString(body.declarationNo, 100);
  const declarationDate = readOptionalDate(body.declarationDate);
  const releaseDate = readOptionalDate(body.releaseDate);
  const tradeMode = readString(body.tradeMode, 50);
  const remark = readString(body.remark, 5000);
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
      tradeMode,
      remark,
      attachmentIds,
    },
  };
}

export async function readProductionLogPayload(body: Record<string, unknown>) {
  const content = readString(body.content, 5000);
  const logDate = readOptionalDate(body.logDate);
  const attachmentIds = readAttachmentIds(body.attachmentIds);

  if (!content) {
    return { error: '请填写进度描述' };
  }
  if (logDate === '__invalid__') {
    return { error: '日期格式不正确' };
  }

  return {
    payload: {
      content,
      logDate: logDate || '',
      attachmentIds,
    },
  };
}
