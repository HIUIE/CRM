import React from 'react';
import {
  ChevronDown,
  ChevronRight,
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
  Check,
  Package
} from 'lucide-react';
import type { 
  SectionKey, 
  AttachmentMeta, 
  FinanceRecord, 
  ProductionPlan, 
  ProductionLog, 
  LogisticsRecord,
  LogisticsStatus,
  PackingRecord,
  ProductionStatus,
  InspectionStatus
} from './types';
import { formatDateOnly, formatDateTime, getProductionStatusLabel, getInspectionStatusLabel } from './utils';
import Chip from '../../components/ui/Chip';
import EmptyStateBoard from '../../components/ui/EmptyStateBoard';

// --- Atomic Components ---

export const ActionButton = ({ children, onClick, icon }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="btn-primary text-xs px-5 py-2.5"
  >
    <span className="opacity-90">{icon}</span>
    {children}
  </button>
);

export const LightActionButton = ({ children, onClick, className = '' }: { children: React.ReactNode; onClick: () => void; className?: string }) => (
  <button
    onClick={onClick}
    className={`btn-secondary text-xs px-4 py-2 ${className}`}
  >
    {children}
  </button>
);

export { default as Chip } from '../../components/ui/Chip';

export const GridItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="space-y-1">
    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</div>
    <div className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{value}</div>
  </div>
);

export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-0.5">{label}</span>
    <div className="relative transition-all overflow-hidden min-h-[42px] flex items-center">
      {children}
    </div>
  </label>
);

export { default as FilterPill } from '../../components/ui/FilterPill';

export { default as Toast } from '../../components/ui/Toast';

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
  <section ref={ref} data-section={section} className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg overflow-hidden shadow-sm transition-shadow hover:shadow-md">
    <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-800 bg-white dark:bg-navy-950/50 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-4 w-1 rounded-full bg-slate-900 dark:bg-tertiary-sage" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {action}
        <button onClick={onToggle} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 transition-colors ml-2">
          {collapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
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
    id?: string;
  }
