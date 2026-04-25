import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Plus, Search, Trash2, Star } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Chip } from '../features/order-detail/components';
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
  rating: 0,
  paymentTerms: '',
  remark: '',
};

function getPartnerTypeLabel(type: PartnerType) {
  switch (type) {
    case 'factory': return '工厂 / 供应商';
    case 'forwarder': return '货代';
    case 'customs_broker': return '报关行';
    default: return '其他合作方';
  }
}

export default function PartnersView() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerRecord | null>(null);
  const [form, setForm] = useState<PartnerForm>(EMPTY_FORM);

  const loadPartners = async () => {
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
    return partners.filter((partner) =>
      [partner.name, partner.country || '', partner.contact || '', partner.contact_person || '', getPartnerTypeLabel(partner.partner_type)]
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [partners, query]);

  const openCreate = () => {
    setEditingPartner(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (partner: PartnerRecord) => {
    setEditingPartner(partner);
    setFormError('');
    setForm({
      name: partner.name,
      partnerType: partner.partner_type,
      country: partner.country || '',
      contact: partner.contact || '',
      contactPerson: partner.contact_person || '',
      address: partner.address || '',
      rating: partner.rating || 0,
      paymentTerms: partner.payment_terms || '',
      remark: partner.remark || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingPartner(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    const payload = {
      ...form,
      name: form.name.trim(),
      country: form.country.trim(),
      contact: form.contact.trim(),
    };

    try {
      if (editingPartner) {
        await apiFetch(`/api/partners/${editingPartner.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/api/partners', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeForm();
      await loadPartners();
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, '保存伙伴失败'));
    }
  };

  const handleDelete = async (partner: PartnerRecord) => {
    if (!window.confirm(`确定删除伙伴“${partner.name}”吗？`)) return;
    try {
      await apiFetch(`/api/partners/${partner.id}`, { method: 'DELETE' });
      await loadPartners();
    } catch (requestError) {
      setError(getErrorMessage(requestError, '删除伙伴失败'));
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm transition-colors">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索伙伴名称、类型、联系人..."
              className="w-full rounded-2xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 py-2.5 pl-10 pr-4 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
            />
          </div>
          <button
            onClick={showForm ? closeForm : openCreate}
            className="inline-flex items-center justify-center rounded-2xl bg-primary-navy dark:bg-tertiary-sage px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-800 dark:hover:bg-emerald-700 shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" />
            {showForm ? '取消' : '新增伙伴'}
          </button>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div> : null}

        {showForm ? (
          <form onSubmit={handleSubmit} className="mt-5 rounded-3xl border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6">
            <div className="mb-6 text-[11px] font-bold text-primary-navy dark:text-white uppercase tracking-widest">{editingPartner ? `编辑伙伴档案：${editingPartner.name}` : '新增伙伴档案'}</div>
            {formError ? <div className="mb-4 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{formError}</div> : null}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Field label="伙伴名称 *">
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
              </Field>
              <Field label="伙伴类型 *">
                <select value={form.partnerType} onChange={(event) => setForm({ ...form, partnerType: event.target.value as PartnerType })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none appearance-none cursor-pointer text-primary-navy dark:text-white">
                  <option value="factory">工厂 / 供应商</option>
                  <option value="forwarder">货代</option>
                  <option value="customs_broker">报关行</option>
                  <option value="other">其他合作方</option>
                </select>
              </Field>
              <Field label="合作星级 (1-5)">
                 <div className="flex gap-2 py-2">
                   {[1, 2, 3, 4, 5].map(star => (
                     <button type="button" key={star} onClick={() => setForm({ ...form, rating: star })} className="transition-all hover:scale-110">
                        <Star size={24} fill={form.rating >= star ? "#EAB308" : "none"} color={form.rating >= star ? "#EAB308" : "#CBD5E1"} />
                     </button>
                   ))}
                 </div>
              </Field>
              <Field label="联系人">
                <input value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
              </Field>
              <Field label="联系电话/邮箱">
                <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
              </Field>
              <Field label="国家 / 地区">
                <input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
              </Field>
              <div className="lg:col-span-2">
                <Field label="详细地址">
                  <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
                </Field>
              </div>
              <Field label="付款条款">
                <input value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })} placeholder="例如：月结 30 天..." className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
              </Field>
              <div className="md:col-span-2 lg:col-span-3">
                <Field label="备注">
                  <textarea value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" rows={2} />
                </Field>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">取消</button>
              <button type="submit" className="rounded-xl bg-primary-navy dark:bg-tertiary-sage px-10 py-2.5 text-sm font-bold text-white hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all shadow-md">保存伙伴</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 shadow-sm transition-colors">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 p-8">正在读取伙伴数据...</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-navy-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-4">类型</th>
                    <th className="px-4 py-4">伙伴名称</th>
                    <th className="px-4 py-4">评级</th>
                    <th className="px-4 py-4">联系人 / 详情</th>
                    <th className="px-4 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-900">
                  {filteredPartners.length ? (
                    filteredPartners.map((partner) => (
                      <tr
                        key={partner.id}
                        onClick={() => openEdit(partner)}
                        className="group align-middle transition-colors hover:bg-slate-50 dark:hover:bg-navy-800 cursor-pointer"
                      >
                        <td className="px-4 py-4"><Chip tone={partner.partner_type === 'factory' ? 'info' : 'neutral'}>{getPartnerTypeLabel(partner.partner_type)}</Chip></td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-primary-navy dark:text-white uppercase tracking-tight">{partner.name}</div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 uppercase font-medium">{partner.country || 'GLOBAL'}</div>
                        </td>
                        <td className="px-4 py-4">
                           <div className="flex gap-0.5">
                             {[1, 2, 3, 4, 5].map(s => (
                               <Star key={s} size={12} fill={(partner.rating || 0) >= s ? "#EAB308" : "none"} color={(partner.rating || 0) >= s ? "#EAB308" : "#E2E8F0"} />
                             ))}
                           </div>
                        </td>
                        <td className="px-4 py-4">
                           <div className="text-slate-700 dark:text-slate-200 font-bold">{partner.contact_person || '未填写'}</div>
                           <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{partner.contact}</div>
                        </td>
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => openEdit(partner)} className="rounded-lg border border-slate-200 dark:border-navy-700 p-2 text-secondary-slate dark:text-slate-400 transition-all hover:bg-white dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white hover:border-slate-300 dark:hover:border-navy-600">
                              <Edit className="h-4 w-4" />
                            </button>
                            {user?.role === 'admin' ? (
                              <button onClick={() => void handleDelete(partner)} className="rounded-lg border border-slate-200 dark:border-navy-700 p-2 text-slate-300 dark:text-slate-600 transition-all hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400 font-medium">还没有匹配的伙伴数据。</td>
                    </tr>
                  )}
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
      <span className="mb-2 block text-xs font-bold text-primary-navy dark:text-white uppercase tracking-widest opacity-70">{label}</span>
      {children}
    </label>
  );
}
