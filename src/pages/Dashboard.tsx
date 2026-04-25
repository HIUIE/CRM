import React, { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, FileText, Truck, Wallet, Clock } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { Chip } from '../features/order-detail/components';

interface FinanceRecord {
  id: number;
  order_display_id?: string;
  customer_name?: string;
  type: 'receipt' | 'payment';
  amount: number;
  currency: string;
  status: 'pending' | 'completed';
  created_at: string;
}

interface LogisticsRecord {
  id: number;
  order_display_id?: string;
  customer_name?: string;
  carrier: string;
  tracking_no: string;
  status: 'preparing' | 'shipped' | 'arrived';
  created_at: string;
}

interface DashboardData {
  overview: {
    totalOrders: number;
    activeOrders: number;
    draftOrders: number;
    completedOrders: number;
  };
  financeSummary: {
    receipt?: Record<string, number>;
    payment?: Record<string, number>;
  };
  pendingFinanceCount: number;
  pendingLogisticsCount: number;
  recentFinance: FinanceRecord[];
  recentLogistics: LogisticsRecord[];
}

function formatAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function getLogisticsLabel(status: LogisticsRecord['status']) {
  switch (status) {
    case 'preparing': return '备货中';
    case 'shipped': return '运输中';
    case 'arrived': return '已到货';
    default: return status;
  }
}

export default function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadDashboard = async () => {
      try {
        const nextData = await apiFetch<DashboardData>('/api/dashboard');
        if (mounted) setData(nextData);
      } catch (requestError) {
        if (mounted) setError(getErrorMessage(requestError, '读取控制台数据失败'));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadDashboard();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="p-8 text-sm text-slate-500 dark:text-slate-400 animate-pulse">汇总业务数据中...</div>;
  if (error || !data) return <div className="p-8 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-3xl m-4">{error || '无法读取控制台数据'}</div>;

  const receiptUsd = data.financeSummary.receipt?.USD || 0;
  const receiptCny = data.financeSummary.receipt?.CNY || 0;
  const paymentUsd = data.financeSummary.payment?.USD || 0;
  const paymentCny = data.financeSummary.payment?.CNY || 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="订单总数" value={String(data.overview.totalOrders)} description={`进行中 ${data.overview.activeOrders}`} icon={<FileText size={16} className="text-primary-navy dark:text-white" />} />
        <StatCard title="已收 USD" value={formatAmount(receiptUsd, 'USD')} description={`CNY 已收: ${receiptCny.toLocaleString()}`} icon={<ArrowDownRight size={16} className="text-emerald-500" />} />
        <StatCard title="已付 USD" value={formatAmount(paymentUsd, 'USD')} description={`CNY 已付: ${paymentCny.toLocaleString()}`} icon={<ArrowUpRight size={16} className="text-red-500" />} />
        <StatCard title="待处理财务" value={`${data.pendingFinanceCount} 笔`} description="等待核销确认" icon={<Clock size={16} className="text-amber-500" />} />
        <StatCard title="待跟进物流" value={`${data.pendingLogisticsCount} 笔`} description="运输中的订单" icon={<Truck size={16} className="text-blue-500" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr,1fr]">
        <section className="rounded-3xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm transition-colors">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white uppercase tracking-tight">最近财务流水</h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase mt-0.5">LATEST FINANCIAL ACTIVITIES</p>
            </div>
            <button className="text-[11px] font-bold text-primary-navy dark:text-tertiary-sage hover:underline">查看全部</button>
          </div>

          <div className="space-y-3">
            {data.recentFinance.length ? (
              data.recentFinance.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950/50 rounded-2xl border border-slate-100 dark:border-navy-800 hover:bg-white dark:hover:bg-navy-800 hover:border-primary-navy/10 dark:hover:border-tertiary-sage/10 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${record.type === 'receipt' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                       {record.type === 'receipt' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-primary-navy dark:text-white uppercase">{record.order_display_id || 'MISC'} · {record.customer_name}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{new Date(record.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[14px] font-bold data-field ${record.type === 'receipt' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {record.type === 'receipt' ? '+' : '-'}{record.currency} {record.amount.toLocaleString()}
                    </div>
                    <div className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest mt-0.5">{record.status === 'completed' ? '已核销' : '待处理'}</div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="还没有财务流水" description="去财务页面登记第一笔收款或付款后，这里就会显示真实数据。" />
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm transition-colors">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white uppercase tracking-tight">最近物流状态</h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase mt-0.5">REAL-TIME TRACKING SNAPSHOT</p>
            </div>
            <button className="text-[11px] font-bold text-primary-navy dark:text-tertiary-sage hover:underline">查看全部</button>
          </div>

          <div className="space-y-3">
            {data.recentLogistics.length ? (
              data.recentLogistics.map((record) => (
                <div key={record.id} className="p-4 bg-slate-50 dark:bg-navy-950/50 rounded-2xl border border-slate-100 dark:border-navy-800 hover:bg-white dark:hover:bg-navy-800 hover:border-primary-navy/10 dark:hover:border-tertiary-sage/10 transition-all group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-4">
                       <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center"><Truck size={18} /></div>
                       <div>
                         <div className="text-[13px] font-bold text-primary-navy dark:text-white uppercase">{record.order_display_id || 'MISC'} · {record.customer_name}</div>
                         <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">{record.carrier} · {record.tracking_no}</div>
                       </div>
                    </div>
                    <Chip tone={record.status === 'arrived' ? 'success' : record.status === 'shipped' ? 'info' : 'warning'}>
                      {getLogisticsLabel(record.status)}
                    </Chip>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="还没有物流记录" description="去物流页面录入发货信息后，这里会显示真实的运输状态。" />
            )}
          </div>
        </section>
      </div>

      <section className="rounded-3xl bg-primary-navy dark:bg-navy-900 border dark:border-navy-800 p-8 text-white shadow-xl relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 h-64 w-64 bg-white/5 rounded-full blur-3xl -translate-y-32 translate-x-32" />
        <div className="relative z-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center"><Wallet size={18} /></div>
            <h2 className="text-lg font-bold uppercase tracking-tight">业务主链当前聚焦</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-300 dark:text-slate-400 max-w-2xl font-medium">
            现在的目标是确保客户、订单、财务、物流这条核心业务主链的稳定可用。我们将持续优化数据密度与录入效率，为您的日常外贸作业提供最直观、最可靠的支撑。
          </p>
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, value, description, icon }: { title: string; value: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-5 shadow-sm hover:border-primary-navy/20 dark:hover:border-tertiary-sage/20 transition-all group">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-navy-950 flex items-center justify-center group-hover:bg-primary-navy/5 dark:group-hover:bg-tertiary-sage/5 transition-colors">{icon}</div>
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{title}</div>
      </div>
      <div className="text-xl font-bold tracking-tight text-primary-navy dark:text-white data-field">{value}</div>
      <p className="mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{description}</p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 px-4 py-8 text-center">
      <div className="text-sm font-bold text-primary-navy dark:text-white uppercase tracking-widest">{title}</div>
      <div className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">{description}</div>
    </div>
  );
}
