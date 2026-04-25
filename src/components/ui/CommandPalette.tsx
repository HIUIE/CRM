import React, { useEffect, useState, useRef } from 'react';
import { Search, X, Package, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import type { OrderSummary } from '../../types/crm';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<OrderSummary[]>(`/api/orders?q=${encodeURIComponent(query)}`);
        setResults(data.slice(0, 5)); // show top 5
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[10vh] sm:pt-[20vh]">
      <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl bg-white dark:bg-navy-900 shadow-2xl border border-slate-200 dark:border-navy-700 animate-in fade-in zoom-in-95 duration-200 mx-4">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-navy-800">
          <Search size={20} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索订单、单号或客户..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-primary-navy dark:text-white"
          />
          <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-navy-800 rounded-md text-[10px] font-bold uppercase tracking-widest px-2">ESC</button>
        </div>
        
        {query.trim() && (
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {loading ? (
              <div className="p-8 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">正在全库检索...</div>
            ) : results.length > 0 ? (
              <div className="space-y-1">
                {results.map((o) => (
                  <div
                    key={o.id}
                    onClick={() => {
                      setIsOpen(false);
                      navigate(`/orders/${o.display_id}`);
                    }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-slate-100 dark:bg-navy-950 flex items-center justify-center text-slate-400">
                        <Package size={14} />
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-primary-navy dark:text-white data-field">{o.display_id}</div>
                        <div className="text-[11px] text-slate-500">{o.customer_name} · {o.product_summary}</div>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-primary-navy dark:group-hover:text-white transition-all group-hover:translate-x-1" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-[12px] font-bold text-slate-400 uppercase tracking-widest">未找到匹配的结果</div>
            )}
          </div>
        )}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/50 text-[10px] text-slate-500 font-bold uppercase tracking-widest flex gap-4">
           <span><kbd className="font-sans border rounded px-1 border-slate-300 bg-white">↑</kbd> <kbd className="font-sans border rounded px-1 border-slate-300 bg-white">↓</kbd> 导航</span>
           <span><kbd className="font-sans border rounded px-1 border-slate-300 bg-white">↵</kbd> 打开</span>
           <span><kbd className="font-sans border rounded px-1 border-slate-300 bg-white">ESC</kbd> 关闭</span>
        </div>
      </div>
    </div>
  );
}
