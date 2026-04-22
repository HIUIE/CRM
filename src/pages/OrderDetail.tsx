import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Factory,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';

type SectionKey = 'basic' | 'items' | 'production' | 'finance' | 'customs' | 'logistics';
type OrderStatus = 'draft' | 'production' | 'customs' | 'shipping' | 'completed';
type FinanceType = 'receipt' | 'payment';
type FinanceStatus = 'pending' | 'completed';
type FinanceCategory = 'deposit' | 'balance' | 'goods' | 'freight' | 'customs' | 'other';
type LogisticsStatus = 'preparing' | 'shipped' | 'arrived';
type LogisticsSegment = 'domestic' | 'international';
type CustomsStatus = 'not_started' | 'preparing' | 'submitted' | 'inspected' | 'released';
type PartnerType = 'factory' | 'forwarder' | 'customs_broker' | 'other';
type ProductionStatus = 'not_started' | 'scheduled' | 'in_progress' | 'ready';
type InspectionStatus = 'pending' | 'passed' | 'failed';

type AttachmentMeta = {
  id: number;
  fileName: string;
  url: string;
  fileSize?: number | null;
  mimeType?: string | null;
};

type Partner = {
  id: number;
  name: string;
  partner_type: PartnerType;
  country?: string | null;
  contact?: string | null;
  payment_terms?: string | null;
  remark?: string | null;
};

type CustomerInfo = {
  id?: number | null;
  name?: string | null;
  country?: string | null;
  contact?: string | null;
  logisticsPreference?: string | null;
  paymentTerms?: string | null;
};

type OrderInfo = {
  id: number;
  display_id: string;
  customer_id: number;
  status: OrderStatus;
  details?: string | null;
  total_amount?: number | null;
  created_at?: string | null;
  deliveryDate?: string | null;
  freightAmount?: number | null;
  miscAmount?: number | null;
};

type OrderItem = {
  id: number;
  product_name?: string | null;
  specification?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  subtotal?: number | null;
  imageUrl?: string | null;
};

type FinanceRecord = {
  id: number;
  type: FinanceType;
  amount?: number | null;
  currency?: 'USD' | 'CNY' | null;
  target?: string | null;
  status: FinanceStatus;
  remark?: string | null;
  recordCategory?: FinanceCategory | null;
  partnerId?: number | null;
  partnerName?: string | null;
  createdAt?: string | null;
  attachments?: AttachmentMeta[];
  attachmentCount?: number;
};

type ProductionPlan = {
  id: number;
  partnerId: number;
  partnerName?: string | null;
  orderDate?: string | null;
  estimatedDeliveryDate?: string | null;
  productionStatus: ProductionStatus;
  inspectionStatus: InspectionStatus;
  remark?: string | null;
  updatedAt?: string | null;
};

type LogisticsRecord = {
  id: number;
  carrier?: string | null;
  status: LogisticsStatus;
  segmentType?: LogisticsSegment | null;
  trackingNo?: string | null;
  packingDetails?: string | null;
  shippingDate?: string | null;
  packageCount?: number | null;
  volumeCbm?: number | null;
  grossWeightKg?: number | null;
  incoterm?: string | null;
  transportMode?: string | null;
  vesselVoyage?: string | null;
  billNo?: string | null;
  etd?: string | null;
  eta?: string | null;
  remark?: string | null;
  createdAt?: string | null;
  attachments?: AttachmentMeta[];
  attachmentCount?: number;
};

type CustomsRecord = {
  id: number;
  status: CustomsStatus;
  brokerName?: string | null;
  declarationNo?: string | null;
  declarationDate?: string | null;
  releaseDate?: string | null;
  remark?: string | null;
  attachments?: AttachmentMeta[];
  attachmentCount?: number;
  updatedAt?: string | null;
};

type OrderDetailResponse = {
  order?: OrderInfo | null;
  customer?: CustomerInfo | null;
  items?: OrderItem[] | null;
  financeRecords?: FinanceRecord[] | null;
  productionPlan?: ProductionPlan | null;
  customs?: CustomsRecord | null;
  logisticsRecords?: LogisticsRecord[] | null;
  domesticLogistics?: LogisticsRecord | null;
  internationalLogistics?: LogisticsRecord | null;
  summary?: {
    paidAmount?: number | null;
    outstandingAmount?: number | null;
    paymentStatus?: 'unpaid' | 'partial' | 'paid' | null;
    settled?: boolean | null;
  } | null;
};

type EditableOrderItem = {
  clientKey: string;
  id?: number;
  imageUrl: string;
  productName: string;
  specification: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  subtotal: string;
};

type OrderFormState = {
  status: OrderStatus;
  totalAmount: string;
  deliveryDate: string;
  freightAmount: string;
  miscAmount: string;
  details: string;
  items: EditableOrderItem[];
};

type FinanceFormState = {
  id?: number;
  type: FinanceType;
  amount: string;
  currency: 'USD' | 'CNY';
  status: FinanceStatus;
  recordCategory: FinanceCategory;
  target: string;
  partnerId: string;
  remark: string;
  attachments: AttachmentMeta[];
  newFiles: File[];
};

type ProductionFormState = {
  id?: number;
  partnerId: string;
  orderDate: string;
  estimatedDeliveryDate: string;
  productionStatus: ProductionStatus;
  inspectionStatus: InspectionStatus;
  remark: string;
};

type LogisticsFormState = {
  id?: number;
  segmentType: LogisticsSegment;
  carrier: string;
  trackingNo: string;
  status: LogisticsStatus;
  shippingDate: string;
  packageCount: string;
  volumeCbm: string;
  grossWeightKg: string;
  incoterm: string;
  transportMode: string;
  vesselVoyage: string;
  billNo: string;
  etd: string;
  eta: string;
  packingDetails: string;
  remark: string;
  attachments: AttachmentMeta[];
  newFiles: File[];
};

type CustomsFormState = {
  id?: number;
  status: CustomsStatus;
  brokerName: string;
  declarationNo: string;
  declarationDate: string;
  releaseDate: string;
  remark: string;
  attachments: AttachmentMeta[];
  newFiles: File[];
};

type DrawerState =
  | { mode: 'closed' }
  | { mode: 'order' }
  | { mode: 'finance'; recordId?: number }
  | { mode: 'production' }
  | { mode: 'customs' }
  | { mode: 'customs-upload' }
  | { mode: 'logistics'; recordId?: number };

const STAGE_STEPS: Array<{ key: OrderStatus; label: string; target: SectionKey }> = [
  { key: 'draft', label: '待整理', target: 'basic' },
  { key: 'production', label: '生产中', target: 'production' },
  { key: 'customs', label: '报关中', target: 'customs' },
  { key: 'shipping', label: '发货中', target: 'logistics' },
  { key: 'completed', label: '已完成', target: 'finance' },
];

const EMPTY_ORDER_FORM: OrderFormState = {
  status: 'draft',
  totalAmount: '0',
  deliveryDate: '',
  freightAmount: '0',
  miscAmount: '0',
  details: '',
  items: [],
};

