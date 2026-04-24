import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Plus, Search } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import type { CustomerListItem, OrderSummary } from '../types/crm';

type OrderFormState = {
  customerId: string;
  productSummary: string;
  details: string;
  totalAmount: string;
};

const EMPTY_FORM: OrderFormState = {
  customerId: '',
  productSummary: '',
  details: '',
  totalAmount: '0',
};

function getOrderStatusMeta(status: string) {
  switch (status) {
    case 'draft':
      return { label: '草稿', className: 'bg-slate-100 text-slate-700' };
    case 'production':
      return { label: '生产中', className: 'bg-amber-50 text-amber-700' };
    case 'customs':
      return { label: '报关中', className: 'bg-orange-50 text-orange-700' };
    case 'shipping':
      return { label: '发货中', className: 'bg-sky-50 text-sky-700' };
    case 'completed':
      return { label: '已完成', className: 'bg-emerald-50 text-emerald-700' };
    default:
      return { label: status, className: 'bg-slate-100 text-slate-700' };
  }
}

function getLogisticsLabel(status?: string) {
  switch (status) {
    case 'preparing':
      return '备货中';
    case 'shipped':
      return '运输中';
    case 'arrived':
      return '已到货';
    default:
      return '未登记';
  }
}

export default function OrdersView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderSummary | null>(null);
  const [formData, setFormData] = useState<OrderFormState>(EMPTY_FORM);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);

  const customerFilter = searchParams.get('customerId') || '';

  // Filter Echo: If customerId is in URL, fill the search box with customer name
  useEffect(() => {
    if (customerFilter && customers.length > 0) {
      const customer = customers.find(c => String(c.id) === customerFilter);
      if (customer && !q) {
        updateFilter('q', customer.name);
      }
    }
  }, [customerFilter, customers]);

  const createMode = searchParams.get('create') === '1';
  const q = searchParams.get('q') || '';
  const product = searchParams.get('product') || '';
  const country = searchParams.get('country') || '';
  const status = searchParams.get('status') || '';
  const orderMonth = searchParams.get('orderMonth') || '';
  const shippingMonth = searchParams.get('shippingMonth') || '';
  const draftFromAi = (
    location.state as {
      orderDraft?: { customerName?: string; details?: string; totalAmount?: number; productSummary?: string };
    } | null
  )?.orderDraft;

  useEffect(() => {
    let mounted = true;

    const loadCustomers = async () => {
      try {
        const data = await apiFetch<CustomerListItem[]>('/api/customers');
        if (mounted) {
          setCustomers(data);
        }
      } catch (_error) {
        if (mounted) {
          setCustomers([]);
        }
      }
    };

    void loadCustomers();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const params = new URLSearchParams();
    if (q) {
      params.set('q', q);
    }
    if (product) {
      params.set('product', product);
    }
    if (country) {
      params.set('country', country);
    }
    if (status) {
      params.set('status', status);
    }
    if (orderMonth) {
      params.set('orderMonth', orderMonth);
    }
    if (shippingMonth) {
      params.set('shippingMonth', shippingMonth);
    }
    if (customerFilter) {
      params.set('customerId', customerFilter);
    }

    const fetchOrders = async () => {
      setLoading(true);
      setError('');

      try {
        const url = params.toString() ? `/api/orders?${params.toString()}` : '/api/orders';
        const data = await apiFetch<OrderSummary[]>(url);
        if (mounted) {
          setOrders(data);
        }
      } catch (requestError) {
        if (mounted) {
          setError(getErrorMessage(requestError, '读取订单数据失败'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void fetchOrders();
    return () => {
      mounted = false;
    };
  }, [q, product, country, status, orderMonth, shippingMonth, customerFilter]);

  useEffect(() => {
    if (!createMode) {
      return;
    }

    setEditingOrder(null);
    setShowForm(true);
    setFormError('');

    if (draftFromAi) {
      const matchedCustomer = customers.find((customerItem) => customerItem.name === draftFromAi.customerName);
      const fallbackSummary = draftFromAi.productSummary || draftFromAi.details?.split('\n')[0] || '';
      setFormData({
        customerId: matchedCustomer ? String(matchedCustomer.id) : '',
        productSummary: fallbackSummary,
        details: draftFromAi.details || '',
        totalAmount: String(draftFromAi.totalAmount ?? 0),
      });
    }
  }, [createMode, draftFromAi, customers]);

  const availableCountries = useMemo(() => {
    return Array.from(new Set(customers.map((customerItem) => customerItem.country).filter(Boolean))).sort();
  }, [customers]);

  const updateFilter = (key: string, value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
    setSearchParams(nextParams);
  };

  const clearCreateMode = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams);
  };

  const openCreateForm = () => {
    setEditingOrder(null);
    setFormError('');
    setFormData(EMPTY_FORM);
    setShowForm(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('create', '1');
    setSearchParams(nextParams);
  };

  const openEditForm = (order: OrderSummary) => {
    setEditingOrder(order);
    setFormError('');
    setFormData({
      customerId: String(order.customer_id),
      productSummary: order.product_summary || '',
      details: '',
      totalAmount: String(order.total_amount ?? 0),
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingOrder(null);
    setFormError('');
    setFormData(EMPTY_FORM);
    setShowForm(false);
    clearCreateMode();
  };

  const refreshOrders = async () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (product) params.set('product', product);
    if (country) params.set('country', country);
    if (status) params.set('status', status);
    if (orderMonth) params.set('orderMonth', orderMonth);
    if (shippingMonth) params.set('shippingMonth', shippingMonth);
    if (customerFilter) params.set('customerId', customerFilter);

    const url = params.toString() ? `/api/orders?${params.toString()}` : '/api/orders';
    const data = await apiFetch<OrderSummary[]>(url);
    setOrders(data);
  };

  const clearCustomerFilter = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('customerId');
    setSearchParams(nextParams);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    const payload = {
      customerId: Number(formData.customerId),
      productSummary: formData.productSummary.trim(),
      details: formData.details.trim(),
      totalAmount: Number(formData.totalAmount),
    };

    try {
      if (editingOrder) {
        await apiFetch(`/api/orders/${editingOrder.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        closeForm();
        await refreshOrders();
      } else {
        const created = await apiFetch<{ id: number; display_id: string }>('/api/orders', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        closeForm();
        await refreshOrders();
        navigate(`/orders/${created.display_id}`);
      }
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, '保存订单失败'));
    }
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  };

  const toggleSelectOrder = (id: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const setQuickMonth = (key: string, monthCount: number) => {
    const d = new Date();
    if (monthCount > 0) {
      d.setMonth(d.getMonth() - monthCount);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    updateFilter(key, `${year}-${month}`);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">订单列表</h2>
            <p className="mt-1 text-sm text-slate-500">先筛选，再进入订单详情工作台处理产品、收付款和发货。</p>
          </div>
          <div className="flex items-center gap-3">
            {selectedOrderIds.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 border border-amber-200 animate-in fade-in zoom-in duration-200">
                已选 {selectedOrderIds.length} 项
                <button 
                  onClick={() => setSelectedOrderIds([])}
                  className="ml-2 text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
                >
                  取消
                </button>
              </div>
            )}
            <button
              onClick={showForm ? closeForm : openCreateForm}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              {showForm ? '取消创建' : '新建订单'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <FilterField label="关键词">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(event) => updateFilter('q', event.target.value)}
                placeholder="订单号 / 客户 / 内容"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </FilterField>
          <FilterField label="产品关键词">
            <input
              value={product}
              onChange={(event) => updateFilter('product', event.target.value)}
              placeholder="产品名 / 规格"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </FilterField>
          <FilterField label="国家">
            <select
              value={country}
              onChange={(event) => updateFilter('country', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部国家</option>
              {availableCountries.map((countryItem) => (
                <option key={countryItem} value={countryItem}>
                  {countryItem}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="订单状态">
            <select
              value={status}
              onChange={(event) => updateFilter('status', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部状态</option>
              <option value="draft">草稿</option>
              <option value="production">生产中</option>
              <option value="customs">报关中</option>
              <option value="shipping">发货中</option>
              <option value="completed">已完成</option>
            </select>
          </FilterField>
          <FilterField label="下单月份">
            <div className="space-y-2">
              <input
                type="month"
                value={orderMonth}
                onChange={(event) => updateFilter('orderMonth', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex flex-wrap gap-1.5">
                <QuickFilterBtn label="本月" onClick={() => setQuickMonth('orderMonth', 0)} />
                <QuickFilterBtn label="近3个月" onClick={() => setQuickMonth('orderMonth', 3)} />
                <QuickFilterBtn label="近半年" onClick={() => setQuickMonth('orderMonth', 6)} />
              </div>
            </div>
          </FilterField>
          <FilterField label="发货月份">
            <div className="space-y-2">
              <input
                type="month"
                value={shippingMonth}
                onChange={(event) => updateFilter('shippingMonth', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex flex-wrap gap-1.5">
                <QuickFilterBtn label="本月" onClick={() => setQuickMonth('shippingMonth', 0)} />
                <QuickFilterBtn label="近3个月" onClick={() => setQuickMonth('shippingMonth', 3)} />
                <QuickFilterBtn label="近半年" onClick={() => setQuickMonth('shippingMonth', 6)} />
              </div>
            </div>
          </FilterField>
        </div>

        {customerFilter ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            当前按客户筛选订单
            <button onClick={clearCustomerFilter} className="font-semibold underline underline-offset-2">
              清除筛选
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        ) : null}

        {showForm ? (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 text-sm font-semibold text-slate-700">
              {editingOrder ? `编辑订单：${editingOrder.display_id}` : '新建订单'}
            </div>
            {formError ? (
              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            ) : null}
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <FilterField label="客户 *">
                <select
                  required
                  value={formData.customerId}
                  onChange={(event) => setFormData({ ...formData, customerId: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">请选择客户</option>
                  {customers.map((customerItem) => (
                    <option key={customerItem.id} value={customerItem.id}>
                      {customerItem.name}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="订单金额 (USD) *">
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.totalAmount}
                  onChange={(event) => setFormData({ ...formData, totalAmount: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FilterField>
              <FilterField label="产品摘要" className="md:col-span-2">
                <input
                  value={formData.productSummary}
                  onChange={(event) => setFormData({ ...formData, productSummary: event.target.value })}
                  placeholder="例如：不锈钢保温杯 / 500ml / 礼盒装"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FilterField>
              <FilterField label="订单说明 / 备注" className="md:col-span-2">
                <textarea
                  value={formData.details}
                  onChange={(event) => setFormData({ ...formData, details: event.target.value })}
                  className="h-28 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FilterField>
              <div className="md:col-span-2 flex justify-end gap-3">
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
                  {editingOrder ? '保存修改' : '创建并进入详情'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">正在加载订单列表...</div>
      ) : orders.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-500">当前没有匹配的订单记录。</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedOrderIds.length === orders.length && orders.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-4 font-semibold">订单号</th>
                  <th className="px-4 py-4 font-semibold">客户 / 国家</th>
                  <th className="px-4 py-4 font-semibold">产品摘要</th>
                  <th className="px-4 py-4 font-semibold">金额</th>
                  <th className="px-4 py-4 font-semibold">收款进度</th>
                  <th className="px-4 py-4 font-semibold">发货状态</th>
                  <th className="px-4 py-4 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/orders/${order.display_id}`)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 ${selectedOrderIds.includes(order.id) ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedOrderIds.includes(order.id)}
                        onChange={() => toggleSelectOrder(order.id)}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{order.display_id}</div>
                      <div className="mt-1">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getOrderStatusMeta(order.status).className}`}>
                          {getOrderStatusMeta(order.status).label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-800">{order.customer_name || '未命名客户'}</div>
                      <div className="mt-1 text-xs text-slate-500">{order.customer_country || '未填写国家'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="max-w-[260px] truncate text-sm text-slate-700" title={order.product_summary}>
                        {order.product_summary || '暂无产品摘要'}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-900">
                      USD {order.total_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-semibold text-green-700">
                        已收 USD {order.completed_receipt_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">待核销 {order.pending_finance_count} 笔</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-semibold text-slate-800">{getLogisticsLabel(order.latest_logistics_status)}</div>
                      <div className="mt-1 text-xs text-slate-500">{order.latest_tracking_no || '暂无运单号'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditForm(order);
                        }}
                        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                        编辑
                      </button>
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

function FilterField({
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

function QuickFilterBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
    >
      {label}
    </button>
  );
}
