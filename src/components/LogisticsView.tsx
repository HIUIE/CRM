import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Plus, Search, Truck } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { Chip } from '../features/order-detail/components';
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
    case 'preparing': return '备货中';
    case 'shipped': return '运输中';
    case 'arrived': return '已到货';
    default: return status;
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
    return records.filter((record) =>
      [record.order_display_id || '', record.customer_name || '', record.carrier, record.tracking_no, record.packing_details]
        .some((value) => value.toLowerCase().includes(keyword)),
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
    const payload = { ...formData, orderId: Number(formData.orderId) };
    try {
      if (editingRecord) await apiFetch(`/api/logistics/${editingRecord.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await apiFetch('/api/logistics', { method: 'POST', body: JSON.stringify(payload) });
      closeForm();
      await fetchData();
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, '保存失败'));
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索订单、客户、承运商或单号..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-primary-navy transition-all outline-none"
            />
          </div>
          <button
            onClick={showForm ? closeForm : openCreateForm}
            className="inline-flex items-center justify-center rounded-2xl bg-primary-navy px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-800 shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" />
            {showForm ? '取消' : '录入物流'}
          </button>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

        {showForm ? (
          <form onSubmit={handleSubmit} className="mt-6 rounded-3xl border border-slate-100 bg-slate-50 p-6">
            <div className="mb-6 text-[11px] font-bold text-primary-navy uppercase tracking-widest">{editingRecord ? '编辑物流记录' : '新增物流记录'}</div>
            {formError ? <div className="mb-4 text-sm text-error bg-error/5 p-3 rounded-lg border border-error/10">{formError}</div> : null}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Field label="关联订单 *">
                <select required value={formData.orderId} onChange={(e) => setFormData({ ...formData, orderId: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy outline-none appearance-none">
                  <option value="">选择订单...</option>
                  {orders.map(o => <option key={o.id} value={o.id}>{o.display_id} · {o.customer_name}</option>)}
                </select>
              </Field>
              <Field label="物流段"><select value={formData.segmentType} onChange={e=>setFormData({...formData, segmentType:e.target.value as any})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy outline-none appearance-none"><option value="domestic">国内物流</option><option value="international">国际物流</option></select></Field>
              <Field label="承运商 *"><input required value={formData.carrier} onChange={e=>setFormData({...formData, carrier:e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy outline-none" /></Field>
              <Field label="运单号"><input value={formData.trackingNo} onChange={e=>setFormData({...formData, trackingNo:e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy outline-none" /></Field>
              <Field label="发货日期"><input type="date" value={formData.shippingDate} onChange={e=>setFormData({...formData, shippingDate:e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy outline-none" /></Field>
              <Field label="物流状态 *"><select value={formData.status} onChange={e=>setFormData({...formData, status:e.target.value as any})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy outline-none appearance-none"><option value="preparing">备货中</option><option value="shipped">运输中</option><option value="arrived">已到货</option></select></Field>
              <div className="md:col-span-2 lg:col-span-3">
                 <Field label="装箱明细"><textarea required value={formData.packingDetails} onChange={e=>setFormData({...formData, packingDetails:e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary-navy outline-none" rows={3} /></Field>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">取消</button>
              <button type="submit" className="rounded-xl bg-primary-navy px-10 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-all shadow-md">保存记录</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? <div className="p-8 text-sm text-slate-400">读取数据中...</div> : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 py-4">订单 / 客户</th>
                    <th className="px-4 py-4">物流段 / 状态</th>
                    <th className="px-4 py-4">承运商 / 单号</th>
                    <th className="px-4 py-4">发货日期</th>
                    <th className="px-4 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRecords.length ? filteredRecords.map(r => (
                    <tr key={r.id} className="group align-middle hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4">
                         <div className="font-bold text-primary-navy uppercase">{r.order_display_id || 'MISC'}</div>
                         <div className="text-[11px] text-slate-400 mt-1 font-bold uppercase">{r.customer_name}</div>
                      </td>
                      <td className="px-4 py-4">
                         <div className="flex items-center gap-2 mb-1"><Chip tone={r.segmentType === 'domestic' ? 'neutral' : 'info'}>{r.segmentType === 'domestic' ? '国内' : '国际'}</Chip></div>
                         <div className="text-[11px] font-bold uppercase text-primary-navy">{getLogisticsLabel(r.status)}</div>
                      </td>
                      <td className="px-4 py-4">
                         <div className="font-bold text-primary-navy uppercase tracking-tight">{r.carrier}</div>
                         <div className="text-[11px] text-slate-400 mt-1 font-mono uppercase">{r.tracking_no || 'TBD'}</div>
                      </td>
                      <td className="px-4 py-4 font-bold text-primary-navy data-field">{formatDateOnly(r.shipping_date || '')}</td>
                      <td className="px-4 py-4">
                         <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={()=>openEditForm(r)} className="p-2 text-secondary-slate hover:bg-white hover:text-primary-navy hover:border-slate-300 rounded-lg border border-transparent transition-all"><Edit size={14} /></button>
                         </div>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400 font-medium">暂无物流记录。</td></tr>}
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

function formatDateOnly(v: string) {
  if (!v) return '-';
  return v.split(' ')[0];
}