>(({ title, children, action, id }, ref) => (
  <div id={id} ref={ref} className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all">
    <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-800 bg-white dark:bg-navy-950/50 flex items-center justify-between">
      <div className="flex items-center gap-3">
         <div className="h-4 w-1 rounded-full bg-slate-900 dark:bg-tertiary-sage" />
         <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">{title}</h3>
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
    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg overflow-hidden shadow-sm border-l-4 border-l-amber-400">
      <div className="px-6 py-3 border-b border-slate-100 dark:border-navy-800 bg-white dark:bg-navy-950/50 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">内部备注 / Internal Notes</h3>
        <button onClick={onEdit} className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-all">编辑</button>
      </div>
      <div className="p-6 bg-slate-50/50 dark:bg-navy-950/30 min-h-[100px]">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed tracking-tight">
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
    <div className="grid gap-8 lg:grid-cols-12 items-start">
      <div className="lg:col-span-4 space-y-6 border-r border-slate-100 dark:border-navy-800 pr-8">
        <div className="flex items-center justify-between">
           <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">回款汇总</div>
           <select value={activeCurrency} onChange={e=>setActiveCurrency(e.target.value)} className="text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 outline-none">
             {currencies.map(c=><option key={c} value={c}>{c}</option>)}
           </select>
        </div>
        <div className="space-y-4">
           <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter">{paid.toLocaleString()}</div>
              <div className="text-sm font-semibold text-slate-500 uppercase">{activeCurrency}</div>
           </div>
           {activeCurrency === 'USD' && (
             <div className="space-y-3">
                <div className="flex justify-between text-xs font-medium text-slate-500 uppercase tracking-wider">
                   <span>订单总额 {totalAmount.toLocaleString()}</span>
                   <span className="text-emerald-600 font-bold">{percentage}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden shadow-inner">
                   <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(percentage, 100)}%` }} />
                </div>
             </div>
           )}
        </div>
      </div>

      <div className="lg:col-span-8 min-w-0">
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm bg-white dark:bg-navy-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-950/50 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-xs">
              <tr>
                <th className="px-6 py-4">收支日期</th>
                <th className="px-6 py-4">类目</th>
                <th className="px-6 py-4">流水金额</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {records.length > 0 ? records.map(record => (
                <React.Fragment key={record.id}>
                  <tr className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-slate-600 font-medium">{formatDateOnly(record.createdAt)}</td>
                    <td className="px-6 py-4">
                      <Chip tone={record.type === 'receipt' ? 'success' : 'error'}>{record.type === 'receipt' ? '收款' : '付款'}</Chip>
                    </td>
                    <td className={`px-6 py-4 font-bold text-sm ${record.type === 'receipt' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {record.type === 'receipt' ? '+' : '-'}{record.currency} {Number(record.amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {record.attachments && record.attachments.length > 0 && record.attachments.map(att => (
                          <button
                            key={att.id}
                            type="button"
                            onClick={() => onPreview?.(att)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-all"
                            title={att.fileName}
                          >
                            {getFileIcon(att.fileName, 12)}
                            <span className="max-w-[80px] truncate">{att.fileName}</span>
                          </button>
                        ))}
                        <button type="button" onClick={() => onEdit?.(record)} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-white rounded-md transition-all border border-transparent hover:border-slate-200"><Edit3 size={14} /></button>
                        <button type="button" onClick={() => onDelete?.(record)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all border border-transparent hover:border-red-100"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
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

export function ProductionDashboard({
  plan,
  onEditLink,
  onPreview,
  onUpdateInspection,
}: {
  plan: ProductionPlan | null;
  onEditLink: () => void;
  onPreview?: (att: AttachmentMeta) => void;
  onUpdateInspection?: (status: InspectionStatus) => void;
}) {
  const status = plan?.productionStatus || 'not_started';
  const percentage = status === 'ready' ? 100 : status === 'in_progress' ? 60 : status === 'scheduled' ? 20 : 0;

  const statusLabel = plan?.id ? `MO-${plan.id.toString().padStart(6, '0')}` : '尚未录入生产计划';

  return (
    <div className="grid gap-8 lg:grid-cols-12 items-start">
      {/* 左侧 col-span-4：核心状态总览 */}
      <div className="lg:col-span-4 space-y-6 border-r border-slate-100 dark:border-navy-800 pr-8">
        <div>
          <h4 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight uppercase mb-2">{statusLabel}</h4>
          <Chip tone={status==='ready'?'success':'warning'}>{getProductionStatusLabel(status)}</Chip>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">生产进度</span>
            <span className="text-sm font-bold text-emerald-600 data-field">{percentage}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: '#22C55E'
              }}
            />
          </div>
        </div>
      </div>

      {/* 右侧 col-span-8：白底 + 浅灰边框（镜像财务容器风格） */}
      <div className="lg:col-span-8 overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm bg-white dark:bg-navy-900 p-6">
        <div className="grid grid-cols-4 gap-6">
          <GridItem label="制造工厂" value={<span className="truncate block font-bold text-slate-900 uppercase">{plan?.partnerName || '待指派'}</span>} />
          <GridItem label="排产日期" value={<span className="font-semibold text-slate-700">{plan ? formatDateOnly(plan.orderDate) : '待处理'}</span>} />
          <GridItem label="预期交期" value={<span className="font-semibold text-slate-700">{plan ? formatDateOnly(plan.estimatedDeliveryDate) : '待定'}</span>} />
          <GridItem label="质检结论" value={
            <div className="relative inline-block">
               <select
                 value={plan?.inspectionStatus || 'pending'}
                 onChange={e => onUpdateInspection?.(e.target.value as InspectionStatus)}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
               >
                 <option value="pending">待质检</option>
                 <option value="passed">质检通过</option>
                 <option value="failed">质检异常</option>
               </select>
               <div className="flex items-center gap-1.5 text-blue-600 font-bold uppercase cursor-pointer hover:underline text-xs">
                  <span>{getInspectionStatusLabel(plan?.inspectionStatus || 'pending')}</span>
                  <ChevronDown size={14} />
               </div>
            </div>
          } />
        </div>
        {plan?.photos && plan.photos.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-navy-800">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">计划单附件 ({plan.photos.length})</div>
            <div className="flex flex-wrap gap-3">
              {plan.photos.map(att => (
                <button key={att.id} onClick={() => onPreview?.(att)} className="group relative w-20 h-20 rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden bg-slate-50 dark:bg-navy-950 hover:ring-2 hover:ring-primary-navy/20 dark:hover:ring-tertiary-sage/20 transition-all shrink-0">
                  {att.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.fileName) ? (
                    <img src={att.url} alt={att.fileName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <FileText size={20} className="text-slate-300" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const MetricCard = ({ label, value, icon, tone = 'neutral' }: { label: string; value: string | number; icon: React.ReactNode; tone?: 'success' | 'warning' | 'error' | 'info' | 'neutral' }) => (
  <div className="p-6 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg shadow-sm hover:shadow-md transition-all">
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2 rounded-lg ${tone === 'success' ? 'chip-success' : tone === 'warning' ? 'chip-warning' : tone === 'error' ? 'chip-error' : tone === 'info' ? 'chip-info' : 'chip-neutral'} border`}>{icon}</div>
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tighter">{value}</div>
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
    <div className="flex items-center justify-between group py-3 px-4 rounded-lg border border-transparent hover:bg-slate-50 dark:hover:bg-navy-800 hover:border-slate-200 dark:hover:border-navy-700 transition-all">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className={`flex h-10 w-10 aspect-square shrink-0 items-center justify-center rounded border transition-all ${status === 'uploaded' ? 'bg-white dark:bg-navy-900 text-emerald-600 border-emerald-100 dark:border-emerald-900/50 shadow-sm' : 'bg-slate-50 dark:bg-navy-950 text-slate-300 dark:text-navy-800 border-slate-200 dark:border-navy-800 opacity-50'}`}>
          {fileName ? getFileIcon(fileName, 18) : <FileCode size={18} />}
        </div>
        <div className="min-w-0">
           <button type="button" onClick={onPreview} className="text-sm font-semibold text-slate-900 dark:text-white hover:text-slate-600 transition-all block truncate text-left w-full uppercase tracking-tight">{label}</button>
           <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5 block">{status === 'uploaded' ? '已归档 · Official' : '待处理'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
           {status === 'uploaded' ? (
             <>
               <button type="button" onClick={onPreview} className="p-2 rounded-md text-slate-400 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-all"><CircleHelp size={16} /></button>
               {fileName && downloadUrl ? <a href={downloadUrl} download className="p-2 rounded-md text-slate-400 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-all"><Download size={16} /></a> : null}
             </>
           ) : (
             <button type="button" onClick={onUpload} className="p-2 rounded-md bg-primary-navy text-white hover:bg-navy-950 transition-all shadow-sm"><Upload size={16} /></button>
           )}
      </div>
    </div>
  );
}

export { default as EmptyStateBoard } from '../../components/ui/EmptyStateBoard';

export function AttachmentEditor({
  title,
  attachments,
  newFiles,
  onFilesSelected,
  onRemoveExisting,
  onRemovePending,
  onUpdatePendingRemark,
  isUploading = false,
  uploadProgress = 0,
  showRemarkInput = false,
}: {
  title: string;
  attachments: AttachmentMeta[];
  newFiles: Array<{ file: File; remark: string }>;
  onFilesSelected: (files: File[]) => void;
  onRemoveExisting: (id: number) => void;
  onRemovePending: (index: number) => void;
  onUpdatePendingRemark?: (index: number, remark: string) => void;
  isUploading?: boolean;
  uploadProgress?: number;
  showRemarkInput?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">{title}</h4>
        <label className={`btn-secondary text-xs px-5 py-2 cursor-pointer ${isUploading ? 'opacity-40 pointer-events-none' : ''}`}>
          {isUploading ? '正在上传...' : '选择文件 +'}
          {!isUploading && <input type="file" multiple className="hidden" onChange={(e) => e.target.files && onFilesSelected(Array.from(e.target.files))} />}
        </label>
      </div>

      {isUploading && (
        <div className="space-y-2.5 animate-in fade-in zoom-in duration-300">
           <div className="flex justify-between items-center text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-widest">
              <span>文件上传进度</span>
              <span className="data-field">{uploadProgress}%</span>
           </div>
           <div className="h-2 w-full bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden shadow-inner border border-slate-200 dark:border-navy-700">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
           </div>
        </div>
      )}

      <div className="grid gap-4">
        {attachments.map((att) => (
          <div key={att.id} className="flex items-center justify-between p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg group shadow-sm">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="text-slate-400 opacity-80">{getFileIcon(att.fileName)}</div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">{att.fileName}</span>
                {att.remark && <span className="text-xs text-slate-400 font-medium italic">备注: {att.remark}</span>}
              </div>
            </div>
            <button type="button" onClick={() => onRemoveExisting(att.id)} className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={16} /></button>
          </div>
        ))}
        
        {newFiles.map((item, idx) => (
          <div key={idx} className="p-4 bg-slate-50 dark:bg-navy-950/50 border border-dashed border-slate-300 dark:border-navy-800 rounded-lg space-y-3 group">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3.5 min-w-0">
                 <div className="text-slate-400"><FileCode size={16} /></div>
                 <span className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">{item.file.name}</span>
               </div>
               <button type="button" onClick={() => onRemovePending(idx)} className="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><X size={16} /></button>
            </div>
            {showRemarkInput && (
              <input 
                type="text" 
                placeholder="为此照片添加备注说明 (如：包装细节、大货实拍)..." 
                value={item.remark}
                onChange={e => onUpdatePendingRemark?.(idx, e.target.value)}
                className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-slate-900 transition-all"
              />
            )}
          </div>
        ))}
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
      <button onClick={onClose} className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md transition-all" />
      <div className="relative z-10 flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white dark:bg-navy-900 shadow-2xl border border-slate-200 dark:border-navy-800 animate-in zoom-in fade-in duration-300">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-8 py-5 bg-white dark:bg-navy-950/50">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">{attachment.fileName}</h3>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest data-field">
               {attachment.mimeType}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-800 p-2 text-slate-400 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"><X size={22} /></button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-navy-950/50 p-8 flex items-center justify-center">
          {isPdf ? (
            <iframe src={attachment.url} className="h-full w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-lg" title={attachment.fileName} />
          ) : isImage ? (
            <img src={attachment.url} alt={attachment.fileName} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl bg-white dark:bg-navy-900 border-4 border-white dark:border-navy-800" />
          ) : (
            <div className="flex flex-col items-center justify-center space-y-6 rounded-lg border border-dashed border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 p-16 shadow-inner">
              <div className="h-24 w-24 rounded-full bg-slate-50 dark:bg-navy-950 flex items-center justify-center border border-slate-100 dark:border-navy-800">
                 <FileCode size={48} className="text-slate-200 dark:text-navy-800" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tighter">预览暂不支持</p>
                <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">请下载后在本地查看此文件类型。</p>
              </div>
              <a href={attachment.url} download className="mt-4 rounded-lg bg-slate-900 dark:bg-tertiary-sage px-10 py-3 text-sm font-bold text-white shadow-lg hover:bg-slate-800 transition-all uppercase tracking-widest active:scale-95">
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
  <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 transition-all hover:shadow-md relative group shadow-sm">
    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all">
       <button onClick={onEdit} className="p-2 bg-white rounded-md border border-slate-200 text-slate-400 hover:text-slate-900 transition-all"><Edit3 size={16} /></button>
    </div>
    <div className="mb-6 flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-900 border border-slate-100 shadow-inner"><Truck size={20} /></div>
      <div>
        <div className="text-sm font-bold text-slate-900 uppercase tracking-tight leading-none">{title}</div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">{formatDateOnly(record.shippingDate)} DEPARTURE</div>
      </div>
    </div>
    <div className="grid gap-6 text-sm sm:grid-cols-2 bg-slate-50/50 p-6 rounded-lg border border-slate-100">
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
    <div className="mt-8 space-y-6">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-3"><div className="h-px w-8 bg-slate-200" /> 生产进度时间轴 / Production Timeline</div>
      <div className="relative space-y-6 before:absolute before:inset-0 before:ml-[13px] before:h-full before:w-[2px] before:bg-slate-100">
        {logs.map((log) => (
          <div key={log.id} className="relative pl-12 group">
            <div className="absolute left-0 mt-1.5 h-[26px] w-[26px] rounded-full bg-white border-4 border-slate-900 flex items-center justify-center shadow-sm z-10">
               <div className="h-1.5 w-1.5 rounded-full bg-white" />
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm group-hover:shadow-md transition-all border-l-4 border-l-slate-100 group-hover:border-l-slate-900">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                   <span className="text-sm font-bold text-slate-900 uppercase">{log.createdByName}</span>
                   <span className="text-xs font-bold text-white bg-slate-900 px-2 py-0.5 rounded uppercase tracking-wider">{formatDateOnly(log.logDate || log.createdAt)}</span>
                </div>
                <span className="text-xs font-medium text-slate-400 uppercase">{formatDateTime(log.createdAt)}</span>
              </div>
              <p className="text-sm font-medium text-slate-600 leading-relaxed mb-4">{log.content}</p>
              {log.attachments && log.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-50">
                  {log.attachments.map(att => (
                    <button key={att.id} onClick={() => onPreview?.(att)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 hover:bg-white hover:border-slate-200 transition-all shadow-sm">
                      <div className="text-slate-400 group-hover:text-slate-900">{getFileIcon(att.fileName, 12)}</div>
                      <span className="text-xs font-semibold text-slate-900 truncate max-w-[140px]">{att.fileName}</span>
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

export const ProductImagePlaceholder = ({ url, name }: { url?: string; name: string }) => (
  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-900 group">
    {url ? (
      <img src={url} alt={name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <Package size={24} className="text-slate-300" />
      </div>
    )}
  </div>
);

export function FileIcon({ fileName, url, size = 16 }: { fileName: string; url?: string; size?: number }) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const isImage = url && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
  if (isImage) {
    return <img src={url} alt={fileName} className="rounded object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  if (ext === 'pdf') return <FileText size={size} className="text-red-500 shrink-0" />;
  if (['doc', 'docx'].includes(ext || '')) return <FileCode size={size} className="text-blue-500 shrink-0" />;
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <FileText size={size} className="text-emerald-500 shrink-0" />;
  return <Paperclip size={size} className="text-slate-400 shrink-0" />;
}

function getFileIcon(fileName: string, size = 16) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon size={size} className="text-sky-500" />;
  if (ext === 'pdf') return <FileText size={size} className="text-red-500" />;
  if (['doc', 'docx'].includes(ext || '')) return <FileCode size={size} className="text-blue-500" />;
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <FileText size={size} className="text-emerald-500" />;
  return <Paperclip size={size} className="text-slate-400" />;
}
