import React, { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '../../lib/api';
import { Drawer } from './Drawer';
import { Combobox } from './Combobox';
import { Hash } from 'lucide-react';
import Field from './Field';
import { useNavigate } from 'react-router-dom';
import type { CustomerListItem } from '../../types/crm';

interface OrderCreateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (displayId: string) => void;
  initialCustomerId?: number;
  initialCustomerName?: string;
}

type OrderFormState = {
  displayId: string;
  customerId: string;
  productSummary: string;
  details: string;
  totalAmount: string;
};

const EMPTY_FORM: OrderFormState = {
  displayId: '',
  customerId: '',
  productSummary: '',
  details: '',
  totalAmount: '0',
};

export function OrderCreateDrawer({ isOpen, onClose, onSuccess, initialCustomerId, initialCustomerName }: OrderCreateDrawerProps) {
  const [formData, setFormData] = useState<OrderFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void loadNextId();
    }
  }, [isOpen]);

  const loadNextId = async () => {
    try {
      const { nextId } = await apiFetch<{ nextId: string }>('/api/orders/next-display-id');
      setFormData({
        ...EMPTY_FORM,
        displayId: nextId,
        customerId: initialCustomerId ? String(initialCustomerId) : '',
      });
    } catch (err) {
      setFormData({
        ...EMPTY_FORM,
        customerId: initialCustomerId ? String(initialCustomerId) : '',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    const payload = { 
      ...formData, 
      customerId: Number(formData.customerId), 
      totalAmount: Number(formData.totalAmount) 
    };
    try {
      const created = await apiFetch<{ display_id: string }>('/api/orders', { 
        method: 'POST', 
        body: JSON.stringify(payload) 
      });
      onSuccess(created.display_id);
      onClose();
    } catch (err) {
      setFormError(getErrorMessage(err, '创建订单失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="创建新订单"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all uppercase">取消</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary shadow-md active:scale-95">
            {saving ? '正在同步...' : '确认并进入详情'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-600">{formError}</div>}
        
        <div className="space-y-6">
          <Field label="订单单号 *">
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input 
                required 
                value={formData.displayId} 
                onChange={e => setFormData({...formData, displayId: e.target.value.trim()})} 
                className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 pl-9 pr-4 py-3 text-sm font-bold text-primary-navy dark:text-white outline-none"
              />
            </div>
          </Field>

          <Field label="关联客户 *">
            <Combobox
              value={formData.customerId}
              onChange={val => setFormData({ ...formData, customerId: String(val) })}
              onSearch={async (q) => {
                const data = await apiFetch<CustomerListItem[]>(`/api/customers?q=${encodeURIComponent(q)}`);
                return data.slice(0, 20).map(c => ({ value: c.id, label: c.name, subLabel: c.country }));
              }}
              disabled={!!initialCustomerId}
              placeholder="搜索并选择客户..."
            />
            {initialCustomerId && initialCustomerName && (
              <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">已锁定客户：{initialCustomerName}</p>
            )}
          </Field>

          <Field label="订单总额 (USD) *">
            <input 
              required 
              type="number" 
              step="0.01" 
              value={formData.totalAmount} 
              onChange={e => setFormData({...formData, totalAmount: e.target.value})} 
              className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm font-bold text-primary-navy dark:text-white outline-none" 
            />
          </Field>

          <Field label="产品摘要 *">
            <input 
              required 
              value={formData.productSummary} 
              onChange={e => setFormData({...formData, productSummary: e.target.value})} 
              placeholder="例如：太阳能板 A-Type 500pcs..." 
              className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm font-bold text-primary-navy dark:text-white outline-none" 
            />
          </Field>

          <Field label="备注">
             <textarea 
               value={formData.details}
               onChange={e => setFormData({...formData, details: e.target.value})}
               className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 text-sm font-medium outline-none min-h-[100px]"
             />
          </Field>
        </div>
      </form>
    </Drawer>
  );
}

