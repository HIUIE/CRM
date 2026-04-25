import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Wallet,
  CheckCircle2,
  Clock,
  FileText,
  Factory,
  ShieldCheck,
  Truck,
  Plus,
  CircleHelp,
  Upload,
  FileCode,
  Box,
  MessageSquarePlus,
  X,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';
import type { 
  SectionKey, 
  AttachmentMeta, 
  FinanceRecord, 
  ProductionPlan, 
  ProductionLog, 
  LogisticsRecord,
  LogisticsStatus,
  PackingRecord
} from './types';
import { formatDateOnly, formatDateTime, getProductionStatusLabel } from './utils';

// --- Atomic Components ---

export const ActionButton = ({ children, onClick, icon }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) => (
  <button 
    onClick={onClick} 
    className="flex items-center gap-2 rounded-[4px] bg-primary-navy dark:bg-tertiary-sage px-5 py-2 text-[12px] font-bold text-white shadow-sm transition-all hover:bg-slate-800 dark:hover:bg-emerald-700 active:scale-95"
  >
    <span className="opacity-90">{icon}</span>
    {children}
  </button>
);

export const LightActionButton = ({ children, onClick, className = '' }: { children: React.ReactNode; onClick: () => void; className?: string }) => (
  <button 
    onClick={onClick} 
    className={`flex items-center gap-2 rounded-[4px] border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-800 px-4 py-1.5 text-[11px] font-bold text-primary-navy dark:text-white transition-all hover:bg-slate-50 dark:hover:bg-navy-700 active:scale-95 ${className}`}
  >
    {children}
  </button>
);

const CHIP_CLASSES = {
  success: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30',
  warning: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800/30',
  error: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800/30',
  info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800/30',
  neutral: 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-navy-700',
};

export const Chip = ({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: keyof typeof CHIP_CLASSES }) => (
  <span className={`inline-flex items-center rounded-[3px] border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${CHIP_CLASSES[tone]}`}>
    {children}
  </span>
);

export const GridItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="space-y-1.5">
    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</div>
    <div className="text-[13px] font-bold text-primary-navy dark:text-white leading-tight">{value}</div>
  </div>
);

export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-2">
    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-0.5">{label}</span>
    <div className="relative transition-all overflow-hidden min-h-[42px] flex items-center">
      {children}
    </div>
  </label>
);

