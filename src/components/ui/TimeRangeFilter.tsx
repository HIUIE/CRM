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
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            value === chip.key
              ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-sm'
              : 'bg-slate-50 dark:bg-navy-950 text-secondary-slate dark:text-slate-400 border border-slate-100 dark:border-navy-800 hover:bg-slate-100 dark:hover:bg-navy-800'
          }`}
        >
          {chip.label}
        </button>
      ))}
    </>
  );
}
