import type {
  AttachmentMeta,
  CustomsFormState,
  CustomsRecord,
  CustomsStatus,
  EditableOrderItem,
  FinanceCategory,
  FinanceFormState,
  FinanceRecord,
  InspectionStatus,
  LogisticsFormState,
  LogisticsRecord,
  OrderDetailResponse,
  OrderFormState,
  OrderInfo,
  OrderItem,
  OrderStatus,
  ProductionFormState,
  ProductionPlan,
  ProductionStatus,
  SectionKey,
} from './types';

export const STAGE_STEPS: Array<{ key: OrderStatus; label: string; target: SectionKey }> = [
  { key: 'draft', label: '待受理', target: 'basic' },
  { key: 'production', label: '生产中', target: 'production' },
  { key: 'customs', label: '报关中', target: 'customs' },
  { key: 'shipping', label: '运输中', target: 'logistics' },
  { key: 'completed', label: '已完成', target: 'finance' },
];

export const EMPTY_ORDER_FORM: OrderFormState = {
  status: 'draft',
  totalAmount: '0',
  deliveryDate: '',
  freightAmount: '0',
  miscAmount: '0',
  details: '',
  items: [],
};

export const EMPTY_FINANCE_FORM: FinanceFormState = {
  type: 'receipt',
  amount: '',
  currency: 'USD',
  status: 'completed',
  recordCategory: 'deposit',
  target: '',
  partnerId: '',
  remark: '',
  attachments: [],
  newFiles: [],
};

export const EMPTY_PRODUCTION_FORM: ProductionFormState = {
  partnerId: '',
  orderDate: '',
  estimatedDeliveryDate: '',
  productionStatus: 'not_started',
  inspectionStatus: 'pending',
  remark: '',
};

export const EMPTY_LOGISTICS_FORM: LogisticsFormState = {
  segmentType: 'international',
  carrier: '',
  trackingNo: '',
  status: 'preparing',
  shippingDate: '',
  packageCount: '',
  volumeCbm: '',
  grossWeightKg: '',
  incoterm: '',
  transportMode: '',
  vesselVoyage: '',
  billNo: '',
  etd: '',
  eta: '',
  packingDetails: '',
  remark: '',
  attachments: [],
  newFiles: [],
};

export const EMPTY_CUSTOMS_FORM: CustomsFormState = {
  status: 'not_started',
  brokerName: '',
  declarationNo: '',
  declarationDate: '',
  releaseDate: '',
  remark: '',
  attachments: [],
  newFiles: [],
};

export function asText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function formatMoney(value: unknown, currency: string) {
  return `${currency} ${asNumber(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatDateOnly(value: unknown, fallback = '未填写') {
  const text = asText(value);
  if (!text) {
    return fallback;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString();
}

export function formatDateTime(value: unknown, fallback = '未填写') {
  const text = asText(value);
  if (!text) {
    return fallback;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleString();
}

export function getStageMeta(status: string) {
  switch (status) {
    case 'draft':
      return { label: '待受理', className: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'production':
      return { label: '生产中', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'customs':
      return { label: '报关中', className: 'bg-orange-50 text-orange-700 border-orange-200' };
    case 'shipping':
      return { label: '运输中', className: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'completed':
      return { label: '已完成', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    default:
      return { label: status || '未知', className: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

export function getPaymentMeta(status: OrderDetailResponse['summary'] extends { paymentStatus?: infer T } ? T : never) {
  switch (status) {
    case 'unpaid':
      return { label: '待收款', className: 'bg-orange-50 text-orange-700 border-orange-200' };
    case 'partial':
      return { label: '部分收款', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'paid':
      return { label: '已收款', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    default:
      return { label: '待收款', className: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

export function getFinanceCategoryLabel(category: FinanceCategory) {
  switch (category) {
    case 'deposit':
      return '首付款';
    case 'balance':
      return '尾款';
    case 'goods':
      return '货款';
    case 'freight':
      return '运费';
    case 'customs':
      return '报关费';
    default:
      return '其他';
  }
}

export function getCustomsStatusLabel(status: CustomsStatus) {
  switch (status) {
    case 'not_started':
      return '未开始';
    case 'preparing':
      return '准备中';
    case 'submitted':
      return '已申报';
    case 'inspected':
      return '查验中';
    case 'released':
      return '已放行';
    default:
      return status;
  }
}

export function getProductionStatusLabel(status: ProductionStatus) {
  switch (status) {
    case 'not_started':
      return '未开始';
    case 'scheduled':
      return '已排产';
    case 'in_progress':
      return '生产中';
    case 'ready':
      return '待出货';
    default:
      return status;
  }
}

export function getInspectionStatusLabel(status: InspectionStatus) {
  switch (status) {
    case 'pending':
      return '待验货';
    case 'passed':
      return '已通过';
    case 'failed':
      return '未通过';
    default:
      return status;
  }
}

export function getDeliveryMeta(value: string) {
  if (!value) {
    return { label: '未设置交货期', className: 'border-slate-200 bg-slate-50 text-slate-500' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return { label: `已逾期 ${Math.abs(diffDays)} 天`, className: 'border-red-200 bg-red-50 text-red-700' };
  }
  if (diffDays <= 7) {
    return { label: `${diffDays} 天内到期`, className: 'border-amber-200 bg-amber-50 text-amber-700' };
  }
  return { label: '交期正常', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
}

export function makeDraftItem(item?: OrderItem): EditableOrderItem {
  return {
    clientKey: item?.id ? `item-${item.id}` : `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    id: item?.id,
    imageUrl: asText(item?.imageUrl),
    productName: asText(item?.product_name),
    specification: asText(item?.specification),
    quantity: item?.quantity != null ? String(item.quantity) : '1',
    unit: asText(item?.unit),
    unitPrice: item?.unit_price != null ? String(item.unit_price) : '0',
    subtotal: item?.subtotal != null ? String(item.subtotal) : '0',
  };
}

