import React from 'react';
import { CheckCircle2, X } from 'lucide-react';

export default function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="fixed bottom-12 left-1/2 z-[200] flex -translate-x-1/2 cursor-pointer items-center rounded-lg border border-white/10 bg-slate-900 px-8 py-4 text-sm font-semibold tracking-tight text-white shadow-2xl transition-transform animate-in fade-in zoom-in slide-in-from-bottom-8 hover:scale-105 dark:border-navy-700 dark:bg-navy-800"
    >
      <CheckCircle2 size={20} className="mr-4 text-emerald-400" />
      {message}
      <X size={14} className="ml-6 opacity-40 hover:opacity-100 transition-opacity" />
    </div>
  );
}