const EMPTY_FINANCE_FORM: FinanceFormState = {
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

const EMPTY_PRODUCTION_FORM: ProductionFormState = {
  partnerId: '',
  orderDate: '',
  estimatedDeliveryDate: '',
  productionStatus: 'not_started',
  inspectionStatus: 'pending',
  remark: '',
};

const EMPTY_LOGISTICS_FORM: LogisticsFormState = {
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

const EMPTY_CUSTOMS_FORM: CustomsFormState = {
  status: 'not_started',
  brokerName: '',
  declarationNo: '',
  declarationDate: '',
  releaseDate: '',
  remark: '',
  attachments: [],
  newFiles: [],
};

function asText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatMoney(value: unknown, currency: string) {
  return `${currency} ${asNumber(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDateOnly(value: unknown, fallback = '未填写') {
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

function formatDateTime(value: unknown, fallback = '未填写') {
  const text = asText(value);
  if (!text) {
    return fallback;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleString();
}

function getStageMeta(status: string) {
  switch (status) {
    case 'draft':
      return { label: '待整理', className: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'production':
      return { label: '生产中', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'customs':
      return { label: '报关中', className: 'bg-orange-50 text-orange-700 border-orange-200' };
    case 'shipping':
      return { label: '发货中', className: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'completed':
      return { label: '已完成', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    default:
      return { label: status || '未知', className: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

function getPaymentMeta(status: OrderDetailResponse['summary'] extends { paymentStatus?: infer T } ? T : never) {
  switch (status) {
    case 'unpaid':
      return { label: '待付款', className: 'bg-orange-50 text-orange-700 border-orange-200' };
    case 'partial':
      return { label: '部分付款', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'paid':
      return { label: '已付款', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    default:
      return { label: '待付款', className: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

function getFinanceCategoryLabel(category: FinanceCategory) {
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

function getCustomsStatusLabel(status: CustomsStatus) {
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

function getProductionStatusLabel(status: ProductionStatus) {
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

function getInspectionStatusLabel(status: InspectionStatus) {
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

function getDeliveryMeta(value: string) {
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

function makeDraftItem(item?: OrderItem): EditableOrderItem {
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

function buildOrderForm(order: OrderInfo, items: OrderItem[]): OrderFormState {
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

function buildFinanceForm(record: FinanceRecord | null, customerName: string): FinanceFormState {
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

function buildProductionForm(plan: ProductionPlan | null): ProductionFormState {
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

function buildLogisticsForm(record: LogisticsRecord | null): LogisticsFormState {
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

function buildCustomsForm(record: CustomsRecord | null): CustomsFormState {
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

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const orderId = Number(id);

  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'closed' });
  const [orderForm, setOrderForm] = useState<OrderFormState>(EMPTY_ORDER_FORM);
  const [financeForm, setFinanceForm] = useState<FinanceFormState>(EMPTY_FINANCE_FORM);
  const [productionForm, setProductionForm] = useState<ProductionFormState>(EMPTY_PRODUCTION_FORM);
  const [logisticsForm, setLogisticsForm] = useState<LogisticsFormState>(EMPTY_LOGISTICS_FORM);
  const [customsForm, setCustomsForm] = useState<CustomsFormState>(EMPTY_CUSTOMS_FORM);
  const [customsUploadFiles, setCustomsUploadFiles] = useState<File[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<number[]>([]);
  const [drawerError, setDrawerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [financeFilter, setFinanceFilter] = useState<'all' | FinanceType>('all');
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    basic: false,
    items: false,
    production: false,
    finance: false,
    customs: false,
    logistics: false,
  });
  const [activeSection, setActiveSection] = useState<SectionKey>('basic');

  const basicRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<HTMLDivElement | null>(null);
  const productionRef = useRef<HTMLDivElement | null>(null);
  const financeRef = useRef<HTMLDivElement | null>(null);
  const customsRef = useRef<HTMLDivElement | null>(null);
  const logisticsRef = useRef<HTMLDivElement | null>(null);

  const sectionRefs: Record<SectionKey, React.RefObject<HTMLDivElement | null>> = {
    basic: basicRef,
    items: itemsRef,
    production: productionRef,
    finance: financeRef,
    customs: customsRef,
    logistics: logisticsRef,
  };

  const loadDetail = async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    if (!Number.isInteger(orderId) || orderId <= 0) {
      setError('订单编号无效');
      setLoading(false);
      return;
    }

    if (showLoading) {
      setLoading(true);
    }
    setError('');

    try {
      const [detailData, partnerData] = await Promise.all([
        apiFetch<OrderDetailResponse>(`/api/orders/${orderId}`),
        apiFetch<Partner[]>('/api/partners'),
      ]);
      if (!detailData?.order) {
        throw new Error('订单详情返回为空');
      }
      setDetail(detailData);
      setPartners(partnerData);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '读取订单详情失败'));
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [orderId]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) {
          return;
        }
        const section = visible.target.getAttribute('data-section') as SectionKey | null;
        if (section) {
          setActiveSection(section);
        }
      },
      {
        rootMargin: '-25% 0px -55% 0px',
        threshold: [0.2, 0.4, 0.6],
      },
    );

    Object.values(sectionRefs).forEach((ref) => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => observer.disconnect();
  }, []);

  const order = detail?.order;
  const customer = detail?.customer || {};
  const items = detail?.items || [];
  const financeRecords = detail?.financeRecords || [];
  const productionPlan = detail?.productionPlan || null;
  const customs = detail?.customs || null;
  const logisticsRecords = detail?.logisticsRecords || [];
  const domesticLogistics = detail?.domesticLogistics || null;
  const internationalLogistics = detail?.internationalLogistics || null;
  const summary = detail?.summary || {};

  const paidAmount = asNumber(summary.paidAmount);
  const outstandingAmount = asNumber(summary.outstandingAmount);
  const orderTotal = asNumber(order?.total_amount);
  const freightAmount = asNumber(order?.freightAmount);
  const miscAmount = asNumber(order?.miscAmount);
  const grandTotal = orderTotal + freightAmount + miscAmount;
  const stageMeta = getStageMeta(order?.status || 'draft');
  const paymentMeta = getPaymentMeta(summary.paymentStatus);
  const deliveryMeta = getDeliveryMeta(asText(order?.deliveryDate));
  const stageIndex = STAGE_STEPS.findIndex((step) => step.key === order?.status);
  const settled = Boolean(summary.settled || (orderTotal > 0 && outstandingAmount <= 0));
  const hasAnyLogistics = Boolean(domesticLogistics || internationalLogistics || logisticsRecords.length);

  const filteredFinanceRecords = useMemo(() => {
    if (financeFilter === 'all') {
      return financeRecords;
    }
    return financeRecords.filter((record) => record.type === financeFilter);
  }, [financeFilter, financeRecords]);

  const productionPartners = useMemo(
    () => partners.filter((partner) => partner.partner_type === 'factory' || partner.partner_type === 'other'),
    [partners],
  );

  const paymentPartners = useMemo(() => partners, [partners]);

  const scrollToSection = (section: SectionKey) => {
    sectionRefs[section].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleSection = (section: SectionKey) => {
    setCollapsed((current) => ({ ...current, [section]: !current[section] }));
  };

  const closeDrawer = () => {
    if (saving) {
      return;
    }
    setDrawer({ mode: 'closed' });
    setDrawerError('');
    setCustomsUploadFiles([]);
  };

  const openOrderDrawer = () => {
    if (!order) {
      return;
    }
    setDrawerError('');
    setDeletedItemIds([]);
    setOrderForm(buildOrderForm(order, items));
    setDrawer({ mode: 'order' });
  };

  const openFinanceDrawer = (record?: FinanceRecord) => {
    setDrawerError('');
    setFinanceForm(buildFinanceForm(record || null, asText(customer.name)));
    setDrawer({ mode: 'finance', recordId: record?.id });
  };

  const openProductionDrawer = () => {
    setDrawerError('');
    setProductionForm(buildProductionForm(productionPlan));
    setDrawer({ mode: 'production' });
  };

  const openCustomsDrawer = () => {
    setDrawerError('');
    setCustomsForm(buildCustomsForm(customs));
    setDrawer({ mode: 'customs' });
  };

  const openCustomsUploadDrawer = () => {
    if (!customs?.id) {
      setToast('请先补充基础报关信息');
      return;
    }
    setDrawerError('');
    setCustomsUploadFiles([]);
    setDrawer({ mode: 'customs-upload' });
  };

  const openLogisticsDrawer = (record?: LogisticsRecord) => {
    setDrawerError('');
    setLogisticsForm(buildLogisticsForm(record || null));
    setDrawer({ mode: 'logistics', recordId: record?.id });
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) {
      return [];
    }
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return apiFetch<AttachmentMeta[]>('/api/attachments', {
      method: 'POST',
      body: formData,
    });
  };

  const uploadCustomsFiles = async (files: File[]) => {
    if (!files.length || !customs?.id) {
      return [];
    }
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return apiFetch<AttachmentMeta[]>(`/api/customs/${customs.id}/attachments`, {
      method: 'POST',
      body: formData,
    });
  };

  const removePersistedAttachment = async (
    attachmentId: number,
    update: React.Dispatch<React.SetStateAction<{ attachments: AttachmentMeta[] } & Record<string, unknown>>>,
  ) => {
    try {
      await apiFetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
      update((current) => ({
        ...current,
        attachments: (current.attachments as AttachmentMeta[]).filter((attachment) => attachment.id !== attachmentId),
      }));
      setToast('附件已删除');
    } catch (requestError) {
      setDrawerError(getErrorMessage(requestError, '删除附件失败'));
    }
  };

  const updateDraftItem = (clientKey: string, field: keyof EditableOrderItem, value: string) => {
    setOrderForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.clientKey !== clientKey) {
          return item;
        }
        const nextItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const quantity = Number(field === 'quantity' ? value : nextItem.quantity);
          const unitPrice = Number(field === 'unitPrice' ? value : nextItem.unitPrice);
          if (Number.isFinite(quantity) && quantity >= 0 && Number.isFinite(unitPrice) && unitPrice >= 0) {
            nextItem.subtotal = String(quantity * unitPrice);
          }
        }
        return nextItem;
      }),
    }));
  };

  const addDraftItem = () => {
    setOrderForm((current) => ({ ...current, items: [...current.items, makeDraftItem()] }));
  };

  const removeDraftItem = (item: EditableOrderItem) => {
    setOrderForm((current) => ({
      ...current,
      items: current.items.filter((entry) => entry.clientKey !== item.clientKey),
    }));
    if (item.id) {
      setDeletedItemIds((current) => (current.includes(item.id) ? current : [...current, item.id]));
    }
  };

  const handleSaveOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!order) {
      return;
    }

    const totalAmount = Number(orderForm.totalAmount);
    const freight = Number(orderForm.freightAmount);
    const misc = Number(orderForm.miscAmount);

    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      setDrawerError('订单总额必须大于或等于 0');
      return;
    }
    if (!Number.isFinite(freight) || freight < 0 || !Number.isFinite(misc) || misc < 0) {
      setDrawerError('运费和杂费必须大于或等于 0');
      return;
    }

    let normalizedItems: Array<{
      id?: number;
      productName: string;
      specification: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      subtotal: number;
      imageUrl: string;
    }>;

    try {
      normalizedItems = orderForm.items.map((item, index) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        const subtotal = Number(item.subtotal);
        if (!item.productName.trim()) {
          throw new Error(`请填写第 ${index + 1} 个产品的名称`);
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`第 ${index + 1} 个产品数量必须大于 0`);
        }
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new Error(`第 ${index + 1} 个产品单价必须大于或等于 0`);
        }
        if (!Number.isFinite(subtotal) || subtotal < 0) {
          throw new Error(`第 ${index + 1} 个产品小计必须大于或等于 0`);
        }
        return {
          id: item.id,
          productName: item.productName.trim(),
          specification: item.specification.trim(),
          quantity,
          unit: item.unit.trim(),
          unitPrice,
          subtotal,
          imageUrl: item.imageUrl.trim(),
        };
      });
    } catch (validationError) {
      setDrawerError(getErrorMessage(validationError, '请检查订单明细'));
      return;
    }

    try {
      setSaving(true);
      await apiFetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          customerId: order.customer_id,
          totalAmount,
          deliveryDate: orderForm.deliveryDate,
          freightAmount: freight,
          miscAmount: misc,
          details: orderForm.details.trim(),
        }),
      });

      if (order.status !== orderForm.status) {
        await apiFetch(`/api/orders/${order.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: orderForm.status }),
        });
      }

      for (const itemId of deletedItemIds) {
        await apiFetch(`/api/order-items/${itemId}`, { method: 'DELETE' });
      }

      for (const item of normalizedItems) {
        const payload = {
          productName: item.productName,
          specification: item.specification,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          imageUrl: item.imageUrl,
        };
        if (item.id) {
          await apiFetch(`/api/order-items/${item.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          });
        } else {
          await apiFetch(`/api/orders/${order.id}/items`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
      }

      setToast('订单内容已更新');
      closeDrawer();
      await loadDetail({ showLoading: false });
    } catch (requestError) {
      setDrawerError(getErrorMessage(requestError, '保存订单失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFinance = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(financeForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setDrawerError('请输入大于 0 的金额');
      return;
    }
    if (financeForm.type === 'payment' && !financeForm.partnerId) {
      setDrawerError('请选择收款方');
      return;
    }

    try {
      setSaving(true);
      const uploaded = await uploadFiles(financeForm.newFiles);
      const attachmentIds = [
        ...financeForm.attachments.map((attachment) => attachment.id),
        ...uploaded.map((attachment) => attachment.id),
      ];
      const selectedPartner = paymentPartners.find((partner) => String(partner.id) === financeForm.partnerId);
      const payload = {
        orderId,
        type: financeForm.type,
        amount,
        currency: financeForm.currency,
        status: financeForm.status,
        recordCategory: financeForm.recordCategory,
        target:
          financeForm.type === 'payment'
            ? selectedPartner?.name || financeForm.target.trim()
            : financeForm.target.trim() || asText(customer.name),
        partnerId: financeForm.type === 'payment' ? Number(financeForm.partnerId) : undefined,
        remark: financeForm.remark.trim(),
        attachmentIds,
      };

      if (drawer.mode === 'finance' && drawer.recordId) {
        await apiFetch(`/api/finance/${drawer.recordId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/finance', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setToast(financeForm.type === 'receipt' ? '收款记录已保存' : '付款记录已保存');
      closeDrawer();
      await loadDetail({ showLoading: false });
    } catch (requestError) {
      setDrawerError(getErrorMessage(requestError, '保存财务记录失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProduction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!productionForm.partnerId) {
      setDrawerError('请选择生产伙伴');
      return;
    }

    const payload = {
      partnerId: Number(productionForm.partnerId),
      orderDate: productionForm.orderDate,
      estimatedDeliveryDate: productionForm.estimatedDeliveryDate,
      productionStatus: productionForm.productionStatus,
      inspectionStatus: productionForm.inspectionStatus,
      remark: productionForm.remark.trim(),
    };

    try {
      setSaving(true);
      if (productionForm.id) {
        await apiFetch(`/api/production/${productionForm.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/orders/${orderId}/production`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setToast('生产安排已保存');
      closeDrawer();
      await loadDetail({ showLoading: false });
    } catch (requestError) {
      setDrawerError(getErrorMessage(requestError, '保存生产安排失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCustoms = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      const uploaded = await uploadFiles(customsForm.newFiles);
      const attachmentIds = [...customsForm.attachments.map((attachment) => attachment.id), ...uploaded.map((attachment) => attachment.id)];
      const payload = {
        status: customsForm.status,
        brokerName: customsForm.brokerName.trim(),
        declarationNo: customsForm.declarationNo.trim(),
        declarationDate: customsForm.declarationDate,
        releaseDate: customsForm.releaseDate,
        remark: customsForm.remark.trim(),
        attachmentIds,
      };

      if (customsForm.id) {
        await apiFetch(`/api/customs/${customsForm.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/orders/${orderId}/customs`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setToast('报关信息已保存');
      closeDrawer();
      await loadDetail({ showLoading: false });
    } catch (requestError) {
      setDrawerError(getErrorMessage(requestError, '保存报关信息失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleUploadCustomsAttachments = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customs?.id) {
      setDrawerError('请先创建报关信息');
      return;
    }
    if (!customsUploadFiles.length) {
      setDrawerError('请至少选择一个附件');
      return;
    }

    try {
      setSaving(true);
      await uploadCustomsFiles(customsUploadFiles);
      setToast('报关附件已上传');
      closeDrawer();
      await loadDetail({ showLoading: false });
    } catch (requestError) {
      setDrawerError(getErrorMessage(requestError, '上传报关附件失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLogistics = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!logisticsForm.carrier.trim()) {
      setDrawerError('请填写承运商 / 物流公司');
      return;
    }

    try {
      setSaving(true);
      const uploaded = await uploadFiles(logisticsForm.newFiles);
      const attachmentIds = [
        ...logisticsForm.attachments.map((attachment) => attachment.id),
        ...uploaded.map((attachment) => attachment.id),
      ];
      const payload = {
        orderId,
        segmentType: logisticsForm.segmentType,
        carrier: logisticsForm.carrier.trim(),
        trackingNo: logisticsForm.trackingNo.trim(),
        status: logisticsForm.status,
        shippingDate: logisticsForm.shippingDate,
        packageCount: logisticsForm.packageCount,
        volumeCbm: logisticsForm.volumeCbm,
        grossWeightKg: logisticsForm.grossWeightKg,
        incoterm: logisticsForm.incoterm.trim(),
        transportMode: logisticsForm.transportMode.trim(),
        vesselVoyage: logisticsForm.vesselVoyage.trim(),
        billNo: logisticsForm.billNo.trim(),
        etd: logisticsForm.etd,
        eta: logisticsForm.eta,
        packingDetails: logisticsForm.packingDetails.trim(),
        remark: logisticsForm.remark.trim(),
        attachmentIds,
      };

      if (drawer.mode === 'logistics' && drawer.recordId) {
        await apiFetch(`/api/logistics/${drawer.recordId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/logistics', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setToast('物流记录已保存');
      closeDrawer();
      await loadDetail({ showLoading: false });
    } catch (requestError) {
      setDrawerError(getErrorMessage(requestError, '保存物流记录失败'));
    } finally {
      setSaving(false);
    }
  };

  const deleteFinanceRecord = async (record: FinanceRecord) => {
    if (!window.confirm(`确定删除这条${record.type === 'receipt' ? '收款' : '付款'}记录吗？`)) {
      return;
    }

    try {
      await apiFetch(`/api/finance/${record.id}`, { method: 'DELETE' });
      setToast('财务记录已删除');
      await loadDetail({ showLoading: false });
    } catch (requestError) {
      setError(getErrorMessage(requestError, '删除财务记录失败'));
    }
  };

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">正在加载订单工作台...</div>;
  }

  if (error || !detail || !order) {
    return <div className="rounded-3xl border border-red-100 bg-white p-6 text-sm text-red-600 shadow-sm">{error || '读取订单详情失败'}</div>;
  }

  const currentDrawerTitle =
    drawer.mode === 'order'
      ? '编辑订单内容'
      : drawer.mode === 'finance'
        ? drawer.recordId
          ? '编辑款项'
          : '录入款项'
        : drawer.mode === 'production'
          ? '编辑生产安排'
          : drawer.mode === 'customs'
            ? '编辑报关信息'
            : drawer.mode === 'customs-upload'
              ? '上传放行通知 / 报关单'
              : drawer.mode === 'logistics'
                ? drawer.recordId
                  ? '更新物流 / 录入单号'
                  : '新增物流记录'
                : '';

  return (
    <>
      <div className="relative space-y-3">
        <section className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <button
                onClick={() => navigate('/orders')}
                className="mb-2 inline-flex items-center text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                返回订单列表
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[26px] font-bold tracking-tight text-slate-900">{order.display_id}</h2>
                <Tag className={stageMeta.className}>{stageMeta.label}</Tag>
                <Tag className={paymentMeta.className}>{paymentMeta.label}</Tag>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>{asText(customer.name, '未命名客户')}</span>
                <span>{asText(customer.country, '未填写国家')}</span>
                <span>下单于 {formatDateTime(order.created_at)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 xl:items-end">
              <div className="flex flex-wrap justify-end gap-2">
                <ActionButton icon={<Edit3 className="h-4 w-4" />} onClick={openOrderDrawer}>
                  编辑订单
                </ActionButton>
                <ActionButton icon={<Wallet className="h-4 w-4" />} onClick={() => openFinanceDrawer()}>
                  录入款项
                </ActionButton>
                <ActionButton icon={<Factory className="h-4 w-4" />} onClick={openProductionDrawer}>
                  编辑生产安排
                </ActionButton>
                <ActionButton icon={<ShieldCheck className="h-4 w-4" />} onClick={openCustomsDrawer}>
                  报关信息
                </ActionButton>
                <ActionButton icon={<Truck className="h-4 w-4" />} onClick={() => openLogisticsDrawer()}>
                  更新物流
                </ActionButton>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 text-[11px]">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-semibold ${deliveryMeta.className}`}>
                  <CalendarClock className="mr-1 h-3.5 w-3.5" />
                  交货期 {formatDateOnly(order.deliveryDate)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 lg:gap-4">
              {STAGE_STEPS.map((step, index) => {
                const reached = index <= stageIndex;
                const active = step.key === order.status;
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => scrollToSection(step.target)}
                    className="flex items-center gap-2 rounded-xl px-1 py-1 transition-colors hover:bg-white"
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : reached
                            ? 'border-slate-300 bg-white text-slate-700'
                            : 'border-slate-200 bg-slate-100 text-slate-400'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className={`text-[11px] font-semibold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{step.label}</span>
                    {index < STAGE_STEPS.length - 1 ? (
                      <span className={`hidden h-px w-6 sm:block ${reached ? 'bg-slate-400' : 'bg-slate-200'}`} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-3">
            <MiniMetric title="订单总额" value={formatMoney(orderTotal, 'USD')} />
            <MiniMetric title="已收金额" value={formatMoney(paidAmount, 'USD')} accent="text-emerald-700" />
            <MiniMetric
              title={settled ? '状态' : '待收金额'}
              value={settled ? <Tag className="bg-emerald-50 text-emerald-700 border-emerald-200">已结清</Tag> : formatMoney(outstandingAmount, 'USD')}
              accent={settled ? '' : 'text-orange-700'}
            />
          </div>
        </section>

        <div className="hidden 2xl:block">
          <div className="fixed right-6 top-40 z-30 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
            {[
              ['basic', '基础信息'],
              ['items', '订单明细'],
              ['production', '生产安排'],
              ['finance', '财务'],
              ['customs', '报关'],
              ['logistics', '物流'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => scrollToSection(key as SectionKey)}
                className={`block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  activeSection === key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <WorkSection
          ref={basicRef}
          section="basic"
          title="基础信息"
          icon={<FileText className="h-4 w-4 text-slate-500" />}
          collapsed={collapsed.basic}
          onToggle={() => toggleSection('basic')}
        >
          <div className="grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
            <GridItem label="客户" value={asText(customer.name, '未填写')} />
            <GridItem label="国家" value={asText(customer.country, '未填写')} />
            <GridItem label="联系方式" value={asText(customer.contact, '未填写')} />
            <GridItem label="付款条款" value={asText(customer.paymentTerms, '未填写')} />
            <GridItem label="物流偏好" value={asText(customer.logisticsPreference, '未填写')} />
            <GridItem label="交货期" value={formatDateOnly(order.deliveryDate)} />
            <GridItem label="业务阶段" value={<Tag className={stageMeta.className}>{stageMeta.label}</Tag>} />
            <GridItem label="付款状态" value={<Tag className={paymentMeta.className}>{paymentMeta.label}</Tag>} />
          </div>
        </WorkSection>

        <WorkSection
          ref={itemsRef}
          section="items"
          title="订单明细"
          icon={<FileText className="h-4 w-4 text-slate-500" />}
          collapsed={collapsed.items}
          onToggle={() => toggleSection('items')}
          action={
            <LightActionButton onClick={openOrderDrawer}>
              <Edit3 className="mr-1.5 h-3.5 w-3.5" />
              编辑订单内容
            </LightActionButton>
          }
        >
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">图片</th>
                    <th className="px-3 py-2">产品名称 / 规格</th>
                    <th className="px-3 py-2">数量</th>
                    <th className="px-3 py-2">单价</th>
                    <th className="px-3 py-2 text-right">总价</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.length ? (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={asText(item.product_name)} className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">{asText(item.product_name, '未命名产品')}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{asText(item.specification, '未填写规格')}</div>
                        </td>
                        <td className="px-3 py-2">
                          {asNumber(item.quantity)} {asText(item.unit)}
                        </td>
                        <td className="px-3 py-2">{formatMoney(item.unit_price, 'USD')}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatMoney(item.subtotal, 'USD')}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-center text-sm text-slate-500">
                        这个订单还没有产品明细。
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 text-xs font-semibold text-slate-700">
                  <tr>
                    <td colSpan={3} className="px-3 py-2">费用汇总</td>
                    <td className="px-3 py-2">运费</td>
                    <td className="px-3 py-2 text-right">{formatMoney(freightAmount, 'USD')}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-3 py-2" />
                    <td className="px-3 py-2">杂费</td>
                    <td className="px-3 py-2 text-right">{formatMoney(miscAmount, 'USD')}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-slate-500">订单说明：{asText(order.details, '暂无备注')}</td>
                    <td className="px-3 py-2 text-slate-900">总计金额</td>
                    <td className="px-3 py-2 text-right text-slate-900">{formatMoney(grandTotal, 'USD')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </WorkSection>

        <WorkSection
          ref={productionRef}
          section="production"
          title="生产安排"
          icon={<Factory className="h-4 w-4 text-slate-500" />}
          collapsed={collapsed.production}
          onToggle={() => toggleSection('production')}
          action={
            <LightActionButton onClick={openProductionDrawer}>
              <Edit3 className="mr-1.5 h-3.5 w-3.5" />
              编辑生产安排
            </LightActionButton>
          }
        >
          {productionPlan ? (
            <div className="grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
              <GridItem label="代工厂 / 供应商" value={asText(productionPlan.partnerName, '未填写')} />
              <GridItem label="下单日期" value={formatDateOnly(productionPlan.orderDate)} />
              <GridItem label="预计交期" value={formatDateOnly(productionPlan.estimatedDeliveryDate)} />
              <GridItem label="生产状态" value={getProductionStatusLabel(productionPlan.productionStatus)} />
              <GridItem label="验货状态" value={getInspectionStatusLabel(productionPlan.inspectionStatus)} />
              <GridItem label="备注" value={asText(productionPlan.remark, '无')} />
            </div>
          ) : (
            <EmptyRow text="还没有生产安排，点击右上角补充工厂、排产和验货状态。" />
          )}
        </WorkSection>

        <WorkSection
          ref={financeRef}
          section="finance"
          title="财务流转"
          icon={<Wallet className="h-4 w-4 text-slate-500" />}
          collapsed={collapsed.finance}
          onToggle={() => toggleSection('finance')}
          action={
            <div className="flex items-center gap-2">
              <FilterPill active={financeFilter === 'all'} onClick={() => setFinanceFilter('all')}>全部</FilterPill>
              <FilterPill active={financeFilter === 'receipt'} onClick={() => setFinanceFilter('receipt')}>收款</FilterPill>
              <FilterPill active={financeFilter === 'payment'} onClick={() => setFinanceFilter('payment')}>付款</FilterPill>
              <LightActionButton onClick={() => openFinanceDrawer()}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                录入款项
              </LightActionButton>
            </div>
          }
        >
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            {filteredFinanceRecords.length ? (
              <div className="divide-y divide-slate-100 bg-white">
                {filteredFinanceRecords.map((record) => (
                  <div key={record.id} className="px-3 py-2 text-xs">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-semibold ${record.type === 'receipt' ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {record.type === 'receipt' ? '+' : '-'} {formatMoney(record.amount, asText(record.currency, 'USD'))}
                          </span>
                          <Tag className={record.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                            {record.status === 'completed' ? '已完成' : '待核销'}
                          </Tag>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {getFinanceCategoryLabel((record.recordCategory || 'other') as FinanceCategory)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span>{record.type === 'payment' ? `收款方：${asText(record.partnerName || record.target, '未填写')}` : `付款客户：${asText(record.target, '未填写')}`}</span>
                          <span>{formatDateTime(record.createdAt)}</span>
                          <span>{asText(record.remark, '无备注')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                          <Paperclip className="mr-1 h-3 w-3" />
                          {record.attachmentCount || record.attachments?.length || 0}
                        </span>
                        <button onClick={() => openFinanceDrawer(record)} className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => void deleteFinanceRecord(record)} className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {record.attachments?.length ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {record.attachments.map((attachment) => (
                          <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full bg-slate-50 px-2 py-1 text-[11px] font-medium text-blue-600 hover:text-blue-700">
                            <Paperclip className="mr-1 h-3 w-3" />
                            {attachment.fileName}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyRow text="还没有财务流水。顶部点击“录入款项”后会直接回写到这里。" />
            )}
          </div>
        </WorkSection>

        <WorkSection
          ref={customsRef}
          section="customs"
          title="报关信息"
          icon={<ShieldCheck className="h-4 w-4 text-slate-500" />}
          collapsed={collapsed.customs}
          onToggle={() => toggleSection('customs')}
          action={
            <div className="flex items-center gap-2">
              <LightActionButton onClick={openCustomsDrawer}>
                <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                编辑报关信息
              </LightActionButton>
              <LightActionButton onClick={openCustomsUploadDrawer}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                上传放行通知 / 报关单
              </LightActionButton>
            </div>
          }
        >
          {customs ? (
            <div className="space-y-3">
              <div className="grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
                <GridItem label="报关状态" value={getCustomsStatusLabel(customs.status)} />
                <GridItem label="报关行" value={asText(customs.brokerName, '未填写')} />
                <GridItem label="报关单号" value={asText(customs.declarationNo, '未填写')} />
                <GridItem label="申报日期" value={formatDateOnly(customs.declarationDate)} />
                <GridItem label="放行日期" value={formatDateOnly(customs.releaseDate)} />
                <GridItem label="备注" value={asText(customs.remark, '无')} />
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold text-slate-700">报关附件</div>
                {customs.attachments?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {customs.attachments.map((attachment) => (
                      <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-medium text-blue-600 ring-1 ring-slate-200 hover:text-blue-700">
                        <Paperclip className="mr-1 h-3 w-3" />
                        {attachment.fileName}
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">还没有报关附件。</div>
                )}
              </div>
            </div>
          ) : (
            <EmptyRow text="还没有报关信息，先录入基础报关状态，后续单据可以在这里继续追加上传。" />
          )}
        </WorkSection>

        <WorkSection
          ref={logisticsRef}
          section="logistics"
          title="物流信息"
          icon={<Truck className="h-4 w-4 text-slate-500" />}
          collapsed={collapsed.logistics}
          onToggle={() => toggleSection('logistics')}
          action={hasAnyLogistics ? (
            <LightActionButton onClick={() => openLogisticsDrawer()}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              更新物流 / 录入单号
            </LightActionButton>
          ) : undefined}
        >
          {!hasAnyLogistics ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <div className="text-sm font-semibold text-slate-700">暂无物流信息</div>
              <div className="mt-1 text-xs text-slate-500">录入国内或国际物流后，这里会显示最新快照。</div>
              <button
                onClick={() => openLogisticsDrawer()}
                className="mt-4 inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                新增物流记录
              </button>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {domesticLogistics ? (
                <LogisticsSnapshot
                  title="国内物流"
                  record={domesticLogistics}
                  fields={[
                    ['物流公司', asText(domesticLogistics.carrier, '未填写')],
                    ['单号', asText(domesticLogistics.trackingNo, '未填写')],
                    ['发货时间', formatDateOnly(domesticLogistics.shippingDate)],
                    ['包装件数', domesticLogistics.packageCount != null ? String(domesticLogistics.packageCount) : '未填写'],
                    ['总体积(CBM)', domesticLogistics.volumeCbm != null ? String(domesticLogistics.volumeCbm) : '未填写'],
                    ['总重量(KG)', domesticLogistics.grossWeightKg != null ? String(domesticLogistics.grossWeightKg) : '未填写'],
                  ]}
                  onEdit={() => openLogisticsDrawer(domesticLogistics)}
                />
              ) : null}
              {internationalLogistics ? (
                <LogisticsSnapshot
                  title="国际物流"
                  record={internationalLogistics}
                  fields={[
                    ['贸易条款', asText(internationalLogistics.incoterm, '未填写')],
                    ['运输方式', asText(internationalLogistics.transportMode, '未填写')],
                    ['承运人 / 船公司', asText(internationalLogistics.carrier, '未填写')],
                    ['船名航次 / 航班号', asText(internationalLogistics.vesselVoyage, '未填写')],
                    ['提单号', asText(internationalLogistics.billNo || internationalLogistics.trackingNo, '未填写')],
                    ['ETD / ETA', `${formatDateOnly(internationalLogistics.etd)} / ${formatDateOnly(internationalLogistics.eta)}`],
                  ]}
                  onEdit={() => openLogisticsDrawer(internationalLogistics)}
                />
              ) : null}
            </div>
          )}
        </WorkSection>
      </div>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {toast}
        </div>
      ) : null}

      {drawer.mode !== 'closed' ? (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button onClick={closeDrawer} className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" />
          <div className="relative z-10 flex h-full w-full max-w-[640px] flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-lg font-bold text-slate-900">{currentDrawerTitle}</div>
                <div className="mt-1 text-xs text-slate-500">保存后会局部刷新当前订单，不会整页跳转。</div>
              </div>
              <button onClick={closeDrawer} className="rounded-xl border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={
                drawer.mode === 'order'
                  ? handleSaveOrder
                  : drawer.mode === 'finance'
                    ? handleSaveFinance
                    : drawer.mode === 'production'
                      ? handleSaveProduction
                      : drawer.mode === 'customs'
                        ? handleSaveCustoms
                        : drawer.mode === 'customs-upload'
                          ? handleUploadCustomsAttachments
                          : handleSaveLogistics
              }
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {drawerError ? <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{drawerError}</div> : null}

                {drawer.mode === 'order' ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="业务阶段">
                        <select value={orderForm.status} onChange={(event) => setOrderForm({ ...orderForm, status: event.target.value as OrderStatus })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="draft">待整理</option>
                          <option value="production">生产中</option>
                          <option value="customs">报关中</option>
                          <option value="shipping">发货中</option>
                          <option value="completed">已完成</option>
                        </select>
                      </Field>
                      <Field label="交货期">
                        <input type="date" value={orderForm.deliveryDate} onChange={(event) => setOrderForm({ ...orderForm, deliveryDate: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                      <Field label="订单总额">
                        <input type="number" min="0" step="0.01" value={orderForm.totalAmount} onChange={(event) => setOrderForm({ ...orderForm, totalAmount: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                      <Field label="运费">
                        <input type="number" min="0" step="0.01" value={orderForm.freightAmount} onChange={(event) => setOrderForm({ ...orderForm, freightAmount: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                      <Field label="杂费">
                        <input type="number" min="0" step="0.01" value={orderForm.miscAmount} onChange={(event) => setOrderForm({ ...orderForm, miscAmount: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                    </div>
                    <Field label="订单说明">
                      <textarea value={orderForm.details} onChange={(event) => setOrderForm({ ...orderForm, details: event.target.value })} className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </Field>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-800">产品明细</div>
                        <button type="button" onClick={addDraftItem} className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          新增产品
                        </button>
                      </div>
                      <div className="space-y-3">
                        {orderForm.items.length ? (
                          orderForm.items.map((item, index) => (
                            <div key={item.clientKey} className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="mb-3 flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-800">产品 {index + 1}</div>
                                <button type="button" onClick={() => removeDraftItem(item)} className="text-slate-400 transition-colors hover:text-red-600">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid gap-4 md:grid-cols-2">
                                <Field label="图片链接">
                                  <input value={item.imageUrl} onChange={(event) => updateDraftItem(item.clientKey, 'imageUrl', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </Field>
                                <Field label="产品名称">
                                  <input value={item.productName} onChange={(event) => updateDraftItem(item.clientKey, 'productName', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </Field>
                                <Field label="规格">
                                  <input value={item.specification} onChange={(event) => updateDraftItem(item.clientKey, 'specification', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </Field>
                                <Field label="数量">
                                  <input type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateDraftItem(item.clientKey, 'quantity', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </Field>
                                <Field label="单位">
                                  <input value={item.unit} onChange={(event) => updateDraftItem(item.clientKey, 'unit', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </Field>
                                <Field label="单价">
                                  <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateDraftItem(item.clientKey, 'unitPrice', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </Field>
                                <Field label="小计">
                                  <input type="number" min="0" step="0.01" value={item.subtotal} onChange={(event) => updateDraftItem(item.clientKey, 'subtotal', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </Field>
                              </div>
                            </div>
                          ))
                        ) : (
                          <EmptyRow text="还没有产品明细，点击上方按钮开始补录。" />
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {drawer.mode === 'finance' ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="收 / 付款">
                        <select
                          value={financeForm.type}
                          onChange={(event) =>
                            setFinanceForm((current) => ({
                              ...current,
                              type: event.target.value as FinanceType,
                              recordCategory: event.target.value === 'receipt' ? 'deposit' : 'goods',
                              partnerId: event.target.value === 'receipt' ? '' : current.partnerId,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="receipt">收款</option>
                          <option value="payment">付款</option>
                        </select>
                      </Field>
                      <Field label="款项类型">
                        <select value={financeForm.recordCategory} onChange={(event) => setFinanceForm({ ...financeForm, recordCategory: event.target.value as FinanceCategory })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          {financeForm.type === 'receipt' ? (
                            <>
                              <option value="deposit">首付款</option>
                              <option value="balance">尾款</option>
                              <option value="other">其他</option>
                            </>
                          ) : (
                            <>
                              <option value="goods">货款</option>
                              <option value="freight">运费</option>
                              <option value="customs">报关费</option>
                              <option value="other">其他</option>
                            </>
                          )}
                        </select>
                      </Field>
                      <Field label="金额">
                        <input type="number" min="0" step="0.01" value={financeForm.amount} onChange={(event) => setFinanceForm({ ...financeForm, amount: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                      <Field label="币种">
                        <select value={financeForm.currency} onChange={(event) => setFinanceForm({ ...financeForm, currency: event.target.value as 'USD' | 'CNY' })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="USD">USD</option>
                          <option value="CNY">CNY</option>
                        </select>
                      </Field>
                      <Field label="状态">
                        <select value={financeForm.status} onChange={(event) => setFinanceForm({ ...financeForm, status: event.target.value as FinanceStatus })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="completed">已完成</option>
                          <option value="pending">待核销</option>
                        </select>
                      </Field>
                      {financeForm.type === 'payment' ? (
                        <Field label="收款方">
                          <select value={financeForm.partnerId} onChange={(event) => setFinanceForm({ ...financeForm, partnerId: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">请选择伙伴</option>
                            {paymentPartners.map((partner) => (
                              <option key={partner.id} value={partner.id}>
                                {partner.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : (
                        <Field label="付款客户">
                          <input value={financeForm.target} onChange={(event) => setFinanceForm({ ...financeForm, target: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </Field>
                      )}
                    </div>
                    <Field label="备注">
                      <textarea value={financeForm.remark} onChange={(event) => setFinanceForm({ ...financeForm, remark: event.target.value })} className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </Field>
                    <AttachmentEditor
                      title="附件上传"
                      attachments={financeForm.attachments}
                      newFiles={financeForm.newFiles}
                      onFilesSelected={(files) => setFinanceForm((current) => ({ ...current, newFiles: [...current.newFiles, ...files] }))}
                      onRemoveExisting={(attachmentId) => void removePersistedAttachment(attachmentId, setFinanceForm as never)}
                      onRemovePending={(index) => setFinanceForm((current) => ({ ...current, newFiles: current.newFiles.filter((_, fileIndex) => fileIndex !== index) }))}
                    />
                  </div>
                ) : null}

                {drawer.mode === 'production' ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="代工厂 / 供应商">
                        <select value={productionForm.partnerId} onChange={(event) => setProductionForm({ ...productionForm, partnerId: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">请选择伙伴</option>
                          {productionPartners.map((partner) => (
                            <option key={partner.id} value={partner.id}>
                              {partner.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="下单日期">
                        <input type="date" value={productionForm.orderDate} onChange={(event) => setProductionForm({ ...productionForm, orderDate: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                      <Field label="预计交期">
                        <input type="date" value={productionForm.estimatedDeliveryDate} onChange={(event) => setProductionForm({ ...productionForm, estimatedDeliveryDate: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                      <Field label="当前生产状态">
                        <select value={productionForm.productionStatus} onChange={(event) => setProductionForm({ ...productionForm, productionStatus: event.target.value as ProductionStatus })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="not_started">未开始</option>
                          <option value="scheduled">已排产</option>
                          <option value="in_progress">生产中</option>
                          <option value="ready">待出货</option>
                        </select>
                      </Field>
                      <Field label="验货状态">
                        <select value={productionForm.inspectionStatus} onChange={(event) => setProductionForm({ ...productionForm, inspectionStatus: event.target.value as InspectionStatus })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="pending">待验货</option>
                          <option value="passed">已通过</option>
                          <option value="failed">未通过</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="备注">
                      <textarea value={productionForm.remark} onChange={(event) => setProductionForm({ ...productionForm, remark: event.target.value })} className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </Field>
                  </div>
                ) : null}

                {drawer.mode === 'customs' ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="报关状态">
                        <select value={customsForm.status} onChange={(event) => setCustomsForm({ ...customsForm, status: event.target.value as CustomsStatus })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="not_started">未开始</option>
                          <option value="preparing">准备中</option>
                          <option value="submitted">已申报</option>
                          <option value="inspected">查验中</option>
                          <option value="released">已放行</option>
                        </select>
                      </Field>
                      <Field label="报关行">
                        <input value={customsForm.brokerName} onChange={(event) => setCustomsForm({ ...customsForm, brokerName: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                      <Field label="报关单号">
                        <input value={customsForm.declarationNo} onChange={(event) => setCustomsForm({ ...customsForm, declarationNo: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                      <Field label="申报日期">
                        <input type="date" value={customsForm.declarationDate} onChange={(event) => setCustomsForm({ ...customsForm, declarationDate: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                      <Field label="放行日期">
                        <input type="date" value={customsForm.releaseDate} onChange={(event) => setCustomsForm({ ...customsForm, releaseDate: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                    </div>
                    <Field label="备注">
                      <textarea value={customsForm.remark} onChange={(event) => setCustomsForm({ ...customsForm, remark: event.target.value })} className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </Field>
                    <AttachmentEditor
                      title="报关附件"
                      attachments={customsForm.attachments}
                      newFiles={customsForm.newFiles}
                      onFilesSelected={(files) => setCustomsForm((current) => ({ ...current, newFiles: [...current.newFiles, ...files] }))}
                      onRemoveExisting={(attachmentId) => void removePersistedAttachment(attachmentId, setCustomsForm as never)}
                      onRemovePending={(index) => setCustomsForm((current) => ({ ...current, newFiles: current.newFiles.filter((_, fileIndex) => fileIndex !== index) }))}
                    />
                  </div>
                ) : null}

                {drawer.mode === 'customs-upload' ? (
                  <AttachmentEditor
                    title="追加报关附件"
                    attachments={[]}
                    newFiles={customsUploadFiles}
                    onFilesSelected={(files) => setCustomsUploadFiles((current) => [...current, ...files])}
                    onRemoveExisting={() => undefined}
                    onRemovePending={(index) => setCustomsUploadFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                  />
                ) : null}

                {drawer.mode === 'logistics' ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="物流段">
                        <select value={logisticsForm.segmentType} onChange={(event) => setLogisticsForm({ ...logisticsForm, segmentType: event.target.value as LogisticsSegment })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="domestic">国内物流</option>
                          <option value="international">国际物流</option>
                        </select>
                      </Field>
                      <Field label="物流状态">
                        <select value={logisticsForm.status} onChange={(event) => setLogisticsForm({ ...logisticsForm, status: event.target.value as LogisticsStatus })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="preparing">备货中</option>
                          <option value="shipped">运输中</option>
                          <option value="arrived">已到货</option>
                        </select>
                      </Field>
                      <Field label="承运人 / 公司">
                        <input value={logisticsForm.carrier} onChange={(event) => setLogisticsForm({ ...logisticsForm, carrier: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                      <Field label="单号 / 提单号">
                        <input value={logisticsForm.trackingNo} onChange={(event) => setLogisticsForm({ ...logisticsForm, trackingNo: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                      <Field label="发货日期">
                        <input type="date" value={logisticsForm.shippingDate} onChange={(event) => setLogisticsForm({ ...logisticsForm, shippingDate: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </Field>
                      {logisticsForm.segmentType === 'domestic' ? (
                        <>
                          <Field label="包装件数">
                            <input type="number" min="0" step="0.01" value={logisticsForm.packageCount} onChange={(event) => setLogisticsForm({ ...logisticsForm, packageCount: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </Field>
                          <Field label="总体积(CBM)">
                            <input type="number" min="0" step="0.01" value={logisticsForm.volumeCbm} onChange={(event) => setLogisticsForm({ ...logisticsForm, volumeCbm: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </Field>
                          <Field label="总重量(KG)">
                            <input type="number" min="0" step="0.01" value={logisticsForm.grossWeightKg} onChange={(event) => setLogisticsForm({ ...logisticsForm, grossWeightKg: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </Field>
                        </>
                      ) : (
                        <>
                          <Field label="贸易条款">
                            <input value={logisticsForm.incoterm} onChange={(event) => setLogisticsForm({ ...logisticsForm, incoterm: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </Field>
                          <Field label="运输方式">
                            <input value={logisticsForm.transportMode} onChange={(event) => setLogisticsForm({ ...logisticsForm, transportMode: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </Field>
                          <Field label="船名航次 / 航班号">
                            <input value={logisticsForm.vesselVoyage} onChange={(event) => setLogisticsForm({ ...logisticsForm, vesselVoyage: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </Field>
                          <Field label="提单号">
                            <input value={logisticsForm.billNo} onChange={(event) => setLogisticsForm({ ...logisticsForm, billNo: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </Field>
                          <Field label="ETD">
                            <input type="date" value={logisticsForm.etd} onChange={(event) => setLogisticsForm({ ...logisticsForm, etd: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </Field>
                          <Field label="ETA">
                            <input type="date" value={logisticsForm.eta} onChange={(event) => setLogisticsForm({ ...logisticsForm, eta: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </Field>
                        </>
                      )}
                    </div>
                    <Field label="包装 / 说明">
                      <textarea value={logisticsForm.packingDetails} onChange={(event) => setLogisticsForm({ ...logisticsForm, packingDetails: event.target.value })} className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </Field>
                    <Field label="备注">
                      <textarea value={logisticsForm.remark} onChange={(event) => setLogisticsForm({ ...logisticsForm, remark: event.target.value })} className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </Field>
                    <AttachmentEditor
                      title="物流附件"
                      attachments={logisticsForm.attachments}
                      newFiles={logisticsForm.newFiles}
                      onFilesSelected={(files) => setLogisticsForm((current) => ({ ...current, newFiles: [...current.newFiles, ...files] }))}
                      onRemoveExisting={(attachmentId) => void removePersistedAttachment(attachmentId, setLogisticsForm as never)}
                      onRemovePending={(index) => setLogisticsForm((current) => ({ ...current, newFiles: current.newFiles.filter((_, fileIndex) => fileIndex !== index) }))}
                    />
                  </div>
                ) : null}
              </div>

              <div className="border-t border-slate-200 bg-white px-5 py-4">
                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={closeDrawer} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50">
                    取消
                  </button>
                  <button type="submit" disabled={saving} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-400">
                    {saving ? '保存中...' : drawer.mode === 'customs-upload' ? '上传附件' : '确认保存'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

const ActionButton = ({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) => (
  <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-black">
    {icon}
    {children}
  </button>
);

const LightActionButton = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50">
    {children}
  </button>
);

const MiniMetric = ({
  title,
  value,
  accent = 'text-slate-900',
}: {
  title: string;
  value: React.ReactNode;
  accent?: string;
}) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
    <div className={`mt-1 text-lg font-bold tracking-tight ${accent}`}>{value}</div>
  </div>
);

const Tag = ({ children, className }: { children: React.ReactNode; className: string }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}>
    {children}
  </span>
);

const GridItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</div>
    <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
    {children}
  </label>
);

const EmptyRow = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">{text}</div>
);

const FilterPill = ({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) => (
  <button type="button" onClick={onClick} className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
    {children}
  </button>
);

const AttachmentEditor = ({
  title,
  attachments,
  newFiles,
  onFilesSelected,
  onRemoveExisting,
  onRemovePending,
}: {
  title: string;
  attachments: AttachmentMeta[];
  newFiles: File[];
  onFilesSelected: (files: File[]) => void;
  onRemoveExisting: (attachmentId: number) => void;
  onRemovePending: (index: number) => void;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="text-sm font-semibold text-slate-800">{title}</div>
    <label className="mt-3 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-600">
      <Paperclip className="mr-2 h-4 w-4" />
      选择附件
      <input type="file" multiple className="hidden" onChange={(event) => onFilesSelected(Array.from(event.target.files || []))} />
    </label>

    {attachments.length ? (
      <div className="mt-3 space-y-2">
        {attachments.map((attachment) => (
          <div key={attachment.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <a href={attachment.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center font-medium text-blue-600 hover:text-blue-700">
              <Paperclip className="mr-2 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{attachment.fileName}</span>
            </a>
            <button type="button" onClick={() => onRemoveExisting(attachment.id)} className="text-slate-400 transition-colors hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    ) : null}

    {newFiles.length ? (
      <div className="mt-3 space-y-2">
        {newFiles.map((file, index) => (
          <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <span className="truncate">{file.name}</span>
            <button type="button" onClick={() => onRemovePending(index)} className="text-slate-400 transition-colors hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    ) : null}
  </div>
);

const WorkSection = React.forwardRef<
  HTMLDivElement,
  {
    section: SectionKey;
    title: string;
    icon: React.ReactNode;
    collapsed: boolean;
    onToggle: () => void;
    action?: React.ReactNode;
    children: React.ReactNode;
  }
>(({ section, title, icon, collapsed, onToggle, action, children }, ref) => (
  <section ref={ref} data-section={section} className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {action}
        <button onClick={onToggle} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>
    </div>
    {!collapsed ? children : null}
  </section>
));

WorkSection.displayName = 'WorkSection';

const LogisticsSnapshot = ({
  title,
  record,
  fields,
  onEdit,
}: {
  title: string;
  record: LogisticsRecord;
  fields: Array<[string, string]>;
  onEdit: () => void;
}) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-[11px] text-slate-500">最近更新于 {formatDateTime(record.createdAt)}</div>
      </div>
      <LightActionButton onClick={onEdit}>
        <Edit3 className="mr-1.5 h-3.5 w-3.5" />
        编辑
      </LightActionButton>
    </div>
    <div className="grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label}>
          <GridItem label={label} value={value} />
        </div>
      ))}
    </div>
    {record.attachments?.length ? (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {record.attachments.map((attachment) => (
          <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-medium text-blue-600 ring-1 ring-slate-200 hover:text-blue-700">
            <Paperclip className="mr-1 h-3 w-3" />
            {attachment.fileName}
          </a>
        ))}
      </div>
    ) : null}
  </div>
);
