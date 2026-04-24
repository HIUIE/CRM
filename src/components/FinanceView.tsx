import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Paperclip, Plus, Search, Trash2 } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { FinanceListRecord, OrderOption, PartnerOption } from '../types/crm';

type FinanceFormState = {
  orderId: string;
  type: 'receipt' | 'payment';
  amount: string;
  currency: 'USD' | 'CNY';
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

function formatTotal(amount: number, currency: 'USD' | 'CNY') {
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function getPaymentCategoryLabel(category: FinanceListRecord['recordCategory'] | FinanceListRecord['payment_category']) {
  switch (category) {
    case 'deposit':
      return '首付款';
    case 'balance':
      return '尾款';
    case 'freight':
      return '运费';
    case 'goods':
      return '货款';
    case 'customs':
      return '报关费';
    case 'other':
      return '其他';
    case 'receipt':
      return '收款';
    default:
      return category;
  }
}

export default function FinanceView() {
  const { user } = useAuth();
  const [records, setRecords] = useState<FinanceListRecord[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceListRecord | null>(null);
  const [formData, setFormData] = useState<FinanceFormState>(EMPTY_FORM);

  const fetchData = async () => {
    setError('');
    try {
      const [financeData, orderData, partnerData] = await Promise.all([
        apiFetch<FinanceListRecord[]>('/api/finance'),
        apiFetch<OrderOption[]>('/api/orders'),
        apiFetch<PartnerOption[]>('/api/partners'),
      ]);
      setRecords(financeData);
      setOrders(orderData);
      setPartners(partnerData);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '读取财务数据失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return records;
    }

    return records.filter((record) =>
      [
        record.order_display_id || '',
        record.customer_name || '',
        record.partner_name || '',
        record.target || '',
        record.remark || '',
        getPaymentCategoryLabel(record.payment_category),
      ].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [records, query]);

  const totals = useMemo(() => {
    return records.reduce(
      (accumulator, record) => {
        if (record.status !== 'completed') {
          accumulator.pending += 1;
          return accumulator;
        }

        if (record.type === 'receipt') {
          accumulator.receipt[record.currency] += record.amount;
        } else {
          accumulator.payment[record.currency] += record.amount;
          if (record.payment_category === 'freight') {
            accumulator.freight[record.currency] += record.amount;
          }
        }

        return accumulator;
      },
      {
        receipt: { USD: 0, CNY: 0 },
        payment: { USD: 0, CNY: 0 },
        freight: { USD: 0, CNY: 0 },
        pending: 0,
      },
    );
  }, [records]);

  const openCreateForm = () => {
    setEditingRecord(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (record: FinanceListRecord) => {
    setEditingRecord(record);
    setFormError('');
    setFormData({
      orderId: String(record.order_id),
      type: record.type,
      amount: String(record.amount),
      currency: record.currency,
      target: record.target || '',
      partnerId: record.partnerId ? String(record.partnerId) : '',
      status: record.status,
      recordCategory:
        (record.recordCategory as FinanceFormState['recordCategory']) ||
        (record.type === 'payment' ? 'goods' : 'deposit'),
      remark: record.remark || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingRecord(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowForm(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    const payload = {
      orderId: Number(formData.orderId),
      type: formData.type,
      amount: Number(formData.amount),
      currency: formData.currency,
      target: formData.target.trim(),
      partnerId: formData.type === 'payment' && formData.partnerId ? Number(formData.partnerId) : undefined,
      status: formData.status,
      recordCategory: formData.recordCategory,
      remark: formData.remark.trim(),
    };

    try {
      if (editingRecord) {
        await apiFetch(`/api/finance/${editingRecord.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/finance', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      closeForm();
      await fetchData();
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, '保存财务记录失败'));
    }
  };

  const deleteRecord = async (record: FinanceListRecord) => {
    if (!window.confirm(`确定删除这条${record.type === 'receipt' ? '收款' : '付款'}记录吗？`)) {
      return;
    }

    try {
      await apiFetch(`/api/finance/${record.id}`, { method: 'DELETE' });
      await fetchData();
    } catch (requestError) {
      setError(getErrorMessage(requestError, '删除财务记录失败'));
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">财务流水</h2>
            <p className="mt-1 text-sm text-slate-500">这里的付款分类会同步支撑订单详情页的运费、货款等汇总。</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索订单、客户、对象或分类"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-72"
              />
            </div>
            <button
              onClick={showForm ? closeForm : openCreateForm}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              {showForm ? '取消录入' : '登记流水'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="已完成收款 USD" value={formatTotal(totals.receipt.USD, 'USD')} />
          <StatCard title="已完成收款 CNY" value={formatTotal(totals.receipt.CNY, 'CNY')} />
          <StatCard title="已完成付款 USD" value={formatTotal(totals.payment.USD, 'USD')} />
          <StatCard title="已完成付款 CNY" value={formatTotal(totals.payment.CNY, 'CNY')} />
          <StatCard title="运费付款 CNY" value={formatTotal(totals.freight.CNY, 'CNY')} />
          <StatCard title="待核销条目" value={`${totals.pending} 笔`} />
        </div>

        {showForm ? (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 text-sm font-semibold text-slate-700">
              {editingRecord ? `编辑流水：${editingRecord.order_display_id || `#${editingRecord.id}`}` : '登记财务流水'}
            </div>
            {formError ? (
              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            ) : null}
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="关联订单 *">
                <select
                  required
                  value={formData.orderId}
                  onChange={(event) => setFormData({ ...formData, orderId: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">请选择订单</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.display_id} · {order.customer_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="流水类型 *">
                <select
                  value={formData.type}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      type: event.target.value as FinanceFormState['type'],
                      currency: event.target.value === 'receipt' ? 'USD' : 'CNY',
                      recordCategory: event.target.value === 'receipt' ? 'deposit' : 'goods',
                      partnerId: event.target.value === 'receipt' ? '' : formData.partnerId,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="receipt">收款</option>
                  <option value="payment">付款</option>
                </select>
              </Field>
              <Field label="金额 *">
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(event) => setFormData({ ...formData, amount: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="币种 *">
                <select
                  value={formData.currency}
                  onChange={(event) => setFormData({ ...formData, currency: event.target.value as FinanceFormState['currency'] })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                </select>
              </Field>
              <Field label="状态 *">
                <select
                  value={formData.status}
                  onChange={(event) => setFormData({ ...formData, status: event.target.value as FinanceFormState['status'] })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">待核销</option>
                  <option value="completed">已完成</option>
                </select>
              </Field>
              <Field label="款项类型">
                <select
                  value={formData.recordCategory}
                  onChange={(event) => setFormData({ ...formData, recordCategory: event.target.value as FinanceFormState['recordCategory'] })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {formData.type === 'receipt' ? (
                    <>
                      <option value="deposit">首付款</option>
                      <option value="balance">尾款</option>
                      <option value="other">其他</option>
                    </>
                  ) : (
                    <>
                      <option value="goods">货款</option>
                      <option value="freight">运费</option>
                      <option value="customs">报关费</option>
                      <option value="other">其他</option>
                    </>
                  )}
                </select>
              </Field>
              {formData.type === 'payment' ? (
                <Field label="收款方">
                  <select
                    value={formData.partnerId}
                    onChange={(event) => setFormData({ ...formData, partnerId: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择伙伴</option>
                    {partners.map((partner) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="对象名称">
                  <input
                    value={formData.target}
                    onChange={(event) => setFormData({ ...formData, target: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
              )}
              <Field label="备注" className="md:col-span-2 xl:col-span-3">
                <input
                  value={formData.remark}
                  onChange={(event) => setFormData({ ...formData, remark: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <div className="md:col-span-2 xl:col-span-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black"
                >
                  {editingRecord ? '保存修改' : '保存流水'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">正在加载财务数据...</div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-500">当前没有匹配的财务记录。</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">订单 / 客户</th>
                  <th className="px-4 py-4 font-semibold">类型</th>
                  <th className="px-4 py-4 font-semibold">金额</th>
                  <th className="px-4 py-4 font-semibold">分类 / 对象</th>
                  <th className="px-4 py-4 font-semibold">状态</th>
                  <th className="px-4 py-4 font-semibold">创建人</th>
                  <th className="px-4 py-4 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{record.order_display_id || '未关联订单'}</div>
                      <div className="mt-1 text-xs text-slate-500">{record.customer_name || '未命名客户'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          record.type === 'receipt' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {record.type === 'receipt' ? '收款' : '付款'}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{formatTotal(record.amount, record.currency)}</td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-slate-800">{getPaymentCategoryLabel(record.recordCategory || record.payment_category)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {record.type === 'payment' ? record.partner_name || record.target || '未填写收款方' : record.target || '未填写对象'}
                      </div>
                      {record.attachmentCount ? (
                        <div className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          <Paperclip className="mr-1 h-3 w-3" />
                          {record.attachmentCount} 个附件
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          record.status === 'completed' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {record.status === 'completed' ? '已完成' : '待核销'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">{record.createdByName || '系统'}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditForm(record)}
                          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          <Edit className="mr-1.5 h-3.5 w-3.5" />
                          编辑
                        </button>
                        {user?.role === 'admin' ? (
                          <button
                            onClick={() => void deleteRecord(record)}
                            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            删除
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-2 text-sm font-semibold text-slate-700">{label}</div>
      {children}
    </label>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-2 text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}
