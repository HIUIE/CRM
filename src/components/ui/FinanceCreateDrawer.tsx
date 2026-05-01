import React, { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '../../lib/api';
import { Drawer } from './Drawer';
import { Combobox } from './Combobox';
import Field from './Field';
import type { FinanceCategory, OrderOption, PartnerOption } from '../../types/crm';

interface FinanceCreateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialOrderId?: number;
  initialOrderDisplayId?: string;
  initialCustomerId?: number;
  initialCustomerName?: string;
}

type FinanceFormState = {
  orderId: string;
  type: 'receipt' | 'payment';
  amount: string;
  currency: string;
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

export function FinanceCreateDrawer({ isOpen, onClose, onSuccess, initialOrderId, initialOrderDisplayId, initialCustomerId, initialCustomerName }: FinanceCreateDrawerProps) {
  const [formData, setFormData] = useState<FinanceFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...EMPTY_FORM,
        orderId: initialOrderId ? String(initialOrderId) : '',
        target: initialCustomerName || '',
      });
    }
  }, [isOpen, initialOrderId, initialCustomerName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    const payload = { 
      ...formData, 
      orderId: Number(formData.orderId), 
      amount: Number(formData.amount), 
      partnerId: formData.partnerId ? Number(formData.partnerId) : null 
    };
    try {
      await apiFetch('/api/finance', { method: 'POST', body: JSON.stringify(payload) });
      onSuccess();
      onClose();
    } catch (err) {
      setFormError(getErrorMessage(err, '保存财务记录失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="登记收支流水"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all">取消</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary shadow-md active:scale-95">
            {saving ? '正在同步...' : '保存流水记录'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-600">{formError}</div>}
        
        <div className="space-y-6">
          <Field label="关联订单 *">
            <Combobox
              value={formData.orderId}
              onChange={val => setFormData({ ...formData, orderId: String(val) })}
              onSearch={async (q) => {
                const data = await apiFetch<OrderOption[]>(`/api/orders?q=${encodeURIComponent(q)}${initialCustomerId ? `&customerId=${initialCustomerId}` : ''}`);
                return data.slice(0, 20).map(o => ({ value: o.id, label: o.display_id, subLabel: o.customer_name }));
              }}
              disabled={!!initialOrderId}
              placeholder="搜索并选择订单..."
            />
            {initialOrderDisplayId && (
              <p className="mt-1 text-[10px] font-bold text-slate-400 tracking-tight px-1">已锁定订单：{initialOrderDisplayId}</p>
            )}
          </Field>

          <Field label="流水类型 *">
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as 'receipt' | 'payment' })} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm font-bold outline-none appearance-none cursor-pointer">
              <option value="receipt">收款 (In)</option>
              <option value="payment">付款 (Out)</option>
            </select>
          </Field>

          <div className="flex gap-4">
              <div className="w-32">
                <Field label="币种">
                  <select value={formData.currency} onChange={e=>setFormData({...formData, currency:e.target.value})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm font-bold outline-none appearance-none cursor-pointer">
                    <option value="USD">USD</option>
                    <option value="CNY">CNY</option>
                    <option value="EUR">EUR</option>
                  </select>
                </Field>
              </div>
              <div className="flex-1">
                <Field label="金额 *">
                  <input required type="number" step="0.01" value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm font-bold text-primary-navy dark:text-white outline-none data-field" />
                </Field>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="款项用途">
              <select value={formData.recordCategory} onChange={e=>setFormData({...formData, recordCategory:e.target.value as FinanceCategory})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm font-bold outline-none appearance-none cursor-pointer">
                <option value="deposit">首付款 / 定金</option>
                <option value="balance">尾款</option>
                <option value="goods">货款</option>
                <option value="freight">运费</option>
                <option value="customs">报关费</option>
                <option value="other">其他</option>
              </select>
            </Field>
            <Field label="核销状态">
              <select value={formData.status} onChange={e=>setFormData({...formData, status:e.target.value as 'pending' | 'completed'})} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm font-bold outline-none appearance-none cursor-pointer">
                <option value="pending">待核销</option>
                <option value="completed">已完成</option>
              </select>
            </Field>
          </div>

          <Field label="对方/合作伙伴">
            <Combobox
              value={formData.partnerId}
              onChange={val => setFormData({ ...formData, partnerId: String(val) })}
              onSearch={async (q) => {
                const data = await apiFetch<PartnerOption[]>(`/api/partners?q=${encodeURIComponent(q)}`);
                return data.slice(0, 20).map(p => ({ value: p.id, label: p.name, subLabel: p.partner_type }));
              }}
              placeholder="搜索合作伙伴..."
            />
          </Field>

          <Field label="备注">
            <textarea value={formData.remark} onChange={e=>setFormData({...formData, remark:e.target.value})} placeholder="附言或打款参考号..." className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 text-sm font-medium outline-none min-h-[80px]" rows={2} />
          </Field>
        </div>
      </form>
    </Drawer>
  );
}

