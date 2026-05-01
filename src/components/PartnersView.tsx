import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Search, Trash2, MapPin, Star, Building2 } from 'lucide-react';
import Field from './ui/Field';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Chip from './ui/Chip';
import Toast from './ui/Toast';
import { Drawer } from './ui/Drawer';
import { Pagination } from './ui/Pagination';
import ConfirmDeleteModal from './ui/ConfirmDeleteModal';
import { usePagination } from '../hooks/usePagination';
import CountrySelect from './ui/CountrySelect';
import CountryDisplay from './ui/CountryDisplay';
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
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerRecord | null>(null);
  const [form, setForm] = useState<PartnerForm>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<PartnerForm>(EMPTY_FORM);
  const [toast, setToast] = useState('');
  const [partnerToDelete, setPartnerToDelete] = useState<PartnerRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const query = searchParams.get('q') || '';
  const typeFilter = searchParams.get('type') || '';

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);
    setSearchParams(next);
  };

  const { data: partners = [], isLoading: loading, error: queryError } = useQuery<PartnerRecord[]>({
    queryKey: ['partners'],
    queryFn: () => apiFetch<PartnerRecord[]>('/api/partners'),
    staleTime: 5 * 60 * 1000,
  });
  const error = queryError ? getErrorMessage(queryError, '读取伙伴数据失败') : '';

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
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, '保存伙伴失败'));
    }
  };

  const handleDelete = async () => {
    if (!partnerToDelete) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/partners/${partnerToDelete.id}`, { method: 'DELETE' });
      setToast('伙伴档案已删除');
      setTimeout(() => setToast(''), 3000);
      setPartnerToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    } catch (requestError) {
      setToast(getErrorMessage(requestError, '删除伙伴失败'));
      setTimeout(() => setToast(''), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 animate-page-in">
      <section className="shrink-0 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-6 shadow-sm transition-colors">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={query}
              onChange={(event) => updateParam('q', event.target.value)}
              placeholder="搜索伙伴名称、类型、联系人..."
              className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 py-2.5 pl-10 pr-4 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
            />
          </div>
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
               className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${typeFilter === chip.key ? 'bg-primary-navy text-white shadow-sm dark:bg-tertiary-sage' : 'border border-slate-200 bg-surface text-slate-600 hover:border-slate-300 hover:bg-slate-50/50 hover:text-primary-navy dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400 dark:hover:border-navy-600 dark:hover:bg-navy-800 dark:hover:text-white'}`}
             >
               {chip.label}
             </button>
           ))}
        </div>

        {error ? <div className="mt-4 rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div> : null}
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-sm transition-colors flex flex-col">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 p-8 text-center animate-pulse">正在读取伙伴数据...</div>
        ) : (
          <div className="flex flex-col">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/80 dark:bg-navy-950/80 backdrop-blur text-xs font-bold tracking-tight text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                  <tr>
                    <th className="px-4 py-4 text-left">伙伴名称</th>
                    <th className="px-4 py-4 text-left">伙伴类型</th>
                    <th className="px-4 py-4 text-center">星级</th>
                    <th className="px-4 py-4 text-left">联系人 / 电话</th>
                    <th className="px-4 py-4 text-left">国家 / 地区</th>
                    <th className="px-4 py-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-surface dark:bg-navy-900">
                  {currentItems.length ? (
                    currentItems.map((partner) => (
                      <tr
                        key={partner.id}
                        onClick={() => navigate(`/partners/detail/${partner.id}`)}
                        className="group align-middle hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4 text-left">
                          <div className="flex items-center gap-3">
                             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100/50 dark:bg-navy-950/50 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-navy-800">
                               {partner.partner_type === 'factory' ? <Building2 size={14} /> : <MapPin size={14} />}
                             </div>
                             <span className="font-bold text-primary-navy dark:text-white tracking-tight">{partner.name || '—'}</span>
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
                           <div className="text-xs text-slate-400 font-medium">{partner.contact || '—'}</div>
                        </td>
                        <td className="px-4 py-4 text-left">
                           <CountryDisplay value={partner.country} className="text-xs" />
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={(event) => { event.stopPropagation(); openEdit(partner); }} className="rounded-lg border border-transparent p-2 text-secondary-slate dark:text-slate-400 transition-all hover:bg-surface dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white hover:border-slate-300 dark:hover:border-navy-600 shadow-sm">
                              <Edit className="h-4 w-4" />
                            </button>
                            {user?.role === 'admin' ? (
                              <button onClick={(event) => { event.stopPropagation(); setPartnerToDelete(partner); }} className="rounded-lg border border-transparent p-2 text-slate-300 dark:text-slate-600 transition-all hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 shadow-sm">
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
            <button type="button" onClick={closeForm} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">取消</button>
            <button onClick={() => void handleSubmit(null as unknown as React.FormEvent<HTMLFormElement>)} type="button" className="btn-primary shadow-md active:scale-95">保存伙伴</button>
          </div>
        }
      >
        <div className="space-y-6">
          {formError ? <div className="rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{formError}</div> : null}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="伙伴名称 *" error={fieldErrors.name}>
                <input 
                  value={form.name} 
                  onChange={(event) => {
                    setForm({ ...form, name: event.target.value });
                    if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                  }} 
                  className={`w-full rounded-lg border ${fieldErrors.name ? 'border-red-500 bg-red-50/30 dark:bg-red-900/10' : 'border-slate-200 dark:border-navy-800'} bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white`} 
                />
              </Field>
            </div>
            <Field label="伙伴类型 *">
              <select value={form.partnerType} onChange={(event) => setForm({ ...form, partnerType: event.target.value as PartnerType })} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none appearance-none cursor-pointer text-primary-navy dark:text-white">
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
              <input value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
            </Field>
            <Field label="联系电话/邮箱">
              <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="详细地址">
                <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="结算条件">
                <input value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })} placeholder="例如：月结30天..." className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="备注说明">
                <textarea value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} placeholder="备用联系人或特殊条款..." className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white min-h-[80px]" rows={2} />
              </Field>
            </div>
          </div>
        </div>
      </Drawer>

      <ConfirmDeleteModal
        isOpen={Boolean(partnerToDelete)}
        onClose={() => setPartnerToDelete(null)}
        onConfirm={() => void handleDelete()}
        title="删除合作伙伴"
        warning={
          <>
            确定要删除合作伙伴“{partnerToDelete?.name || ''}”吗？
            <br /><br />
            删除后该伙伴档案将无法在新的业务记录中选择，请先确认没有未完成的订单、物流或财务事项依赖此伙伴。
          </>
        }
        entityLabel="伙伴名称"
        entityId={partnerToDelete?.name || ''}
        isDeleting={isDeleting}
      />

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

