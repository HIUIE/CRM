import React from 'react';

export default function FilterPill({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
        active
          ? 'bg-primary-navy text-white shadow-sm dark:bg-tertiary-sage'
          : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-primary-navy dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400 dark:hover:border-navy-600 dark:hover:bg-navy-800 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