export const FilterPill = ({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) => (
  <button 
    onClick={onClick} 
    className={`rounded-md px-3 py-1 text-[11px] font-bold transition-all ${
      active 
        ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-sm' 
        : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700 hover:bg-slate-200 dark:hover:bg-navy-700'
    }`}
  >
    {children}
  </button>
);

// --- Content Boards ---

export const WorkSection = React.forwardRef<
  HTMLDivElement,
  {
    section: SectionKey;
    title: string;
    icon?: React.ReactNode;
    collapsed: boolean;
    onToggle: () => void;
    action?: React.ReactNode;
    children: React.ReactNode;
  }
>(({ section, title, icon, collapsed, onToggle, action, children }, ref) => (
  <section ref={ref} data-section={section} className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg overflow-hidden shadow-md transition-shadow hover:shadow-lg">
    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="text-primary-navy dark:text-tertiary-sage">{icon}</div>
        <h3 className="text-[15px] font-bold text-primary-navy dark:text-white uppercase tracking-tight">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {action}
        <button onClick={onToggle} className="text-slate-400 hover:text-primary-navy dark:hover:text-white p-1 transition-colors ml-2">
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>
    </div>
    {!collapsed && <div className="p-6">{children}</div>}
  </section>
));
WorkSection.displayName = 'WorkSection';

export const DocumentBoard = React.forwardRef<
  HTMLDivElement,
  {
    title: string;
    children: React.ReactNode;
    action?: React.ReactNode;
  }
>(({ title, children, action }, ref) => (
  <div ref={ref} className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all">
    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 flex items-center justify-between">
      <div className="flex items-center gap-3">
         <div className="h-1.5 w-4 rounded-full bg-primary-navy dark:bg-tertiary-sage opacity-30" />
         <h3 className="text-[15px] font-bold text-primary-navy dark:text-white uppercase tracking-tight">{title}</h3>
      </div>
      <div className="flex gap-2 items-center">
        {action}
      </div>
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
));
DocumentBoard.displayName = 'DocumentBoard';

export function RemarkBoard({ content, onEdit }: { content: string; onEdit: () => void }) {
  return (
    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg overflow-hidden shadow-md border-l-4 border-l-warning">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 flex items-center justify-between">
        <h3 className="text-[12px] font-bold text-primary-navy dark:text-white uppercase tracking-widest">内部备注</h3>
        <button onClick={onEdit} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-primary-navy dark:hover:text-white transition-all">编辑</button>
      </div>
      <div className="p-5 bg-slate-50 dark:bg-navy-950/30 shadow-inner min-h-[100px]">
        <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed tracking-tight">
          {content || '尚无内部指令...'}
        </p>
      </div>
    </div>
  );
}

// --- Specific Dashboard Components ---

export function FinanceDashboard({
  totalAmount,
  records,
  receiptsByCurrency = {},
  onPreview,
  onEdit,
  onDelete,
}: {
  totalAmount: number;
  records: FinanceRecord[];
  receiptsByCurrency?: Record<string, number>;
  onPreview?: (attachment: AttachmentMeta) => void;
  onEdit?: (record: FinanceRecord) => void;
  onDelete?: (record: FinanceRecord) => void;
}) {
  const [activeCurrency, setActiveCurrency] = React.useState('USD');
  const currencies = Object.keys(receiptsByCurrency).length > 0 ? Object.keys(receiptsByCurrency) : ['USD'];
  const paid = receiptsByCurrency[activeCurrency] || 0;
  const percentage = activeCurrency === 'USD' && totalAmount > 0 ? Math.round((paid / totalAmount) * 100) : 0;
  
  return (
    <div className="grid gap-10 lg:grid-cols-[260px_1fr] items-start">
      <div className="space-y-6 border-r border-slate-100 dark:border-navy-800 pr-8">
        <div className="flex items-center justify-between">
           <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">回款汇总</div>
           <select value={activeCurrency} onChange={e=>setActiveCurrency(e.target.value)} className="text-[10px] font-bold text-primary-navy dark:text-white bg-white dark:bg-navy-800 px-2 py-0.5 rounded border border-slate-300 dark:border-navy-700 outline-none">
             {currencies.map(c=><option key={c} value={c}>{c}</option>)}
           </select>
        </div>
        <div className="space-y-4">
           <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-primary-navy dark:text-white data-field tracking-tighter">{paid.toLocaleString()}</div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase pt-2">{activeCurrency}</div>
           </div>
           {activeCurrency === 'USD' && (
             <div className="space-y-2">
                <div className="h-2 w-full bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden shadow-inner">
                   <div className="h-full bg-tertiary-sage rounded-full transition-all duration-1000" style={{ width: `${Math.min(percentage, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                   <span>订单总额 {totalAmount.toLocaleString()}</span>
                   <span className="text-primary-navy dark:text-tertiary-sage">{percentage}%</span>
                </div>
             </div>
           )}
        </div>
      </div>

      <div className="min-w-0">
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm bg-white dark:bg-navy-900">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-slate-50 dark:bg-navy-950/50 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-navy-800 font-mono text-[10px]">
              <tr>
                <th className="px-4 py-3.5">日期</th>
                <th className="px-4 py-3.5">分类</th>
                <th className="px-4 py-3.5">金额</th>
                <th className="px-4 py-3.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800 font-medium">
              {records.length > 0 ? records.map(record => (
                <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors group">
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 data-field">{formatDateOnly(record.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    <Chip tone={record.type === 'receipt' ? 'success' : 'error'}>{record.type === 'receipt' ? '收款' : '付款'}</Chip>
                  </td>
                  <td className={`px-4 py-3.5 font-bold data-field text-[14px] ${record.type === 'receipt' ? 'text-tertiary-sage' : 'text-error'}`}>
                    {record.type === 'receipt' ? '+' : '-'}{record.currency} {Number(record.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                       {record.attachments && record.attachments.length > 0 && <button type="button" onClick={() => onPreview?.(record.attachments![0])} className="p-1.5 text-slate-500 hover:text-primary-navy dark:hover:text-white hover:bg-white dark:hover:bg-navy-700 rounded-md transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-navy-600"><Paperclip size={14} /></button>}
                       <button type="button" onClick={() => onEdit?.(record)} className="p-1.5 text-slate-500 hover:text-primary-navy dark:hover:text-white hover:bg-white dark:hover:bg-navy-700 rounded-md transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-navy-600"><Edit3 size={14} /></button>
                       <button type="button" onClick={() => onDelete?.(record)} className="p-1.5 text-slate-400 hover:text-error hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all shadow-sm border border-transparent hover:border-red-200 dark:hover:border-red-800"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="p-0"><EmptyStateBoard title="暂无财务记录" description="点击右上角登记第一笔收支流水，开始追踪回款状态。" icon={Wallet} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ProductionDashboard({ plan, onEditLink, onUploadPlan, onAddLog }: { plan: ProductionPlan | null; onEditLink: () => void; onUploadPlan: () => void; onAddLog: () => void }) {
  const status = plan?.productionStatus || 'not_started';
  const percentage = status === 'ready' ? 100 : status === 'in_progress' ? 60 : status === 'scheduled' ? 20 : 0;
  
  return (
    <div className="grid gap-10 lg:grid-cols-[260px_1fr] items-center">
      <div className="space-y-5 border-r border-slate-100 dark:border-navy-800 pr-8">
        <div className="flex items-center justify-between">
           <div className="text-[28px] font-bold text-primary-navy dark:text-white data-field tracking-tighter">{percentage}%</div>
           <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">生产进度</div>
        </div>
        <div className="h-2 w-full bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden shadow-inner">
           <div className="h-full bg-primary-navy dark:bg-tertiary-sage rounded-full transition-all duration-[1200ms]" style={{ width: `${percentage}%` }} />
        </div>
        <div className="grid gap-3 pt-2">
          <GridItem label="预期交期" value={<span className="data-field">{plan ? formatDateOnly(plan.estimatedDeliveryDate) : '待定'}</span>} />
          <GridItem label="排产状态" value={<Chip tone={status==='ready'?'success':'info'}>{getProductionStatusLabel(status)}</Chip>} />
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between mb-5 border-b border-slate-100 dark:border-navy-800 pb-4">
          <button onClick={onEditLink} className="text-xl font-bold text-primary-navy dark:text-white hover:text-tertiary-sage transition-all data-field uppercase tracking-tighter flex items-center gap-2">
            {plan?.id ? `MO-${plan.id.toString().padStart(6, '0')}` : '+ 录入排产单'}
          </button>
          <div className="flex gap-2.5">
            <button onClick={onUploadPlan} title="上传文件" className="p-2 bg-primary-navy dark:bg-tertiary-sage text-white rounded-md hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all shadow-md"><Upload size={18} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 bg-slate-50 dark:bg-navy-950/50 p-5 rounded-lg border border-slate-100 dark:border-navy-800">
          <GridItem label="生产工厂" value={<span className="uppercase truncate block text-slate-700 dark:text-slate-200 font-extrabold">{plan?.partnerName || '待指派'}</span>} />
          <GridItem label="下单日期" value={<span className="data-field text-slate-700 dark:text-slate-300">{plan ? formatDateOnly(plan.orderDate) : '待处理'}</span>} />
          <GridItem label="当前节点" value={<Chip tone={status === 'ready' ? 'success' : 'warning'}>{status === 'ready' ? '已完工' : '生产中'}</Chip>} />
          <GridItem label="质检状态" value={
            <button onClick={onEditLink} className="flex items-center gap-1.5 text-info dark:text-blue-400 font-bold uppercase hover:underline">
               <span>质检通过</span>
               <ChevronDown size={12} />
            </button>
          } />
        </div>
      </div>
    </div>
  );
}

// --- Utils ---

export const ProductImagePlaceholder = () => (
  <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-50 dark:bg-navy-800 text-slate-300 dark:text-navy-600 border border-slate-200 dark:border-navy-700 font-bold text-[9px] shadow-inner uppercase">
    IMG
  </div>
);

export function EmptyStateBoard({ title, description, actionLabel, onAction, icon: Icon = Truck }: { title: string; description: string; actionLabel?: string; onAction?: () => void; icon?: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50 dark:bg-navy-950/30 rounded-xl border border-dashed border-slate-300 dark:border-navy-800 shadow-inner transition-colors">
      <div className="h-14 w-14 rounded-full bg-white dark:bg-navy-900 flex items-center justify-center mb-5 shadow-sm border border-slate-100 dark:border-navy-800">
        <Icon size={28} className="text-slate-200 dark:text-navy-800" />
      </div>
      <h4 className="text-[14px] font-bold text-primary-navy dark:text-white uppercase tracking-tight mb-1.5">{title}</h4>
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest max-w-[280px] text-center leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="mt-6 rounded-lg bg-primary-navy dark:bg-tertiary-sage px-8 py-2.5 text-[11px] font-bold text-white shadow-md hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all uppercase tracking-widest active:scale-95">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function AttachmentEditor({
  title,
  attachments,
  newFiles,
  onFilesSelected,
  onRemoveExisting,
  onRemovePending,
  isUploading = false,
  uploadProgress = 0,
}: {
  title: string;
  attachments: AttachmentMeta[];
  newFiles: File[];
  onFilesSelected: (files: File[]) => void;
  onRemoveExisting: (id: number) => void;
  onRemovePending: (index: number) => void;
  isUploading?: boolean;
  uploadProgress?: number;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-[12px] font-bold text-primary-navy dark:text-white uppercase tracking-widest">{title}</h4>
        <label className={`rounded-md border px-5 py-2 text-[11px] font-bold transition-all ${isUploading ? 'bg-slate-100 dark:bg-navy-950 text-slate-400 border-slate-200 dark:border-navy-800 cursor-not-allowed' : 'bg-slate-50 dark:bg-navy-800 text-primary-navy dark:text-white border-slate-300 dark:border-navy-600 hover:bg-slate-100 dark:hover:bg-navy-700 cursor-pointer shadow-sm'}`}>
          {isUploading ? '正在上传...' : '选择文件 +'}
          {!isUploading && <input type="file" multiple className="hidden" onChange={(e) => e.target.files && onFilesSelected(Array.from(e.target.files))} />}
        </label>
      </div>

      {isUploading && (
        <div className="space-y-2.5 animate-in fade-in zoom-in duration-300">
           <div className="flex justify-between items-center text-[10px] font-extrabold text-primary-navy dark:text-white uppercase tracking-widest">
              <span>文件上传进度</span>
              <span className="data-field">{uploadProgress}%</span>
           </div>
           <div className="h-2 w-full bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden shadow-inner border border-slate-200 dark:border-navy-700">
              <div className="h-full bg-primary-navy dark:bg-tertiary-sage rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
           </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {attachments.map((att) => (
          <div key={att.id} className="flex items-center justify-between p-3.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg group shadow-sm hover:border-slate-300 dark:hover:border-navy-600 transition-all">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="text-tertiary-sage opacity-80">{getFileIcon(att.fileName)}</div>
              <span className="text-[12px] font-bold text-primary-navy dark:text-white truncate">{att.fileName}</span>
            </div>
            <button type="button" onClick={() => onRemoveExisting(att.id)} className="text-slate-400 hover:text-error opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={16} /></button>
          </div>
        ))}
        {newFiles.map((file, idx) => (
          <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-navy-950/50 border border-dashed border-slate-300 dark:border-navy-800 rounded-lg group opacity-70 hover:opacity-100 transition-all">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="text-slate-400"><FileCode size={16} /></div>
              <span className="text-[12px] font-bold text-slate-600 dark:text-slate-400 truncate">{file.name}</span>
            </div>
            <button type="button" onClick={() => onRemovePending(idx)} className="text-slate-400 hover:text-error opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><X size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export const MetricCard = ({ label, value, icon, tone = 'neutral' }: { label: string; value: string | number; icon: React.ReactNode; tone?: keyof typeof CHIP_CLASSES }) => (
  <div className="p-5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg shadow-md hover:shadow-lg transition-all">
    <div className="flex items-center gap-3.5 mb-3">
      <div className={`p-2.5 rounded-lg ${CHIP_CLASSES[tone]} border`}>{icon}</div>
      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-2xl font-bold text-primary-navy dark:text-white data-field tracking-tighter">{value}</div>
  </div>
);

export function StatusFileRow({
  label,
  status,
  fileName,
  downloadUrl,
  onPreview,
  onUpload,
}: {
  label: string;
  status: 'uploaded' | 'pending';
  fileName?: string;
  downloadUrl?: string;
  onPreview?: () => void;
  onUpload?: () => void;
}) {
  return (
    <div className="flex items-center justify-between group py-3.5 px-5 rounded-lg border border-transparent hover:bg-slate-50 dark:hover:bg-navy-800 hover:border-slate-200 dark:hover:border-navy-700 transition-all">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded border-2 transition-all ${status === 'uploaded' ? 'bg-white dark:bg-navy-900 text-tertiary-sage border-emerald-100 dark:border-emerald-900/50 shadow-sm' : 'bg-slate-50 dark:bg-navy-950 text-slate-200 dark:text-navy-800 border-slate-200 dark:border-navy-800 opacity-50'}`}>
          {fileName ? getFileIcon(fileName, 20) : <FileCode size={20} />}
        </div>
        <div className="min-w-0">
           <button type="button" onClick={onPreview} className="text-[14px] font-bold text-primary-navy dark:text-white hover:text-tertiary-sage transition-all block truncate text-left w-full uppercase tracking-tight">{label}</button>
           <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5 block">{status === 'uploaded' ? '已归档 · 官方凭证' : '待处理'}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
           {status === 'uploaded' ? (
             <>
               <button type="button" onClick={onPreview} className="p-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-primary-navy dark:hover:text-white hover:bg-white dark:hover:bg-navy-700 border border-transparent hover:border-slate-200 dark:hover:border-navy-600 transition-all shadow-sm hover:shadow-default"><CircleHelp size={18} /></button>
               {fileName && downloadUrl ? <a href={downloadUrl} download className="p-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-primary-navy dark:hover:text-white hover:bg-white dark:hover:bg-navy-700 border border-transparent hover:border-slate-200 dark:hover:border-navy-600 transition-all shadow-sm hover:shadow-default"><Download size={18} /></a> : null}
             </>
           ) : (
             <button type="button" onClick={onUpload} className="p-2.5 rounded-lg bg-primary-navy dark:bg-tertiary-sage text-white hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all shadow-md"><Upload size={18} /></button>
           )}
      </div>
    </div>
  );
}

export function PreviewModal({ attachment, onClose }: { attachment: AttachmentMeta | null; onClose: () => void }) {
  if (!attachment) return null;
  const isImage = attachment.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.fileName);
  const isPdf = attachment.mimeType === 'application/pdf' || /\.pdf$/i.test(attachment.fileName);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button onClick={onClose} className="absolute inset-0 bg-primary-navy/40 dark:bg-black/60 backdrop-blur-md transition-all" />
      <div className="relative z-10 flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white dark:bg-navy-900 shadow-2xl border border-slate-200 dark:border-navy-800 animate-in zoom-in fade-in duration-300">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-8 py-5 bg-slate-50 dark:bg-navy-950/50">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-primary-navy dark:text-white uppercase tracking-tight">{attachment.fileName}</h3>
            <p className="mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest data-field">
               {attachment.mimeType}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-800 p-2 text-slate-400 hover:text-error hover:border-red-200 dark:hover:border-red-900 transition-all shadow-sm"><X size={22} /></button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-200/30 dark:bg-navy-950/50 p-8 flex items-center justify-center">
          {isPdf ? (
            <iframe src={attachment.url} className="h-full w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-lg" title={attachment.fileName} />
          ) : isImage ? (
            <img src={attachment.url} alt={attachment.fileName} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl bg-white dark:bg-navy-900 border-4 border-white dark:border-navy-800" />
          ) : (
            <div className="flex flex-col items-center justify-center space-y-6 rounded-2xl border border-dashed border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 p-16 shadow-inner">
              <div className="h-24 w-24 rounded-full bg-slate-50 dark:bg-navy-950 flex items-center justify-center border border-slate-100 dark:border-navy-800">
                 <FileCode size={48} className="text-slate-200 dark:text-navy-800" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-primary-navy dark:text-white uppercase tracking-tighter">预览暂不支持</p>
                <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">请下载后在本地查看此文件类型。</p>
              </div>
              <a href={attachment.url} download className="mt-4 rounded-xl bg-primary-navy dark:bg-tertiary-sage px-10 py-3 text-sm font-bold text-white shadow-lg hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all uppercase tracking-widest active:scale-95">
                立即下载文件
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const LogisticsSnapshot = ({ title, record, fields, onEdit, onPreview }: { title: string; record: LogisticsRecord; fields: Array<[string, string]>; onEdit: () => void; onPreview?: (attachment: AttachmentMeta) => void }) => (
  <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 transition-all hover:border-primary-navy/20 relative group shadow-md hover:shadow-lg">
    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all">
       <button onClick={onEdit} className="p-2 bg-white dark:bg-navy-800 rounded-md border border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 hover:text-primary-navy dark:hover:text-white shadow-sm hover:shadow-default"><Edit3 size={16} /></button>
    </div>
    <div className="mb-5 flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-slate-50 dark:bg-navy-950 flex items-center justify-center text-primary-navy dark:text-tertiary-sage border border-slate-100 dark:border-navy-800 shadow-inner"><Truck size={20} /></div>
      <div>
        <div className="text-[14px] font-bold text-primary-navy dark:text-white uppercase tracking-tight leading-none">{title}</div>
        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1.5 data-field">{formatDateOnly(record.shippingDate)} DEPARTURE</div>
      </div>
    </div>
    <div className="grid gap-y-4 gap-x-10 text-[13px] sm:grid-cols-2 bg-slate-50/50 dark:bg-navy-950/50 p-5 rounded-lg border border-slate-100 dark:border-navy-800">
      {fields.map(([label, value]) => (
        <div key={label}>
          <GridItem label={label} value={value} />
        </div>
      ))}
    </div>
  </div>
);

export function HistoryTimeline({ logs, onPreview }: { logs?: ProductionLog[]; onPreview?: (attachment: AttachmentMeta) => void }) {
  if (!logs || logs.length === 0) return null;
  return (
    <div className="mt-8 space-y-5 px-1">
      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[2px] mb-6 flex items-center gap-3"><div className="h-px w-10 bg-slate-300 dark:bg-navy-800" /> 生产进度时间轴</div>
      <div className="relative space-y-4 before:absolute before:inset-0 before:ml-[13px] before:h-full before:w-[1px] before:bg-slate-200 dark:before:bg-navy-800">
        {logs.map((log) => (
          <div key={log.id} className="relative pl-12 group">
            <div className="absolute left-0 mt-1.5 h-[26px] w-[26px] rounded-full bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-800 flex items-center justify-center shadow-sm z-10 transition-all group-hover:border-primary-navy dark:group-hover:border-tertiary-sage group-hover:scale-110">
               <Clock size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-primary-navy dark:group-hover:text-tertiary-sage transition-colors" />
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-5 shadow-md group-hover:shadow-lg transition-all border-l-[6px] border-l-primary-navy/10 dark:border-l-tertiary-sage/10 group-hover:border-l-primary-navy dark:group-hover:border-l-tertiary-sage">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                   <span className="text-[14px] font-bold text-primary-navy dark:text-white uppercase tracking-tight">{log.createdByName}</span>
                   <span className="text-[10px] font-extrabold text-white bg-slate-900 dark:bg-navy-800 px-2.5 py-1 rounded-[4px] data-field shadow-sm">{formatDateOnly(log.logDate || log.createdAt)}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 data-field uppercase">{formatDateTime(log.createdAt)}</span>
              </div>
              <p className="text-[14px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed mb-4">{log.content}</p>
              {log.attachments && log.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2.5 pt-4 border-t border-slate-100 dark:border-navy-800">
                  {log.attachments.map(att => (
                    <button key={att.id} onClick={() => onPreview?.(att)} className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-200 dark:border-navy-800 hover:bg-white dark:hover:bg-navy-800 hover:border-primary-navy/20 dark:hover:border-tertiary-sage/20 transition-all shadow-sm hover:shadow-default">
                      <div className="text-slate-400 group-hover:text-primary-navy dark:group-hover:text-tertiary-sage">{getFileIcon(att.fileName, 14)}</div>
                      <span className="text-[11px] font-bold text-primary-navy dark:text-white truncate max-w-[140px]">{att.fileName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Internal Helpers ---

function getFileIcon(fileName: string, size = 16) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon size={size} />;
  if (ext === 'pdf') return <FileText size={size} />;
  return <Paperclip size={size} />;
}
