import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Plus, Search, Truck } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import type { LogisticsListRecord, OrderOption } from '../types/crm';

type LogisticsFormState = {
  orderId: string;
  segmentType: 'domestic' | 'international';
  trackingNo: string;
  carrier: string;
  packingDetails: string;
  status: 'preparing' | 'shipped' | 'arrived';
  shippingDate: string;
};

const EMPTY_FORM: LogisticsFormState = {
  orderId: '',
  segmentType: 'international',
  trackingNo: '',
  carrier: '',
  packingDetails: '',
  status: 'preparing',
  shippingDate: '',
};

function getLogisticsLabel(status: LogisticsListRecord['status']) {
  switch (status) {
    case 'preparing':
      return '备货中';
    case 'shipped':
      return '运输中';
    case 'arrived':
      return '已到货';
    default:
      return status;
  }
}

export default function LogisticsView() {
  const [records, setRecords] = useState<LogisticsListRecord[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LogisticsListRecord | null>(null);
  const [formData, setFormData] = useState<LogisticsFormState>(EMPTY_FORM);

  const fetchData = async () => {
    setError('');
    try {
      const [logisticsData, orderData] = await Promise.all([
        apiFetch<LogisticsListRecord[]>('/api/logistics'),
        apiFetch<OrderOption[]>('/api/orders'),
      ]);
      setRecords(logisticsData);
      setOrders(orderData);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '读取物流数据失败'));
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
        record.carrier,
        record.tracking_no,
        record.packing_details,
        record.shipping_date || '',
      ].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [records, query]);

  const openCreateForm = () => {
    setEditingRecord(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (record: LogisticsListRecord) => {
    setEditingRecord(record);
    setFormError('');
    setFormData({
      orderId: String(record.order_id),
      segmentType: record.segmentType || 'international',
      trackingNo: record.tracking_no || '',
      carrier: record.carrier,
      packingDetails: record.packing_details,
      status: record.status,
      shippingDate: record.shipping_date || '',
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
      segmentType: formData.segmentType,
      trackingNo: formData.trackingNo.trim(),
      carrier: formData.carrier.trim(),
      packingDetails: formData.packingDetails.trim(),
      status: formData.status,
      shippingDate: formData.shippingDate,
    };

    try {
      if (editingRecord) {
        await apiFetch(`/api/logistics/${editingRecord.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/logistics', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      closeForm();
      await fetchData();
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, '保存物流记录失败'));
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">物流与打包</h2>
            <p className="mt-1 text-sm text-slate-500">发货日期会同步支撑订单列表中的“发货月份”筛选。</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索订单、客户、承运商或日期"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-72"
              />
            </div>
            <button
              onClick={showForm ? closeForm : openCreateForm}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              {showForm ? '取消录入' : '新增物流记录'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        ) : null}

        {showForm ? (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 text-sm font-semibold text-slate-700">
              {editingRecord ? `编辑物流记录：${editingRecord.order_display_id || `#${editingRecord.id}`}` : '登记物流记录'}
            </div>
            {formError ? (
              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            ) : null}
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
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
              <Field label="物流段">
                <select
                  value={formData.segmentType}
                  onChange={(event) => setFormData({ ...formData, segmentType: event.target.value as LogisticsFormState['segmentType'] })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="domestic">国内物流</option>
                  <option value="international">国际物流</option>
                </select>
              </Field>
              <Field label="承运商 / 物流公司 *">
                <input
                  required
                  value={formData.carrier}
                  onChange={(event) => setFormData({ ...formData, carrier: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="运单号 / 提单号">
                <input
                  value={formData.trackingNo}
                  onChange={(event) => setFormData({ ...formData, trackingNo: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="发货日期">
                <input
                  type="date"
                  value={formData.shippingDate}
                  onChange={(event) => setFormData({ ...formData, shippingDate: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="物流状态 *">
                <select
                  value={formData.status}
                  onChange={(event) => setFormData({ ...formData, status: event.target.value as LogisticsFormState['status'] })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="preparing">备货中</option>
                  <option value="shipped">运输中</option>
                  <option value="arrived">已到货</option>
                </select>
              </Field>
              <Field label="装箱 / 打包明细 *" className="md:col-span-2">
                <textarea
                  required
                  value={formData.packingDetails}
                  onChange={(event) => setFormData({ ...formData, packingDetails: event.target.value })}
                  className="h-28 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
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
                  {editingRecord ? '保存修改' : '保存物流记录'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">正在加载物流数据...</div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Truck className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">当前没有匹配的物流记录。</p>
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRecords.map((record) => (
            <article key={record.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="font-semibold text-slate-900">{record.order_display_id || '未关联订单'}</div>
                  <div className="mt-1 text-xs text-slate-500">{record.customer_name || '未命名客户'}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    record.status === 'arrived'
                      ? 'bg-green-50 text-green-700'
                      : record.status === 'shipped'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {getLogisticsLabel(record.status)}
                </span>
              </div>

              <div className="space-y-3 text-sm text-slate-700">
                <InfoRow label="物流段" value={record.segmentType === 'domestic' ? '国内物流' : '国际物流'} />
                <InfoRow label="承运商" value={record.carrier} />
                <InfoRow label="运单号" value={record.tracking_no || '暂无'} mono />
                <InfoRow label="发货日期" value={record.shipping_date || '未填写'} />
                <InfoRow label="创建人" value={record.createdByName || '系统'} />
                <InfoRow
                  label={record.segmentType === 'domestic' ? '包装数据' : '国际节点'}
                  value={
                    record.segmentType === 'domestic'
                      ? `件数 ${record.packageCount ?? '-'} / CBM ${record.volumeCbm ?? '-'} / KG ${record.grossWeightKg ?? '-'}`
                      : `条款 ${record.incoterm || '-'} / 方式 ${record.transportMode || '-'} / 航次 ${record.vesselVoyage || '-'}`
                  }
                />
                <InfoRow label="装箱明细" value={record.packing_details} />
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-400">{new Date(record.created_at).toLocaleString()}</div>
                <button
                  onClick={() => openEditForm(record)}
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <Edit className="mr-1.5 h-3.5 w-3.5" />
                  编辑
                </button>
              </div>
            </article>
          ))}
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

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
