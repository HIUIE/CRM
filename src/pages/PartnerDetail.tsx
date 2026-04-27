import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2, MapPin, Phone, Package, Wallet, Clock,
  ArrowLeft, Star, Mail, Globe, Truck, DollarSign,
  Factory, ShieldCheck, Hash, Calendar, BarChart3
} from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { Chip, EmptyStateBoard, Toast } from '../features/order-detail/components';
import { formatDateOnly } from '../features/order-detail/utils';

interface PartnerDetail {
  partner: {
    id: number;
    name: string;
    partner_type: string;
    country?: string;
    contact?: string;
    contact_person?: string;
    address?: string;
    rating?: number;
    payment_terms?: string;
    remark?: string;
    created_at: string;
    created_by_name?: string;
  };
  orders: Array<{
    id: number;
    display_id: string;
    status: string;
    total_amount: number;
    product_summary?: string;
    created_at: string;
    linkType: 'production' | 'finance';
    production_status?: string;
    estimated_delivery_date?: string;
  }>;
  financeRecords: Array<{
    id: number;
    order_id?: number;
    type: string;
    amount: number;
    currency?: string;
    status: string;
    created_at: string;
    order_display_id?: string;
  }>;
  summary: {
    totalOrders: number;
    thisMonthCount: number;
    lastMonthCount: number;
    totalFinanceAmount: number;
    productionCount: number;
  };
}

type TabKey = 'orders' | 'finance';

const PARTNER_TYPE_LABELS: Record<string, string> = {
  factory: '工厂',
  forwarder: '货代',
  customs_broker: '报关行',
  other: '其他',
};

const PARTNER_TYPE_ICONS: Record<string, React.ReactNode> = {
  factory: <Factory size={16} />,
  forwarder: <Truck size={16} />,
  customs_broker: <ShieldCheck size={16} />,
  other: <Building2 size={16} />,
};

function getStatusMeta(status: string) {
  const map: Record<string, { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' | 'error' }> = {
    production: { label: '生产中', tone: 'warning' },
    customs: { label: '报关中', tone: 'warning' },
    shipping: { label: '发货中', tone: 'info' },
    completed: { label: '已完成', tone: 'success' },
    draft: { label: '待受理', tone: 'neutral' },
  };
  return map[status] || { label: status, tone: 'neutral' as const };
}

