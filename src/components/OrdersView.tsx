import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Plus, Search, Calendar, Package } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import { Chip } from '../features/order-detail/components';
import type { CustomerListItem, OrderSummary } from '../types/crm';

type OrderFormState = {
  customerId: string;
  productSummary: string;
  details: string;
  totalAmount: string;
};

const EMPTY_FORM: OrderFormState = {
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

  const openCreateForm = () => {
    setEditingOrder(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (order: OrderSummary) => {
    setEditingOrder(order);
    setFormData({
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

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px_160px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={e => updateParam('q', e.target.value)}
              placeholder="搜索订单号、产品、客户名称..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-primary-navy transition-all outline-none"
            />
          </div>
          <select
            value={status}
            onChange={e => updateParam('status', e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-primary-navy outline-none appearance-none cursor-pointer"
          >
            <option value="">全部状态</option>
            <option value="draft">待受理</option>
            <option value="production">生产中</option>
            <option value="customs">报关中</option>
            <option value="shipping">发货中</option>
            <option value="completed">已完成</option>
          </select>
          <button onClick={openCreateForm} className="inline-flex items-center justify-center rounded-2xl bg-primary-navy px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 shadow-md transition-all active:scale-95">
            <Plus className="mr-2 h-4 w-4" />
            新建订单
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
               className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-all ${timeRange === chip.key ? 'bg-primary-navy text-white shadow-sm' : 'bg-slate-50 text-secondary-slate hover:bg-slate-100'}`}
             >
               {chip.label}
             </button>
           ))}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mt-6 rounded-3xl border border-slate-100 bg-slate-50 p-6 shadow-inner">
            <div className="mb-6 text-[11px] font-bold text-primary-navy uppercase tracking-widest">{editingOrder ? '编辑订单基本信息' : '创建新订单'}</div>
            {formError && <div className="mb-4 text-sm text-error bg-error/5 p-3 rounded-lg border border-error/10 font-bold">{formError}</div>}
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="关联客户 *">
                <select required value={formData.customerId} onChange={e=>setFormData({...formData, customerId:e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy outline-none appearance-none cursor-pointer">
                  <option value="">选择客户...</option>
                  {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="订单总额 (USD) *">
                <input required type="number" step="0.01" value={formData.totalAmount} onChange={e=>setFormData({...formData, totalAmount:e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy outline-none font-bold" />
              </Field>
              <div className="md:col-span-2">
                <Field label="产品摘要 *">
                  <input required value={formData.productSummary} onChange={e=>setFormData({...formData, productSummary:e.target.value})} placeholder="例如：太阳能板 A-Type 500pcs..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy outline-none font-bold" />
                </Field>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50">取消</button>
              <button type="submit" className="rounded-xl bg-primary-navy px-10 py-2.5 text-sm font-bold text-white hover:bg-slate-800 shadow-md transition-all active:scale-95">确认并进入详情</button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-md">
        {loading ? <div className="p-8 text-sm text-slate-400 animate-pulse font-bold">读取订单列表中...</div> : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-5">订单号 / 日期</th>
                    <th className="px-4 py-5">客户 / 国家</th>
                    <th className="px-4 py-5">产品摘要</th>
                    <th className="px-4 py-5">金额</th>
                    <th className="px-4 py-5">收款进度</th>
                    <th className="px-4 py-5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {orders.length ? orders.map(o => {
                    const meta = getOrderStatusMeta(o.status);
                    return (
                      <tr key={o.id} onClick={() => navigate(`/orders/${o.display_id}`)} className="group align-middle hover:bg-slate-50 transition-colors cursor-pointer">
                        <td className="px-4 py-5">
                           <div className="font-bold text-primary-navy uppercase data-field">{o.display_id}</div>
                           <div className="text-[10px] text-slate-500 mt-1.5 font-bold data-field">{formatDateOnly(o.created_at)}</div>
                        </td>
                        <td className="px-4 py-5">
                           <div className="font-bold text-primary-navy uppercase tracking-tight">{o.customer_name}</div>
                           <div className="text-[11px] text-slate-400 mt-1 uppercase font-extrabold">{o.customer_country}</div>
                        </td>
                        <td className="px-4 py-5">
                           <div className="flex items-center gap-2 mb-1.5"><Chip tone={meta.tone}>{meta.label}</Chip></div>
                           <div className="text-slate-600 font-bold truncate max-w-[200px]">{o.product_summary}</div>
                        </td>
                        <td className="px-4 py-5 font-bold text-primary-navy data-field text-[15px]">USD {Number(o.total_amount).toLocaleString()}</td>
                        <td className="px-4 py-5">
                           <div className="text-tertiary-sage font-bold data-field">USD {Number(o.completed_receipt_usd).toLocaleString()}</div>
                           <div className="text-[11px] text-slate-400 font-bold uppercase mt-1.5">核销中: {o.pending_finance_count} 笔</div>
                        </td>
                        <td className="px-4 py-5" onClick={e=>e.stopPropagation()}>
                           <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={()=>openEditForm(o)} className="p-2 text-slate-500 hover:bg-white hover:text-primary-navy hover:border-slate-300 rounded-lg border border-transparent shadow-sm transition-all"><Edit size={14} /></button>
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
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-primary-navy uppercase tracking-widest opacity-70">{label}</span>
      {children}
    </label>
  );
}

function formatDateOnly(v: string) {
  if (!v) return '-';
  return v.split(' ')[0];
}
function setEditingRecord(arg0: null) {
  throw new Error('Function not implemented.');
}

