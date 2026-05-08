import React, { useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useNavigateWithTransition } from '../lib/transition';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/ui/Toast';

// Lazy loaded components
const PreviewModal = lazy(() => import('../features/order-detail/components').then(m => ({ default: m.PreviewModal })));
const TaskDrawer = lazy(() => import('../components/ui/TaskDrawer').then(m => ({ default: m.TaskDrawer })));
const ConfirmDeleteModal = lazy(() => import('../components/ui/ConfirmDeleteModal'));

const OrderEditForm = lazy(() => import('../features/order-detail/drawers').then(m => ({ default: m.OrderEditForm })));
const FinanceForm = lazy(() => import('../features/order-detail/drawers').then(m => ({ default: m.FinanceForm })));
const ProductionForm = lazy(() => import('../features/order-detail/drawers').then(m => ({ default: m.ProductionForm })));
const ProductionLogForm = lazy(() => import('../features/order-detail/drawers').then(m => ({ default: m.ProductionLogForm })));
const CustomsForm = lazy(() => import('../features/order-detail/drawers').then(m => ({ default: m.CustomsForm })));
const LogisticsForm = lazy(() => import('../features/order-detail/drawers').then(m => ({ default: m.LogisticsForm })));
const PackingForm = lazy(() => import('../features/order-detail/drawers').then(m => ({ default: m.PackingForm })));
const AIAnalysisContent = lazy(() => import('../features/order-detail/drawers').then(m => ({ default: m.AIAnalysisContent })));
const DocumentsVaultSection = lazy(() => import('../features/order-detail/sections').then(m => ({ default: m.DocumentsVaultSection })));
const FinanceSection = lazy(() => import('../features/order-detail/sections').then(m => ({ default: m.FinanceSection })));
const ProfitSection = lazy(() => import('../features/order-detail/sections').then(m => ({ default: m.ProfitSection })));
const ProductionSection = lazy(() => import('../features/order-detail/sections').then(m => ({ default: m.ProductionSection })));
const CustomsSection = lazy(() => import('../features/order-detail/sections').then(m => ({ default: m.CustomsSection })));
const PackingSection = lazy(() => import('../features/order-detail/sections').then(m => ({ default: m.PackingSection })));
const LogisticsSection = lazy(() => import('../features/order-detail/sections').then(m => ({ default: m.LogisticsSection })));
const TasksSection = lazy(() => import('../features/order-detail/sections').then(m => ({ default: m.TasksSection })));
const FollowupsSection = lazy(() => import('../features/order-detail/sections').then(m => ({ default: m.FollowupsSection })));
const NavRailSection = lazy(() => import('../features/order-detail/sections').then(m => ({ default: m.NavRailSection })));
const QuickFollowUpSection = lazy(() => import('../features/order-detail/sections').then(m => ({ default: m.QuickFollowUpSection })));
const AIAnalysisPanel = lazy(() => import('../features/order-detail/sections').then(m => ({ default: m.AIAnalysisPanel })));

import type {
  AIAnalysisResult,
  AttachmentMeta,
  CustomsFormState,
  CustomerInfo,
  DrawerState,
  FinanceFormState,
  FinanceRecord,
  FinanceType,
  LogisticsFormState,
  LogisticsRecord,
  OrderDetailResponse,
  OrderFormState,
  Partner,
  ProductionLog,
  ProductionLogFormState,
  ProductionFormState,
  PackingFormState,
  SectionKey,
} from '../features/order-detail/types';
import {
  asNumber,
  buildCustomsForm,
  buildFinanceForm,
  buildLogisticsForm,
  buildProductionForm,
  buildProductionLogForm,
  EMPTY_CUSTOMS_FORM,
  EMPTY_FINANCE_FORM,
  EMPTY_LOGISTICS_FORM,
  EMPTY_ORDER_FORM,
  EMPTY_PRODUCTION_FORM,
  formatDateOnly,
  orderToFormState,
  STAGE_STEPS,
} from '../features/order-detail/utils';
import { OrderHeaderSection, ItemsSection } from '../features/order-detail/sections-primary';
import {
  handleSaveOrder,
  handleSaveFinance,
  handleSaveProduction,
  handleSaveProductionLog,
  handleSaveCustoms,
  handleSaveLogistics,
  handleSavePacking,
  handleUploadPackingPhoto,
  handleDeleteAttachment,
  handleUploadOrderDocument,
  handleUploadEvidenceFiles,
  handleSubmitFollowUp,
  handleDeleteOrder,
  handleExportPdf,
  handleUpdateInspectionStatus,
} from '../features/order-detail/handlers';

