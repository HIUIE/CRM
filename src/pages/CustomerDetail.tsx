import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Building2, MapPin, Phone, Share2, Package, Wallet, Clock, 
  ArrowLeft, ChevronRight, Edit, Mail, Globe, ArrowDownRight, Truck, FileText, ArrowUpRight, Plus, Users, LayoutDashboard, DollarSign, Star, MoreVertical, Pencil, Save, X, Send, History, Check, CheckCircle2, MessageSquare
} from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { Chip, EmptyStateBoard, Toast } from '../features/order-detail/components';
import { formatDateOnly } from '../features/order-detail/utils';
import { TaskDrawer } from '../components/ui/TaskDrawer';
import { OrderCreateDrawer } from '../components/ui/OrderCreateDrawer';
import { FinanceCreateDrawer } from '../components/ui/FinanceCreateDrawer';
import { ContactCreateDrawer } from '../components/ui/ContactCreateDrawer';
import CountryDisplay from '../components/ui/CountryDisplay';

interface CustomerDetailData {
  id: number;
  display_id: string;
  name: string;
  country: string;
  contact: string;
  source_channel?: string;
  intent_products?: string;
  created_by_name?: string;
  created_at: string;
  orders: any[];
  finance_records: any[];
  system_activities: any[];
  followups: any[];
  contacts: any[];
  tasks: any[];
}

type TabKey = 'followups' | 'orders' | 'finance' | 'tasks' | 'contacts' | 'system_activities';

