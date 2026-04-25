import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { COUNTRIES, type Country } from '../../lib/countries';

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export default function CountrySelect({ value, onChange, required, placeholder = '搜索或选择国家/地区...', className = '' }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedCountry = COUNTRIES.find(c =>
    c.name === value || c.nameZh === value || c.code === value ||
    `${c.flag} ${c.nameZh} (${c.name})` === value
  );

  const displayValue = selectedCountry ? `${selectedCountry.flag} ${selectedCountry.nameZh} (${selectedCountry.name})` : value;

  const filtered = search.trim()
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.nameZh.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (country: Country) => {
    onChange(country.name); // store English name for consistency
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm transition-colors outline-none cursor-pointer
          ${open
            ? 'border-primary-navy dark:border-tertiary-sage ring-1 ring-primary-navy/20 dark:ring-tertiary-sage/20'
            : 'border-slate-200 dark:border-navy-800 hover:border-slate-300 dark:hover:border-navy-700'
          }
          bg-white dark:bg-navy-900 text-primary-navy dark:text-white`}
      >
        <span className={`flex-1 text-left truncate ${!selectedCountry && !value ? 'text-slate-400 dark:text-slate-500' : ''}`}>
          {value ? displayValue : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-xl overflow-hidden">
          {/* Search bar */}
          <div className="p-2 border-b border-slate-100 dark:border-navy-800">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索国家..."
                className="w-full pl-8 pr-3 py-2 text-[13px] bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-200 dark:border-navy-800 outline-none text-primary-navy dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-[12px] text-slate-400 font-medium">未找到匹配国家</div>
            ) : (
              filtered.map(country => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleSelect(country)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors
                    ${selectedCountry?.code === country.code
                      ? 'bg-primary-navy/5 dark:bg-tertiary-sage/10 text-primary-navy dark:text-tertiary-sage font-bold'
                      : 'hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300'
                    }`}
                >
                  <span className="text-base w-6 shrink-0 text-center">{country.flag}</span>
                  <span className="font-medium">{country.nameZh}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-[11px] ml-auto shrink-0">{country.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Hidden input for required validation */}
      {required && (
        <input
          tabIndex={-1}
          required
          value={value}
          onChange={() => {}}
          style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}
