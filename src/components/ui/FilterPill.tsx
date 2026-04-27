import React from 'react';

export default function FilterPill({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-all ${
        active
          ? 'bg-primary-navy dark:bg-tertiary-sage text-white'
          : 'bg-background text-primary-navy border border-[#E2E8F0] dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-700'
      }`}
    >
      {children}
    </button>
  );
}
