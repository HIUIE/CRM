import React, { useState } from 'react';
import { AlertTriangle, Copy, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  warning: React.ReactNode;
  entityLabel: string;
  entityId: string;
  isDeleting: boolean;
  showCopy?: boolean;
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = '高危删除确认',
  warning,
  entityLabel,
  entityId,
  isDeleting,
  showCopy = true,
}: Props) {
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(entityId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-lg bg-white dark:bg-navy-900 shadow-2xl border border-red-100 dark:border-red-900/30 animate-in zoom-in duration-300">
        <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-6 py-4 dark:border-red-900/30 dark:bg-red-900/20">
          <AlertTriangle className="text-red-600 dark:text-red-400" size={20} />
          <h3 className="text-sm font-extrabold text-red-700 dark:text-red-400 tracking-tight">{title}</h3>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
              {warning}
            </p>
            {showCopy && (
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-100 dark:border-navy-800">
                <span className="font-bold text-primary-navy dark:text-white data-field">{entityId}</span>
                <button onClick={handleCopy} className="flex items-center gap-1 text-xs font-bold text-primary-navy dark:text-tertiary-sage hover:opacity-70 transition-all tracking-tight">
                  {copied ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制{entityLabel}</>}
                </button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 tracking-tight">请输入{entityLabel}以确认删除</label>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`输入 ${entityId}`}
              className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 px-4 py-3 text-sm font-bold text-primary-navy dark:text-white outline-none focus:border-red-500 transition-all data-field shadow-inner"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 dark:border-navy-800 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all tracking-tight">取消</button>
            <button
              disabled={isDeleting || input !== entityId}
              onClick={onConfirm}
              className="btn-destructive flex-2 text-xs px-6 py-3"
            >
              {isDeleting ? '正在销毁...' : '确认永久删除'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
