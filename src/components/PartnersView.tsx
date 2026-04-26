import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Plus, Search, Trash2, MapPin, Star, Building2, AlertTriangle } from 'lucide-react';
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
import type { PartnerRecord, PartnerType } from '../types/crm';

type PartnerForm = {
  name: string;
  partnerType: PartnerType;
  country: string;
  contact: string;
  contactPerson: string;
  address: string;
  rating: number;
  paymentTerms: string;
  remark: string;
};

const EMPTY_FORM: PartnerForm = {
  name: '',
  partnerType: 'factory',
  country: '',
  contact: '',
  contactPerson: '',
  address: '',
  rating: 3,
  paymentTerms: '',
  remark: '',
};

function getPartnerTypeLabel(type: PartnerType) {
  switch (type) {
    case 'factory': return '工厂 / 供应商';
    case 'forwarder': return '货代物流';
    case 'customs_broker': return '报关行';
    default: return '其他合作方';
  }
}

export default function PartnersView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerRecord | null>(null);
  const [form, setForm] = useState<PartnerForm>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<PartnerForm>(EMPTY_FORM);
  const [toast, setToast] = useState('');

  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const query = searchParams.get('q') || '';
  const typeFilter = searchParams.get('type') || '';

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);
    setSearchParams(next);
  };

  const loadPartners = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<PartnerRecord[]>('/api/partners');
      setPartners(data);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '读取伙伴数据失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPartners();
  }, []);

  const filteredPartners = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return partners.filter((partner) => {
      const matchesQuery =
        !keyword ||
        [partner.name, partner.country || '', partner.contact || '', partner.contact_person || '', partner.remark || '']
          .some((value) => value.toLowerCase().includes(keyword));
      const matchesType = !typeFilter || partner.partner_type === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [typeFilter, partners, query]);

  const {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    currentItems,
    setCurrentPage,
    setPageSize,
  } = usePagination(filteredPartners);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      openCreate();
      updateParam('create', '');
    }
  }, [searchParams]);

  const openCreate = () => {
    setEditingPartner(null);
    setForm(EMPTY_FORM);
    setInitialForm(EMPTY_FORM);
    setFormError('');
    setFieldErrors({});
    setShowForm(true);
  };

  const openEdit = (partner: PartnerRecord) => {
    setEditingPartner(partner);
    setFormError('');
    setFieldErrors({});
    const newForm = {
      name: partner.name,
      partnerType: partner.partner_type,
      country: partner.country || '',
      contact: partner.contact || '',
      contactPerson: partner.contact_person || '',
      address: partner.address || '',
      rating: partner.rating || 3,
      paymentTerms: partner.payment_terms || '',
      remark: partner.remark || '',
    };
    setForm(newForm);
    setInitialForm(newForm);
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingPartner(null);
    setForm(EMPTY_FORM);
    setInitialForm(EMPTY_FORM);
    setFormError('');
    setFieldErrors({});
    setShowForm(false);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = '伙伴名称为必填项';
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    if (event) event.preventDefault();
    setFormError('');

    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      partnerType: form.partnerType,
      country: form.country.trim(),
      contact: form.contact.trim(),
      contactPerson: form.contactPerson.trim(),
      address: form.address.trim(),
      rating: form.rating,
      paymentTerms: form.paymentTerms.trim(),
      remark: form.remark.trim(),
    };

    try {
      if (editingPartner) {
        await apiFetch(`/api/partners/${editingPartner.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setToast('伙伴资料已更新');
      } else {
        await apiFetch('/api/partners', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setToast('伙伴建档成功');
      }
      setTimeout(() => setToast(''), 3000);
      closeForm();
      await loadPartners();
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, '保存伙伴失败'));
    }
  };

  const handleDelete = async (partner: PartnerRecord) => {
    if (!window.confirm(`确定删除伙伴“${partner.name}”吗？`)) {
      return;
    }

    try {
      await apiFetch(`/api/partners/${partner.id}`, { method: 'DELETE' });
      await loadPartners();
    } catch (requestError) {
      setError(getErrorMessage(requestError, '删除伙伴失败'));
    }
  };

  return (
    <div className="flex flex-col space-y-4 animate-in fade-in duration-500">
      <section className="shrink-0 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm transition-colors">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={query}
              onChange={(event) => updateParam('q', event.target.value)}
              placeholder="搜索伙伴名称、类型、联系人..."
              className="w-full rounded-2xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 py-2.5 pl-10 pr-4 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
            />
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center rounded-2xl bg-primary-navy dark:bg-tertiary-sage px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-800 dark:hover:bg-emerald-700 shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" />
            新增伙伴
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
           {[
             { key: '', label: '全部类型' },
             { key: 'factory', label: '工厂/供应商' },
             { key: 'forwarder', label: '货代' },
             { key: 'customs_broker', label: '报关行' }
           ].map(chip => (
             <button
               key={chip.key}
               onClick={() => updateParam('type', chip.key)}
               className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-all ${typeFilter === chip.key ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-sm' : 'bg-slate-50 dark:bg-navy-950 text-secondary-slate dark:text-slate-400 border border-slate-100 dark:border-navy-800 hover:bg-slate-100 dark:hover:bg-navy-800'}`}
             >
               {chip.label}
             </button>
           ))}
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div> : null}
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm transition-colors flex flex-col">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 p-8 text-center animate-pulse">正在读取伙伴数据...</div>
        ) : (
          <div className="flex flex-col">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-navy-950 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                  <tr>
                    <th className="px-4 py-4 text-left">伙伴名称</th>
                    <th className="px-4 py-4 text-left">伙伴类型</th>
                    <th className="px-4 py-4 text-center">星级</th>
                    <th className="px-4 py-4 text-left">联系人 / 电话</th>
                    <th className="px-4 py-4 text-left">国家 / 地区</th>
                    <th className="px-4 py-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-900">
                  {currentItems.length ? (
                    currentItems.map((partner) => (
                      <tr
                        key={partner.id}
                        className="group align-middle hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                      >
                        <td className="px-4 py-4 text-left">
                          <div className="flex items-center gap-3">
                             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-navy-700">
                               {partner.partner_type === 'factory' ? <Building2 size={14} /> : <MapPin size={14} />}
                             </div>
                             <span className="font-bold text-primary-navy dark:text-white uppercase tracking-tight">{partner.name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-left">
                           <Chip tone={partner.partner_type === 'factory' ? 'warning' : partner.partner_type === 'forwarder' ? 'info' : 'neutral'}>
                              {getPartnerTypeLabel(partner.partner_type)}
                           </Chip>
                        </td>
                        <td className="px-4 py-4 text-center">
                           <div className="flex items-center justify-center gap-0.5">
                             {[1,2,3,4,5].map(s => <Star key={s} size={12} className={s <= (partner.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-navy-700'} />)}
                           </div>
                        </td>
                        <td className="px-4 py-4 text-left">
                           <div className="font-bold text-slate-700 dark:text-slate-300">{partner.contact_person || '—'}</div>
                           <div className="text-[11px] text-slate-400 font-medium">{partner.contact || '—'}</div>
                        </td>
                        <td className="px-4 py-4 text-left">
                           <CountryDisplay value={partner.country} className="text-xs" />
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => openEdit(partner)} className="rounded-lg border border-transparent p-2 text-secondary-slate dark:text-slate-400 transition-all hover:bg-white dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white hover:border-slate-300 dark:hover:border-navy-600 shadow-sm">
                              <Edit className="h-4 w-4" />
                            </button>
                            {user?.role === 'admin' ? (
                              <button onClick={() => void handleDelete(partner)} className="rounded-lg border border-transparent p-2 text-slate-300 dark:text-slate-600 transition-all hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 shadow-sm">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400 font-medium">没有匹配的伙伴记录。</td>
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
        title={editingPartner ? `编辑伙伴档案：${editingPartner.name}` : '新增伙伴档案'}
        isDirty={isFormDirty}
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">取消</button>
            <button onClick={() => void handleSubmit(null as any)} type="button" className="rounded-xl bg-primary-navy dark:bg-tertiary-sage px-10 py-2.5 text-sm font-bold text-white hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all shadow-md active:scale-95">保存伙伴</button>
          </div>
        }
      >
        <div className="space-y-6">
          {formError ? <div className="rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{formError}</div> : null}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="伙伴名称 *" error={fieldErrors.name}>
                <input 
                  value={form.name} 
                  onChange={(event) => {
                    setForm({ ...form, name: event.target.value });
                    if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                  }} 
                  className={`w-full rounded-xl border ${fieldErrors.name ? 'border-red-500 bg-red-50/30 dark:bg-red-900/10' : 'border-slate-200 dark:border-navy-800'} bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white`} 
                />
              </Field>
            </div>
            <Field label="伙伴类型 *">
              <select value={form.partnerType} onChange={(event) => setForm({ ...form, partnerType: event.target.value as PartnerType })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none appearance-none cursor-pointer text-primary-navy dark:text-white">
                <option value="factory">工厂 / 供应商</option>
                <option value="forwarder">货代</option>
                <option value="customs_broker">报关行</option>
                <option value="other">其他合作方</option>
              </select>
            </Field>
            <Field label="国家 / 地区">
              <CountrySelect 
                value={form.country} 
                onChange={(val) => setForm({ ...form, country: val })} 
              />
            </Field>
            <Field label="合作星级">
               <div className="flex gap-2 py-2">
                 {[1, 2, 3, 4, 5].map(star => (
                   <button type="button" key={star} onClick={() => setForm({ ...form, rating: star })} className="transition-all hover:scale-110">
                      <Star size={20} fill={form.rating >= star ? "#EAB308" : "none"} color={form.rating >= star ? "#EAB308" : "#CBD5E1"} />
                   </button>
                 ))}
               </div>
            </Field>
            <div className="sm:col-span-2 border-t border-slate-100 dark:border-navy-800 pt-6 mt-2" />
            <Field label="主要联系人">
              <input value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
            </Field>
            <Field label="联系电话/邮箱">
              <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="详细地址">
                <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="结算条件">
                <input value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })} placeholder="例如：月结30天..." className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="备注说明">
                <textarea value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} placeholder="备用联系人或特殊条款..." className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white min-h-[80px]" rows={2} />
              </Field>
            </div>
          </div>
        </div>
      </Drawer>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-2 block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</span>
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
