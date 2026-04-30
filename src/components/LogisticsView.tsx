import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Truck } from 'lucide-react';
import Field from './ui/Field';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import Chip from './ui/Chip';
import Toast from './ui/Toast';
import { Pagination } from './ui/Pagination';
import TimeRangeFilter from './ui/TimeRangeFilter';
import { usePagination } from '../hooks/usePagination';
import { Drawer } from './ui/Drawer';
import { Combobox } from './ui/Combobox';
import { getRangeDates } from '../lib/date';
import type { StandardTimeRange } from '../lib/date';
import { withTransition } from '../lib/transition';
import type { OrderOption } from '../types/crm';

interface LogisticsSummary {
  id: number;
  order_id: number;
  order_display_id: string;
  customer_name: string;
  tracking_no: string;
  carrier: string;
  status: 'preparing' | 'shipped' | 'arrived';
  shipping_date: string;
  segment_type: 'domestic' | 'international';
  recipient_address?: string;
  package_count?: number;
}

type LogisticsFormState = {
  orderId: string;
  carrier: string;
  trackingNo: string;
  shippingDate: string;
  packageCount: string;
  segmentType: 'domestic' | 'international';
  recipientAddress: string;
};

const EMPTY_FORM: LogisticsFormState = {
  orderId: '',
  carrier: '',
  trackingNo: '',
  shippingDate: '',
  packageCount: '',
  segmentType: 'international',
  recipientAddress: '',
};

function getStatusLabel(status: LogisticsSummary['status']) {
  switch (status) {
    case 'preparing': return '待起运';
    case 'shipped': return '在途运输';
    case 'arrived': return '已妥投';
    default: return status;
  }
}

