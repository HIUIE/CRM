import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Download,
  Edit3,
  Factory,
  FileText,
  Mail,
  MapPin,
  MoreHorizontal,
  Paperclip,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  ActionButton,
  AttachmentEditor,
  CompactMeta,
  DropdownItem,
  EmptyRow,
  Field,
  FilterPill,
  LightActionButton,
  LogisticsSnapshot,
  MetricCard,
  PreviewModal,
  ProductImagePlaceholder,
  Tag,
  WorkSection,
} from '../features/order-detail/components';
import type {
  AIAnalysisResult,
  AttachmentMeta,
  CustomsFormState,
  CustomsRecord,
  CustomsStatus,
  DrawerState,
  EditableOrderItem,
  FinanceCategory,
  FinanceFormState,
  FinanceRecord,
  FinanceStatus,
  FinanceType,
  LogisticsFormState,
  LogisticsRecord,
  LogisticsSegment,
  LogisticsStatus,
  OrderDetailResponse,
  OrderFormState,
  OrderItem,
  OrderStatus,
  Partner,
  ProductionFormState,
  ProductionPlan,
  ProductionStatus,
  SectionKey,
  InspectionStatus,
} from '../features/order-detail/types';
import {
  EMPTY_CUSTOMS_FORM,
  EMPTY_FINANCE_FORM,
  EMPTY_LOGISTICS_FORM,
  EMPTY_ORDER_FORM,
  EMPTY_PRODUCTION_FORM,
  STAGE_STEPS,
  asNumber,
  asText,
  buildCustomsForm,
  buildFinanceForm,
  buildLogisticsForm,
  buildOrderForm,
  buildProductionForm,
  formatDateOnly,
  formatDateTime,
  formatMoney,
  getCustomsStatusLabel,
  getDeliveryMeta,
  getFinanceCategoryLabel,
  getInspectionStatusLabel,
  getPaymentMeta,
  getProductionStatusLabel,
  makeDraftItem,
} from '../features/order-detail/utils';