const LEAD_SOURCE_OPTIONS = [
  '阿里巴巴国际站',
  '独立站/官网',
  '展会拜访',
  '转介绍',
  '开发信',
  '其他'
];

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CustomerDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('followups');
  const [toast, setToast] = useState('');
  const [followupInput, setFollowupInput] = useState('');
  const [isSubmittingFollowup, setIsSubmittingFollowup] = useState(false);
  const [showTaskDrawer, setShowTaskDrawer] = useState(false);
  const [showOrderDrawer, setShowOrderDrawer] = useState(false);
  const [showFinanceDrawer, setShowFinanceDrawer] = useState(false);
  const [showContactDrawer, setShowContactDrawer] = useState(false);

  // Inline Editing State
  const [editingField, setEditingField] = useState<string | null>(null);

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

  const handleInlineSave = async (field: keyof CustomerDetailData, value: any) => {
    if (!data) return;
    try {
      const payload = { ...data, [field]: value };
      await apiFetch(`/api/customers/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: payload.name,
          country: payload.country,
          contact: payload.contact,
          sourceChannel: payload.source_channel,
          intentProducts: payload.intent_products,
        }),
      });
      setData(payload);
      setToast('资料已自动保存');
      setTimeout(() => setToast(''), 2000);
    } catch (err) {
      alert(getErrorMessage(err, '更新失败'));
    }
    setEditingField(null);
  };

  const handlePostFollowup = async () => {
    if (!followupInput.trim() || !data) return;
    setIsSubmittingFollowup(true);
    try {
      await apiFetch(`/api/customers/${data.display_id || data.id}/followups`, {
        method: 'POST',
        body: JSON.stringify({ content: followupInput }),
      });
      setFollowupInput('');
      await loadDetail();
      setToast('跟进记录已发布');
      setTimeout(() => setToast(''), 2000);
    } catch (err) {
      alert(getErrorMessage(err, '发布失败'));
    } finally {
      setIsSubmittingFollowup(false);
    }
  };

  if (loading) return <div className="flex h-screen w-full items-center justify-center p-8 text-sm text-slate-500 animate-pulse uppercase tracking-widest font-bold">正在画像客户数据...</div>;
  if (error || !data) return <div className="p-8 m-4 rounded-lg bg-red-50 text-red-600 border border-red-100 font-bold text-center">{error || '客户不存在'}</div>;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Flattened Header: Action Unfold */}
      <header className="sticky top-0 z-[60] -mx-2 -mt-2 mb-4 flex items-center justify-between border-b border-slate-100 dark:border-navy-800 bg-white/95 dark:bg-navy-950/95 px-6 py-4 backdrop-blur-md transition-colors shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/customers')} 
            className="group flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-navy-800 text-slate-400 hover:border-primary-navy transition-all shadow-sm bg-white dark:bg-navy-900"
            title="返回客户列表"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex items-center gap-2 text-[13px] font-bold tracking-tight">
            <Link to="/customers" className="text-slate-400 uppercase tracking-widest hover:text-primary-navy dark:hover:text-white transition-colors">客户管理</Link>
            <span className="text-slate-200 dark:text-navy-800">/</span>
            <span className="text-primary-navy dark:text-white uppercase truncate max-w-[200px]">{data.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => setShowFinanceDrawer(true)} 
             className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white transition-all uppercase tracking-widest shadow-sm"
           >
             <DollarSign size={14} /> 录入收款
           </button>
           <button 
             onClick={() => navigate(`/logistics?customerId=${data.id}&create=1`)} 
             className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white transition-all uppercase tracking-widest shadow-sm"
           >
             <Truck size={14} /> 创建物流
           </button>
           <button 
             onClick={() => setShowOrderDrawer(true)} 
             className="flex items-center gap-2 rounded-lg bg-primary-navy dark:bg-tertiary-sage px-5 py-2 text-[11px] font-bold text-white shadow-md hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all active:scale-95 uppercase tracking-widest"
           >
             <Plus size={16} /> 新建订单
           </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr] items-start pb-12">
          {/* Left Column: Fixed Profile */}
          <div className="space-y-6 lg:sticky lg:top-0">
            <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm transition-colors overflow-hidden relative group">
              <div className="absolute top-0 right-0 h-32 w-32 translate-x-16 -translate-y-16 rounded-full bg-slate-50 dark:bg-navy-800 pointer-events-none" />
              <div className="relative z-10">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 dark:bg-navy-950 shadow-inner border border-slate-100 dark:border-navy-800">
                  <Building2 size={32} className="text-primary-navy dark:text-tertiary-sage" />
                </div>
                
                <EditableField 
                  value={data.name} 
                  onSave={(val) => handleInlineSave('name', val)} 
                  className="text-2xl font-extrabold text-primary-navy dark:text-white uppercase tracking-tight mb-2" 
                />

                <div className="mb-6">
                  <CountryDisplay value={data.country} className="text-xs uppercase tracking-widest" />
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

                  <div className="flex items-center gap-4 group px-1">
                    <div className="h-9 w-9 rounded-full bg-slate-50 dark:bg-navy-950 flex items-center justify-center text-slate-400 border border-slate-100 dark:border-navy-800 shrink-0">
                      <MapPin size={16} />
                    </div>
                    <div className="min-w-0 flex-1 relative">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">国家 / 地区</div>
                      <CountryDisplay value={data.country} className="mt-0.5" />
                    </div>
                  </div>

                  <InfoRow icon={<Phone size={16} />} label="联系方式" value={data.contact || '—'} isEditable onSave={(val) => handleInlineSave('contact', val)} />
                  <InfoRow 
                    icon={<Globe size={16} />} 
                    label="线索渠道" 
                    value={data.source_channel || '—'} 
                    isEditable 
                    type="select"
                    options={LEAD_SOURCE_OPTIONS}
                    onSave={(val) => handleInlineSave('source_channel', val)} 
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm">
              <h3 className="text-[12px] font-extrabold text-primary-navy dark:text-white uppercase tracking-widest mb-4">意向偏好</h3>
              <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-100 dark:border-navy-800 group relative cursor-pointer" onClick={() => setEditingField('intent_products')}>
                {editingField === 'intent_products' ? (
                   <textarea
                    autoFocus
                    onBlur={(e) => handleInlineSave('intent_products', e.target.value)}
                    defaultValue={data.intent_products}
                    className="w-full bg-transparent text-[12px] font-medium focus:outline-none"
                    rows={4}
                   />
                ) : (
                  <>
                    <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium italic">
                      “{data.intent_products || '暂无明确意向描述'}”
                    </p>
                    <Pencil size={12} className="absolute top-2 right-2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </>
                )}
              </div>
              <div className="mt-6 flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                <span>归属人员：{data.created_by_name || '系统分配'}</span>
                <span>建档：{data.created_at ? formatDateOnly(data.created_at) : '—'}</span>
              </div>
            </section>
          </div>

          {/* Right Column: Dynamic Tabs */}
          <div className="space-y-6 overflow-hidden min-h-0 flex flex-col">
            <div className="flex border-b border-slate-200 dark:border-navy-800 overflow-x-auto no-scrollbar shrink-0">
              <TabButton active={activeTab === 'followups'} onClick={() => setActiveTab('followups')} icon={<MessageSquare size={16} />} label="跟进记录" count={data.followups?.length} />
              <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<Package size={16} />} label="订单中心" count={data.orders?.length} />
              <TabButton active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} icon={<Wallet size={16} />} label="财务流水" count={data.finance_records?.length} />
              <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<CheckCircle2 size={16} />} label="关联任务" count={data.tasks?.length} />
              <TabButton active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} icon={<Users size={16} />} label="联系人矩阵" count={data.contacts?.length} />
              <TabButton active={activeTab === 'system_activities'} onClick={() => setActiveTab('system_activities')} icon={<History size={16} />} label="业务流转" count={data.system_activities?.length} />
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {activeTab === 'followups' && (
                <div className="space-y-6">
                  {/* Followup Posting Box */}
                  <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 shadow-sm">
                    <textarea 
                      value={followupInput}
                      onChange={(e) => setFollowupInput(e.target.value)}
                      placeholder="记录今天的沟通摘要：聊了什么？重点需求？"
                      className="w-full bg-slate-50 dark:bg-navy-950 rounded-xl p-4 text-sm font-medium focus:bg-white dark:focus:bg-navy-900 focus:ring-2 focus:ring-primary-navy/5 outline-none transition-all resize-none min-h-[100px] border border-slate-100 dark:border-navy-800"
                    />
                    <div className="mt-3 flex justify-end">
                       <button 
                        disabled={!followupInput.trim() || isSubmittingFollowup}
                        onClick={handlePostFollowup}
                        className="flex items-center gap-2 rounded-lg bg-primary-navy dark:bg-tertiary-sage px-6 py-2 text-[11px] font-bold text-white shadow-md hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-30 uppercase tracking-widest"
                       >
                         <Send size={14} /> {isSubmittingFollowup ? '发布中...' : '发布跟进'}
                       </button>
                    </div>
                  </section>

                  {/* Manual Follow-ups Feed */}
                  <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-0 before:bottom-0 before:w-[2px] before:bg-slate-100 dark:before:bg-navy-800">
                    {data.followups && data.followups.length > 0 ? data.followups.map((f, i) => (
                      <div key={i} className="relative group">
                        <div className="absolute -left-8 top-1 h-6 w-6 rounded-full border-4 border-white dark:border-navy-950 flex items-center justify-center z-10 shadow-sm bg-primary-navy">
                           <MessageSquare size={10} className="text-white" />
                        </div>
                        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-100 dark:border-navy-800 p-5 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                             <span className="text-[13px] font-extrabold text-primary-navy dark:text-white uppercase">{f.created_by_name}</span>
                             <span className="text-[11px] font-bold text-slate-400 data-field">{String(f.created_at).slice(0, 16).replace('T', ' ')}</span>
                          </div>
                          <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">{f.content}</p>
                        </div>
                      </div>
                    )) : (
                      <EmptyStateBoard title="暂无跟进记录" description="点击上方输入框，记录该客户的沟通进程。" icon={<MessageSquare size={40} className="text-slate-200" />} />
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'system_activities' && (
                <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-0 before:bottom-0 before:w-[2px] before:bg-slate-100 dark:before:bg-navy-800">
                  {data.system_activities && data.system_activities.length > 0 ? data.system_activities.map((activity, i) => (
                    <div key={i} className="relative group">
                      <div className={`absolute -left-8 top-1 h-6 w-6 rounded-full border-4 border-white dark:border-navy-950 flex items-center justify-center z-10 shadow-sm transition-transform group-hover:scale-110 ${activity.type === 'finance' ? 'bg-emerald-500' : activity.type === 'logistics' ? 'bg-blue-500' : activity.type === 'customs' ? 'bg-amber-500' : 'bg-slate-400'}`}>
                          {activity.type === 'finance' ? <DollarSign size={10} className="text-white" /> : activity.type === 'logistics' ? <Truck size={10} className="text-white" /> : <Clock size={10} className="text-white" />}
                      </div>
                      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-100 dark:border-navy-800 p-4 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-[13px] font-extrabold text-primary-navy dark:text-white uppercase tracking-tight">{activity.title}</span>
                              {activity.order_display_id && <Chip tone="neutral">{activity.order_display_id}</Chip>}
                            </div>
                            <span className="text-[11px] font-bold text-slate-400 data-field">{String(activity.created_at).slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                          {activity.desc || '—'}
                        </p>
                        {activity.value && (
                          <div className={`mt-2 text-[12px] font-bold data-field ${activity.valueColor || 'text-primary-navy dark:text-white'}`}>
                            {activity.value}
                          </div>
                        )}
                      </div>
                    </div>
                  )) : (
                    <EmptyStateBoard title="暂无动态" description="系统尚未捕捉到相关的业务流转操作。" icon={<Clock size={40} className="text-slate-200" />} />
                  )}
                </div>
              )}

              {activeTab === 'orders' && (
                <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm flex flex-col">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-navy-950 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                          <tr>
                            <th className="px-6 py-4">订单号 / 日期</th>
                            <th className="px-6 py-4">产品摘要</th>
                            <th className="px-6 py-4 text-right">金额 (USD)</th>
                            <th className="px-6 py-4 text-center">状态</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-900">
                          {data.orders && data.orders.length ? data.orders.map((order) => (
                            <tr key={order.id} onClick={() => navigate(`/orders/${String(order.display_id).toLowerCase()}`)} className="group align-middle hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer">
                              <td className="px-6 py-4">
                                <div className="text-[13px] font-extrabold text-primary-navy dark:text-white mb-0.5 data-field group-hover:text-blue-600 transition-colors">{order.display_id}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDateOnly(order.created_at)}</div>
                              </td>
                              <td className="px-6 py-4">
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
                      <table className="min-w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-navy-950 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                          <tr>
                            <th className="px-6 py-4">日期 / 订单</th>
                            <th className="px-6 py-4 text-center">类型</th>
                            <th className="px-6 py-4 text-right">金额</th>
                            <th className="px-6 py-4">对象 / 备注</th>
                            <th className="px-6 py-4 text-center">状态</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-900">
                          {data.finance_records && data.finance_records.length ? data.finance_records.map((r) => (
                            <tr key={r.id} onClick={() => navigate(`/orders/${String(r.order_display_id).toLowerCase()}`)} className="group align-middle hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer">
                              <td className="px-6 py-4">
                                <div className="text-[12px] font-bold text-primary-navy dark:text-white mb-0.5 data-field">{formatDateOnly(r.created_at)}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-blue-600 transition-colors">{r.order_display_id || 'MISC'}</div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Chip tone={r.type === 'receipt' ? 'success' : 'error'}>{r.type === 'receipt' ? '收款' : '付款'}</Chip>
                              </td>
                              <td className={`px-6 py-4 text-right font-bold data-field text-[14px] ${r.type === 'receipt' ? 'text-emerald-500' : 'text-error'}`}>
                                {r.type === 'receipt' ? '+' : '-'}{r.currency} {Number(r.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </td>
                              <td className="px-6 py-4">
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

              {activeTab === 'tasks' && (
                 <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm">
                    <div className="mb-6 flex items-center justify-between">
                      <h2 className="text-[14px] font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">关联协同任务</h2>
                      <button onClick={() => setShowTaskDrawer(true)} className="text-[12px] font-bold text-primary-navy dark:text-tertiary-sage hover:underline">+ 指派新任务</button>
                    </div>
                    <div className="space-y-3">
                      {data.tasks && data.tasks.length > 0 ? data.tasks.map(t => (
                        <div key={t.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950/50 rounded-xl border border-slate-100 dark:border-navy-800 hover:bg-white dark:hover:bg-navy-800 transition-all group">
                           <div className="flex items-center gap-4">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${t.status === 'done' ? 'bg-emerald-50 text-emerald-500' : 'bg-white border border-slate-200 text-slate-400'}`}>
                                 {t.status === 'done' ? <Check size={14} /> : <Clock size={14} />}
                              </div>
                              <div>
                                 <div className={`text-[13px] font-bold ${t.status === 'done' ? 'text-slate-400 line-through' : 'text-primary-navy dark:text-white'}`}>{t.title}</div>
                                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">负责人: {t.assignee_name} · 截止: {t.due_date}</div>
                              </div>
                           </div>
                           <Chip tone={t.priority === 'P0' ? 'error' : t.priority === 'P1' ? 'warning' : 'info'}>{t.priority}</Chip>
                        </div>
                      )) : (
                        <EmptyStateBoard title="暂无关联任务" description="您可以为该客户指派特定的跟进任务或待办事项。" icon={<CheckCircle2 size={40} className="text-slate-100" />} />
                      )}
                    </div>
                 </section>
              )}

              {activeTab === 'contacts' && (
                <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm flex flex-col p-6">
                    <div className="mb-6 flex items-center justify-between">
                      <h2 className="text-[14px] font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">企业联系人矩阵</h2>
                      <button onClick={() => setShowContactDrawer(true)} className="text-[12px] font-bold text-primary-navy dark:text-tertiary-sage hover:underline">+ 新增联系人</button>
                      </div>                    <div className="grid gap-4 sm:grid-cols-2">
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
                        <EmptyStateBoard title="暂无联系人" description="尚未录入该企业的关键对接人信息。" icon={<Users size={40} className="text-slate-100" />} />
                      )}
                    </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>

      <TaskDrawer
        isOpen={showTaskDrawer}
        onClose={() => setShowTaskDrawer(false)}
        onSuccess={loadDetail}
        entityType="CUSTOMER"
        entityId={String(data.id)}
        entityName={data.name}
      />
      <OrderCreateDrawer
        isOpen={showOrderDrawer}
        onClose={() => setShowOrderDrawer(false)}
        onSuccess={(displayId) => {
          setToast('订单已创建');
          setTimeout(() => navigate(`/orders/${displayId.toLowerCase()}`), 1500);
        }}
        initialCustomerId={data.id}
        initialCustomerName={data.name}
      />
      <FinanceCreateDrawer
        isOpen={showFinanceDrawer}
        onClose={() => setShowFinanceDrawer(false)}
        onSuccess={loadDetail}
        initialCustomerId={data.id}
        initialCustomerName={data.name}
      />
      <ContactCreateDrawer
        isOpen={showContactDrawer}
        onClose={() => setShowContactDrawer(false)}
        onSuccess={loadDetail}
        customerId={data.id}
      />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 text-[13px] font-bold uppercase tracking-widest border-b-2 transition-all ${
        active 
          ? 'border-primary-navy dark:border-tertiary-sage text-primary-navy dark:text-tertiary-sage bg-slate-50 dark:bg-navy-900/30' 
          : 'border-transparent text-slate-500 hover:text-primary-navy dark:hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/30'
      }`}
    >
      {icon} {label}
      {count !== undefined && <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${active ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-slate-100 dark:bg-navy-800 text-slate-500'}`}>{count}</span>}
    </button>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-[12px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white transition-all uppercase tracking-tight"
    >
      <span className="opacity-70">{icon}</span>
      {label}
    </button>
  );
}