export default function PartnerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('orders');
  const [toast, setToast] = useState('');

  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<PartnerDetail>(`/api/partners/${id}`);
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err, '读取伙伴画像失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDetail(); }, [id]);

  if (loading) return <div className="flex h-screen w-full items-center justify-center p-8 text-sm text-slate-500 animate-pulse uppercase tracking-widest font-bold">正在加载伙伴数据...</div>;
  if (error || !data) return <div className="p-8 m-4 rounded-lg bg-red-50 text-red-600 border border-red-100 font-bold text-center">{error || '伙伴不存在'}</div>;

  const { partner, orders, financeRecords, summary } = data;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-[60] -mx-2 -mt-2 mb-4 flex items-center justify-between border-b border-slate-100 dark:border-navy-800 bg-white/95 dark:bg-navy-950/95 px-6 py-4 backdrop-blur-md transition-colors shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/partners')}
            className="group flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-navy-800 text-slate-400 hover:border-primary-navy transition-all shadow-sm bg-white dark:bg-navy-900"
            title="返回伙伴列表"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <Link to="/partners" className="text-slate-400 uppercase tracking-widest hover:text-primary-navy dark:hover:text-white transition-colors">合作伙伴</Link>
            <span className="text-slate-200 dark:text-navy-800">/</span>
            <span className="text-primary-navy dark:text-white uppercase truncate max-w-[200px] flex items-center gap-2">
              {PARTNER_TYPE_ICONS[partner.partner_type]} {partner.name}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 p-2">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr] items-start pb-12">
          {/* Left: Profile Sidebar */}
          <div className="space-y-6 lg:sticky lg:top-24 lg:z-10">
            {/* Partner Card */}
            <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-navy-800 dark:to-navy-900 px-6 py-8 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white shadow-lg backdrop-blur-sm">
                  <Building2 size={32} />
                </div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight">{partner.name}</h2>
                <div className="mt-2">
                  <Chip tone={partner.partner_type === 'factory' ? 'info' : partner.partner_type === 'forwarder' ? 'warning' : 'neutral'}>
                    {PARTNER_TYPE_LABELS[partner.partner_type] || partner.partner_type}
                  </Chip>
                </div>
                {partner.rating && (
                  <div className="mt-2 flex items-center justify-center gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={14} className={i < partner.rating! ? 'text-amber-400 fill-amber-400' : 'text-white/20'} />
                    ))}
                  </div>
                )}
              </div>
              <div className="px-6 py-5 space-y-4">
                {partner.contact_person && (
                  <DetailRow icon={<Phone size={14} />} label="联系人" value={partner.contact_person} />
                )}
                {partner.contact && (
                  <DetailRow icon={<Mail size={14} />} label="联系方式" value={partner.contact} />
                )}
                {partner.country && (
                  <DetailRow icon={<Globe size={14} />} label="国家/地区" value={partner.country} />
                )}
                {partner.address && (
                  <DetailRow icon={<MapPin size={14} />} label="地址" value={partner.address} />
                )}
                {partner.payment_terms && (
                  <DetailRow icon={<DollarSign size={14} />} label="付款条款" value={partner.payment_terms} />
                )}
                <DetailRow icon={<Calendar size={14} />} label="建档时间" value={formatDateOnly(partner.created_at)} />
                {partner.created_by_name && (
                  <DetailRow icon={<Building2 size={14} />} label="创建人" value={partner.created_by_name} />
                )}
              </div>
            </div>

            {/* Summary Card */}
            <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm p-6">
              <h3 className="text-xs font-black text-primary-navy dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <BarChart3 size={14} /> 合作概览
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-navy-950">
                  <div className="text-2xl font-black text-primary-navy dark:text-white">{summary.totalOrders}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">累计订单</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-navy-950">
                  <div className="text-2xl font-black text-tertiary-sage">{summary.productionCount}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">生产安排</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-navy-950">
                  <div className="text-lg font-black text-primary-navy dark:text-white">{summary.thisMonthCount}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">本月订单</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-navy-950">
                  <div className="text-lg font-black text-slate-500 dark:text-slate-400">{summary.lastMonthCount}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">上月订单</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-navy-800">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">累计往来金额</span>
                  <span className="text-sm font-black text-primary-navy dark:text-white">
                    ${summary.totalFinanceAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {partner.remark && (
              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm p-6">
                <h3 className="text-xs font-black text-primary-navy dark:text-white uppercase tracking-widest mb-2">备注</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{partner.remark}</p>
              </div>
            )}
          </div>

          {/* Right: Main Content */}
          <div className="space-y-6 min-w-0">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-800 shadow-inner w-fit">
              <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')}>
                <Package size={14} /> 关联订单 ({orders.length})
              </TabButton>
              <TabButton active={activeTab === 'finance'} onClick={() => setActiveTab('finance')}>
                <Wallet size={14} /> 财务流水 ({financeRecords.length})
              </TabButton>
            </div>

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-800">
                  <h3 className="text-xs font-black text-primary-navy dark:text-white uppercase tracking-widest">关联订单</h3>
                </div>
                {orders.length === 0 ? (
                  <div className="p-12">
                    <EmptyStateBoard title="暂无关联订单" description="该伙伴尚未与任何订单关联。" icon={Package} />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-navy-950 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                          <th className="px-6 py-4 text-left">订单号</th>
                          <th className="px-6 py-4 text-left">关联类型</th>
                          <th className="px-6 py-4 text-left">状态</th>
                          <th className="px-6 py-4 text-right">金额</th>
                          <th className="px-6 py-4 text-left">产品摘要</th>
                          <th className="px-6 py-4 text-left">日期</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                        {orders.map((o) => (
                          <tr
                            key={o.id}
                            onClick={() => navigate(`/orders/${o.display_id.toLowerCase()}`)}
                            className="group hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                          >
                            <td className="px-6 py-4">
                              <span className="font-bold text-primary-navy dark:text-tertiary-sage uppercase data-field text-sm">
                                <Link to={`/orders/${o.display_id.toLowerCase()}`} className="hover:underline">{o.display_id}</Link>
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <Chip tone={o.linkType === 'production' ? 'info' : 'warning'}>
                                {o.linkType === 'production' ? '生产' : '财务'}
                              </Chip>
                            </td>
                            <td className="px-6 py-4">
                              <Chip tone={getStatusMeta(o.status).tone}>{getStatusMeta(o.status).label}</Chip>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-primary-navy dark:text-white data-field">
                              ${Number(o.total_amount).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm max-w-[200px] truncate">
                              {o.product_summary || '—'}
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-500 text-xs font-bold">
                              {formatDateOnly(o.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Finance Tab */}
            {activeTab === 'finance' && (
              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-800">
                  <h3 className="text-xs font-black text-primary-navy dark:text-white uppercase tracking-widest">财务流水</h3>
                </div>
                {financeRecords.length === 0 ? (
                  <div className="p-12">
                    <EmptyStateBoard title="暂无财务流水" description="该伙伴尚未关联任何财务记录。" icon={Wallet} />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-navy-950 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                          <th className="px-6 py-4 text-left">类型</th>
                          <th className="px-6 py-4 text-right">金额</th>
                          <th className="px-6 py-4 text-left">货币</th>
                          <th className="px-6 py-4 text-left">关联订单</th>
                          <th className="px-6 py-4 text-left">日期</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                        {financeRecords.map((r) => (
                          <tr key={r.id} className="group hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                            <td className="px-6 py-4">
                              <Chip tone={r.type === 'receipt' ? 'success' : 'error'}>
                                {r.type === 'receipt' ? '收款' : '付款'}
                              </Chip>
                            </td>
                            <td className="px-6 py-4 text-right font-bold data-field"
                              style={{ color: r.type === 'receipt' ? '#059669' : '#DC2626' }}>
                              {r.type === 'receipt' ? '+' : '-'}${Number(r.amount).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-bold">{r.currency || 'USD'}</td>
                            <td className="px-6 py-4">
                              {r.order_display_id ? (
                                <Link to={`/orders/${r.order_display_id.toLowerCase()}`} className="text-primary-navy dark:text-tertiary-sage font-bold uppercase text-xs hover:underline data-field">
                                  {r.order_display_id}
                                </Link>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-500 text-xs font-bold">
                              {formatDateOnly(r.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
        <div className="text-sm font-bold text-primary-navy dark:text-white mt-0.5 break-all">{value}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-widest ${
        active
          ? 'bg-primary-navy dark:bg-navy-900 text-white shadow-sm'
          : 'text-slate-500 dark:text-slate-400 hover:text-primary-navy dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
