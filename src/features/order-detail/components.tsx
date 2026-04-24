import React from 'react';
import { ChevronDown, ChevronUp, Download, Edit3, Image as ImageIcon, Paperclip, Trash2, Wallet } from 'lucide-react';
import type { AttachmentMeta, LogisticsRecord, SectionKey } from './types';
import { formatDateTime } from './utils';

export function DropdownItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-600"
    >
      <span className="text-slate-400">{icon}</span>
      {label}
    </button>
  );
}

export const ActionButton = ({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
  >
    {icon}
    {children}
  </button>
);

export const LightActionButton = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
  >
    {children}
  </button>
);

export const TopMetaCard = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
  </div>
);

export const MetricCard = ({
  title,
  value,
  tone,
  badge,
}: {
  title: string;
  value: React.ReactNode;
  tone: 'blue' | 'green' | 'orange';
  badge?: string;
}) => {
  const toneMap = {
    blue: {
      text: 'text-slate-900',
      icon: 'bg-blue-50 text-blue-600',
    },
    green: {
      text: 'text-emerald-600',
      icon: 'bg-emerald-50 text-emerald-600',
    },
    orange: {
      text: 'text-orange-500',
      icon: 'bg-orange-50 text-orange-500',
    },
  } as const;

  const style = toneMap[tone];

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-wide text-slate-500">{title}</div>
          <div className={`mt-3 text-[18px] font-bold tracking-tight ${style.text}`}>{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${style.icon}`}>
          <Wallet className="h-5 w-5" />
        </div>
      </div>
      {badge ? (
        <div className="mt-2">
          <Tag className="bg-emerald-50 text-emerald-700 border-emerald-200">{badge}</Tag>
        </div>
      ) : null}
    </div>
  );
};

export const MiniMetric = ({
  title,
  value,
  accent = 'text-slate-900',
}: {
  title: string;
  value: React.ReactNode;
  accent?: string;
}) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
    <div className={`mt-1 text-lg font-bold tracking-tight ${accent}`}>{value}</div>
  </div>
);

export const Tag = ({ children, className }: { children: React.ReactNode; className: string }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}>
    {children}
  </span>
);

export const GridItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</div>
    <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
  </div>
);

export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
    {children}
  </label>
);

export const EmptyRow = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">{text}</div>
);

export const FilterPill = ({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) => (
  <button type="button" onClick={onClick} className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
    {children}
  </button>
);

export const AttachmentEditor = ({
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
  onRemoveExisting: (attachmentId: number) => void;
  onRemovePending: (index: number) => void;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="text-sm font-semibold text-slate-800">{title}</div>
    <label className="mt-3 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-600">
      <Paperclip className="mr-2 h-4 w-4" />
      选择附件
      <input type="file" multiple className="hidden" onChange={(event) => onFilesSelected(Array.from(event.target.files || []))} />
    </label>

    {attachments.length ? (
      <div className="mt-3 space-y-2">
        {attachments.map((attachment) => (
          <div key={attachment.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <a href={attachment.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center font-medium text-blue-600 hover:text-blue-700">
              <Paperclip className="mr-2 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{attachment.fileName}</span>
            </a>
            <button type="button" onClick={() => onRemoveExisting(attachment.id)} className="text-slate-400 transition-colors hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    ) : null}

    {newFiles.length ? (
      <div className="mt-3 space-y-2">
        {newFiles.map((file, index) => (
          <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <span className="truncate">{file.name}</span>
            <button type="button" onClick={() => onRemovePending(index)} className="text-slate-400 transition-colors hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    ) : null}
  </div>
);

export const CompactMeta = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-2 text-sm font-medium text-slate-900">{value}</div>
  </div>
);

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
  <section ref={ref} data-section={section} className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        {icon ? <span className="text-slate-400">{icon}</span> : null}
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {action}
        <button onClick={onToggle} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>
    </div>
    {!collapsed ? children : null}
  </section>
));

WorkSection.displayName = 'WorkSection';

export const LogisticsSnapshot = ({
  title,
  record,
  fields,
  onEdit,
  onPreview,
}: {
  title: string;
  record: LogisticsRecord;
  fields: Array<[string, string]>;
  onEdit: () => void;
  onPreview?: (attachment: AttachmentMeta) => void;
}) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-[11px] text-slate-500">最近更新于 {formatDateTime(record.createdAt)}</div>
      </div>
      <LightActionButton onClick={onEdit}>
        <Edit3 className="mr-1.5 h-3.5 w-3.5" />
        编辑
      </LightActionButton>
    </div>
    <div className="grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label}>
          <GridItem label={label} value={value} />
        </div>
      ))}
    </div>
    {record.attachments?.length ? (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {record.attachments.map((attachment) => (
          <button
            key={attachment.id}
            onClick={() => onPreview?.(attachment)}
            className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-medium text-blue-600 ring-1 ring-slate-200 hover:text-blue-700"
          >
            <Paperclip className="mr-1 h-3 w-3" />
            {attachment.fileName}
          </button>
        ))}
      </div>
    ) : null}
  </div>
);

export const ProductImagePlaceholder = () => (
  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-400 ring-1 ring-slate-200">
    <ImageIcon className="h-4 w-4" />
  </div>
);

export function PreviewModal({
  attachment,
  onClose,
}: {
  attachment: AttachmentMeta | null;
  onClose: () => void;
}) {
  if (!attachment) return null;

  const isImage = attachment.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.fileName);
  const isPdf = attachment.mimeType === 'application/pdf' || /\.pdf$/i.test(attachment.fileName);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button onClick={onClose} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
      <div className="relative z-10 flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-slate-900">{attachment.fileName}</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {(attachment.fileSize / 1024).toFixed(1)} KB · {attachment.mimeType}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={attachment.url}
              download={attachment.fileName}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
              title="下载文件"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-6">
          <div className="flex h-full items-center justify-center">
            {isImage ? (
              <img src={attachment.url} alt={attachment.fileName} className="max-h-full max-w-full object-contain" />
            ) : isPdf ? (
              <iframe src={attachment.url} className="h-full w-full rounded-xl" title={attachment.fileName} />
            ) : (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <Paperclip className="h-8 w-8 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-600">该文件类型暂不支持在线预览</p>
                <a
                  href={attachment.url}
                  download={attachment.fileName}
                  className="mt-4 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  下载文件
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
