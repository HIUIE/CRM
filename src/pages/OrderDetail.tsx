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
  StickyNote
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
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
  const sectionRefs: Record<SectionKey, React.RefObject<HTMLDivElement | null>> = {
    basic: useRef(null),
    todos: useRef(null),
    items: useRef(null),
    finance: useRef(null),
    production: useRef(null),
    customs: useRef(null),
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

  const orderTotal = asNumber(order?.total_amount);
  const freightAmount = asNumber(order?.freightAmount);
  const miscAmount = asNumber(order?.miscAmount);
  const grandTotal = orderTotal + freightAmount + miscAmount;

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
      case 'packing': return '装箱与包装数据';
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

  const saveQuickNotes = async (val: string) => {
    setQuickNotes(val);
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
  const scrollToSection = (section: SectionKey) => {
    const ref = sectionRefs[section];
    if (ref?.current) {
      const top = ref.current.getBoundingClientRect().top + window.pageYOffset - 16;
      window.scrollTo({ top, behavior: 'smooth' });
      setActiveSection(section);
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
      setToast('同步成功'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); } finally { setSaving(false); }
  };

  const handleSaveFinance = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData(); financeForm.newFiles.forEach(f => fd.append('files', f));
      const newAtts = financeForm.newFiles.length ? await apiFetch<AttachmentMeta[]>('/api/attachments', { method: 'POST', body: fd }) : [];
      const payload = { ...financeForm, orderId: Number(order?.id), amount: Number(financeForm.amount), partnerId: Number(financeForm.partnerId) || null, attachmentIds: [...financeForm.attachments.map(a => a.id), ...newAtts.map(a => a.id)] };
      const url = financeForm.id ? `/api/finance/${financeForm.id}` : `/api/finance`;
      await apiFetch(url, { method: financeForm.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setToast('同步成功'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); } finally { setSaving(false); }
  };

  const handleSaveProduction = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...productionForm, orderId: Number(order?.id), partnerId: Number(productionForm.partnerId) };
      const url = productionForm.id ? `/api/orders/production/${productionForm.id}` : `/api/orders/${order?.id}/production`;
      await apiFetch(url, { method: productionForm.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setToast('同步成功'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); } finally { setSaving(false); }
  };

  const handleSaveProductionLog = async (e: React.FormEvent) => {
    e.preventDefault(); if (!productionLogForm.content.trim()) return; setSaving(true);
    try {
      const fd = new FormData(); 
      fd.append('customerId', String(customer.id));
      fd.append('orderId', String(order?.id));
      productionLogForm.newFiles.forEach(f => fd.append('files', f));
      const newAtts = productionLogForm.newFiles.length ? await apiFetch<AttachmentMeta[]>('/api/attachments', { method: 'POST', body: fd }) : [];
      const payload = { ...productionLogForm, attachmentIds: [...productionLogForm.attachments.map(a => a.id), ...newAtts.map(a => a.id)] };
      await apiFetch(`/api/orders/production/${productionPlan?.id}/logs`, { method: 'POST', body: JSON.stringify(payload) });
      setToast('进度已记录'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '提交失败')); } finally { setSaving(false); }
  };

  const handleSaveCustoms = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData(); 
      fd.append('customerId', String(customer.id));
      fd.append('orderId', String(order?.id));
      customsForm.newFiles.forEach(f => fd.append('files', f));
      const newAtts = customsForm.newFiles.length ? await apiFetch<AttachmentMeta[]>('/api/attachments', { method: 'POST', body: fd }) : [];
      const payload = { ...customsForm, orderId: Number(order?.id), attachmentIds: [...customsForm.attachments.map(a => a.id), ...newAtts.map(a => a.id)] };
      const url = customsForm.id ? `/api/customs/${customsForm.id}` : `/api/orders/${order?.id}/customs`;
      await apiFetch(url, { method: customsForm.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setToast('同步成功'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); } finally { setSaving(false); }
  };

  const handleSaveLogistics = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData(); 
      fd.append('customerId', String(customer.id));
      fd.append('orderId', String(order?.id));
      logisticsForm.newFiles.forEach(f => fd.append('files', f));
      const newAtts = logisticsForm.newFiles.length ? await apiFetch<AttachmentMeta[]>('/api/attachments', { method: 'POST', body: fd }) : [];
      const payload = { ...logisticsForm, orderId: Number(order?.id), attachmentIds: [...logisticsForm.attachments.map(a => a.id), ...newAtts.map(a => a.id)] };
      const url = logisticsForm.id ? `/api/logistics/${logisticsForm.id}` : `/api/logistics`;
      await apiFetch(url, { method: logisticsForm.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setToast('同步成功'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); } finally { setSaving(false); }
  };

  const handleSavePacking = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch(`/api/orders/${order?.id}/packing`, { method: 'PATCH', body: JSON.stringify(packingForm) });
      setToast('装箱数据已更新'); closeDrawer(); await loadDetail({ showLoading: false });
    } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); } finally { setSaving(false); }
  };

  const handleUploadPackingPhoto = async (idx: number, file: File) => {
     setSaving(true);
     try {
       const fd = new FormData();
       fd.append('customerId', String(customer.id));
       fd.append('orderId', String(order?.id));
       fd.append('files', file);
       const [att] = await apiFetch<AttachmentMeta[]>('/api/attachments', { method: 'POST', body: fd });
       const next = [...packingForm.items];
       next[idx].attachmentId = att.id;
       next[idx].imageUrl = att.url;
       setPackingForm({ items: next });
     } catch (err) { setDrawerError('图片上传失败'); }
     finally { setSaving(false); }
  };

  const handleDeleteAttachment = async (id: number) => {
    if (!confirm('确认彻底删除此附件？')) return;
    try {
       await apiFetch(`/api/attachments/${id}`, { method: 'DELETE' });
       setToast('文件已移除');
       await loadDetail({ showLoading: false });
    } catch (err) { alert(getErrorMessage(err, '删除失败')); }
  };

  // 6. View Helpers
  if (loading) return <div className="p-12 text-secondary-slate animate-pulse font-medium">正在加载数据...</div>;
  if (error || !detail || !order) return <div className="p-8 text-error font-bold bg-white border border-[#E2E8F0] m-6 rounded-lg shadow-sm">加载失败: {error}</div>;

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_200px] items-start">
        <div className="space-y-4 min-w-0">
          {/* header Section */}
          <header ref={sectionRefs.basic} className="bg-white border border-[#E2E8F0] rounded-lg p-5 shadow-sm">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between border-b border-[#F1F5F9] pb-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2 text-[11px] font-bold text-secondary-slate uppercase tracking-widest leading-none">
                    <button onClick={() => navigate('/orders')} className="hover:text-primary-navy">订单列表</button>
                    <ChevronRight size={12} className="opacity-30" />
                    <span className="text-primary-navy">{order.display_id}</span>
                  </div>
                  <h1 className="text-2xl font-bold text-primary-navy tracking-tight truncate mb-4">{asText(order.product_summary, '未命名订单')}</h1>
                  <div className="flex flex-wrap gap-4 text-[11px] font-medium text-secondary-slate uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><MapPin size={12} className="text-tertiary-sage" />{asText(customer.country)}</span>
                    <span className="flex items-center gap-1.5"><Mail size={12} className="text-info" />{asText(customer.contact)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                   <ActionButton onClick={openOrderDrawer} icon={<Edit3 size={14} />}>编辑订单</ActionButton>
                   <LightActionButton onClick={() => openFinanceDrawer()}><Wallet size={14} className="mr-1 opacity-70" /> 录入收支</LightActionButton>
                   <LightActionButton onClick={openProductionDrawer}><Factory size={14} className="mr-1 opacity-70" /> 同步生产</LightActionButton>
                   <LightActionButton onClick={openCustomsDrawer}><ShieldCheck size={14} className="mr-1 opacity-70" /> 更新报关</LightActionButton>
                   <LightActionButton onClick={() => openLogisticsDrawer()}><Plus size={14} className="mr-1 opacity-70" /> 新建物流</LightActionButton>
                </div>
              </div>

              <div className="rounded-md bg-[#F8FAFC] border border-[#F1F5F9] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {STAGE_STEPS.map((s, i) => (
                    <button key={s.key} onClick={() => scrollToSection(s.target)} className={`flex-1 min-w-[130px] flex items-center gap-3 px-4 py-2 rounded transition-all ${s.key === order.status ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'opacity-40 hover:opacity-100'}`}>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i <= stageIndex ? 'bg-primary-navy text-white' : 'bg-slate-200 text-slate-500'}`}>{i + 1}</span>
                      <span className={`text-[11px] font-bold uppercase tracking-widest ${s.key === order.status ? 'text-primary-navy' : 'text-secondary-slate'}`}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </header>

          {/* Manifest Table */}
          <WorkSection ref={sectionRefs.items} section="items" title="订单明细" icon={<FileText size={16} />} collapsed={collapsed.items} onToggle={() => toggleSection('items')} action={<LightActionButton onClick={openOrderDrawer} className="!text-[10px] !px-3"><Plus size={12} className="mr-1" /> 编辑清单</LightActionButton>}>
            <div className="overflow-hidden rounded border border-[#E2E8F0] bg-white">
              <table className="min-w-full text-left text-xs font-medium">
                <thead className="bg-[#F8FAFC] text-secondary-slate font-bold uppercase tracking-widest border-b border-[#E2E8F0] data-field text-[10px]">
                  <tr><th className="px-5 py-3">商品名称与标识</th><th className="px-5 py-3 text-center">配置规格</th><th className="px-5 py-3 text-center">数量</th><th className="px-5 py-3 text-right">单价 (USD)</th><th className="px-5 py-3 text-right">金额 (USD)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium tracking-tight">
                {items.length ? items.map(item => (
                  <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-5 py-4 flex items-center gap-4 font-bold text-primary-navy uppercase">{asText(item.product_name)}</td>
                    <td className="px-5 py-4 text-center text-secondary-slate text-[10px] data-field uppercase opacity-60">{asText(item.specification, 'GENERIC')}</td>
                    <td className="px-5 py-4 text-center font-bold data-field">{item.quantity} {item.unit || 'pcs'}</td>
                    <td className="px-5 py-4 text-right text-slate-400 data-field opacity-80">{asNumber(item.unit_price).toLocaleString()}</td>
                    <td className="px-5 py-4 text-right font-bold text-primary-navy data-field text-[14px]">USD {asNumber(item.subtotal).toLocaleString()}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-300 uppercase tracking-widest font-bold">待初始化货物数据</td></tr>}
              </tbody>
              <tfoot className="bg-[#F1F5F9] text-primary-navy font-bold border-t border-[#E2E8F0]">
                <tr><td colSpan={4} className="px-5 py-4 text-right text-[10px] uppercase tracking-widest opacity-60">合计总值 (估算)</td><td className="px-5 py-4 text-right text-[18px] data-field">USD {grandTotal.toLocaleString()}</td></tr>
              </tfoot></table>
            </div>
            {order.details && (
              <div className="mt-4 p-4 bg-[#F8FAFC] rounded border border-slate-100 flex items-start gap-3">
                 <div className="h-4 w-0.5 bg-primary-navy opacity-20 mt-1" />
                 <p className="text-[13px] font-medium text-primary-navy/70 leading-relaxed uppercase tracking-tight">"{order.details}"</p>
              </div>
            )}
          </WorkSection>

          {/* Finance Section */}
          <DocumentBoard ref={sectionRefs.finance} title="财务信息" action={<div className="flex bg-white p-0.5 rounded border border-slate-200"><FilterPill active={financeFilter==='all'} onClick={()=>setFinanceFilter('all')}>全部</FilterPill><FilterPill active={financeFilter==='receipt'} onClick={()=>setFinanceFilter('receipt')}>收款</FilterPill><FilterPill active={financeFilter==='payment'} onClick={()=>setFinanceFilter('payment')}>付款</FilterPill></div>}>
            <FinanceDashboard totalAmount={orderTotal} records={filteredFinanceRecords} receiptsByCurrency={summary.receiptsByCurrency} onPreview={setPreviewAttachment} onEdit={openFinanceDrawer} onDelete={(r) => { if(confirm('确认删除？')) apiFetch(`/api/finance/${r.id}`,{method:'DELETE'}).then(()=>loadDetail({showLoading:false})) }} />
          </DocumentBoard>

          {/* Production Section */}
          <DocumentBoard ref={sectionRefs.production} title="生产信息">
            <ProductionDashboard plan={productionPlan} onEditLink={openProductionDrawer} onUploadPlan={openProductionDrawer} onAddLog={() => openProductionLogDrawer()} />
          </DocumentBoard>

          {/* Packing Section */}
          <DocumentBoard ref={sectionRefs.logistics} title="装箱明细" action={<LightActionButton onClick={openPackingDrawer}><Box size={14} className="mr-1 opacity-70" /> 更新装箱数据</LightActionButton>}>
            {packingRecords.length ? (
               <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                 {packingRecords.map((r, i) => (
                   <div key={r.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between group hover:bg-white hover:border-primary-navy/20 transition-all">
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Item {String(i + 1).padStart(2, '0')}</div>
                        <div className="text-[13px] font-bold text-primary-navy">{r.packageCount} CTNS</div>
                        <div className="text-[10px] font-medium text-secondary-slate truncate mt-0.5">{r.packageSize} | {r.grossWeight}kg</div>
                      </div>
                      <div className="h-12 w-12 rounded border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm cursor-pointer" onClick={() => r.imageUrl && setPreviewAttachment({ id: -1, fileName: 'PACKING_PHOTO', url: r.imageUrl })}>
                         {r.imageUrl ? <img src={r.imageUrl} className="h-full w-full object-cover" /> : <Box size={20} className="text-slate-100" />}
                      </div>
                   </div>
                 ))}
               </div>
            ) : <div className="py-8 text-center bg-slate-50/50 rounded border border-dashed border-slate-200 text-slate-200 text-[10px] font-bold uppercase">NO_PACKING_DATA</div>}
          </DocumentBoard>

          {/* Logistics Section */}
          <DocumentBoard ref={sectionRefs.logistics} title="运输轨迹" action={<LightActionButton onClick={() => openLogisticsDrawer()}><Plus size={14} className="mr-1 opacity-70" /> 录入运单</LightActionButton>}>
            {!hasAnyLogistics ? <EmptyStateBoard title="等待货件发运" description="当前订单尚未关联物流记录，请在发货后及时同步单号。" actionLabel="录入物流单号" onAction={() => openLogisticsDrawer()} /> :
              <div className="grid gap-4 md:grid-cols-2">
                {logisticsRecords.map((l: any) => (
                  <div key={l.id} className="p-6 bg-white border border-[#E2E8F0] rounded-lg hover:border-slate-300 transition-all group relative">
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all">
                       <button onClick={() => openLogisticsDrawer(l)} className="p-1.5 text-secondary-slate hover:text-primary-navy"><Edit3 size={16} /></button>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                       <Chip tone="neutral">{l.segmentType === 'domestic' ? 'INLAND' : 'GLOBAL'}</Chip>
                       <span className="text-tertiary-sage flex items-center gap-1.5 font-bold text-[10px] uppercase"><div className="h-1 w-1 rounded-full bg-tertiary-sage" /> {l.status === 'arrived' ? 'LOCKED' : 'TRANSIT'}</span>
                    </div>
                    <div className="flex flex-col gap-2 mb-4">
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest leading-none">Carrier Entity</span>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[18px] font-bold text-primary-navy uppercase leading-none truncate">{l.carrier}</span>
                        <span className="text-[12px] font-bold text-white bg-primary-navy px-3 py-1 rounded-[3px] data-field shadow-sm">{l.trackingNo}</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-4 border-t border-slate-50 flex flex-col gap-2 text-[10px] font-bold text-secondary-slate uppercase tracking-widest opacity-60">
                      <span>离岸/发货: {formatDateOnly(l.shippingDate, 'PENDING')}</span>
                      {l.recipientAddress && <div className="truncate" title={l.recipientAddress}>收货地址: {l.recipientAddress}</div>}
                    </div>
                    {l.attachments && l.attachments.length > 0 && (
                      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                        {l.attachments.map((att: any) => (
                          <div key={att.id} className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded border border-slate-100 text-primary-navy hover:bg-white transition-all whitespace-nowrap">
                             <button onClick={() => setPreviewAttachment(att)} className="flex items-center gap-1.5">
                               <Paperclip size={10} />
                               <span className="text-[9px] font-bold truncate max-w-[80px]">{att.fileName.split('.')[0]}</span>
                             </button>
                             {user?.role === 'admin' && <button onClick={() => handleDeleteAttachment(att.id)} className="ml-1 text-slate-300 hover:text-error"><X size={10} /></button>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>}
          </DocumentBoard>

          {/* Customs Section */}
          <DocumentBoard ref={sectionRefs.customs} title="报关信息" action={<LightActionButton onClick={openCustomsDrawer}><Edit3 size={14} className="mr-1 opacity-70" /> 同步资料</LightActionButton>}>
            <div className="grid gap-8 lg:grid-cols-[240px_1fr] p-1">
              <div className="space-y-5 border-r border-[#F1F5F9] pr-8 flex flex-col justify-center opacity-80">
                <GridItem label="报关单号" value={<span className="data-field uppercase">{asText(customs?.declarationNo, 'WAITING')}</span>} />
                <GridItem label="清关日期" value={<span className="data-field uppercase">{formatDateOnly(customs?.declarationDate, 'TBD')}</span>} />
                <GridItem label="预计离港" value={<span className="data-field uppercase">{formatDateOnly(customs?.releaseDate, 'TBD')}</span>} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between mb-4 border-b border-[#F1F5F9] pb-2">
                  <div className="text-[10px] font-bold text-secondary-slate uppercase tracking-widest opacity-50">电子凭证仓库</div>
                  <button onClick={openCustomsDrawer} className="text-[10px] font-bold text-primary-navy hover:underline">追加文件 +</button>
                </div>
                <div className="space-y-1">
                  {customs?.attachments?.length ? customs.attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between group">
                       <div className="flex-1 min-w-0"><StatusFileRow label={att.fileName.split('.')[0]} status="uploaded" fileName={att.fileName} onPreview={() => setPreviewAttachment(att)} /></div>
                       {user?.role === 'admin' && <button onClick={() => handleDeleteAttachment(att.id)} className="p-2 text-slate-200 hover:text-error opacity-0 group-hover:opacity-100 transition-all"><Trash size={14} /></button>}
                    </div>
                  )) : <div className="py-12 text-center bg-slate-50/50 rounded border border-dashed border-slate-200 text-slate-200 text-[10px] uppercase font-bold tracking-widest">暂无报关资料</div>}
                </div>
              </div>
            </div>
          </DocumentBoard>
        </div>

        {/* Right Nav Rail */}
        <aside className="hidden xl:block sticky top-6 space-y-4 self-start">
          <section className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-sm">
            <div className="text-[13px] font-bold text-primary-navy mb-6 text-center">页面导航</div>
            <div className="space-y-1">
              {[
                { section: 'items', label: '商品明细' },
                { section: 'finance', label: '财务信息' },
                { section: 'production', label: '生产信息' },
                { section: 'logistics', label: '物流与装箱' },
                { section: 'customs', label: '报关资料' }
              ].map(item => (
                <button key={item.section} onClick={() => scrollToSection(item.section as SectionKey)} className={`flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-[11px] font-bold transition-all uppercase tracking-widest group ${activeSection === item.section ? 'bg-slate-100 text-primary-navy shadow-sm' : 'text-secondary-slate hover:bg-slate-50 hover:text-primary-navy'}`}>
                  <div className={`h-1 w-1 rounded-full ${activeSection === item.section ? 'bg-tertiary-sage scale-150' : 'bg-slate-200'}`} />{item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white border border-[#E2E8F0] rounded-lg p-5 shadow-sm space-y-3">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-bold text-primary-navy uppercase tracking-widest"><StickyNote size={14} /> 订单快捷备注</div>
                {savingNotes && <div className="h-2 w-2 rounded-full bg-tertiary-sage animate-pulse" />}
             </div>
             <textarea value={quickNotes} onChange={handleNotesChange} placeholder="在此输入灵感、特殊要求或紧急备注，系统将自动保存..." className="w-full bg-slate-50 p-3 rounded border border-slate-100 text-[12px] font-medium text-primary-navy/80 focus:outline-none focus:border-primary-navy/20 transition-all min-h-[120px] resize-none leading-relaxed" />
          </section>

          <button onClick={() => setDrawer({ mode: 'ai-analysis' })} disabled={analyzing} className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-navy py-4 text-[12px] font-bold text-white hover:bg-slate-800 transition-all shadow-md group">
             <Sparkles size={16} className={`${analyzing ? 'animate-spin opacity-50' : ''}`} />
             <span>AI 智能辅助诊断</span>
          </button>
        </aside>
      </div>

      {previewAttachment && <PreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />}
      {toast && <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[200] inline-flex items-center rounded-[4px] bg-primary-navy px-8 py-4 text-[11px] font-bold text-white shadow-xl animate-in fade-in zoom-in slide-in-from-bottom-12 uppercase tracking-widest border border-white/10"><CheckCircle2 size={16} className="mr-3 text-tertiary-sage" />{toast}</div>}

      {drawer.mode !== 'closed' && (
        <div className="fixed inset-0 z-[150] flex justify-end">
          <button onClick={closeDrawer} className="absolute inset-0 bg-primary-navy/40 backdrop-blur-sm transition-all" />
          <div className="relative z-10 h-full w-full max-w-[700px] border-l border-[#E2E8F0] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] px-10 py-8 bg-[#F8FAFC]">
              <div className="group cursor-default">
                <h3 className="text-[18px] font-bold text-primary-navy tracking-tight uppercase leading-none">{currentDrawerTitle}</h3>
              </div>
              <button onClick={closeDrawer} className="rounded p-2 text-secondary-slate hover:bg-white hover:text-error transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); if (drawer.mode === 'order') handleSaveOrder(e); else if (drawer.mode === 'finance') handleSaveFinance(e); else if (drawer.mode === 'production') handleSaveProduction(e); else if (drawer.mode === 'production-log') handleSaveProductionLog(e); else if (drawer.mode === 'customs') handleSaveCustoms(e); else if (drawer.mode === 'packing') handleSavePacking(e); else handleSaveLogistics(e); }} className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-white">
              {drawerError && <div className="p-6 bg-error/5 border border-error/20 rounded-md text-[12px] font-bold text-error mb-8 flex items-start gap-4 uppercase shadow-inner "><X size={16} className="shrink-0 mt-0.5" /> {drawerError}</div>}
              {drawer.mode === 'order' ? (
                <div className="space-y-10">
                  <section className="grid gap-8 sm:grid-cols-2">
                    <Field label="业务状态"><select value={orderForm.status} onChange={e => setOrderForm({ ...orderForm, status: e.target.value as any })} className="w-full bg-slate-50 p-2.5 text-[13px] font-bold text-primary-navy appearance-none focus:outline-none rounded-[4px] border border-slate-100"><option value="draft">待受理</option><option value="production">生产中</option><option value="customs">报关中</option><option value="shipping">物流中</option><option value="completed">已结清</option></select></Field>
                    <Field label="预期交期"><input type="date" value={orderForm.deliveryDate} onChange={e => setOrderForm({ ...orderForm, deliveryDate: e.target.value })} className="w-full bg-slate-50 p-2.5 text-[13px] font-bold text-primary-navy focus:outline-none rounded-[4px] border border-slate-100" /></Field>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="text-[12px] font-bold text-primary-navy uppercase tracking-widest">产品列表</h4>
                      <button type="button" onClick={() => setOrderForm({ ...orderForm, items: [...orderForm.items, { clientKey: Math.random().toString(36).slice(2), productName: '', specification: '', quantity: '1', unit: 'pcs', unitPrice: '0', subtotal: '0', imageUrl: '' }] })} className="text-[11px] font-bold text-primary-navy hover:underline">+ 添加产品</button>
                    </div>
                    <div className="space-y-3">
                      {orderForm.items.length === 0 && <div className="py-12 text-center border border-dashed border-slate-200 rounded text-slate-300 text-[11px] font-bold uppercase tracking-widest">暂无产品明细</div>}
                      {orderForm.items.map((item, idx) => (
                        <div key={item.clientKey} className="relative p-4 bg-slate-50 rounded-lg border border-slate-100 group hover:bg-white hover:border-slate-200 transition-all">
                          <button type="button" onClick={() => { if (item.id) setDeletedItemIds([...deletedItemIds, item.id]); setOrderForm({ ...orderForm, items: orderForm.items.filter((_, i) => i !== idx) }); }} className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-error text-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-10"><Trash size={10} /></button>
                          <div className="grid gap-4 sm:grid-cols-12">
                            <div className="sm:col-span-5"><Field label="产品名称/型号"><input value={item.productName} onChange={e => { const next = [...orderForm.items]; next[idx].productName = e.target.value; setOrderForm({ ...orderForm, items: next }); }} placeholder="名称规格..." className="w-full bg-transparent p-1 text-[13px] font-medium text-primary-navy focus:outline-none" /></Field></div>
                            <div className="sm:col-span-2"><Field label="单价"><input type="number" value={item.unitPrice} onChange={e => { const next = [...orderForm.items]; next[idx].unitPrice = e.target.value; next[idx].subtotal = String(Number(e.target.value) * Number(next[idx].quantity)); setOrderForm({ ...orderForm, items: next }); }} className="w-full bg-transparent p-1 text-[13px] font-medium text-primary-navy focus:outline-none text-center" /></Field></div>
                            <div className="sm:col-span-2"><Field label="数量"><input type="number" value={item.quantity} onChange={e => { const next = [...orderForm.items]; next[idx].quantity = e.target.value; next[idx].subtotal = String(Number(e.target.value) * Number(next[idx].unitPrice)); setOrderForm({ ...orderForm, items: next }); }} className="w-full bg-transparent p-1 text-[13px] font-medium text-primary-navy focus:outline-none text-center" /></Field></div>
                            <div className="sm:col-span-1"><Field label="单位"><select value={item.unit} onChange={e => { const next = [...orderForm.items]; next[idx].unit = e.target.value; setOrderForm({ ...orderForm, items: next }); }} className="w-full bg-transparent p-1 text-[11px] font-bold text-primary-navy appearance-none focus:outline-none"><option value="pcs">pcs</option><option value="sets">sets</option><option value="kg">kg</option><option value="m">m</option></select></Field></div>
                            <div className="sm:col-span-2"><Field label="总价"><div className="w-full p-1 text-[13px] font-bold text-primary-navy text-right">{Number(item.subtotal).toLocaleString()}</div></Field></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3"><h4 className="text-[12px] font-bold text-primary-navy uppercase tracking-widest">运费与杂费</h4></div>
                    <div className="grid gap-8 sm:grid-cols-2">
                      <Field label="预估运费 (USD)"><input type="number" value={orderForm.freightAmount} onChange={e => setOrderForm({ ...orderForm, freightAmount: e.target.value })} className="w-full bg-transparent p-1 text-base font-bold text-primary-navy focus:outline-none border-b border-slate-100" /></Field>
                      <Field label="其他杂费 (USD)"><input type="number" value={orderForm.miscAmount} onChange={e => setOrderForm({ ...orderForm, miscAmount: e.target.value })} className="w-full bg-transparent p-1 text-base font-bold text-primary-navy focus:outline-none border-b border-slate-100" /></Field>
                    </div>
                    <Field label="内部备注"><textarea rows={6} value={orderForm.details} onChange={e => setOrderForm({ ...orderForm, details: e.target.value })} placeholder="输入包装协议、客户强制性要求等内部指令..." className="w-full bg-slate-50 p-3 rounded-lg text-[13px] font-medium text-primary-navy/70 leading-relaxed focus:outline-none border border-slate-100" /></Field>
                  </section>
                </div>
              ) : drawer.mode === 'production-log' ? (
                <div className="space-y-10">
                   <div className="p-6 bg-slate-50 rounded-lg border border-slate-100 flex gap-5">
                     <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary-navy text-white shadow-sm"><History size={20} /></div>
                     <div className="space-y-1 pt-0.5"><h5 className="text-[14px] font-bold text-primary-navy uppercase tracking-tight">添加生产进度</h5><p className="text-[11px] font-medium text-secondary-slate uppercase tracking-wider">记录制造过程中的关键节点与进展。</p></div>
                   </div>
                   <div className="grid gap-8 sm:grid-cols-2">
                     <Field label="记录日期"><input type="date" value={productionLogForm.logDate} onChange={e => setProductionLogForm({ ...productionLogForm, logDate: e.target.value })} className="w-full bg-slate-50 p-2.5 text-[13px] font-bold text-primary-navy focus:outline-none rounded-[4px] border border-slate-100" /></Field>
                   </div>
                   <Field label="进度描述"><textarea rows={6} value={productionLogForm.content} onChange={e => setProductionLogForm({ ...productionLogForm, content: e.target.value })} placeholder="详细描述当前的生产情况..." className="w-full bg-slate-50 p-3 rounded-lg text-[13px] font-medium text-primary-navy/70 leading-relaxed focus:outline-none border border-slate-100" /></Field>
                   <div className="pt-8 border-t border-slate-100"><AttachmentEditor title="相关附件" attachments={productionLogForm.attachments} newFiles={productionLogForm.newFiles} onFilesSelected={fs=>setProductionLogForm({...productionLogForm, newFiles:[...productionLogForm.newFiles,...fs]})} onRemoveExisting={id=>setProductionLogForm({...productionLogForm, attachments:productionLogForm.attachments.filter(a=>a.id!==id)})} onRemovePending={idx=>setProductionLogForm({...productionLogForm, newFiles:productionLogForm.newFiles.filter((_,i)=>i!==idx)})} /></div>
                </div>
              ) : drawer.mode === 'customs' ? (
                <div className="space-y-10">
                   <div className="grid gap-8 sm:grid-cols-2">
                     <Field label="报关单号"><input value={customsForm.declarationNo} onChange={e=>setCustomsForm({...customsForm, declarationNo:e.target.value})} placeholder="输入单号..." className="w-full bg-slate-50 p-2.5 text-[13px] font-bold text-primary-navy focus:outline-none rounded-[4px] border border-slate-100" /></Field>
                     <Field label="贸易方式"><select value={customsForm.tradeMode} onChange={e=>setCustomsForm({...customsForm, tradeMode:e.target.value})} className="w-full bg-slate-50 p-2.5 text-[13px] font-bold text-primary-navy appearance-none focus:outline-none rounded-[4px] border border-slate-100"><option value="一般贸易">一般贸易 (0110)</option><option value="进料加工">进料加工 (0615)</option><option value="来料加工">来料加工 (0214)</option><option value="其他">其他</option></select></Field>
                     <Field label="报关日期"><input type="date" value={customsForm.declarationDate} onChange={e=>setCustomsForm({...customsForm, declarationDate:e.target.value})} className="w-full bg-slate-50 p-2.5 text-[13px] font-bold text-primary-navy focus:outline-none rounded-[4px] border border-slate-100" /></Field>
                     <Field label="出口日期"><input type="date" value={customsForm.releaseDate} onChange={e=>setCustomsForm({...customsForm, releaseDate:e.target.value})} className="w-full bg-slate-50 p-2.5 text-[13px] font-bold text-primary-navy focus:outline-none rounded-[4px] border border-slate-100" /></Field>
                   </div>
                   <div className="pt-8 border-t border-slate-100"><AttachmentEditor title="报关资料" attachments={customsForm.attachments} newFiles={customsForm.newFiles} onFilesSelected={fs=>setCustomsForm({...customsForm, newFiles:[...customsForm.newFiles,...fs]})} onRemoveExisting={id=>setCustomsForm({...customsForm, attachments:customsForm.attachments.filter(a=>a.id!==id)})} onRemovePending={idx=>setCustomsForm({...customsForm, newFiles:customsForm.newFiles.filter((_,i)=>i!==idx)})} /></div>
                </div>
              ) : drawer.mode === 'packing' ? (
                <div className="space-y-6">
                   <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="text-[12px] font-bold text-primary-navy uppercase tracking-widest">装箱明细列表</h4>
                      <button type="button" onClick={() => setPackingForm({ items: [...packingForm.items, { clientKey: Math.random().toString(36).slice(2), packageCount: '1', packageSize: '', grossWeight: '', netWeight: '' }] })} className="text-[11px] font-bold text-primary-navy hover:underline">+ 新增包装组</button>
                   </div>
                   <div className="space-y-3">
                      {packingForm.items.length === 0 && <div className="py-12 text-center border border-dashed border-slate-200 rounded text-slate-300 text-[11px] font-bold uppercase">点击上方添加装箱数据</div>}
                      {packingForm.items.map((item, idx) => (
                        <div key={item.clientKey} className="relative p-4 bg-slate-50 rounded-lg border border-slate-100 group">
                           <button type="button" onClick={() => setPackingForm({ items: packingForm.items.filter((_, i) => i !== idx) })} className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-error text-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20"><Trash size={10} /></button>
                           <div className="grid gap-4 sm:grid-cols-4 items-end">
                              <div className="sm:col-span-3">
                                 <div className="grid gap-4 grid-cols-4">
                                    <Field label="件数"><input type="number" value={item.packageCount} onChange={e => { const next = [...packingForm.items]; next[idx].packageCount = e.target.value; setPackingForm({ items: next }); }} className="w-full bg-transparent p-1 text-[13px] font-bold text-primary-navy outline-none" /></Field>
                                    <Field label="尺寸"><input value={item.packageSize} onChange={e => { const next = [...packingForm.items]; next[idx].packageSize = e.target.value; setPackingForm({ items: next }); }} placeholder="100x80x120" className="w-full bg-transparent p-1 text-[13px] font-bold text-primary-navy outline-none" /></Field>
                                    <Field label="毛重"><input value={item.grossWeight} onChange={e => { const next = [...packingForm.items]; next[idx].grossWeight = e.target.value; setPackingForm({ items: next }); }} className="w-full bg-transparent p-1 text-[13px] font-bold text-primary-navy outline-none" /></Field>
                                    <Field label="净重"><input value={item.netWeight} onChange={e => { const next = [...packingForm.items]; next[idx].netWeight = e.target.value; setPackingForm({ items: next }); }} className="w-full bg-transparent p-1 text-[13px] font-bold text-primary-navy outline-none" /></Field>
                                 </div>
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                 <label className="h-10 w-10 rounded border border-dashed border-slate-300 bg-white flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all overflow-hidden">
                                    {item.imageUrl ? <img src={item.imageUrl} className="h-full w-full object-cover" /> : <Upload size={14} className="text-slate-200" />}
                                    <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleUploadPackingPhoto(idx, e.target.files[0])} />
                                 </label>
                                 <span className="text-[8px] font-bold text-slate-300 uppercase">实拍图</span>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              ) : drawer.mode === 'logistics' ? (
                <div className="space-y-10">
                   <div className="flex gap-4 p-1 bg-slate-100 rounded-lg">
                      <button type="button" onClick={()=>setLogisticsForm({...logisticsForm, segmentType:'domestic'})} className={`flex-1 py-2 text-[12px] font-bold rounded-md transition-all ${logisticsForm.segmentType==='domestic'?'bg-white text-primary-navy shadow-sm':'text-secondary-slate hover:text-primary-navy'}`}>国内物流</button>
                      <button type="button" onClick={()=>setLogisticsForm({...logisticsForm, segmentType:'international'})} className={`flex-1 py-2 text-[12px] font-bold rounded-md transition-all ${logisticsForm.segmentType==='international'?'bg-white text-primary-navy shadow-sm':'text-secondary-slate hover:text-primary-navy'}`}>国际物流</button>
                   </div>
                   <div className="grid gap-8 sm:grid-cols-2">
                     <Field label="承运商"><input value={logisticsForm.carrier} onChange={e=>setLogisticsForm({...logisticsForm, carrier:e.target.value})} placeholder="例如: 顺丰, MSK..." className="w-full bg-slate-50 p-2.5 text-[13px] font-bold text-primary-navy focus:outline-none rounded-[4px] border border-slate-100" /></Field>
                     <Field label="运单号 / 提单号"><input value={logisticsForm.trackingNo} onChange={e=>setLogisticsForm({...logisticsForm, trackingNo:e.target.value})} placeholder="输入单号..." className="w-full bg-slate-50 p-2.5 text-[13px] font-bold text-primary-navy focus:outline-none rounded-[4px] border border-slate-100" /></Field>
                     <Field label={logisticsForm.segmentType === 'domestic' ? '发货日期' : '预计离港日期'}><input type="date" value={logisticsForm.shippingDate} onChange={e=>setLogisticsForm({...logisticsForm, shippingDate:e.target.value})} className="w-full bg-slate-50 p-2.5 text-[13px] font-bold text-primary-navy focus:outline-none rounded-[4px] border border-slate-100" /></Field>
                     <Field label="状态"><select value={logisticsForm.status} onChange={e=>setLogisticsForm({...logisticsForm, status:e.target.value as any})} className="w-full bg-slate-50 p-2.5 text-[13px] font-bold text-primary-navy appearance-none focus:outline-none rounded-[4px] border border-slate-100"><option value="preparing">备货中</option><option value="shipped">运输中</option><option value="arrived">已到货</option></select></Field>
                     {logisticsForm.segmentType === 'domestic' && <div className="sm:col-span-2"><Field label="收货人地址"><textarea rows={2} value={logisticsForm.recipientAddress} onChange={e=>setLogisticsForm({...logisticsForm, recipientAddress:e.target.value})} className="w-full bg-slate-50 p-2.5 text-[13px] font-medium text-primary-navy focus:outline-none rounded-[4px] border border-slate-100" /></Field></div>}
                   </div>
                   <div className="pt-8 border-t border-slate-100"><AttachmentEditor title="运单附件" attachments={logisticsForm.attachments} newFiles={logisticsForm.newFiles} onFilesSelected={fs=>setLogisticsForm({...logisticsForm, newFiles:[...logisticsForm.newFiles,...fs]})} onRemoveExisting={id=>setLogisticsForm({...logisticsForm, attachments:logisticsForm.attachments.filter(a=>a.id!==id)})} onRemovePending={idx=>setLogisticsForm({...logisticsForm, newFiles:logisticsForm.newFiles.filter((_,i)=>i!==idx)})} /></div>
                </div>
              ) : drawer.mode === 'finance' ? (
                <div className="space-y-12">
                  <div className="grid gap-12 sm:grid-cols-2">
                    <Field label="收支类型"><select value={financeForm.type} onChange={e=>setFinanceForm({...financeForm, type:e.target.value as any})} className="w-full bg-[#F8FAFC] p-3 text-[13px] font-bold text-primary-navy appearance-none focus:outline-none rounded-[4px] border border-slate-100"><option value="receipt">收款 (Receipt)</option><option value="payment">付款 (Payment)</option></select></Field>
                    <div className="flex gap-4 items-end">
                      <div className="w-24"><Field label="币种"><select value={financeForm.currency} onChange={e=>setFinanceForm({...financeForm, currency:e.target.value})} className="w-full bg-[#F8FAFC] p-3 text-[13px] font-bold text-primary-navy appearance-none focus:outline-none rounded-[4px] border border-slate-100"><option value="USD">USD</option><option value="CNY">CNY</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="HKD">HKD</option></select></Field></div>
                      <div className="flex-1"><Field label="金额"><input type="number" step="0.01" value={financeForm.amount} onChange={e=>setFinanceForm({...financeForm, amount:e.target.value})} className="w-full bg-transparent p-2 text-[28px] font-bold text-primary-navy data-field focus:outline-none border-b-2 border-slate-100 focus:border-primary-navy" /></Field></div>
                    </div>
                  </div>
                  <div className="grid gap-12 sm:grid-cols-2">
                    <Field label="结算状态"><select value={financeForm.status} onChange={e=>setFinanceForm({...financeForm, status:e.target.value as any})} className="w-full bg-[#F8FAFC] p-3 text-[13px] font-bold text-primary-navy appearance-none focus:outline-none rounded-[4px] border border-slate-100"><option value="completed">已完成</option><option value="pending">进行中</option></select></Field>
                    <Field label="款项用途"><select value={financeForm.recordCategory} onChange={e=>setFinanceForm({...financeForm, recordCategory:e.target.value as any})} className="w-full bg-[#F8FAFC] p-3 text-[13px] font-bold text-primary-navy appearance-none focus:outline-none rounded-[4px] border border-slate-100"><option value="deposit">定金</option><option value="balance">尾款</option><option value="goods">货款</option><option value="freight">运费</option><option value="customs">报关费</option><option value="other">其他</option></select></Field>
                  </div>
                  <div className="pt-8 border-t border-slate-100"><AttachmentEditor title="附件管理" attachments={financeForm.attachments} newFiles={financeForm.newFiles} onFilesSelected={fs=>setFinanceForm({...financeForm, newFiles:[...financeForm.newFiles,...fs]})} onRemoveExisting={id=>setFinanceForm({...financeForm, attachments:financeForm.attachments.filter(a=>a.id!==id)})} onRemovePending={idx=>setFinanceForm({...financeForm, newFiles:financeForm.newFiles.filter((_,i)=>i!==idx)})} /></div>
                </div>
              ) : drawer.mode === 'production' ? (
                <div className="space-y-16 font-bold">
                   <div className="grid gap-12 sm:grid-cols-2">
                     <Field label="供应商"><select value={productionForm.partnerId} onChange={e=>setProductionForm({...productionForm, partnerId:e.target.value})} className="w-full bg-[#F8FAFC] p-3 text-[13px] font-bold text-primary-navy appearance-none focus:outline-none rounded-[4px] border border-slate-100"><option value="">请选择供应商...</option>{productionPartners.map(p=><option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}</select></Field>
                     <Field label="生产状态"><select value={productionForm.productionStatus} onChange={e=>setProductionForm({...productionForm, productionStatus:e.target.value as any})} className="w-full bg-[#F8FAFC] p-3 text-[13px] font-bold text-primary-navy appearance-none focus:outline-none rounded-[4px] border border-slate-100"><option value="not_started">待生产</option><option value="scheduled">已排产</option><option value="in_progress">生产中</option><option value="ready">已完工</option></select></Field>
                     <Field label="下单日期"><input type="date" value={productionForm.orderDate} onChange={e => setProductionForm({ ...productionForm, orderDate: e.target.value })} className="w-full bg-[#F8FAFC] p-3 text-[13px] font-bold text-primary-navy data-field focus:outline-none rounded-[4px] border border-slate-100" /></Field>
                     <Field label="预计交期"><input type="date" value={productionForm.estimatedDeliveryDate} onChange={e => setProductionForm({ ...productionForm, estimatedDeliveryDate: e.target.value })} className="w-full bg-[#F8FAFC] p-3 text-[13px] font-bold text-primary-navy data-field focus:outline-none rounded-[4px] border border-slate-100" /></Field>
                   </div>
                </div>
              ) : (
                 <div className="space-y-12">
                    {analyzing ? <div className="text-center py-48 flex flex-col items-center"><div className="h-14 w-14 border-[6px] border-slate-50 border-t-primary-navy rounded-full animate-spin mb-10 shadow-sm" /><span className="text-[10px] font-bold text-primary-navy uppercase tracking-[0.6em] animate-pulse ">正在诊断中...</span></div> :
                    aiResult && <div className="space-y-12 animate-in fade-in duration-1000">
                      <div className="p-10 bg-primary-navy rounded-lg text-white flex items-center justify-between shadow-2xl relative overflow-hidden"><div className="absolute top-0 right-0 h-80 w-80 bg-white/5 rounded-full blur-[80px] -translate-y-40 translate-x-20" /><div><h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.5em] mb-3 leading-none opacity-60">AI 综合索引</h4><p className="text-lg font-medium text-slate-500 uppercase tracking-[0.3em]">健康评估分值</p></div><div className={`text-[100px] font-bold italic tracking-tighter leading-none pr-4 ${aiResult.score>=80?'text-success':aiResult.score>=60?'text-warning':'text-error'}`}>{aiResult.score}</div></div>
                      <div className="p-10 bg-slate-50 border-l-[10px] border-l-tertiary-sage rounded-r-[6px] text-primary-navy font-semibold text-[22px] leading-snug shadow-inner tracking-tight uppercase">"{aiResult.summary}"</div>
                      <section className="space-y-8 px-2">
                         <div className="flex items-center gap-4 px-4"><div className="h-5 w-1 rounded-full bg-error" /><h5 className="text-[12px] font-bold text-primary-navy uppercase tracking-[0.4em]">识别到的关键风险</h5></div>
                         <div className="space-y-6">
                           {aiResult.risks.map((r, i) => <div key={i} className="p-8 bg-white border border-[#E2E8F0] rounded-lg text-[16px] font-bold text-secondary-slate leading-relaxed shadow-sm border-l-[16px] border-l-error/20 hover:border-l-error transition-all ">"{r.content}"</div>)}
                         </div>
                      </section>
                    </div>}
                 </div>
              )}

              <div className="flex gap-6 pt-16 sticky bottom-0 bg-white/95 backdrop-blur-2xl pb-10 z-[40] border-t border-slate-100">
                <button type="button" onClick={closeDrawer} className="flex-1 rounded-[4px] border border-slate-200 py-5 text-[11px] font-bold text-secondary-slate hover:bg-slate-50 transition-all uppercase tracking-[0.5em] shadow-sm opacity-50">取消</button>
                <button type="submit" disabled={saving} className="flex-[4] rounded-[4px] bg-primary-navy py-5 text-sm font-bold text-white shadow-xl hover:bg-slate-800 transition-all uppercase tracking-[0.5em] active:scale-95">{saving ? '提交中...' : '确认同步'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
