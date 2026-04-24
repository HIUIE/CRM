import {
  CURRENCIES,
  CUSTOMS_STATUSES,
  FINANCE_STATUSES,
  FINANCE_TYPES,
  INSPECTION_STATUSES,
  LOGISTICS_SEGMENTS,
  LOGISTICS_STATUSES,
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
  type PartnerType,
  type PaymentCategory,
  type ProductionStatus,
  type RecordCategory,
} from '../domain.js';
import { db } from '../db.js';
import { ensureOrderExists, ensurePartnerExists } from './entities.js';
import { isOneOf, readAttachmentIds, readNumber, readOptionalDate, readString } from '../lib/values.js';

export async function readPartnerPayload(body: Record<string, unknown>) {
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

export async function readProductionPayload(body: Record<string, unknown>, orderId: number) {
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

export async function readOrderPayload(body: Record<string, unknown>) {
  const customerId = readNumber(body.customerId);
  const productSummary = readString(body.productSummary);
  const details = readString(body.details);
  const totalAmount = readNumber(body.totalAmount);
  const deliveryDate = readOptionalDate(body.deliveryDate);
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
      freightAmount,
      miscAmount,
    },
  };
}

export async function readOrderItemPayload(body: Record<string, unknown>, orderId: number) {
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

export async function readFinancePayload(body: Record<string, unknown>) {
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
      target: target || partner?.name || '',
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

export async function readCustomsPayload(body: Record<string, unknown>) {
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
