import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight, ArrowUpRight, FileText, Truck, Wallet, Clock,
  FilePlus, CreditCard, Send, Users, Download, MoreHorizontal, Sparkles, ChevronRight,
  Building2
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import Chip from '../components/ui/Chip';

interface DashboardData {
  overview: {
    totalOrders: number;
    activeOrders: number;
    receiptUsd: number;
    pendingReceiptUsd: number;
    activeLogistics: number;
    customerCount: number;
  };
  monthlyTrends: { month: string; orders: number; revenue: number }[];
  todos: {
    id: string;
    type: 'payment_overdue' | 'customs_missing' | 'logistics_pending';
    order_display_id: string;
    customer_name: string;
    desc: string;
    days: number;
    urgency: 'high' | 'medium' | 'low';
    actionLabel: string;
  }[];
  activities: {
    id: string;
    type: 'finance' | 'logistics' | 'customs' | 'production' | 'order';
    order_display_id: string;
    customer_name: string;
    title: string;
    desc: string;
    created_at: string;
    value?: string;
    valueColor?: string;
  }[];
  statusDistribution: {
    status: string;
    label: string;
    count: number;
    percentage: number;
    color: string;
  }[];
}

function formatAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatActivityValue(val?: string) {
  if (!val) return val;
  const match = val.match(/^([+-])([A-Z]{3})\s+(\d+\.?\d*)$/);
  if (match) {
    const [_, sign, currency, amount] = match;
    return `${sign}${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return val;
}

export default function DashboardView() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardData>('/api/dashboard'),
    staleTime: 60 * 1000,
  });

  if (isLoading) return <div className="p-8 text-sm text-slate-500 dark:text-slate-400 animate-pulse font-bold uppercase tracking-widest text-center">正在加载数字化指挥舱...</div>;
  if (error || !data) return <div className="p-8 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg m-4 font-bold border border-red-100">{getErrorMessage(error, '无法读取控制台数据')}</div>;

  return (
    <div className="flex flex-col space-y-8">
      {/* Top Indicators */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 shrink-0">
        <StatCard title="订单总数" value={String(data.overview.totalOrders)} subValue={`进行中 ${data.overview.activeOrders}`} icon={<FileText size={16} className="text-blue-500" />} sparklineColor="#3B82F6" sparklineData={[10, 20, 15, 25, 20, 30]} />
        <StatCard title="已收金额 (USD)" value={formatAmount(data.overview.receiptUsd, '$')} subValue="较上月 ↑ 12.5%" subValueColor="text-emerald-500" icon={<Wallet size={16} className="text-emerald-500" />} sparklineColor="#10B981" sparklineData={[5, 10, 15, 10, 20, 25]} />
        <StatCard title="待收金额 (USD)" value={formatAmount(data.overview.pendingReceiptUsd, '$')} subValue={`${data.todos.filter(t => t.type === 'payment_overdue').length} 笔逾期`} subValueColor="text-error" icon={<Clock size={16} className="text-error" />} sparklineColor="#EF4444" sparklineData={[25, 20, 30, 20, 15, 10]} />
        <StatCard title="运输中的订单" value={`${data.overview.activeLogistics} 笔`} subValue={`客户 ${data.overview.customerCount} 个`} icon={<Truck size={16} className="text-purple-500" />} sparklineColor="#A855F7" sparklineData={[15, 20, 18, 25, 20, 22]} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[65%_minmax(0,1fr)] items-start">
        {/* Left Column: Business Drivers */}
        <div className="flex flex-col space-y-8">
          <section className="flex flex-col rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm transition-colors">
            <div className="px-6 py-4 border-b border-slate-50 dark:border-navy-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">今日待处理 ({data.todos.length})</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">优先处理以下业务阻点</p>
              </div>
              <button onClick={() => navigate('/orders')} className="text-[11px] font-bold text-slate-500 hover:text-primary-navy transition-colors flex items-center gap-1">查看全部 <ChevronRight size={14} /></button>
            </div>

            <div className="p-4 space-y-3">
              {data.todos.length > 0 ? data.todos.map((todo) => (
                <div key={todo.id} onClick={() => navigate(`/orders/${String(todo.order_display_id).toLowerCase()}`)} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-100 dark:border-navy-800 hover:bg-white dark:hover:bg-navy-800 hover:border-primary-navy/20 transition-all cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${todo.urgency === 'high' ? 'bg-red-50 dark:bg-red-900/20 text-error' : todo.urgency === 'medium' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'}`}>
                       {todo.urgency === 'high' ? <ArrowUpRight size={18} /> : <FileText size={18} />}
                    </div>
                    <div>
                      <div className="text-[13px] font-extrabold text-primary-navy dark:text-white mb-0.5">{todo.type === 'payment_overdue' ? '收款提醒' : todo.type === 'customs_missing' ? '报关资料' : '创建物流'}</div>
                      <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase">{todo.order_display_id} · {todo.customer_name}</div>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{todo.desc}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className={`text-[12px] font-bold ${todo.days > 0 ? 'text-error' : 'text-slate-400'}`}>{todo.days > 0 ? `逾期 ${todo.days} 天` : '待处理'}</div>
                    <button className={`px-4 py-1.5 rounded text-[11px] font-bold border transition-colors ${todo.urgency === 'high' ? 'border-error text-error hover:bg-error hover:text-white' : 'border-primary-navy dark:border-tertiary-sage text-primary-navy dark:text-tertiary-sage hover:bg-primary-navy dark:hover:bg-tertiary-sage hover:text-white'}`}>{todo.actionLabel}</button>
                  </div>
                </div>
              )) : (
                <EmptyState title="暂无待处理任务" description="今天所有的关键任务都已处理完毕" />
              )}
            </div>
          </section>

          <section className="flex flex-col rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm transition-colors">
            <div className="px-6 py-4 border-b border-slate-50 dark:border-navy-800 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">最近动态</h2>
                <div className="hidden sm:flex gap-4 text-xs font-bold uppercase tracking-widest">
                  <span className="text-primary-navy dark:text-tertiary-sage border-b-2 border-primary-navy dark:border-tertiary-sage pb-1">全部</span>
                  <span className="text-slate-400 hover:text-primary-navy pb-1 cursor-pointer transition-colors">财务</span>
                  <span className="text-slate-400 hover:text-primary-navy pb-1 cursor-pointer transition-colors">物流</span>
                </div>
              </div>
              <button className="text-[11px] font-bold text-slate-500 hover:text-primary-navy transition-colors flex items-center gap-1">查看日志 <ChevronRight size={14} /></button>
            </div>

            <div className="p-4 space-y-0">
              {data.activities.length > 0 ? data.activities.map((activity, i) => (
                <div key={i} onClick={() => navigate(`/orders/${String(activity.order_display_id).toLowerCase()}`)} className="flex items-center justify-between cursor-pointer group py-4 border-b border-slate-100 dark:border-navy-800 last:border-0 hover:bg-slate-50 dark:hover:bg-navy-950/50 px-4 -mx-4 rounded-lg transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${activity.type === 'finance' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : activity.type === 'logistics' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' : activity.type === 'customs' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-slate-100 dark:bg-navy-800 text-slate-500'}`}>
                      {activity.type === 'finance' ? <ArrowDownRight size={14} /> : activity.type === 'logistics' ? <Truck size={14} /> : activity.type === 'customs' ? <FileText size={14} /> : <ArrowUpRight size={14} />}
                    </div>
                    <div>
                      <div className="text-[13px] font-extrabold text-primary-navy dark:text-white mb-0.5 group-hover:text-blue-600 transition-colors">{activity.title}</div>
                      <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase">{activity.order_display_id} · {activity.customer_name}</div>
                    </div>
                    <div className="ml-8 text-[12px] font-medium text-slate-500 hidden sm:block truncate max-w-[200px] mt-0.5">{activity.desc}</div>
                  </div>
                  <div className="text-right">
                    {activity.value && <div className={`text-[13px] font-bold data-field mb-0.5 ${activity.valueColor || 'text-primary-navy dark:text-white'}`}>{formatActivityValue(activity.value)}</div>}
                    <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{activity.created_at.slice(0, 16).replace('T', ' ')}</div>
                  </div>
                </div>
              )) : (
                <EmptyState title="暂无动态" description="系统尚未产生任何流转日志" />
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Tools & Analysis */}
        <div className="flex flex-col space-y-8">
          {/* Monthly Trends */}
          {data.monthlyTrends && data.monthlyTrends.length > 0 && (
            <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm shrink-0">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight mb-6">月度趋势</h2>
              <div className="space-y-3">
                {data.monthlyTrends.map(m => (
                  <div key={m.month} className="flex items-center gap-3">
                    <div className="w-16 text-[11px] font-bold text-slate-500 dark:text-slate-400 data-field">{m.month}</div>
                    <div className="flex-1 h-5 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-primary-navy dark:bg-tertiary-sage rounded-full transition-all" style={{ width: `${Math.min((m.orders / Math.max(...data.monthlyTrends.map(x => x.orders), 1)) * 100, 100)}%` }} />
                    </div>
                    <div className="w-8 text-right text-xs font-bold text-primary-navy dark:text-white data-field">{m.orders}</div>
                    <div className="w-20 text-right text-[11px] font-bold text-slate-500 data-field">${Number(m.revenue).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm shrink-0">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight mb-6">快捷操作</h2>
            <div className="grid grid-cols-3 gap-3">
              <QuickAction icon={<FilePlus size={20} />} label="新建订单" onClick={() => navigate('/orders?create=1')} />
              <QuickAction icon={<Wallet size={20} />} label="收款登记" onClick={() => navigate('/finance?create=1')} />
              <QuickAction icon={<Truck size={20} />} label="创建物流" onClick={() => navigate('/logistics?create=1')} />
              <QuickAction icon={<FileText size={20} />} label="报关资料" onClick={() => navigate('/orders')} />
              <QuickAction icon={<Building2 size={20} />} label="合作伙伴" onClick={() => navigate('/partners')} />
              <QuickAction icon={<CreditCard size={20} />} label="费用登记" onClick={() => navigate('/finance?create=1')} />
              <QuickAction icon={<Download size={20} />} label="数据导出" onClick={() => navigate('/settings?tab=export')} />
              <QuickAction icon={<Users size={20} />} label="客户管理" onClick={() => navigate('/customers')} />
              <QuickAction icon={<Send size={20} />} label="系统配置" onClick={() => navigate('/settings')} />
              <QuickAction icon={<MoreHorizontal size={20} />} label="更多功能" onClick={() => navigate('/help')} />
            </div>
          </section>

          <section className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-navy-800 dark:to-indigo-900/30 border border-blue-100 dark:border-navy-700 p-6 relative overflow-hidden transition-colors shrink-0">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-blue-500" />
                <h3 className="text-[14px] font-extrabold text-primary-navy dark:text-white tracking-tight">使用 AI 助手，提升效率</h3>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-4 max-w-[200px]">智能分析订单数据，自动生成业务建议</p>
              <Link to="/ai" className="btn-primary text-xs px-4 py-2">
                立即体验 <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-50 dark:opacity-20 pointer-events-none">
              <FileText size={100} className="text-blue-200 dark:text-blue-400" />
            </div>
          </section>

          <section className="flex flex-col rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm">
            <div className="mb-8 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">订单状态分布</h2>
              <select className="bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 outline-none uppercase">
                <option>本月</option>
                <option>本周</option>
                <option>今年</option>
              </select>
            </div>
            <div className="pr-1">
              <div className="flex justify-center mb-8 shrink-0">
                <DonutChart data={data.statusDistribution} />
              </div>
              <div className="space-y-3">
                {data.statusDistribution.map(d => (
                  <div key={d.status} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                      <span className="font-bold text-slate-600 dark:text-slate-400">{d.label}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-extrabold text-primary-navy dark:text-white data-field">{d.count}</span>
                      <span className="font-medium text-slate-400 w-10 text-right data-field">({d.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subValue, subValueColor = "text-slate-400", icon, sparklineColor, sparklineData }: { title: string; value: string; subValue: string; subValueColor?: string; icon: React.ReactNode; sparklineColor: string; sparklineData: number[] }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm hover:border-primary-navy/20 dark:hover:border-tertiary-sage/20 transition-all flex flex-col justify-between h-[130px]">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-8 w-8 rounded bg-slate-50 dark:bg-navy-950 flex items-center justify-center shrink-0 border border-slate-100 dark:border-navy-800">{icon}</div>
        <div className="text-[12px] font-bold text-slate-500 dark:text-slate-400">{title}</div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[22px] font-extrabold tracking-tight text-primary-navy dark:text-white data-field leading-none mb-1.5">{value}</div>
          <div className={`text-[11px] font-bold ${subValueColor}`}>{subValue}</div>
        </div>
        <div className="w-16 h-8 opacity-70">
          <Sparkline color={sparklineColor} data={sparklineData} />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <div onClick={onClick} className="flex flex-col items-center justify-center p-4 rounded-lg border border-transparent hover:bg-slate-50 dark:hover:bg-navy-950/50 hover:border-slate-200 dark:hover:border-navy-800 cursor-pointer transition-all group">
      <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-2 group-hover:text-primary-navy dark:group-hover:text-white transition-colors shadow-sm">
        {icon}
      </div>
      <div className="text-xs font-bold text-slate-600 dark:text-slate-400 group-hover:text-primary-navy dark:group-hover:text-white transition-colors uppercase tracking-tight">{label}</div>
    </div>
  );
}

const Sparkline = React.memo(function Sparkline({ color, data }: { color: string, data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => `${(i / (data.length - 1)) * 40},${10 - ((d - min) / range) * 10}`).join(' ');
  return (
    <svg viewBox="-1 -1 42 12" className="w-full h-full overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});

const DonutChart = React.memo(function DonutChart({ data }: { data: { status: string, count: number, percentage: number, color: string }[] }) {
  const total = data.reduce((acc, curr) => acc + curr.count, 0);
  let cumulativePercent = 0;

  return (
    <div className="relative w-40 h-40 aspect-square shrink-0">
      <svg viewBox="0 0 42 42" className="w-full h-full rounded-full transform -rotate-90">
        {data.map((slice, i) => {
          if (slice.count === 0) return null;
          const percent = slice.count / total * 100;
          const strokeDasharray = `${percent} ${100 - percent}`;
          const strokeDashoffset = -cumulativePercent;
          cumulativePercent += percent;
          return (
            <circle
              key={i}
              cx="21" cy="21" r="15.91549431"
              fill="transparent"
              stroke={slice.color}
              strokeWidth="4"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-in-out hover:stroke-[6]"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-primary-navy dark:text-white data-field leading-none">{total}</span>
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1">总订单</span>
      </div>
    </div>
  );
});

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 px-4 py-12 text-center">
      <div className="text-sm font-bold text-primary-navy dark:text-white tracking-widest">{title}</div>
      <div className="mt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">{description}</div>
    </div>
  );
}