export default function OrderDetailPage() {
  const { user } = useAuth();
  const { orderNo } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);
  const orderId = detail?.order?.id;

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'closed' });
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentMeta | null>(null);
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
    todos: false,
    items: false,
    production: false,
    finance: false,
    customs: false,
    logistics: false,
  });
  const [activeSection, setActiveSection] = useState<SectionKey>('basic');
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const basicRef = useRef<HTMLDivElement | null>(null);
  const todosRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<HTMLDivElement | null>(null);
  const productionRef = useRef<HTMLDivElement | null>(null);
  const financeRef = useRef<HTMLDivElement | null>(null);
  const customsRef = useRef<HTMLDivElement | null>(null);
  const logisticsRef = useRef<HTMLDivElement | null>(null);

  const runAnalysis = async () => {
    if (!orderNo) return;
    setAnalyzing(true);
    setDrawerError('');
    try {
      const result = await apiFetch<AIAnalysisResult>('/api/ai/analyze-order', {
        method: 'POST',
        body: JSON.stringify({ orderNo }),
      });
      setAiResult(result);
    } catch (err) {
      setDrawerError(getErrorMessage(err, 'AI 分析失败'));
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (drawer.mode === 'ai-analysis' && !aiResult && !analyzing) {
      void runAnalysis();
    }
  }, [drawer.mode]);

  const sectionRefs: Record<SectionKey, React.RefObject<HTMLDivElement | null>> = {
    basic: basicRef,
    todos: todosRef,
    items: itemsRef,
    production: productionRef,
    finance: financeRef,
    customs: customsRef,
    logistics: logisticsRef,
  };


  const loadDetail = async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    if (!orderNo) {
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
        apiFetch<OrderDetailResponse>(`/api/orders/${orderNo}`),
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
  }, [orderNo]);

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
  const hasAnyLogistics = Boolean(domesticLogistics || internationalLogistics || logisticsRecords.length);

  // Status Linkage Logic
  useEffect(() => {
    if (!order || !orderId) return;

    let nextStatus: OrderStatus = order.status;
    if (hasAnyLogistics) {
      nextStatus = 'shipping';
    } else if (customs) {
      nextStatus = 'customs';
    } else if (productionPlan && productionPlan.productionStatus !== 'not_started') {
      nextStatus = 'production';
    }

    const orderStages: OrderStatus[] = ['draft', 'production', 'customs', 'shipping', 'completed'];
    const currentIndex = orderStages.indexOf(order.status as OrderStatus);
    const nextIndex = orderStages.indexOf(nextStatus);

    if (nextIndex > currentIndex && order.status !== 'completed' && nextStatus !== 'completed') {
      void (async () => {
        try {
          await apiFetch(`/api/orders/${orderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: nextStatus }),
          });
          void loadDetail({ showLoading: false });
          setToast(`订单阶段已自动更新为：${STAGE_STEPS[nextIndex].label}`);
        } catch (err) {
          console.error('Failed to auto-update status:', err);
        }
      })();
    }
  }, [hasAnyLogistics, customs, productionPlan, order?.id, order?.status]);

  const paidAmount = asNumber(summary.paidAmount);
  const outstandingAmount = asNumber(summary.outstandingAmount);
  const orderTotal = asNumber(order?.total_amount);
  const freightAmount = asNumber(order?.freightAmount);
  const miscAmount = asNumber(order?.miscAmount);
  const grandTotal = orderTotal + freightAmount + miscAmount;
  const paymentMeta = getPaymentMeta(summary.paymentStatus);
  const deliveryMeta = getDeliveryMeta(asText(order?.deliveryDate));
  const stageIndex = Math.max(0, STAGE_STEPS.findIndex((step) => step.key === order?.status));
  const settled = Boolean(summary.settled || (orderTotal > 0 && outstandingAmount <= 0));
  const totalUnits = items.reduce((sum, item) => sum + asNumber(item.quantity), 0);
  const paymentTermBadge = asText(customer.logisticsPreference || customer.paymentTerms).trim();
  const productionReference = productionPlan
    ? `MO-${formatDateOnly(productionPlan.orderDate, new Date().toISOString().slice(0, 10)).replaceAll('/', '').replaceAll('-', '')}-${String(order?.id ?? 0).padStart(3, '0')}`
    : '';
  const logisticsHeadline = internationalLogistics?.carrier || domesticLogistics?.carrier || '待安排';

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

  const todoItems = [
    {
      title: '客户确认订单',
      detail: `${asText(customer.name, '客户待确认')} · ${formatDateTime(order?.created_at)}`,
      done: true,
      section: 'basic' as SectionKey,
    },
    {
      title: '支付预付款',
      detail: paidAmount > 0 ? `已收 ${formatMoney(paidAmount, 'USD')}` : `待收 ${formatMoney(outstandingAmount, 'USD')}`,
      done: paidAmount > 0,
      section: 'finance' as SectionKey,
    },
    {
      title: '安排生产',
      detail: productionPlan ? `${asText(productionPlan.partnerName, '未指定工厂')} · ${getProductionStatusLabel(productionPlan.productionStatus)}` : '由采购创建生产计划',
      done: Boolean(productionPlan),
      section: 'production' as SectionKey,
    },
    {
      title: '准备报关资料',
      detail: customs ? `${getCustomsStatusLabel(customs.status)} · ${asText(customs.declarationNo, '待补单号')}` : '待上传商业发票、装箱单、报关单',
      done: Boolean(customs),
      section: 'customs' as SectionKey,
    },
    {
      title: '安排物流发货',
      detail: hasAnyLogistics ? `${logisticsHeadline} · ${formatDateOnly(internationalLogistics?.etd || domesticLogistics?.shippingDate)}` : '待录入提单、航次或国内物流',
      done: hasAnyLogistics,
      section: 'logistics' as SectionKey,
    },
    {
      title: '订单完成',
      detail: order?.status === 'completed' ? '确认收款并完成订单' : '待交付完成后关闭订单',
      done: order?.status === 'completed',
      section: 'finance' as SectionKey,
    },
  ];

  const scrollToSection = (section: SectionKey) => {
    sectionRefs[section].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleSection = (section: SectionKey) => {
    setCollapsed((current) => ({ ...current, [section]: !current[section] }));
  };

  const exportOrder = () => {
    window.print();
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
        await apiFetch(`/api/orders/items/${itemId}`, { method: 'DELETE' });
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
          await apiFetch(`/api/orders/items/${item.id}`, {
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
        await apiFetch(`/api/orders/production/${productionForm.id}`, {
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
                : drawer.mode === 'ai-analysis'
                  ? '✨ AI 智能诊断分析'
                  : '';

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_210px] items-start pt-0">
        <div className="space-y-3 min-w-0 self-start mt-0">
          <section
            ref={basicRef}
            data-section="basic"
            className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                  <button
                    onClick={() => navigate('/orders')}
                    className="mb-3 inline-flex items-center text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    返回订单列表
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[30px] font-bold tracking-tight text-slate-900">{order.display_id}</h2>
                    <Tag className={paymentMeta.className}>{paymentMeta.label}</Tag>
                    {paymentTermBadge ? <Tag className="bg-blue-50 text-blue-700 border-blue-200">{paymentTermBadge}</Tag> : null}
                  </div>
                </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <ActionButton icon={<Edit3 className="h-4 w-4" />} onClick={openOrderDrawer}>
                      编辑订单
                    </ActionButton>
                    <ActionButton icon={<Wallet className="h-4 w-4" />} onClick={() => openFinanceDrawer()}>
                      收款
                    </ActionButton>
                    <div className="relative">
                      <button
                        onClick={() => setShowMoreActions(!showMoreActions)}
                        className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="ml-2">更多操作</span>
                      </button>

                      {showMoreActions && (
                        <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5">
                          <DropdownItem
                            icon={<Sparkles className="h-4 w-4" />}
                            label="AI 智能分析"
                            onClick={() => {
                              setShowMoreActions(false);
                              setDrawer({ mode: 'ai-analysis' });
                            }}
                          />
                          <DropdownItem
                            icon={<Factory className="h-4 w-4" />}
                            label="编辑生产安排"
                            onClick={() => {
                              setShowMoreActions(false);
                              openProductionDrawer();
                            }}
                          />
                          <DropdownItem
                            icon={<ShieldCheck className="h-4 w-4" />}
                            label="报关信息"
                            onClick={() => {
                              setShowMoreActions(false);
                              openCustomsDrawer();
                            }}
                          />
                          <DropdownItem
                            icon={<Truck className="h-4 w-4" />}
                            label="更新物流"
                            onClick={() => {
                              setShowMoreActions(false);
                              openLogisticsDrawer();
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      {asText(customer.name, '未命名客户')}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="inline-flex items-center">
                        <MapPin className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                        {asText(customer.country, '未填写国家')}
                      </span>
                      <span className="inline-flex items-center">
                        <Mail className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                        {asText(customer.contact, '未填写联系方式')}
                      </span>
                    </div>
                  </div>
                  <div className="border-slate-100 lg:border-l lg:pl-5">
                    <div className="font-semibold text-slate-400">下单时间</div>
                    <div className="mt-2 flex items-center gap-2 font-semibold text-slate-800">
                      <CalendarClock className="h-4 w-4 text-slate-400" />
                      {formatDateTime(order.created_at)}
                    </div>
                  </div>
                  <div className="border-slate-100 lg:border-l lg:pl-5">
                    <div className="font-semibold text-slate-400">业务员</div>
                    <div className="mt-2 font-semibold text-slate-800">{asText(order.createdByName, '系统管理员')}</div>
                    <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${deliveryMeta.className}`}>
                      交货期 {deliveryMeta.label}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 lg:gap-0">
                  {STAGE_STEPS.map((step, index) => {
                    const reached = index <= stageIndex;
                    const active = step.key === order.status;
                    return (
                      <button
                        key={step.key}
                        type="button"
                        onClick={() => scrollToSection(step.target)}
                        className="flex min-w-[130px] flex-1 items-center gap-3 rounded-xl px-2 py-1 transition-colors hover:bg-slate-50"
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                            active
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : reached
                                ? 'border-blue-200 bg-white text-blue-600'
                                : 'border-slate-200 bg-white text-slate-400'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className={`text-sm font-semibold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{step.label}</span>
                        {index < STAGE_STEPS.length - 1 ? <span className={`hidden h-px flex-1 xl:block ${reached ? 'bg-blue-200' : 'bg-slate-200'}`} /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <MetricCard title="总金额" value={formatMoney(orderTotal, 'USD')} tone="blue" />
                <MetricCard title="已收金额" value={formatMoney(paidAmount, 'USD')} tone="green" />
                <MetricCard
                  title={settled ? '状态' : '待收金额'}
                  value={settled ? '已结清' : formatMoney(outstandingAmount, 'USD')}
                  tone="orange"
                  badge={settled ? '已结清' : undefined}
                />
              </div>
            </div>
          </section>

          <section ref={todosRef} data-section="todos" className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">订单待办</h3>
                <p className="mt-1 text-xs text-slate-500">按业务推进顺序提醒当前订单的关键动作。</p>
              </div>
            </div>
            <div className="space-y-3">
              {todoItems.map((item) => (
                <button
                  key={item.title}
                  onClick={() => scrollToSection(item.section)}
                  className="flex w-full items-start gap-3 rounded-2xl px-1 py-1 text-left transition-colors hover:bg-slate-50"
                >
                  <span
                    className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      item.done ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-transparent'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <div className={`text-sm font-semibold ${item.done ? 'text-slate-900' : 'text-slate-600'}`}>{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <WorkSection
            ref={itemsRef}
            section="items"
            title="订单明细"
            icon={<FileText className="h-5 w-5 text-slate-500" />}
            collapsed={collapsed.items}
            onToggle={() => toggleSection('items')}
            action={
              <LightActionButton onClick={openOrderDrawer}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                添加 / 编辑产品
              </LightActionButton>
            }
          >
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">商品</th>
                      <th className="px-4 py-3">规格 / 型号</th>
                      <th className="px-4 py-3">数量</th>
                      <th className="px-4 py-3">单价 (USD)</th>
                      <th className="px-4 py-3 text-right">总价</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.length ? (
                      items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={asText(item.product_name)} className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200" />
                              ) : (
                                <ProductImagePlaceholder />
                              )}
                              <div className="font-bold text-slate-900 text-base">{asText(item.product_name, '未命名产品')}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-slate-600 font-medium">{asText(item.specification, '未填写规格')}</td>
                          <td className="px-4 py-4 font-semibold">{asNumber(item.quantity)} pcs</td>
                          <td className="px-4 py-4 font-medium">{asNumber(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-900 text-base">{asNumber(item.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center">
                            <div className="mb-3 text-slate-400">
                              <FileText className="h-10 w-10 opacity-20" />
                            </div>
                            <p className="text-base font-medium text-slate-500">这个订单还没有产品明细。</p>
                            <button
                              onClick={openOrderDrawer}
                              className="mt-4 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-all"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              立即添加产品
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 text-sm font-semibold text-slate-700">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-slate-500">商品总额</td>
                      <td className="px-4 py-3 text-right font-bold">{orderTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-slate-500">运费</td>
                      <td className="px-4 py-3 text-right font-bold">{freightAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-slate-500">杂费</td>
                      <td className="px-4 py-3 text-right font-bold">{miscAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-right text-slate-900 text-base">订单总额 (USD)</td>
                      <td className="px-4 py-4 text-right text-lg font-black text-blue-600">{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            {order.details ? <div className="mt-4 text-sm text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="font-bold text-slate-700 mr-2">订单备注：</span>{order.details}</div> : null}
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
                  录入收款
                </LightActionButton>
              </div>
            }
          >
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              {filteredFinanceRecords.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500">
                      <tr>
                        <th className="px-3 py-2">日期</th>
                        <th className="px-3 py-2">类型</th>
                        <th className="px-3 py-2">金额 (USD)</th>
                        <th className="px-3 py-2">支付方式 / 说明</th>
                        <th className="px-3 py-2">关联单据</th>
                        <th className="px-3 py-2">操作人</th>
                        <th className="px-3 py-2 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredFinanceRecords.map((record) => (
                        <tr key={record.id}>
                          <td className="px-3 py-3 text-slate-500">{formatDateTime(record.createdAt)}</td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-900">{getFinanceCategoryLabel((record.recordCategory || 'other') as FinanceCategory)}</div>
                            <div className="mt-1 text-[11px] text-slate-500">{record.type === 'receipt' ? '收款' : '付款'}</div>
                          </td>
                          <td className={`px-3 py-3 font-semibold ${record.type === 'receipt' ? 'text-emerald-600' : 'text-orange-500'}`}>
                            {record.type === 'receipt' ? '+' : '-'}
                            {asNumber(record.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {record.type === 'payment' ? asText(record.partnerName || record.target, '—') : '银行转账'}
                          </td>
                          <td className="px-3 py-3">
                            {record.attachments?.length ? (
                              <button
                                onClick={() => setPreviewAttachment(record.attachments[0])}
                                className="inline-flex items-center text-blue-600 hover:text-blue-700"
                              >
                                <Paperclip className="mr-1 h-3 w-3" />
                                <span className="max-w-[100px] truncate">{record.attachments[0]?.fileName}</span>
                              </button>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-3 text-slate-600">{asText(record.createdByName, '系统记录')}</td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => openFinanceDrawer(record)} className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800">
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              {user?.role === 'admin' ? (
                                <button onClick={() => void deleteFinanceRecord(record)} className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 text-xs font-semibold">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-slate-500">已收金额</td>
                        <td className="px-3 py-2 text-emerald-600">{paidAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td colSpan={2} className="px-3 py-2 text-slate-500">待收金额</td>
                        <td colSpan={2} className="px-3 py-2 text-orange-500">{outstandingAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <EmptyRow text="还没有财务流水。顶部点击“录入款项”后会直接回写到这里。" />
              )}
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
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                新建生产计划
              </LightActionButton>
            }
          >
            {productionPlan ? (
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="min-w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500">
                    <tr>
                      <th className="px-3 py-2">生产计划号</th>
                      <th className="px-3 py-2">产品</th>
                      <th className="px-3 py-2">数量</th>
                      <th className="px-3 py-2">工厂</th>
                      <th className="px-3 py-2">计划开工</th>
                      <th className="px-3 py-2">计划完成</th>
                      <th className="px-3 py-2">状态</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    <tr>
                      <td className="px-3 py-3 font-medium">
                        <button
                          onClick={openProductionDrawer}
                          className="text-blue-600 hover:text-blue-700 hover:underline underline-offset-2 transition-colors font-bold"
                        >
                          {productionReference}
                        </button>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-700">{items.length} 个产品</td>

                      <td className="px-3 py-3">{totalUnits} pcs</td>
                      <td className="px-3 py-3">{asText(productionPlan.partnerName, '未填写')}</td>
                      <td className="px-3 py-3">{formatDateOnly(productionPlan.orderDate)}</td>
                      <td className="px-3 py-3">{formatDateOnly(productionPlan.estimatedDeliveryDate)}</td>
                      <td className="px-3 py-3">
                        <Tag className="bg-orange-50 text-orange-700 border-orange-200">{getProductionStatusLabel(productionPlan.productionStatus)}</Tag>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyRow text="还没有生产安排，点击右上角补充工厂、排产和验货状态。" />
            )}
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
                <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-3">
                  <CompactMeta label="贸易方式" value={asText(customer.logisticsPreference, '一般贸易')} />
                  <CompactMeta label="报关状态" value={getCustomsStatusLabel(customs.status)} />
                  <CompactMeta label="HS Code" value={asText(customs.declarationNo, '7318.15')} />
                  <CompactMeta label="商业发票" value={customs.attachments?.length ? '已上传' : '未上传'} />
                  <CompactMeta label="报关单号" value={asText(customs.declarationNo, '—')} />
                  <CompactMeta label="放行日期" value={formatDateOnly(customs.releaseDate, '—')} />
                  <CompactMeta label="申报日期" value={formatDateOnly(customs.declarationDate, '—')} />
                  <CompactMeta label="报关行" value={asText(customs.brokerName, '—')} />
                  <CompactMeta label="备注" value={asText(customs.remark, '—')} />
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-700">报关附件</div>
                  {customs.attachments?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {customs.attachments.map((attachment) => (
                        <button
                          key={attachment.id}
                          onClick={() => setPreviewAttachment(attachment)}
                          className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-medium text-blue-600 ring-1 ring-slate-200 hover:text-blue-700"
                        >
                          <Paperclip className="mr-1 h-3 w-3" />
                          {attachment.fileName}
                        </button>
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
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-3">
                  {domesticLogistics ? (
                    <LogisticsSnapshot
                      title="国内物流"
                      record={domesticLogistics}
                      fields={[
                        ['物流方式', asText(domesticLogistics.carrier, '汽运')],
                        ['运单状态', domesticLogistics.status === 'arrived' ? '已到港' : '未发货'],
                        ['单号', asText(domesticLogistics.trackingNo, '—')],
                        ['承运人', asText(domesticLogistics.carrier, '—')],
                        ['起运时间', formatDateOnly(domesticLogistics.shippingDate, '—')],
                        ['总重量(KG)', domesticLogistics.grossWeightKg != null ? String(domesticLogistics.grossWeightKg) : '—'],
                      ]}
                      onEdit={() => openLogisticsDrawer(domesticLogistics)}
                      onPreview={setPreviewAttachment}
                      />
                      ) : null}
                      {internationalLogistics ? (
                      <LogisticsSnapshot
                      title="国际物流"
                      record={internationalLogistics}
                      fields={[
                        ['运输方式', asText(internationalLogistics.transportMode, '海运')],
                        ['贸易条款', asText(internationalLogistics.incoterm, '—')],
                        ['承运人 / 船公司', asText(internationalLogistics.carrier, '—')],
                        ['提单号', asText(internationalLogistics.billNo || internationalLogistics.trackingNo, '—')],
                        ['预计开港', formatDateOnly(internationalLogistics.etd, '—')],
                        ['预计到港', formatDateOnly(internationalLogistics.eta, '—')],
                      ]}
                      onEdit={() => openLogisticsDrawer(internationalLogistics)}
                      onPreview={setPreviewAttachment}
                      />
                      ) : null}

                </div>
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-center">
                  <div className="text-5xl text-blue-200">•</div>
                  <div className="mt-3 text-sm font-semibold text-slate-700">暂未支持地图轨迹</div>
                  <div className="mt-2 max-w-[220px] text-xs leading-5 text-slate-500">实际到货后可在地图上查看运输航线，这里先保留结构化物流信息。</div>
                </div>
              </div>
            )}
          </WorkSection>
        </div>

        <aside className="hidden xl:block sticky top-0 space-y-3 self-start mt-0">
          <section className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-sm font-bold text-slate-900">页面导航</div>
            <div className="mt-4 space-y-1.5">
              {[
                { id: 'overview', section: 'basic' as SectionKey, label: '订单概览' },
                { id: 'todo', section: 'todos' as SectionKey, label: '订单待办' },
                { id: 'items', section: 'items' as SectionKey, label: '订单明细' },
                { id: 'finance', section: 'finance' as SectionKey, label: '财务流水' },
                { id: 'production', section: 'production' as SectionKey, label: '生产安排' },
                { id: 'customs', section: 'customs' as SectionKey, label: '报关信息' },
                { id: 'logistics', section: 'logistics' as SectionKey, label: '物流信息' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.section)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    activeSection === item.section ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${activeSection === item.section ? 'bg-blue-600' : 'bg-slate-300'}`} />
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">快捷操作</div>
            <div className="mt-3 space-y-2">
              <button 
                onClick={() => setDrawer({ mode: 'ai-analysis' })}
                className="flex w-full items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI 智能诊断
              </button>
              <button 
                onClick={exportOrder}
                className="flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100"
              >
                <Download className="h-3.5 w-3.5 text-slate-400" />
                导出 PDF
              </button>
            </div>
          </div>
        </aside>
      </div>

      {previewAttachment && (
        <PreviewModal 
          attachment={previewAttachment} 
          onClose={() => setPreviewAttachment(null)} 
        />
      )}

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
              onSubmit={(event) => {
                if (drawer.mode === 'ai-analysis') {
                  event.preventDefault();
                  return;
                }
                if (drawer.mode === 'order') handleSaveOrder(event);
                else if (drawer.mode === 'finance') handleSaveFinance(event);
                else if (drawer.mode === 'production') handleSaveProduction(event);
                else if (drawer.mode === 'customs') handleSaveCustoms(event);
                else if (drawer.mode === 'customs-upload') handleUploadCustomsAttachments(event);
                else handleSaveLogistics(event);
              }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {drawerError ? <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{drawerError}</div> : null}

                {drawer.mode === 'ai-analysis' ? (
                  <div className="space-y-6">
                    {analyzing ? (
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                          <span className="text-sm font-medium text-slate-600">AI 正在深度诊断订单数据...</span>
                        </div>
                        <div className="space-y-4">
                          <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-100" />
                          <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-100" />
                          <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-100" />
                        </div>
                      </div>
                    ) : aiResult ? (

                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">健康度评分</h3>
                            <p className="mt-1 text-xs text-slate-500">基于支付、生产、物流多维度评估</p>
                          </div>
                          <div className={`text-4xl font-black ${aiResult.score >= 80 ? 'text-emerald-600' : aiResult.score >= 60 ? 'text-amber-500' : 'text-rose-600'}`}>
                            {aiResult.score}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
                            <Sparkles className="h-3.5 w-3.5" />
                            AI 核心诊断总结
                          </div>
                          <div className="mt-2 text-sm font-medium leading-relaxed text-blue-900">{aiResult.summary}</div>
                        </div>

                        <section>
                          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                              <X className="h-3 w-3" />
                            </span>
                            潜在风险预警
                          </div>
                          <div className="space-y-3">
                            {aiResult.risks.map((risk, i) => (
                              <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md">
                                <div className="flex items-start gap-3">
                                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${risk.level === 'high' ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'}`} />
                                  <div className="text-sm leading-relaxed text-slate-700 font-medium">{risk.content}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>

                        <section>
                          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />
                            </span>
                            专业执行建议
                          </div>
                          <div className="space-y-3">
                            {aiResult.suggestions.map((suggestion, i) => (
                              <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-black text-emerald-600 border border-emerald-100">
                                    {i + 1}
                                  </div>
                                  <div className="text-sm leading-relaxed text-slate-700 font-medium">{suggestion.content}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                        
                        <div className="pt-4 text-center">
                          <button 
                            type="button"
                            onClick={runAnalysis}
                            className="text-xs font-semibold text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            重新分析诊断
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-20 text-center">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Sparkles className="h-6 w-6" />
                        </div>
                        <p className="mt-4 text-sm text-slate-500">点击按钮开始 AI 深度诊断分析</p>
                      </div>
                    )}
                  </div>
                ) : null}

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

              {drawer.mode !== 'ai-analysis' && (
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
              )}

            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