export function buildOrderForm(order: OrderInfo, items: OrderItem[]): OrderFormState {
  return {
    status: order.status,
    totalAmount: String(order.total_amount ?? 0),
    deliveryDate: asText(order.deliveryDate),
    freightAmount: String(order.freightAmount ?? 0),
    miscAmount: String(order.miscAmount ?? 0),
    details: asText(order.details),
    items: items.map((item) => makeDraftItem(item)),
  };
}

export function buildFinanceForm(record: FinanceRecord | null, customerName: string): FinanceFormState {
  return {
    id: record?.id,
    type: record?.type || 'receipt',
    amount: record?.amount != null ? String(record.amount) : '',
    currency: record?.currency || 'USD',
    status: record?.status || 'completed',
    recordCategory:
      (record?.recordCategory as FinanceCategory) || (record?.type === 'payment' ? 'goods' : 'deposit'),
    target: asText(record?.target, customerName),
    partnerId: record?.partnerId ? String(record.partnerId) : '',
    remark: asText(record?.remark),
    attachments: record?.attachments || [],
    newFiles: [],
  };
}

export function buildProductionForm(plan: ProductionPlan | null): ProductionFormState {
  return {
    id: plan?.id,
    partnerId: plan?.partnerId ? String(plan.partnerId) : '',
    orderDate: asText(plan?.orderDate),
    estimatedDeliveryDate: asText(plan?.estimatedDeliveryDate),
    productionStatus: plan?.productionStatus || 'not_started',
    inspectionStatus: plan?.inspectionStatus || 'pending',
    remark: asText(plan?.remark),
  };
}

export function buildLogisticsForm(record: LogisticsRecord | null): LogisticsFormState {
  return {
    id: record?.id,
    segmentType: record?.segmentType || 'international',
    carrier: asText(record?.carrier),
    trackingNo: asText(record?.trackingNo),
    status: record?.status || 'preparing',
    shippingDate: asText(record?.shippingDate),
    packageCount: record?.packageCount != null ? String(record.packageCount) : '',
    volumeCbm: record?.volumeCbm != null ? String(record.volumeCbm) : '',
    grossWeightKg: record?.grossWeightKg != null ? String(record.grossWeightKg) : '',
    incoterm: asText(record?.incoterm),
    transportMode: asText(record?.transportMode),
    vesselVoyage: asText(record?.vesselVoyage),
    billNo: asText(record?.billNo),
    etd: asText(record?.etd),
    eta: asText(record?.eta),
    packingDetails: asText(record?.packingDetails),
    remark: asText(record?.remark),
    attachments: record?.attachments || [],
    newFiles: [],
  };
}

export function buildCustomsForm(record: CustomsRecord | null): CustomsFormState {
  return {
    id: record?.id,
    status: record?.status || 'not_started',
    brokerName: asText(record?.brokerName),
    declarationNo: asText(record?.declarationNo),
    declarationDate: asText(record?.declarationDate),
    releaseDate: asText(record?.releaseDate),
    remark: asText(record?.remark),
    attachments: record?.attachments || [],
    newFiles: [],
  };
}