export default function OrderDetailPage() {
  const { user } = useAuth();
  const { orderNo } = useParams();
  const navigate = useNavigateWithTransition();
  const [detailSearchParams, setDetailSearchParams] = useSearchParams();

  // 1. Refs
  const sectionRefs: Record<SectionKey | 'packing', React.RefObject<HTMLDivElement | null>> = {
    basic: useRef(null),
    todos: useRef(null),
    items: useRef(null),
    finance: useRef(null),
    production: useRef(null),
    customs: useRef(null),
    packing: useRef(null),
    logistics: useRef(null),
  };
  const printContentRef = useRef<HTMLDivElement>(null);

  // 2. State
  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'closed' });
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentMeta | null>(null);
  const [orderForm, setOrderForm] = useState<OrderFormState>(EMPTY_ORDER_FORM);
  const [financeForm, setFinanceForm] = useState<FinanceFormState>(EMPTY_FINANCE_FORM);
  const [productionForm, setProductionForm] = useState<ProductionFormState>(EMPTY_PRODUCTION_FORM);
  const [logisticsForm, setLogisticsForm] = useState<LogisticsFormState>(EMPTY_LOGISTICS_FORM);
  const [packingForm, setPackingForm] = useState<PackingFormState>({ items: [] });
  const [customsForm, setCustomsForm] = useState<CustomsFormState>(EMPTY_CUSTOMS_FORM);
  const [productionLogForm, setProductionLogForm] = useState<ProductionLogFormState>({ logDate: new Date().toISOString().split('T')[0], content: '', attachments: [], newFiles: [] });
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
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showTaskDrawer, setShowTaskDrawer] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [financeRecordToDelete, setFinanceRecordToDelete] = useState<FinanceRecord | null>(null);
  const [isFinanceDeleting, setIsFinanceDeleting] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<AttachmentMeta | null>(null);
  const [isAttachmentDeleting, setIsAttachmentDeleting] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);

  const toastTimerRef = useRef<any>(null);

  const sectionChunkFallback = (
    <div className="space-y-6">
      <div className="h-40 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 animate-pulse" />
      <div className="h-40 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 animate-pulse" />
    </div>
  );

  // 3. Derived
  const order = detail?.order;
  const customer = (detail?.customer || {}) as CustomerInfo;
  const items = detail?.items || [];
  const financeRecords = detail?.financeRecords || [];
  const productionPlan = detail?.productionPlan || null;
  const customs = detail?.customs || null;
  const logisticsRecords = detail?.logisticsRecords || [];
  const packingRecords = detail?.packingRecords || [];
  const packingPhotos = detail?.packingPhotos || [];
  const orderDocuments = detail?.orderDocuments || [];
  const followUps = detail?.followUps || [];
  const tasks = detail?.tasks || [];
  const domesticLogistics = detail?.domesticLogistics || null;
  const internationalLogistics = detail?.internationalLogistics || null;
  const summary = detail?.summary || { receiptsByCurrency: {}, paymentsByCurrency: {}, freightByCurrency: {}, pendingFinanceCount: 0, paidAmount: 0, outstandingAmount: 0, paymentStatus: 'unpaid' as const, settled: false, attachmentsSummary: { finance: 0, logistics: 0, customs: 0 } };
  const hasAnyLogistics = Boolean(domesticLogistics || internationalLogistics || logisticsRecords.length);

  const itemsTotal = items.reduce((sum, item) => sum + asNumber(item.subtotal), 0);
  const freightAmount = asNumber(order?.freightAmount);
  const miscAmount = asNumber(order?.miscAmount);
  const grandTotal = itemsTotal + freightAmount + miscAmount;

  const filteredFinanceRecords = useMemo(() => {
    if (financeFilter === 'all') return financeRecords;
    return financeRecords.filter((r) => r.type === financeFilter);
  }, [financeFilter, financeRecords]);

  const productionPartners = useMemo(() => partners.filter((p) => p.partner_type === 'factory' || p.partner_type === 'other'), [partners]);

  const currentDrawerTitle = useMemo(() => {
    switch(drawer.mode) {
      case 'order': return '编辑订单明细';
      case 'finance': return '收付款记录';
      case 'production': return '生产信息';
      case 'production-log': return '添加生产进度';
      case 'customs': return '报关信息';
      case 'logistics': return '物流信息';
      case 'packing': return '装箱明细维护';
      case 'ai-analysis': return 'AI 智能辅助诊断';
      default: return '';
    }
  }, [drawer.mode]);

  const deliveryMeta = useMemo(() => {
    if (!order?.deliveryDate) return { label: '未设置', tone: 'neutral' as const };
    const date = new Date(order.deliveryDate);
    const days = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: `逾期 ${Math.abs(days)} 天`, tone: 'error' as const };
    if (days <= 7) return { label: `${days} 天内交货`, tone: 'warning' as const };
    return { label: formatDateOnly(order.deliveryDate), tone: 'info' as const };
  }, [order?.deliveryDate]);

  const moduleAlerts = useMemo(() => ({
    finance: summary.settled ? { label: '已结清', tone: 'success' as const } : { label: '未结清', tone: 'warning' as const },
    production: productionPlan?.productionStatus === 'ready' ? { label: '完成', tone: 'success' as const } : { label: productionPlan ? '进行中' : '未排产', tone: productionPlan ? 'neutral' as const : 'warning' as const },
    logistics: hasAnyLogistics ? { label: '已发运', tone: 'success' as const } : { label: '未发运', tone: 'warning' as const },
    customs: customs ? { label: customs.status === 'released' ? '已放行' : '处理中', tone: customs.status === 'released' ? 'success' as const : 'neutral' as const } : { label: '缺失', tone: 'warning' as const },
    packing: packingRecords.length ? { label: '已录入', tone: 'success' as const } : { label: '待录入', tone: 'warning' as const },
    documents: orderDocuments.length ? { label: `${orderDocuments.length} 份`, tone: 'neutral' as const } : { label: '待上传', tone: 'warning' as const },
    todos: tasks.some(t => t.status !== 'done') ? { label: `${tasks.filter(t => t.status !== 'done').length} 待办`, tone: 'warning' as const } : { label: '完成', tone: 'success' as const },
  }), [summary.settled, productionPlan, hasAnyLogistics, customs, packingRecords.length, orderDocuments.length, tasks]);

  const stageIndex = STAGE_STEPS.findIndex((s) => s.key === order?.status);

  const refreshDetail = async () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    await loadDetail({ showLoading: false });
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollTop, left: 0, behavior: 'auto' });
      requestAnimationFrame(() => window.scrollTo({ top: scrollTop, left: 0, behavior: 'auto' }));
    });
  };

  // 4. Effects
  const loadDetail = async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    if (!orderNo) { setError('无效单号'); setLoading(false); return; }
    if (showLoading) setLoading(true);
    setTimedOut(false);
    setError('');
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('数据加载拥堵，请重试')), 15_000);
      });
      const [detailData, partnerData] = await Promise.race([
        Promise.all([
          apiFetch<OrderDetailResponse>(`/api/orders/${encodeURIComponent(orderNo)}`),
          apiFetch<Partner[]>('/api/partners').catch(() => null),
        ]),
        timeoutPromise,
      ]);
      setDetail(detailData);
      if (partnerData) setPartners(partnerData);
    } catch (err) {
      const message = getErrorMessage(err, '读取详情失败');
      setError(message);
      setTimedOut(message.includes('数据加载拥堵'));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [orderNo]);

  useEffect(() => {
    const handleScroll = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      setScrollPercent(scrolled);

      const scrollPos = window.scrollY + 120;
      const trackedSections: Array<[string, HTMLElement | null]> = [
        ...Object.entries(sectionRefs).map(([key, ref]) => [key, ref.current] as [string, HTMLElement | null]),
        ['documents', document.getElementById('documents-vault')],
        ['profit', document.getElementById('profit-section')],
        ['followups', document.getElementById('followups-timeline')],
      ];
      for (const [key, el] of trackedSections) {
        if (el && scrollPos >= el.offsetTop && scrollPos < el.offsetTop + el.offsetHeight) {
          setActiveSection(key as SectionKey); break;
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 3000);
  };

  // 5. Scroll / Drawer
  const scrollToSection = (section: string) => {
    const normalizedSection = section === 'tasks' ? 'todos' : section;
    if (normalizedSection === 'documents' || normalizedSection === 'followups' || normalizedSection === 'profit') {
      const id = normalizedSection === 'documents' ? 'documents-vault' : normalizedSection === 'profit' ? 'profit-section' : 'followups-timeline';
      const el = document.getElementById(id);
      if (el) {
        const top = el.getBoundingClientRect().top + window.pageYOffset - 24;
        window.scrollTo({ top, behavior: 'smooth' });
      }
      setActiveSection(normalizedSection as SectionKey);
      return;
    }
    const ref = sectionRefs[normalizedSection as keyof typeof sectionRefs];
    if (ref?.current) {
      const top = ref.current.getBoundingClientRect().top + window.pageYOffset - 24;
      window.scrollTo({ top, behavior: 'smooth' });
      if (normalizedSection !== 'packing') setActiveSection(normalizedSection as SectionKey);
    }
  };

  useEffect(() => {
    const targetSection = detailSearchParams.get('section');
    if (!targetSection || loading || !detail) return;

    let attempts = 0;
    let timer: number | undefined;
    const scrollWhenReady = () => {
      const normalizedSection = targetSection === 'tasks' ? 'todos' : targetSection;
      const ref = sectionRefs[normalizedSection as keyof typeof sectionRefs];
      const specialId = targetSection === 'documents'
        ? 'documents-vault'
        : targetSection === 'profit'
          ? 'profit-section'
          : targetSection === 'followups'
            ? 'followups-timeline'
            : '';

      if (ref?.current || (specialId && document.getElementById(specialId))) {
        scrollToSection(targetSection);
        const next = new URLSearchParams(detailSearchParams);
        next.delete('section');
        setDetailSearchParams(next, { replace: true });
        return;
      }

      if (attempts < 20) {
        attempts += 1;
        timer = window.setTimeout(scrollWhenReady, 80);
      }
    };

    timer = window.setTimeout(scrollWhenReady, 80);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [detailSearchParams, detail, loading, setDetailSearchParams]);

  const closeDrawer = () => { setDrawer({ mode: 'closed' }); setDrawerError(''); setSaving(false); };

  const toggleSection = (section: SectionKey) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const openOrderDrawer = () => {
    if (!order) return;
    setOrderForm(orderToFormState(order, items));
    setDeletedItemIds([]);
    setDrawer({ mode: 'order' });
  };

  const openFinanceDrawer = (record: FinanceRecord | null = null) => {
    setFinanceForm(buildFinanceForm(record, customer.name || ''));
    setDrawer({ mode: 'finance' });
  };

  const openProductionDrawer = () => {
    setProductionForm(buildProductionForm(productionPlan));
    setDrawer({ mode: 'production' });
  };

  const openProductionLogDrawer = (log: Partial<ProductionLog> | null = null) => {
    setProductionLogForm(buildProductionLogForm(log));
    setDrawer({ mode: 'production-log' });
  };

  const openCustomsDrawer = () => {
    setCustomsForm(buildCustomsForm(customs));
    setDrawer({ mode: 'customs' });
  };

  const openLogisticsDrawer = (record: LogisticsRecord | null = null) => {
    setLogisticsForm(buildLogisticsForm(record));
    setDrawer({ mode: 'logistics' });
  };

  const openPackingDrawer = () => {
    setPackingForm({ items: packingRecords.map(r => ({ ...r, clientKey: Math.random().toString(36).slice(2) })) });
    setDrawer({ mode: 'packing' });
  };

  const requestDeleteAttachment = async (id: number) => {
    const attachments = [
      ...orderDocuments,
      ...(productionPlan?.photos || []),
      ...(customs?.attachments || []),
      ...packingPhotos,
      ...logisticsRecords.flatMap(record => record.attachments || []),
    ];
    setAttachmentToDelete(attachments.find(att => att.id === id) || null);
  };

  const deleteFinanceRecord = async () => {
    if (!financeRecordToDelete) return;
    setIsFinanceDeleting(true);
    try {
      await apiFetch(`/api/finance/${financeRecordToDelete.id}`, { method: 'DELETE' });
      showToast('财务流水已删除');
      setFinanceRecordToDelete(null);
      await refreshDetail();
    } catch (err) {
      showToast(getErrorMessage(err, '删除财务流水失败'));
    } finally {
      setIsFinanceDeleting(false);
    }
  };

  const deleteAttachment = async () => {
    if (!attachmentToDelete) return;
    setIsAttachmentDeleting(true);
    try {
      await handleDeleteAttachment(attachmentToDelete.id, { showToast, loadDetail: refreshDetail });
      setAttachmentToDelete(null);
    } finally {
      setIsAttachmentDeleting(false);
    }
  };

  // 6. View Helpers
  const orderDetailSkeleton = (
    <div className="animate-page-in space-y-8 p-6">
      <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-6 shadow-sm">
        <div className="h-6 w-48 rounded bg-slate-200 dark:bg-navy-800 animate-pulse" />
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg bg-slate-100 dark:bg-navy-800 animate-pulse" />)}
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 animate-pulse" />)}
        </div>
        <div className="h-80 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 animate-pulse" />
      </div>
    </div>
  );

  if (loading) return orderDetailSkeleton;
  if (error || !detail || !order) return (
    <div className="m-6 rounded-lg border border-red-100 dark:border-red-900/30 bg-surface dark:bg-navy-900 p-8 text-center shadow-sm">
      <div className="text-base font-black text-error">{timedOut ? '数据加载拥堵，请重试' : `加载失败: ${error || '订单不存在'}`}</div>
      <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">请检查网络或稍后重试，刷新按钮会重新请求订单详情。</p>
      <button onClick={() => void loadDetail()} className="btn-primary mt-5">重新加载</button>
    </div>
  );

  return (
    <div className="animate-page-in">
      {typeof document !== 'undefined' && createPortal(
        <div className="fixed left-0 top-0 z-[300] h-1 w-screen bg-tertiary-sage/30 pointer-events-none">
          <div className="h-full bg-tertiary-sage transition-all duration-300 ease-out" style={{ width: `${scrollPercent}%` }} />
        </div>,
        document.body,
      )}

      {/* Header Section */}
      <OrderHeaderSection
        headerRef={sectionRefs.basic}
        order={order}
        customer={customer}
        stageIndex={stageIndex}
        navigate={navigate}
        scrollToSection={scrollToSection}
        openOrderDrawer={openOrderDrawer}
        openFinanceDrawer={openFinanceDrawer}
        openProductionDrawer={openProductionDrawer}
        openCustomsDrawer={openCustomsDrawer}
        openLogisticsDrawer={openLogisticsDrawer}
        handleExportPdf={() => handleExportPdf({ printContentRef, order, showToast })}
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        user={user}
        items={items}
        financeRecords={financeRecords}
        productionPlan={productionPlan}
        hasAnyLogistics={hasAnyLogistics}
        packingRecords={packingRecords}
        logisticsRecords={logisticsRecords}
      />

      {/* Physical 2-Column Main Layout */}
      <main className="max-w-[1600px] mx-auto py-8 lg:py-10 flex flex-col gap-8 lg:flex-row lg:items-start">

        {/* Left Side: Vertical Business Feed */}
        <div className="flex-1 min-w-0 flex flex-col gap-8">
          <ItemsSection
            sectionRef={sectionRefs.items}
            collapsed={collapsed.items}
            onToggle={() => toggleSection('items')}
            items={items}
            openOrderDrawer={openOrderDrawer}
            grandTotal={grandTotal}
            itemsTotal={itemsTotal}
            freightAmount={freightAmount}
            miscAmount={miscAmount}
          />

          <Suspense fallback={sectionChunkFallback}>
            <DocumentsVaultSection
              orderDocuments={orderDocuments}
              uploadingDoc={uploadingDoc}
              onUploadDocument={(files, docType) => handleUploadOrderDocument(files, { order, customer, docType, setUploadingDoc, showToast, loadDetail: refreshDetail })}
              onPreview={setPreviewAttachment}
              onDeleteAttachment={requestDeleteAttachment}
              user={user}
            />

            <FinanceSection
              sectionRef={sectionRefs.finance}
              financeRecords={financeRecords}
              filteredRecords={filteredFinanceRecords}
              grandTotal={grandTotal}
              summary={summary}
              onPreview={setPreviewAttachment}
              onEdit={openFinanceDrawer}
              onAdd={() => openFinanceDrawer()}
              onDelete={(r: FinanceRecord) => setFinanceRecordToDelete(r)}
              financeFilter={financeFilter}
              onFilterChange={setFinanceFilter}
            />

            <ProductionSection
              sectionRef={sectionRefs.production}
              productionPlan={productionPlan}
              onEditProduction={openProductionDrawer}
              onUpdateInspection={(status) => handleUpdateInspectionStatus(status, { productionPlan, order, setSaving, showToast, loadDetail: refreshDetail })}
              onPreview={setPreviewAttachment}
              onUploadPhotos={(files) => handleUploadEvidenceFiles(files, { order, customer, entityType: 'production_photo', entityId: order?.id, label: '生产留痕图片', setUploading: setIsUploading, showToast, loadDetail: refreshDetail })}
              onDeleteAttachment={requestDeleteAttachment}
              onAddProduction={openProductionDrawer}
              user={user}
            />

            <CustomsSection
              sectionRef={sectionRefs.customs}
              customs={customs}
              onEditCustoms={openCustomsDrawer}
              onUploadDocument={(files, docType) => handleUploadEvidenceFiles(files, { order, customer, entityType: 'customs', entityId: customs?.id, docType, label: '报关单据', setUploading: setIsUploading, showToast, loadDetail: refreshDetail })}
              onDeleteAttachment={requestDeleteAttachment}
              onPreview={setPreviewAttachment}
              user={user}
            />

            <PackingSection
              sectionRef={sectionRefs.packing}
              packingRecords={packingRecords}
              packingPhotos={packingPhotos}
              onEditPacking={openPackingDrawer}
              onUploadPhotos={(files) => handleUploadEvidenceFiles(files, { order, customer, entityType: 'packing', entityId: order?.id, label: '装箱留痕图片', setUploading: setIsUploading, showToast, loadDetail: refreshDetail })}
              onDeleteAttachment={requestDeleteAttachment}
              onPreview={setPreviewAttachment}
              user={user}
            />

            <LogisticsSection
              sectionRef={sectionRefs.logistics}
              logisticsRecords={logisticsRecords}
              hasAnyLogistics={hasAnyLogistics}
              onAddLogistics={() => openLogisticsDrawer()}
              onEditLogistics={openLogisticsDrawer}
              onDeleteAttachment={requestDeleteAttachment}
              onPreview={setPreviewAttachment}
              user={user}
            />

            <TasksSection
              sectionRef={sectionRefs.todos}
              tasks={tasks}
              onAddTask={() => setShowTaskDrawer(true)}
              navigate={navigate}
            />

            <ProfitSection
              user={user}
              orderNo={orderNo || ''}
              totalAmount={itemsTotal + freightAmount + miscAmount || 0}
              freightAmount={freightAmount}
              miscAmount={miscAmount}
              itemsTotal={itemsTotal}
              showToast={showToast}
            />
            <FollowupsSection followUps={followUps} />
          </Suspense>
        </div>

        {/* Right Nav Rail */}
        <aside className="hidden w-[280px] shrink-0 self-start space-y-6 lg:sticky lg:top-6 lg:block">
          <Suspense fallback={<div className="h-64 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 animate-pulse" />}>
            <NavRailSection activeSection={activeSection} scrollToSection={scrollToSection} moduleAlerts={moduleAlerts} />
            <QuickFollowUpSection
              followUpInput={followUpInput}
              onFollowUpChange={setFollowUpInput}
              onSubmitFollowUp={() => handleSubmitFollowUp({ followUpInput, order, user, setDetail, setFollowUpInput, setSaving, showToast, setDrawerError })}
              saving={saving}
            />
            <AIAnalysisPanel onOpenAnalysis={() => setDrawer({ mode: 'ai-analysis' })} analyzing={analyzing} />
          </Suspense>
        </aside>
      </main>

      <div className="fixed inset-x-3 bottom-3 z-[260] lg:hidden">
        <div className="rounded-2xl border border-slate-200 bg-surface/95 p-2 shadow-2xl backdrop-blur-xl dark:border-navy-800 dark:bg-navy-900/95">
          <div className="grid grid-cols-4 gap-1">
            <button type="button" onClick={() => scrollToSection('items')} className="rounded-xl px-2 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-navy-800">商品</button>
            <button type="button" onClick={() => scrollToSection('finance')} className="rounded-xl px-2 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-navy-800">财务</button>
            <button type="button" onClick={() => setShowTaskDrawer(true)} className="rounded-xl px-2 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-navy-800">任务</button>
            <button type="button" onClick={() => setDrawer({ mode: 'ai-analysis' })} className="rounded-xl bg-primary-navy px-2 py-2 text-[11px] font-bold text-white transition-colors hover:bg-navy-950 dark:bg-tertiary-sage">AI</button>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        {previewAttachment && <PreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />}
        <TaskDrawer
          isOpen={showTaskDrawer}
          onClose={() => setShowTaskDrawer(false)}
          onSuccess={() => refreshDetail()}
          entityType="ORDER"
          entityId={order?.display_id}
          entityName={order?.display_id}
        />
      </Suspense>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Suspense fallback={null}>
        <ConfirmDeleteModal
          isOpen={Boolean(attachmentToDelete)}
          onClose={() => setAttachmentToDelete(null)}
          onConfirm={() => void deleteAttachment()}
          title="删除附件"
          warning={
            <>
              确定要删除附件“{attachmentToDelete?.fileName || ''}”吗？
              <br /><br />
              删除后该文件将从当前订单记录中移除，且无法在系统内恢复。
            </>
          }
          entityLabel="附件名称"
          entityId={attachmentToDelete?.fileName || ''}
          isDeleting={isAttachmentDeleting}
        />
        <ConfirmDeleteModal
          isOpen={Boolean(financeRecordToDelete)}
          onClose={() => setFinanceRecordToDelete(null)}
          onConfirm={() => void deleteFinanceRecord()}
          title="删除财务流水"
          warning={
            <>
              确定要删除这条财务流水吗？
              <br /><br />
              删除后该订单的回款/付款统计会同步更新，请先确认凭证与内部记录已经核对。
            </>
          }
          entityLabel="流水编号"
          entityId={financeRecordToDelete ? String(financeRecordToDelete.id) : ''}
          isDeleting={isFinanceDeleting}
        />
        <ConfirmDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={() => handleDeleteOrder({ order, setIsDeleting, setIsDeleteModalOpen, showToast, navigate })}
          warning={
            <>
              确定要永久删除订单吗？
              <br /><br />
              此操作将同步清除与之关联的所有<span className="text-red-600 font-bold">生产、财务及物流数据</span>，且无法恢复！
            </>
          }
          entityLabel="单号"
          entityId={order?.display_id || ''}
          isDeleting={isDeleting}
        />
      </Suspense>

      {/* Drawer */}
      {drawer.mode !== 'closed' && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[420] flex h-dvh justify-end overflow-hidden">
          <button type="button" onClick={closeDrawer} className="absolute inset-0 bg-primary-navy/50 dark:bg-black/60 backdrop-blur-sm transition-all" />
          <div className="relative z-10 h-dvh max-h-dvh w-full max-w-[750px] border-l border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-2xl flex min-h-0 flex-col animate-in slide-in-from-right duration-500">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 dark:border-navy-800 px-6 py-5 sm:px-10 sm:py-8 bg-slate-50 dark:bg-navy-950/80 backdrop-blur-md">
              <div className="group cursor-default">
                <h3 className="text-xl font-bold text-primary-navy dark:text-white tracking-tight leading-none">{currentDrawerTitle}</h3>
              </div>
              <button type="button" onClick={closeDrawer} className="rounded-lg border border-slate-200 dark:border-navy-700 bg-surface dark:bg-navy-800 p-2 text-slate-400 hover:text-error hover:border-red-200 dark:hover:border-red-900 transition-all shadow-sm"><X size={26} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); if (drawer.mode === 'order') handleSaveOrder(e, { orderForm, deletedItemIds, order, setSaving, showToast, closeDrawer, loadDetail: refreshDetail, setDrawerError }); else if (drawer.mode === 'finance') handleSaveFinance(e, { financeForm, order, customer, setSaving, showToast, closeDrawer, loadDetail: refreshDetail, setDrawerError, setIsUploading, setUploadProgress }); else if (drawer.mode === 'production') handleSaveProduction(e, { productionForm, order, customer, setSaving, showToast, closeDrawer, loadDetail: refreshDetail, setDrawerError, setIsUploading, setUploadProgress }); else if (drawer.mode === 'production-log') handleSaveProductionLog(e, { productionLogForm, order, customer, productionPlan, setSaving, showToast, closeDrawer, loadDetail: refreshDetail, setDrawerError, setIsUploading, setUploadProgress }); else if (drawer.mode === 'customs') handleSaveCustoms(e, { customsForm, order, customer, setSaving, showToast, closeDrawer, loadDetail: refreshDetail, setDrawerError, setIsUploading, setUploadProgress }); else if (drawer.mode === 'logistics') handleSaveLogistics(e, { logisticsForm, order, customer, setSaving, showToast, closeDrawer, loadDetail: refreshDetail, setDrawerError, setIsUploading, setUploadProgress }); else if (drawer.mode === 'packing') handleSavePacking(e, { packingForm, order, setSaving, showToast, closeDrawer, loadDetail: refreshDetail, setDrawerError }); }} className="flex min-h-0 flex-1 flex-col bg-surface dark:bg-navy-900">
              <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-10 space-y-10 custom-scrollbar">
                {drawerError && <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg text-sm font-bold text-error mb-8 flex items-start gap-4 shadow-inner"><X size={18} className="shrink-0 mt-0.5" /> {drawerError}</div>}
                <Suspense fallback={<div className="p-12 text-center text-slate-400 animate-pulse font-bold tracking-tight">正在载入组件...</div>}>
                  {drawer.mode === 'order' ? (
                    <OrderEditForm orderForm={orderForm} setOrderForm={setOrderForm} deletedItemIds={deletedItemIds} setDeletedItemIds={setDeletedItemIds} />
                  ) : drawer.mode === 'production-log' ? (
                    <ProductionLogForm productionLogForm={productionLogForm} setProductionLogForm={setProductionLogForm} isUploading={isUploading} uploadProgress={uploadProgress} />
                  ) : drawer.mode === 'customs' ? (
                    <CustomsForm customsForm={customsForm} setCustomsForm={setCustomsForm} isUploading={isUploading} uploadProgress={uploadProgress} />
                  ) : drawer.mode === 'packing' ? (
                    <PackingForm packingForm={packingForm} setPackingForm={setPackingForm} onUploadPhoto={(idx, file) => handleUploadPackingPhoto(idx, file, { packingForm, setPackingForm, order, customer, setSaving, setDrawerError, setIsUploading, setUploadProgress })} />
                  ) : drawer.mode === 'logistics' ? (
                    <LogisticsForm logisticsForm={logisticsForm} setLogisticsForm={setLogisticsForm} forwarderPartners={partners.filter((p) => p.partner_type === 'forwarder')} isUploading={isUploading} uploadProgress={uploadProgress} />
                  ) : drawer.mode === 'finance' ? (
                    <FinanceForm financeForm={financeForm} setFinanceForm={setFinanceForm} customerName={customer.name || ''} partners={partners} isUploading={isUploading} uploadProgress={uploadProgress} />
                  ) : drawer.mode === 'production' ? (
                    <ProductionForm productionForm={productionForm} setProductionForm={setProductionForm} productionPartners={productionPartners} isUploading={isUploading} uploadProgress={uploadProgress} />
                  ) : (
                    <AIAnalysisContent analyzing={analyzing} aiResult={aiResult} />
                  )}
                </Suspense>
              </div>
              <div className="shrink-0 flex gap-4 sm:gap-6 bg-surface/95 dark:bg-navy-900/95 backdrop-blur-2xl px-6 py-5 sm:px-10 sm:py-8 border-t border-slate-100 dark:border-navy-800">
                {drawer.mode === 'ai-analysis' ? (
                  <button type="button" onClick={closeDrawer} className="btn-secondary flex-1 py-4 text-xs font-extrabold tracking-tight">关闭</button>
                ) : (
                  <>
                    <button type="button" onClick={closeDrawer} className="btn-secondary flex-1 py-4 text-xs font-extrabold tracking-tight">放弃修改</button>
                    <button type="submit" disabled={saving} className="btn-primary flex-[3] py-4 text-sm font-extrabold tracking-tight">{saving ? '同步中...' : '确认并同步数据'}</button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
