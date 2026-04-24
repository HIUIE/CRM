import React, { useEffect, useMemo, useState } from 'react';
import { Edit, ExternalLink, Plus, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Chip } from '../features/order-detail/components';
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

function countryToFlag(country: string) {
  const normalized = country.trim().toLowerCase();
  const dictionary: Record<string, string> = {
    china: 'cn', 中国: 'cn', usa: 'us', 'united states': 'us', 美国: 'us', canada: 'ca', 加拿大: 'ca', germany: 'de', 德国: 'de',
    france: 'fr', 法国: 'fr', italy: 'it', 意大利: 'it', spain: 'es', 西班牙: 'es', mexico: 'mx', 墨西哥: 'mx', brazil: 'br', 巴西: 'br',
    australia: 'au', 澳大利亚: 'au', japan: 'jp', 日本: 'jp', korea: 'kr', 'south korea': 'kr', 韩国: 'kr', uk: 'gb', 'united kingdom': 'gb', 英国: 'gb',
    vietnam: 'vn', 越南: 'vn', thailand: 'th', 泰国: 'th', malaysia: 'my', 马来西亚: 'my', singapore: 'sg', 新加坡: 'sg',
  };
  const code = dictionary[normalized];
  if (code) {
    return <span className={`fi fi-${code} rounded-sm shadow-sm`} />;
  }
  return <span className="fi fi-xx rounded-sm shadow-sm" />;
}

export default function CustomersView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerListItem | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);

  const loadCustomers = async () => {
    setError('');
    try {
      const data = await apiFetch<CustomerListItem[]>(`/api/customers?timeRange=${timeRange}`);
      setCustomers(data);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '读取客户数据失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, [timeRange]);

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
        [customer.name, customer.country, customer.contact, customer.source_channel || '', customer.intent_products || '']
          .some((value) => value.toLowerCase().includes(keyword));
      const matchesCountry = !countryFilter || customer.country === countryFilter;
      return matchesQuery && matchesCountry;
    });
  }, [countryFilter, customers, query]);

  const openCreate = () => {
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (customer: CustomerListItem) => {
    setEditingCustomer(customer);
    setFormError('');
    setForm({
      name: customer.name,
      country: customer.country,
      contact: customer.contact,
      sourceChannel: customer.source_channel || '',
      intentProducts: customer.intent_products || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

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
      } else {
        await apiFetch('/api/customers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      closeForm();
      await loadCustomers();
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, '保存客户失败'));
    }
  };

  const handleDelete = async (customer: CustomerListItem) => {
    if (!window.confirm(`确定删除客户“${customer.name}”吗？`)) {
      return;
    }

    try {
      await apiFetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
      await loadCustomers();
    } catch (requestError) {
      setError(getErrorMessage(requestError, '删除客户失败'));
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索客户名称、渠道、意向产品..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm focus:border-primary-navy transition-colors outline-none"
            />
          </div>
          <select
            value={countryFilter}
            onChange={(event) => setCountryFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-primary-navy transition-colors outline-none appearance-none"
          >
            <option value="">全部国家</option>
            {countryOptions.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          <button
            onClick={showForm ? closeForm : openCreate}
            className="inline-flex items-center justify-center rounded-2xl bg-primary-navy px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-800 shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" />
            {showForm ? '取消' : '新增客户'}
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
               onClick={() => setTimeRange(chip.key)}
               className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-all ${timeRange === chip.key ? 'bg-primary-navy text-white shadow-sm' : 'bg-slate-50 text-secondary-slate hover:bg-slate-100'}`}
             >
               {chip.label}
             </button>
           ))}
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

        {showForm ? (
          <form onSubmit={handleSubmit} className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-6">
            <div className="mb-6 text-[11px] font-bold text-primary-navy uppercase tracking-widest">{editingCustomer ? `编辑客户档案：${editingCustomer.name}` : '新增客户档案'}</div>
            {formError ? <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div> : null}
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="客户名称 *">
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy transition-colors outline-none" />
              </Field>
              <Field label="国家 / 地区 *">
                <input required value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy transition-colors outline-none" />
              </Field>
              <Field label="联系方式 *">
                <input required value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy transition-colors outline-none" />
              </Field>
              <Field label="客户来源渠道">
                <select value={form.sourceChannel} onChange={(event) => setForm({ ...form, sourceChannel: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy transition-colors outline-none appearance-none cursor-pointer">
                   <option value="">请选择来源...</option>
                   <option value="阿里巴巴国际站">阿里巴巴国际站</option>
                   <option value="官网">官网</option>
                   <option value="展会">展会</option>
                   <option value="转介绍">转介绍</option>
                   <option value="开发信">开发信</option>
                   <option value="其他">其他</option>
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="意向产品类型">
                  <textarea value={form.intentProducts} onChange={(event) => setForm({ ...form, intentProducts: event.target.value })} placeholder="例如：太阳能板、逆变器等..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy transition-colors outline-none" rows={3} />
                </Field>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">取消</button>
              <button type="submit" className="rounded-xl bg-primary-navy px-10 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-all shadow-md">保存客户</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="text-sm text-slate-500 p-8">正在读取客户数据...</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 py-4">国家</th>
                    <th className="px-4 py-4">客户名称</th>
                    <th className="px-4 py-4">来源渠道</th>
                    <th className="px-4 py-4">联系方式</th>
                    <th className="px-4 py-4">订单数</th>
                    <th className="px-4 py-4">创建人</th>
                    <th className="px-4 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredCustomers.length ? (
                    filteredCustomers.map((customer) => (
                      <tr
                        key={customer.id}
                        onClick={() => navigate(`/orders?customerId=${customer.id}`)}
                        className="group align-middle transition-colors hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 font-bold text-primary-navy">
                            {countryToFlag(customer.country)}
                            <span>{customer.country}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-bold text-primary-navy group-hover:text-blue-600 transition-colors uppercase tracking-tight">{customer.name}</td>
                        <td className="px-4 py-4"><Chip tone="neutral">{customer.source_channel || '未知'}</Chip></td>
                        <td className="px-4 py-4 text-slate-600 font-medium">{customer.contact}</td>
                        <td className="px-4 py-4 text-slate-700 font-bold">{customer.order_count}</td>
                        <td className="px-4 py-4 text-slate-500 text-[11px] font-bold uppercase">{customer.created_by_name || '系统'}</td>
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => openEdit(customer)} className="rounded-lg border border-slate-200 p-2 text-secondary-slate transition-all hover:bg-white hover:text-primary-navy hover:border-slate-300">
                              <Edit className="h-4 w-4" />
                            </button>
                            {user?.role === 'admin' ? (
                              <button onClick={() => void handleDelete(customer)} className="rounded-lg border border-slate-200 p-2 text-slate-300 transition-all hover:bg-red-50 hover:text-red-600 hover:border-red-200">
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
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-primary-navy uppercase tracking-widest opacity-70">{label}</span>
      {children}
    </label>
  );
}