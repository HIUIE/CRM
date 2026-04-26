import React from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, MapPin, Mail, Edit3, DollarSign, Factory, ShieldCheck, Truck, Printer, Trash,
  FileText, Plus, Package, Upload, Download, Wallet, Box, Check, Clock, CheckCircle2, X, Sparkles,
} from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
import {
  WorkSection, DocumentBoard, EmptyStateBoard, FinanceDashboard, ProductionDashboard,
  Chip, GridItem, StatusFileRow, FileIcon, LightActionButton, FilterPill,
} from './components';
import { formatDateOnly, formatDateTime, asNumber, asText, STAGE_STEPS } from './utils';
import type {
  AttachmentMeta, CustomerInfo, FinanceRecord, LogisticsRecord, OrderInfo, OrderItem,
  PackingRecord, ProductionPlan, ProductionStatus, InspectionStatus, SectionKey, FinanceType,
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
    <header ref={headerRef} className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-6 shadow-sm mt-0 transition-colors">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between border-b border-[#F1F5F9] dark:border-navy-800 pb-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-secondary-slate dark:text-slate-400 uppercase tracking-widest leading-none">
              <Link to="/orders" className="hover:text-primary-navy dark:hover:text-tertiary-sage transition-colors">订单管理</Link>
              <ChevronRight size={12} className="opacity-30" />
              <span className="text-primary-navy dark:text-tertiary-sage data-field" style={{ viewTransitionName: 'order-id' }}>{order.display_id}</span>
            </div>
            <h1 className="text-2xl font-bold text-primary-navy dark:text-white tracking-tight truncate mb-4 hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate(`/customers/${customer.display_id}`)}>
              {asText(customer.name, '未命名客户')}
            </h1>
            <div className="flex flex-wrap gap-4 text-xs font-bold text-secondary-slate dark:text-slate-400 uppercase tracking-widest">
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
        <div className="rounded-md bg-[#F8FAFC] dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {STAGE_STEPS.map((s, i) => (
              <button key={s.key} onClick={() => scrollToSection(s.target)} className={`flex-1 min-w-[130px] flex items-center gap-3 px-4 py-2 rounded transition-all ${s.key === order.status ? 'bg-white dark:bg-navy-800 shadow-md ring-1 ring-slate-200 dark:ring-navy-700' : 'opacity-40 hover:opacity-100'}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i <= stageIndex ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'}`}>{i + 1}</span>
                <span className={`text-xs font-bold uppercase tracking-widest ${s.key === order.status ? 'text-primary-navy dark:text-white' : 'text-secondary-slate dark:text-slate-400'}`}>{s.label}</span>
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
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>;
  collapsed: boolean;
  onToggle: () => void;
  items: OrderItem[];
  openOrderDrawer: () => void;
  grandTotal: number;
}) {
  return (
    <WorkSection ref={sectionRef} section="items" title="商品明细" icon={<FileText size={16} />} collapsed={collapsed} onToggle={onToggle} action={items.length ? <LightActionButton onClick={openOrderDrawer} className="!text-xs !px-3"><Plus size={12} className="mr-1" /> 编辑清单</LightActionButton> : null}>
      {items.length ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm">
          <table className="min-w-full text-left text-xs font-medium">
            <thead className="bg-slate-50 dark:bg-navy-950 font-bold uppercase tracking-widest border-b border-slate-200 dark:border-navy-800 data-field text-xs text-secondary-slate dark:text-slate-400">
              <tr><th className="px-5 py-4">产品名称</th><th className="px-5 py-4 text-center">规格/型号</th><th className="px-5 py-4 text-center">数量</th><th className="px-5 py-4 text-center">单位</th><th className="px-5 py-4 text-right">单价 (USD)</th><th className="px-5 py-4 text-right">总价 (USD)</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800 font-medium tracking-tight">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                  <td className="px-5 py-4 font-bold text-primary-navy dark:text-white uppercase">{asText(item.product_name)}</td>
                  <td className="px-5 py-4 text-center text-secondary-slate dark:text-slate-400 text-xs data-field uppercase font-bold">{asText(item.specification, '通用')}</td>
                  <td className="px-5 py-4 text-center font-bold text-primary-navy dark:text-white data-field">{item.quantity}</td>
                  <td className="px-5 py-4 text-center text-secondary-slate dark:text-slate-400 font-bold">{item.unit || 'pcs'}</td>
                  <td className="px-5 py-4 text-right text-secondary-slate dark:text-slate-400 data-field font-bold">{asNumber(item.unit_price).toLocaleString()}</td>
                  <td className="px-5 py-4 text-right font-bold text-primary-navy dark:text-tertiary-sage data-field text-sm">USD {asNumber(item.subtotal).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#F1F5F9] dark:bg-navy-950 text-primary-navy dark:text-white font-extrabold border-t border-slate-200 dark:border-navy-800">
              <tr><td colSpan={5} className="px-5 py-5 text-right text-xs uppercase tracking-widest opacity-70">合计总值 (估算)</td><td className="px-5 py-5 text-right text-xl data-field text-primary-navy dark:text-tertiary-sage">USD {grandTotal.toLocaleString()}</td></tr>
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
  onUploadDocument: (files: FileList | null) => void;
  onPreview: (att: AttachmentMeta | null) => void;
  onDeleteAttachment: (id: number) => Promise<void>;
  user?: { name?: string; role?: string } | null;
}) {
  return (
    <DocumentBoard title="核心单据凭证库" id="documents-vault" action={
      <label className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold transition-all cursor-pointer ${uploadingDoc ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white border-slate-200 dark:border-navy-600 hover:bg-slate-50 dark:hover:bg-navy-700 shadow-sm'}`}>
        {uploadingDoc ? '上传中...' : <><Upload size={14} className="mr-1" /> 上传凭证</>}
        {!uploadingDoc && <input type="file" multiple className="hidden" onChange={e => e.target.files && onUploadDocument(e.target.files)} />}
      </label>
    }>
      {orderDocuments.length ? (
        <div className="grid grid-cols-2 gap-4">
          {orderDocuments.map(doc => (
            <div key={doc.id} className="flex items-center h-14 px-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg group hover:border-primary-navy/20 dark:hover:border-tertiary-sage/20 hover:shadow-sm transition-all">
              <button onClick={() => onPreview(doc)} className="shrink-0 mr-3"><FileIcon fileName={doc.fileName} url={doc.url} size={20} /></button>
              <div className="min-w-0 flex-1">
                <button onClick={() => onPreview(doc)} className="text-xs font-bold text-slate-900 dark:text-white truncate block w-full text-left hover:underline leading-tight" title={doc.fileName}>{doc.fileName}</button>
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
      ) : (
        <EmptyStateBoard title="暂无核心交易凭证" description="请上传双方盖章版 PO、我方 PI 等核心交易凭证，方便业务核对与归档。" icon={FileText} actionLabel="+ 上传首份凭证" onAction={() => document.getElementById('doc-upload-input')?.click()} />
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
        <div className="flex bg-white dark:bg-navy-800 p-0.5 rounded border border-slate-200 dark:border-navy-700">
          <FilterPill active={financeFilter==='all'} onClick={()=>onFilterChange('all')}>全部</FilterPill>
          <FilterPill active={financeFilter==='receipt'} onClick={()=>onFilterChange('receipt')}>收款</FilterPill>
          <FilterPill active={financeFilter==='payment'} onClick={()=>onFilterChange('payment')}>付款</FilterPill>
        </div>
        <LightActionButton onClick={onAdd} className="!py-1.5 !px-3 !text-xs"><Plus size={12} className="mr-1" /> 录入收支</LightActionButton>
      </div>
    ) : null}>
      {financeRecords.length ? (
        <FinanceDashboard totalAmount={grandTotal} records={filteredRecords} receiptsByCurrency={summary.receiptsByCurrency} onPreview={onPreview} onEdit={onEdit} onDelete={onDelete} />
      ) : (
        <EmptyStateBoard title="暂无账务往来" description="该订单目前尚无收付款记录。请及时登记预付、尾款或运费流水。" icon={Wallet} actionLabel="+ 登记第一笔收支" onAction={onAdd} />
      )}
    </DocumentBoard>
  );
}

// ==================== Production Section ====================

export function ProductionSection({
  sectionRef,
  productionPlan,
  onEditProduction,
  onUpdateInspection,
  onPreview,
  onAddProduction,
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>;
  productionPlan: ProductionPlan | null;
  onEditProduction: () => void;
  onUpdateInspection: (status: InspectionStatus) => Promise<void>;
  onPreview: (att: AttachmentMeta | null) => void;
  onAddProduction: () => void;
}) {
  return (
    <DocumentBoard ref={sectionRef} title="生产信息" action={productionPlan ? <LightActionButton onClick={onEditProduction} className="!py-1.5 !px-3 !text-xs"><Plus size={12} className="mr-1" /> 更新排产</LightActionButton> : null}>
      {productionPlan ? (
        <ProductionDashboard plan={productionPlan} onEditLink={onEditProduction} onUpdateInspection={onUpdateInspection} onPreview={onPreview} />
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
  onDeleteAttachment,
  onPreview,
  user,
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>;
  customs: any;
  onEditCustoms: () => void;
  onDeleteAttachment: (id: number) => Promise<void>;
  onPreview: (att: AttachmentMeta | null) => void;
  user?: { name?: string; role?: string } | null;
}) {
  return (
    <DocumentBoard ref={sectionRef} title="报关信息" action={customs ? <LightActionButton onClick={onEditCustoms} className="!py-1.5 !px-3 !text-xs"><ShieldCheck size={14} className="mr-1 opacity-70" /> 更新报关</LightActionButton> : null}>
      {customs ? (
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          <div className="lg:col-span-4 space-y-6 border-r border-slate-100 dark:border-navy-800 pr-8 flex flex-col justify-center">
            <GridItem label="报关单号" value={<span className="data-field uppercase font-bold text-primary-navy dark:text-white">{asText(customs?.declarationNo, '待填')}</span>} />
            <GridItem label="贸易方式" value={<Chip tone="neutral">{asText(customs?.tradeMode, '一般贸易')}</Chip>} />
            <GridItem label="报关日期" value={<span className="data-field uppercase font-bold text-primary-navy dark:text-white">{formatDateOnly(customs?.declarationDate, '待定')}</span>} />
            <GridItem label="预计出口" value={<span className="data-field uppercase font-bold text-primary-navy dark:text-white">{formatDateOnly(customs?.releaseDate, '待定')}</span>} />
          </div>
          <div className="lg:col-span-8 overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-navy-800 pb-3">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">官方凭证电子仓库</div>
              <button onClick={onEditCustoms} className="text-xs font-bold text-primary-navy dark:text-tertiary-sage hover:underline">追加文件 +</button>
            </div>
            <div className="space-y-1">
              {customs?.attachments?.length ? customs.attachments.map((att: AttachmentMeta) => (
                <div key={att.id} className="flex items-center justify-between group">
                  <div className="flex-1 min-w-0"><StatusFileRow label={att.fileName.split('.')[0]} status="uploaded" fileName={att.fileName} onPreview={() => onPreview(att)} /></div>
                  {user?.role === 'admin' && <button onClick={() => onDeleteAttachment(att.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-error opacity-0 group-hover:opacity-100 transition-all"><Trash size={16} /></button>}
                </div>
              )) : (
                <div className="py-12 text-center bg-slate-50/50 dark:bg-navy-950/30 rounded border border-dashed border-slate-200 dark:border-navy-800 text-slate-400 text-xs font-bold uppercase tracking-widest">暂无报关凭证存档</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <EmptyStateBoard title="暂无报关信息" description="货物发出前，请点击此处预录入海关单号与贸易方式。" icon={ShieldCheck} actionLabel="+ 初始化报关资料" onAction={onEditCustoms} />
      )}
    </DocumentBoard>
  );
}

// ==================== Packing Section ====================

export function PackingSection({
  sectionRef,
  packingRecords,
  onEditPacking,
  onPreview,
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>;
  packingRecords: PackingRecord[];
  onEditPacking: () => void;
  onPreview: (att: AttachmentMeta | null) => void;
}) {
  return (
    <DocumentBoard ref={sectionRef} title="装箱明细" action={packingRecords.length ? <LightActionButton onClick={onEditPacking} className="!py-1.5 !px-3 !text-xs"><Box size={14} className="mr-1 opacity-70" /> 更新装箱</LightActionButton> : null}>
      {packingRecords.length ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm bg-white dark:bg-navy-900">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-navy-950 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
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
                    <div className="inline-flex h-9 w-9 aspect-square shrink-0 rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 items-center justify-center overflow-hidden shadow-sm cursor-pointer hover:border-primary-navy dark:hover:border-tertiary-sage transition-all" onClick={() => r.imageUrl && onPreview({ id: -1, fileName: `序号 ${i+1} 装箱实拍.jpg`, url: r.imageUrl })}>
                      {r.imageUrl ? <img src={r.imageUrl} className="h-full w-full object-cover" /> : <Box size={16} className="text-slate-200 dark:text-navy-700" />}
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
                  <tr className="bg-background dark:bg-navy-950/50 font-extrabold border-t border-slate-200 dark:border-navy-800">
                    <td className="px-5 py-4 text-primary-navy dark:text-white text-xs uppercase tracking-widest">合计 Total</td>
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
      ) : (
        <EmptyStateBoard title="暂无装箱数据" description="尚未录入物理包装参数。请点击此处维护各组箱体的尺寸与重量。" icon={Box} actionLabel="+ 初始化装箱单" onAction={onEditPacking} />
      )}
    </DocumentBoard>
  );
}

// ==================== Logistics Section ====================

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
  onAddLogistics: (record?: any) => void;
  onEditLogistics: (record: any) => void;
  onDeleteAttachment: (id: number) => Promise<void>;
  onPreview: (att: AttachmentMeta | null) => void;
  user?: { name?: string; role?: string } | null;
}) {
  return (
    <DocumentBoard ref={sectionRef} title="运输轨迹" action={logisticsRecords.length ? <LightActionButton onClick={() => onAddLogistics()} className="!py-1.5 !px-3 !text-xs"><Plus size={14} className="mr-1 opacity-70" /> 录入运单</LightActionButton> : null}>
      {!hasAnyLogistics ? <EmptyStateBoard title="等待货件发运" description="当前订单尚未关联物流记录，请在发货后及时同步单号。" actionLabel="录入物流单号" onAction={() => onAddLogistics()} icon={Truck} /> :
        <div className="grid gap-5 md:grid-cols-2">
          {logisticsRecords.map((l: any) => (
            <div key={l.id} className="p-6 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg hover:border-primary-navy/20 dark:hover:border-tertiary-sage/20 transition-all group relative shadow-sm hover:shadow-md">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => onEditLogistics(l)} className="p-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-md text-secondary-slate dark:text-slate-400 hover:text-primary-navy dark:hover:text-white shadow-sm"><Edit3 size={16} /></button>
              </div>
              <div className="flex items-center justify-between mb-4">
                <Chip tone="neutral">{l.segmentType === 'domestic' ? '国内运输' : '国际运输'}</Chip>
                <span className="text-tertiary-sage dark:text-emerald-400 flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider"><div className="h-1.5 w-1.5 rounded-full bg-tertiary-sage dark:bg-emerald-400" /> {l.status === 'arrived' ? '已送达' : '运输中'}</span>
              </div>
              <div className="flex flex-col gap-2 mb-5">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none block mb-1">货运代理</span>
                    <div className="text-sm font-bold text-primary-navy dark:text-white truncate">{l.freightForwarder || '直接委托'}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none block mb-1">实际承运商</span>
                    <div className="text-sm font-bold text-primary-navy dark:text-white truncate">{l.carrier}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">提单/运单号</span>
                  <span className="text-sm font-bold text-white bg-slate-900 dark:bg-navy-800 px-3 py-1 rounded-[3px] data-field shadow-md">{l.trackingNo}</span>
                </div>
              </div>
              <div className="mt-2 pt-4 border-t border-slate-50 dark:border-navy-800 flex flex-col gap-2 text-xs font-bold text-secondary-slate dark:text-slate-400 uppercase tracking-widest opacity-80">
                <span>发货日期: {formatDateOnly(l.shippingDate, '待定')}</span>
                {l.recipientAddress && <div className="truncate font-medium" title={l.recipientAddress}>收货地址: {l.recipientAddress}</div>}
              </div>
              {l.attachments && l.attachments.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {l.attachments.map((att: any) => (
                    <div key={att.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-navy-950 rounded border border-slate-100 dark:border-navy-800 text-primary-navy dark:text-white hover:bg-white dark:hover:bg-navy-800 transition-all shadow-sm">
                      <button onClick={() => onPreview(att)} className="flex items-center gap-1.5">
                        <FileIcon fileName={att.fileName} size={12} />
                        <span className="text-xs font-bold truncate max-w-[100px]">{att.fileName.split('.')[0]}</span>
                      </button>
                      {user?.role === 'admin' && <button onClick={() => onDeleteAttachment(att.id)} className="ml-1 text-slate-300 dark:text-slate-700 hover:text-error"><X size={12} /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>}
    </DocumentBoard>
  );
}

// ==================== Tasks Section ====================

export function TasksSection({
  tasks,
  onAddTask,
  navigate,
}: {
  tasks: Array<any>;
  onAddTask: () => void;
  navigate: (path: string) => void;
}) {
  return (
    <DocumentBoard title="关联协同任务" action={<LightActionButton onClick={onAddTask} className="!py-1.5 !px-3 !text-xs"><Plus size={12} className="mr-1" /> 指派任务</LightActionButton>}>
      {tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map(t => (
            <div key={t.id} onClick={() => navigate(`/tasks?detail=${t.id}`)} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950/50 rounded-xl border border-slate-100 dark:border-navy-800 hover:bg-white dark:hover:bg-navy-800 hover:ring-1 hover:ring-primary-navy/10 dark:hover:ring-tertiary-sage/10 cursor-pointer transition-all group">
              <div className="flex items-center gap-3">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${t.status === 'done' ? 'bg-emerald-50 text-emerald-500' : 'bg-white border border-slate-200 dark:border-navy-700 text-slate-400'}`}>
                  {t.status === 'done' ? <Check size={12} /> : <Clock size={12} />}
                </div>
                <div>
                  <div className={`text-xs font-bold ${t.status === 'done' ? 'text-slate-400 line-through' : 'text-primary-navy dark:text-white'}`}>{t.title}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">负责人: {t.assignee_name} · 截止: {formatDateOnly(t.due_date)}</div>
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
            <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-slate-900 dark:border-tertiary-sage bg-white dark:bg-navy-900" />
            {i < followUps.length - 1 && <div className="absolute left-[8px] top-[22px] bottom-0 w-[2px] bg-slate-100 dark:bg-navy-800" />}
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">{fu.createdByName || '未知用户'}</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{formatDateTime(fu.createdAt)}</span>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{fu.content}</p>
          </div>
        )) : (
          <div className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">暂无跟进记录</div>
        )}
      </div>
    </DocumentBoard>
  );
}

// ==================== Right Rail: Nav ====================

export function NavRailSection({
  activeSection,
  scrollToSection,
}: {
  activeSection: string;
  scrollToSection: (section: string) => void;
}) {
  return (
    <section className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-6 shadow-sm transition-colors">
      <div className="text-xs font-black text-slate-900 dark:text-white mb-6 uppercase tracking-widest flex items-center gap-2"><div className="w-1 h-4 bg-slate-900 dark:bg-tertiary-sage rounded-full" /> 页面导航</div>
      <div className="space-y-1.5">
        {[
          { section: 'items', label: '商品明细' },
          { section: 'documents', label: '核心单据' },
          { section: 'finance', label: '财务信息' },
          { section: 'production', label: '生产排产' },
          { section: 'customs', label: '报关资料' },
          { section: 'packing', label: '装箱明细' },
          { section: 'logistics', label: '运输轨迹' },
          { section: 'followups', label: '跟进时间轴' },
        ].map(item => (
          <button key={item.section} onClick={() => scrollToSection(item.section)} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-bold text-sm transition-all ${activeSection === item.section ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span>{item.label}</span>
          </button>
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
    <section className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-6 shadow-sm space-y-3 transition-colors">
      <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2 mb-4">
        <div className="w-1 h-4 bg-primary-navy rounded-full" /> 快捷跟进
      </div>
      <textarea
        value={followUpInput}
        onChange={e => onFollowUpChange(e.target.value)}
        placeholder="记录最新跟进动态，例如：今天发了最新版 PI 给客户..."
        rows={4}
        className="w-full bg-slate-50 dark:bg-navy-950 px-3 py-2.5 rounded-lg border border-slate-100 dark:border-navy-800 text-sm font-bold text-slate-700 dark:text-white outline-none focus:bg-white dark:focus:bg-navy-900 transition-all resize-none"
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
    <section className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-6 shadow-sm space-y-3 transition-colors">
      <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4"><div className="w-1 h-4 bg-emerald-500 rounded-full" /> AI 智能辅助诊断</div>
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed mb-6">正在实时分析订单风险、回款率及交付合规性...</p>
      <button onClick={onOpenAnalysis} disabled={analyzing} className="w-full flex items-center justify-center gap-3 rounded-lg bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800 transition-all shadow-md group active:scale-95">
        <Sparkles size={16} className={`${analyzing ? 'animate-spin opacity-50' : 'group-hover:scale-110 transition-transform'}`} />
        <span>开始深度分析</span>
      </button>
    </section>
  );
}
