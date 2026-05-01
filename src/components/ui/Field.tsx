import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface FieldProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  error?: string;
  className?: string;
}

export default function Field({ label, description, children, error, className = '' }: FieldProps) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="ml-0.5 text-xs font-semibold tracking-tight text-slate-500 dark:text-slate-400">{label}</span>
      {description && (
        <span className="ml-0.5 block text-[11px] text-slate-400 dark:text-slate-500">{description}</span>
      )}
      <div className="relative transition-all overflow-visible min-h-[42px] flex items-center">
        {children}
      </div>
      {error && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-red-500 animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}
    </label>
  );
}
