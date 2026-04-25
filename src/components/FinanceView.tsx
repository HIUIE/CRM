import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Paperclip, Plus, Search, Trash2, Wallet, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Chip } from '../features/order-detail/components';
import type { FinanceListRecord, OrderOption, PartnerOption } from '../types/crm';

type FinanceFormState = {
  orderId: string;
  type: 'receipt' | 'payment';
  amount: string;
  currency: string;
  target: string;
  partnerId: string;
  status: 'pending' | 'completed';
  recordCategory: 'deposit' | 'balance' | 'goods' | 'freight' | 'customs' | 'other';
  remark: string;
};

const EMPTY_FORM: FinanceFormState = {
  orderId: '',
  type: 'receipt',
  amount: '0',
  currency: 'USD',
  target: '',
  partnerId: '',
  status: 'pending',
  recordCategory: 'deposit',
  remark: '',
};

function formatTotal(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function getPaymentCategoryLabel(category: string | undefined) {
  switch (category) {
    case 'deposit': return '首付款';
    case 'balance': return '尾款';
    case 'freight': return '运费';
    case 'goods': return '货款';
    case 'customs': return '报关费';
    case 'other': return '其他';
    default: return category || '其他';
  }
}

export default function FinanceView() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState<FinanceListRecord[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceListRecord | null>(null);
  const [formData, setFormData] = useState<FinanceFormState>(EMPTY_FORM);

  const query = searchParams.get('q') || '';
  const timeRange = searchParams.get('timeRange') || 'all';

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);
    setSearchParams(next);
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [financeData, orderData, partnerData] = await Promise.all([
        apiFetch<FinanceListRecord[]>(`/api/finance?timeRange=${timeRange}`),
        apiFetch<OrderOption[]>('/api/orders'),
        apiFetch<PartnerOption[]>('/api/partners'),
      ]);
      setRecords(financeData);
      setOrders(orderData);
      setPartners(partnerData);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '读取财务数据失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [timeRange]);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) =>
      [record.order_display_id || '', record.customer_name || '', record.partner_name || '', record.target || '', record.remark || '']
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [records, query]);

  const totals = useMemo(() => {
    const res: { receipt: Record<string, number>; payment: Record<string, number>; pending: number } = { receipt: {}, payment: {}, pending: 0 };
    records.forEach(r => {
      if (r.status !== 'completed') { res.pending++; return; }
      const cur = r.currency || 'USD';
      if (r.type === 'receipt') res.receipt[cur] = (res.receipt[cur] || 0) + r.amount;
      else res.payment[cur] = (res.payment[cur] || 0) + r.amount;
    });
    return res;
  }, [records]);

  const openCreateForm = () => {
    setEditingRecord(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (record: FinanceListRecord) => {
    setEditingRecord(record);
    setFormError('');
    setFormData({
      orderId: String(record.order_id),
      type: record.type,
      amount: String(record.amount),
      currency: record.currency,
      target: record.target || '',
      partnerId: record.partnerId ? String(record.partnerId) : '',
      status: record.status,
      recordCategory: (record.recordCategory as any) || (record.type === 'payment' ? 'goods' : 'deposit'),
      remark: record.remark || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingRecord(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowForm(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    const payload = { ...formData, orderId: Number(formData.orderId), amount: Number(formData.amount), partnerId: formData.partnerId ? Number(formData.partnerId) : null };
    try {
      if (editingRecord) await apiFetch(`/api/finance/${editingRecord.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await apiFetch('/api/finance', { method: 'POST', body: JSON.stringify(payload) });
      closeForm();
      await fetchData();
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, '保存财务记录失败'));
    }
  };

  const deleteRecord = async (record: FinanceListRecord) => {
    if (!window.confirm(`确定删除这条记录吗？`)) return;
    try {
      await apiFetch(`/api/finance/${record.id}`, { method: 'DELETE' });
      await fetchData();
    } catch (requestError) {
      setError(getErrorMessage(requestError, '删除财务记录失败'));
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm transition-colors">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={query}
              onChange={(event) => updateParam('q', event.target.value)}
              placeholder="搜索订单、客户、对象或分类..."
              className="w-full rounded-2xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 py-2.5 pl-10 pr-4 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
            />
          </div>
          <button
            onClick={showForm ? closeForm : openCreateForm}
            className="inline-flex items-center justify-center rounded-2xl bg-primary-navy dark:bg-tertiary-sage px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-800 dark:hover:bg-emerald-700 shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" />
            {showForm ? '取消' : '登记流水'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
           {[
             { key: 'week', label: '本周' },
             { key: 'month', label: '本月' },
             { key: '3months', label: '近3个月' },
             { key: '6months', label: '近半年' },
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

        {error ? <div className="mt-4 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div> : null}

        <div className="mt-6 grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
           <StatCard title="USD 收款" value={totals.receipt.USD || 0} icon={<ArrowDownLeft className="text-success" size={16} />} currency="USD" />
           <StatCard title="CNY 收款" value={totals.receipt.CNY || 0} icon={<ArrowDownLeft className="text-success" size={16} />} currency="CNY" />
           <StatCard title="USD 付款" value={totals.payment.USD || 0} icon={<ArrowUpRight className="text-error" size={16} />} currency="USD" />
           <StatCard title="CNY 付款" value={totals.payment.CNY || 0} icon={<ArrowUpRight className="text-error" size={16} />} currency="CNY" />
           <div className="bg-slate-50 dark:bg-navy-950/50 p-3 rounded-2xl border border-slate-100 dark:border-navy-800 flex items-center justify-between transition-colors">
              <div>
                <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">待核销</div>
                <div className="text-lg font-bold text-primary-navy dark:text-white data-field leading-none">{totals.pending} 笔</div>
              </div>
              <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center text-warning"><Clock size={16} /></div>
           </div>
        </div>

        {showForm ? (
          <form onSubmit={handleSubmit} className="mt-6 rounded-3xl border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 shadow-inner">
            <div className="mb-6 text-[11px] font-bold text-primary-navy dark:text-white uppercase tracking-widest">{editingRecord ? '编辑财务流水' : '新增财务流水'}</div>
            {formError ? <div className="mb-4 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{formError}</div> : null}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Field label="关联订单 *">
                <select required value={formData.orderId} onChange={(e) => setFormData({ ...formData, orderId: e.target.value })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none text-primary-navy dark:text-white">
                  <option value="">选择订单...</option>
                  {orders.map(o => <option key={o.id} value={o.id}>{o.display_id} · {o.customer_name}</option>)}
                </select>
              </Field>
              <Field label="流水类型 *">
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none text-primary-navy dark:text-white">
                  <option value="receipt">收款 (In)</option>
                  <option value="payment">付款 (Out)</option>
                </select>
              </Field>
              <div className="flex gap-4">
                 <div className="w-24"><Field label="币种"><select value={formData.currency} onChange={e=>setFormData({...formData, currency:e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none text-primary-navy dark:text-white"><option value="USD">USD</option><option value="CNY">CNY</option><option value="EUR">EUR</option></select></Field></div>
                 <div className="flex-1"><Field label="金额 *"><input type="number" step="0.01" value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none text-primary-navy dark:text-white" /></Field></div>
              </div>
              <Field label="款项用途"><select value={formData.recordCategory} onChange={e=>setFormData({...formData, recordCategory:e.target.value as any})} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none text-primary-navy dark:text-white">
                 <option value="deposit">首付款 / 定金</option>
                 <option value="balance">尾款</option>
                 <option value="goods">货款</option>
                 <option value="freight">运费</option>
                 <option value="customs">报关费</option>
                 <option value="other">其他</option>
              </select></Field>
              <Field label="核销状态"><select value={formData.status} onChange={e=>setFormData({...formData, status:e.target.value as any})} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none text-primary-navy dark:text-white"><option value="pending">待核销</option><option value="completed">已完成</option></select></Field>
              <Field label="对象/对方名称"><input value={formData.target} onChange={e=>setFormData({...formData, target:e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none text-primary-navy dark:text-white" /></Field>
              <div className="md:col-span-2 lg:col-span-3">
                 <Field label="备注"><input value={formData.remark} onChange={e=>setFormData({...formData, remark:e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none text-primary-navy dark:text-white" /></Field>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">取消</button>
              <button type="submit" className="rounded-xl bg-primary-navy dark:bg-tertiary-sage px-10 py-2.5 text-sm font-bold text-white hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all shadow-md">保存流水</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 shadow-sm transition-colors">
        {loading ? <div className="p-8 text-sm text-slate-500 dark:text-slate-400 font-bold animate-pulse">读取流水中...</div> : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-navy-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                  <tr>
                    <th className="px-4 py-4">日期 / 订单</th>
                    <th className="px-4 py-4">类型 / 分类</th>
                    <th className="px-4 py-4">金额</th>
                    <th className="px-4 py-4">对象</th>
                    <th className="px-4 py-4">状态</th>
                    <th className="px-4 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-900">
                  {filteredRecords.length ? filteredRecords.map((r) => (
                    <tr key={r.id} className="group align-middle hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                      <td className="px-4 py-4">
                         <div className="font-bold text-primary-navy dark:text-white data-field">{formatDateOnly(r.created_at)}</div>
                         <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase">{r.order_display_id || 'MISC'}</div>
                      </td>
                      <td className="px-4 py-4">
                         <div className="flex items-center gap-2 mb-1"><Chip tone={r.type === 'receipt' ? 'success' : 'error'}>{r.type === 'receipt' ? '收款' : '付款'}</Chip></div>
                         <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{getPaymentCategoryLabel(r.recordCategory || r.payment_category)}</div>
                      </td>
                      <td className={`px-4 py-4 font-bold data-field text-[15px] ${r.type === 'receipt' ? 'text-tertiary-sage' : 'text-error'}`}>
                         {r.type === 'receipt' ? '+' : '-'}{r.currency} {Number(r.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                         <div className="font-bold text-primary-navy dark:text-white uppercase tracking-tight">{r.partner_name || r.target || '未填写'}</div>
                         <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[150px]">{r.remark || '无备注'}</div>
                      </td>
                      <td className="px-4 py-4"><Chip tone={r.status === 'completed' ? 'neutral' : 'warning'}>{r.status === 'completed' ? '已核销' : '待处理'}</Chip></td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                           <button onClick={() => openEditForm(r)} className="p-2 text-secondary-slate dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white hover:border-slate-300 dark:hover:border-navy-600 rounded-lg border border-transparent transition-all"><Edit size={14} /></button>
                           {user?.role === 'admin' && (
                             <button 
                               onClick={() => {
                                 const reason = window.prompt('请输入作废/删除此笔流水的财务原因：');
                                 if (reason) {
                                   console.log(`[Finance Audit] User ${user.name} deleting record ${r.id} for reason: ${reason}`);
                                   void deleteRecord(r);
                                 }
                               }} 
                               className="p-2 text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 rounded-lg border border-transparent transition-all"
                             >
                               <Trash2 size={14} />
                             </button>
                           )}
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-medium uppercase tracking-widest">暂无流水记录。</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ title, value, icon, currency }: { title: string; value: number; icon: React.ReactNode; currency: string }) {
  return (
    <div className="bg-slate-50 dark:bg-navy-950/50 p-3 rounded-2xl border border-slate-100 dark:border-navy-800 flex items-center justify-between transition-colors shadow-inner">
      <div>
        <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{title}</div>
        <div className="text-lg font-bold text-primary-navy dark:text-white data-field leading-none">{value.toLocaleString()}</div>
      </div>
      <div className="h-8 w-8 rounded-lg bg-white dark:bg-navy-800 shadow-sm flex items-center justify-center border border-slate-100 dark:border-navy-700">{icon}</div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-bold text-primary-navy dark:text-white uppercase tracking-widest opacity-70">{label}</span>
      {children}
    </label>
  );
}

function formatDateOnly(v: string) {
  if (!v) return '-';
  return v.split(' ')[0];
}
