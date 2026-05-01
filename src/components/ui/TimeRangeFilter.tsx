import React from 'react';
import { TIME_RANGES } from '../../lib/date';

interface TimeRangeFilterProps {
  value: string;
  onChange: (key: string) => void;
}

export default function TimeRangeFilter({ value, onChange }: TimeRangeFilterProps) {
  return (
    <>
      {TIME_RANGES.map(chip => (
        <button
          key={chip.key}
          onClick={() => onChange(chip.key)}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
            value === chip.key
              ? 'bg-primary-navy text-white shadow-sm dark:bg-tertiary-sage'
              : 'border border-slate-200 bg-surface text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-primary-navy dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400 dark:hover:border-navy-600 dark:hover:bg-navy-800 dark:hover:text-white'
          }`}
        >
          {chip.label}
        </button>
      ))}
    </>
  );
}
