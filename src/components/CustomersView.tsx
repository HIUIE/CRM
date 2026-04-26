import React, { useEffect, useMemo, useState } from 'react';
import { Edit, ExternalLink, Plus, Search, Trash2, AlertTriangle, Copy, Check, Hash } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Chip, Toast } from '../features/order-detail/components';
import { Drawer } from './ui/Drawer';
import { Pagination } from './ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import { TIME_RANGES, getRangeDates } from '../lib/date';
import CountrySelect from './ui/CountrySelect';
import CountryDisplay from './ui/CountryDisplay';
import { getCountryDisplay } from '../lib/countries';
import type { CustomerListItem } from '../types/crm';

type CustomerForm = {
  name: string;
  country: string;
  contact: string;
  sourceChannel: string;
  intentProducts: string;
};

const EMPTY_FORM: CustomerForm = {
  name: '',
  country: '',
  contact: '',
  sourceChannel: '',
  intentProducts: '',
};

export default function CustomersView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const query = searchParams.get('q') || '';
  const countryFilter = searchParams.get('country') || '';
  const timeRange = searchParams.get('timeRange') || 'all';

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);

    if (key === 'timeRange') {
      const dates = getRangeDates(val as any);
      if (dates.start) next.set('start_date', dates.start); else next.delete('start_date');
      if (dates.end) next.set('end_date', dates.end); else next.delete('end_date');
    }

    setSearchParams(next);
  };

  const loadCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<CustomerListItem[]>(`/api/customers?${searchParams.toString()}`);
      setCustomers(data);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '读取客户数据失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, [searchParams]);

  const countryOptions = useMemo(
    () =>
      Array.from(
        new Set<string>(customers.map((customer) => customer.country).filter((value): value is string => Boolean(value))),
      ).sort((a, b) => a.localeCompare(b)),
    [customers],
  );

  const filteredCustomers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesQuery =
        !keyword ||
        [customer.name, customer.country || '', customer.contact || '', customer.source_channel || '', customer.intent_products || '']
          .some((value) => value.toLowerCase().includes(keyword));
      const matchesCountry = !countryFilter || customer.country === countryFilter;
      return matchesQuery && matchesCountry;
    });
  }, [countryFilter, customers, query]);

  const {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    currentItems,
    setCurrentPage,
    setPageSize,
  } = usePagination(filteredCustomers);

  // Read create flag from URL to open drawer
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      openCreate();
      updateParam('create', '');
    }
  }, [searchParams]);

  const openCreate = () => {
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
    setInitialForm(EMPTY_FORM);
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
        await loadCustomers();
      } else {
        const result = await apiFetch<{ id: number, displayId: string }>('/api/customers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setToast('客户建档成功');
        closeForm();
        setTimeout(() => {
          setToast('');
          const navigateToDetail = () => navigate(`/customers/detail/${String(result.displayId || result.id).toLowerCase()}`);
          if ((document as any).startViewTransition) {
            (document as any).startViewTransition(navigateToDetail);
          } else {
            navigateToDetail();
          }
        }, 1000);
      }
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, '保存客户失败'));
    }
  };

  const startDelete = (customer: CustomerListItem) => {
    setOrderToDelete(customer);
    setDeleteInput('');
    setCopied(false);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete || deleteInput !== (customerToDelete.display_id || String(customerToDelete.id))) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/customers/${customerToDelete.id}`, { method: 'DELETE' });
      setIsDeleteModalOpen(false);
      await loadCustomers();
    } catch (err) {
      alert(getErrorMessage(err, '删除客户失败'));
    } finally {
      setIsDeleting(false);
    }
  };

  const copyId = () => {
    if (!customerToDelete) return;
    navigator.clipboard.writeText(customerToDelete.display_id || String(customerToDelete.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col space-y-4 animate-in fade-in duration-500">
      <section className="shrink-0 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm transition-colors">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={query}
              onChange={(event) => updateParam('q', event.target.value)}
              placeholder="搜索客户名称、渠道..."
              className="w-full rounded-2xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 py-2.5 pl-9 pr-4 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white"
            />
          </div>
          <div className="relative">
             <select
               value={countryFilter}
               onChange={(event) => updateParam('country', event.target.value)}
               className="w-full rounded-2xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 px-3 py-2.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none appearance-none text-primary-navy dark:text-white cursor-pointer"
             >
               <option value="">全部国家</option>
               {countryOptions.map((country) => (
                 <option key={country} value={country}>
                   {country}
                 </option>
               ))}
             </select>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center rounded-2xl bg-primary-navy dark:bg-tertiary-sage px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-800 dark:hover:bg-emerald-700 shadow-md active:scale-95"
          >
            <Plus className="mr-2 h-4 w-4" />
            新增客户
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
           {TIME_RANGES.map(chip => (
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
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm transition-colors flex flex-col">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 p-8 text-center animate-pulse">正在读取客户数据...</div>
        ) : (
          <div className="flex flex-col">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-navy-950 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                  <tr>
                    <th className="px-4 py-4 text-left">国家</th>
                    <th className="px-4 py-4 text-left">客户名称</th>
                    <th className="px-4 py-4 text-center">来源渠道</th>
                    <th className="px-4 py-4 text-left">联系方式</th>
                    <th className="px-4 py-4 text-right">订单数</th>
                    <th className="px-4 py-4 text-center">创建人</th>
                    <th className="px-4 py-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-900">
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
                        <td className="px-4 py-4 text-left font-bold text-primary-navy dark:text-white group-hover:text-blue-600 dark:group-hover:text-emerald-400 transition-colors uppercase tracking-tight truncate max-w-[200px]" title={customer.name}>{customer.name || '—'}</td>
                        <td className="px-4 py-4 text-center">{customer.source_channel ? <Chip tone="neutral">{customer.source_channel}</Chip> : '—'}</td>
                        <td className="px-4 py-4 text-left text-slate-600 dark:text-slate-400 font-medium truncate max-w-[150px]" title={customer.contact}>{customer.contact || '—'}</td>
                        <td className="px-4 py-4 text-right text-slate-700 dark:text-slate-300 font-bold data-field">{customer.order_count || '—'}</td>
                        <td className="px-4 py-4 text-center text-slate-500 dark:text-slate-500 text-[11px] font-bold uppercase">{customer.created_by_name || '系统'}</td>
                        <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => openEdit(customer)} className="rounded-lg border border-transparent p-2 text-secondary-slate dark:text-slate-400 transition-all hover:bg-white dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white hover:border-slate-300 dark:hover:border-navy-600 shadow-sm">
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
            <button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">取消</button>
            <button onClick={() => void handleSubmit(null as any)} type="button" className="rounded-xl bg-primary-navy dark:bg-tertiary-sage px-10 py-2.5 text-sm font-bold text-white hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all shadow-md active:scale-95">保存客户</button>
          </div>
        }
      >
        <div className="space-y-6">
          {formError ? <div className="rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{formError}</div> : null}
          <div className="space-y-6">
            <Field label="客户名称 *" error={fieldErrors.name}>
              <input 
                value={form.name} 
                onChange={(event) => {
                  setForm({ ...form, name: event.target.value });
                  if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                }} 
                placeholder="例如：Verdana Health Ltd."
                className={`w-full rounded-xl border ${fieldErrors.name ? 'border-red-500 bg-red-50/30 dark:bg-red-900/10' : 'border-slate-200 dark:border-navy-800'} bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white`} 
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
              <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="姓名 / 邮箱 / 电话" className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
            </Field>
            <Field label="客户来源渠道">
              <select value={form.sourceChannel} onChange={(event) => setForm({ ...form, sourceChannel: event.target.value })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none appearance-none cursor-pointer text-primary-navy dark:text-white">
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
              <textarea value={form.intentProducts} onChange={(event) => setForm({ ...form, intentProducts: event.target.value })} placeholder="例如：太阳能板、逆变器等..." className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white min-h-[100px] resize-y" rows={3} />
            </Field>
          </div>
        </div>
      </Drawer>

      {/* Danger Modal: 客户列表删除二次确认 */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)} />
           <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-navy-900 shadow-2xl border border-red-100 dark:border-red-900/30 animate-in zoom-in duration-300">
              <div className="bg-red-50 dark:bg-red-900/20 px-6 py-4 flex items-center gap-3 border-b border-red-100 dark:border-red-900/30">
                 <AlertTriangle className="text-red-600 dark:text-red-400" size={20} />
                 <h3 className="text-sm font-extrabold text-red-700 dark:text-red-400 uppercase tracking-widest">客户档案销毁确认</h3>
              </div>
              <div className="p-6 space-y-5">
                 <div className="space-y-2">
                    <p className="text-[13px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                        确定要永久删除客户“{customerToDelete?.name}”吗？此操作将同步清除与之关联的所有记录，<span className="text-red-600 font-bold">不可逆转</span>。
                    </p>
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-xl border border-slate-100 dark:border-navy-800">
                       <span className="font-bold text-primary-navy dark:text-white data-field">{customerToDelete?.display_id || customerToDelete?.id}</span>
                       <button onClick={copyId} className="flex items-center gap-1 text-[10px] font-bold text-primary-navy dark:text-tertiary-sage hover:opacity-70 transition-all uppercase tracking-widest">
                          {copied ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制编号</>}
                       </button>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">请输入编号以确认删除</label>
                    <input 
                       value={deleteInput}
                       onChange={e => setDeleteInput(e.target.value)}
                       placeholder={`输入 ${customerToDelete?.display_id || customerToDelete?.id}`}
                       className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 px-4 py-3 text-sm font-bold text-primary-navy dark:text-white outline-none focus:border-red-500 transition-all data-field shadow-inner"
                    />
                 </div>
                 <div className="flex gap-3 pt-2">
                    <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 rounded-xl border border-slate-200 dark:border-navy-800 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all uppercase tracking-widest">取消</button>
                    <button 
                       disabled={isDeleting || deleteInput !== (customerToDelete?.display_id || String(customerToDelete?.id))}
                       onClick={handleConfirmDelete}
                       className="flex-2 rounded-xl bg-red-600 px-6 py-3 text-xs font-bold text-white shadow-lg hover:bg-red-700 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest"
                    >
                       {isDeleting ? '正在注销...' : '确认永久销毁'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-primary-navy dark:text-white uppercase tracking-widest opacity-70">{label}</span>
        {children}
      </label>
      {error && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-500 animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}
    </div>
  );
}
