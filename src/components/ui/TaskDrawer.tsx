import React, { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '../../lib/api';
import { Drawer } from '../ui/Drawer';
import { Combobox } from '../ui/Combobox';
import { MentionTextarea } from './MentionTextarea';
import type { OrderOption, CustomerListItem } from '../../types/crm';

interface UserOption {
  id: number;
  name: string;
}

type TaskFormState = {
  title: string;
  assigneeId: string;
  dueDate: string;
  priority: 'P0' | 'P1' | 'P2';
  entityType?: 'ORDER' | 'CUSTOMER';
  entityId?: string;
  description: string;
};

const EMPTY_TASK: TaskFormState = {
  title: '',
  assigneeId: '',
  dueDate: new Date().toISOString().split('T')[0],
  priority: 'P2',
  description: '',
};

interface TaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entityType?: 'ORDER' | 'CUSTOMER';
  entityId?: string;
  entityName?: string;
}

export function TaskDrawer({ isOpen, onClose, onSuccess, entityType, entityId, entityName }: TaskDrawerProps) {
  const [formData, setFormData] = useState<TaskFormState>(EMPTY_TASK);
  const [initialForm, setInitialForm] = useState<TaskFormState>(EMPTY_TASK);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initial = { 
        ...EMPTY_TASK, 
        entityType, 
        entityId,
        title: entityName ? `跟进：${entityName}` : ''
      };
      setFormData(initial);
      setInitialForm(initial);
      loadUsers();
    }
  }, [isOpen, entityType, entityId, entityName]);

  const loadUsers = async () => {
    try {
      const data = await apiFetch<UserOption[]>('/api/users');
      setUsers(data);
    } catch (e) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(formData) });
      onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, '创建任务失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDirty = JSON.stringify(formData) !== JSON.stringify(initialForm);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="指派协同任务"
      isDirty={isDirty}
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all uppercase">取消</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="rounded-xl bg-primary-navy dark:bg-tertiary-sage px-10 py-2.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-30 uppercase">{isSubmitting ? '指派中...' : '确认指派'}</button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg border border-red-100 text-xs font-bold">{error}</div>}
        
        <div className="space-y-6">
          <Field label="任务标题 *">
            <input 
              required 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="如：准备报关单据、催促付款..."
              className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm font-bold text-primary-navy dark:text-white outline-none focus:border-primary-navy"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
             <Field label="优先级 *">
                <select 
                  value={formData.priority} 
                  onChange={e => setFormData({...formData, priority: e.target.value as any})}
                  className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm font-bold outline-none appearance-none"
                >
                  <option value="P0">P0 - 紧急 (红色)</option>
                  <option value="P1">P1 - 高 (橙色)</option>
                  <option value="P2">P2 - 普通 (蓝色)</option>
                </select>
             </Field>
             <Field label="截止日期 *">
                <input 
                  type="date" 
                  required 
                  value={formData.dueDate}
                  onChange={e => setFormData({...formData, dueDate: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm font-bold outline-none"
                />
             </Field>
          </div>

          <Field label="指派给 *">
            <select 
              required 
              value={formData.assigneeId}
              onChange={e => setFormData({...formData, assigneeId: e.target.value})}
              className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-3 text-sm font-bold outline-none appearance-none"
            >
              <option value="">选择负责人...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>

          <Field label="关联业务 (自动锁定)">
             <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-xl border border-slate-100 dark:border-navy-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{entityType === 'ORDER' ? '关联订单' : '关联客户'}</div>
                <div className="text-[13px] font-extrabold text-primary-navy dark:text-white uppercase">{entityName || '全局任务'}</div>
             </div>
          </Field>

          <Field label="描述与备注">
             <MentionTextarea 
              value={formData.description}
              onChange={val => setFormData({...formData, description: val})}
              placeholder="请输入任务详细说明... 输入 @ 提及同事"
              className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 text-sm font-medium outline-none focus:border-primary-navy min-h-[120px]"
             />
          </Field>
        </div>
      </form>
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{label}</span>
      {children}
    </label>
  );
}
