import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check, Loader2, X } from 'lucide-react';

interface Option {
  value: string | number;
  label: string;
  subLabel?: string;
}

interface ComboboxProps {
  value: string | number;
  onChange: (value: string | number) => void;
  onSearch: (query: string) => Promise<Option[]>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({ value, onChange, onSearch, placeholder = '请选择...', disabled = false, className = '' }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initial load or when value changes externally
  useEffect(() => {
    const findLabel = async () => {
      if (value) {
        const results = await onSearch('');
        const found = results.find(o => o.value === value);
        if (found) setSelectedLabel(found.label);
      } else {
        setSelectedLabel('');
      }
    };
    findLabel();
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await onSearch(query);
        setOptions(results);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, isOpen, onSearch]);

  const handleSelect = (option: Option) => {
    onChange(option.value);
    setSelectedLabel(option.label);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm transition-all cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-navy dark:hover:border-tertiary-sage'} ${isOpen ? 'ring-2 ring-primary-navy/10 dark:ring-tertiary-sage/10 border-primary-navy dark:border-tertiary-sage' : ''}`}
      >
        <span className={`truncate font-medium ${selectedLabel ? 'text-primary-navy dark:text-white' : 'text-slate-400'}`}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-[100] mt-2 w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-2 border-b border-slate-100 dark:border-navy-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="快速检索..."
                className="w-full bg-slate-50 dark:bg-navy-950 rounded-lg py-2 pl-9 pr-4 text-[13px] outline-none text-primary-navy dark:text-white border border-transparent focus:border-slate-200 dark:focus:border-navy-700"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1">
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-3 text-slate-400 text-xs font-bold uppercase tracking-widest">
                <Loader2 size={16} className="animate-spin" />
                正在检索...
              </div>
            ) : options.length > 0 ? (
              options.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors group ${opt.value === value ? 'bg-primary-navy/5 dark:bg-tertiary-sage/5' : 'hover:bg-slate-50 dark:hover:bg-navy-800'}`}
                >
                  <div className="min-w-0">
                    <div className={`text-[13px] font-bold truncate ${opt.value === value ? 'text-primary-navy dark:text-tertiary-sage' : 'text-slate-700 dark:text-slate-200'}`}>{opt.label}</div>
                    {opt.subLabel && <div className="text-[10px] text-slate-400 font-medium truncate uppercase mt-0.5">{opt.subLabel}</div>}
                  </div>
                  {opt.value === value && <Check size={14} className="text-primary-navy dark:text-tertiary-sage" />}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-[12px] text-slate-400 font-bold uppercase tracking-widest">未找到匹配结果</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
