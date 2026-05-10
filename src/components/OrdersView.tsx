import React, { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Search, Trash2, Hash, CheckSquare, Square, CheckCircle, UserRound, X } from 'lucide-react';
import Field from './ui/Field';
import { useSearchParams } from 'react-router-dom';
import { useNavigateWithTransition } from '../lib/transition';
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
import type { CustomerListItem, ManagedUser, OrderSummary, TaxMode } from '../types/crm';
import { TAX_MODE_OPTIONS, getTaxModeMeta, normalizeTaxMode } from '../features/order-detail/utils';


type OrderFormState = {
  displayId: string;
  customerId: string;
  productSummary: string;
  details: string;
  totalAmount: string;
  taxMode: TaxMode;
};

const EMPTY_FORM: OrderFormState = {
  displayId: '',
  customerId: '',
  productSummary: '',
  details: '',
  totalAmount: '0',
  taxMode: 'A',
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
  const navigate = useNavigateWithTransition();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderSummary | null>(null);
  const [formData, setFormData] = useState<OrderFormState>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<OrderFormState>(EMPTY_FORM);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

  const isFormDirty = JSON.stringify(formData) !== JSON.stringify(initialForm);

  // 删除确认状态
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [orderToDelete, setOrderToDelete] = useState<OrderSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const taxMode = searchParams.get('tax_mode') || '';
  const ownerFilter = searchParams.get('owner_user_id') || '';
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

  // Debounced search
  const [searchInput, setSearchInput] = useState(q);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      updateParam('q', searchInput);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]);

  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useQuery<OrderSummary[]>({
    queryKey: ['orders', searchParams.toString()],
    queryFn: () => apiFetch<OrderSummary[]>(`/api/orders?${searchParams.toString()}`),
    placeholderData: keepPreviousData,
  });
  const { data: customers = [], isLoading: customersLoading, error: customersError } = useQuery<CustomerListItem[]>({
    queryKey: ['customers'],
    queryFn: () => apiFetch<CustomerListItem[]>('/api/customers'),
    staleTime: 5 * 60 * 1000,
  });
  const { data: users = [] } = useQuery<ManagedUser[]>({
    queryKey: ['users', 'order-owner-options'],
    queryFn: () => apiFetch<ManagedUser[]>('/api/users'),
    enabled: user?.role === 'admin',
    staleTime: 60_000,
  });
  const loading = ordersLoading || customersLoading;
  const error = ordersError ? getErrorMessage(ordersError, '读取数据失败') : customersError ? getErrorMessage(customersError, '读取数据失败') : '';
  const activeOwnerOptions = users.filter((item) => item.active !== false);
  const ownerFilterLabel = ownerFilter === 'me'
    ? '我的订单'
    : ownerFilter === 'unassigned'
      ? '未分配订单'
      : activeOwnerOptions.find(item => String(item.id) === ownerFilter)?.name || '';
  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesOwner =
        !ownerFilter ||
        (ownerFilter === 'me' && user?.name && order.created_by_name === user.name) ||
        (ownerFilter === 'unassigned' && !order.created_by_name) ||
        activeOwnerOptions.some((owner) => String(owner.id) === ownerFilter && (owner.name || owner.username) === order.created_by_name);
      return matchesOwner;
    });
  }, [activeOwnerOptions, orders, ownerFilter, user?.name]);

  const {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    currentItems,
    setCurrentPage,
    setPageSize,
  } = usePagination(visibleOrders);

  useEffect(() => {
    setCurrentPage(1);
  }, [q, status, taxMode, ownerFilter, timeRange, setCurrentPage]);

  const toggleSelectAll = () => {
    if (selectedIds.length === currentItems.length && currentItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentItems.map(o => o.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBatchUpdate = async (status: string) => {
    if (!selectedIds.length) return;
    setIsBatchUpdating(true);
    try {
      await apiFetch('/api/orders/batch', {
        method: 'PATCH',
        body: JSON.stringify({ ids: selectedIds, status }),
      });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setToast(`成功更新 ${selectedIds.length} 个订单状态`);
    } catch (err) {
      setToast(getErrorMessage(err, '批量操作失败'));
    } finally {
      setIsBatchUpdating(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      openCreateForm();
      updateParam('create', '');
    }
  }, [searchParams]);

  const openCreateForm = async () => {
    setEditingOrder(null);
    setFormError('');
    setFieldErrors({});
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
    setFieldErrors({});
    const newForm = {
      displayId: order.display_id,
      customerId: String(order.customer_id),
      productSummary: order.product_summary || '',
      details: '',
      totalAmount: String(order.total_amount || 0),
      taxMode: normalizeTaxMode(order.tax_mode),
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
    setFieldErrors({});
    setShowForm(false);
  };

  const requestCloseForm = () => {
    resetFormState();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const errors: Record<string, string> = {};
    if (!formData.customerId) errors.customerId = '请选择关联客户';
    if (!formData.productSummary.trim()) errors.productSummary = '请输入产品摘要';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = { ...formData, customerId: Number(formData.customerId), totalAmount: Number(formData.totalAmount) };
    try {
      if (editingOrder) {
        await apiFetch(`/api/orders/${editingOrder.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        resetFormState();
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      } else {
        const created = await apiFetch<{ display_id: string }>('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
        resetFormState();
        navigate(`/orders/${created.display_id}`);
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

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="flex flex-col space-y-4 animate-page-in">
      <section className="shrink-0 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-6 shadow-sm transition-colors text-primary-navy dark:text-white">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px_220px_220px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="搜索订单号、产品、客户名称..."
              className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 py-2.5 pl-10 pr-4 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
            />
          </div>
          <div className="relative">
             <select
               value={status}
               onChange={e => updateParam('status', e.target.value)}
               className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 px-4 py-2.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none cursor-pointer text-primary-navy dark:text-white"
             >
               <option value="">全部状态</option>
               <option value="draft">待受理</option>
               <option value="production">生产中</option>
               <option value="customs">报关中</option>
               <option value="shipping">发货中</option>
               <option value="completed">已完成</option>
             </select>
          </div>
          <div className="relative">
             <select
               value={taxMode}
               onChange={e => updateParam('tax_mode', e.target.value)}
               className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 px-4 py-2.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none cursor-pointer text-primary-navy dark:text-white"
             >
               <option value="">全部业务模式</option>
               {TAX_MODE_OPTIONS.map(option => (
                 <option key={option.value} value={option.value}>{option.label}</option>
               ))}
             </select>
          </div>
          <div className="relative">
             <select
               value={ownerFilter}
               onChange={e => updateParam('owner_user_id', e.target.value)}
               className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 px-4 py-2.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none cursor-pointer text-primary-navy dark:text-white"
             >
               <option value="">全部负责人</option>
               <option value="me">我的订单</option>
               {user?.role === 'admin' ? <option value="unassigned">未分配订单</option> : null}
               {user?.role === 'admin' ? activeOwnerOptions.map(owner => (
                 <option key={owner.id} value={owner.id}>{owner.name || owner.username}</option>
               )) : null}
             </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <TimeRangeFilter value={timeRange} onChange={(key) => updateParam('timeRange', key)} />
          {ownerFilterLabel ? <ActiveFilter label={`负责人：${ownerFilterLabel}`} onClear={() => updateParam('owner_user_id', '')} /> : null}
          {status ? <ActiveFilter label={`状态：${getOrderStatusMeta(status).label}`} onClear={() => updateParam('status', '')} /> : null}
          {taxMode ? <ActiveFilter label={`业务模式：${getTaxModeMeta(taxMode as TaxMode).shortLabel}`} onClear={() => updateParam('tax_mode', '')} /> : null}
          {(q || status || taxMode || ownerFilter || timeRange !== 'all') ? (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:border-primary-navy hover:text-primary-navy dark:border-navy-800 dark:text-slate-400 dark:hover:border-tertiary-sage dark:hover:text-tertiary-sage">
              <X size={12} /> 清空筛选
            </button>
          ) : null}
        </div>
        {error && <div className="mt-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-800/30 font-bold">{error}</div>}
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-sm transition-colors flex flex-col relative">
        {selectedIds.length > 0 && (
          <div className="absolute top-[-54px] left-0 right-0 z-20 flex items-center justify-between px-6 py-2.5 bg-primary-navy dark:bg-navy-800 text-white rounded-lg shadow-xl animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-black">已选中 {selectedIds.length}</span>
              <div className="h-4 w-px bg-white/20 mx-1" />
              <span className="text-xs font-bold opacity-80">批量修改状态为:</span>
            </div>
            <div className="flex items-center gap-2">
              <button disabled={isBatchUpdating} onClick={() => handleBatchUpdate('production')} className="px-3 py-1.5 rounded-md hover:bg-white/10 text-xs font-black transition-colors">进行生产</button>
              <button disabled={isBatchUpdating} onClick={() => handleBatchUpdate('customs')} className="px-3 py-1.5 rounded-md hover:bg-white/10 text-xs font-black transition-colors">开始报关</button>
              <button disabled={isBatchUpdating} onClick={() => handleBatchUpdate('completed')} className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 px-4 py-1.5 rounded-md text-xs font-black transition-all shadow-sm">
                <CheckCircle size={14} /> 标记结单
              </button>
              <button onClick={() => setSelectedIds([])} className="ml-2 text-white/50 hover:text-white"><Square size={16} /></button>
            </div>
          </div>
        )}
        
        {loading ? <div className="p-8 text-sm text-slate-400 dark:text-slate-500 animate-pulse font-bold text-center">读取订单列表中...</div> : (
          <div className="flex flex-col">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/80 dark:bg-navy-950/80 backdrop-blur text-xs font-bold tracking-tight text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                  <tr>
                    <th className="px-4 py-4 text-center w-12">
                      <button onClick={toggleSelectAll} className="p-1 hover:bg-slate-200 dark:hover:bg-navy-800 rounded transition-colors">
                        {selectedIds.length === currentItems.length && currentItems.length > 0 ? <CheckSquare size={16} className="text-primary-navy dark:text-tertiary-sage" /> : <Square size={16} />}
                      </button>
                    </th>
                    <th className="px-4 py-4 text-left">订单号 / 日期</th>
                    <th className="px-4 py-4 text-left">客户 / 国家</th>
                    <th className="px-4 py-4 text-left">产品摘要</th>
                    <th className="px-4 py-4 text-left">业务模式</th>
                    <th className="px-4 py-4 text-center">负责人</th>
                    <th className="px-4 py-4 text-right">金额</th>
                    <th className="px-4 py-4 text-right">收款进度</th>
                    <th className="px-4 py-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-surface dark:bg-navy-900">
                  {currentItems.length ? currentItems.map(o => {
                    const meta = getOrderStatusMeta(o.status);
                    const taxModeMeta = getTaxModeMeta(o.tax_mode);
                    const isSelected = selectedIds.includes(o.id);
                    return (
                      <tr key={o.id} onClick={() => {
                        const target = `/orders/${String(o.display_id).toLowerCase()}`;
                        navigate(target);
                      }} className={`group align-middle hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-inset ring-blue-100 dark:ring-blue-900/30' : ''}`}>
                        <td className="px-4 py-4 text-center" onClick={e => e.stopPropagation()}>
                          <button onClick={() => toggleSelectOne(o.id)} className="p-1 hover:bg-white dark:hover:bg-navy-700 rounded shadow-sm border border-transparent transition-all">
                            {isSelected ? <CheckSquare size={16} className="text-primary-navy dark:text-tertiary-sage" /> : <Square size={16} className="text-slate-300" />}
                          </button>
                        </td>
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
                        <td className="px-4 py-4 text-left">
                          <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600 dark:border-navy-700 dark:bg-navy-950 dark:text-slate-300">
                            {taxModeMeta.shortLabel}
                          </div>
                          <div className="mt-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">{taxModeMeta.value}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="inline-flex max-w-[140px] items-center gap-1.5 rounded-full border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                            <UserRound size={12} className="shrink-0 text-slate-400" />
                            <span className="truncate">{o.created_by_name || '未分配'}</span>
                          </div>
                          {o.customer_owner_user_name && o.customer_owner_user_name !== o.created_by_name ? (
                            <div className="mt-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">客户：{o.customer_owner_user_name}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-primary-navy dark:text-white data-field text-[15px]">USD {Number(o.total_amount).toLocaleString()}</td>
                        <td className="px-4 py-4 text-right">
                           <div className="text-tertiary-sage dark:text-emerald-400 font-bold data-field">USD {Number(o.completed_receipt_usd).toLocaleString()}</div>
                           <div className="mt-1.5 text-xs font-bold text-slate-400 dark:text-slate-500">{o.pending_finance_count > 0 ? `核销中: ${o.pending_finance_count} 笔` : '—'}</div>
                        </td>
                        <td className="px-4 py-4 text-center" onClick={e=>e.stopPropagation()}>
                           <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={()=>openEditForm(o)} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white hover:border-slate-300 dark:hover:border-navy-600 rounded-lg border border-transparent shadow-sm transition-all"><Edit size={14} /></button>
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
                  }) : <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400 font-bold tracking-tight text-xs">暂无订单记录。</td></tr>}
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
            <button type="button" onClick={requestCloseForm} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">取消</button>
            <button onClick={handleSubmit} type="submit" className="btn-primary shadow-md">确认并进入详情</button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && <div className="rounded-lg border border-red-100 dark:border-red-800/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 font-bold">{formError}</div>}
          <div className="space-y-6">
            <Field label="订单业务模式 *">
              <div className="grid gap-3 sm:grid-cols-3">
                {TAX_MODE_OPTIONS.map(option => {
                  const active = formData.taxMode === option.value;
                  const locked = Boolean(editingOrder && editingOrder.status !== 'draft');
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={locked}
                      onClick={() => setFormData({ ...formData, taxMode: option.value })}
                      className={`rounded-lg border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'border-primary-navy bg-primary-navy text-white shadow-sm dark:border-tertiary-sage dark:bg-tertiary-sage' : 'border-slate-200 bg-slate-50 text-primary-navy hover:border-primary-navy/30 dark:border-navy-800 dark:bg-navy-950 dark:text-white dark:hover:border-tertiary-sage/40'}`}
                    >
                      <div className="text-xs font-black">{option.label}</div>
                      <div className={`mt-1 text-[10px] font-bold leading-relaxed ${active ? 'text-white/75' : 'text-slate-400 dark:text-slate-500'}`}>{option.description}</div>
                    </button>
                  );
                })}
              </div>
              {editingOrder && editingOrder.status !== 'draft' && (
                <p className="mt-2 text-[11px] font-bold text-amber-600 dark:text-amber-300">订单已进入履约流程，业务模式变更需走审批流。</p>
              )}
            </Field>
            <Field label="订单单号 *">
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input 
                    required 
                    value={formData.displayId} 
                    onChange={e => setFormData({...formData, displayId: e.target.value.trim()})} 
                    placeholder="如: CQBX-2026-..."
                    className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 pl-9 pr-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none font-bold text-primary-navy dark:text-white data-field"
                  />
                </div>
            </Field>
            <Field label="关联客户 *" error={fieldErrors.customerId}>
              <Combobox
                value={formData.customerId}
                onChange={val => {
                  setFormData({ ...formData, customerId: String(val) });
                  if (fieldErrors.customerId) setFieldErrors(prev => { const next = { ...prev }; delete next.customerId; return next; });
                }}
                onSearch={async (q) => {
                  const data = await apiFetch<CustomerListItem[]>(`/api/customers?q=${encodeURIComponent(q)}`);
                  return data.slice(0, 20).map(c => ({ value: c.id, label: c.name, subLabel: c.country }));
                }}
                disabled={!!searchParams.get('customerId')}
                placeholder="搜索并选择客户..."
              />
            </Field>
            <Field label="订单总额 (USD) *">
              <input required type="number" step="0.01" value={formData.totalAmount} onChange={e=>setFormData({...formData, totalAmount:e.target.value})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none font-bold text-primary-navy dark:text-white" />
            </Field>
            <Field label="产品摘要 *" error={fieldErrors.productSummary}>
              <input required value={formData.productSummary} onChange={e => {
                setFormData({...formData, productSummary:e.target.value});
                if (fieldErrors.productSummary) setFieldErrors(prev => { const next = { ...prev }; delete next.productSummary; return next; });
              }} onBlur={() => {
                if (!formData.productSummary.trim()) setFieldErrors(prev => ({ ...prev, productSummary: '请输入产品摘要' }));
              }} placeholder="例如：太阳能板 A-Type 500pcs..." className={`w-full rounded-lg border ${fieldErrors.productSummary ? 'border-red-500 bg-red-50/30 dark:bg-red-900/10' : 'border-slate-200 dark:border-navy-800'} bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none font-bold text-primary-navy dark:text-white`} />
            </Field>
          </div>
          <button type="submit" className="hidden">Submit</button>
        </form>
      </Drawer>

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

function ActiveFilter({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300">
      {label}
      <button type="button" onClick={onClear} className="rounded-full p-0.5 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/40" aria-label={`清除${label}`}>
        <X size={12} />
      </button>
    </span>
  );
}
