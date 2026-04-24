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
  LogOut,
  Sparkles,
  UserRound,
  CalendarClock,
  MapPin,
  Mail,
  X,
  FileCode,
  FileSpreadsheet,
  FileImage,
  Upload,
  MoreVertical,
  Trash,
  History,
  MessageSquarePlus
} from 'lucide-react';
import type { AttachmentMeta, FinanceRecord, LogisticsRecord, SectionKey, ProductionStatus, ProductionPlan, FinanceCategory, FinanceStatus, FinanceType, ProductionLog } from './types';
import { formatDateTime, formatDateOnly, getProductionStatusLabel, asText, asNumber } from './utils';

// --- Verdana Health Design System Constants ---
const CHIP_CLASSES = {
  success: 'bg-[#22C55E15] text-[#16A34A]',
  warning: 'bg-[#EAB30815] text-[#CA8A04]',
  error: 'bg-[#EF444415] text-[#DC2626]',
  info: 'bg-[#0EA5E915] text-[#0284C7]',
  neutral: 'bg-slate-50 text-[#64748B] border border-slate-200',
};

// --- Atomic Components ---

export function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return <FileImage size={14} className="opacity-60" />;
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <FileSpreadsheet size={14} className="opacity-60" />;
  if (['doc', 'docx'].includes(ext || '')) return <FileText size={14} className="opacity-60" />;
  if (['pdf'].includes(ext || '')) return <FileText size={14} className="text-error opacity-60" />;
  return <Paperclip size={14} className="opacity-60" />;
}

export const ActionButton = ({ children, icon, onClick }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 rounded-md bg-primary-navy px-3 py-1.5 text-[12px] font-bold text-white hover:bg-slate-800 transition-colors shadow-sm"
  >
    {icon}
    <span>{children}</span>
  </button>
);

export const LightActionButton = ({ children, onClick, className = '' }: { children: React.ReactNode; onClick: () => void; className?: string }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] font-bold text-primary-navy hover:bg-slate-50 transition-colors ${className}`}
  >
    {children}
  </button>
);

export const Chip = ({ children, tone = 'info' }: { children: React.ReactNode; tone?: keyof typeof CHIP_CLASSES }) => (
  <span className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.5px] ${CHIP_CLASSES[tone]}`}>
    {children}
  </span>
);

export const GridItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="space-y-0.5">
    <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-secondary-slate opacity-70">{label}</div>
    <div className="text-[13px] font-bold text-primary-navy leading-snug">{value}</div>
  </div>
);

export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1">
    <span className="block text-[12px] font-bold text-primary-navy ml-0.5">{label}</span>
    <div className="rounded-md border border-[#E2E8F0] bg-white focus-within:border-primary-navy focus-within:ring-[2px] focus-within:ring-[#0F172A10] transition-all overflow-hidden h-[38px] flex items-center">
      {children}
    </div>
  </label>
);