export default function LogisticsView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<LogisticsFormState>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<LogisticsFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');

  const isFormDirty = JSON.stringify(formData) !== JSON.stringify(initialForm);

  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const timeRange = searchParams.get('timeRange') || 'all';

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);

    if (key === 'timeRange') {
      const dates = getRangeDates(val as StandardTimeRange);
      if (dates.start) next.set('start_date', dates.start); else next.delete('start_date');
      if (dates.end) next.set('end_date', dates.end); else next.delete('end_date');
    }

    setSearchParams(next);
  };

  const { data: records = [], isLoading: recordsLoading, error: recordsError } = useQuery<LogisticsSummary[]>({
    queryKey: ['logistics', searchParams.toString()],
    queryFn: () => apiFetch<LogisticsSummary[]>(`/api/logistics?${searchParams.toString()}`),
  });
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useQuery<OrderOption[]>({
    queryKey: ['orders'],
    queryFn: () => apiFetch<OrderOption[]>('/api/orders'),
  });
  const loading = recordsLoading || ordersLoading;
  const error = recordsError ? getErrorMessage(recordsError, '读取物流列表失败') : ordersError ? getErrorMessage(ordersError, '读取物流列表失败') : '';

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      openCreateForm();
      updateParam('create', '');
    }
  }, [searchParams]);

  const filteredRecords = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return records.filter((r) =>
      [r.order_display_id, r.customer_name, r.tracking_no, r.carrier, r.recipient_address || '']
        .some((val) => val.toLowerCase().includes(keyword))
    );
  }, [records, q]);

  const {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    currentItems,
    setCurrentPage,
    setPageSize,
  } = usePagination(filteredRecords);

  const openCreateForm = () => {
    setFormData(EMPTY_FORM);
    setInitialForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setFormData(EMPTY_FORM);
    setInitialForm(EMPTY_FORM);
    setFormError('');
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const payload = {
      orderId: Number(formData.orderId),
      carrier: formData.carrier.trim(),
      trackingNo: formData.trackingNo.trim(),
      shippingDate: formData.shippingDate || null,
      packageCount: Number(formData.packageCount) || null,
      segmentType: formData.segmentType,
      recipientAddress: formData.recipientAddress.trim(),
    };
    try {
      await apiFetch('/api/logistics', { method: 'POST', body: JSON.stringify(payload) });
      setToast('创建物流成功');
      setTimeout(() => setToast(''), 3000);
      closeForm();
      queryClient.invalidateQueries({ queryKey: ['logistics'] });
    } catch (err) {
      setFormError(getErrorMessage(err, '创建物流失败'));
    }
  };

  // Automatically find recipient address when order is selected
  const selectedOrder = useMemo(() => {
    if (!formData.orderId) return null;
    return orders.find(o => String(o.id) === formData.orderId);
  }, [formData.orderId, orders]);

  return (
    <div className="flex flex-col space-y-4 animate-page-in">
      <section className="shrink-0 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 shadow-sm transition-colors">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={q}
              onChange={e => updateParam('q', e.target.value)}
              placeholder="搜索单号、承运商、客户名称..."
              className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 py-2.5 pl-10 pr-4 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
            />
          </div>
          <div className="relative">
             <select
               value={status}
               onChange={e => updateParam('status', e.target.value)}
               className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 px-4 py-2.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none appearance-none cursor-pointer text-primary-navy dark:text-white"
             >
               <option value="">全部状态</option>
               <option value="preparing">待起运</option>
               <option value="shipped">运输中</option>
               <option value="arrived">已妥投</option>
             </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <TimeRangeFilter value={timeRange} onChange={(key) => updateParam('timeRange', key)} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm transition-colors flex flex-col">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 p-8 text-center animate-pulse">正在同步物流状态...</div>
        ) : (
          <div className="flex flex-col">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-navy-950 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                  <tr>
                    <th className="px-4 py-4 text-left">关联订单</th>
                    <th className="px-4 py-4 text-left">承运商 / 单号</th>
                    <th className="px-4 py-4 text-left">目的地</th>
                    <th className="px-4 py-4 text-center">发货日期 / 箱数</th>
                    <th className="px-4 py-4 text-center">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-900">
                  {currentItems.length ? currentItems.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => {
                        withTransition(() => navigate(`/orders/${r.order_display_id}`));
                      }}
                      className="group align-middle hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-4 text-left">
                        <div className="font-bold text-primary-navy dark:text-white uppercase data-field">{r.order_display_id || '—'}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-1 max-w-[150px] truncate">{r.customer_name || '—'}</div>
                      </td>
                      <td className="px-4 py-4 text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <Truck size={14} className="text-slate-400 dark:text-slate-500" />
                          <span className="font-bold text-primary-navy dark:text-white uppercase">{r.carrier || '—'}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 data-field">{r.tracking_no || '—'}</div>
                      </td>
                      <td className="px-4 py-4 text-left">
                        <div className="flex items-center gap-2 mb-1">
                           <Chip tone={r.segment_type === 'domestic' ? 'neutral' : 'info'}>
                             {r.segment_type === 'domestic' ? '国内段' : '国际段'}
                           </Chip>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px]" title={r.recipient_address}>
                          {r.recipient_address || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="text-xs font-bold text-primary-navy dark:text-white data-field mb-1">{r.shipping_date || '待定'}</div>
                        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{r.package_count || 0} 箱</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                         <div className="flex items-center justify-center gap-1.5 text-tertiary-sage dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                           <div className={`h-1.5 w-1.5 rounded-full ${r.status === 'arrived' ? 'bg-success' : r.status === 'shipped' ? 'bg-tertiary-sage dark:bg-emerald-400 animate-pulse' : 'bg-slate-300 dark:bg-navy-700'}`} />
                           {getStatusLabel(r.status)}
                         </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400 font-medium uppercase tracking-widest">
                        未找到匹配的物流记录
                      </td>
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
        title="创建物流单"
        isDirty={isFormDirty}
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeForm} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">取消</button>
            <button onClick={handleSubmit} type="submit" className="btn-primary shadow-md">保存物流</button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && <div className="rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{formError}</div>}
          <div className="space-y-6">
            <Field label="关联订单 *">
              <Combobox
                value={formData.orderId}
                onChange={val => setFormData({ ...formData, orderId: String(val) })}
                onSearch={async (q) => {
                  const data = await apiFetch<OrderOption[]>(`/api/orders?q=${encodeURIComponent(q)}`);
                  return data.slice(0, 20).map(o => ({ value: o.id, label: o.display_id, subLabel: o.customer_name }));
                }}
                placeholder="搜索并选择订单..."
              />
            </Field>

            {selectedOrder && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">自动带出：收货方 / 地址</div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {selectedOrder.customer_name}<br/>
                  <span className="text-xs">{selectedOrder.customer_country}</span>
                </div>
              </div>
            )}

            <Field label="段落类型 *">
              <select value={formData.segmentType} onChange={e=>setFormData({...formData, segmentType:e.target.value as 'domestic' | 'international'})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none appearance-none cursor-pointer text-primary-navy dark:text-white">
                <option value="international">国际段</option>
                <option value="domestic">国内段</option>
              </select>
            </Field>

            <Field label="承运商 / 快递公司 *">
              <input required value={formData.carrier} onChange={e=>setFormData({...formData, carrier:e.target.value})} placeholder="例如：DHL, FedEx..." className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
            </Field>
            <Field label="追踪单号 *">
              <input required value={formData.trackingNo} onChange={e=>setFormData({...formData, trackingNo:e.target.value})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white data-field font-bold" />
            </Field>
            
            <div className="grid grid-cols-2 gap-4">
              <Field label="发货日期">
                <input type="date" value={formData.shippingDate} onChange={e=>setFormData({...formData, shippingDate:e.target.value})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" />
              </Field>
              <Field label="包裹箱数">
                <input type="number" min="1" value={formData.packageCount} onChange={e=>setFormData({...formData, packageCount:e.target.value})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white data-field" />
              </Field>
            </div>

            <Field label="详细目的地址">
               <textarea value={formData.recipientAddress} onChange={e=>setFormData({...formData, recipientAddress:e.target.value})} placeholder="选填，补充详细收货地址..." className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white min-h-[80px]" rows={2} />
            </Field>
          </div>
          <button type="submit" className="hidden">Submit</button>
        </form>
      </Drawer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

