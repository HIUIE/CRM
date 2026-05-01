import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Search, Trash2, Hash } from 'lucide-react';
import Field from './ui/Field';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Chip from './ui/Chip';
import Toast from './ui/Toast';
import ConfirmDeleteModal from './ui/ConfirmDeleteModal';
import { Drawer } from './ui/Drawer';
import { Pagination } from './ui/Pagination';
import TimeRangeFilter from './ui/TimeRangeFilter';
import { usePagination } from '../hooks/usePagination';
import { Combobox } from './ui/Combobox';
import { getRangeDates } from '../lib/date';
import type { StandardTimeRange } from '../lib/date';
import { withTransition } from '../lib/transition';
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
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderSummary | null>(null);
  const [formData, setFormData] = useState<OrderFormState>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<OrderFormState>(EMPTY_FORM);

  const isFormDirty = JSON.stringify(formData) !== JSON.stringify(initialForm);

  // 删除确认状态
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [orderToDelete, setOrderToDelete] = useState<OrderSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const timeRange = searchParams.get('timeRange') || 'all';

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

  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useQuery<OrderSummary[]>({
    queryKey: ['orders', searchParams.toString()],
    queryFn: () => apiFetch<OrderSummary[]>(`/api/orders?${searchParams.toString()}`),
  });
  const { data: customers = [], isLoading: customersLoading, error: customersError } = useQuery<CustomerListItem[]>({
    queryKey: ['customers'],
    queryFn: () => apiFetch<CustomerListItem[]>('/api/customers'),
  });
  const loading = ordersLoading || customersLoading;
  const error = ordersError ? getErrorMessage(ordersError, '读取数据失败') : customersError ? getErrorMessage(customersError, '读取数据失败') : '';

  const {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    currentItems,
    setCurrentPage,
    setPageSize,
  } = usePagination(orders);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      openCreateForm();
      updateParam('create', '');
    }
  }, [searchParams]);

  const openCreateForm = async () => {
    setEditingOrder(null);
    setFormError('');
    try {
      const { nextId } = await apiFetch<{ nextId: string }>('/api/orders/next-display-id');
      const paramCustomerId = searchParams.get('customerId');
      const newForm = { 
        ...EMPTY_FORM, 
        displayId: nextId, 
        customerId: paramCustomerId || '' 
      };
      setFormData(newForm);
      setInitialForm(newForm);
    } catch (err) {
      setFormData({ ...EMPTY_FORM, customerId: searchParams.get('customerId') || '' });
      setInitialForm({ ...EMPTY_FORM, customerId: searchParams.get('customerId') || '' });
    }
    setShowForm(true);
  };

  const openEditForm = (order: OrderSummary) => {
    setEditingOrder(order);
    setFormError('');
    const newForm = {
      displayId: order.display_id,
      customerId: String(order.customer_id),
      productSummary: order.product_summary || '',
      details: '',
      totalAmount: String(order.total_amount || 0),
    };
    setFormData(newForm);
    setInitialForm(newForm);
    setShowForm(true);
  };

  const resetFormState = () => {
    setEditingOrder(null);
    setFormData(EMPTY_FORM);
    setInitialForm(EMPTY_FORM);
    setFormError('');
    setShowForm(false);
  };

  const requestCloseForm = () => {
    if (!isFormDirty) {
      resetFormState();
      return;
    }
    setShowDiscardConfirm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const payload = { ...formData, customerId: Number(formData.customerId), totalAmount: Number(formData.totalAmount) };
    try {
      if (editingOrder) {
        await apiFetch(`/api/orders/${editingOrder.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        resetFormState();
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      } else {
        const created = await apiFetch<{ display_id: string }>('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
        resetFormState();
        const navigateToDetail = () => navigate(`/orders/${created.display_id}`);
        withTransition(navigateToDetail);
      }
    } catch (err) {
      setFormError(getErrorMessage(err, '保存失败'));
    }
  };

  const startDelete = (order: OrderSummary) => {
    setOrderToDelete(order);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/orders/${orderToDelete.id}`, { method: 'DELETE' });
      setIsDeleteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (err) {
      setToast(getErrorMessage(err, '删除订单失败'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 animate-page-in">
      <section className="shrink-0 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm transition-colors text-primary-navy dark:text-white">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={q}
              onChange={e => updateParam('q', e.target.value)}
              placeholder="搜索订单号、产品、客户名称..."
              className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 py-2.5 pl-10 pr-4 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
            />
          </div>
          <div className="relative">
             <select
               value={status}
               onChange={e => updateParam('status', e.target.value)}
               className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 px-4 py-2.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none cursor-pointer text-primary-navy dark:text-white"
             >
               <option value="">全部状态</option>
               <option value="draft">待受理</option>
               <option value="production">生产中</option>
               <option value="customs">报关中</option>
               <option value="shipping">发货中</option>
               <option value="completed">已完成</option>
             </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <TimeRangeFilter value={timeRange} onChange={(key) => updateParam('timeRange', key)} />
        </div>
        {error && <div className="mt-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-800/30 font-bold">{error}</div>}
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm transition-colors flex flex-col">
        {loading ? <div className="p-8 text-sm text-slate-400 dark:text-slate-500 animate-pulse font-bold text-center">读取订单列表中...</div> : (
          <div className="flex flex-col">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 text-xs font-bold tracking-tight text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                  <tr>
                    <th className="px-4 py-4 text-left">订单号 / 日期</th>
                    <th className="px-4 py-4 text-left">客户 / 国家</th>
                    <th className="px-4 py-4 text-left">产品摘要</th>
                    <th className="px-4 py-4 text-right">金额</th>
                    <th className="px-4 py-4 text-right">收款进度</th>
                    <th className="px-4 py-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-900">
                  {currentItems.length ? currentItems.map(o => {
                    const meta = getOrderStatusMeta(o.status);
                    return (
                      <tr key={o.id} onClick={() => {
                        const target = `/orders/${String(o.display_id).toLowerCase()}`;
                        withTransition(() => navigate(target));
                      }} className="group align-middle hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer">
                        <td className="px-4 py-4 text-left">
                           <div 
                             className="font-bold text-primary-navy dark:text-tertiary-sage data-field"
                             style={{ viewTransitionName: 'order-id' }}
                           >
                             {o.display_id || '—'}
                           </div>
                           <div className="text-xs text-slate-500 dark:text-slate-500 mt-1.5 font-bold data-field">{formatDateOnly(o.created_at)}</div>
                        </td>
                        <td className="px-4 py-4 text-left">
                           <div className="font-bold text-primary-navy dark:text-white tracking-tight truncate max-w-[150px]" title={o.customer_name}>{o.customer_name || '—'}</div>
                           <div className="mt-1 text-xs font-extrabold text-slate-400 dark:text-slate-500">{o.customer_country || '—'}</div>
                        </td>
                        <td className="px-4 py-4 text-left">
                           <div className="flex items-center gap-2 mb-1.5"><Chip tone={meta.tone}>{meta.label}</Chip></div>
                           <div className="text-slate-600 dark:text-slate-400 font-bold truncate max-w-[200px]" title={o.product_summary}>{o.product_summary || '—'}</div>
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-primary-navy dark:text-white data-field text-[15px]">USD {Number(o.total_amount).toLocaleString()}</td>
                        <td className="px-4 py-4 text-right">
                           <div className="text-tertiary-sage dark:text-emerald-400 font-bold data-field">USD {Number(o.completed_receipt_usd).toLocaleString()}</div>
                           <div className="mt-1.5 text-xs font-bold text-slate-400 dark:text-slate-500">{o.pending_finance_count > 0 ? `核销中: ${o.pending_finance_count} 笔` : '—'}</div>
                        </td>
                        <td className="px-4 py-4 text-center" onClick={e=>e.stopPropagation()}>
                           <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
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
                  }) : <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-bold tracking-tight text-xs">暂无订单记录。</td></tr>}
                </tbody>
              </table>
            </div>
            <div>
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
        onClose={requestCloseForm}
        title={editingOrder ? '编辑订单基本信息' : '创建新订单'}
        isDirty={isFormDirty}
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={requestCloseForm} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">取消</button>
            <button onClick={handleSubmit} type="submit" className="btn-primary shadow-md">确认并进入详情</button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && <div className="rounded-lg border border-red-100 dark:border-red-800/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 font-bold">{formError}</div>}
          <div className="space-y-6">
            <Field label="订单单号 *">
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input 
                    required 
                    value={formData.displayId} 
                    onChange={e => setFormData({...formData, displayId: e.target.value.trim()})} 
                    placeholder="如: CQBX-2026-..."
                    className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 pl-9 pr-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none font-bold text-primary-navy dark:text-white data-field"
                  />
                </div>
            </Field>
            <Field label="关联客户 *">
              <Combobox
                value={formData.customerId}
                onChange={val => setFormData({ ...formData, customerId: String(val) })}
                onSearch={async (q) => {
                  const data = await apiFetch<CustomerListItem[]>(`/api/customers?q=${encodeURIComponent(q)}`);
                  return data.slice(0, 20).map(c => ({ value: c.id, label: c.name, subLabel: c.country }));
                }}
                disabled={!!searchParams.get('customerId')}
                placeholder="搜索并选择客户..."
              />
            </Field>
            <Field label="订单总额 (USD) *">
              <input required type="number" step="0.01" value={formData.totalAmount} onChange={e=>setFormData({...formData, totalAmount:e.target.value})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none font-bold text-primary-navy dark:text-white" />
            </Field>
            <Field label="产品摘要 *">
              <input required value={formData.productSummary} onChange={e=>setFormData({...formData, productSummary:e.target.value})} placeholder="例如：太阳能板 A-Type 500pcs..." className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none font-bold text-primary-navy dark:text-white" />
            </Field>
          </div>
          <button type="submit" className="hidden">Submit</button>
        </form>
      </Drawer>

      <ConfirmDeleteModal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={() => { setShowDiscardConfirm(false); resetFormState(); }}
        title="放弃未保存修改"
        warning="当前订单表单还有未保存内容，确认放弃这些修改并关闭抽屉吗？"
        entityLabel="确认文本"
        entityId="放弃修改"
        isDeleting={false}
        showCopy={false}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        warning={
          <>确定要永久删除订单吗？此操作将同步清除与之关联的所有<span className="text-red-600 font-bold">生产、财务及物流数据</span>。</>
        }
        entityLabel="单号"
        entityId={orderToDelete?.display_id || ''}
        isDeleting={isDeleting}
      />

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

function formatDateOnly(v: string) {
  if (!v) return '—';
  return v.split(' ')[0];
}
