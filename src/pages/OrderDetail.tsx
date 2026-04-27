import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/ui/Toast';
import { PreviewModal } from '../features/order-detail/components';
import { TaskDrawer } from '../components/ui/TaskDrawer';
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal';
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
import {
  OrderHeaderSection,
  ItemsSection,
  DocumentsVaultSection,
  FinanceSection,
  ProfitSection,
  ProductionSection,
  CustomsSection,
  PackingSection,
  LogisticsSection,
  TasksSection,
  FollowupsSection,
  NavRailSection,
  QuickFollowUpSection,
  AIAnalysisPanel,
} from '../features/order-detail/sections';
import {
  OrderEditForm,
  FinanceForm,
  ProductionForm,
  ProductionLogForm,
  CustomsForm,
  LogisticsForm,
  PackingForm,
  AIAnalysisContent,
} from '../features/order-detail/drawers';
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
  handleSubmitFollowUp,
  handleDeleteOrder,
  handleExportPdf,
  handleUpdateInspectionStatus,
} from '../features/order-detail/handlers';

export default function OrderDetailPage() {
  const { user } = useAuth();
  const { orderNo } = useParams();
  const navigate = useNavigate();

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
  const [scrollPercent, setScrollPercent] = useState(0);

  const toastTimerRef = useRef<any>(null);

  // 3. Derived
  const order = detail?.order;
  const customer = (detail?.customer || {}) as CustomerInfo;
  const items = detail?.items || [];
  const financeRecords = detail?.financeRecords || [];
  const productionPlan = detail?.productionPlan || null;
  const customs = detail?.customs || null;
  const logisticsRecords = detail?.logisticsRecords || [];
  const packingRecords = detail?.packingRecords || [];
  const orderDocuments = detail?.orderDocuments || [];
  const followUps = detail?.followUps || [];
  const tasks = detail?.tasks || [];
  const domesticLogistics = detail?.domesticLogistics || null;
  const internationalLogistics = detail?.internationalLogistics || null;
  const summary = detail?.summary || { receiptsByCurrency: {}, attachmentsSummary: { finance: 0, logistics: 0, customs: 0 } };
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

  const stageIndex = STAGE_STEPS.findIndex((s) => s.key === order?.status);

  // 4. Effects
  const loadDetail = async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    if (!orderNo) { setError('无效单号'); setLoading(false); return; }
    if (showLoading) setLoading(true);
    try {
      const detailData = await apiFetch<OrderDetailResponse>(`/api/orders/${orderNo}`);
      setDetail(detailData);
      const partnerData = await apiFetch<Partner[]>('/api/partners');
      setPartners(partnerData);
    } catch (err) {
      setError(getErrorMessage(err, '读取详情失败'));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => { void loadDetail(); }, [orderNo]);

  useEffect(() => {
    const handleScroll = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      setScrollPercent(scrolled);

      const scrollPos = window.scrollY + 120;
      for (const [key, ref] of Object.entries(sectionRefs)) {
        if (ref.current && scrollPos >= ref.current.offsetTop && scrollPos < ref.current.offsetTop + ref.current.offsetHeight) {
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
    if (section === 'documents' || section === 'followups') {
      const id = section === 'documents' ? 'documents-vault' : 'followups-timeline';
      const el = document.getElementById(id);
      if (el) {
        const top = el.getBoundingClientRect().top + window.pageYOffset - 24;
        window.scrollTo({ top, behavior: 'smooth' });
      }
      return;
    }
    const ref = sectionRefs[section as keyof typeof sectionRefs];
    if (ref?.current) {
      const top = ref.current.getBoundingClientRect().top + window.pageYOffset - 24;
      window.scrollTo({ top, behavior: 'smooth' });
      if (section !== 'packing') setActiveSection(section as SectionKey);
    }
  };

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

  // 6. View Helpers
  if (loading) return <div className="p-12 text-secondary-slate dark:text-slate-400 animate-pulse font-medium bg-background dark:bg-navy-950">正在加载数据...</div>;
  if (error || !detail || !order) return <div className="p-8 text-error font-bold bg-white dark:bg-navy-900 border border-[#E2E8F0] dark:border-navy-800 m-6 rounded-lg shadow-sm">加载失败: {error}</div>;

  return (
    <>
      {/* 页面顶部滚动进度条 */}
      <div className="fixed top-0 left-0 h-1 bg-tertiary-sage/30 z-[200] w-full pointer-events-none">
        <div className="h-full bg-tertiary-sage transition-all duration-300 ease-out" style={{ width: `${scrollPercent}%` }} />
      </div>

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
      />

      {/* Physical 2-Column Main Layout */}
      <main className="max-w-[1600px] mx-auto py-10 flex gap-8 items-start">

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

          <DocumentsVaultSection
            orderDocuments={orderDocuments}
            uploadingDoc={uploadingDoc}
            onUploadDocument={(files) => handleUploadOrderDocument(files, { order, customer, setUploadingDoc, showToast, loadDetail })}
            onPreview={setPreviewAttachment}
            onDeleteAttachment={(id) => handleDeleteAttachment(id, { showToast, loadDetail })}
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
            onDelete={(r: FinanceRecord) => { if(window.confirm('确认删除？')) apiFetch(`/api/finance/${r.id}`,{method:'DELETE'}).then(()=>loadDetail({showLoading:false})) }}
            financeFilter={financeFilter}
            onFilterChange={setFinanceFilter}
          />

          <ProfitSection
            user={user}
            totalAmount={itemsTotal + freightAmount + miscAmount || 0}
            freightAmount={freightAmount}
            miscAmount={miscAmount}
            itemsTotal={itemsTotal}
          />

          <ProductionSection
            sectionRef={sectionRefs.production}
            productionPlan={productionPlan}
            onEditProduction={openProductionDrawer}
            onUpdateInspection={(status) => handleUpdateInspectionStatus(status, { productionPlan, order, setSaving, showToast, loadDetail })}
            onPreview={setPreviewAttachment}
            onAddProduction={openProductionDrawer}
          />

          <CustomsSection
            sectionRef={sectionRefs.customs}
            customs={customs}
            onEditCustoms={openCustomsDrawer}
            onDeleteAttachment={(id) => handleDeleteAttachment(id, { showToast, loadDetail })}
            onPreview={setPreviewAttachment}
            user={user}
          />

          <PackingSection
            sectionRef={sectionRefs.packing}
            packingRecords={packingRecords}
            onEditPacking={openPackingDrawer}
            onPreview={setPreviewAttachment}
          />

          <LogisticsSection
            sectionRef={sectionRefs.logistics}
            logisticsRecords={logisticsRecords}
            hasAnyLogistics={hasAnyLogistics}
            onAddLogistics={() => openLogisticsDrawer()}
            onEditLogistics={openLogisticsDrawer}
            onDeleteAttachment={(id) => handleDeleteAttachment(id, { showToast, loadDetail })}
            onPreview={setPreviewAttachment}
            user={user}
          />

          <TasksSection
            tasks={tasks}
            onAddTask={() => setShowTaskDrawer(true)}
            navigate={navigate}
          />

          <FollowupsSection followUps={followUps} />
        </div>

        {/* Right Nav Rail */}
        <aside className="w-[280px] shrink-0 sticky top-6 self-start space-y-6">
          <NavRailSection activeSection={activeSection} scrollToSection={scrollToSection} />
          <QuickFollowUpSection
            followUpInput={followUpInput}
            onFollowUpChange={setFollowUpInput}
            onSubmitFollowUp={() => handleSubmitFollowUp({ followUpInput, order, user, setDetail, setFollowUpInput, setSaving, showToast, setDrawerError })}
            saving={saving}
          />
          <AIAnalysisPanel onOpenAnalysis={() => setDrawer({ mode: 'ai-analysis' })} analyzing={analyzing} />
        </aside>
      </main>

      {previewAttachment && <PreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />}
      <TaskDrawer
        isOpen={showTaskDrawer}
        onClose={() => setShowTaskDrawer(false)}
        onSuccess={() => loadDetail({ showLoading: false })}
        entityType="ORDER"
        entityId={String(order?.id)}
        entityName={order?.display_id}
      />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

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

      {/* Drawer */}
      {drawer.mode !== 'closed' && (
        <div className="fixed inset-0 z-[150] flex justify-end">
          <button onClick={closeDrawer} className="absolute inset-0 bg-primary-navy/50 dark:bg-black/60 backdrop-blur-sm transition-all" />
          <div className="relative z-10 h-full w-full max-w-[750px] border-l border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-10 py-8 bg-slate-50 dark:bg-navy-950/50">
              <div className="group cursor-default">
                <h3 className="text-xl font-bold text-primary-navy dark:text-white tracking-tight uppercase leading-none">{currentDrawerTitle}</h3>
              </div>
              <button onClick={closeDrawer} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-800 p-2 text-slate-400 hover:text-error hover:border-red-200 dark:hover:border-red-900 transition-all shadow-sm"><X size={26} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); if (drawer.mode === 'order') handleSaveOrder(e, { orderForm, deletedItemIds, order, setSaving, showToast, closeDrawer, loadDetail, setDrawerError }); else if (drawer.mode === 'finance') handleSaveFinance(e, { financeForm, order, customer, setSaving, showToast, closeDrawer, loadDetail, setDrawerError, setIsUploading, setUploadProgress }); else if (drawer.mode === 'production') handleSaveProduction(e, { productionForm, order, customer, setSaving, showToast, closeDrawer, loadDetail, setDrawerError, setIsUploading, setUploadProgress }); else if (drawer.mode === 'production-log') handleSaveProductionLog(e, { productionLogForm, order, customer, productionPlan, setSaving, showToast, closeDrawer, loadDetail, setDrawerError, setIsUploading, setUploadProgress }); else if (drawer.mode === 'customs') handleSaveCustoms(e, { customsForm, order, customer, setSaving, showToast, closeDrawer, loadDetail, setDrawerError, setIsUploading, setUploadProgress }); else if (drawer.mode === 'logistics') handleSaveLogistics(e, { logisticsForm, order, customer, setSaving, showToast, closeDrawer, loadDetail, setDrawerError, setIsUploading, setUploadProgress }); else if (drawer.mode === 'packing') handleSavePacking(e, { packingForm, order, setSaving, showToast, closeDrawer, loadDetail, setDrawerError }); }} className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-white dark:bg-navy-900">
              {drawerError && <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg text-sm font-bold text-error mb-8 flex items-start gap-4 shadow-inner uppercase "><X size={18} className="shrink-0 mt-0.5" /> {drawerError}</div>}
              {drawer.mode === 'order' ? (
                <OrderEditForm orderForm={orderForm} setOrderForm={setOrderForm} deletedItemIds={deletedItemIds} setDeletedItemIds={setDeletedItemIds} />
              ) : drawer.mode === 'production-log' ? (
                <ProductionLogForm productionLogForm={productionLogForm} setProductionLogForm={setProductionLogForm} isUploading={isUploading} uploadProgress={uploadProgress} />
              ) : drawer.mode === 'customs' ? (
                <CustomsForm customsForm={customsForm} setCustomsForm={setCustomsForm} isUploading={isUploading} uploadProgress={uploadProgress} />
              ) : drawer.mode === 'packing' ? (
                <PackingForm packingForm={packingForm} setPackingForm={setPackingForm} onUploadPhoto={(idx, file) => handleUploadPackingPhoto(idx, file, { packingForm, setPackingForm, order, customer, setSaving, setDrawerError, setIsUploading, setUploadProgress })} />
              ) : drawer.mode === 'logistics' ? (
                <LogisticsForm logisticsForm={logisticsForm} setLogisticsForm={setLogisticsForm} isUploading={isUploading} uploadProgress={uploadProgress} />
              ) : drawer.mode === 'finance' ? (
                <FinanceForm financeForm={financeForm} setFinanceForm={setFinanceForm} isUploading={isUploading} uploadProgress={uploadProgress} />
              ) : drawer.mode === 'production' ? (
                <ProductionForm productionForm={productionForm} setProductionForm={setProductionForm} productionPartners={productionPartners} isUploading={isUploading} uploadProgress={uploadProgress} />
              ) : (
                <AIAnalysisContent analyzing={analyzing} aiResult={aiResult} />
              )}
              <div className="flex gap-6 pt-16 sticky bottom-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-2xl pb-12 z-[40] border-t border-slate-100 dark:border-navy-800">
                <button type="button" onClick={closeDrawer} className="btn-secondary flex-1 py-5 text-xs font-extrabold uppercase tracking-[0.5em]">放弃修改</button>
                <button type="submit" disabled={saving} className="btn-primary flex-[3] py-5 text-base font-extrabold uppercase tracking-[0.5em]">{saving ? '同步同步中...' : '确认并同步数据'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
