import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Building2, MapPin, Phone, Share2, Package, Wallet, Clock, 
  ArrowLeft, ChevronRight, Edit, Mail, Globe, ArrowDownRight, Truck, FileText, ArrowUpRight, Plus, Users, LayoutDashboard, DollarSign, Star
} from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { Chip, EmptyStateBoard } from '../features/order-detail/components';
import { formatDateOnly } from '../features/order-detail/utils';

interface CustomerDetailData {
  id: number;
  name: string;
  country: string;
  contact: string;
  source_channel?: string;
  intent_products?: string;
  created_by_name?: string;
  created_at: string;
  orders: {
    id: number;
    display_id: string;
    status: string;
    total_amount: number;
    paid_amount: number;
    product_summary: string;
    created_at: string;
  }[];
  finance_records: {
    id: number;
    type: 'receipt' | 'payment';
    amount: number;
    currency: string;
    status: string;
    target?: string;
    remark?: string;
    created_at: string;
    order_display_id?: string;
    product_summary?: string;
  }[];
  activities: {
    id: number;
    type: 'finance' | 'logistics' | 'customs' | 'order';
    order_display_id: string;
    title: string;
    desc: string;
    created_at: string;
    value?: string;
    valueColor?: string;
  }[];
  contacts: {
    id: number;
    name: string;
    title: string;
    contact: string;
  }[];
}

type TabKey = 'overview' | 'orders' | 'contacts' | 'finance';

