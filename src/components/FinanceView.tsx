import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Search, Trash2, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';
import Field from './ui/Field';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Chip from './ui/Chip';
import Toast from './ui/Toast';
import { Drawer } from './ui/Drawer';
import { Pagination } from './ui/Pagination';
import TimeRangeFilter from './ui/TimeRangeFilter';
import { usePagination } from '../hooks/usePagination';
import { Combobox } from './ui/Combobox';
import { getRangeDates, type StandardTimeRange } from '../lib/date';
import { withTransition } from '../lib/transition';
import type { FinanceCategory, FinanceListRecord, OrderOption, PartnerOption, PartnerRecord } from '../types/crm';

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
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceListRecord | null>(null);
  const [formData, setFormData] = useState<FinanceFormState>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<FinanceFormState>(EMPTY_FORM);
  const [toast, setToast] = useState('');

  const isFormDirty = JSON.stringify(formData) !== JSON.stringify(initialForm);

  const query = searchParams.get('q') || '';
  const timeRange = searchParams.get('timeRange') || 'all';
  const paramCustomerId = searchParams.get('customerId') || '';

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);

    if (key === 'timeRange') {
      const dates = getRangeDates(val as StandardTimeRange);
      if (dates.start) next.set('start_date', dates.start); else next.delete('start_date');
      if (dates.end) next.set('end_date', dates.end); else next.delete('end_date');
    }

    setSearchParams(next);
  };

  const { data: records = [], isLoading: recordsLoading, error: recordsError } = useQuery<FinanceListRecord[]>({
    queryKey: ['finance', searchParams.toString()],
    queryFn: () => apiFetch<FinanceListRecord[]>(`/api/finance?${searchParams.toString()}`),
  });
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useQuery<OrderOption[]>({
    queryKey: ['orders'],
    queryFn: () => apiFetch<OrderOption[]>('/api/orders'),
  });
  const { data: partners = [], isLoading: partnersLoading, error: partnersError } = useQuery<PartnerOption[]>({
    queryKey: ['partners'],
    queryFn: () => apiFetch<PartnerOption[]>('/api/partners'),
  });
  const loading = recordsLoading || ordersLoading || partnersLoading;
  const error = recordsError ? getErrorMessage(recordsError, '读取财务数据失败') : ordersError ? getErrorMessage(ordersError, '读取财务数据失败') : partnersError ? getErrorMessage(partnersError, '读取财务数据失败') : '';

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) =>
      [record.order_display_id || '', record.customer_name || '', record.partner_name || '', record.target || '', record.remark || '']
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [records, query]);

  const {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    currentItems,
    setCurrentPage,
    setPageSize,
  } = usePagination(filteredRecords);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      openCreateForm();
      updateParam('create', '');
    }
  }, [searchParams]);

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
    setInitialForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (record: FinanceListRecord) => {
    setEditingRecord(record);
    setFormError('');
    const newForm = {
      orderId: String(record.order_id),
      type: record.type,
      amount: String(record.amount),
      currency: record.currency,
      target: record.target || '',
      partnerId: record.partnerId ? String(record.partnerId) : '',
      status: record.status,
      recordCategory: (record.recordCategory as FinanceCategory) || (record.type === 'payment' ? 'goods' : 'deposit'),
      remark: record.remark || '',
    };
    setFormData(newForm);
    setInitialForm(newForm);
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingRecord(null);
    setFormData(EMPTY_FORM);
    setInitialForm(EMPTY_FORM);
    setFormError('');
    setShowForm(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    const payload = { ...formData, orderId: Number(formData.orderId), amount: Number(formData.amount), partnerId: formData.partnerId ? Number(formData.partnerId) : null };
    try {
      if (editingRecord) {
        await apiFetch(`/api/finance/${editingRecord.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setToast('流水已更新');
      } else {
        await apiFetch('/api/finance', { method: 'POST', body: JSON.stringify(payload) });
        setToast('流水登记成功');
      }
      setTimeout(() => setToast(''), 3000);
      closeForm();
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, '保存财务记录失败'));
    }
  };

  const deleteRecord = async (record: FinanceListRecord) => {
    if (!window.confirm(`确定删除这条记录吗？`)) return;
    try {
      await apiFetch(`/api/finance/${record.id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    } catch (requestError) {
      console.error(getErrorMessage(requestError, '删除财务记录失败'));
    }
  };

  return (
    <div className="flex flex-col space-y-4 animate-page-in">
      <section className="shrink-0 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm transition-colors">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={query}
              onChange={(event) => updateParam('q', event.target.value)}
              placeholder="搜索订单、客户、对象或分类..."
              className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 py-2.5 pl-10 pr-4 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <TimeRangeFilter value={timeRange} onChange={(key) => updateParam('timeRange', key)} />
        </div>

        {error ? <div className="mt-4 rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div> : null}

        <div className="mt-6 grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
           <StatCard title="USD 收款" value={totals.receipt.USD || 0} icon={<ArrowDownLeft className="text-emerald-500" size={16} />} currency="USD" />
           <StatCard title="CNY 收款" value={totals.receipt.CNY || 0} icon={<ArrowDownLeft className="text-emerald-500" size={16} />} currency="CNY" />
           <StatCard title="USD 付款" value={totals.payment.USD || 0} icon={<ArrowUpRight className="text-error" size={16} />} currency="USD" />
           <StatCard title="CNY 付款" value={totals.payment.CNY || 0} icon={<ArrowUpRight className="text-error" size={16} />} currency="CNY" />
           <div className="bg-slate-50 dark:bg-navy-950/50 p-3 rounded-lg border border-slate-100 dark:border-navy-800 flex items-center justify-between transition-colors">
              <div>
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">待核销</div>
                <div className="text-lg font-bold text-primary-navy dark:text-white data-field leading-none">{totals.pending} 笔</div>
              </div>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500"><Clock size={16} /></div>
           </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm transition-colors flex flex-col">
        {loading ? <div className="p-8 text-sm text-slate-400 dark:text-slate-500 animate-pulse font-bold text-center">正在加载流水账目...</div> : (
          <div className="flex flex-col">
            <div className="overflow-x-auto">

              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-navy-950 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                  <tr>
                    <th className="px-4 py-4 text-left">日期 / 订单</th>
                    <th className="px-4 py-4 text-center">类型 / 分类</th>
                    <th className="px-4 py-4 text-right">金额</th>
                    <th className="px-4 py-4 text-left">对象</th>
                    <th className="px-4 py-4 text-center">状态</th>
                    <th className="px-4 py-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-900">
                  {currentItems.length ? currentItems.map((r) => (
                    <tr key={r.id} onClick={() => {
                        if (r.order_display_id) {
                          withTransition(() => navigate(`/orders/${r.order_display_id}?section=finance`));
                        }
                      }} className="group align-middle hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer">
                      <td className="px-4 py-4 text-left">
                         <div className="font-bold text-primary-navy dark:text-white data-field">{formatDateOnly(r.created_at)}</div>
                         <div className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase hover:text-primary-navy transition-colors">{r.order_display_id || 'MISC'}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                         <div className="flex items-center justify-center gap-2 mb-1"><Chip tone={r.type === 'receipt' ? 'success' : 'error'}>{r.type === 'receipt' ? '收款' : '付款'}</Chip></div>
                         <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{getPaymentCategoryLabel(r.recordCategory || r.payment_category)}</div>
                      </td>
                      <td className={`px-4 py-4 text-right font-bold data-field text-sm ${r.type === 'receipt' ? 'text-emerald-500' : 'text-error'}`}>
                         {r.type === 'receipt' ? '+' : '-'}{r.currency} {Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-left">
                         <div className="font-bold text-primary-navy dark:text-white uppercase tracking-tight truncate max-w-[150px]" title={r.partner_name || r.target}>{r.partner_name || r.target || '—'}</div>
                         <div className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[150px]">{r.remark || '—'}</div>
                      </td>
                      <td className="px-4 py-4 text-center"><Chip tone={r.status === 'completed' ? 'neutral' : 'warning'}>{r.status === 'completed' ? '已核销' : '待处理'}</Chip></td>
                      <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                           <button onClick={() => openEditForm(r)} className="p-2 text-secondary-slate dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white hover:border-slate-300 dark:hover:border-navy-600 rounded-lg border border-transparent shadow-sm transition-all"><Edit size={14} /></button>
                           {user?.role === 'admin' && (
                             <button 
                               onClick={() => {
                                 const reason = window.prompt('请输入作废/删除此笔流水的财务原因：');
                                 if (reason) {
                                   void deleteRecord(r);
                                 }
                               }} 
                               className="p-2 text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 rounded-lg border border-transparent shadow-sm transition-all"
                             >
                               <Trash2 size={14} />
                             </button>
                           )}
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">暂无流水记录。</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="shrink-0">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        )}
      </section>

      <Drawer
        isOpen={showForm}
        onClose={closeForm}
        title={editingRecord ? '编辑财务流水' : '新增财务流水'}
        isDirty={isFormDirty}
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeForm} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">取消</button>
            <button onClick={handleSubmit} type="submit" className="btn-primary shadow-md">保存流水</button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError ? <div className="rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{formError}</div> : null}
          <div className="space-y-6">
            <Field label="关联订单 *">
              <Combobox
                value={formData.orderId}
                onChange={val => setFormData({ ...formData, orderId: String(val) })}
                onSearch={async (q) => {
                  const data = await apiFetch<OrderOption[]>(`/api/orders?q=${encodeURIComponent(q)}&customerId=${paramCustomerId}`);
                  return data.slice(0, 20).map(o => ({ value: o.id, label: o.display_id, subLabel: o.customer_name }));
                }}
                placeholder="搜索并选择订单..."
              />
            </Field>
            <Field label="流水类型 *">
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as 'receipt' | 'payment' })} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none text-primary-navy dark:text-white">
                <option value="receipt">收款 (In)</option>
                <option value="payment">付款 (Out)</option>
              </select>
            </Field>
            <div className="flex gap-4">
                <div className="w-24"><Field label="币种"><select value={formData.currency} onChange={e=>setFormData({...formData, currency:e.target.value})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none text-primary-navy dark:text-white"><option value="USD">USD</option><option value="CNY">CNY</option><option value="EUR">EUR</option></select></Field></div>
                <div className="flex-1"><Field label="金额 *"><input required type="number" step="0.01" value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none text-primary-navy dark:text-white font-bold data-field" /></Field></div>
            </div>
            <Field label="款项用途">
              <select value={formData.recordCategory} onChange={e=>setFormData({...formData, recordCategory:e.target.value as FinanceCategory})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none text-primary-navy dark:text-white">
                <option value="deposit">首付款 / 定金</option>
                <option value="balance">尾款</option>
                <option value="goods">货款</option>
                <option value="freight">运费</option>
                <option value="customs">报关费</option>
                <option value="other">其他</option>
            </select></Field>
            <Field label="核销状态">
              <select value={formData.status} onChange={e=>setFormData({...formData, status:e.target.value as 'pending' | 'completed'})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none text-primary-navy dark:text-white"><option value="pending">待核销</option><option value="completed">已完成</option></select>
            </Field>
            <Field label="对方/合作伙伴">
              <Combobox
                value={formData.partnerId}
                onChange={val => setFormData({ ...formData, partnerId: String(val) })}
                onSearch={async (q) => {
                  const data = await apiFetch<PartnerRecord[]>(`/api/partners?q=${encodeURIComponent(q)}`);
                  return data.slice(0, 20).map(p => ({ value: p.id, label: p.name, subLabel: p.partner_type }));
                }}
                placeholder="搜索并选择合作伙伴..."
              />
            </Field>
            <Field label="备注">
              <textarea value={formData.remark} onChange={e=>setFormData({...formData, remark:e.target.value})} placeholder="附言或打款参考号..." className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none text-primary-navy dark:text-white min-h-[80px]" rows={2} />
            </Field>
          </div>
          <button type="submit" className="hidden">Submit</button>
        </form>
      </Drawer>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

function StatCard({ title, value, icon, currency }: { title: string; value: number; icon: React.ReactNode; currency: string }) {
  return (
    <div className="bg-slate-50 dark:bg-navy-950/50 p-3 rounded-lg border border-slate-100 dark:border-navy-800 flex items-center justify-between transition-colors shadow-inner">
      <div>
        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{title}</div>
        <div className="text-lg font-bold text-primary-navy dark:text-white data-field leading-none">{value.toLocaleString()}</div>
      </div>
      <div className="h-8 w-8 rounded-lg bg-white dark:bg-navy-800 shadow-sm flex items-center justify-center border border-slate-100 dark:border-navy-700">{icon}</div>
    </div>
  );
}

function formatDateOnly(v: string) {
  if (!v) return '—';
  return v.split(' ')[0];
}
