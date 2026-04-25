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
  Truck,
  Wallet,
  X,
  History,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  CircleHelp,
  Trash,
  Upload,
  FileCode,
  Clock,
  Calendar,
  Box,
  StickyNote,
  AlertTriangle,
  Copy,
  Check,
  Package,
  BadgeDollarSign
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch, apiUpload, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  ActionButton,
  AttachmentEditor,
  Field,
  FilterPill,
  LightActionButton,
  LogisticsSnapshot,
  MetricCard,
  PreviewModal,
  ProductImagePlaceholder,
  Chip,
  WorkSection,
  FinanceDashboard,
  ProductionDashboard,
  StatusFileRow,
  DocumentBoard,
  RemarkBoard,
  EmptyStateBoard,
  GridItem,
  HistoryTimeline
} from '../features/order-detail/components';
import type {
  AIAnalysisResult,
  AttachmentMeta,
  CustomsFormState,
  CustomsRecord,
  DrawerState,
  FinanceCategory,
  FinanceFormState,
  FinanceRecord,
  LogisticsFormState,
  LogisticsRecord,
  OrderDetailResponse,
  OrderFormState,
  Partner,
  ProductionFormState,
  ProductionPlan,
  ProductionLog,
  ProductionLogFormState,
  PackingRecord,
  PackingFormState,
  SectionKey,
  OrderStatus,
  FinanceType
} from '../features/order-detail/types';
import {
  asNumber,
  asText,
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
  formatDateTime,
  orderToFormState,
  STAGE_STEPS,
} from '../features/order-detail/utils';