export const FilterPill = ({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) => (
  <button 
    onClick={onClick} 
    className={`rounded-md px-3 py-1 text-[11px] font-bold transition-all ${
      active 
        ? 'bg-primary-navy text-white shadow-sm' 
        : 'bg-[#F8FAFC] text-secondary-slate border border-[#E2E8F0] hover:bg-slate-100'
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
  <section ref={ref} data-section={section} className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-sm transition-shadow hover:shadow-default">
    <div className="px-5 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="text-secondary-slate opacity-50">{icon}</div>
        <h3 className="text-[14px] font-bold text-primary-navy uppercase tracking-tight">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {action}
        <button onClick={onToggle} className="text-secondary-slate hover:text-primary-navy p-1 transition-colors">
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
    </div>
    {!collapsed && <div className="p-5">{children}</div>}
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
  <div ref={ref} className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-sm hover:shadow-default transition-all">
    <div className="px-5 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between">
      <div className="flex items-center gap-2">
         <div className="h-1 w-3 rounded-full bg-primary-navy opacity-20" />
         <h3 className="text-[14px] font-bold text-primary-navy uppercase tracking-tight">{title}</h3>
      </div>
      <div className="flex gap-2 items-center">
        {action}
      </div>
    </div>
    <div className="p-5">
      {children}
    </div>
  </div>
));
DocumentBoard.displayName = 'DocumentBoard';

// --- Dashboard Specific ---

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
      <div className="space-y-6 border-r border-[#F1F5F9] pr-8">
        <div className="flex items-center justify-between">
           <div className="text-[10px] font-bold text-secondary-slate uppercase tracking-widest">回款汇总</div>
           <select value={activeCurrency} onChange={e=>setActiveCurrency(e.target.value)} className="text-[10px] font-bold text-primary-navy bg-slate-50 px-2 py-0.5 rounded border border-slate-200 outline-none">
             {currencies.map(c=><option key={c} value={c}>{c}</option>)}
           </select>
        </div>
        <div className="space-y-4">
           <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-primary-navy data-field tracking-tighter">{paid.toLocaleString()}</div>
              <div className="text-[11px] font-bold text-secondary-slate uppercase pt-2">{activeCurrency}</div>
           </div>
           {activeCurrency === 'USD' && (
             <div className="space-y-2">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-tertiary-sage rounded-full transition-all duration-1000" style={{ width: `${Math.min(percentage, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-secondary-slate uppercase tracking-widest">
                   <span>订单总额 {totalAmount.toLocaleString()}</span>
                   <span>{percentage}%</span>
                </div>
             </div>
           )}
        </div>
      </div>

      <div className="min-w-0">
        <div className="overflow-hidden rounded-lg border border-slate-100 shadow-sm bg-white">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-[#F8FAFC] font-bold text-secondary-slate uppercase tracking-wider border-b border-slate-100 font-mono text-[10px]">
              <tr>
                <th className="px-4 py-3">日期</th>
                <th className="px-4 py-3">分类</th>
                <th className="px-4 py-3">金额</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium">
              {records.length > 0 ? records.map(record => (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3 text-secondary-slate data-field">{formatDateOnly(record.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Chip tone={record.type === 'receipt' ? 'success' : 'error'}>{record.type === 'receipt' ? '收款' : '付款'}</Chip>
                  </td>
                  <td className={`px-4 py-3 font-bold data-field ${record.type === 'receipt' ? 'text-tertiary-sage' : 'text-error'}`}>
                    {record.type === 'receipt' ? '+' : '-'}{record.currency} {Number(record.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                       {record.attachments && record.attachments.length > 0 && <button type="button" onClick={() => onPreview?.(record.attachments![0])} className="p-1.5 text-secondary-slate hover:text-primary-navy"><Paperclip size={14} /></button>}
                       <button type="button" onClick={() => onEdit?.(record)} className="p-1.5 text-secondary-slate hover:text-primary-navy"><Edit3 size={14} /></button>
                       <button type="button" onClick={() => onDelete?.(record)} className="p-1.5 text-secondary-slate hover:text-error"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-300 font-bold uppercase tracking-widest ">暂无收付款记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ProductionDashboard({
  plan,
  onEditLink,
  onUploadPlan,
  onAddLog,
}: {
  plan: ProductionPlan | null;
  onEditLink: () => void;
  onUploadPlan?: () => void;
  onAddLog?: () => void;
}) {
  const status = plan?.productionStatus || 'not_started';
  const percentage = status === 'ready' ? 100 : status === 'in_progress' ? 60 : status === 'scheduled' ? 20 : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr] items-start">
      <div className="space-y-4 border-r border-[#F1F5F9] pr-6">
        <div className="flex items-center gap-3">
           <div className="text-2xl font-bold text-primary-navy data-field">{percentage}%</div>
           <div className="text-[10px] font-bold text-secondary-slate uppercase tracking-widest leading-none">生产进度</div>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
           <div className="h-full bg-primary-navy rounded-full transition-all duration-[1200ms]" style={{ width: `${percentage}%` }} />
        </div>
        <div className="grid gap-3 pt-2">
          <GridItem label="预期交期" value={<span className="data-field">{plan ? formatDateOnly(plan.estimatedDeliveryDate) : 'TBD'}</span>} />
          <GridItem label="排产状态" value={<Chip tone={status==='ready'?'success':'info'}>{getProductionStatusLabel(status)}</Chip>} />
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between mb-4 border-b border-[#F1F5F9] pb-3">
          <button onClick={onEditLink} className="text-lg font-bold text-primary-navy hover:text-tertiary-sage transition-all data-field uppercase tracking-tighter">
            {plan?.id ? `MO-${plan.id.toString().padStart(6, '0')}` : '初始化排产协议 +'}
          </button>
          <div className="flex gap-2">
            <button onClick={onAddLog} className="p-1.5 text-secondary-slate hover:text-primary-navy border border-slate-200 rounded-md hover:bg-slate-50 transition-all"><MessageSquarePlus size={16} /></button>
            <button onClick={onUploadPlan} className="p-1.5 bg-primary-navy text-white rounded-md hover:bg-slate-800 transition-all shadow-sm"><Upload size={16} /></button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <GridItem label="生产工厂" value={<span className="uppercase truncate block">{plan?.partnerName || 'PENDING'}</span>} />
          <GridItem label="开工时间" value={<span className="data-field">{plan ? formatDateOnly(plan.orderDate) : 'TBD'}</span>} />
          <GridItem label="质检节点" value={<Chip tone="success">QC_OK</Chip>} />
          <GridItem label="工厂国家" value={<span className="uppercase opacity-60">CHINA</span>} />
        </div>

        {plan?.logs && plan.logs.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[#F1F5F9]">
             <div className="text-[10px] font-bold text-secondary-slate uppercase tracking-widest mb-3">最新跟进日志</div>
             <div className="p-3 bg-slate-50 rounded border border-slate-100 text-[13px] font-medium text-secondary-slate leading-relaxed">
                "{plan.logs[0].content}"
                <div className="mt-2 text-[10px] opacity-50 data-field uppercase">{formatDateTime(plan.logs[0].createdAt)} BY {plan.logs[0].createdByName}</div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Utils ---

export const ProductImagePlaceholder = () => (
  <div className="flex h-10 w-10 items-center justify-center rounded bg-cream text-secondary-slate/30 border border-[#E2E8F0] font-bold text-[9px] shadow-inner uppercase">
    SKU
  </div>
);

export function AttachmentEditor({
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
  onRemoveExisting: (id: number) => void;
  onRemovePending: (index: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-[12px] font-bold text-primary-navy uppercase tracking-widest">{title}</h4>
        <label className="cursor-pointer rounded-md bg-slate-50 border border-slate-200 px-4 py-1.5 text-[11px] font-bold text-primary-navy hover:bg-slate-100 transition-all">
          选择文件 +
          <input type="file" multiple className="hidden" onChange={(e) => e.target.files && onFilesSelected(Array.from(e.target.files))} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {attachments.map((att) => (
          <div key={att.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-md group">
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-tertiary-sage">{getFileIcon(att.fileName)}</div>
              <span className="text-[11px] font-medium text-primary-navy truncate">{att.fileName}</span>
            </div>
            <button type="button" onClick={() => onRemoveExisting(att.id)} className="text-secondary-slate hover:text-error opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
          </div>
        ))}
        {newFiles.map((file, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-dashed border-slate-200 rounded-md group">
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-secondary-slate opacity-40"><FileCode size={14} /></div>
              <span className="text-[11px] font-medium text-secondary-slate truncate">{file.name}</span>
            </div>
            <button type="button" onClick={() => onRemovePending(idx)} className="text-secondary-slate hover:text-error opacity-0 group-hover:opacity-100 transition-all"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export const MetricCard = ({ label, value, icon, tone = 'neutral' }: { label: string; value: string | number; icon: React.ReactNode; tone?: keyof typeof CHIP_CLASSES }) => (
  <div className="p-4 bg-white border border-[#E2E8F0] rounded-lg shadow-sm">
    <div className="flex items-center gap-3 mb-2">
      <div className={`p-2 rounded-md ${CHIP_CLASSES[tone]} bg-opacity-10`}>{icon}</div>
      <span className="text-[10px] font-bold text-secondary-slate uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-xl font-bold text-primary-navy data-field">{value}</div>
  </div>
);

export function StatusFileRow({ label, status, fileName, onPreview, onUpload }: { label: string; status: 'uploaded' | 'pending'; fileName?: string; onPreview?: () => void; onUpload?: () => void }) {
  return (
    <div className="flex items-center justify-between group py-3 px-5 rounded-lg border border-transparent hover:bg-slate-50 hover:border-slate-200 transition-all">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded border transition-all ${status === 'uploaded' ? 'bg-white text-tertiary-sage border-emerald-100 shadow-sm' : 'bg-slate-50 text-slate-200 border-slate-200 opacity-50'}`}>
          {fileName ? getFileIcon(fileName) : <FileCode size={18} />}
        </div>
        <div className="min-w-0">
           <button type="button" onClick={onPreview} className="text-[13px] font-bold text-primary-navy hover:text-tertiary-sage transition-all block truncate text-left w-full uppercase tracking-tight">{label}</button>
           <span className="text-[9px] font-bold text-secondary-slate uppercase opacity-50">{status === 'uploaded' ? '已通过电子存档' : '待上传'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
           {status === 'uploaded' ? (
             <>
               <button type="button" onClick={onPreview} className="p-2 rounded-md text-secondary-slate hover:text-primary-navy hover:bg-white transition-all"><CircleHelp size={16} /></button>
               {fileName && <a href={`/api/attachments/download/${fileName}`} download className="p-2 rounded-md text-secondary-slate hover:text-primary-navy hover:bg-white transition-all"><Download size={16} /></a>}
             </>
           ) : (
             <button type="button" onClick={onUpload} className="p-2 rounded-md bg-primary-navy text-white hover:bg-slate-800 transition-all shadow-sm"><Upload size={16} /></button>
           )}
      </div>
    </div>
  );
}

export function RemarkBoard({ content, onEdit }: { content: string; onEdit: () => void }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-sm border-l-4 border-l-warning/40">
      <div className="px-5 py-3 border-b border-slate-50 bg-[#F8FAFC] flex items-center justify-between">
        <h3 className="text-[12px] font-bold text-primary-navy uppercase tracking-widest opacity-80">内部备注</h3>
        <button onClick={onEdit} className="text-[10px] font-bold text-secondary-slate hover:text-primary-navy transition-all">编辑</button>
      </div>
      <div className="p-5 bg-cream shadow-inner min-h-[100px]">
        <p className="text-[13px] font-medium text-primary-navy/70 leading-relaxed uppercase tracking-tight">
          {content || 'NO_DIRECTIVES'}
        </p>
      </div>
    </div>
  );
}

export function EmptyStateBoard({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
      <Truck size={32} className="text-slate-100 mb-3" />
      <h4 className="text-[15px] font-bold text-primary-navy uppercase tracking-tighter mb-1 opacity-70">{title}</h4>
      <p className="text-[11px] font-medium text-secondary-slate uppercase tracking-widest max-w-[240px] text-center opacity-50 mb-6">{description}</p>
      <button onClick={onAction} className="rounded-md bg-primary-navy px-8 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-slate-800 transition-all uppercase tracking-widest">
        {actionLabel}
      </button>
    </div>
  );
}

export function PreviewModal({ attachment, onClose }: { attachment: AttachmentMeta | null; onClose: () => void }) {
  if (!attachment) return null;
  const isImage = attachment.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.fileName);
  const isPdf = attachment.mimeType === 'application/pdf' || /\.pdf$/i.test(attachment.fileName);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button onClick={onClose} className="absolute inset-0 bg-primary-navy/40 backdrop-blur-sm transition-all" />
      <div className="relative z-10 flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-lg border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-[#F8FAFC]">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-primary-navy uppercase">{attachment.fileName}</h3>
            <p className="mt-0.5 text-[10px] font-medium text-secondary-slate uppercase tracking-widest data-field">
              {(attachment.fileSize || 0 / 1024).toFixed(1)} KB · {attachment.mimeType}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md border border-slate-200 bg-white p-1.5 text-secondary-slate hover:text-error"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 p-6 flex items-center justify-center">
          {isPdf ? (
            <iframe src={attachment.url} className="h-full w-full rounded border border-slate-200 bg-white shadow-sm" title={attachment.fileName} />
          ) : isImage ? (
            <img src={attachment.url} alt={attachment.fileName} className="max-h-full max-w-full object-contain rounded shadow-lg bg-white" />
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border border-dashed border-slate-300 bg-white p-12">
              <FileCode size={48} className="text-slate-200" />
              <div className="text-center">
                <p className="text-sm font-bold text-primary-navy uppercase tracking-widest">预览暂不支持</p>
                <p className="mt-1 text-[11px] font-medium text-secondary-slate">请下载后在本地查看此文件类型。</p>
              </div>
              <a href={attachment.url} download className="mt-4 rounded bg-primary-navy px-6 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-slate-800 transition-all uppercase tracking-widest">
                立即下载
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const LogisticsSnapshot = ({ title, record, fields, onEdit, onPreview }: { title: string; record: LogisticsRecord; fields: Array<[string, string]>; onEdit: () => void; onPreview?: (attachment: AttachmentMeta) => void }) => (
  <div className="rounded-lg border border-[#E2E8F0] bg-white p-5 transition-all hover:border-slate-300 relative group shadow-sm">
    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
       <button onClick={onEdit} className="p-1.5 text-secondary-slate hover:text-primary-navy"><Edit3 size={14} /></button>
    </div>
    <div className="mb-4 flex items-center gap-2.5">
      <div className="text-primary-navy opacity-30"><Truck size={16} /></div>
      <div>
        <div className="text-[13px] font-bold text-primary-navy uppercase tracking-wide leading-none">{title}</div>
        <div className="text-[9px] font-medium text-secondary-slate uppercase tracking-widest mt-1 data-field">{formatDateOnly(record.shippingDate)} DEPARTURE</div>
      </div>
    </div>
    <div className="grid gap-y-3 gap-x-8 text-[12px] sm:grid-cols-2 bg-[#F8FAFC] p-4 rounded border border-[#F1F5F9]">
      {fields.map(([label, value]) => (
        <div key={label}>
          <GridItem label={label} value={value} />
        </div>
      ))}
    </div>
    {record.attachments?.length ? (
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {record.attachments.map((attachment) => (
          <button key={attachment.id} onClick={() => onPreview?.(attachment)} className="inline-flex items-center rounded border border-[#E2E8F0] bg-white px-2 py-1 text-[10px] font-bold text-primary-navy hover:bg-slate-50 transition-colors shadow-sm">
            {getFileIcon(attachment.fileName)}
            <span className="ml-1.5 truncate max-w-[100px]">{attachment.fileName}</span>
          </button>
        ))}
      </div>
    ) : null}
  </div>
);

export function HistoryTimeline({ logs, onPreview }: { logs?: ProductionLog[]; onPreview?: (attachment: AttachmentMeta) => void }) {
  if (!logs || logs.length === 0) return null;
  return (
    <div className="mt-8 space-y-4 px-1">
      <div className="text-[12px] font-bold text-primary-navy uppercase tracking-widest opacity-60 mb-4 flex items-center gap-3"><div className="h-px w-8 bg-primary-navy" /> 生产进度时间轴</div>
      <div className="relative space-y-4 before:absolute before:inset-0 before:ml-[11px] before:h-full before:w-[1px] before:bg-slate-100">
        {logs.map((log) => (
          <div key={log.id} className="relative pl-10 group">
            <div className="absolute left-0 mt-1 h-[22px] w-[22px] rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm z-10 transition-colors group-hover:border-primary-navy">
               <Clock size={12} className="text-slate-300 group-hover:text-primary-navy transition-colors" />
            </div>
            <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm group-hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                   <span className="text-[13px] font-bold text-primary-navy uppercase">{log.createdByName}</span>
                   <span className="text-[10px] font-bold text-white bg-primary-navy/60 px-2 py-0.5 rounded-[3px] data-field">{formatDateOnly(log.logDate || log.createdAt)}</span>
                </div>
                <span className="text-[9px] font-medium text-secondary-slate data-field uppercase opacity-50">{formatDateTime(log.createdAt)}</span>
              </div>
              <p className="text-[14px] font-medium text-primary-navy/80 leading-relaxed">{log.content}</p>
              {log.attachments && log.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-slate-50">
                  {log.attachments.map(att => (
                    <button key={att.id} onClick={() => onPreview?.(att)} className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded border border-slate-100 hover:bg-white hover:border-slate-200 transition-all">
                      {getFileIcon(att.fileName)}
                      <span className="text-[10px] font-bold text-primary-navy truncate max-w-[120px]">{att.fileName}</span>
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
