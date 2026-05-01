import React from 'react';
import { Truck } from 'lucide-react';

export default function EmptyStateBoard({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Truck,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ComponentType<{ size?: number }> | React.ReactNode;
}) {
  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    const IconComp = Icon as React.ComponentType<{ size?: number; className?: string }>;
    return <IconComp size={24} className="text-slate-300 dark:text-navy-800" />;
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50 dark:bg-navy-950/30 rounded-lg border border-dashed border-slate-200 dark:border-navy-800 transition-colors">
      <div className="h-12 w-12 rounded-full bg-surface dark:bg-navy-900 flex items-center justify-center mb-4 shadow-sm border border-slate-100 dark:border-navy-800">
        {renderIcon()}
      </div>
      <h4 className="mb-1 text-sm font-bold tracking-tight text-slate-900 dark:text-white">{title}</h4>
      <p className="max-w-[320px] text-center text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-primary text-xs px-6 py-2 mt-6">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
