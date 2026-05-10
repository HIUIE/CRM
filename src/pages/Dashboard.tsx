import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight, ArrowUpRight, FileText, Truck, Wallet, Clock,
  FilePlus, CreditCard, Send, Users, Download, Sparkles, ChevronRight,
  Building2, ArrowRightLeft, AlertTriangle, TrendingDown, Loader2, ShieldAlert, ClipboardCheck,
  CalendarClock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNavigateWithTransition } from '../lib/transition';
import { apiFetch, getErrorMessage } from '../lib/api';
import Chip from '../components/ui/Chip';
import { Drawer } from '../components/ui/Drawer';
import { OrderCreateDrawer } from '../components/ui/OrderCreateDrawer';
import type { OrderSummary } from '../types/crm';

interface DashboardData {
  overview: {
    totalOrders: number;
    activeOrders: number;
    receiptUsd: number;
    pendingReceiptUsd: number;
    pendingFinanceCount?: number;
    activeLogistics: number;
    customerCount: number;
    estProfit: number;
    growth: { revenue: number; profit: number };
    risks?: RiskItem[];
  };
  monthlyTrends: { month: string; orders: number; revenue: number }[];
  profitTrends: { month: string; revenue: number; cost: number; profit: number }[];
  todos: TodoItem[];
  activities: ActivityItem[];
  statusDistribution: StatusDistItem[];
}

interface TodoItem {
  id: string;
  type: 'payment_overdue' | 'customs_missing' | 'logistics_pending' | 'input_invoice_risk' | 'logistics_stale';
  order_display_id: string;
  customer_name: string;
  desc: string;
  days: number;
  urgency: 'high' | 'medium' | 'low';
  actionLabel: string;
}

function getTodoMeta(todo: TodoItem) {
  const map: Record<TodoItem['type'], { title: string; icon: React.ReactNode; path: string }> = {
    payment_overdue: { title: '收款提醒', icon: <Wallet size={18} />, path: 'finance' },
    customs_missing: { title: '报关资料', icon: <FileText size={18} />, path: 'customs' },
    logistics_pending: { title: '创建物流', icon: <Truck size={18} />, path: 'logistics' },
    logistics_stale: { title: '物流滞留', icon: <Clock size={18} />, path: 'logistics' },
    input_invoice_risk: { title: '进项发票', icon: <ClipboardCheck size={18} />, path: 'invoices' },
  };
  return map[todo.type];
}

interface ActivityItem {
  id: string;
  type: 'finance' | 'logistics' | 'customs' | 'production' | 'order';
  order_display_id: string;
  customer_name: string;
  title: string;
  desc: string;
  created_at: string;
  value?: string;
  valueColor?: string;
}

