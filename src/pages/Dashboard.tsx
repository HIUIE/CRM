import React, { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, FileText, Truck, Wallet } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';

interface FinanceRecord {
  id: number;
  order_display_id?: string;
  customer_name?: string;
  type: 'receipt' | 'payment';
  amount: number;
  currency: 'USD' | 'CNY';
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
    receipt?: Partial<Record<'USD' | 'CNY', number>>;
    payment?: Partial<Record<'USD' | 'CNY', number>>;
  };
  pendingFinanceCount: number;
  pendingLogisticsCount: number;
  recentFinance: FinanceRecord[];
  recentLogistics: LogisticsRecord[];
}

function formatAmount(amount: number, currency: 'USD' | 'CNY') {
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function getLogisticsLabel(status: LogisticsRecord['status']) {
  switch (status) {
    case 'preparing':
      return '备货中';
    case 'shipped':
      return '运输中';
    case 'arrived':
      return '已到货';
    default:
      return status;
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
        if (mounted) {
          setData(nextData);
        }
      } catch (requestError) {
        if (mounted) {
          setError(getErrorMessage(requestError, '读取控制台数据失败'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">正在汇总业务数据...</div>;
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-red-100 bg-white p-8 text-sm text-red-600 shadow-sm">
        {error || '暂时无法读取控制台数据'}
      </div>
    );
  }

  const receiptUsd = data.financeSummary.receipt?.USD || 0;
  const paymentCny = data.financeSummary.payment?.CNY || 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="订单总数"
          value={String(data.overview.totalOrders)}
          description={`进行中 ${data.overview.activeOrders} 单，已完成 ${data.overview.completedOrders} 单`}
          icon={<FileText className="h-4 w-4 text-blue-600" />}
        />
        <StatCard
          title="已完成收款"
          value={formatAmount(receiptUsd, 'USD')}
          description={`待核销流水 ${data.pendingFinanceCount} 笔`}
          icon={<ArrowDownRight className="h-4 w-4 text-green-600" />}
        />
        <StatCard
          title="已完成付款"
          value={formatAmount(paymentCny, 'CNY')}
          description="按已登记的付款流水汇总"
          icon={<ArrowUpRight className="h-4 w-4 text-red-500" />}
        />
        <StatCard
          title="物流待跟进"
          value={String(data.pendingLogisticsCount)}
          description={`草稿订单 ${data.overview.draftOrders} 单`}
          icon={<Truck className="h-4 w-4 text-amber-600" />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">最近财务流水</h2>
              <p className="text-sm text-slate-500">这里展示系统中最新登记的收付款记录。</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              {data.recentFinance.length} 条
            </div>
          </div>

          <div className="space-y-3">
            {data.recentFinance.length ? (
              data.recentFinance.map((record) => (
                <div key={record.id} className="flex items-start justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      {record.order_display_id || '未关联订单'} · {record.customer_name || '未命名客户'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {record.type === 'receipt' ? '收款' : '付款'} · {new Date(record.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-bold ${
                        record.type === 'receipt' ? 'text-green-600' : 'text-red-500'
                      }`}
                    >
                      {formatAmount(record.amount, record.currency)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {record.status === 'completed' ? '已完成' : '待核销'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="还没有财务流水" description="去财务页面登记第一笔收款或付款后，这里就会显示真实数据。" />
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">最近物流状态</h2>
              <p className="text-sm text-slate-500">按最新录入的物流记录展示当前运输进度。</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              {data.recentLogistics.length} 条
            </div>
          </div>

          <div className="space-y-3">
            {data.recentLogistics.length ? (
              data.recentLogistics.map((record) => (
                <div key={record.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        {record.order_display_id || '未关联订单'} · {record.customer_name || '未命名客户'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {record.carrier} · {record.tracking_no || '暂无运单号'}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        record.status === 'arrived'
                          ? 'bg-green-50 text-green-700'
                          : record.status === 'shipped'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {getLogisticsLabel(record.status)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{new Date(record.created_at).toLocaleString()}</div>
                </div>
              ))
            ) : (
              <EmptyState title="还没有物流记录" description="去物流页面录入发货信息后，这里会显示真实的运输状态。" />
            )}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm">
        <div className="mb-3 flex items-center">
          <Wallet className="mr-2 h-4 w-4 text-blue-300" />
          <h2 className="text-lg font-bold">当前阶段聚焦</h2>
        </div>
        <p className="text-sm leading-6 text-slate-300">
          现在的目标不是把所有高级功能都堆进来，而是把客户、订单、财务、物流这条主链跑通并稳定可用。AI 和高级分析会继续保留，但不会阻塞日常业务录入。
        </p>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
        {icon}
        <span className="ml-2">{title}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{description}</div>
    </div>
  );
}