function countryToFlag(country: string) {
  if (!country) return <span className="fi fi-xx rounded-sm shadow-sm text-lg" />;
  const normalized = country.trim().toLowerCase();
  const dictionary: Record<string, string> = {
    china: 'cn', 中国: 'cn', usa: 'us', 'united states': 'us', 美国: 'us', canada: 'ca', 加拿大: 'ca', germany: 'de', 德国: 'de',
    france: 'fr', 法国: 'fr', italy: 'it', 意大利: 'it', spain: 'es', 西班牙: 'es', mexico: 'mx', 墨西哥: 'mx', brazil: 'br', 巴西: 'br',
    australia: 'au', 澳大利亚: 'au', japan: 'jp', 日本: 'jp', korea: 'kr', 'south korea': 'kr', 韩国: 'kr', uk: 'gb', 'united kingdom': 'gb', 英国: 'gb',
    vietnam: 'vn', 越南: 'vn', thailand: 'th', 泰国: 'th', malaysia: 'my', 马来西亚: 'my', singapore: 'sg', 新加坡: 'sg',
  };
  const code = dictionary[normalized];
  return <span className={`fi fi-${code || 'xx'} rounded-sm shadow-sm text-lg`} />;
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CustomerDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<CustomerDetailData>(`/api/customers/${id}`);
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err, '读取客户画像失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [id]);

  const totalPaid = useMemo(() => data?.orders?.reduce((sum, o) => sum + (Number(o.paid_amount) || 0), 0) || 0, [data]);
  const totalAmount = useMemo(() => data?.orders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0, [data]);
  const pendingAmount = totalAmount - totalPaid;

  if (loading) return <div className="flex h-[400px] w-full items-center justify-center p-8 text-sm text-slate-500 uppercase tracking-widest font-bold">正在画像客户数据...</div>;
  if (error || !data) return <div className="p-8 m-4 rounded-lg bg-red-50 text-red-600 border border-red-100 font-bold text-center">{error || '客户不存在'}</div>;

  return (
    <div className="flex flex-col">
      {/* Detail Header: Decoupled and Standardized */}
      <header className="sticky top-0 z-[60] -mx-2 -mt-2 mb-6 flex items-center justify-between border-b border-slate-100 dark:border-navy-800 bg-white dark:bg-navy-950 px-6 py-4 transition-colors shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/customers')} 
            className="group flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-navy-800 text-slate-400 hover:border-primary-navy dark:hover:text-primary-navy hover:text-primary-navy transition-all shadow-sm bg-white dark:bg-navy-900"
            title="返回客户列表"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex items-center gap-2 text-[13px] font-bold tracking-tight">
            <span className="text-slate-400 uppercase tracking-widest">客户管理</span>
            <span className="text-slate-200 dark:text-navy-800">/</span>
            <span className="text-slate-400 uppercase tracking-widest">详情</span>
            <span className="text-slate-200 dark:text-navy-800">/</span>
            <span className="text-primary-navy dark:text-white uppercase truncate max-w-[200px]">{data.name || 'Unknown'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => navigate(`/finance?customerId=${data.id}&create=1`)} 
             className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white transition-all uppercase tracking-widest shadow-sm"
           >
             <DollarSign size={14} /> 录入收款
           </button>
           <button 
             onClick={() => navigate(`/orders?customerId=${data.id}&create=1`)} 
             className="flex items-center gap-2 rounded-lg bg-primary-navy dark:bg-tertiary-sage px-5 py-2 text-[11px] font-bold text-white shadow-md hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all active:scale-95 uppercase tracking-widest"
           >
             <Plus size={16} /> 新建订单
           </button>
        </div>
      </header>

      <div className="space-y-6 px-1">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr] items-start">
          {/* Left Column: Fixed Profile */}
          <div className="space-y-6 lg:sticky lg:top-24">
            <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm transition-colors overflow-hidden relative">
              <div className="absolute top-0 right-0 h-32 w-32 translate-x-16 -translate-y-16 rounded-full bg-slate-50 dark:bg-navy-800 pointer-events-none" />
              <div className="relative z-10">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 dark:bg-navy-950 shadow-inner border border-slate-100 dark:border-navy-800">
                  <Building2 size={32} className="text-primary-navy dark:text-tertiary-sage" />
                </div>
                <h1 className="text-2xl font-extrabold text-primary-navy dark:text-white uppercase tracking-tight mb-2 truncate" title={data.name}>{data.name}</h1>
                <div className="flex items-center gap-2 mb-6">
                  {countryToFlag(data.country)}
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{data.country || '未知国家'}</span>
                </div>
                <div className="flex items-center gap-1 mb-8">
                  {[1,2,3,4,5].map(s => <Star key={s} size={14} className={s <= 4 ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-navy-700'} />)}
                </div>

                <div className="space-y-5 border-t border-slate-50 dark:border-navy-800 pt-8">
                  <div className="rounded-xl bg-slate-50 dark:bg-navy-950/50 p-5 border border-slate-100 dark:border-navy-800 shadow-inner">
                    <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">累计贡献额 (LTV)</div>
                    <div className="text-2xl font-extrabold text-primary-navy dark:text-white data-field mb-4">$ {totalPaid.toLocaleString()}</div>
                    
                    <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">当前欠款总额</div>
                    <div className={`text-2xl font-extrabold data-field ${pendingAmount > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-slate-700 dark:text-slate-300'}`}>$ {pendingAmount.toLocaleString()}</div>
                  </div>

                  <InfoRow icon={<MapPin size={16} />} label="国家 / 地区" value={data.country || '—'} />
                  <InfoRow icon={<Phone size={16} />} label="联系方式" value={data.contact || '—'} />
                  <InfoRow icon={<Globe size={16} />} label="线索渠道" value={data.source_channel || '—'} />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm">
              <h3 className="text-[12px] font-extrabold text-primary-navy dark:text-white uppercase tracking-widest mb-4">意向偏好</h3>
              <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-100 dark:border-navy-800">
                <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium italic">
                  “{data.intent_products || '暂无明确意向描述'}”
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                <span>归属人员：{data.created_by_name || '系统分配'}</span>
                <span>建档：{data.created_at ? formatDateOnly(data.created_at) : '—'}</span>
              </div>
            </section>
          </div>

          {/* Right Column: Dynamic Tabs */}
          <div className="space-y-6 overflow-hidden">
            <div className="flex border-b border-slate-200 dark:border-navy-800 overflow-x-auto no-scrollbar">
              <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<LayoutDashboard size={16} />} label="概览" />
              <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<Package size={16} />} label="订单中心" count={data.orders?.length} />
              <TabButton active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} icon={<Wallet size={16} />} label="财务流水" count={data.finance_records?.length} />
              <TabButton active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} icon={<Users size={16} />} label="联系人矩阵" count={data.contacts?.length} />
            </div>

            <div className="">
              {activeTab === 'overview' && (
                <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm">
                    <div className="mb-6 flex items-center justify-between border-b border-slate-50 dark:border-navy-800 pb-4">
                      <h2 className="text-[14px] font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">最近业务动态</h2>
                    </div>
                    <div className="space-y-0">
                      {data.activities && data.activities.length > 0 ? data.activities.map((activity, i) => (
                        <div key={i} onClick={() => navigate(`/orders/${activity.order_display_id}`)} className="flex items-center justify-between cursor-pointer group py-4 border-b border-slate-100 dark:border-navy-800 last:border-0 hover:bg-slate-50 dark:hover:bg-navy-950/50 px-4 -mx-4 rounded-lg transition-colors">
                          <div className="flex items-start gap-4">
                            <div className={`mt-1 h-8 w-8 aspect-square rounded-full flex items-center justify-center shrink-0 ${activity.type === 'finance' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : activity.type === 'logistics' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' : activity.type === 'customs' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-slate-100 dark:bg-navy-800 text-slate-500'}`}>
                              {activity.type === 'finance' ? <ArrowDownRight size={14} /> : activity.type === 'logistics' ? <Truck size={14} /> : activity.type === 'customs' ? <FileText size={14} /> : <ArrowUpRight size={14} />}
                            </div>
                            <div>
                              <div className="text-[13px] font-extrabold text-primary-navy dark:text-white mb-0.5">{activity.title}</div>
                              <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase">{activity.order_display_id}</div>
                            </div>
                            <div className="ml-8 text-[12px] font-medium text-slate-500 hidden sm:block truncate max-w-[200px] mt-0.5">{activity.desc || '—'}</div>
                          </div>
                          <div className="text-right">
                            {activity.value && <div className={`text-[13px] font-bold data-field mb-0.5 ${activity.valueColor || 'text-primary-navy dark:text-white'}`}>
                              {String(activity.value).replace(/([+-])([A-Z]{3})\s+(\d+\.?\d*)/, (m, sign, curr, amt) => {
                                const n = Number(amt);
                                return isNaN(n) ? m : `${sign}${curr} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                              })}
                            </div>}
                            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{activity.created_at ? String(activity.created_at).slice(0, 16).replace('T', ' ') : '—'}</div>
                          </div>
                        </div>
                      )) : (
                        <EmptyStateBoard title="暂无动态" description="该客户名下尚未产生任何业务流转日志。" icon={<Clock size={40} className="text-slate-200" />} />
                      )}
                    </div>
                </section>
              )}

              {activeTab === 'orders' && (
                <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm flex flex-col">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-navy-950 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                          <tr>
                            <th className="px-6 py-4 text-left">订单号 / 日期</th>
                            <th className="px-6 py-4 text-left">产品摘要</th>
                            <th className="px-6 py-4 text-right">金额 (USD)</th>
                            <th className="px-6 py-4 text-center">状态</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                          {data.orders && data.orders.length ? data.orders.map((order) => (
                            <tr key={order.id} onClick={() => navigate(`/orders/${order.display_id}`)} className="group align-middle hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer">
                              <td className="px-6 py-4 text-left">
                                <div className="text-[13px] font-extrabold text-primary-navy dark:text-white mb-0.5 data-field group-hover:text-blue-600 transition-colors">{order.display_id}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDateOnly(order.created_at)}</div>
                              </td>
                              <td className="px-6 py-4 text-left">
                                <div className="text-slate-600 dark:text-slate-400 font-bold truncate max-w-[200px]" title={order.product_summary}>{order.product_summary || '—'}</div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="text-[14px] font-extrabold text-primary-navy dark:text-white data-field">{Number(order.total_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Chip tone={order.status === 'completed' ? 'success' : order.status === 'draft' ? 'neutral' : 'warning'}>{order.status}</Chip>
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[11px]">暂无关联订单记录</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                </section>
              )}

              {activeTab === 'finance' && (
                <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm flex flex-col">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-navy-950 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                          <tr>
                            <th className="px-6 py-4 text-left">日期 / 订单</th>
                            <th className="px-6 py-4 text-center">类型</th>
                            <th className="px-6 py-4 text-right">金额</th>
                            <th className="px-6 py-4 text-left">对象 / 备注</th>
                            <th className="px-6 py-4 text-center">状态</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                          {data.finance_records && data.finance_records.length ? data.finance_records.map((r) => (
                            <tr key={r.id} onClick={() => navigate(`/orders/${r.order_display_id}`)} className="group align-middle hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer">
                              <td className="px-6 py-4 text-left">
                                <div className="text-[12px] font-bold text-primary-navy dark:text-white mb-0.5 data-field">{formatDateOnly(r.created_at)}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-blue-600 transition-colors">{r.order_display_id || 'MISC'}</div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Chip tone={r.type === 'receipt' ? 'success' : 'error'}>{r.type === 'receipt' ? '收款' : '付款'}</Chip>
                              </td>
                              <td className={`px-6 py-4 text-right font-bold data-field text-[14px] ${r.type === 'receipt' ? 'text-emerald-500' : 'text-error'}`}>
                                {r.type === 'receipt' ? '+' : '-'}{r.currency} {Number(r.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </td>
                              <td className="px-6 py-4 text-left">
                                <div className="font-bold text-primary-navy dark:text-white uppercase tracking-tight truncate max-w-[150px]" title={r.target}>{r.target || '—'}</div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[150px]" title={r.remark}>{r.remark || '—'}</div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Chip tone={r.status === 'completed' ? 'neutral' : 'warning'}>{r.status === 'completed' ? '已核销' : '待处理'}</Chip>
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[11px]">暂无相关财务流水</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                </section>
              )}

              {activeTab === 'contacts' && (
                <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm flex flex-col p-6">
                    <div className="mb-6 flex items-center justify-between">
                      <h2 className="text-[14px] font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">企业联系人矩阵</h2>
                      <button className="text-[12px] font-bold text-primary-navy dark:text-tertiary-sage hover:underline">+ 新增联系人</button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {data.contacts && data.contacts.length ? data.contacts.map(c => (
                        <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 shadow-sm hover:border-primary-navy/20 transition-colors cursor-pointer group">
                          <div className="h-12 w-12 rounded-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 flex items-center justify-center text-primary-navy dark:text-white font-bold text-sm shadow-inner group-hover:scale-105 transition-transform">
                            {String(c.name).charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-bold text-primary-navy dark:text-white truncate" title={c.name}>{c.name}</div>
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{c.title}</div>
                            <div className="text-[12px] text-slate-500 font-medium truncate" title={c.contact}>{c.contact}</div>
                          </div>
                        </div>
                      )) : (
                        <EmptyStateBoard title="暂无联系人" description="尚未录入该企业的关键对接人信息。" />
                      )}
                    </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 text-[13px] font-bold uppercase tracking-widest border-b-2 transition-all ${
        active 
          ? 'border-primary-navy dark:border-tertiary-sage text-primary-navy dark:text-tertiary-sage bg-slate-50 dark:bg-navy-900/50' 
          : 'border-transparent text-slate-500 hover:text-primary-navy dark:hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/50'
      }`}
    >
      {icon} {label}
      {count !== undefined && <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${active ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-slate-100 dark:bg-navy-800 text-slate-500'}`}>{count}</span>}
    </button>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-9 w-9 rounded-full bg-slate-50 dark:bg-navy-950 flex items-center justify-center text-slate-400 border border-slate-100 dark:border-navy-800 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
        <div className="text-[13px] font-bold text-primary-navy dark:text-white mt-0.5 truncate" title={value}>{value}</div>
      </div>
    </div>
  );
}

function StatBox({ title, value, icon, color = "text-primary-navy dark:text-white" }: { title: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-slate-400">{icon}</span>
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{title}</span>
      </div>
      <div className={`text-xl font-extrabold tracking-tight data-field ${color}`}>{value}</div>
    </div>
  );
}
