import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Plus, Search, Trash2 } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { PartnerRecord, PartnerType } from '../types/crm';

type PartnerForm = {
  name: string;
  partnerType: PartnerType;
  country: string;
  contact: string;
  paymentTerms: string;
  remark: string;
};

const EMPTY_FORM: PartnerForm = {
  name: '',
  partnerType: 'factory',
  country: '',
  contact: '',
  paymentTerms: '',
  remark: '',
};

function getPartnerTypeLabel(type: PartnerType) {
  switch (type) {
    case 'factory':
      return '工厂 / 供应商';
    case 'forwarder':
      return '货代';
    case 'customs_broker':
      return '报关行';
    default:
      return '其他合作方';
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
    if (!keyword) {
      return partners;
    }
    return partners.filter((partner) =>
      [
        partner.name,
        partner.country || '',
        partner.contact || '',
        partner.payment_terms || '',
        getPartnerTypeLabel(partner.partner_type),
      ].some((value) => value.toLowerCase().includes(keyword)),
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
      name: form.name.trim(),
      partnerType: form.partnerType,
      country: form.country.trim(),
      contact: form.contact.trim(),
      paymentTerms: form.paymentTerms.trim(),
      remark: form.remark.trim(),
    };

    try {
      if (editingPartner) {
        await apiFetch(`/api/partners/${editingPartner.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/partners', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
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
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">供应商 / 合作伙伴</h2>
            <p className="mt-1 text-sm text-slate-500">统一维护工厂、货代、报关行等伙伴资料，供生产安排和付款选择。</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索伙伴、国家、联系方式"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-72"
              />
            </div>
            <button
              onClick={showForm ? closeForm : openCreate}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              <Plus className="mr-2 h-4 w-4" />
              {showForm ? '取消' : '新增伙伴'}
            </button>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

        {showForm ? (
          <form onSubmit={handleSubmit} className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 text-sm font-semibold text-slate-800">{editingPartner ? `编辑伙伴：${editingPartner.name}` : '新增伙伴'}</div>
            {formError ? <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div> : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="伙伴名称 *">
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
              <Field label="伙伴类型 *">
                <select value={form.partnerType} onChange={(event) => setForm({ ...form, partnerType: event.target.value as PartnerType })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="factory">工厂 / 供应商</option>
                  <option value="forwarder">货代</option>
                  <option value="customs_broker">报关行</option>
                  <option value="other">其他合作方</option>
                </select>
              </Field>
              <Field label="国家 / 地区">
                <input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
              <Field label="联系方式">
                <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
              <Field label="付款条款">
                <input value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
              <Field label="备注">
                <textarea value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">取消</button>
              <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">保存伙伴</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="text-sm text-slate-500">正在读取伙伴数据...</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">伙伴名称</th>
                    <th className="px-3 py-3">类型</th>
                    <th className="px-3 py-3">国家</th>
                    <th className="px-3 py-3">联系方式</th>
                    <th className="px-3 py-3">付款条款</th>
                    <th className="px-3 py-3">备注</th>
                    <th className="px-3 py-3">创建人</th>
                    <th className="px-3 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredPartners.length ? (
                    filteredPartners.map((partner) => (
                      <tr key={partner.id} className="align-top">
                        <td className="px-3 py-3 font-semibold text-slate-900">{partner.name}</td>
                        <td className="px-3 py-3 text-slate-600">{getPartnerTypeLabel(partner.partner_type)}</td>
                        <td className="px-3 py-3 text-slate-600">{partner.country || '未填写'}</td>
                        <td className="px-3 py-3 text-slate-600">{partner.contact || '未填写'}</td>
                        <td className="px-3 py-3 text-slate-600">{partner.payment_terms || '未填写'}</td>
                        <td className="max-w-[260px] px-3 py-3 text-slate-500">{partner.remark || '无'}</td>
                        <td className="px-3 py-3 text-slate-500">{partner.created_by_name || '系统'}</td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => openEdit(partner)} className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800">
                              <Edit className="h-4 w-4" />
                            </button>
                            {user?.role === 'admin' ? (
                              <button onClick={() => void handleDelete(partner)} className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">还没有匹配的伙伴数据。</td>
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
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
