import React, { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Search, Trash2, UserRound, X } from 'lucide-react';
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
import { getRangeDates } from '../lib/date';
import type { StandardTimeRange } from '../lib/date';
import CountrySelect from './ui/CountrySelect';
import CountryDisplay from './ui/CountryDisplay';
import { getCountryDisplay } from '../lib/countries';
import type { CustomerListItem } from '../types/crm';

type OwnerOption = {
  id: number;
  name: string;
  username: string;
  role: string;
  active?: boolean;
};

type CustomerForm = {
  name: string;
  country: string;
  contact: string;
  sourceChannel: string;
  intentProducts: string;
  ownerUserId: string;
};

const EMPTY_FORM: CustomerForm = {
  name: '',
  country: '',
  contact: '',
  sourceChannel: '',
  intentProducts: '',
  ownerUserId: '',
};

export default function CustomersView() {
  const { user } = useAuth();
  const navigate = useNavigateWithTransition();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerListItem | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<CustomerForm>(EMPTY_FORM);
  const [toast, setToast] = useState('');


  // Delete Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customerToDelete, setOrderToDelete] = useState<CustomerListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const query = searchParams.get('q') || '';
  const countryFilter = searchParams.get('country') || '';
  const ownerFilter = searchParams.get('owner_user_id') || '';
  const timeRange = searchParams.get('timeRange') || 'all';

  // Debounced search input: local state drives the input, URL param updates after 300ms of inactivity
  const [inputValue, setInputValue] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParam('q', inputValue);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue]);

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

  const { data: customers = [], isLoading: loading, error: queryError } = useQuery<CustomerListItem[]>({
    queryKey: ['customers', searchParams.toString()],
    queryFn: () => apiFetch<CustomerListItem[]>(`/api/customers?${searchParams.toString()}`),
    placeholderData: keepPreviousData,
  });
  const error = queryError ? getErrorMessage(queryError, '读取客户数据失败') : '';

  const { data: ownerOptions = [] } = useQuery<OwnerOption[]>({
    queryKey: ['users', 'customer-owner-options'],
    queryFn: () => apiFetch<OwnerOption[]>('/api/users'),
    enabled: user?.role === 'admin',
    staleTime: 60_000,
  });

  const activeOwnerOptions = useMemo(
    () => ownerOptions.filter((option) => option.active !== false),
    [ownerOptions],
  );

  const countryOptions = useMemo(
    () =>
      Array.from(
        new Set<string>(customers.map((customer) => customer.country).filter((value): value is string => Boolean(value))),
      ).sort((a, b) => a.localeCompare(b)),
    [customers],
  );

  const ownerFilterLabel = useMemo(() => {
    if (!ownerFilter) return '';
    if (ownerFilter === 'me') return '我负责的客户';
    if (ownerFilter === 'unassigned') return '未分配客户';
    const match = activeOwnerOptions.find((owner) => String(owner.id) === ownerFilter);
    return match ? (match.name || match.username) : '';
  }, [activeOwnerOptions, ownerFilter]);

  const filteredCustomers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesQuery =
        !keyword ||
        [customer.name, customer.country || '', customer.contact || '', customer.source_channel || '', customer.intent_products || '']
          .some((value) => value.toLowerCase().includes(keyword));
      const matchesCountry = !countryFilter || customer.country === countryFilter;
      const matchesOwner =
        !ownerFilter ||
        (ownerFilter === 'me' && user?.id && customer.owner_user_id === user.id) ||
        (ownerFilter === 'unassigned' && !customer.owner_user_id) ||
        String(customer.owner_user_id || '') === ownerFilter;
      return matchesQuery && matchesCountry && matchesOwner;
    });
  }, [countryFilter, customers, ownerFilter, query, user?.id]);

  const {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    currentItems,
    setCurrentPage,
    setPageSize,
  } = usePagination(filteredCustomers);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, countryFilter, ownerFilter, timeRange, setCurrentPage]);

  // Read create flag from URL to open drawer
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      openCreate();
      updateParam('create', '');
    }

  }, [searchParams]);

  const openCreate = () => {
    const nextForm = { ...EMPTY_FORM, ownerUserId: user?.id ? String(user.id) : '' };
    setEditingCustomer(null);
    setForm(nextForm);
    setInitialForm(nextForm);
    setFormError('');
    setFieldErrors({});
    setShowForm(true);
  };

  const openEdit = (customer: CustomerListItem) => {
    setEditingCustomer(customer);
    setFormError('');
    setFieldErrors({});
    const newForm = {
      name: customer.name,
      country: customer.country || '',
      contact: customer.contact || '',
      sourceChannel: customer.source_channel || '',
      intentProducts: customer.intent_products || '',
      ownerUserId: customer.owner_user_id ? String(customer.owner_user_id) : '',
    };
    setForm(newForm);
    setInitialForm(newForm);
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
    setInitialForm(EMPTY_FORM);
    setFormError('');
    setFieldErrors({});
    setShowForm(false);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = '客户名称为必填项';
    if (!form.country.trim()) errors.country = '国家 / 地区为必填项';
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    if (event) event.preventDefault();
    setFormError('');

    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      country: form.country.trim(),
      contact: form.contact.trim(),
      sourceChannel: form.sourceChannel.trim(),
      intentProducts: form.intentProducts.trim(),
      ...(user?.role === 'admin' && !editingCustomer && form.ownerUserId ? { ownerUserId: Number(form.ownerUserId) } : {}),
    };

    try {
      if (editingCustomer) {
        await apiFetch(`/api/customers/${editingCustomer.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setToast('客户资料已更新');
        setTimeout(() => setToast(''), 3000);
        closeForm();
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      } else {
        const result = await apiFetch<{ id: number, displayId: string }>('/api/customers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setToast('客户建档成功');
        closeForm();
        setTimeout(() => {
          setToast('');
          navigate(`/customers/detail/${String(result.displayId || result.id).toLowerCase()}`);
        }, 1000);
      }
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, '保存客户失败'));
    }
  };

  const startDelete = (customer: CustomerListItem) => {
    setOrderToDelete(customer);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/customers/${customerToDelete.id}`, { method: 'DELETE' });
      setIsDeleteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err) {
      setToast(getErrorMessage(err, '删除客户失败'));
    } finally {
      setIsDeleting(false);
    }
  };

  const clearFilters = () => {
    setInputValue('');
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="flex flex-col space-y-4 animate-page-in">
      <section className="shrink-0 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-6 shadow-sm transition-colors">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="搜索客户名称、渠道..."
              className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 py-2.5 pl-9 pr-4 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white"
            />
          </div>
          <div className="relative">
             <select
               value={countryFilter}
               onChange={(event) => updateParam('country', event.target.value)}
               className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 px-3 py-2.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none appearance-none text-primary-navy dark:text-white cursor-pointer"
             >
               <option value="">全部国家</option>
               {countryOptions.map((country) => (
                 <option key={country} value={country}>
                   {country}
                 </option>
               ))}
             </select>
          </div>
          <div className="relative">
             <select
               value={ownerFilter}
               onChange={(event) => updateParam('owner_user_id', event.target.value)}
               className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 px-3 py-2.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none appearance-none text-primary-navy dark:text-white cursor-pointer"
             >
               <option value="">全部负责人</option>
               <option value="me">我负责的客户</option>
               {user?.role === 'admin' ? <option value="unassigned">未分配客户</option> : null}
               {user?.role === 'admin' ? activeOwnerOptions.map((owner) => (
                 <option key={owner.id} value={owner.id}>{owner.name || owner.username}</option>
               )) : null}
             </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <TimeRangeFilter value={timeRange} onChange={(key) => updateParam('timeRange', key)} />
          {ownerFilterLabel ? <ActiveFilter label={`负责人：${ownerFilterLabel}`} onClear={() => updateParam('owner_user_id', '')} /> : null}
          {countryFilter ? <ActiveFilter label={`国家：${getCountryDisplay(countryFilter)}`} onClear={() => updateParam('country', '')} /> : null}
          {(query || countryFilter || ownerFilter || timeRange !== 'all') ? (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:border-primary-navy hover:text-primary-navy dark:border-navy-800 dark:text-slate-400 dark:hover:border-tertiary-sage dark:hover:text-tertiary-sage">
              <X size={12} /> 清空筛选
            </button>
          ) : null}
        </div>

        {error ? <div className="mt-4 rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div> : null}
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-sm transition-colors flex flex-col">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 p-8 text-center animate-pulse">正在读取客户数据...</div>
        ) : (
          <div className="flex flex-col">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/80 dark:bg-navy-950/80 backdrop-blur text-xs font-bold tracking-tight text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                  <tr>
                    <th className="px-4 py-4 text-left">国家</th>
                    <th className="px-4 py-4 text-left">客户名称</th>
                    <th className="px-4 py-4 text-center">来源渠道</th>
                    <th className="px-4 py-4 text-left">联系方式</th>
                    <th className="px-4 py-4 text-right">订单数</th>
                    <th className="px-4 py-4 text-center">负责人</th>
                    <th className="px-4 py-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-surface dark:bg-navy-900">
                  {currentItems.length ? (
                    currentItems.map((customer) => (
                      <tr
                        key={customer.id}
                        onClick={() => navigate(`/customers/detail/${String(customer.display_id || customer.id).toLowerCase()}`)}
                        className="group align-middle transition-colors hover:bg-slate-50 dark:hover:bg-navy-800 cursor-pointer"
                      >
                        <td className="px-4 py-4 text-left">
                          <CountryDisplay value={customer.country} className="text-xs" />
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-4 text-left font-bold tracking-tight text-primary-navy transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-emerald-400" title={customer.name}>{customer.name || '—'}</td>
                        <td className="px-4 py-4 text-center">{customer.source_channel ? <Chip tone="neutral">{customer.source_channel}</Chip> : '—'}</td>
                        <td className="px-4 py-4 text-left text-slate-600 dark:text-slate-400 font-medium truncate max-w-[150px]" title={customer.contact}>{customer.contact || '—'}</td>
                        <td className="px-4 py-4 text-right text-slate-700 dark:text-slate-300 font-bold data-field">{customer.order_count || '—'}</td>
                        <td className="px-4 py-4 text-center">
                          <div className="inline-flex max-w-[140px] items-center gap-1.5 rounded-full border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                            <UserRound size={12} className="shrink-0 text-slate-400" />
                            <span className="truncate">{customer.owner_user_name || customer.created_by_name || '未分配'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => openEdit(customer)} className="rounded-lg border border-transparent p-2 text-secondary-slate dark:text-slate-400 transition-all hover:bg-surface dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white hover:border-slate-300 dark:hover:border-navy-600 shadow-sm">
                              <Edit className="h-4 w-4" />
                            </button>
                            {user?.role === 'admin' ? (
                              <button onClick={() => void startDelete(customer)} className="rounded-lg border border-transparent p-2 text-slate-300 dark:text-slate-600 transition-all hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 shadow-sm">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400 font-medium">没有匹配的客户。</td>
                    </tr>
                  )}
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
        title={editingCustomer ? `编辑客户档案：${editingCustomer.name}` : '新增客户档案'}
        isDirty={isFormDirty}
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeForm} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">取消</button>
            <button onClick={() => void handleSubmit(null as unknown as React.FormEvent<HTMLFormElement>)} type="button" className="btn-primary shadow-md active:scale-95">保存客户</button>
          </div>
        }
      >
        <div className="space-y-6">
          {formError ? <div className="rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{formError}</div> : null}
          <div className="space-y-6">
            <Field label="客户名称 *" error={fieldErrors.name}>
              <input 
                value={form.name} 
                onChange={(event) => {
                  setForm({ ...form, name: event.target.value });
                  if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                }} 
                placeholder="例如：Verdana Health Ltd."
                className={`w-full rounded-lg border ${fieldErrors.name ? 'border-red-500 bg-red-50/30 dark:bg-red-900/10' : 'border-slate-200 dark:border-navy-800'} bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white`} 
              />
            </Field>
            <Field label="国家 / 地区 *" error={fieldErrors.country}>
              <CountrySelect 
                value={form.country} 
                error={fieldErrors.country}
                onChange={(val) => {
                  setForm({ ...form, country: val });
                  if (fieldErrors.country) setFieldErrors({ ...fieldErrors, country: '' });
                }} 
              />
            </Field>
            <Field label="联系方式">
              <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="姓名 / 邮箱 / 电话" className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
            </Field>
            {user?.role === 'admin' && !editingCustomer ? (
              <Field label="客户负责人">
                <select
                  value={form.ownerUserId}
                  onChange={(event) => setForm({ ...form, ownerUserId: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none appearance-none cursor-pointer text-primary-navy dark:text-white"
                >
                  <option value="">默认归属当前创建人</option>
                  {activeOwnerOptions.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name || owner.username}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-500">建档后如需变更负责人，请在客户详情页执行转交并留下原因。</p>
              </Field>
            ) : null}
            <Field label="客户来源渠道">
              <select value={form.sourceChannel} onChange={(event) => setForm({ ...form, sourceChannel: event.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none appearance-none cursor-pointer text-primary-navy dark:text-white">
                  <option value="">请选择来源...</option>
                  <option value="阿里巴巴国际站">阿里巴巴国际站</option>
                  <option value="官网">官网</option>
                  <option value="展会">展会</option>
                  <option value="转介绍">转介绍</option>
                  <option value="开发信">开发信</option>
                  <option value="其他">其他</option>
              </select>
            </Field>
            <Field label="意向产品类型">
              <textarea value={form.intentProducts} onChange={(event) => setForm({ ...form, intentProducts: event.target.value })} placeholder="例如：太阳能板、逆变器等..." className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white min-h-[100px] resize-y" rows={3} />
            </Field>
          </div>
        </div>
      </Drawer>

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="客户档案销毁确认"
        warning={
          <>确定要永久删除客户“{customerToDelete?.name}”吗？此操作将同步清除与之关联的所有记录，<span className="text-red-600 font-bold">不可逆转</span>。</>
        }
        entityLabel="编号"
        entityId={customerToDelete?.display_id || String(customerToDelete?.id || '')}
        isDeleting={isDeleting}
      />


{toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
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
