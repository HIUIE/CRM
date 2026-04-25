import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Plus, Search, Calendar, Package, Trash2, AlertTriangle, X, Copy, Check, Hash } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Chip } from '../features/order-detail/components';
import type { CustomerListItem, OrderSummary } from '../types/crm';

type OrderFormState = {
  displayId: string;
  customerId: string;
  productSummary: string;
  details: string;
  totalAmount: string;
};

const EMPTY_FORM: OrderFormState = {
  displayId: '',
  customerId: '',
  productSummary: '',
  details: '',
  totalAmount: '0',
};

function getOrderStatusMeta(status: string) {
  switch (status) {
    case 'draft': return { label: '待受理', tone: 'neutral' as const };
    case 'production': return { label: '生产中', tone: 'warning' as const };
    case 'customs': return { label: '报关中', tone: 'warning' as const };
    case 'shipping': return { label: '发货中', tone: 'info' as const };
    case 'completed': return { label: '已完成', tone: 'success' as const };
    default: return { label: status, tone: 'neutral' as const };
  }
}

export default function OrdersView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderSummary | null>(null);
  const [formData, setFormData] = useState<OrderFormState>(EMPTY_FORM);

  // 删除确认状态
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<OrderSummary | null>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const timeRange = searchParams.get('timeRange') || 'all';

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);
    setSearchParams(next);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [orderData, customerData] = await Promise.all([
        apiFetch<OrderSummary[]>(`/api/orders?${searchParams.toString()}`),
        apiFetch<CustomerListItem[]>('/api/customers'),
      ]);
      setOrders(orderData);
      setCustomers(customerData);
    } catch (err) {
      setError(getErrorMessage(err, '读取数据失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [searchParams]);

  const openCreateForm = async () => {
    setEditingOrder(null);
    setFormError('');
    // 默认预填逻辑：从后端请求下一个建议单号
    try {
      const { nextId } = await apiFetch<{ nextId: string }>('/api/orders/next-display-id');
      setFormData({ ...EMPTY_FORM, displayId: nextId });
    } catch (err) {
      setFormData(EMPTY_FORM);
    }
    setShowForm(true);
  };

  const openEditForm = (order: OrderSummary) => {
    setEditingOrder(order);
    setFormError('');
    setFormData({
      displayId: order.display_id,
      customerId: String(order.customer_id),
      productSummary: order.product_summary || '',
      details: '',
      totalAmount: String(order.total_amount || 0),
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingOrder(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const payload = { ...formData, customerId: Number(formData.customerId), totalAmount: Number(formData.totalAmount) };
    try {
      if (editingOrder) await apiFetch(`/api/orders/${editingOrder.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else {
        const created = await apiFetch<{ display_id: string }>('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
        navigate(`/orders/${created.display_id}`);
      }
      closeForm();
      await loadData();
    } catch (err) {
      setFormError(getErrorMessage(err, '保存失败'));
    }
  };

  const startDelete = (order: OrderSummary) => {
    setOrderToDelete(order);
    setDeleteInput('');
    setCopied(false);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete || deleteInput !== orderToDelete.display_id) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/orders/${orderToDelete.id}`, { method: 'DELETE' });
      setIsDeleteModalOpen(false);
      await loadData();
    } catch (err) {
      alert(getErrorMessage(err, '删除订单失败'));
    } finally {
      setIsDeleting(false);
    }
  };

  const copyId = () => {
    if (!orderToDelete) return;
    navigator.clipboard.writeText(orderToDelete.display_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm transition-colors text-primary-navy dark:text-white">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px_160px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={q}
              onChange={e => updateParam('q', e.target.value)}
              placeholder="搜索订单号、产品、客户名称..."
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
               <option value="draft">待受理</option>
               <option value="production">生产中</option>
               <option value="customs">报关中</option>
               <option value="shipping">发货中</option>
               <option value="completed">已完成</option>
             </select>
          </div>
          <button onClick={showForm ? closeForm : openCreateForm} className="inline-flex items-center justify-center rounded-2xl bg-primary-navy dark:bg-tertiary-sage px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 dark:hover:bg-emerald-700 shadow-md transition-all active:scale-95">
            <Plus className="mr-2 h-4 w-4" />
            {showForm ? '取消' : '新建订单'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
           {[
             { key: 'week', label: '近一周' },
             { key: 'month', label: '本月' },
             { key: 'last_month', label: '上月' },
             { key: '3months', label: '近3个月' },
             { key: '6months', label: '半年' },
             { key: 'year', label: '近1年' },
             { key: 'all', label: '全部' }
           ].map(chip => (
             <button
               key={chip.key}
               onClick={() => updateParam('timeRange', chip.key)}
               className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-all ${timeRange === chip.key ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-sm' : 'bg-slate-50 dark:bg-navy-950 text-secondary-slate dark:text-slate-400 border border-slate-100 dark:border-navy-800 hover:bg-slate-100 dark:hover:bg-navy-800'}`}
             >
               {chip.label}
             </button>
           ))}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mt-6 rounded-3xl border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 shadow-inner">
            <div className="mb-6 text-[11px] font-bold text-primary-navy dark:text-white uppercase tracking-widest">{editingOrder ? '编辑订单基本信息' : '创建新订单'}</div>
            {formError && <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-800/30 font-bold">{formError}</div>}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Field label="订单单号 *">
                 <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input 
                      required 
                      value={formData.displayId} 
                      onChange={e => setFormData({...formData, displayId: e.target.value.trim()})} 
                      placeholder="如: CQBX-2026-..."
                      className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 pl-9 pr-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none font-bold text-primary-navy dark:text-white data-field"
                    />
                 </div>
              </Field>
              <Field label="关联客户 *">
                <select required value={formData.customerId} onChange={e=>setFormData({...formData, customerId:e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none cursor-pointer text-primary-navy dark:text-white">
                  <option value="">选择客户...</option>
                  {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="订单总额 (USD) *">
                <input required type="number" step="0.01" value={formData.totalAmount} onChange={e=>setFormData({...formData, totalAmount:e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none font-bold text-primary-navy dark:text-white" />
              </Field>
              <div className="md:col-span-2 lg:col-span-3">
                <Field label="产品摘要 *">
                  <input required value={formData.productSummary} onChange={e=>setFormData({...formData, productSummary:e.target.value})} placeholder="例如：太阳能板 A-Type 500pcs..." className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none font-bold text-primary-navy dark:text-white" />
                </Field>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">取消</button>
              <button type="submit" className="rounded-xl bg-primary-navy dark:bg-tertiary-sage px-10 py-2.5 text-sm font-bold text-white hover:bg-slate-800 dark:hover:bg-emerald-700 shadow-md transition-all active:scale-95">确认并进入详情</button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 shadow-md transition-colors">
        {loading ? <div className="p-8 text-sm text-slate-400 dark:text-slate-500 animate-pulse font-bold">读取订单列表中...</div> : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-navy-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                  <tr>
                    <th className="px-4 py-5">订单号 / 日期</th>
                    <th className="px-4 py-5">客户 / 国家</th>
                    <th className="px-4 py-5">产品摘要</th>
                    <th className="px-4 py-5">金额</th>
                    <th className="px-4 py-5">收款进度</th>
                    <th className="px-4 py-5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-900">
                  {orders.length ? orders.map(o => {
                    const meta = getOrderStatusMeta(o.status);
                    return (
                      <tr key={o.id} onClick={() => {
                        if (document.startViewTransition) {
                          document.startViewTransition(() => navigate(`/orders/${o.display_id}`));
                        } else {
                          navigate(`/orders/${o.display_id}`);
                        }
                      }} className="group align-middle hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer">
                        <td className="px-4 py-5">
                           <div 
                             className="font-bold text-primary-navy dark:text-tertiary-sage uppercase data-field"
                             style={{ viewTransitionName: 'order-id' }}
                           >
                             {o.display_id}
                           </div>
                           <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-1.5 font-bold data-field">{formatDateOnly(o.created_at)}</div>
                        </td>
                        <td className="px-4 py-5">
                           <div className="font-bold text-primary-navy dark:text-white uppercase tracking-tight">{o.customer_name}</div>
                           <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 uppercase font-extrabold">{o.customer_country}</div>
                        </td>
                        <td className="px-4 py-5">
                           <div className="flex items-center gap-2 mb-1.5"><Chip tone={meta.tone}>{meta.label}</Chip></div>
                           <div className="text-slate-600 dark:text-slate-400 font-bold truncate max-w-[200px]">{o.product_summary}</div>
                        </td>
                        <td className="px-4 py-5 font-bold text-primary-navy dark:text-white data-field text-[15px]">USD {Number(o.total_amount).toLocaleString()}</td>
                        <td className="px-4 py-5">
                           <div className="text-tertiary-sage dark:text-emerald-400 font-bold data-field">USD {Number(o.completed_receipt_usd).toLocaleString()}</div>
                           <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1.5">核销中: {o.pending_finance_count} 笔</div>
                        </td>
                        <td className="px-4 py-5" onClick={e=>e.stopPropagation()}>
                           <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={()=>openEditForm(o)} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white hover:border-slate-300 dark:hover:border-navy-600 rounded-lg border border-transparent shadow-sm transition-all"><Edit size={14} /></button>
                              {user?.role === 'admin' && (
                                <button 
                                  onClick={() => void startDelete(o)} 
                                  className="p-2 text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 rounded-lg border border-transparent shadow-sm transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                           </div>
                        </td>
                      </tr>
                    );
                  }) : <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">暂无订单记录。</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Danger Modal: 订单列表删除二次确认 */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)} />
           <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-navy-900 shadow-2xl border border-red-100 dark:border-red-900/30 animate-in zoom-in duration-300">
              <div className="bg-red-50 dark:bg-red-900/20 px-6 py-4 flex items-center gap-3 border-b border-red-100 dark:border-red-900/30">
                 <AlertTriangle className="text-red-600 dark:text-red-400" size={20} />
                 <h3 className="text-sm font-extrabold text-red-700 dark:text-red-400 uppercase tracking-widest">高危删除确认</h3>
              </div>
              <div className="p-6 space-y-5">
                 <div className="space-y-2">
                    <p className="text-[13px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                        确定要永久删除订单吗？此操作将同步清除与之关联的所有<span className="text-red-600 font-bold">生产、财务及物流数据</span>。
                    </p>
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-xl border border-slate-100 dark:border-navy-800">
                       <span className="font-bold text-primary-navy dark:text-white data-field">{orderToDelete?.display_id}</span>
                       <button onClick={copyId} className="flex items-center gap-1 text-[10px] font-bold text-primary-navy dark:text-tertiary-sage hover:opacity-70 transition-all uppercase tracking-widest">
                          {copied ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制单号</>}
                       </button>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">请输入单号以确认删除</label>
                    <input 
                       value={deleteInput}
                       onChange={e => setDeleteInput(e.target.value)}
                       placeholder={`输入 ${orderToDelete?.display_id}`}
                       className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 px-4 py-3 text-sm font-bold text-primary-navy dark:text-white outline-none focus:border-red-500 transition-all data-field shadow-inner"
                    />
                 </div>
                 <div className="flex gap-3 pt-2">
                    <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 rounded-xl border border-slate-200 dark:border-navy-800 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all uppercase tracking-widest">取消</button>
                    <button 
                       disabled={isDeleting || deleteInput !== orderToDelete?.display_id}
                       onClick={handleConfirmDelete}
                       className="flex-2 rounded-xl bg-red-600 px-6 py-3 text-xs font-bold text-white shadow-lg hover:bg-red-700 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest"
                    >
                       {isDeleting ? '正在销毁...' : '确认永久删除'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-primary-navy dark:text-white uppercase tracking-widest opacity-70">{label}</span>
      {children}
    </label>
  );
}

function formatDateOnly(v: string) {
  if (!v) return '-';
  return v.split(' ')[0];
}
