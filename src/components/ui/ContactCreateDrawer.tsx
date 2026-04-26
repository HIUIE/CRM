import React, { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '../../lib/api';
import { Drawer } from './Drawer';
import { Users, Mail, Phone, Briefcase } from 'lucide-react';
import Field from './Field';

interface ContactCreateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerId: number;
}

type ContactForm = {
  name: string;
  title: string;
  contact: string;
  remark: string;
};

const EMPTY_FORM: ContactForm = {
  name: '',
  title: '',
  contact: '',
  remark: '',
};

export function ContactCreateDrawer({ isOpen, onClose, onSuccess, customerId }: ContactCreateDrawerProps) {
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('请输入姓名');
    
    setSaving(true);
    setError('');
    try {
      // Assuming a generic contacts POST or customer-specific one
      await apiFetch(`/api/customers/${customerId}/contacts`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, '添加联系人失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="新增关键联系人"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all uppercase">取消</button>
          <button onClick={handleSubmit} disabled={saving} className="rounded-xl bg-primary-navy dark:bg-tertiary-sage px-10 py-2.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-30 uppercase">
            {saving ? '同步中...' : '确认添加'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg border border-red-100 text-xs font-bold">{error}</div>}
        
        <div className="space-y-6">
          <Field label="姓名 *">
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 pl-10 pr-4 py-3 text-sm font-bold text-primary-navy dark:text-white outline-none focus:border-primary-navy" />
            </div>
          </Field>

          <Field label="职位 / 角色">
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="例如：采购经理、总经理..." className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 pl-10 pr-4 py-3 text-sm font-bold text-primary-navy dark:text-white outline-none" />
            </div>
          </Field>

          <Field label="联系方式 (电话/邮箱)">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 pl-10 pr-4 py-3 text-sm font-bold text-primary-navy dark:text-white outline-none" />
            </div>
          </Field>

          <Field label="备注说明">
             <textarea value={form.remark} onChange={e => setForm({...form, remark: e.target.value})} placeholder="个人喜好、决策影响力等..." className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 text-sm font-medium outline-none min-h-[100px]" />
          </Field>
        </div>
      </form>
    </Drawer>
  );
}

