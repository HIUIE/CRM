import React, { useEffect, useState, useRef } from 'react';
import { Search, X, Package, ArrowRight, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import type { OrderSummary, CustomerListItem } from '../../types/crm';

type SearchResult =
  | { type: 'order'; id: number; display_id: string; customer_name?: string }
  | { type: 'customer'; id: number; display_id?: string | null; name: string; country: string };

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
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
    let cancelled = false;
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return () => { cancelled = true; };
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [orders, customers] = await Promise.all([
          apiFetch<OrderSummary[]>(`/api/orders?q=${encodeURIComponent(query)}`),
          apiFetch<CustomerListItem[]>(`/api/customers?q=${encodeURIComponent(query)}`)
        ]);
        if (cancelled) return;

        const combined: SearchResult[] = [
          ...orders.slice(0, 4).map(o => ({ type: 'order' as const, id: o.id, display_id: o.display_id, customer_name: o.customer_name })),
          ...customers.slice(0, 4).map(c => ({ type: 'customer' as const, id: c.id, display_id: c.display_id, name: c.name, country: c.country }))
        ];

        setResults(combined);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-start justify-center pt-[15vh] px-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={() => setIsOpen(false)} 
      />
      
      <div className="relative w-full max-w-2xl overflow-hidden rounded-lg bg-white dark:bg-navy-900 shadow-2xl border border-slate-200 dark:border-navy-800 animate-in zoom-in-95 duration-200 flex flex-col">
        <div className="flex items-center px-5 py-4 border-b border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/50">
           <Search size={20} className="text-slate-400 mr-4" />
           <input
             ref={inputRef}
             autoFocus
             value={query}
             onChange={(e) => setQuery(e.target.value)}
             placeholder="输入单号、产品或客户名进行全域搜索..."
             className="flex-1 bg-transparent text-[15px] font-bold text-primary-navy dark:text-white outline-none placeholder:text-slate-400"
           />
           <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-primary-navy dark:hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex-1 max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
           {loading && query ? (
             <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest animate-pulse">正在穿透海量数据...</div>
           ) : results.length > 0 ? (
             <div className="space-y-1">
                {results.map((res, i) => (
                  <div 
                    key={`${res.type}-${res.id}`} 
                    onClick={() => {
                      if (res.type === 'order') navigate(`/orders/${String(res.display_id).toLowerCase()}`);
                      else navigate(`/customers/detail/${String(res.display_id || res.id).toLowerCase()}`);
                      setIsOpen(false);
                    }}
                    className="flex items-center justify-between p-4 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-950/50 transition-all border border-transparent hover:border-slate-100 dark:hover:border-navy-800 group"
                  >
                    <div className="flex items-center gap-4">
                       <div className={`h-10 w-10 rounded-lg flex items-center justify-center border shadow-sm ${res.type === 'order' ? 'bg-blue-50 text-blue-500 border-blue-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'}`}>
                          {res.type === 'order' ? <Package size={20} /> : <Users size={20} />}
                       </div>
                       <div>
                          <div className="text-[14px] font-extrabold text-primary-navy dark:text-white uppercase tracking-tight">
                            {res.type === 'order' ? res.display_id : res.name}
                          </div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                             {res.type === 'order' ? `客户: ${res.customer_name}` : `地区: ${res.country || '—'}`}
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all text-primary-navy dark:text-tertiary-sage text-[10px] font-bold uppercase tracking-widest">
                       立即穿透 <ArrowRight size={14} />
                    </div>
                  </div>
                ))}
             </div>
           ) : query ? (
             <div className="py-20 text-center text-slate-400">
                <Search size={40} className="mx-auto mb-4 opacity-20" />
                <div className="text-xs font-bold uppercase tracking-widest">未找到匹配项</div>
             </div>
           ) : (
             <div className="py-12 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">输入关键字开始搜索</p>
             </div>
           )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/50 flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
           <span className="flex items-center gap-1.5"><kbd className="font-sans border rounded px-1 border-slate-300 bg-white">↑↓</kbd> 选择</span>
           <span className="flex items-center gap-1.5"><kbd className="font-sans border rounded px-1 border-slate-300 bg-white">↵</kbd> 打开</span>
           <span><kbd className="font-sans border rounded px-1 border-slate-300 bg-white">ESC</kbd> 关闭</span>
        </div>
      </div>
    </div>
  );
}
