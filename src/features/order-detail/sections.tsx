import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, MapPin, Mail, Edit3, DollarSign, Factory, ShieldCheck, Truck, Printer, Trash,
  FileText, Plus, Package, Upload, Download, Wallet, Box, Check, Clock, CheckCircle2, X, Sparkles, Eye, EyeOff,
} from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { apiFetch } from '../../lib/api';
import {
  WorkSection, DocumentBoard, EmptyStateBoard, FinanceDashboard, ProductionDashboard,
  Chip, GridItem, FileIcon, LightActionButton, FilterPill,
} from './components';
import { formatDateOnly, formatDateTime, asNumber, asText, formatIncoterm, formatTransportMode, STAGE_STEPS } from './utils';
import type {
  AttachmentMeta, CustomerInfo, CustomsRecord, DocumentSlot, FinanceRecord, LogisticsRecord, OrderInfo, OrderItem,
  PackingRecord, ProductionPlan, ProductionStatus, InspectionStatus, SectionKey, FinanceType, ProfitData,
} from './types';

// ==================== Header Section ====================

export function OrderHeaderSection({
  headerRef,
  order,
  customer,
  stageIndex,
  navigate,
  scrollToSection,
  openOrderDrawer,
  openFinanceDrawer,
  openProductionDrawer,
  openCustomsDrawer,
  openLogisticsDrawer,
  handleExportPdf,
  setIsDeleteModalOpen,
  user,
  items,
  financeRecords,
  productionPlan,
  hasAnyLogistics,
  packingRecords,
}: {
  headerRef: React.RefObject<HTMLDivElement | null>;
  order: OrderInfo;
  customer: CustomerInfo;
  stageIndex: number;
  navigate: (path: string) => void;
  scrollToSection: (section: string) => void;
  openOrderDrawer: () => void;
  openFinanceDrawer: () => void;
  openProductionDrawer: () => void;
  openCustomsDrawer: () => void;
  openLogisticsDrawer: () => void;
  handleExportPdf: () => void;
  setIsDeleteModalOpen: (v: boolean) => void;
  user?: { name?: string; role?: string } | null;
  items: OrderItem[];
  financeRecords: FinanceRecord[];
  productionPlan: ProductionPlan | null;
  hasAnyLogistics: boolean;
  packingRecords: PackingRecord[];
}) {
  return (
    <header ref={headerRef} className="bg-surface dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-6 shadow-sm mt-0 transition-colors">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between border-b border-slate-100 dark:border-navy-800 pb-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-secondary-slate dark:text-slate-400 tracking-tight leading-none">
              <Link to="/orders" className="hover:text-primary-navy dark:hover:text-tertiary-sage transition-colors">订单管理</Link>
              <ChevronRight size={12} className="opacity-30" />
              <span className="text-primary-navy dark:text-tertiary-sage data-field" style={{ viewTransitionName: 'order-id' }}>{order.display_id}</span>
            </div>
            <h1 className="text-2xl font-bold text-primary-navy dark:text-white tracking-tight truncate mb-4 hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate(`/customers/${customer.display_id}`)}>
              {asText(customer.name, '未命名客户')}
            </h1>
            <div className="flex flex-wrap gap-4 text-xs font-bold text-secondary-slate dark:text-slate-400 tracking-tight">
              <span className="flex items-center gap-1.5"><MapPin size={12} className="text-tertiary-sage" />{asText(customer.country)}</span>
              <span className="flex items-center gap-1.5"><Mail size={12} className="text-info dark:text-blue-400" />{asText(customer.contact)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Tooltip text="订单已结清，清单不可修改。" disabled={order.status !== 'completed'}>
              <button disabled={order.status === 'completed'} onClick={openOrderDrawer} className="btn-primary text-xs px-5 py-2"><Edit3 size={14} /> 编辑清单</button>
            </Tooltip>
            <button onClick={() => openFinanceDrawer()} className="btn-secondary text-xs px-4 py-2"><DollarSign size={14} className="text-slate-400" /> 录入收支</button>
            <Tooltip text="需先确认清单并核销定金收据后解锁生产同步。" disabled={items.length > 0 && financeRecords.some(r => r.type === 'receipt' && r.recordCategory === 'deposit' && r.status === 'completed')}>
              <button disabled={!(items.length > 0 && financeRecords.some(r => r.type === 'receipt' && r.recordCategory === 'deposit' && r.status === 'completed'))} onClick={openProductionDrawer} className="btn-secondary text-xs px-4 py-2"><Factory size={14} className="text-slate-400" /> 同步生产</button>
            </Tooltip>
            <Tooltip text="需先完成装箱单录入或至少有一条发运记录后开启报关。" disabled={hasAnyLogistics || packingRecords.length > 0}>
              <button disabled={!(hasAnyLogistics || packingRecords.length > 0)} onClick={openCustomsDrawer} className="btn-secondary text-xs px-4 py-2"><ShieldCheck size={14} className="text-slate-400" /> 更新报关</button>
            </Tooltip>
            <Tooltip text="需待生产环节进入'进行中'或'已完工'状态后方可安排发运。" disabled={productionPlan?.productionStatus === 'ready' || productionPlan?.productionStatus === 'in_progress'}>
              <button disabled={!(productionPlan?.productionStatus === 'ready' || productionPlan?.productionStatus === 'in_progress')} onClick={() => openLogisticsDrawer()} className="btn-secondary text-xs px-4 py-2"><Truck size={14} className="text-slate-400" /> 创建物流</button>
            </Tooltip>
            <div className="h-6 w-px bg-slate-100 dark:bg-navy-800 mx-4 hidden sm:block" />
            <button onClick={handleExportPdf} className="btn-secondary text-xs px-4 py-2"><Printer size={14} className="text-slate-400" /> 导出 PDF</button>
            {user?.role === 'admin' && (
              <button onClick={() => setIsDeleteModalOpen(true)} className="btn-destructive text-xs px-4 py-2"><Trash size={14} /> 删除订单</button>
            )}
          </div>
        </div>
        <div className="rounded-md bg-slate-50/50 dark:bg-navy-950/40 border border-slate-100 dark:border-navy-800 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {STAGE_STEPS.map((s, i) => (
              <button key={s.key} onClick={() => scrollToSection(s.target)} className={`flex-1 min-w-[130px] flex items-center gap-3 px-4 py-2 rounded transition-all ${s.key === order.status ? 'bg-surface dark:bg-navy-800 shadow-md ring-1 ring-slate-200 dark:ring-navy-700' : 'opacity-40 hover:opacity-100'}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i <= stageIndex ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'}`}>{i + 1}</span>
                <span className={`text-xs font-bold tracking-tight ${s.key === order.status ? 'text-primary-navy dark:text-white' : 'text-secondary-slate dark:text-slate-400'}`}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

// ==================== Items Section ====================

export function ItemsSection({
  sectionRef,
  collapsed,
  onToggle,
  items,
  openOrderDrawer,
  grandTotal,
  itemsTotal = 0,
  freightAmount = 0,
  miscAmount = 0,
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>;
  collapsed: boolean;
  onToggle: () => void;
  items: OrderItem[];
  openOrderDrawer: () => void;
  grandTotal: number;
  itemsTotal?: number;
  freightAmount?: number;
  miscAmount?: number;
}) {
  return (
    <WorkSection ref={sectionRef} section="items" title="商品明细" icon={<FileText size={16} />} collapsed={collapsed} onToggle={onToggle} action={items.length ? <LightActionButton onClick={openOrderDrawer} className="!py-1.5 !px-3 !text-xs"><Plus size={14} className="mr-1 opacity-70" /> 编辑清单</LightActionButton> : null}>
      {items.length ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-sm">
          <table className="min-w-full text-left text-xs font-medium">
            <thead className="bg-slate-50 dark:bg-navy-950 font-bold tracking-tight border-b border-slate-200 dark:border-navy-800 data-field text-xs text-secondary-slate dark:text-slate-400">
              <tr><th className="px-5 py-4">产品名称</th><th className="px-5 py-4 text-center">规格/型号</th><th className="px-5 py-4 text-center">数量</th><th className="px-5 py-4 text-center">单位</th><th className="px-5 py-4 text-right">单价 (USD)</th><th className="px-5 py-4 text-right">总价 (USD)</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800 font-medium tracking-tight">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                  <td className="px-5 py-4 font-bold text-primary-navy dark:text-white">{asText(item.product_name)}</td>
                  <td className="px-5 py-4 text-center text-secondary-slate dark:text-slate-400 text-xs data-field font-bold">{asText(item.specification, '通用')}</td>
                  <td className="px-5 py-4 text-center font-bold text-primary-navy dark:text-white data-field">{item.quantity}</td>
                  <td className="px-5 py-4 text-center text-secondary-slate dark:text-slate-400 font-bold">{item.unit || 'pcs'}</td>
                  <td className="px-5 py-4 text-right text-secondary-slate dark:text-slate-400 data-field font-bold">{asNumber(item.unit_price).toLocaleString()}</td>
                  <td className="px-5 py-4 text-right font-bold text-primary-navy dark:text-tertiary-sage data-field text-sm">USD {asNumber(item.subtotal).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-navy-950/50 border-t border-slate-200 dark:border-navy-800">
              <tr className="text-secondary-slate dark:text-slate-400">
                <td colSpan={5} className="px-5 py-3 text-right text-xs tracking-tight">商品小计 (Subtotal)</td>
                <td className="px-5 py-3 text-right text-sm font-bold data-field">USD {itemsTotal.toLocaleString()}</td>
              </tr>
              {freightAmount > 0 && (
                <tr className="text-secondary-slate dark:text-slate-400">
                  <td colSpan={5} className="px-5 py-3 text-right text-xs tracking-tight">运费估算 (Freight)</td>
                  <td className="px-5 py-3 text-right text-sm font-bold data-field">USD {freightAmount.toLocaleString()}</td>
                </tr>
              )}
              {miscAmount > 0 && (
                <tr className="text-secondary-slate dark:text-slate-400">
                  <td colSpan={5} className="px-5 py-3 text-right text-xs tracking-tight">其他杂费 (Misc)</td>
                  <td className="px-5 py-3 text-right text-sm font-bold data-field">USD {miscAmount.toLocaleString()}</td>
                </tr>
              )}
              <tr className="text-primary-navy dark:text-white font-extrabold border-t border-slate-200 dark:border-navy-700">
                <td colSpan={5} className="px-5 py-5 text-right text-xs tracking-tight">合计总值 (Grand Total)</td>
                <td className="px-5 py-5 text-right text-xl data-field text-primary-navy dark:text-tertiary-sage">USD {grandTotal.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <EmptyStateBoard title="暂无商品明细" description="尚未录入任何货物信息。请立即初始化本单的货物清单数据，以便后续核算。" icon={Package} actionLabel="+ 初始化货物清单" onAction={openOrderDrawer} />
      )}
    </WorkSection>
  );
}

// ==================== Documents Vault Section ====================

const DOCUMENT_SLOTS: DocumentSlot[] = [
  { key: 'pi', docType: 'PI', label: 'PI', name: '形式发票', group: '业务单据', pattern: /\b(pi|proforma)\b|形式发票/i },
  { key: 'contract', docType: 'CONTRACT', label: '合同', name: '采购/销售合同', group: '业务单据', pattern: /contract|合同|purchase/i },
  { key: 'ci', docType: 'CI', label: 'CI', name: '商业发票', group: '结汇/清关', pattern: /\b(ci|commercial invoice)\b|商业发票/i },
  { key: 'pl', docType: 'PL', label: 'PL', name: '装箱单', group: '结汇/清关', pattern: /\b(pl|packing list)\b|装箱单/i },
  { key: 'bl', docType: 'BL', label: 'B/L', name: '提单', group: '结汇/清关', pattern: /\b(bl|b\/l|bill of lading)\b|提单/i },
  { key: 'co', docType: 'CO', label: 'CO', name: '原产地证', group: '结汇/清关', pattern: /\b(co|certificate of origin)\b|原产地/i },
  { key: 'insurance', docType: 'INSURANCE', label: '保险', name: '保险单', group: '结汇/清关', pattern: /insurance|policy|保险/i },
];

const CUSTOMS_DOCUMENT_SLOTS: DocumentSlot[] = [
  { key: 'customs-draft', docType: 'CUSTOMS_DRAFT', label: '草单', name: '报关草单', group: '报关资料', pattern: /customs draft|draft|草单/i },
  { key: 'electronic-proxy', docType: 'ELECTRONIC_PROXY', label: '委托', name: '电子委托书', group: '报关资料', pattern: /proxy|委托/i },
  { key: 'release-note', docType: 'RELEASE_NOTE', label: '放行', name: '放行条', group: '报关资料', pattern: /release|放行/i },
  { key: 'customs-declaration', docType: 'CUSTOMS_DECLARATION', label: '报关单', name: '报关单', group: '报关资料', pattern: /customs declaration|报关单/i },
  { key: 'tax-refund-copy', docType: 'TAX_REFUND_COPY', label: '退税', name: '退税联', group: '退税资料', pattern: /tax refund|退税/i },
];

function getDocumentSlotMatch(slot: DocumentSlot, documents: AttachmentMeta[]) {
  const explicitMatch = documents.find((doc) => String(doc.remark || '').toUpperCase() === `DOCTYPE:${slot.docType}`);
  return explicitMatch || documents.find((doc) => !String(doc.remark || '').toUpperCase().startsWith('DOCTYPE:') && slot.pattern.test(doc.fileName || ''));
}

function getSlotMatches(slots: DocumentSlot[], documents: AttachmentMeta[]) {
  const matchedDocumentIds = new Set<number>();
  const slotMatches = slots.map((slot) => {
    const slotDocument = getDocumentSlotMatch(slot, documents);
    if (slotDocument) matchedDocumentIds.add(slotDocument.id);
    return { slot, slotDocument };
  });
  return { slotMatches, unmatchedDocuments: documents.filter((doc) => !matchedDocumentIds.has(doc.id)) };
}

function SlotDocumentGrid({
  slots,
  documents,
  onUpload,
  onPreview,
  onDeleteAttachment,
  user,
  uploadLabel = '上传',
}: {
  slots: DocumentSlot[];
  documents: AttachmentMeta[];
  onUpload: (files: FileList | null, docType: string) => void;
  onPreview: (att: AttachmentMeta | null) => void;
  onDeleteAttachment: (id: number) => Promise<void>;
  user?: { name?: string; role?: string } | null;
  uploadLabel?: string;
}) {
  const { slotMatches, unmatchedDocuments } = getSlotMatches(slots, documents);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {slotMatches.map(({ slot, slotDocument }) => (
          <div key={slot.key} className={`rounded-lg border p-4 transition-all ${slotDocument ? 'border-emerald-100 bg-emerald-50/50 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-900/10' : 'border-dashed border-slate-200 bg-slate-50/60 dark:border-navy-700 dark:bg-navy-950/40'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-black ${slotDocument ? 'border-emerald-200 bg-white text-emerald-700 dark:border-emerald-900/50 dark:bg-navy-900 dark:text-emerald-300' : 'border-slate-200 bg-surface text-slate-400 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-500'}`}>{slot.label}</span>
                  <span className="truncate text-xs font-black text-primary-navy dark:text-white">{slot.name}</span>
                </div>
                <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{slot.group}</div>
              </div>
              {slotDocument ? <CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-500" /> : <Upload size={15} className="mt-1 shrink-0 text-slate-300 dark:text-slate-600" />}
            </div>
            {slotDocument ? (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-100 bg-white/80 px-2.5 py-2 dark:border-emerald-900/30 dark:bg-navy-900/70">
                <button onClick={() => onPreview(slotDocument)} className="shrink-0"><FileIcon fileName={slotDocument.fileName} url={slotDocument.url} size={18} /></button>
                <button onClick={() => onPreview(slotDocument)} className="min-w-0 flex-1 truncate text-left text-xs font-bold text-primary-navy hover:underline dark:text-white" title={slotDocument.fileName}>{slotDocument.fileName}</button>
                <a href={slotDocument.url} download className="shrink-0 text-slate-400 hover:text-primary-navy dark:hover:text-white"><Download size={13} /></a>
                {user?.role === 'admin' && <button onClick={() => onDeleteAttachment(slotDocument.id)} className="shrink-0 text-slate-300 hover:text-error dark:text-slate-600"><Trash size={13} /></button>}
              </div>
            ) : (
              <label className="mt-4 flex h-9 w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-200 text-xs font-black text-slate-400 transition-all hover:border-primary-navy/30 hover:bg-surface hover:text-primary-navy dark:border-navy-700 dark:hover:border-tertiary-sage/40 dark:hover:bg-navy-900 dark:hover:text-tertiary-sage">
                {uploadLabel}
                <input type="file" className="hidden" onChange={e => { onUpload(e.target.files, slot.docType); e.currentTarget.value = ''; }} />
              </label>
            )}
          </div>
        ))}
      </div>
      {unmatchedDocuments.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-black text-slate-400 dark:text-slate-500 tracking-tight">其他附件</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {unmatchedDocuments.map((doc) => (
              <div key={doc.id} className="flex h-14 items-center rounded-lg border border-slate-200 bg-surface px-4 transition-all hover:border-primary-navy/20 hover:shadow-sm dark:border-navy-800 dark:bg-navy-900 dark:hover:border-tertiary-sage/20">
                <button onClick={() => onPreview(doc)} className="mr-3 shrink-0"><FileIcon fileName={doc.fileName} url={doc.url} size={20} /></button>
                <div className="min-w-0 flex-1">
                  <button onClick={() => onPreview(doc)} className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-xs font-bold leading-tight text-slate-900 hover:underline dark:text-white" title={doc.fileName}>{doc.fileName}</button>
                  {doc.createdAt && <span className="text-xs font-medium text-slate-400">{formatDateOnly(doc.createdAt)}</span>}
                </div>
                {user?.role === 'admin' && <button onClick={() => onDeleteAttachment(doc.id)} className="ml-2 shrink-0 p-1.5 text-slate-300 hover:text-error dark:text-slate-600"><Trash size={14} /></button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DocumentsVaultSection({
  orderDocuments,
  uploadingDoc,
  onUploadDocument,
  onPreview,
  onDeleteAttachment,
  user,
}: {
  orderDocuments: AttachmentMeta[];
  uploadingDoc: boolean;
  onUploadDocument: (files: FileList | null, docType?: string) => void;
  onPreview: (att: AttachmentMeta | null) => void;
  onDeleteAttachment: (id: number) => Promise<void>;
  user?: { name?: string; role?: string } | null;
}) {
  const matchedDocumentIds = new Set<number>();
  const slotMatches = DOCUMENT_SLOTS.map((slot) => {
    const slotDocument = getDocumentSlotMatch(slot, orderDocuments);
    if (slotDocument) matchedDocumentIds.add(slotDocument.id);
    return { slot, slotDocument };
  });
  const uncategorizedDocuments = orderDocuments.filter((doc) => !matchedDocumentIds.has(doc.id));

  return (
    <DocumentBoard title="核心单据凭证库" id="documents-vault" action={
      <label className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${uploadingDoc ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-surface dark:bg-navy-800 text-slate-900 dark:text-white border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-700 hover:border-slate-300 dark:hover:border-navy-600 shadow-sm cursor-pointer active:scale-95'}`}>
        {uploadingDoc ? '上传中...' : <><Upload size={14} className="mr-1 opacity-70" /> 上传凭证</>}
        {!uploadingDoc && <input type="file" multiple className="hidden" onChange={e => e.target.files && onUploadDocument(e.target.files)} />}
      </label>
    }>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {slotMatches.map(({ slot, slotDocument }) => (
          <div key={slot.key} className={`rounded-lg border p-4 transition-all ${slotDocument ? 'border-emerald-100 bg-emerald-50/50 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-900/10' : 'border-dashed border-slate-200 bg-slate-50/60 dark:border-navy-700 dark:bg-navy-950/40'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-black ${slotDocument ? 'border-emerald-200 bg-white text-emerald-700 dark:border-emerald-900/50 dark:bg-navy-900 dark:text-emerald-300' : 'border-slate-200 bg-surface text-slate-400 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-500'}`}>{slot.label}</span>
                  <span className="truncate text-xs font-black text-primary-navy dark:text-white">{slot.name}</span>
                </div>
                <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{slot.group}</div>
              </div>
              {slotDocument ? <CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-500" /> : <Upload size={15} className="mt-1 shrink-0 text-slate-300 dark:text-slate-600" />}
            </div>
            {slotDocument ? (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-100 bg-white/80 px-2.5 py-2 dark:border-emerald-900/30 dark:bg-navy-900/70">
                <button onClick={() => onPreview(slotDocument)} className="shrink-0"><FileIcon fileName={slotDocument.fileName} url={slotDocument.url} size={18} /></button>
                <button onClick={() => onPreview(slotDocument)} className="min-w-0 flex-1 truncate text-left text-xs font-bold text-primary-navy hover:underline dark:text-white" title={slotDocument.fileName}>{slotDocument.fileName}</button>
                <a href={slotDocument.url} download className="shrink-0 text-slate-400 hover:text-primary-navy dark:hover:text-white"><Download size={13} /></a>
                {user?.role === 'admin' && <button onClick={() => onDeleteAttachment(slotDocument.id)} className="shrink-0 text-slate-300 hover:text-error dark:text-slate-600"><Trash size={13} /></button>}
              </div>
            ) : (
              <label className="mt-4 flex h-9 w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-200 text-xs font-black text-slate-400 transition-all hover:border-primary-navy/30 hover:bg-surface hover:text-primary-navy dark:border-navy-700 dark:hover:border-tertiary-sage/40 dark:hover:bg-navy-900 dark:hover:text-tertiary-sage">
                上传补齐
                <input type="file" className="hidden" onChange={e => { onUploadDocument(e.target.files, slot.docType); e.currentTarget.value = ''; }} />
              </label>
            )}
          </div>
        ))}
      </div>
      {uncategorizedDocuments.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-black text-slate-400 dark:text-slate-500 tracking-tight">其他单据</div>
          <div className="max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
            <div className="grid gap-3 sm:grid-cols-2">
              {uncategorizedDocuments.map(doc => (
                <div key={doc.id} className="flex items-center h-14 px-4 bg-surface dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg group hover:border-primary-navy/20 dark:hover:border-tertiary-sage/20 hover:shadow-sm transition-all">
                  <button onClick={() => onPreview(doc)} className="shrink-0 mr-3"><FileIcon fileName={doc.fileName} url={doc.url} size={20} /></button>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onPreview(doc)} className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-xs font-bold leading-tight text-slate-900 hover:underline dark:text-white" title={doc.fileName}>{doc.fileName}</button>
                    {doc.createdAt && <span className="text-xs font-medium text-slate-400">{formatDateOnly(doc.createdAt)}</span>}
                  </div>
                  <div className="flex items-center gap-0.5 ml-2 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <button onClick={() => onPreview(doc)} className="p-1.5 text-slate-400 hover:text-primary-navy dark:hover:text-white rounded hover:bg-slate-50 dark:hover:bg-navy-800 transition-all"><FileText size={14} /></button>
                    <a href={doc.url} download className="p-1.5 text-slate-400 hover:text-primary-navy dark:hover:text-white rounded hover:bg-slate-50 dark:hover:bg-navy-800 transition-all"><Download size={14} /></a>
                    {user?.role === 'admin' && (
                      <button onClick={() => onDeleteAttachment(doc.id)} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-error transition-all"><Trash size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <input id="doc-upload-input" type="file" multiple className="hidden" onChange={e => e.target.files && onUploadDocument(e.target.files)} />
    </DocumentBoard>
  );
}

// ==================== Finance Section ====================

export function FinanceSection({
  sectionRef,
  financeRecords,
  filteredRecords,
  grandTotal,
  summary,
  onPreview,
  onEdit,
  onAdd,
  onDelete,
  financeFilter,
  onFilterChange,
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>;
  financeRecords: FinanceRecord[];
  filteredRecords: FinanceRecord[];
  grandTotal: number;
  summary: { receiptsByCurrency: Record<string, number>; attachmentsSummary?: { finance: number; logistics: number; customs: number } };
  onPreview: (att: AttachmentMeta | null) => void;
  onEdit: (record: FinanceRecord) => void;
  onAdd: () => void;
  onDelete: (record: FinanceRecord) => void;
  financeFilter: 'all' | FinanceType;
  onFilterChange: (v: 'all' | FinanceType) => void;
}) {
  return (
    <DocumentBoard ref={sectionRef} title="财务信息" action={financeRecords.length ? (
      <div className="flex items-center gap-3">
        <div className="flex bg-surface dark:bg-navy-800 p-0.5 rounded border border-slate-200 dark:border-navy-700">
          <FilterPill active={financeFilter==='all'} onClick={()=>onFilterChange('all')}>全部</FilterPill>
          <FilterPill active={financeFilter==='receipt'} onClick={()=>onFilterChange('receipt')}>收款</FilterPill>
          <FilterPill active={financeFilter==='payment'} onClick={()=>onFilterChange('payment')}>付款</FilterPill>
        </div>
        <LightActionButton onClick={onAdd} className="!py-1.5 !px-3 !text-xs"><Plus size={14} className="mr-1 opacity-70" /> 录入收支</LightActionButton>
      </div>
    ) : null}>
      {financeRecords.length ? (
        <FinanceDashboard totalAmount={grandTotal} records={filteredRecords} receiptsByCurrency={summary.receiptsByCurrency} onPreview={onPreview} onEdit={onEdit} onDelete={onDelete} />
      ) : (
        <EmptyStateBoard title="暂无账务往来" description="请登记客户定金、尾款或需支付给合作伙伴的运费/报关费，并上传银行水单等凭证。" icon={Wallet} actionLabel="+ 登记第一笔收支" onAction={onAdd} />
      )}
    </DocumentBoard>
  );
}

// ==================== Profit Section ====================

export function ProfitSection({
  user,
  orderNo,
  totalAmount,
  freightAmount,
  miscAmount,
  itemsTotal,
  showToast,
}: {
  user?: { name?: string; role?: string } | null;
  orderNo: string;
  totalAmount: number;
  freightAmount: number;
  miscAmount: number;
  itemsTotal: number;
  showToast?: (msg: string) => void;
}) {
  const isAdmin = user?.role === 'admin';
  const [revealed, setRevealed] = useState(false);
  const [profitData, setProfitData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isAdmin || !orderNo) {
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    apiFetch<ProfitData>(`/api/orders/${encodeURIComponent(orderNo)}/profit`)
      .then((data) => { if (!cancelled) setProfitData(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAdmin, orderNo]);

  if (!isAdmin) return null;

  const pd = profitData || {
    receipts: [{ amount: totalAmount, currency: 'USD' as const, bankFees: 0, platformFees: 0, exchangeRate: 7.2 }],
    invoiceAmount: itemsTotal * 7.2 * 0.7,
    refundRate: 13,
    otherIncomeCny: 0,
    factoryCostCny: itemsTotal * 7.2 * 0.7,
    domesticFees: 0,
    freightValue: freightAmount || 0,
    freightCurrency: 'USD' as const,
    customsMisc: miscAmount || 0,
    miscFees: [],
  };

  // Loop through receipts (multi-phase accumulation)
  let totalNetUsd = 0;
  let totalCnyFromReceipts = 0;

  for (const r of pd.receipts) {
    if (r.currency === 'USD') {
      const net = r.amount - r.bankFees - r.platformFees;
      totalNetUsd += net;
      totalCnyFromReceipts += net * r.exchangeRate;
    } else {
      // CNY receipt: exchange rate is 1, fees are in CNY
      totalCnyFromReceipts += r.amount - r.bankFees - r.platformFees;
    }
  }

  const estimatedRefundCny = pd.invoiceAmount > 0 ? (pd.invoiceAmount / 1.13 * (pd.refundRate / 100)) : 0;
  const totalRevenueCny = totalCnyFromReceipts + estimatedRefundCny + (pd.otherIncomeCny || 0);
  const miscTotal = (pd.miscFees || []).reduce((s, f) => s + (f.amount || 0), 0);
  const freightCny = pd.freightCurrency === 'USD' ? (pd.freightValue * (pd.receipts[0]?.exchangeRate || 7.2)) : pd.freightValue;
  const totalCostCny = pd.factoryCostCny + pd.domesticFees + freightCny + pd.customsMisc + miscTotal;
  const netProfitCny = totalRevenueCny - totalCostCny;
  const margin = totalRevenueCny > 0 ? (netProfitCny / totalRevenueCny) * 100 : 0;

  const freightWarn = freightCny > pd.factoryCostCny && pd.factoryCostCny > 0;
  const marginAlert = margin < 8 && margin > 0;

  const fmt = (v: number, c = 'USD') =>
    revealed ? `${c} ${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '***';
  const fmtCny = (v: number) => fmt(v, 'CNY');

  const handleSave = async (data: ProfitData) => {
    await apiFetch(`/api/orders/${orderNo}/profit`, { method: 'POST', body: JSON.stringify(data) });
    setProfitData(data);
    showToast?.('保存成功');
  };

  return (
    <>
      <DocumentBoard title="外贸利润核算" id="profit-section" action={
        <div className="flex items-center gap-2">
          <LightActionButton onClick={() => setShowDrawer(true)} className="!py-1.5 !px-3 !text-xs"><Edit3 size={14} className="mr-1 opacity-70" /> 编辑核算明细</LightActionButton>
          <LightActionButton onClick={() => setRevealed(!revealed)} className="!py-1.5 !px-3 !text-xs">
            {revealed ? <><EyeOff size={14} className="mr-1 opacity-70" /> 隐藏</> : <><Eye size={14} className="mr-1 opacity-70" /> 揭示</>}
          </LightActionButton>
        </div>
      }>
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Revenue */}
          <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-100 dark:border-navy-800 pb-3">
              <div className="h-4 w-1 rounded-full bg-slate-900 dark:bg-tertiary-sage" />
              <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight">收入信息 / Revenue · {pd.receipts.length} 期</div>
            </div>
            <div className="space-y-3">
              {pd.receipts.map((r, i) => (
                <div key={i} className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/30 p-4 space-y-1.5">
                  <div className="mb-2 text-xs font-bold text-tertiary-sage tracking-tight">收款明细 {i + 1} ({r.currency})</div>
                  <Row label="收款金额" value={fmt(r.amount, r.currency)} />
                  <Row label="手续费" value={fmt(r.bankFees + r.platformFees, r.currency)} />
                  {r.currency === 'USD' && <Row label="结汇汇率" value={revealed ? String(r.exchangeRate) : '***'} />}
                </div>
              ))}
              <Row label={`预估退税额 (退税率 ${pd.refundRate}%)`} value={fmtCny(estimatedRefundCny)} />
              <Row label="其他收入" value={fmtCny(pd.otherIncomeCny || 0)} />
              <Row label="实际折合本币 (总)" value={fmtCny(totalRevenueCny)} bold />
            </div>
          </div>

          {/* Right: Cost */}
          <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-100 dark:border-navy-800 pb-3">
              <div className="h-4 w-1 rounded-full bg-slate-900 dark:bg-tertiary-sage" />
              <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight">成本费用 / Costs</div>
            </div>
            <div className="space-y-1.5">
              <Row label="工厂采购价" value={fmtCny(pd.factoryCostCny)} />
              <Row label="国内费用 (拖车/入仓)" value={fmtCny(pd.domesticFees)} />
              <Row label={`国际运费 (${pd.freightCurrency})`} value={fmt(pd.freightValue, pd.freightCurrency)} />
              <Row label="报关与杂费 (含偏远/产地证等)" value={fmtCny(pd.customsMisc + (pd.miscFees || []).reduce((s, f) => s + (f.amount || 0), 0))} />
              <Row label="成本合计" value={fmtCny(totalCostCny)} bold />
            </div>
          </div>
        </div>

        {/* Bottom: Summary */}
        <div className="mt-6 grid gap-4 border-t border-slate-100 dark:border-navy-800 pt-5 lg:grid-cols-3">
          <SummaryBox label="累计净美金" value={fmt(totalNetUsd)} color="text-primary-navy dark:text-white" />
          <SummaryBox label="预估净利润" value={fmtCny(netProfitCny)} color={netProfitCny >= 0 ? 'text-emerald-600' : 'text-red-600'} />
          <SummaryBox label="净利润率" value={revealed ? `${margin.toFixed(2)}%` : '***'}
            color={marginAlert ? 'text-red-600' : margin >= 15 ? 'text-emerald-600' : 'text-amber-600'} />
        </div>

        {/* Risk Alerts */}
        {revealed && (freightWarn || marginAlert) && (
          <div className="mt-4 space-y-1.5 rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-4">
            {freightWarn && <div className="text-xs font-bold text-red-600 dark:text-red-400">风险提示：国际运费已超过货品成本，请核实物流方案。</div>}
            {marginAlert && <div className="text-xs font-bold text-red-600 dark:text-red-400">风险提示：该单利润率过低 ({(margin).toFixed(2)}%)，已触及风控红线 (8%)。</div>}
          </div>
        )}
      </DocumentBoard>

      {/* Profit Edit Drawer */}
      {showDrawer && (
        <ProfitDrawer
          data={pd}
          onSave={handleSave}
          onClose={() => setShowDrawer(false)}
        />
      )}
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-md px-3 py-2 ${bold ? 'bg-slate-50 dark:bg-navy-950/40 border border-slate-100 dark:border-navy-800' : ''}`}>
      <span className="min-w-0 text-xs font-medium text-slate-500 dark:text-slate-400 tracking-tight">{label}</span>
      <span className={`shrink-0 text-sm data-field ${bold ? 'font-black text-primary-navy dark:text-white' : 'font-bold text-slate-900 dark:text-slate-200'}`}>{value}</span>
    </div>
  );
}

function SummaryBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-slate-50/50 dark:bg-navy-950/40 border border-slate-100 dark:border-navy-800 p-5 text-center shadow-sm">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 tracking-tight mb-2">{label}</div>
      <div className={`text-xl font-black data-field ${color}`}>{value}</div>
    </div>
  );
}

// Stable InputRow defined OUTSIDE ProfitDrawer to prevent re-mount / focus loss
function InputRow({ label, value, onChange, suffix, step }: { label: string; value: number; onChange: (v: string) => void; suffix: string; step?: string }) {
  return (
    <label className="block space-y-1.5 min-w-0">
      <span className="ml-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 tracking-tight">{label}</span>
      <div className="flex min-w-0 items-center gap-3">
        <input type="number" step={step || '0.01'} value={value || ''} onChange={e => onChange(e.target.value)}
          className="w-full min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 px-3 py-2.5 text-sm font-semibold outline-none transition-all focus:border-primary-navy dark:focus:border-tertiary-sage data-field text-slate-900 dark:text-white" />
        <span className="w-12 shrink-0 text-right text-xs font-bold text-slate-400 tracking-tight">{suffix}</span>
      </div>
    </label>
  );
}

function ProfitDrawer({ data, onSave, onClose }: { data: ProfitData; onSave: (d: ProfitData) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(data);
  const [savedBaseline, setSavedBaseline] = useState(data);
  const [saving, setSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const updN = (k: keyof ProfitData, v: string) => setForm({ ...form, [k]: Number(v) || 0 });
  const updS = (k: keyof ProfitData, v: string) => setForm({ ...form, [k]: v });

  // Receipt management
  const receipts = form.receipts || [];
  const addReceipt = () => setForm({ ...form, receipts: [...receipts, { amount: 0, currency: 'USD' as const, bankFees: 0, platformFees: 0, exchangeRate: 7.2 }] });
  const delReceipt = (i: number) => setForm({ ...form, receipts: receipts.filter((_, j) => j !== i) });
  const updReceipt = (i: number, k: keyof typeof receipts[0], v: any) => {
    const next = [...receipts];
    next[i] = { ...next[i], [k]: k === 'currency' ? v : (Number(v) || 0) };
    if (k === 'currency' && v === 'CNY') next[i].exchangeRate = 1;
    if (k === 'currency' && v === 'USD' && next[i].exchangeRate <= 1) next[i].exchangeRate = 7.2;
    setForm({ ...form, receipts: next });
  };

  // Misc fee management
  const addMisc = () => setForm({ ...form, miscFees: [...(form.miscFees || []), { label: '', amount: 0 }] });
  const updMisc = (i: number, k: 'label' | 'amount', v: string) => {
    const next = [...(form.miscFees || [])];
    next[i] = { ...next[i], [k]: k === 'amount' ? Number(v) || 0 : v };
    setForm({ ...form, miscFees: next });
  };
  const delMisc = (i: number) => setForm({ ...form, miscFees: (form.miscFees || []).filter((_, j) => j !== i) });

  // Live multi-phase calc
  let calcTotalNetUsd = 0;
  let calcTotalCnyFromReceipts = 0;
  for (const r of receipts) {
    if (r.currency === 'USD') {
      const net = r.amount - r.bankFees - r.platformFees;
      calcTotalNetUsd += net;
      calcTotalCnyFromReceipts += net * r.exchangeRate;
    } else {
      calcTotalCnyFromReceipts += r.amount - r.bankFees - r.platformFees;
    }
  }
  const calcRefund = form.invoiceAmount > 0 ? (form.invoiceAmount / 1.13 * (form.refundRate / 100)) : 0;
  const calcRevenueCny = calcTotalCnyFromReceipts + calcRefund + (form.otherIncomeCny || 0);
  const calcMiscTotal = (form.miscFees || []).reduce((s, f) => s + (f.amount || 0), 0);
  const calcFreightCny = form.freightCurrency === 'USD' ? (form.freightValue * (receipts[0]?.exchangeRate || 7.2)) : form.freightValue;
  const calcTotalCost = form.factoryCostCny + form.domesticFees + calcFreightCny + form.customsMisc + calcMiscTotal;
  const calcProfit = calcRevenueCny - calcTotalCost;
  const calcMargin = calcRevenueCny > 0 ? (calcProfit / calcRevenueCny) * 100 : 0;

  const hasCnyReceipt = receipts.some(r => r.currency === 'CNY');

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedBaseline);
  const handleClose = () => {
    if (saving) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  };

  const handleSave = async () => {
    if (saving || !isDirty) return;
    try {
      setSaving(true);
      const savedForm = JSON.parse(JSON.stringify(form)) as ProfitData;
      await onSave(savedForm);
      setForm(savedForm);
      setSavedBaseline(savedForm);
      setShowDiscardConfirm(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[420] flex h-dvh justify-end overflow-hidden">
      <button type="button" onClick={handleClose} disabled={saving} className="absolute inset-0 bg-primary-navy/50 dark:bg-black/60 backdrop-blur-sm disabled:cursor-wait" />
      <div className="relative z-10 flex h-dvh max-h-dvh min-h-0 w-full max-w-[750px] flex-col overflow-hidden border-l border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-2xl animate-in slide-in-from-right duration-500">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 dark:border-navy-800 bg-surface dark:bg-navy-950/50 px-4 py-5 sm:px-8 sm:py-6">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-primary-navy dark:text-white tracking-tight">编辑利润核算</h3>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2">统一维护收入、退税、成本与实时利润预估</p>
          </div>
          <button type="button" onClick={handleClose} disabled={saving} className="shrink-0 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-800 p-2 text-slate-400 hover:text-red-600 hover:border-red-200 transition-all shadow-sm disabled:opacity-50"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 custom-scrollbar">
          {/* Revenue with dynamic receipts */}
          <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 dark:border-navy-800 bg-surface dark:bg-navy-950/50 px-5 py-4 flex items-center gap-3">
              <div className="h-4 w-1 rounded-full bg-slate-900 dark:bg-tertiary-sage" />
              <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">收入信息 / Revenue</h4>
            </div>
            <div className="space-y-5 p-5">
              {receipts.map((r, i) => (
                <div key={i} className="p-4 rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/30 space-y-4 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-tertiary-sage tracking-tight">收款明细 {i + 1}</span>
                    {receipts.length > 1 && (
                      <button type="button" onClick={() => delReceipt(i)} className="text-slate-300 hover:text-error transition-colors"><X size={14} /></button>
                    )}
                  </div>

                  {/* Currency toggle */}
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="block space-y-1">
                      <span className="ml-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 tracking-tight">收款金额</span>
                      <input type="number" step="0.01" value={r.amount || ''} onChange={e => updReceipt(i, 'amount', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 px-3 py-2.5 text-sm font-semibold outline-none transition-all focus:border-primary-navy dark:focus:border-tertiary-sage data-field text-slate-900 dark:text-white" />
                    </label>
                    <div className="flex w-full rounded-lg border border-slate-200 dark:border-navy-800 overflow-hidden shrink-0 sm:w-auto">
                      <button type="button" onClick={() => updReceipt(i, 'currency', 'CNY')}
                        className={`flex-1 px-4 py-2.5 text-xs font-bold transition-all ${r.currency === 'CNY' ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-surface dark:bg-navy-950 text-slate-400'}`}>CNY</button>
                      <button type="button" onClick={() => updReceipt(i, 'currency', 'USD')}
                        className={`flex-1 px-4 py-2.5 text-xs font-bold transition-all ${r.currency === 'USD' ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-surface dark:bg-navy-950 text-slate-400'}`}>USD</button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <InputRow label="银行手续费" value={r.bankFees} onChange={v => updReceipt(i, 'bankFees', v)} suffix={r.currency} />
                    <InputRow label="平台与信保" value={r.platformFees} onChange={v => updReceipt(i, 'platformFees', v)} suffix={r.currency} />
                  </div>

                  {r.currency === 'USD' ? (
                    <InputRow label="结汇汇率" value={r.exchangeRate} onChange={v => updReceipt(i, 'exchangeRate', v)} suffix="CNY/USD" step="0.01" />
                  ) : (
                    <div className="rounded-lg bg-slate-50 dark:bg-navy-950 px-3 py-2 text-xs font-medium text-slate-400">人民币收款，汇率锁定为 1</div>
                  )}
                </div>
              ))}

              <button type="button" onClick={addReceipt} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-3 py-2 text-xs font-bold text-tertiary-sage hover:border-tertiary-sage/40 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">
                <Plus size={13} /> 添加一笔收款
              </button>

              {/* Tax Refund Automation */}
              <div className="p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 space-y-3">
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-tight">退税自动化组件</div>
                <div className="grid gap-4 sm:grid-cols-[1fr_140px] sm:items-end">
                  <div>
                    <InputRow label="开票金额 (Invoice)" value={form.invoiceAmount} onChange={v => updN('invoiceAmount', v)} suffix="CNY" />
                  </div>
                  <div>
                    <InputRow label="退税率 %" value={form.refundRate} onChange={v => updN('refundRate', v)} suffix="%" />
                  </div>
                </div>
                {form.invoiceAmount > 0 && (
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    预估退税额：¥{(form.invoiceAmount / 1.13 * (form.refundRate / 100)).toFixed(2)}
                  </div>
                )}
              </div>

              <InputRow label="其他收入 (Other Income)" value={form.otherIncomeCny} onChange={v => updN('otherIncomeCny', v)} suffix="CNY" />
            </div>
          </section>

          {/* Costs (unchanged from V3) */}
          <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 dark:border-navy-800 bg-surface dark:bg-navy-950/50 px-5 py-4 flex items-center gap-3">
              <div className="h-4 w-1 rounded-full bg-slate-900 dark:bg-tertiary-sage" />
              <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">成本费用 / Costs</h4>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <InputRow label="工厂采购价" value={form.factoryCostCny} onChange={v => updN('factoryCostCny', v)} suffix="CNY" />
                <InputRow label="国内费用 (拖车/入仓)" value={form.domesticFees} onChange={v => updN('domesticFees', v)} suffix="CNY" />
              </div>

              <label className="block space-y-1 min-w-0">
                <span className="ml-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 tracking-tight">国际运费 (Freight)</span>
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <input type="number" step="0.01" value={form.freightValue || ''} onChange={e => updN('freightValue', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 px-3 py-2.5 text-sm font-semibold outline-none transition-all focus:border-primary-navy dark:focus:border-tertiary-sage data-field text-slate-900 dark:text-white" />
                  <div className="flex w-full rounded-lg border border-slate-200 dark:border-navy-800 overflow-hidden shrink-0 sm:w-auto">
                    <button type="button" onClick={() => updS('freightCurrency', 'CNY')}
                      className={`flex-1 px-4 py-2.5 text-xs font-bold transition-all ${form.freightCurrency === 'CNY' ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-surface dark:bg-navy-950 text-slate-400'}`}>CNY</button>
                    <button type="button" onClick={() => updS('freightCurrency', 'USD')}
                      className={`flex-1 px-4 py-2.5 text-xs font-bold transition-all ${form.freightCurrency === 'USD' ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-surface dark:bg-navy-950 text-slate-400'}`}>USD</button>
                  </div>
                </div>
              </label>

              <InputRow label="报关与杂费 (包含偏远/产地证等)" value={form.customsMisc} onChange={v => updN('customsMisc', v)} suffix="CNY" />

              {(form.miscFees || []).map((fee, i) => (
                <div key={i} className="grid gap-2 border-l-2 border-tertiary-sage/30 pl-4 sm:grid-cols-[1fr_140px_40px_auto] sm:items-center">
                  <input value={fee.label} onChange={e => updMisc(i, 'label', e.target.value)} placeholder="费用名称" className="flex-1 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 px-3 py-2.5 text-sm font-semibold outline-none transition-all focus:border-primary-navy dark:focus:border-tertiary-sage text-slate-900 dark:text-white" />
                  <input type="number" step="0.01" value={fee.amount || ''} onChange={e => updMisc(i, 'amount', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 px-3 py-2.5 text-sm font-semibold outline-none transition-all focus:border-primary-navy dark:focus:border-tertiary-sage data-field text-slate-900 dark:text-white" />
                  <span className="text-xs font-bold text-slate-400 sm:text-right tracking-tight">CNY</span>
                  <button type="button" onClick={() => delMisc(i)} className="text-slate-300 hover:text-error"><X size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={addMisc} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-3 py-2 text-xs font-bold text-tertiary-sage hover:border-tertiary-sage/40 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all"><Plus size={13} /> 添加杂费明细</button>
            </div>
          </section>

          {/* Live Summary Card */}
          <div className="rounded-lg bg-slate-50/50 dark:bg-navy-950/40 border border-slate-200 dark:border-navy-800 p-5 space-y-3 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-200 dark:border-navy-800 pb-3">
              <div className="h-4 w-1 rounded-full bg-slate-900 dark:bg-tertiary-sage" />
              <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight">实时计算结果</div>
            </div>
            <div className="flex justify-between gap-4 rounded-md px-3 py-2 text-sm"><span className="font-medium text-slate-500 dark:text-slate-400">累计净美金 (Total Net USD)</span><span className="font-bold data-field text-primary-navy dark:text-white">${calcTotalNetUsd.toFixed(2)}</span></div>
            {hasCnyReceipt && <div className="flex justify-between gap-4 rounded-md px-3 py-2 text-sm"><span className="font-medium text-slate-500 dark:text-slate-400">累计人民币收款 (Net CNY)</span><span className="font-bold data-field text-primary-navy dark:text-white">¥{(receipts.filter(r=>r.currency==='CNY').reduce((s,r)=>s+r.amount-r.bankFees-r.platformFees,0)).toFixed(2)}</span></div>}
            <div className="flex justify-between gap-4 rounded-md px-3 py-2 text-sm"><span className="font-medium text-slate-500 dark:text-slate-400">预估总收入 (Total Income)</span><span className="font-bold data-field text-primary-navy dark:text-white">¥{calcRevenueCny.toFixed(2)}</span></div>
            <div className="flex justify-between gap-4 rounded-md px-3 py-2 text-sm"><span className="font-medium text-slate-500 dark:text-slate-400">预估总成本 (Total Cost)</span><span className="font-bold data-field text-primary-navy dark:text-white">¥{calcTotalCost.toFixed(2)}</span></div>
            <div className="flex justify-between gap-4 rounded-md border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-3 py-2.5 text-sm">
              <span className="font-medium text-slate-500 dark:text-slate-400">预估净利润 (Net Profit)</span>
              <span className={`font-black data-field ${calcProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>¥{calcProfit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-4 rounded-md px-3 py-2 text-sm">
              <span className="font-medium text-slate-500 dark:text-slate-400">净利润率 (Margin)</span>
              <span className={`font-black data-field ${calcMargin > 0 && calcMargin < 8 ? 'text-red-600' : calcMargin >= 15 ? 'text-emerald-600' : 'text-amber-600'}`}>{calcMargin.toFixed(2)}%</span>
            </div>
            {calcMargin < 8 && calcMargin > 0 && <div className="mt-2 rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400">风险提示：利润率过低，已触及风控红线 (8%)</div>}
            {calcFreightCny > form.factoryCostCny && form.factoryCostCny > 0 && <div className="rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400">风险提示：国际运费已超过货品成本，请核实物流方案</div>}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 dark:border-navy-800 px-4 py-4 sm:px-8 sm:py-5 flex justify-end gap-3 bg-surface dark:bg-navy-900 shadow-[0_-12px_24px_rgba(15,23,42,0.04)]">
          <button type="button" onClick={handleClose} disabled={saving} className="rounded-lg border border-slate-200 dark:border-navy-700 px-4 py-2.5 sm:px-5 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all disabled:opacity-50">取消</button>
          <button type="button" onClick={handleSave} disabled={saving || !isDirty} className="btn-primary shadow-md disabled:opacity-60 min-w-[112px] sm:min-w-[132px]">
            {saving ? '保存中...' : isDirty ? '保存核算明细' : '已保存'}
          </button>
        </div>
      </div>
      <ConfirmDeleteModal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={() => { setShowDiscardConfirm(false); onClose(); }}
        title="放弃未保存修改"
        warning="当前利润核算表单还有未保存内容，关闭后这些修改不会保留。"
        isDeleting={false}
        showCopy={false}
        variant="warning"
        requireTextConfirm={false}
        cancelLabel="继续编辑"
        confirmLabel="放弃修改"
      />
    </div>
  );
}

// ==================== Production Section ====================

export function ProductionSection({
  sectionRef,
  productionPlan,
  onEditProduction,
  onUpdateInspection,
  onPreview,
  onUploadPhotos,
  onDeleteAttachment,
  onAddProduction,
  user,
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>;
  productionPlan: ProductionPlan | null;
  onEditProduction: () => void;
  onUpdateInspection: (status: InspectionStatus) => Promise<void>;
  onPreview: (att: AttachmentMeta | null) => void;
  onUploadPhotos: (files: FileList | null) => void;
  onDeleteAttachment: (id: number) => Promise<void>;
  onAddProduction: () => void;
  user?: { name?: string; role?: string } | null;
}) {
  const planPhotos = productionPlan?.photos || [];
  const qcPhotos = planPhotos.filter((att) => String(att.remark || '').toUpperCase() === 'DOCTYPE:PRODUCTION_QC');
  const planAttachments = planPhotos.filter((att) => String(att.remark || '').toUpperCase() !== 'DOCTYPE:PRODUCTION_QC');
  const dashboardPlan = productionPlan ? { ...productionPlan, photos: planAttachments } : null;

  return (
    <DocumentBoard ref={sectionRef} title="生产信息" action={productionPlan ? <LightActionButton onClick={onEditProduction} className="!py-1.5 !px-3 !text-xs"><Plus size={14} className="mr-1 opacity-70" /> 更新排产</LightActionButton> : null}>
      {productionPlan ? (
        <>
          <ProductionDashboard plan={dashboardPlan} onEditLink={onEditProduction} onUpdateInspection={onUpdateInspection} onPreview={onPreview} />
          <EvidenceThumbnailGrid
            title="大货与验货记录 (Production & QC Photos)"
            attachments={qcPhotos}
            uploadLabel="+ 上传大货/QC图片"
            onUpload={onUploadPhotos}
            onPreview={onPreview}
            onDeleteAttachment={onDeleteAttachment}
            user={user}
          />
        </>
      ) : (
        <EmptyStateBoard title="暂无排产计划" description="目前该订单尚未关联任何制造工厂。请指派供应商并录入预计交期。" icon={Factory} actionLabel="+ 录入排产单" onAction={onAddProduction} />
      )}
    </DocumentBoard>
  );
}

// ==================== Customs Section ====================

export function CustomsSection({
  sectionRef,
  customs,
  onEditCustoms,
  onUploadDocument,
  onDeleteAttachment,
  onPreview,
  user,
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>;
  customs: CustomsRecord | null;
  onEditCustoms: () => void;
  onUploadDocument: (files: FileList | null, docType: string) => void;
  onDeleteAttachment: (id: number) => Promise<void>;
  onPreview: (att: AttachmentMeta | null) => void;
  user?: { name?: string; role?: string } | null;
}) {
  const taxRefundStatus = getTaxRefundStatus(customs?.status);

  return (
    <DocumentBoard ref={sectionRef} title="报关信息" action={customs ? <LightActionButton onClick={onEditCustoms} className="!py-1.5 !px-3 !text-xs"><ShieldCheck size={14} className="mr-1 opacity-70" /> 更新报关</LightActionButton> : null}>
      {customs ? (
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          <div className="lg:col-span-4 space-y-6 border-r border-slate-100 dark:border-navy-800 pr-8 flex flex-col justify-center">
            <GridItem label="报关单号" value={<span className="data-field font-bold text-primary-navy dark:text-white">{asText(customs?.declarationNo, '待填')}</span>} />
            <GridItem label="报关方式" value={<Chip tone="neutral">{asText(customs?.tradeMode, '一般贸易')}</Chip>} />
            <GridItem label="退税状态" value={<Chip tone={taxRefundStatus.tone}>{taxRefundStatus.label}</Chip>} />
            <GridItem label="报关日期" value={<span className="data-field font-bold text-primary-navy dark:text-white">{formatDateOnly(customs?.declarationDate, '待定')}</span>} />
            <GridItem label="预计出口" value={<span className="data-field font-bold text-primary-navy dark:text-white">{formatDateOnly(customs?.releaseDate, '待定')}</span>} />
          </div>
          <div className="lg:col-span-8 overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-navy-800 pb-3">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">官方凭证电子存根</div>
              <button onClick={onEditCustoms} className="text-xs font-bold text-primary-navy dark:text-tertiary-sage hover:underline">追加文件 +</button>
            </div>
            <SlotDocumentGrid
              slots={CUSTOMS_DOCUMENT_SLOTS}
              documents={customs.attachments || []}
              onUpload={onUploadDocument}
              onPreview={onPreview}
              onDeleteAttachment={onDeleteAttachment}
              user={user}
              uploadLabel="上传"
            />
          </div>
        </div>
      ) : (
        <EmptyStateBoard title="暂无报关信息" description="出货前请维护报关单号、贸易方式、报关日期和官方附件，避免后续出口节点缺资料。" icon={ShieldCheck} actionLabel="+ 初始化报关资料" onAction={onEditCustoms} />
      )}
    </DocumentBoard>
  );
}

// ==================== Packing Section ====================

export function PackingSection({
  sectionRef,
  packingRecords,
  packingPhotos,
  onEditPacking,
  onUploadPhotos,
  onDeleteAttachment,
  onPreview,
  user,
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>;
  packingRecords: PackingRecord[];
  packingPhotos: AttachmentMeta[];
  onEditPacking: () => void;
  onUploadPhotos: (files: FileList | null) => void;
  onDeleteAttachment: (id: number) => Promise<void>;
  onPreview: (att: AttachmentMeta | null) => void;
  user?: { name?: string; role?: string } | null;
}) {
  return (
    <DocumentBoard ref={sectionRef} title="装箱明细" action={packingRecords.length ? <LightActionButton onClick={onEditPacking} className="!py-1.5 !px-3 !text-xs"><Box size={14} className="mr-1 opacity-70" /> 更新装箱</LightActionButton> : null}>
      {packingRecords.length ? (
        <>
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm bg-surface dark:bg-navy-900">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-navy-950 text-xs font-bold tracking-tight text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                <tr><th className="px-5 py-3">序号</th><th className="px-5 py-3">件数 (箱)</th><th className="px-5 py-3">尺寸 / 体积</th><th className="px-5 py-3">毛重 / 净重 (kg)</th><th className="px-5 py-3 text-right">实物图</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800 font-bold text-primary-navy dark:text-white data-field">
                {packingRecords.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                    <td className="px-5 py-3 text-slate-400 dark:text-slate-500">{(i+1).toString().padStart(2, '0')}</td>
                    <td className="px-5 py-3">{r.packageCount}</td>
                    <td className="px-5 py-3">{r.packageSize}</td>
                    <td className="px-5 py-3">{r.grossWeight} / {r.netWeight}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex h-9 w-9 aspect-square shrink-0 rounded border border-slate-200 dark:border-navy-700 bg-surface dark:bg-navy-800 items-center justify-center overflow-hidden shadow-sm cursor-pointer hover:border-primary-navy dark:hover:border-tertiary-sage transition-all" onClick={() => r.imageUrl && onPreview({ id: -1, fileName: `序号 ${i+1} 装箱实拍.jpg`, url: r.imageUrl })}>
                        {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-full w-full object-cover" /> : <Box size={16} className="text-slate-200 dark:text-navy-700" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {(() => {
                  const totalBoxes = packingRecords.reduce((s, r) => s + asNumber(r.packageCount), 0);
                  const totalGross = packingRecords.reduce((s, r) => s + asNumber(r.grossWeight), 0);
                  const totalNet = packingRecords.reduce((s, r) => s + asNumber(r.netWeight), 0);
                  return (
                    <tr className="bg-slate-50/50 dark:bg-navy-950/50 font-extrabold border-t border-slate-200 dark:border-navy-800">
                      <td className="px-5 py-4 text-primary-navy dark:text-white text-xs tracking-tight">合计 Total</td>
                      <td className="px-5 py-4 text-primary-navy dark:text-white data-field">{totalBoxes} 箱</td>
                      <td className="px-5 py-4 text-primary-navy dark:text-white data-field text-xs">见明细</td>
                      <td className="px-5 py-4 text-primary-navy dark:text-white data-field">{totalGross.toFixed(1)} / {totalNet.toFixed(1)} kg</td>
                      <td className="px-5 py-4" />
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>
          <EvidenceThumbnailGrid
            title="包装与装柜留档 (Packing & Loading Photos)"
            attachments={packingPhotos}
            uploadLabel="+ 上传外箱唛头 / 装柜图片"
            onUpload={onUploadPhotos}
            onPreview={onPreview}
            onDeleteAttachment={onDeleteAttachment}
            user={user}
          />
        </>
      ) : (
        <EmptyStateBoard title="暂无装箱数据" description="请录入箱数、尺寸、毛重、净重和实物图，便于报关、订舱和物流交接。" icon={Box} actionLabel="+ 初始化装箱单" onAction={onEditPacking} />
      )}
    </DocumentBoard>
  );
}

// ==================== Logistics Section ====================

function getLogisticsSegmentMeta(segment?: LogisticsRecord['segmentType']) {
  if (segment === 'domestic') {
    return {
      label: '国内运输',
      eyebrow: 'DOMESTIC LEG',
      card: 'border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 hover:border-slate-300 dark:hover:border-navy-700',
      badge: 'border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300',
      icon: 'text-sky-600 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-900/40',
    };
  }

  return {
    label: '国际运输',
    eyebrow: "INT'L LEG",
    card: 'border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 hover:border-slate-300 dark:hover:border-navy-700',
    badge: 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
    icon: 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/40',
  };
}

function getLogisticsStatusMeta(status?: LogisticsRecord['status']) {
  switch (status) {
    case 'preparing':
      return { label: '准备中', className: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
    case 'arrived':
      return { label: '已送达', className: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' };
    case 'shipped':
    default:
      return { label: '运输中', className: 'text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' };
  }
}

const LOGISTICS_ATTACHMENT_PLACEHOLDER = 'https://placehold.co/240x180/e2e8f0/64748b?text=Image';

function getLogisticsAttachmentPreview(att: AttachmentMeta) {
  const isImage = att.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|avif)$/i.test(att.fileName || '');
  return isImage && att.url ? att.url : LOGISTICS_ATTACHMENT_PLACEHOLDER;
}

function getCompactFileName(fileName: string) {
  if (!fileName) return '物流单据';
  if (fileName.length <= 18) return fileName;
  const dotIndex = fileName.lastIndexOf('.');
  const ext = dotIndex > 0 ? fileName.slice(dotIndex) : '';
  return `${fileName.slice(0, 10)}...${ext}`;
}

function EvidenceThumbnailGrid({
  title,
  attachments,
  uploadLabel,
  onUpload,
  onPreview,
  onDeleteAttachment,
  user,
}: {
  title: string;
  attachments?: AttachmentMeta[];
  uploadLabel: string;
  onUpload: (files: FileList | null) => void;
  onPreview: (att: AttachmentMeta | null) => void;
  onDeleteAttachment: (id: number) => Promise<void>;
  user?: { name?: string; role?: string } | null;
}) {
  const safeAttachments = attachments || [];
  return (
    <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50/40 p-4 dark:border-navy-800 dark:bg-navy-950/30">
      <div className="mb-3 text-xs font-black tracking-tight text-slate-500 dark:text-slate-400">{title}</div>
      <div className="flex flex-wrap gap-3">
        {safeAttachments.map((att) => (
          <div key={att.id} className="group/attachment relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 shadow-sm ring-1 ring-black/[0.02] transition-all hover:-translate-y-0.5 hover:border-primary-navy/25 hover:shadow-md dark:border-navy-700 dark:bg-navy-950 dark:hover:border-tertiary-sage/40">
            <Tooltip text={att.fileName}>
              <span className="block h-24 w-24">
                <button type="button" onClick={() => onPreview(att)} className="block h-full w-full text-left">
                  <img src={getLogisticsAttachmentPreview(att)} alt={att.fileName || title} className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1.5 text-[10px] font-bold leading-none text-white backdrop-blur-[2px]">
                    <span className="block truncate">{getCompactFileName(att.fileName)}</span>
                  </div>
                </button>
              </span>
            </Tooltip>
            {user?.role === 'admin' && (
              <button type="button" onClick={() => onDeleteAttachment(att.id)} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/60 text-white shadow-sm backdrop-blur transition-all hover:bg-error" aria-label={`删除附件 ${att.fileName}`}>
                <X size={13} strokeWidth={2.5} />
              </button>
            )}
          </div>
        ))}
        <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-transparent text-center text-slate-400 transition-all hover:border-primary-navy/40 hover:bg-slate-50 hover:text-primary-navy dark:border-navy-700 dark:text-slate-500 dark:hover:border-tertiary-sage/50 dark:hover:bg-navy-950/60 dark:hover:text-tertiary-sage">
          <Plus size={22} strokeWidth={1.8} />
          <span className="px-2 text-[11px] font-black leading-tight tracking-tight">{uploadLabel}</span>
          <input type="file" multiple accept="image/*" className="hidden" onChange={e => { onUpload(e.target.files); e.currentTarget.value = ''; }} />
        </label>
      </div>
    </div>
  );
}

function getTaxRefundStatus(status?: CustomsRecord['status']) {
  switch (status) {
    case 'released':
      return { label: 'Completed', tone: 'success' as const };
    case 'submitted':
    case 'inspected':
      return { label: 'Processing', tone: 'info' as const };
    default:
      return { label: 'Pending', tone: 'warning' as const };
  }
}

export function LogisticsSection({
  sectionRef,
  logisticsRecords,
  hasAnyLogistics,
  onAddLogistics,
  onEditLogistics,
  onDeleteAttachment,
  onPreview,
  user,
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>;
  logisticsRecords: LogisticsRecord[];
  hasAnyLogistics: boolean;
  onAddLogistics: (record?: LogisticsRecord) => void;
  onEditLogistics: (record: LogisticsRecord) => void;
  onDeleteAttachment: (id: number) => Promise<void>;
  onPreview: (att: AttachmentMeta | null) => void;
  user?: { name?: string; role?: string } | null;
}) {
  return (
    <DocumentBoard ref={sectionRef} title="运输轨迹" action={logisticsRecords.length ? <LightActionButton onClick={() => onAddLogistics()} className="!py-1.5 !px-3 !text-xs"><Plus size={14} className="mr-1 opacity-70" /> 录入运单</LightActionButton> : null}>
      {!hasAnyLogistics ? <EmptyStateBoard title="等待货件发运" description="发货后请录入国内或国际运单，维护货代、承运商、提单/运单号和预计到达信息。" actionLabel="录入物流单号" onAction={() => onAddLogistics()} icon={Truck} /> :
        <div className="grid gap-5 md:grid-cols-2">
          {logisticsRecords.map((l) => {
            const segmentMeta = getLogisticsSegmentMeta(l.segmentType);
            const statusMeta = getLogisticsStatusMeta(l.status);
            return (
              <div key={l.id} className={`relative overflow-hidden rounded-lg border p-6 shadow-sm transition-all hover:shadow-md group ${segmentMeta.card}`}>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => onEditLogistics(l)} className="p-2 bg-surface dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-md text-secondary-slate dark:text-slate-400 hover:text-primary-navy dark:hover:text-white shadow-sm"><Edit3 size={16} /></button>
                </div>
                <div className="mb-5 flex items-start justify-between gap-4 pr-10">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm ${segmentMeta.icon}`}><Truck size={18} /></div>
                    <div className="min-w-0">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black tracking-wider ${segmentMeta.badge}`}>{segmentMeta.label}</span>
                      <div className="mt-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-tight">{segmentMeta.eyebrow}</div>
                    </div>
                  </div>
                  <span className={`mt-1 flex shrink-0 items-center gap-1.5 text-xs font-black tracking-tight ${statusMeta.className}`}><div className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} /> {statusMeta.label}</span>
                </div>
                <div className="mb-5 flex flex-col gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 p-4 shadow-sm dark:border-navy-800 dark:bg-navy-950/40">
                      <span className="mb-1 block text-xs font-bold text-slate-400 dark:text-slate-500 tracking-tight leading-none">货运代理</span>
                      <div className="truncate text-sm font-black text-primary-navy dark:text-white">{l.freightForwarderPartnerName || l.freightForwarder || '直接委托'}</div>
                      {l.freightForwarderPartnerId && <div className="mt-1 truncate text-[10px] font-bold text-slate-400">{[l.freightForwarderPartnerCountry, l.freightForwarderPartnerContact].filter(Boolean).join(' · ') || '合作伙伴档案'}</div>}
                    </div>
                    <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 p-4 shadow-sm dark:border-navy-800 dark:bg-navy-950/40">
                      <span className="mb-1 block text-xs font-bold text-slate-400 dark:text-slate-500 tracking-tight leading-none">实际承运商</span>
                      <div className="truncate text-sm font-black text-primary-navy dark:text-white">{l.carrier || '待填写'}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-navy-800 dark:bg-navy-950/40">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-tight">提单/运单号</span>
                    <span className="rounded-[4px] bg-slate-900 px-3 py-1 text-sm font-black text-white shadow-md data-field dark:bg-navy-800">{l.trackingNo || '待同步'}</span>
                  </div>
                  {l.segmentType === 'domestic' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <GridItem label="车牌/司机" value={<span className="data-field font-bold text-primary-navy dark:text-white">{formatTransportMode(l.transportMode, l.remark || '待补充')}</span>} />
                      <GridItem label="预计到仓" value={<span className="data-field font-bold text-primary-navy dark:text-white">{formatDateOnly(l.eta || l.shippingDate, '待定')}</span>} />
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <GridItem label="贸易术语" value={<span className="data-field font-bold text-primary-navy dark:text-white">{formatIncoterm(l.incoterm)}</span>} />
                      <GridItem label="运输方式" value={<span className="data-field font-bold text-primary-navy dark:text-white">{formatTransportMode(l.transportMode, '待确认')}</span>} />
                      <GridItem label="船名/航次" value={<span className="data-field font-bold text-primary-navy dark:text-white">{l.vesselVoyage || '待订舱'}</span>} />
                      <GridItem label="B/L No." value={<span className="data-field font-bold text-primary-navy dark:text-white">{l.billNo || '待出单'}</span>} />
                      <GridItem label="ETD" value={<span className="data-field font-bold text-primary-navy dark:text-white">{formatDateOnly(l.etd, '待定')}</span>} />
                      <GridItem label="ETA" value={<span className="data-field font-bold text-primary-navy dark:text-white">{formatDateOnly(l.eta, '待定')}</span>} />
                    </div>
                  )}
                </div>
                <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs font-bold text-secondary-slate dark:border-navy-800 dark:text-slate-400 tracking-tight">
                  <span>发货日期: <span className="data-field text-primary-navy dark:text-white">{formatDateOnly(l.shippingDate, '待定')}</span></span>
                  {l.recipientAddress && <div className="truncate font-medium normal-case tracking-normal text-slate-500 dark:text-slate-400" title={l.recipientAddress}>收货地址: {l.recipientAddress}</div>}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {(l.attachments || []).map((att: AttachmentMeta) => (
                    <div key={att.id} className="group/attachment relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 shadow-sm ring-1 ring-black/[0.02] transition-all hover:-translate-y-0.5 hover:border-primary-navy/25 hover:shadow-md dark:border-navy-700 dark:bg-navy-950 dark:hover:border-tertiary-sage/40">
                      <Tooltip text={att.fileName}>
                        <span className="block h-24 w-24">
                          <button
                            type="button"
                            onClick={() => onPreview(att)}
                            className="block h-full w-full text-left"
                          >
                            <img
                              src={getLogisticsAttachmentPreview(att)}
                              alt={att.fileName || '物流单据'}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1.5 text-[10px] font-bold leading-none text-white backdrop-blur-[2px]">
                              <span className="block truncate">{getCompactFileName(att.fileName)}</span>
                            </div>
                          </button>
                        </span>
                      </Tooltip>
                      {user?.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => onDeleteAttachment(att.id)}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/60 text-white shadow-sm backdrop-blur transition-all hover:bg-error"
                          aria-label={`删除附件 ${att.fileName}`}
                        >
                          <X size={13} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => onEditLogistics(l)}
                    className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-transparent text-slate-400 transition-all hover:border-primary-navy/40 hover:bg-slate-50 hover:text-primary-navy dark:border-navy-700 dark:text-slate-500 dark:hover:border-tertiary-sage/50 dark:hover:bg-navy-950/60 dark:hover:text-tertiary-sage"
                  >
                    <Plus size={22} strokeWidth={1.8} />
                    <span className="text-[11px] font-black tracking-tight">上传图片</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>}
    </DocumentBoard>
  );
}

// ==================== Tasks Section ====================

export function TasksSection({
  sectionRef,
  tasks,
  onAddTask,
  navigate,
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>;
  tasks: Array<{ id: number; title: string; status: string; assignee_name: string; due_date: string; priority: string }>;
  onAddTask: () => void;
  navigate: (path: string) => void;
}) {
  return (
    <DocumentBoard ref={sectionRef} title="关联协同任务" action={<LightActionButton onClick={onAddTask} className="!py-1.5 !px-3 !text-xs"><Plus size={14} className="mr-1 opacity-70" /> 指派任务</LightActionButton>}>
      {tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map(t => (
            <div key={t.id} onClick={() => navigate(`/tasks?detail=${t.id}`)} className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-navy-950/40 rounded-lg border border-slate-100 dark:border-navy-800 hover:bg-surface dark:hover:bg-navy-800 hover:ring-1 hover:ring-primary-navy/10 dark:hover:ring-tertiary-sage/10 cursor-pointer transition-all group">
              <div className="flex items-center gap-3">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${t.status === 'done' ? 'bg-emerald-50 text-emerald-500' : 'bg-surface border border-slate-200 dark:border-navy-700 text-slate-400'}`}>
                  {t.status === 'done' ? <Check size={12} /> : <Clock size={12} />}
                </div>
                <div>
                  <div className={`text-xs font-bold ${t.status === 'done' ? 'text-slate-400 line-through' : 'text-primary-navy dark:text-white'}`}>{t.title}</div>
                  <div className="text-xs font-bold text-slate-400 tracking-tight mt-0.5">负责人: {t.assignee_name} · 截止: {formatDateOnly(t.due_date)}</div>
                </div>
              </div>
              <Chip tone={t.priority === 'P0' ? 'error' : t.priority === 'P1' ? 'warning' : 'info'}>{t.priority}</Chip>
            </div>
          ))}
        </div>
      ) : (
        <EmptyStateBoard title="暂无关联任务" description="您可以为该订单指派特定的内部协同任务。" icon={CheckCircle2} actionLabel="+ 发起第一项任务" onAction={onAddTask} />
      )}
    </DocumentBoard>
  );
}

// ==================== Follow-ups Timeline Section ====================

export function FollowupsSection({
  followUps,
}: {
  followUps: Array<{ id?: number; content: string; createdByName?: string | null; createdAt?: string }>;
}) {
  return (
    <DocumentBoard title="跟进时间轴" id="followups-timeline">
      <div className="space-y-0">
        {followUps.length > 0 ? followUps.map((fu, i) => (
          <div key={fu.id || i} className="relative pl-8 pb-6 last:pb-0">
            <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-slate-900 dark:border-tertiary-sage bg-surface dark:bg-navy-900" />
            {i < followUps.length - 1 && <div className="absolute left-[8px] top-[22px] bottom-0 w-[2px] bg-slate-100 dark:bg-navy-800" />}
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">{fu.createdByName || '未知用户'}</span>
              <span className="text-xs font-bold text-slate-400 tracking-tight">{formatDateTime(fu.createdAt)}</span>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{fu.content}</p>
          </div>
        )) : (
          <div className="py-12 text-center text-xs font-bold text-slate-400 tracking-tight">暂无跟进记录</div>
        )}
      </div>
    </DocumentBoard>
  );
}

// ==================== Right Rail: Nav ====================

export function NavRailSection({
  activeSection,
  scrollToSection,
  moduleAlerts = {},
}: {
  activeSection: string;
  scrollToSection: (section: string) => void;
  moduleAlerts?: Partial<Record<string, { label: string; tone: 'warning' | 'error' | 'success' | 'neutral' }>>;
}) {
  const navGroups = [
    { group: '订单', items: [{ section: 'items', label: '商品明细' }, { section: 'documents', label: '核心单据' }] },
    { group: '履约', items: [{ section: 'production', label: '生产排产' }, { section: 'packing', label: '装箱明细' }, { section: 'logistics', label: '运输轨迹' }, { section: 'customs', label: '报关资料' }] },
    { group: '结算', items: [{ section: 'finance', label: '财务信息' }, { section: 'profit', label: '利润核算' }] },
    { group: '协同', items: [{ section: 'todos', label: '协同任务' }, { section: 'followups', label: '跟进时间轴' }] },
  ];

  const alertClass = (tone: 'warning' | 'error' | 'success' | 'neutral') => {
    switch (tone) {
      case 'error': return 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40';
      case 'warning': return 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40';
      case 'success': return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40';
      default: return 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-navy-800 dark:text-slate-300 dark:border-navy-700';
    }
  };

  return (
    <section className="bg-surface dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-6 shadow-sm transition-colors">
      <div className="text-xs font-black text-slate-900 dark:text-white mb-5 tracking-tight flex items-center gap-2"><div className="w-1 h-4 bg-slate-900 dark:bg-tertiary-sage rounded-full" /> 页面导航</div>
      <div className="space-y-5">
        {navGroups.map(group => (
          <div key={group.group} className="space-y-1.5">
            <div className="px-2 text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-tight">{group.group}</div>
            {group.items.map(item => {
              const alert = moduleAlerts[item.section];
              const isActive = activeSection === item.section;
              return (
                <button key={item.section} onClick={() => scrollToSection(item.section)} className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-all ${isActive ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white ring-1 ring-slate-200 dark:ring-navy-700' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}>
                  <span className="truncate">{item.label}</span>
                  {alert ? <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${alertClass(alert.tone)}`}>{alert.label}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

// ==================== Right Rail: Quick Follow-up ====================

export function QuickFollowUpSection({
  followUpInput,
  onFollowUpChange,
  onSubmitFollowUp,
  saving,
}: {
  followUpInput: string;
  onFollowUpChange: (v: string) => void;
  onSubmitFollowUp: () => void;
  saving: boolean;
}) {
  return (
    <section className="bg-surface dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-6 shadow-sm space-y-3 transition-colors">
      <div className="text-xs font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 mb-4">
        <div className="w-1 h-4 bg-primary-navy rounded-full" /> 快捷跟进
      </div>
      <textarea
        value={followUpInput}
        onChange={e => onFollowUpChange(e.target.value)}
        placeholder="记录最新跟进动态，例如：今天发了最新版 PI 给客户..."
        rows={4}
        className="w-full bg-slate-50/50 dark:bg-navy-950 px-3 py-2.5 rounded-lg border border-slate-100 dark:border-navy-800 text-sm font-bold text-slate-700 dark:text-white outline-none focus:bg-surface dark:focus:bg-navy-900 transition-all resize-none"
      />
      <button
        onClick={onSubmitFollowUp}
        disabled={saving || !followUpInput.trim()}
        className="w-full btn-primary text-xs py-2.5"
      >
        记录
      </button>
    </section>
  );
}

// ==================== Right Rail: AI Analysis ====================

export function AIAnalysisPanel({
  onOpenAnalysis,
  analyzing,
}: {
  onOpenAnalysis: () => void;
  analyzing: boolean;
}) {
  return (
    <section className="bg-surface dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-6 shadow-sm space-y-3 transition-colors">
      <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white tracking-tight mb-4"><div className="w-1 h-4 bg-emerald-500 rounded-full" /> AI 智能辅助诊断</div>
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed mb-6">正在实时分析订单风险、回款率及交付合规性...</p>
      <button onClick={onOpenAnalysis} disabled={analyzing} className="w-full flex items-center justify-center gap-3 rounded-lg bg-slate-900 dark:bg-navy-800 py-3 text-xs font-bold text-white hover:bg-slate-800 dark:hover:bg-navy-700 transition-all shadow-md group active:scale-95 border border-transparent dark:border-navy-700">
        <Sparkles size={16} className={`${analyzing ? 'animate-spin opacity-50' : 'group-hover:scale-110 transition-transform'}`} />
        <span>开始深度分析</span>
      </button>
    </section>
  );
}