interface StatusDistItem {
  status: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

interface RiskItem {
  orderId: number;
  displayId: string;
  customerName: string;
  riskType: 'low_margin' | 'freight_inversion';
  value: number;
  threshold: number;
}

function formatAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatGrowth(val: number) {
  const isPositive = val >= 0;
  return {
    label: `${isPositive ? '↑' : '↓'} ${Math.abs(val)}%`,
    color: isPositive ? 'text-emerald-500' : 'text-error'
  };
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

function getOrderStatusMeta(status: string) {
  const map: Record<string, { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
    draft: { label: '待受理', tone: 'neutral' },
    production: { label: '生产中', tone: 'warning' },
    customs: { label: '报关中', tone: 'warning' },
    shipping: { label: '发货中', tone: 'info' },
    completed: { label: '已完成', tone: 'success' },
  };
  return map[status] || { label: status, tone: 'neutral' as const };
}

// ==================== Stat Card Drawer Content ====================

function OrderListDrawerContent({ filter, onClose }: { filter: { status?: string; label: string }; onClose: () => void }) {
  const navigate = useNavigateWithTransition();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    params.set('limit', '50');
    apiFetch<OrderSummary[]>(`/api/orders?${params.toString()}`)
      .then(data => { if (!cancelled) setOrders(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter.status]);

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="py-16 text-center text-slate-400 animate-pulse font-bold tracking-tight">加载中...</div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center text-slate-400 font-bold tracking-tight">暂无数据</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-navy-950/80 backdrop-blur font-bold tracking-tight text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
              <tr>
                <th className="px-4 py-3">订单号</th>
                <th className="px-4 py-3">客户</th>
                <th className="px-4 py-3 text-right">金额</th>
                <th className="px-4 py-3">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {orders.map(o => {
                const meta = getOrderStatusMeta(o.status);
                return (
                  <tr key={o.id} onClick={() => { onClose(); navigate(`/orders/${o.display_id.toLowerCase()}`); }} className="hover:bg-slate-50 dark:hover:bg-navy-800 cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-bold text-primary-navy dark:text-white">{o.display_id}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{o.customer_name || '-'}</td>
                    <td className="px-4 py-3 text-right font-bold data-field">USD {o.total_amount.toLocaleString()}</td>
                    <td className="px-4 py-3"><Chip tone={meta.tone}>{meta.label}</Chip></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== AI Briefing ====================

function AIBriefing({ data }: { data: DashboardData }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const cacheKey = `smarttrade_ai_daily_briefing_${todayKey}`;
  const fallbackBriefing = '早上好！今日控制台已就绪，请查看待处理任务和最新动态。';
  const [briefing, setBriefing] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(cacheKey);
    } catch (_error) {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const generateBriefing = async ({ force = false }: { force?: boolean } = {}) => {
    if (loading) return;
    if (!force && briefing) return;
    setLoading(true);
    const prompt = `请基于以下控制台数据生成一段50字以内的外贸业务早报（直接输出文本，不加任何前缀）：今日待处理${data.todos.length}项，风控预警${data.overview.risks?.length || 0}项，待收款${data.overview.pendingFinanceCount || 0}笔，活跃订单${data.overview.activeOrders}个，运输中${data.overview.activeLogistics}笔。语气专业，提醒优先级。`;
    try {
      const res = await apiFetch<{ content: string }>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message: prompt }) });
      const nextBriefing = res.content || fallbackBriefing;
      setBriefing(nextBriefing);
      try { window.sessionStorage.setItem(cacheKey, nextBriefing); } catch (_error) { /* ignore */ }
    } catch (_error) {
      setBriefing(fallbackBriefing);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!briefing) void generateBriefing();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-surface p-4 shadow-sm dark:border-navy-800 dark:bg-navy-900">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-100 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-900/20">
        <Sparkles size={14} className="text-sky-600 dark:text-sky-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="text-[11px] font-extrabold tracking-tight text-sky-600 dark:text-sky-300">AI 每日业务洞察</div>
          <button
            type="button"
            onClick={() => void generateBriefing({ force: true })}
            disabled={loading}
            className="text-[10px] font-black text-sky-600 hover:text-sky-700 disabled:opacity-40 dark:text-sky-300 dark:hover:text-sky-200"
          >
            刷新
          </button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" /> 正在生成...</div>
        ) : (
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{briefing}</p>
        )}
      </div>
    </div>
  );
}

// ==================== Currency Exchange Widget ====================

function CurrencyExchangeWidget() {
  const [mode, setMode] = useState<'usd2cny' | 'cny2usd'>('usd2cny');
  const [inputVal, setInputVal] = useState('1');
  const rate = 7.2;
  const result = mode === 'usd2cny'
    ? (parseFloat(inputVal) || 0) * rate
    : (parseFloat(inputVal) || 0) / rate;

  const toggleMode = () => setMode(m => m === 'usd2cny' ? 'cny2usd' : 'usd2cny');

  return (
    <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-5 shadow-sm shrink-0">
      <div className="flex items-center gap-2 mb-4">
        <ArrowRightLeft size={14} className="text-indigo-500" />
        <h2 className="text-xs font-extrabold text-slate-900 dark:text-white tracking-tight">汇率速算</h2>
        <span className="text-[10px] font-bold text-slate-400 ml-auto">参考</span>
      </div>
      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-3">
        <span>USD/CNY ≈ {rate.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-bold text-slate-400 tracking-tight">{mode === 'usd2cny' ? 'USD' : 'CNY'}</label>
          <input type="number" value={inputVal} onChange={e => setInputVal(e.target.value)} className="w-full bg-slate-50 dark:bg-navy-950/50 p-2 rounded border border-slate-200 dark:border-navy-800 text-sm font-bold text-primary-navy dark:text-white outline-none focus:border-indigo-300" />
        </div>
        <button onClick={toggleMode} className="mt-4 h-7 w-7 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors shrink-0">
          <ArrowRightLeft size={12} className="text-slate-400" />
        </button>
        <div className="flex-1">
          <label className="text-[10px] font-bold text-slate-400 tracking-tight">{mode === 'usd2cny' ? 'CNY' : 'USD'}</label>
          <div className="w-full bg-slate-50 dark:bg-navy-950/50 p-2 rounded border border-slate-200 dark:border-navy-800 text-sm font-bold text-primary-navy dark:text-white">
            {result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ==================== Main Dashboard ====================

export default function DashboardView() {
  const navigate = useNavigateWithTransition();
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardData>('/api/dashboard'),
    staleTime: 60 * 1000,
  });

  const [activityFilter, setActivityFilter] = useState<'all' | 'finance' | 'logistics'>('all');
  const [drawer, setDrawer] = useState<{ title: string; filter: { status?: string; label: string } } | null>(null);
  const [showOrderDrawer, setShowOrderDrawer] = useState(false);

  useEffect(() => {
    const openOrderDrawer = () => setShowOrderDrawer(true);
    window.addEventListener('dashboard:create-order', openOrderDrawer);
    return () => window.removeEventListener('dashboard:create-order', openOrderDrawer);
  }, []);

  if (isLoading) return <div className="p-8 text-sm text-slate-500 dark:text-slate-400 animate-pulse font-bold tracking-tight text-center">正在加载数字化指挥舱...</div>;
  if (error || !data) return <div className="p-8 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg m-4 font-bold border border-red-100">{getErrorMessage(error, '无法读取控制台数据')}</div>;

  const revenueGrowth = formatGrowth(data.overview.growth.revenue);
  const risks = data.overview.risks || [];
  const highPriorityTodos = data.todos.filter(t => t.urgency === 'high').length;
  const overdueTodos = data.todos.filter(t => t.days > 0).length;
  const invoiceTodos = data.todos.filter(t => t.type === 'input_invoice_risk').length;

  const filteredActivities = activityFilter === 'all'
    ? data.activities
    : data.activities.filter(a => a.type === activityFilter);

  return (
    <div className="flex flex-col space-y-8 animate-page-in">
      {/* AI Daily Briefing */}
      <AIBriefing data={data} />

      {/* Top Indicators */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 shrink-0">
        <StatCard
          title="订单总数" value={String(data.overview.totalOrders)} subValue={`进行中 ${data.overview.activeOrders}`}
          icon={<FileText size={16} className="text-blue-500" />} sparklineColor="#3B82F6" sparklineData={[10, 20, 15, 25, 20, 30]}
          onClick={() => setDrawer({ title: '全部订单', filter: { label: '全部订单' } })}
        />
        <StatCard
          title="已收金额 (USD)" value={formatAmount(data.overview.receiptUsd, '$')} subValue={`较上月 ${revenueGrowth.label}`} subValueColor={revenueGrowth.color}
          icon={<Wallet size={16} className="text-emerald-500" />} sparklineColor="#10B981" sparklineData={[5, 10, 15, 10, 20, 25]}
          onClick={() => setDrawer({ title: '已结清订单', filter: { status: 'completed', label: '已结清' } })}
        />
        <StatCard
          title="待收款风险" value={`${data.overview.pendingFinanceCount || 0} 笔`} subValue={data.overview.pendingReceiptUsd > 0 ? formatAmount(data.overview.pendingReceiptUsd, 'USD') : '暂无待收款'}
          subValueColor={(data.overview.pendingFinanceCount || 0) > 0 ? 'text-amber-500' : 'text-emerald-500'}
          icon={<ShieldAlert size={16} className="text-amber-500" />} sparklineColor="#F59E0B" sparklineData={[2, 4, 3, 5, 4, 6]}
          onClick={() => navigate('/finance?status=pending&type=receipt')}
        />
        <StatCard
          title="运输中的订单" value={`${data.overview.activeLogistics} 笔`} subValue={`客户 ${data.overview.customerCount} 个`}
          icon={<Truck size={16} className="text-purple-500" />} sparklineColor="#A855F7" sparklineData={[15, 20, 18, 25, 20, 22]}
          onClick={() => setDrawer({ title: '运输中的订单', filter: { status: 'shipping', label: '发货中' } })}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[65%_minmax(0,1fr)] items-start">
        {/* Left Column */}
        <div className="flex flex-col space-y-8">
          {/* Risk Workbench */}
          <section className="flex flex-col rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-sm transition-colors">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">风险与待办中心 ({data.todos.length + risks.length})</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold tracking-tight mt-0.5">按资金、单据、物流和利润风险排序</p>
              </div>
              <button onClick={() => navigate('/orders')} className="text-[11px] font-bold text-slate-500 hover:text-primary-navy transition-colors flex items-center gap-1">查看全部 <ChevronRight size={14} /></button>
            </div>
            <div className="grid gap-3 border-b border-slate-100 p-4 dark:border-navy-800 sm:grid-cols-4">
              <MiniInsightCard label="高优先级" value={highPriorityTodos} tone={highPriorityTodos > 0 ? 'error' : 'neutral'} icon={<AlertTriangle size={15} />} />
              <MiniInsightCard label="已逾期" value={overdueTodos} tone={overdueTodos > 0 ? 'warning' : 'neutral'} icon={<CalendarClock size={15} />} />
              <MiniInsightCard label="发票风险" value={invoiceTodos} tone={invoiceTodos > 0 ? 'warning' : 'neutral'} icon={<ClipboardCheck size={15} />} />
              <MiniInsightCard label="利润预警" value={risks.length} tone={risks.length > 0 ? 'error' : 'neutral'} icon={<TrendingDown size={15} />} />
            </div>
            <div className="p-4 space-y-3">
              {risks.map((risk, i) => (
                <div key={`risk-${i}`} onClick={() => navigate(`/orders/${risk.displayId.toLowerCase()}`)} className="flex items-center justify-between p-4 bg-red-50/60 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-800/20 hover:border-red-300 dark:hover:border-red-700 cursor-pointer transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${risk.riskType === 'low_margin' ? 'bg-red-100 dark:bg-red-900/30 text-error' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-500'}`}>
                      {risk.riskType === 'low_margin' ? <TrendingDown size={18} /> : <Truck size={18} />}
                    </div>
                    <div>
                      <div className="text-[13px] font-extrabold text-primary-navy dark:text-white mb-0.5">{risk.riskType === 'low_margin' ? '利润率预警' : '运费倒挂'}</div>
                      <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1">{risk.displayId} · {risk.customerName}</div>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {risk.riskType === 'low_margin'
                          ? `利润率 ${risk.value}% 低于红线 ${risk.threshold}%`
                          : `运费 ¥${risk.value.toLocaleString()} 超过货品成本 ¥${risk.threshold.toLocaleString()}`}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-error transition-colors" />
                </div>
              ))}
              {data.todos.length > 0 ? data.todos.map((todo) => (
                <div key={todo.id} onClick={() => navigate(`/orders/${String(todo.order_display_id).toLowerCase()}?section=${getTodoMeta(todo).path}`)} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-100 dark:border-navy-800 hover:bg-surface dark:hover:bg-navy-800 hover:border-primary-navy/20 transition-all cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${todo.urgency === 'high' ? 'bg-red-50 dark:bg-red-900/20 text-error' : todo.urgency === 'medium' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'}`}>
                      {getTodoMeta(todo).icon}
                    </div>
                    <div>
                      <div className="text-[13px] font-extrabold text-primary-navy dark:text-white mb-0.5">{getTodoMeta(todo).title}</div>
                      <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1">{todo.order_display_id} · {todo.customer_name}</div>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{todo.desc}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className={`text-[12px] font-bold ${todo.days > 0 ? 'text-error' : 'text-slate-400'}`}>{todo.days > 0 ? `逾期 ${todo.days} 天` : '待处理'}</div>
                    <button className={`px-4 py-1.5 rounded text-[11px] font-bold border transition-colors ${todo.urgency === 'high' ? 'border-error text-error hover:bg-error hover:text-white' : 'border-primary-navy dark:border-tertiary-sage text-primary-navy dark:text-tertiary-sage hover:bg-primary-navy dark:hover:bg-tertiary-sage hover:text-white'}`}>{todo.actionLabel}</button>
                  </div>
                </div>
              )) : risks.length === 0 ? (
                <EmptyState title="暂无风险与待办" description="今天所有关键业务点都已处理完毕" />
              ) : null}
            </div>
          </section>

          {/* Activities */}
          <section className="flex flex-col rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-sm transition-colors">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">最近动态</h2>
                <div className="hidden sm:flex gap-4 text-xs font-bold tracking-tight">
                  {(['all', 'finance', 'logistics'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActivityFilter(tab)}
                      className={`pb-1 transition-colors cursor-pointer ${activityFilter === tab ? 'text-primary-navy dark:text-tertiary-sage border-b-2 border-primary-navy dark:border-tertiary-sage' : 'text-slate-400 hover:text-primary-navy dark:hover:text-tertiary-sage'}`}
                    >
                      {tab === 'all' ? '全部' : tab === 'finance' ? '财务' : '物流'}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => navigate('/audit')} className="text-[11px] font-bold text-slate-500 hover:text-primary-navy transition-colors flex items-center gap-1">查看日志 <ChevronRight size={14} /></button>
            </div>
            <div className="p-4 space-y-0">
              {filteredActivities.length > 0 ? filteredActivities.map((activity, i) => (
                <div key={i} onClick={() => navigate(`/orders/${String(activity.order_display_id).toLowerCase()}`)} className="flex items-center justify-between cursor-pointer group py-4 border-b border-slate-100 dark:border-navy-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-navy-950/50 px-4 -mx-4 rounded-lg transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${activity.type === 'finance' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : activity.type === 'logistics' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' : activity.type === 'customs' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-slate-100 dark:bg-navy-800 text-slate-500'}`}>
                      {activity.type === 'finance' ? <ArrowDownRight size={14} /> : activity.type === 'logistics' ? <Truck size={14} /> : activity.type === 'customs' ? <FileText size={14} /> : <ArrowUpRight size={14} />}
                    </div>
                    <div>
                      <div className="text-[13px] font-extrabold text-primary-navy dark:text-white mb-0.5 group-hover:text-blue-600 transition-colors">{activity.title}</div>
                      <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500">{activity.order_display_id} · {activity.customer_name}</div>
                    </div>
                    <div className="ml-8 text-[12px] font-medium text-slate-500 hidden sm:block truncate max-w-[200px] mt-0.5">{activity.desc}</div>
                  </div>
                  <div className="text-right">
                    {activity.value && <div className={`text-[13px] font-bold data-field mb-0.5 ${activity.valueColor || 'text-primary-navy dark:text-white'}`}>{formatActivityValue(activity.value)}</div>}
                    <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{activity.created_at.slice(0, 16).replace('T', ' ')}</div>
                  </div>
                </div>
              )) : (
                <EmptyState title="暂无动态" description="该分类下暂无流转日志" />
              )}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="flex flex-col space-y-8">
          {/* Quick Actions */}
          <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-6 shadow-sm shrink-0">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight mb-6">快捷操作</h2>
            <div className="grid grid-cols-3 gap-3">
              <QuickAction icon={<FilePlus size={20} />} label="新建订单" onClick={() => setShowOrderDrawer(true)} />
              <QuickAction icon={<Wallet size={20} />} label="收款登记" onClick={() => navigate('/finance?create=1')} />
              <QuickAction icon={<Truck size={20} />} label="创建物流" onClick={() => navigate('/logistics?create=1')} />
              <QuickAction icon={<FileText size={20} />} label="报关资料" onClick={() => navigate('/orders')} />
              <QuickAction icon={<Building2 size={20} />} label="合作伙伴" onClick={() => navigate('/partners')} />
              <QuickAction icon={<CreditCard size={20} />} label="费用登记" onClick={() => navigate('/finance?create=1')} />
              <QuickAction icon={<Download size={20} />} label="数据导出" onClick={() => navigate('/settings?tab=export')} />
              <QuickAction icon={<Users size={20} />} label="客户管理" onClick={() => navigate('/customers')} />
              <QuickAction icon={<Send size={20} />} label="系统配置" onClick={() => navigate('/settings')} />
            </div>
          </section>

          {/* Monthly Trends */}
          <div className="grid gap-6">
            {data.monthlyTrends && data.monthlyTrends.length > 0 && (
              <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-6 shadow-sm shrink-0">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight mb-6">业务趋势 (订单)</h2>
                <div className="space-y-3">
                  {data.monthlyTrends.map(m => {
                    const maxOrders = Math.max(...data.monthlyTrends.map(x => x.orders), 1);
                    return (
                      <div key={m.month} className="flex items-center gap-4">
                        <div className="w-20 shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400 data-field">{m.month}</div>
                        <div className="flex-1 min-w-0 h-5 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-navy dark:bg-tertiary-sage rounded-full transition-all" style={{ width: `${Math.min((m.orders / maxOrders) * 100, 100)}%` }} />
                        </div>
                        <div className="w-24 shrink-0 text-right text-xs font-bold text-primary-navy dark:text-white data-field tabular-nums">{m.orders}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {data.profitTrends && data.profitTrends.length > 0 && (
              <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-6 shadow-sm shrink-0">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight mb-6">利润趋势 (USD)</h2>
                <div className="space-y-3">
                  {data.profitTrends.map(m => {
                    const maxProfit = Math.max(...data.profitTrends.map(x => x.profit), 1);
                    return (
                      <div key={m.month} className="flex items-center gap-4">
                        <div className="w-20 shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400 data-field">{m.month}</div>
                        <div className="flex-1 min-w-0 h-5 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min((Math.max(0, m.profit) / maxProfit) * 100, 100)}%` }} />
                        </div>
                        <div className="w-32 shrink-0 text-right text-[11px] font-bold text-primary-navy dark:text-white data-field tabular-nums">${Number(m.profit).toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Currency Exchange */}
          <CurrencyExchangeWidget />

          {/* AI CTA */}
          <section className="relative shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-surface p-6 shadow-sm transition-colors dark:border-navy-800 dark:bg-navy-900">
            <div className="relative z-10">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-600 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300"><Sparkles size={15} /></span>
                <h3 className="text-[14px] font-extrabold text-primary-navy dark:text-white tracking-tight">使用 AI 助手，提升效率</h3>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-4 max-w-[200px]">智能分析订单数据，自动生成业务建议</p>
              <Link to="/ai" className="btn-primary text-xs px-4 py-2">立即体验 <ArrowUpRight size={14} /></Link>
            </div>
            <div className="pointer-events-none absolute bottom-0 right-0 translate-x-4 translate-y-4 opacity-10 dark:opacity-10">
              <FileText size={100} className="text-slate-400 dark:text-slate-500" />
            </div>
          </section>

          {/* Status Distribution */}
          <section className="flex flex-col rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-6 shadow-sm">
            <div className="mb-8 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">订单状态分布</h2>
              <select className="bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-800 rounded px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 outline-none">
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

      {/* Stat Card Order List Drawer */}
      <Drawer isOpen={drawer !== null} onClose={() => setDrawer(null)} title={drawer?.title || ''} width="max-w-[600px]">
        {drawer && <OrderListDrawerContent filter={drawer.filter} onClose={() => setDrawer(null)} />}
      </Drawer>

      <OrderCreateDrawer
        isOpen={showOrderDrawer}
        onClose={() => setShowOrderDrawer(false)}
        onSuccess={(displayId) => navigate(`/orders/${displayId.toLowerCase()}`)}
      />
    </div>
  );
}

// ==================== Inner Components ====================

function MiniInsightCard({ label, value, tone, icon }: { label: string; value: number; tone: 'error' | 'warning' | 'neutral'; icon: React.ReactNode }) {
  const toneClass = tone === 'error'
    ? 'border-red-100 bg-red-50 text-error dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400'
    : tone === 'warning'
      ? 'border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-400'
      : 'border-slate-100 bg-slate-50 text-slate-500 dark:border-navy-800 dark:bg-navy-950/50 dark:text-slate-400';
  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-3 ${toneClass}`}>
      <div>
        <div className="text-[10px] font-black tracking-tight opacity-80">{label}</div>
        <div className="mt-1 text-lg font-extrabold leading-none data-field">{value}</div>
      </div>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 dark:bg-navy-900/70">{icon}</div>
    </div>
  );
}

function StatCard({ title, value, subValue, subValueColor = "text-slate-400", icon, sparklineColor, sparklineData, onClick }: {
  title: string; value: string; subValue: string; subValueColor?: string; icon: React.ReactNode; sparklineColor: string; sparklineData: number[]; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full text-left rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-6 shadow-sm hover:border-primary-navy/30 dark:hover:border-tertiary-sage/30 hover:shadow-md transition-all flex flex-col justify-between h-[130px] cursor-pointer">
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
    </button>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <div onClick={onClick} className="flex flex-col items-center justify-center p-4 rounded-lg border border-transparent hover:bg-slate-50 dark:hover:bg-navy-950/50 hover:border-slate-200 dark:hover:border-navy-800 cursor-pointer transition-all group">
      <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-2 group-hover:text-primary-navy dark:group-hover:text-white transition-colors shadow-sm">
        {icon}
      </div>
      <div className="text-xs font-bold text-slate-600 dark:text-slate-400 group-hover:text-primary-navy dark:group-hover:text-white transition-colors tracking-tight">{label}</div>
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
            <circle key={i} cx="21" cy="21" r="15.91549431" fill="transparent" stroke={slice.color} strokeWidth="4"
              strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-in-out hover:stroke-[6]" />
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
      <div className="text-sm font-bold tracking-tight text-primary-navy dark:text-white">{title}</div>
      <div className="mt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">{description}</div>
    </div>
  );
}