function InfoRow({ icon, label, value, isEditable, onSave, type = 'text', options = [] }: { icon: React.ReactNode; label: string; value: string; isEditable?: boolean; onSave?: (val: string) => void; type?: 'text' | 'select'; options?: string[] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(value);

  return (
    <div className="flex items-center gap-4 group">
      <div className="h-9 w-9 rounded-full bg-slate-50 dark:bg-navy-950 flex items-center justify-center text-slate-400 border border-slate-100 dark:border-navy-800 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1 relative">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
        {isEditing ? (
          type === 'select' ? (
            <select
              autoFocus
              value={val}
              onChange={(e) => { setVal(e.target.value); onSave?.(e.target.value); setIsEditing(false); }}
              onBlur={() => setIsEditing(false)}
              className="text-[13px] font-bold text-primary-navy dark:text-white mt-0.5 w-full bg-white dark:bg-navy-900 border border-slate-200 rounded p-1 outline-none"
            >
               <option value="">请选择...</option>
               {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              autoFocus
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={() => { setIsEditing(false); if (val !== value) onSave?.(val); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setIsEditing(false); if (val !== value) onSave?.(val); } }}
              className="text-[13px] font-bold text-primary-navy dark:text-white mt-0.5 w-full bg-transparent border-b border-primary-navy/20 outline-none"
            />
          )
        ) : (
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-bold text-primary-navy dark:text-white mt-0.5 truncate" title={value}>{value}</div>
            {isEditable && (
              <button onClick={() => setIsEditing(true)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-300 hover:text-primary-navy">
                <Pencil size={10} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EditableField({ value, onSave, className }: { value: string; onSave: (val: string) => void; className: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(value);

  if (isEditing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { setIsEditing(false); if (val !== value) onSave(val); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { setIsEditing(false); if (val !== value) onSave(val); } }}
        className={`${className} bg-transparent border-b-2 border-primary-navy/20 outline-none w-fit`}
      />
    );
  }

  return (
    <div className="relative group cursor-pointer inline-block" onClick={() => setIsEditing(true)}>
      <h1 className={className}>{value || '—'}</h1>
      <Pencil size={14} className="absolute -right-6 top-1 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
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
