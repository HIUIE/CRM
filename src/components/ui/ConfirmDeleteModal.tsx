import React, { useState } from 'react';
import { AlertTriangle, Copy, Check, Info } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  warning: React.ReactNode;
  entityLabel?: string;
  entityId?: string;
  isDeleting: boolean;
  showCopy?: boolean;
  variant?: 'danger' | 'warning' | 'neutral';
  requireTextConfirm?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  loadingLabel?: string;
}

const DEFAULT_TITLES: Record<string, string> = {
  danger: '删除确认',
  warning: '操作确认',
  neutral: '提示',
};

const DEFAULT_CONFIRM_LABELS: Record<string, string> = {
  danger: '确认删除',
  warning: '确认',
  neutral: '确认',
};

const DEFAULT_LOADING_LABELS: Record<string, string> = {
  danger: '正在删除...',
  warning: '正在处理...',
  neutral: '正在处理...',
};

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  warning,
  entityLabel = '编号',
  entityId = '',
  isDeleting,
  showCopy = true,
  variant = 'danger',
  requireTextConfirm = true,
  confirmLabel,
  cancelLabel = '取消',
  loadingLabel,
}: Props) {
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';
  const canConfirm = !isDeleting && (!requireTextConfirm || input === entityId);

  const headerClasses = isDanger
    ? 'border-red-100 bg-red-50 dark:border-red-900/30 dark:bg-red-900/20'
    : isWarning
      ? 'border-amber-100 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/15'
      : 'border-slate-100 bg-slate-50 dark:border-navy-800 dark:bg-navy-950/50';

  const titleClasses = isDanger
    ? 'text-red-700 dark:text-red-400'
    : isWarning
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-primary-navy dark:text-white';

  const iconClasses = isDanger
    ? 'text-red-600 dark:text-red-400'
    : isWarning
      ? 'text-amber-600 dark:text-amber-300'
      : 'text-slate-500 dark:text-slate-400';

  const borderClasses = isDanger
    ? 'border-red-100 dark:border-red-900/30'
    : 'border-slate-200 dark:border-navy-800';

  const finalTitle = title || DEFAULT_TITLES[variant] || DEFAULT_TITLES.danger;
  const finalConfirmLabel = confirmLabel || DEFAULT_CONFIRM_LABELS[variant] || DEFAULT_CONFIRM_LABELS.danger;
  const finalLoadingLabel = loadingLabel || DEFAULT_LOADING_LABELS[variant] || DEFAULT_LOADING_LABELS.danger;

  const Icon = isDanger ? AlertTriangle : Info;

  const handleCopy = () => {
    if (!entityId) return;
    navigator.clipboard.writeText(entityId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full max-w-md overflow-hidden rounded-lg bg-surface dark:bg-navy-900 shadow-2xl border ${borderClasses} animate-in zoom-in duration-300`}>
        <div className={`flex items-center gap-3 border-b px-6 py-4 ${headerClasses}`}>
          <Icon className={iconClasses} size={20} />
          <h3 className={`text-sm font-extrabold tracking-tight ${titleClasses}`}>{finalTitle}</h3>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
              {warning}
            </p>
            {showCopy && entityId && (
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-100 dark:border-navy-800">
                <span className="font-bold text-primary-navy dark:text-white data-field">{entityId}</span>
                <button onClick={handleCopy} className="flex items-center gap-1 text-xs font-bold text-primary-navy dark:text-tertiary-sage hover:opacity-70 transition-all tracking-tight">
                  {copied ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制{entityLabel}</>}
                </button>
              </div>
            )}
          </div>
          {requireTextConfirm && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 tracking-tight">请输入{entityLabel}以确认删除</label>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={`输入 ${entityId}`}
                className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 px-4 py-3 text-sm font-bold text-primary-navy dark:text-white outline-none focus:border-red-500 transition-all data-field shadow-inner"
              />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 dark:border-navy-800 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all tracking-tight">{cancelLabel}</button>
            <button
              disabled={!canConfirm}
              onClick={onConfirm}
              className={`${isDanger ? 'btn-destructive' : 'rounded-lg bg-slate-900 dark:bg-tertiary-sage px-6 py-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-slate-800 dark:hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed'} flex-2 text-xs px-6 py-3`}
            >
              {isDeleting ? finalLoadingLabel : finalConfirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Lightweight confirmation for non-destructive actions like discarding unsaved changes.
 * No text confirmation required, neutral/warning styling, clean button labels.
 */
export function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  title = '操作确认',
  warning,
  confirmLabel = '确认',
  cancelLabel = '取消',
  isBusy = false,
  variant = 'warning' as 'warning' | 'neutral',
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  warning: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isBusy?: boolean;
  variant?: 'warning' | 'neutral';
}) {
  return (
    <ConfirmDeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      warning={warning}
      isDeleting={isBusy}
      showCopy={false}
      variant={variant}
      requireTextConfirm={false}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      loadingLabel="正在处理..."
    />
  );
}
