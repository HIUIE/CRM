import dayjs from 'dayjs';
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
  ProductionLog,
  ProductionLogFormState,
  SectionKey,
} from './types';

export const STAGE_STEPS: Array<{ key: OrderStatus; label: string; target: SectionKey }> = [
  { key: 'draft', label: '待受理', target: 'basic' },
  { key: 'production', label: '生产中', target: 'production' },
  { key: 'customs', label: '报关中', target: 'customs' },
  { key: 'shipping', label: '发运中', target: 'logistics' },
  { key: 'completed', label: '已结清', target: 'finance' },
];

export const EMPTY_ORDER_FORM: OrderFormState = {
  status: 'draft',
  customerId: '',
  productSummary: '',
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
  photos: [],
  newPhotos: [],
};

export const EMPTY_LOGISTICS_FORM: LogisticsFormState = {
  segmentType: 'international',
  freightForwarder: '',
  carrier: '',
  trackingNo: '',
  status: 'preparing',
  shippingDate: '',
  incoterm: '',
  transportMode: 'sea',
  vesselVoyage: '',
  billNo: '',
  etd: '',
  eta: '',
  packingDetails: '',
  recipientAddress: '',
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
  tradeMode: '一般贸易',
  remark: '',
  attachments: [],
  newFiles: [],
};

export function asNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export function asText(val: any, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  return String(val);
}

export function formatDateTime(val: any): string {
  if (!val) return '-';
  const d = dayjs(val);
  if (!d.isValid()) return String(val);
  return d.format('YYYY-MM-DD HH:mm');
}

export function formatDateOnly(val: any, fallback = '-'): string {
  if (!val) return fallback;
  const d = dayjs(val);
  if (!d.isValid()) return String(val).split('T')[0];
  return d.format('YYYY-MM-DD');
}

export function getProductionStatusLabel(status: ProductionStatus): string {
  switch (status) {
    case 'not_started': return '待产';
    case 'scheduled': return '已排产';
    case 'in_progress': return '生产中';
    case 'ready': return '已完工';
    default: return status;
  }
}

export function getInspectionStatusLabel(status: InspectionStatus): string {
  switch (status) {
    case 'pending': return '待质检';
    case 'passed': return '质检通过';
    case 'failed': return '质检异常';
    default: return status;
  }
}

export function orderToFormState(order: OrderInfo, items: OrderItem[]): OrderFormState {
  return {
    id: order.id,
    status: order.status,
    customerId: String(order.customer_id),
    productSummary: asText(order.product_summary),
    totalAmount: String(order.total_amount),
    deliveryDate: asText(order.deliveryDate),
    freightAmount: String(order.freightAmount || 0),
    miscAmount: String(order.miscAmount || 0),
    details: asText(order.details),
    items: items.map((it) => ({
      clientKey: Math.random().toString(36).slice(2),
      id: it.id,
      imageUrl: asText(it.imageUrl || it.image_url),
      productName: it.product_name,
      specification: asText(it.specification),
      quantity: String(it.quantity),
      unit: asText(it.unit, 'pcs'),
      unitPrice: String(it.unit_price),
      subtotal: String(it.subtotal),
    })),
  };
}

export function buildFinanceForm(record: FinanceRecord | null, customerName: string): FinanceFormState {
  return {
    id: record?.id,
    type: record?.type || 'receipt',
    amount: record ? String(record.amount) : '',
    currency: record?.currency || 'USD',
    status: record?.status || 'completed',
    recordCategory: (record?.recordCategory as any) || (record?.type === 'payment' ? 'goods' : 'deposit'),
    target: record?.target || (record?.type === 'receipt' ? customerName : ''),
    partnerId: record?.partnerId ? String(record.partnerId) : '',
    remark: record?.remark || '',
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
    photos: plan?.photos || [],
    newPhotos: [],
  };
}

export function buildLogisticsForm(record: LogisticsRecord | null): LogisticsFormState {
  return {
    id: record?.id,
    segmentType: record?.segmentType || 'international',
    freightForwarder: asText(record?.freightForwarder),
    carrier: asText(record?.carrier),
    trackingNo: asText(record?.trackingNo),
    status: record?.status || 'preparing',
    shippingDate: asText(record?.shippingDate),
    incoterm: asText(record?.incoterm),
    transportMode: asText(record?.transportMode, 'sea'),
    vesselVoyage: asText(record?.vesselVoyage),
    billNo: asText(record?.billNo),
    etd: asText(record?.etd),
    eta: asText(record?.eta),
    packingDetails: asText(record?.packingDetails),
    recipientAddress: asText(record?.recipientAddress),
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
    tradeMode: asText(record?.tradeMode, '一般贸易'),
    remark: asText(record?.remark),
    attachments: record?.attachments || [],
    newFiles: [],
  };
}

export function buildProductionLogForm(log: Partial<ProductionLog> | null): ProductionLogFormState {
  return {
    logDate: asText(log?.logDate || new Date().toISOString().split('T')[0]),
    content: asText(log?.content),
    attachments: log?.attachments || [],
    newFiles: [],
  };
}
