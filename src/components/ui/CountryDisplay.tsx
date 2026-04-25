import React from 'react';
import { COUNTRIES } from '../../lib/countries';

interface CountryDisplayProps {
  value: string;
  className?: string;
}

export default function CountryDisplay({ value, className = '' }: CountryDisplayProps) {
  if (!value) return <span className="text-slate-400">—</span>;

  const normalized = value.trim().toLowerCase();
  const found = COUNTRIES.find(c =>
    c.code.toLowerCase() === normalized ||
    c.name.toLowerCase() === normalized ||
    c.nameZh === value.trim()
  );

  if (!found) {
    return <span className={`font-bold text-primary-navy dark:text-white ${className}`}>{value}</span>;
  }

  return (
    <div className={`flex items-center gap-2 font-bold text-primary-navy dark:text-white ${className}`}>
      <span className="text-lg leading-none select-none" role="img" aria-label={found.name}>
        {found.flag}
      </span>
      <span className="truncate">
        {found.nameZh} <span className="text-slate-400 dark:text-slate-500 font-medium text-[11px] ml-1">({found.name})</span>
      </span>
    </div>
  );
}