type ExtendedDrawerState = DrawerState | { mode: 'production-log' };

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

  // 2. State
  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [drawer, setDrawer] = useState<ExtendedDrawerState>({ mode: 'closed' });
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
  const [quickNotes, setQuickNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 删除确认状态
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [idCopied, setIdCopied] = useState(false);

  const copyOrderId = () => {
    if (!order) return;
    navigator.clipboard.writeText(order.display_id);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 2000);
  };

  const toastTimerRef = useRef<any>(null);

  // 3. Derived
  const order = detail?.order;
  const customer = detail?.customer || {};
  const items = detail?.items || [];
  const financeRecords = detail?.financeRecords || [];
  const productionPlan = detail?.productionPlan || null;
  const customs = detail?.customs || null;
  const logisticsRecords = detail?.logisticsRecords || [];
  const packingRecords = detail?.packingRecords || [];
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
      setQuickNotes(detailData.order?.quick_notes || '');
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
    if (msg) {
      toastTimerRef.current = setTimeout(() => setToast(''), 3000);
    }
  };

  const handleToastMouseEnter = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  };

  const handleToastMouseLeave = () => {
    if (toast) {
      toastTimerRef.current = setTimeout(() => setToast(''), 1500);
    }
  };

  const saveQuickNotes = async (val: string) => {
    setSavingNotes(true);
    try {
      await apiFetch(`/api/orders/${order?.id}/quick-notes`, { method: 'PATCH', body: JSON.stringify({ content: val }) });
    } catch (err) { console.error('Auto-save failed', err); }
    finally { setSavingNotes(false); }
  };

  const debounceRef = useRef<any>(null);
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setQuickNotes(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveQuickNotes(val), 1000);
  };

  // 5. Handlers
  const scrollToSection = (section: SectionKey | 'packing') => {
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

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...orderForm, customerId: Number(orderForm.customerId), totalAmount: Number(orderForm.totalAmount), freightAmount: Number(orderForm.freightAmount), miscAmount: Number(orderForm.miscAmount), deletedItemIds };
      await apiFetch(`/api/orders/${order?.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      showToast('同步成功'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); } finally { setSaving(false); }
  };

  const handleSaveFinance = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      let newAtts: AttachmentMeta[] = [];
      if (financeForm.newFiles.length) {
        setIsUploading(true); setUploadProgress(0);
        const fd = new FormData(); 
        fd.append('customerId', String(customer.id));
        fd.append('orderId', String(order?.id));
        financeForm.newFiles.forEach(f => fd.append('files', f));
        newAtts = await apiUpload<AttachmentMeta[]>('/api/attachments', fd, setUploadProgress);
        setIsUploading(false);
      }
      const payload = { ...financeForm, orderId: Number(order?.id), amount: Number(financeForm.amount), partnerId: Number(financeForm.partnerId) || null, attachmentIds: [...financeForm.attachments.map(a => a.id), ...newAtts.map(a => a.id)] };
      const url = financeForm.id ? `/api/finance/${financeForm.id}` : `/api/finance`;
      await apiFetch(url, { method: financeForm.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      showToast('同步成功'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); setIsUploading(false); } finally { setSaving(false); }
  };

  const handleSaveProduction = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...productionForm, orderId: Number(order?.id), partnerId: Number(productionForm.partnerId) };
      const url = productionForm.id ? `/api/orders/production/${productionForm.id}` : `/api/orders/${order?.id}/production`;
      await apiFetch(url, { method: productionForm.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      showToast('同步成功'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); } finally { setSaving(false); }
  };

  const handleSaveProductionLog = async (e: React.FormEvent) => {
    e.preventDefault(); if (!productionLogForm.content.trim()) return; setSaving(true);
    try {
      let newAtts: AttachmentMeta[] = [];
      if (productionLogForm.newFiles.length) {
        setIsUploading(true); setUploadProgress(0);
        const fd = new FormData(); 
        fd.append('customerId', String(customer.id));
        fd.append('orderId', String(order?.id));
        productionLogForm.newFiles.forEach(f => fd.append('files', f));
        newAtts = await apiUpload<AttachmentMeta[]>('/api/attachments', fd, setUploadProgress);
        setIsUploading(false);
      }
      const payload = { ...productionLogForm, attachmentIds: [...productionLogForm.attachments.map(a => a.id), ...newAtts.map(a => a.id)] };
      await apiFetch(`/api/orders/production/${productionPlan?.id}/logs`, { method: 'POST', body: JSON.stringify(payload) });
      showToast('进度已记录'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '提交失败')); setIsUploading(false); } finally { setSaving(false); }
  };

  const handleSaveCustoms = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      let newAtts: AttachmentMeta[] = [];
      if (customsForm.newFiles.length) {
        setIsUploading(true); setUploadProgress(0);
        const fd = new FormData(); 
        fd.append('customerId', String(customer.id));
        fd.append('orderId', String(order?.id));
        customsForm.newFiles.forEach(f => fd.append('files', f));
        newAtts = await apiUpload<AttachmentMeta[]>('/api/attachments', fd, setUploadProgress);
        setIsUploading(false);
      }
      const payload = { ...customsForm, orderId: Number(order?.id), attachmentIds: [...customsForm.attachments.map(a => a.id), ...newAtts.map(a => a.id)] };
      const url = customsForm.id ? `/api/customs/${customsForm.id}` : `/api/orders/${order?.id}/customs`;
      await apiFetch(url, { method: customsForm.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      showToast('同步成功'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); setIsUploading(false); } finally { setSaving(false); }
  };

  const handleSaveLogistics = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      let newAtts: AttachmentMeta[] = [];
      if (logisticsForm.newFiles.length) {
        setIsUploading(true); setUploadProgress(0);
        const fd = new FormData(); 
        fd.append('customerId', String(customer.id));
        fd.append('orderId', String(order?.id));
        logisticsForm.newFiles.forEach(f => fd.append('files', f));
        newAtts = await apiUpload<AttachmentMeta[]>('/api/attachments', fd, setUploadProgress);
        setIsUploading(false);
      }
      const payload = { ...logisticsForm, orderId: Number(order?.id), freightForwarder: logisticsForm.freightForwarder, attachmentIds: [...logisticsForm.attachments.map(a => a.id), ...newAtts.map(a => a.id)] };
      const url = logisticsForm.id ? `/api/logistics/${logisticsForm.id}` : `/api/logistics`;
      await apiFetch(url, { method: logisticsForm.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      showToast('同步成功'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); setIsUploading(false); } finally { setSaving(false); }
  };

  const handleSavePacking = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch(`/api/orders/${order?.id}/packing`, { method: 'PATCH', body: JSON.stringify(packingForm) });
      showToast('装箱数据已更新'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); } finally { setSaving(false); }
  };

  const handleUploadPackingPhoto = async (idx: number, file: File) => {
     setSaving(true); setIsUploading(true); setUploadProgress(0);
     try {
       const fd = new FormData();
       fd.append('customerId', String(customer.id));
       fd.append('orderId', String(order?.id));
       fd.append('files', file);
       const [att] = await apiUpload<AttachmentMeta[]>('/api/attachments', fd, setUploadProgress);
       const next = [...packingForm.items];
       next[idx].attachmentId = att.id;
       next[idx].imageUrl = att.url;
       setPackingForm({ items: next });
       setIsUploading(false);
     } catch (err) { setDrawerError('图片上传失败'); setIsUploading(false); }
     finally { setSaving(false); }
  };

  const handleDeleteAttachment = async (id: number) => {
    if (!confirm('确认彻底删除此附件？')) return;
    try {
       await apiFetch(`/api/attachments/${id}`, { method: 'DELETE' });
       showToast('文件已移除');
       await loadDetail({ showLoading: false });
    } catch (err) { alert(getErrorMessage(err, '删除失败')); }
  };

  const handleDeleteOrder = async () => {
    if (!order || deleteConfirmId !== order.display_id) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/orders/${order.id}`, { method: 'DELETE' });
      showToast('订单已永久删除');
      setIsDeleteModalOpen(false);
      navigate('/orders');
    } catch (err) { alert(getErrorMessage(err, '删除失败')); }
    finally { setIsDeleting(false); }
  };

  // 6. View Helpers
  if (loading) return <div className="p-12 text-secondary-slate dark:text-slate-400 animate-pulse font-medium bg-background dark:bg-navy-950">正在加载数据...</div>;
  if (error || !detail || !order) return <div className="p-8 text-error font-bold bg-white dark:bg-navy-900 border border-[#E2E8F0] dark:border-navy-800 m-6 rounded-lg shadow-sm">加载失败: {error}</div>;

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_200px] items-start pt-0">
        <div className="space-y-4 min-w-0 pt-0">
          {/* header Section */}
          <header ref={sectionRefs.basic} className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-5 shadow-md mt-0 transition-colors">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between border-b border-[#F1F5F9] dark:border-navy-800 pb-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2 text-[11px] font-bold text-secondary-slate dark:text-slate-400 uppercase tracking-widest leading-none">
                    <button onClick={() => navigate('/orders')} className="hover:text-primary-navy dark:hover:text-tertiary-sage transition-colors">订单列表</button>
                    <ChevronRight size={12} className="opacity-30" />
                    <span className="text-primary-navy dark:text-tertiary-sage data-field">{order.display_id}</span>
                  </div>
                  <h1 className="text-2xl font-bold text-primary-navy dark:text-white tracking-tight truncate mb-4">{asText(customer.name, '未命名客户')}</h1>
                  <div className="flex flex-wrap gap-4 text-[11px] font-bold text-secondary-slate dark:text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><MapPin size={12} className="text-tertiary-sage" />{asText(customer.country)}</span>
                    <span className="flex items-center gap-1.5"><Mail size={12} className="text-info dark:text-blue-400" />{asText(customer.contact)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                   <ActionButton onClick={openOrderDrawer} icon={<Edit3 size={14} />}>编辑订单</ActionButton>
                   <LightActionButton onClick={() => openFinanceDrawer()} className="!py-1.5 !px-3 !text-[11px]"><Plus size={12} className="mr-1" /> 录入收支</LightActionButton>
                   <LightActionButton onClick={openProductionDrawer}><Factory size={14} className="mr-1 opacity-70" /> 同步生产</LightActionButton>
                   <LightActionButton onClick={openCustomsDrawer}><ShieldCheck size={14} className="mr-1 opacity-70" /> 更新报关</LightActionButton>
                   <LightActionButton onClick={() => openLogisticsDrawer()}><Plus size={14} className="mr-1 opacity-70" /> 新建物流</LightActionButton>
                   
                   {/* 高危按钮物理隔离 */}
                   <div className="h-6 w-px bg-slate-200 dark:bg-navy-800 mx-1 hidden sm:block" />
                   {user?.role === 'admin' && (
                     <LightActionButton onClick={() => { setDeleteConfirmId(''); setIsDeleteModalOpen(true); }} className="!text-red-500 !border-red-200 hover:!bg-red-50 dark:!border-red-900/30 dark:hover:!bg-red-900/20 ml-auto">
                        <Trash size={14} className="mr-1" /> 删除订单
                     </LightActionButton>
                   )}
                </div>
              </div>

              <div className="rounded-md bg-[#F8FAFC] dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {STAGE_STEPS.map((s, i) => (
                    <button key={s.key} onClick={() => scrollToSection(s.target)} className={`flex-1 min-w-[130px] flex items-center gap-3 px-4 py-2 rounded transition-all ${s.key === order.status ? 'bg-white dark:bg-navy-800 shadow-md ring-1 ring-slate-200 dark:ring-navy-700' : 'opacity-40 hover:opacity-100'}`}>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i <= stageIndex ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'}`}>{i + 1}</span>
                      <span className={`text-[11px] font-bold uppercase tracking-widest ${s.key === order.status ? 'text-primary-navy dark:text-white' : 'text-secondary-slate dark:text-slate-400'}`}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </header>

          {/* Manifest Table */}
          <WorkSection ref={sectionRefs.items} section="items" title="商品明细" icon={<FileText size={16} />} collapsed={collapsed.items} onToggle={() => toggleSection('items')} action={<LightActionButton onClick={openOrderDrawer} className="!text-[10px] !px-3"><Plus size={12} className="mr-1" /> 编辑清单</LightActionButton>}>
            {items.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm">
                <table className="min-w-full text-left text-xs font-medium">
                  <thead className="bg-slate-50 dark:bg-navy-950 font-bold uppercase tracking-widest border-b border-slate-200 dark:border-navy-800 data-field text-[10px] text-secondary-slate dark:text-slate-400">
                    <tr><th className="px-5 py-4">商品名称与标识</th><th className="px-5 py-4 text-center">配置规格</th><th className="px-5 py-4 text-center">数量</th><th className="px-5 py-4 text-right">单价 (USD)</th><th className="px-5 py-4 text-right">金额 (USD)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-800 font-medium tracking-tight">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                        <td className="px-5 py-4 flex items-center gap-4 font-bold text-primary-navy dark:text-white uppercase">{asText(item.product_name)}</td>
                        <td className="px-5 py-4 text-center text-secondary-slate dark:text-slate-400 text-[10px] data-field uppercase font-bold">{asText(item.specification, '通用')}</td>
                        <td className="px-5 py-4 text-center font-bold text-primary-navy dark:text-white data-field">{item.quantity} {item.unit || 'pcs'}</td>
                        <td className="px-5 py-4 text-right text-secondary-slate dark:text-slate-400 data-field font-bold">{asNumber(item.unit_price).toLocaleString()}</td>
                        <td className="px-5 py-4 text-right font-bold text-primary-navy dark:text-tertiary-sage data-field text-[15px]">USD {asNumber(item.subtotal).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#F1F5F9] dark:bg-navy-950 text-primary-navy dark:text-white font-extrabold border-t border-slate-200 dark:border-navy-800">
                    <tr><td colSpan={4} className="px-5 py-5 text-right text-[11px] uppercase tracking-widest opacity-70">合计总值 (估算)</td><td className="px-5 py-5 text-right text-[20px] data-field text-primary-navy dark:text-tertiary-sage">USD {grandTotal.toLocaleString()}</td></tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <EmptyStateBoard title="暂无商品明细" description="请通过右上方“编辑订单”按钮，初始化本单的货物清单数据。" icon={Package} />
            )}
          </WorkSection>

          {/* Finance Section */}
          <DocumentBoard ref={sectionRefs.finance} title="财务信息" action={<div className="flex items-center gap-3"><div className="flex bg-white dark:bg-navy-800 p-0.5 rounded border border-slate-200 dark:border-navy-700"><FilterPill active={financeFilter==='all'} onClick={()=>setFinanceFilter('all')}>全部</FilterPill><FilterPill active={financeFilter==='receipt'} onClick={()=>setFinanceFilter('receipt')}>收款</FilterPill><FilterPill active={financeFilter==='payment'} onClick={()=>setFinanceFilter('payment')}>付款</FilterPill></div><LightActionButton onClick={() => openFinanceDrawer()} className="!py-1.5 !px-3 !text-[11px]"><Plus size={12} className="mr-1" /> 录入收支</LightActionButton></div>}>
            <FinanceDashboard totalAmount={grandTotal} records={filteredFinanceRecords} receiptsByCurrency={summary.receiptsByCurrency} onPreview={setPreviewAttachment} onEdit={openFinanceDrawer} onDelete={(r) => { if(confirm('确认删除？')) apiFetch(`/api/finance/${r.id}`,{method:'DELETE'}).then(()=>loadDetail({showLoading:false})) }} />
          </DocumentBoard>

          {/* Production Section */}
          <DocumentBoard ref={sectionRefs.production} title="生产信息">
            <ProductionDashboard plan={productionPlan} onEditLink={openProductionDrawer} onUploadPlan={openProductionDrawer} onAddLog={() => openProductionLogDrawer()} />
          </DocumentBoard>

          {/* Customs Section */}
          <DocumentBoard ref={sectionRefs.customs} title="报关信息" action={<LightActionButton onClick={openCustomsDrawer}><ShieldCheck size={14} className="mr-1 opacity-70" /> 更新报关资料</LightActionButton>}>
            <div className="grid gap-8 lg:grid-cols-[240px_1fr] p-1">
              <div className="space-y-6 border-r border-slate-100 dark:border-navy-800 pr-8 flex flex-col justify-center">
                <GridItem label="报关单号" value={<span className="data-field uppercase font-bold text-primary-navy dark:text-white">{asText(customs?.declarationNo, '待填')}</span>} />
                <GridItem label="贸易方式" value={<Chip tone="neutral">{asText(customs?.tradeMode, '一般贸易')}</Chip>} />
                <GridItem label="报关日期" value={<span className="data-field uppercase font-bold text-primary-navy dark:text-white">{formatDateOnly(customs?.declarationDate, '待定')}</span>} />
                <GridItem label="预计出口" value={<span className="data-field uppercase font-bold text-primary-navy dark:text-white">{formatDateOnly(customs?.releaseDate, '待定')}</span>} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-navy-800 pb-2">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest opacity-70">官方凭证电子仓库</div>
                  <button onClick={openCustomsDrawer} className="text-[10px] font-bold text-primary-navy dark:text-tertiary-sage hover:underline">追加文件 +</button>
                </div>
                <div className="space-y-1">
                  {customs?.attachments?.length ? customs.attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between group">
                       <div className="flex-1 min-w-0"><StatusFileRow label={att.fileName.split('.')[0]} status="uploaded" fileName={att.fileName} onPreview={() => setPreviewAttachment(att)} /></div>
                       {user?.role === 'admin' && <button onClick={() => handleDeleteAttachment(att.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-error opacity-0 group-hover:opacity-100 transition-all"><Trash size={16} /></button>}
                    </div>
                  )) : (
                    <EmptyStateBoard title="暂无报关凭证" description="目前尚未上传报关单、发票等官方存档文件。" icon={ShieldCheck} />
                  )}
                </div>
              </div>
            </div>
          </DocumentBoard>

          {/* Packing Section */}
          <DocumentBoard ref={sectionRefs.packing} title="装箱明细" action={<LightActionButton onClick={openPackingDrawer}><Box size={14} className="mr-1 opacity-70" /> 更新装箱单</LightActionButton>}>
            {packingRecords.length ? (
               <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm bg-white dark:bg-navy-900">
                  <table className="min-w-full text-left text-[12px]">
                    <thead className="bg-slate-50 dark:bg-navy-950 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                      <tr>
                        <th className="px-5 py-3">序号</th>
                        <th className="px-5 py-3">件数 (箱)</th>
                        <th className="px-5 py-3">尺寸 / 体积</th>
                        <th className="px-5 py-3">毛重 / 净重 (kg)</th>
                        <th className="px-5 py-3 text-right">实物图</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-navy-800 font-bold text-primary-navy dark:text-white data-field">
                      {packingRecords.map((r, i) => (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                           <td className="px-5 py-3 text-slate-400 dark:text-slate-500">{(i+1).toString().padStart(2, '0')}</td>
                           <td className="px-5 py-3">{r.packageCount}</td>
                           <td className="px-5 py-3">{r.packageSize}</td>
                           <td className="px-5 py-3">{r.grossWeight} / {r.netWeight}</td>
                           <td className="px-5 py-3 text-right">
                              <div className="inline-flex h-9 w-9 rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 items-center justify-center overflow-hidden shadow-sm cursor-pointer hover:border-primary-navy dark:hover:border-tertiary-sage transition-all" onClick={() => r.imageUrl && setPreviewAttachment({ id: -1, fileName: `序号 ${i+1} 装箱实拍`, url: r.imageUrl })}>
                                 {r.imageUrl ? <img src={r.imageUrl} className="h-full w-full object-cover" /> : <Box size={16} className="text-slate-200 dark:text-navy-700" />}
                              </div>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            ) : (
              <EmptyStateBoard title="暂无装箱明细" description="点击右上角“更新装箱单”即可按箱号录入规格、重量并上传箱体实拍。" icon={Box} />
            )}
          </DocumentBoard>

          {/* Logistics Section */}
          <DocumentBoard ref={sectionRefs.logistics} title="运输轨迹" action={<LightActionButton onClick={() => openLogisticsDrawer()}><Plus size={14} className="mr-1 opacity-70" /> 录入运单</LightActionButton>}>
            {!hasAnyLogistics ? <EmptyStateBoard title="等待货件发运" description="当前订单尚未关联物流记录，请在发货后及时同步单号。" actionLabel="录入物流单号" onAction={() => openLogisticsDrawer()} icon={Truck} /> :
              <div className="grid gap-5 md:grid-cols-2">
                {logisticsRecords.map((l: any) => (
                  <div key={l.id} className="p-6 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg hover:border-primary-navy/20 dark:hover:border-tertiary-sage/20 transition-all group relative shadow-sm hover:shadow-md">
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all">
                       <button onClick={() => openLogisticsDrawer(l)} className="p-2 bg-white dark:bg-navy-800 rounded-md border border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 hover:text-primary-navy dark:hover:text-white shadow-sm"><Edit3 size={16} /></button>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                       <Chip tone="neutral">{l.segmentType === 'domestic' ? '国内运输' : '国际运输'}</Chip>
                       <span className="text-tertiary-sage dark:text-emerald-400 flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider"><div className="h-1.5 w-1.5 rounded-full bg-tertiary-sage dark:bg-emerald-400" /> {l.status === 'arrived' ? '已送达' : '运输中'}</span>
                    </div>
                    <div className="flex flex-col gap-2 mb-5">
                      <div className="flex justify-between items-start gap-3">
                         <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none block mb-1">货运代理</span>
                            <div className="text-[13px] font-bold text-primary-navy dark:text-white truncate">{l.freightForwarder || '直接委托'}</div>
                         </div>
                         <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none block mb-1">实际承运商</span>
                            <div className="text-[13px] font-bold text-primary-navy dark:text-white truncate">{l.carrier}</div>
                         </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">提单/运单号</span>
                        <span className="text-[13px] font-bold text-white bg-slate-900 dark:bg-navy-800 px-3 py-1 rounded-[3px] data-field shadow-md">{l.trackingNo}</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-4 border-t border-slate-50 dark:border-navy-800 flex flex-col gap-2 text-[10px] font-bold text-secondary-slate dark:text-slate-400 uppercase tracking-widest opacity-80">
                      <span>发货日期: {formatDateOnly(l.shippingDate, '待定')}</span>
                      {l.recipientAddress && <div className="truncate font-medium" title={l.recipientAddress}>收货地址: {l.recipientAddress}</div>}
                    </div>
                    {l.attachments && l.attachments.length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {l.attachments.map((att: any) => (
                          <div key={att.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-navy-950 rounded border border-slate-100 dark:border-navy-800 text-primary-navy dark:text-white hover:bg-white dark:hover:bg-navy-800 transition-all shadow-sm">
                             <button onClick={() => setPreviewAttachment(att)} className="flex items-center gap-1.5">
                               <Paperclip size={12} className="text-slate-400 dark:text-slate-600" />
                               <span className="text-[10px] font-bold truncate max-w-[100px]">{att.fileName.split('.')[0]}</span>
                             </button>
                             {user?.role === 'admin' && <button onClick={() => handleDeleteAttachment(att.id)} className="ml-1 text-slate-300 dark:text-slate-700 hover:text-error"><X size={12} /></button>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>}
          </DocumentBoard>
        </div>

        {/* Right Nav Rail */}
        <aside className="hidden xl:block sticky top-0 space-y-4 self-start pt-0">
          <section className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-5 shadow-md transition-colors">
            <div className="text-[13px] font-bold text-primary-navy dark:text-white mb-6 text-center uppercase tracking-widest">页面导航</div>
            <div className="space-y-1.5">
              {[
                { section: 'items', label: '商品明细' },
                { section: 'finance', label: '财务信息' },
                { section: 'production', label: '生产信息' },
                { section: 'customs', label: '报关资料' },
                { section: 'packing', label: '装箱明细' },
                { section: 'logistics', label: '运输轨迹' }
              ].map(item => (
                <button key={item.section} onClick={() => scrollToSection(item.section as any)} className={`flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-left text-[11px] font-bold transition-all uppercase tracking-widest group ${activeSection === item.section ? 'bg-slate-100 dark:bg-navy-800 text-primary-navy dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white'}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${activeSection === item.section ? 'bg-tertiary-sage scale-125' : 'bg-slate-200 dark:bg-navy-700'}`} />{item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-5 shadow-md space-y-3 transition-colors">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-extrabold text-primary-navy dark:text-white uppercase tracking-widest"><StickyNote size={14} className="text-primary-navy dark:text-tertiary-sage" /> 订单快捷备注</div>
                {savingNotes && <div className="h-2 w-2 rounded-full bg-tertiary-sage animate-pulse" />}
             </div>
             <textarea value={quickNotes} onChange={handleNotesChange} placeholder="在此输入灵感、特殊要求或紧急备注，系统将自动保存..." className="w-full bg-slate-50 dark:bg-navy-950 p-3 rounded border border-slate-200 dark:border-navy-800 text-[12px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-navy/40 dark:focus:border-tertiary-sage/40 transition-all min-h-[140px] resize-none leading-relaxed" />
          </section>

          <button onClick={() => setDrawer({ mode: 'ai-analysis' })} disabled={analyzing} className="w-full flex items-center justify-center gap-3 rounded-lg bg-primary-navy dark:bg-tertiary-sage py-4 text-[12px] font-bold text-white hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all shadow-lg group active:scale-95">
             <Sparkles size={18} className={`${analyzing ? 'animate-spin opacity-50' : 'group-hover:scale-110 transition-transform'}`} />
             <span>AI 智能辅助诊断</span>
          </button>
        </aside>
      </div>

      {previewAttachment && <PreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />}
      {toast && (
        <div 
          onMouseEnter={handleToastMouseEnter}
          onMouseLeave={handleToastMouseLeave}
          onClick={() => setToast('')}
          className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[200] flex cursor-pointer items-center rounded-lg bg-slate-900 dark:bg-navy-800 px-8 py-4 text-[13px] font-bold text-white shadow-2xl animate-in fade-in zoom-in slide-in-from-bottom-8 uppercase tracking-widest border border-white/10 dark:border-navy-700 hover:scale-105 transition-transform"
        >
          <CheckCircle2 size={20} className="mr-4 text-emerald-400" />
          {toast}
          <X size={14} className="ml-6 opacity-40 hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Danger Modal: 订单删除二次确认 */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)} />
           <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-navy-900 shadow-2xl border border-red-100 dark:border-red-900/30 animate-in zoom-in duration-300">
              <div className="bg-red-50 dark:bg-red-900/20 px-6 py-4 flex items-center gap-3 border-b border-red-100 dark:border-red-900/30">
                 <AlertTriangle className="text-red-600 dark:text-red-400" size={20} />
                 <h3 className="text-sm font-extrabold text-red-700 dark:text-red-400 uppercase tracking-widest">高危删除确认</h3>
              </div>
              <div className="p-6 space-y-5">
                 <div className="space-y-2">
                    <p className="text-[13px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                        确定要永久删除订单吗？
                        <br/><br/>
                        此操作将同步清除与之关联的所有<span className="text-red-600 font-bold">生产、财务及物流数据</span>，且无法恢复！
                    </p>
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-xl border border-slate-100 dark:border-navy-800">
                       <span className="font-bold text-primary-navy dark:text-white data-field">{order?.display_id}</span>
                       <button onClick={copyOrderId} className="flex items-center gap-1 text-[10px] font-bold text-primary-navy dark:text-tertiary-sage hover:opacity-70 transition-all uppercase tracking-widest">
                          {idCopied ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制单号</>}
                       </button>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">请输入单号以确认删除</label>
                    <input 
                       value={deleteConfirmId}
                       onChange={e => setDeleteConfirmId(e.target.value)}
                       placeholder={`例如: ${order?.display_id}`}
                       className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 px-4 py-3 text-sm font-bold text-primary-navy dark:text-white outline-none focus:border-red-500 transition-all data-field shadow-inner"
                    />
                 </div>
                 <div className="flex gap-3 pt-2">
                    <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 rounded-xl border border-slate-200 dark:border-navy-800 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all uppercase tracking-widest">取消</button>
                    <button 
                       disabled={isDeleting || deleteConfirmId !== order?.display_id}
                       onClick={handleDeleteOrder}
                       className="flex-2 rounded-xl bg-red-600 px-6 py-3 text-xs font-bold text-white shadow-lg hover:bg-red-700 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest"
                    >
                       {isDeleting ? '正在销毁...' : '确认永久删除'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {drawer.mode !== 'closed' && (
        <div className="fixed inset-0 z-[150] flex justify-end">
          <button onClick={closeDrawer} className="absolute inset-0 bg-primary-navy/50 dark:bg-black/60 backdrop-blur-sm transition-all" />
          <div className="relative z-10 h-full w-full max-w-[750px] border-l border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-10 py-8 bg-slate-50 dark:bg-navy-950/50">
              <div className="group cursor-default">
                <h3 className="text-[20px] font-bold text-primary-navy dark:text-white tracking-tight uppercase leading-none">{currentDrawerTitle}</h3>
              </div>
              <button onClick={closeDrawer} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-800 p-2 text-slate-400 hover:text-error hover:border-red-200 dark:hover:border-red-900 transition-all shadow-sm"><X size={26} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); if (drawer.mode === 'order') handleSaveOrder(e); else if (drawer.mode === 'finance') handleSaveFinance(e); else if (drawer.mode === 'production') handleSaveProduction(e); else if (drawer.mode === 'production-log') handleSaveProductionLog(e); else if (drawer.mode === 'customs') handleSaveCustoms(e); else if (drawer.mode === 'packing') handleSavePacking(e); else handleSaveLogistics(e); }} className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-white dark:bg-navy-900">
              {drawerError && <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg text-[13px] font-bold text-error mb-8 flex items-start gap-4 shadow-inner uppercase "><X size={18} className="shrink-0 mt-0.5" /> {drawerError}</div>}
              {drawer.mode === 'order' ? (
                <div className="space-y-12">
                  <section className="grid gap-10 sm:grid-cols-2">
                    <Field label="业务状态"><select value={orderForm.status} onChange={e => setOrderForm({ ...orderForm, status: e.target.value as any })} className="w-full bg-slate-50 dark:bg-navy-950 p-3 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm"><option value="draft">待受理</option><option value="production">生产中</option><option value="customs">报关中</option><option value="shipping">物流中</option><option value="completed">已结清</option></select></Field>
                    <Field label="预期交期"><input type="date" value={orderForm.deliveryDate} onChange={e => setOrderForm({ ...orderForm, deliveryDate: e.target.value })} className="w-full bg-slate-50 dark:bg-navy-950 p-3 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-4">
                      <h4 className="text-[13px] font-bold text-primary-navy dark:text-white uppercase tracking-widest">产品项目清单</h4>
                      <button type="button" onClick={() => setOrderForm({ ...orderForm, items: [...orderForm.items, { clientKey: Math.random().toString(36).slice(2), productName: '', specification: '', hsCode: '', quantity: '1', unit: 'pcs', unitPrice: '0', subtotal: '0', imageUrl: '' }] })} className="text-[11px] font-bold text-white bg-primary-navy dark:bg-tertiary-sage px-5 py-2 rounded-md hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all shadow-md">+ 新增产品</button>
                    </div>
                    <div className="space-y-4">
                      {orderForm.items.length === 0 && <div className="py-16 text-center border border-dashed border-slate-300 dark:border-navy-800 rounded-xl text-slate-400 text-[11px] font-bold uppercase tracking-widest">点击上方按钮添加产品明细</div>}
                      {orderForm.items.map((item, idx) => (
                        <div key={item.clientKey} className="relative p-5 bg-slate-50 dark:bg-navy-950/50 rounded-xl border border-slate-200 dark:border-navy-800 group hover:bg-white dark:hover:bg-navy-800 hover:border-primary-navy/30 dark:hover:border-tertiary-sage/30 transition-all shadow-sm">
                          <button type="button" onClick={() => { if (item.id) setDeletedItemIds([...deletedItemIds, item.id]); setOrderForm({ ...orderForm, items: orderForm.items.filter((_, i) => i !== idx) }); }} className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-error text-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-10"><Trash size={12} /></button>
                          <div className="grid gap-5 sm:grid-cols-12">
                            <div className="sm:col-span-12"><Field label="产品名称/型号 *"><input required value={item.productName} onChange={e => { const next = [...orderForm.items]; next[idx].productName = e.target.value; setOrderForm({ ...orderForm, items: next }); }} placeholder="输入正式商业发票名称..." className="w-full bg-transparent p-1 text-[15px] font-bold text-primary-navy dark:text-white focus:outline-none border-b-2 border-slate-200 dark:border-navy-800 focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors" /></Field></div>
                            <div className="sm:col-span-4"><Field label="配置规格"><input value={item.specification} onChange={e => { const next = [...orderForm.items]; next[idx].specification = e.target.value; setOrderForm({ ...orderForm, items: next }); }} placeholder="标准规格..." className="w-full bg-transparent p-1 text-[13px] font-bold text-secondary-slate dark:text-slate-400 focus:outline-none" /></Field></div>
                            <div className="sm:col-span-4"><Field label="海关编码 (HS)"><input value={item.hsCode} onChange={e => { const next = [...orderForm.items]; next[idx].hsCode = e.target.value; setOrderForm({ ...orderForm, items: next }); }} placeholder="可选填..." className="w-full bg-transparent p-1 text-[13px] font-bold text-secondary-slate dark:text-slate-400 focus:outline-none data-field" /></Field></div>
                            <div className="sm:col-span-4"><Field label="单位"><select value={item.unit} onChange={e => { const next = [...orderForm.items]; next[idx].unit = e.target.value; setOrderForm({ ...orderForm, items: next }); }} className="w-full bg-transparent p-1 text-[13px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none cursor-pointer"><option value="pcs">pcs (件)</option><option value="sets">sets (套)</option><option value="kg">kg (公斤)</option><option value="m">m (米)</option><option value="rolls">rolls (卷)</option></select></Field></div>
                            <div className="sm:col-span-4"><Field label="单价 (USD)"><input type="number" step="0.0001" value={item.unitPrice} onChange={e => { const next = [...orderForm.items]; next[idx].unitPrice = e.target.value; next[idx].subtotal = String(asNumber(e.target.value) * asNumber(next[idx].quantity)); setOrderForm({ ...orderForm, items: next }); }} className="w-full bg-transparent p-1 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none data-field border-b border-slate-100 dark:border-navy-800" /></Field></div>
                            <div className="sm:col-span-4"><Field label="数量"><input type="number" value={item.quantity} onChange={e => { const next = [...orderForm.items]; next[idx].quantity = e.target.value; next[idx].subtotal = String(asNumber(e.target.value) * asNumber(next[idx].unitPrice)); setOrderForm({ ...orderForm, items: next }); }} className="w-full bg-transparent p-1 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none data-field border-b border-slate-100 dark:border-navy-800 text-center" /></Field></div>
                            <div className="sm:col-span-4 flex flex-col justify-end items-end"><div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Row Total</div><div className="text-[18px] font-extrabold text-primary-navy dark:text-tertiary-sage data-field leading-none">USD {asNumber(item.subtotal).toLocaleString()}</div></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-8">
                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-navy-800 pb-4"><h4 className="text-[13px] font-bold text-primary-navy dark:text-white uppercase tracking-widest">财务补差与运杂费</h4></div>
                    <div className="grid gap-12 sm:grid-cols-2">
                      <Field label="预估出口运费 (USD)"><input type="number" value={orderForm.freightAmount} onChange={e => setOrderForm({ ...orderForm, freightAmount: e.target.value })} className="w-full bg-transparent p-2 text-lg font-bold text-primary-navy dark:text-white focus:outline-none border-b-2 border-slate-200 dark:border-navy-800 focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors data-field" /></Field>
                      <Field label="其他税杂补差 (USD)"><input type="number" value={orderForm.miscAmount} onChange={e => setOrderForm({ ...orderForm, miscAmount: e.target.value })} className="w-full bg-transparent p-2 text-lg font-bold text-primary-navy dark:text-white focus:outline-none border-b-2 border-slate-200 dark:border-navy-800 focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors data-field" /></Field>
                    </div>
                    <Field label="内部核心指令与备注"><textarea rows={6} value={orderForm.details} onChange={e => setOrderForm({ ...orderForm, details: e.target.value })} placeholder="输入包装协议、客户强制性要求、业务风险点等重要备注..." className="w-full bg-slate-50 dark:bg-navy-950 p-4 rounded-xl text-[14px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed focus:outline-none border border-slate-200 dark:border-navy-800 shadow-inner" /></Field>
                  </section>
                </div>
              ) : drawer.mode === 'production-log' ? (
                <div className="space-y-10">
                   <div className="p-8 bg-slate-50 dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-navy-800 flex gap-6 shadow-inner">
                     <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-navy dark:bg-tertiary-sage text-white shadow-lg"><Clock size={28} /></div>
                     <div className="space-y-2 pt-1"><h5 className="text-[16px] font-bold text-primary-navy dark:text-white uppercase tracking-tight">记录生产进度更新</h5><p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">实时同步制造链路数据，确保持续的可追溯性。</p></div>
                   </div>
                   <div className="grid gap-10 sm:grid-cols-2">
                     <Field label="生产记录日期"><input type="date" value={productionLogForm.logDate} onChange={e => setProductionLogForm({ ...productionLogForm, logDate: e.target.value })} className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
                   </div>
                   <Field label="进度情况详细描述 *"><textarea rows={8} value={productionLogForm.content} onChange={e => setProductionLogForm({ ...productionLogForm, content: e.target.value })} placeholder="例如：车间 B 报线，主控板已完成 80% 贴片工作，预计明天下午进入组装环节..." className="w-full bg-slate-50 dark:bg-navy-950 p-5 rounded-2xl text-[15px] font-bold text-primary-navy dark:text-white leading-relaxed focus:outline-none border border-slate-200 dark:border-navy-800 shadow-inner" /></Field>
                   <div className="pt-8 border-t border-slate-100 dark:border-navy-800"><AttachmentEditor title="现场照片或测试报告附件" attachments={productionLogForm.attachments} newFiles={productionLogForm.newFiles} onFilesSelected={fs=>setProductionLogForm({...productionLogForm, newFiles:[...productionLogForm.newFiles,...fs]})} onRemoveExisting={id=>setProductionLogForm({...productionLogForm, attachments:productionLogForm.attachments.filter(a=>a.id!==id)})} onRemovePending={idx=>setProductionLogForm({...productionLogForm, newFiles:productionLogForm.newFiles.filter((_,i)=>i!==idx)})} isUploading={isUploading} uploadProgress={uploadProgress} /></div>
                </div>
              ) : drawer.mode === 'customs' ? (
                <div className="space-y-10">
                   <div className="grid gap-8 sm:grid-cols-2">
                     <Field label="正式报关单号"><input value={customsForm.declarationNo} onChange={e=>setCustomsForm({...customsForm, declarationNo:e.target.value})} placeholder="输入 18 位海关报关单号..." className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm data-field" /></Field>
                     <Field label="贸易方式分类"><select value={customsForm.tradeMode} onChange={e=>setCustomsForm({...customsForm, tradeMode:e.target.value})} className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm cursor-pointer"><option value="一般贸易">一般贸易 (0110)</option><option value="进料加工">进料加工 (0615)</option><option value="来料加工">来料加工 (0214)</option><option value="其他">其他类型</option></select></Field>
                     <Field label="海关清关日期"><input type="date" value={customsForm.declarationDate} onChange={e=>setCustomsForm({...customsForm, declarationDate:e.target.value})} className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
                     <Field label="预计离港/出口日期"><input type="date" value={customsForm.releaseDate} onChange={e=>setCustomsForm({...customsForm, releaseDate:e.target.value})} className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
                   </div>
                   <div className="pt-8 border-t border-slate-100 dark:border-navy-800"><AttachmentEditor title="扫描件存档 (发票/装箱单/报关单)" attachments={customsForm.attachments} newFiles={customsForm.newFiles} onFilesSelected={fs=>setCustomsForm({...customsForm, newFiles:[...customsForm.newFiles,...fs]})} onRemoveExisting={id=>setCustomsForm({...customsForm, attachments:customsForm.attachments.filter(a=>a.id!==id)})} onRemovePending={idx=>setCustomsForm({...customsForm, newFiles:customsForm.newFiles.filter((_,i)=>i!==idx)})} isUploading={isUploading} uploadProgress={uploadProgress} /></div>
                </div>
              ) : drawer.mode === 'packing' ? (
                <div className="space-y-8">
                   <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-5">
                      <div className="space-y-1"><h4 className="text-[16px] font-extrabold text-primary-navy dark:text-white uppercase tracking-tight">装箱明细数据维护</h4><p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">维护物理包装参数，支持一单多规格录入。</p></div>
                      <button type="button" onClick={() => setPackingForm({ items: [...packingForm.items, { clientKey: Math.random().toString(36).slice(2), packageCount: '1', packageSize: '', grossWeight: '', netWeight: '' }] })} className="text-[11px] font-bold text-white bg-primary-navy dark:bg-tertiary-sage px-6 py-2.5 rounded-lg hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all shadow-md">+ 新增包装组</button>
                   </div>
                   <div className="space-y-5">
                      {packingForm.items.length === 0 && <div className="py-20 text-center border border-dashed border-slate-200 dark:border-navy-800 rounded-2xl text-slate-400 font-bold uppercase tracking-widest">尚未添加任何装箱组</div>}
                      {packingForm.items.map((item, idx) => (
                        <div key={item.clientKey} className="relative p-6 bg-slate-50 dark:bg-navy-950/50 rounded-2xl border border-slate-200 dark:border-navy-800 group shadow-inner">
                           <button type="button" onClick={() => setPackingForm({ items: packingForm.items.filter((_, i) => i !== idx) })} className="absolute -right-2.5 -top-2.5 h-8 w-8 rounded-full bg-error text-white shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-30 hover:scale-110"><Trash size={14} /></button>
                           <div className="grid gap-6 sm:grid-cols-4 items-end">
                              <div className="sm:col-span-3">
                                 <div className="grid gap-4 grid-cols-4 font-bold">
                                    <Field label="件数 (箱)"><input type="number" value={item.packageCount} onChange={e => { const next = [...packingForm.items]; next[idx].packageCount = e.target.value; setPackingForm({ items: next }); }} className="w-full bg-white dark:bg-navy-950 p-2.5 rounded-lg border border-slate-200 dark:border-navy-800 outline-none data-field text-primary-navy dark:text-white" /></Field>
                                    <Field label="尺寸 (L*W*H)"><input value={item.packageSize} onChange={e => { const next = [...packingForm.items]; next[idx].packageSize = e.target.value; setPackingForm({ items: next }); }} placeholder="120x100x80" className="w-full bg-white dark:bg-navy-950 p-2.5 rounded-lg border border-slate-200 dark:border-navy-800 outline-none data-field text-primary-navy dark:text-white" /></Field>
                                    <Field label="毛重 (kg)"><input value={item.grossWeight} onChange={e => { const next = [...packingForm.items]; next[idx].grossWeight = e.target.value; setPackingForm({ items: next }); }} className="w-full bg-white dark:bg-navy-950 p-2.5 rounded-lg border border-slate-200 dark:border-navy-800 outline-none data-field text-primary-navy dark:text-white" /></Field>
                                    <Field label="净重 (kg)"><input value={item.netWeight} onChange={e => { const next = [...packingForm.items]; next[idx].netWeight = e.target.value; setPackingForm({ items: next }); }} className="w-full bg-white dark:bg-navy-950 p-2.5 rounded-lg border border-slate-200 dark:border-navy-800 outline-none data-field text-primary-navy dark:text-white" /></Field>
                                 </div>
                              </div>
                              <div className="flex flex-col items-center gap-2">
                                 <label className="h-14 w-14 rounded-xl border-2 border-dashed border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 flex items-center justify-center cursor-pointer hover:border-primary-navy dark:hover:border-tertiary-sage hover:bg-slate-50 transition-all overflow-hidden shadow-sm">
                                    {item.imageUrl ? <img src={item.imageUrl} className="h-full w-full object-cover" /> : <Upload size={20} className="text-slate-200 dark:text-navy-800" />}
                                    <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleUploadPackingPhoto(idx, e.target.files[0])} />
                                 </label>
                                 <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">箱体实拍</span>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              ) : drawer.mode === 'logistics' ? (
                <div className="space-y-10">
                   <div className="flex gap-4 p-1.5 bg-slate-100 dark:bg-navy-950 rounded-xl">
                      <button type="button" onClick={()=>setLogisticsForm({...logisticsForm, segmentType:'domestic'})} className={`flex-1 py-3 text-[13px] font-bold rounded-lg transition-all ${logisticsForm.segmentType==='domestic'?'bg-white dark:bg-navy-800 text-primary-navy dark:text-white shadow-md':'text-slate-500 dark:text-slate-400 hover:text-primary-navy dark:hover:text-white'}`}>国内运输轨迹</button>
                      <button type="button" onClick={()=>setLogisticsForm({...logisticsForm, segmentType:'international'})} className={`flex-1 py-3 text-[13px] font-bold rounded-lg transition-all ${logisticsForm.segmentType==='international'?'bg-white dark:bg-navy-800 text-primary-navy dark:text-white shadow-md':'text-slate-500 dark:text-slate-400 hover:text-primary-navy dark:hover:text-white'}`}>国际/主线轨迹</button>
                   </div>
                   <div className="grid gap-10 sm:grid-cols-2">
                     <Field label="货运代理 (Freight Forwarder)"><input value={logisticsForm.freightForwarder} onChange={e=>setLogisticsForm({...logisticsForm, freightForwarder:e.target.value})} placeholder="记录委托的货代公司..." className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
                     <Field label="实际承运商 (Actual Carrier)"><input required value={logisticsForm.carrier} onChange={e=>setLogisticsForm({...logisticsForm, carrier:e.target.value})} placeholder="例如: 顺丰 / 马士基 / DHL..." className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
                     <Field label="主运单/提单识别码 *"><input required value={logisticsForm.trackingNo} onChange={e=>setLogisticsForm({...logisticsForm, trackingNo:e.target.value})} placeholder="请输入单号..." className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm data-field" /></Field>
                     <Field label={logisticsForm.segmentType === 'domestic' ? '实际发货日期' : '预计离港日期'}><input type="date" value={logisticsForm.shippingDate} onChange={e=>setLogisticsForm({...logisticsForm, shippingDate:e.target.value})} className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
                     <Field label="当前物流节点状态"><select value={logisticsForm.status} onChange={e=>setLogisticsForm({...logisticsForm, status:e.target.value as any})} className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm cursor-pointer"><option value="preparing">01. 待起运 (Pre-shipment)</option><option value="shipped">02. 运输中 (In-transit)</option><option value="arrived">03. 已妥投 (Delivered)</option></select></Field>
                     {logisticsForm.segmentType === 'domestic' && <div className="sm:col-span-2"><Field label="最终收货/卸货地址 *"><textarea rows={3} value={logisticsForm.recipientAddress} onChange={e=>setLogisticsForm({...logisticsForm, recipientAddress:e.target.value})} className="w-full bg-white dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm leading-relaxed" /></Field></div>}
                   </div>
                   <div className="pt-8 border-t border-slate-100 dark:border-navy-800"><AttachmentEditor title="运单扫描件或签收单存档" attachments={logisticsForm.attachments} newFiles={logisticsForm.newFiles} onFilesSelected={fs=>setLogisticsForm({...logisticsForm, newFiles:[...logisticsForm.newFiles,...fs]})} onRemoveExisting={id=>setLogisticsForm({...logisticsForm, attachments:logisticsForm.attachments.filter(a=>a.id!==id)})} onRemovePending={idx=>setLogisticsForm({...logisticsForm, newFiles:logisticsForm.newFiles.filter((_,i)=>i!==idx)})} isUploading={isUploading} uploadProgress={uploadProgress} /></div>
                </div>
              ) : drawer.mode === 'finance' ? (
                <div className="space-y-12">
                  <div className="grid gap-12 sm:grid-cols-2">
                    <Field label="资产流转方向"><select value={financeForm.type} onChange={e=>setFinanceForm({...financeForm, type:e.target.value as any})} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm"><option value="receipt">资产流入 (收款)</option><option value="payment">资产流出 (付款)</option></select></Field>
                    <div className="flex gap-4 items-end">
                      <div className="w-24"><Field label="币种"><select value={financeForm.currency} onChange={e=>setFinanceForm({...financeForm, currency:e.target.value})} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm"><option value="USD">USD</option><option value="CNY">CNY</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="HKD">HKD</option></select></Field></div>
                      <div className="flex-1"><Field label="计价金额"><input type="number" step="0.01" value={financeForm.amount} onChange={e=>setFinanceForm({...financeForm, amount:e.target.value})} className="w-full bg-transparent p-2 text-[32px] font-bold text-primary-navy dark:text-white data-field focus:outline-none border-b-2 border-slate-200 dark:border-navy-800 focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors" /></Field></div>
                    </div>
                  </div>
                  <div className="grid gap-12 sm:grid-cols-2">
                    <Field label="账务核销状态"><select value={financeForm.status} onChange={e=>setFinanceForm({...financeForm, status:e.target.value as any})} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm"><option value="completed">已核销同步 (Closed)</option><option value="pending">待处理流水 (Pending)</option></select></Field>
                    <Field label="款项所属分类"><select value={financeForm.recordCategory} onChange={e=>setFinanceForm({...financeForm, recordCategory:e.target.value as any})} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm"><option value="deposit">预付定金</option><option value="balance">最后尾款</option><option value="goods">主营货款</option><option value="freight">国际运费</option><option value="customs">报关税费</option><option value="other">杂项其他</option></select></Field>
                  </div>
                  <div className="pt-8 border-t border-slate-100 dark:border-navy-800"><AttachmentEditor title="银行水单或支付凭证存档" attachments={financeForm.attachments} newFiles={financeForm.newFiles} onFilesSelected={fs=>setFinanceForm({...financeForm, newFiles:[...financeForm.newFiles,...fs]})} onRemoveExisting={id=>setFinanceForm({...financeForm, attachments:financeForm.attachments.filter(a=>a.id!==id)})} onRemovePending={idx=>setFinanceForm({...financeForm, newFiles:financeForm.newFiles.filter((_,i)=>i!==idx)})} isUploading={isUploading} uploadProgress={uploadProgress} /></div>
                </div>
              ) : drawer.mode === 'production' ? (
                <div className="space-y-16">
                   <div className="grid gap-12 sm:grid-cols-2">
                     <Field label="指派制造供应商"><select value={productionForm.partnerId} onChange={e=>setProductionForm({...productionForm, partnerId:e.target.value})} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm"><option value="">请选择合作厂商...</option>{productionPartners.map(p=><option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}</select></Field>
                     <Field label="实时生产节点状态"><select value={productionForm.productionStatus} onChange={e=>setProductionForm({...productionForm, productionStatus:e.target.value as any})} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm"><option value="not_started">待生产</option><option value="scheduled">已排产</option><option value="in_progress">生产中</option><option value="ready">已完工</option></select></Field>
                     <Field label="指令下达日期"><input type="date" value={productionForm.orderDate} onChange={e => setProductionForm({ ...productionForm, orderDate: e.target.value })} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white data-field focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
                     <Field label="合约预期交期"><input type="date" value={productionForm.estimatedDeliveryDate} onChange={e => setProductionForm({ ...productionForm, estimatedDeliveryDate: e.target.value })} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white data-field focus:outline-none rounded-xl border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
                   </div>
                </div>
              ) : (
                 <div className="space-y-12">
                    {analyzing ? <div className="text-center py-48 flex flex-col items-center animate-in fade-in"><div className="h-16 w-16 border-[8px] border-slate-100 dark:border-navy-800 border-t-primary-navy dark:border-t-tertiary-sage rounded-full animate-spin mb-10 shadow-md" /><span className="text-[12px] font-extrabold text-primary-navy dark:text-tertiary-sage uppercase tracking-[0.8em] animate-pulse">核心引擎诊断中...</span></div> :
                    aiResult && <div className="space-y-12 animate-in fade-in duration-1000">
                      <div className="p-10 bg-primary-navy dark:bg-navy-950 rounded-2xl text-white flex items-center justify-between shadow-2xl relative overflow-hidden"><div className="absolute top-0 right-0 h-96 w-96 bg-white/5 rounded-full blur-[100px] -translate-y-48 translate-x-32" /><div><h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.6em] mb-4 opacity-70">Consolidated Risk Score</h4><p className="text-xl font-bold text-slate-300 uppercase tracking-[0.4em]">健康评估分值</p></div><div className={`text-[110px] font-extrabold italic tracking-tighter leading-none pr-6 data-field ${aiResult.score>=80?'text-success':aiResult.score>=60?'text-warning':'text-error'}`}>{aiResult.score}</div></div>
                      <div className="p-12 bg-slate-50 dark:bg-navy-950/50 border-l-[12px] border-l-tertiary-sage rounded-r-2xl text-primary-navy dark:text-white font-bold text-[24px] leading-snug shadow-inner tracking-tighter uppercase">"{aiResult.summary}"</div>
                      <section className="space-y-10 px-2">
                         <div className="flex items-center gap-5 px-4"><div className="h-6 w-1.5 rounded-full bg-error" /><h5 className="text-[14px] font-extrabold text-primary-navy dark:text-white uppercase tracking-[0.5em]">识别到的关键异常与偏差</h5></div>
                         <div className="space-y-8">
                           {aiResult.risks.map((r, i) => <div key={i} className="p-10 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-2xl text-[18px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed shadow-md border-l-[20px] border-l-error/20 hover:border-l-error transition-all duration-300">"{r.content}"</div>)}
                         </div>
                      </section>
                    </div>}
                 </div>
              )}

              <div className="flex gap-6 pt-16 sticky bottom-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-2xl pb-12 z-[40] border-t border-slate-100 dark:border-navy-800">
                <button type="button" onClick={closeDrawer} className="flex-1 rounded-xl border-2 border-slate-200 dark:border-navy-800 py-5 text-[12px] font-extrabold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all uppercase tracking-[0.5em] shadow-sm">放弃修改</button>
                <button type="submit" disabled={saving} className="flex-[3] rounded-xl bg-primary-navy dark:bg-tertiary-sage py-5 text-base font-extrabold text-white shadow-2xl hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all uppercase tracking-[0.5em] active:scale-95 disabled:opacity-50">{saving ? '同步同步中...' : '确认并同步数据'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
