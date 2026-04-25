import React, { useEffect, useState } from 'react';
import { Package, Search, Truck, MapPin, Calendar, Clock, ChevronRight, Box } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import { Chip } from '../features/order-detail/components';

interface LogisticsSummary {
  id: number;
  order_id: number;
  order_display_id: string;
  customer_name: string;
  tracking_no: string;
  carrier: string;
  status: 'preparing' | 'shipped' | 'arrived';
  shipping_date: string;
  segment_type: 'domestic' | 'international';
  recipient_address?: string;
  package_count?: number;
}

function getStatusLabel(status: LogisticsSummary['status']) {
  switch (status) {
    case 'preparing': return '待起运';
    case 'shipped': return '在途运输';
    case 'arrived': return '已妥投';
    default: return status;
  }
}

export default function LogisticsView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState<LogisticsSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);
    setSearchParams(next);
  };

  useEffect(() => {
    const loadLogistics = async () => {
      setLoading(true);
      try {
        const data = await apiFetch<LogisticsSummary[]>(`/api/logistics?${searchParams.toString()}`);
        setRecords(data);
      } catch (err) {
        setError(getErrorMessage(err, '读取物流列表失败'));
      } finally {
        setLoading(false);
      }
    };
    loadLogistics();
  }, [searchParams]);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm transition-colors">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={q}
              onChange={e => updateParam('q', e.target.value)}
              placeholder="搜索单号、承运商、客户名称..."
              className="w-full rounded-2xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 py-2.5 pl-10 pr-4 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
            />
          </div>
          <div className="relative">
             <select
               value={status}
               onChange={e => updateParam('status', e.target.value)}
               className="w-full rounded-2xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 px-4 py-2.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none cursor-pointer text-primary-navy dark:text-white"
             >
               <option value="">全部状态</option>
               <option value="preparing">待起运</option>
               <option value="shipped">运输中</option>
               <option value="arrived">已送达</option>
             </select>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400 dark:text-slate-500 font-bold animate-pulse uppercase tracking-widest">正在同步物流状态...</div>
        ) : records.length ? (
          records.map((r) => (
            <div
              key={r.id}
              onClick={() => navigate(`/orders/${r.order_display_id}`)}
              className="group relative overflow-hidden rounded-3xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm transition-all hover:border-primary-navy/20 dark:hover:border-tertiary-sage/20 hover:shadow-md cursor-pointer"
            >
              <div className="mb-4 flex items-center justify-between">
                <Chip tone={r.segment_type === 'domestic' ? 'neutral' : 'info'}>
                  {r.segment_type === 'domestic' ? '国内段' : '国际段'}
                </Chip>
                <div className="flex items-center gap-1.5 text-tertiary-sage dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wider">
                  <div className={`h-1.5 w-1.5 rounded-full ${r.status === 'arrived' ? 'bg-success' : 'bg-tertiary-sage dark:bg-emerald-400 animate-pulse'}`} />
                  {getStatusLabel(r.status)}
                </div>
              </div>

              <div className="mb-6">
                 <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">关联订单</div>
                 <div className="flex items-center justify-between">
                    <span className="text-[15px] font-bold text-primary-navy dark:text-white uppercase data-field">{r.order_display_id}</span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[150px]">{r.customer_name}</span>
                 </div>
              </div>

              <div className="mb-6 space-y-3 rounded-2xl bg-slate-50 dark:bg-navy-950/50 p-4 border border-slate-100 dark:border-navy-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-slate-400 dark:text-slate-500" />
                    <span className="text-[13px] font-bold text-primary-navy dark:text-white uppercase">{r.carrier}</span>
                  </div>
                  <span className="text-[12px] font-bold text-white bg-slate-900 dark:bg-navy-800 px-2 py-0.5 rounded-[4px] data-field shadow-sm">{r.tracking_no}</span>
                </div>
                {r.recipient_address && (
                  <div className="flex items-start gap-2 pt-2 border-t border-slate-100 dark:border-navy-800/50">
                    <MapPin size={14} className="mt-0.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed truncate" title={r.recipient_address}>{r.recipient_address}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  <span>发货: {r.shipping_date || '待定'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Box size={12} />
                  <span>{r.package_count || 0} 箱</span>
                </div>
              </div>

              <div className="absolute bottom-6 right-6 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">
                <ChevronRight size={20} className="text-primary-navy dark:text-tertiary-sage" />
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-slate-50 dark:bg-navy-950/30 rounded-3xl border border-dashed border-slate-200 dark:border-navy-800">
            <Package size={48} className="mx-auto mb-4 text-slate-200 dark:text-navy-800" />
            <div className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">未找到匹配的物流记录</div>
          </div>
        )}
      </div>
    </div>
  );
}
