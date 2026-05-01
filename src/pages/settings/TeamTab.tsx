import React, { useState, useEffect } from 'react';
import { UserCog, Plus, Shield, X } from 'lucide-react';
import Field from '../../components/ui/Field';
import { apiFetch, getErrorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export type UserRole = 'admin' | 'staff';
export type ManagedUser = {
  id: number;
  username: string;
  name: string | null;
  role: UserRole;
  active: boolean | null;
};

const EMPTY_USER_FORM = { username: '', name: '', password: '', role: 'staff' as UserRole };

export default function TeamTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [resettingUserId, setResettingUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const loadUsers = async () => {
    if (!isAdmin) { setLoading(false); return; }
    try {
      const data = await apiFetch<ManagedUser[]>('/api/users');
      setUsers(data || []);
    } catch (e) { setError(getErrorMessage(e, '加载用户列表失败')); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, [isAdmin]);

  const startCreateUser = () => { setEditingUser(null); setUserForm(EMPTY_USER_FORM); setResettingUserId(null); setResetPassword(''); setConfirmPassword(''); };
  const startEditUser = (user: ManagedUser) => { setEditingUser(user); setUserForm({ username: user.username, name: user.name || '', password: '', role: user.role }); setResettingUserId(null); setResetPassword(''); setConfirmPassword(''); };

  const saveUser = async () => {
    setError('');
    try {
      if (editingUser) {
        await apiFetch(`/api/users/${editingUser.id}`, { method: 'PATCH', body: JSON.stringify({ name: userForm.name, role: userForm.role, active: editingUser.active !== false }) });
      } else {
        await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(userForm) });
      }
      await loadUsers();
      startCreateUser();
    } catch (e) { setError(getErrorMessage(e, '保存用户失败')); }
  };

  const toggleUserStatus = async (user: ManagedUser) => {
    setError('');
    try {
      await apiFetch(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ name: user.name || user.username, role: user.role, active: user.active === false ? true : false }) });
      await loadUsers();
    } catch (e) { setError(getErrorMessage(e, '状态更新失败')); }
  };

  const submitResetPassword = async () => {
    if (!resetPassword) return setError('请输入新密码');
    if (!confirmPassword) return setError('请输入当前管理员密码');
    setError('');
    try {
      await apiFetch(`/api/users/${resettingUserId}/reset-password`, { method: 'POST', body: JSON.stringify({ password: resetPassword, confirmPassword }) });
      setResettingUserId(null); setResetPassword(''); setConfirmPassword('');
    } catch (e) { setError(getErrorMessage(e, '重置密码失败')); }
  };

  if (loading) return <div className="p-8 text-sm text-slate-500 animate-pulse">正在读取团队配置...</div>;

  return (
    <div className="space-y-8">
      {error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
            <UserCog className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
            团队成员管理
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">配置管理员与业务员账号权限。共 {users.length} 个账号。</p>
        </div>
        <button onClick={startCreateUser} className="btn-primary shadow-md">
          <Plus className="mr-2 h-4 w-4" /> 新增账号
        </button>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-950 text-xs font-bold tracking-tight text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-4">姓名</th>
                <th className="px-4 py-4">账号</th>
                <th className="px-4 py-4">角色</th>
                <th className="px-4 py-4">状态</th>
                <th className="px-4 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-900">
              {users.map((managedUser) => (
                <tr key={managedUser.id} className="hover:bg-slate-50 dark:hover:bg-navy-800">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-navy dark:bg-tertiary-sage text-[11px] font-black text-white shadow-sm">
                        {managedUser.name?.charAt(0) || '?'}
                      </div>
                      <span className="font-bold text-primary-navy dark:text-white">{managedUser.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-400 font-medium">{managedUser.username}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tracking-tight ${managedUser.role === 'admin' ? 'border border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300' : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-300'}`}>
                      {managedUser.role === 'admin' ? '管理员' : '业务员'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold tracking-tight ${managedUser.active === false ? 'border-slate-200 bg-slate-50 text-slate-500 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-400' : 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300'}`}>
                      {managedUser.active === false ? '已停用' : '启用中'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEditUser(managedUser)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800">编辑</button>
                      <button onClick={() => { setResettingUserId(managedUser.id); setResetPassword(''); setConfirmPassword(''); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800">重置</button>
                      {managedUser.username !== 'root' && (
                        <button onClick={() => toggleUserStatus(managedUser)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800">
                          {managedUser.active === false ? '启用' : '停用'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6">
          <div className="mb-6 flex items-center text-sm font-bold text-primary-navy dark:text-white tracking-tight">
            <Shield className="mr-2 h-4 w-4 text-primary-navy dark:text-tertiary-sage" />
            {editingUser ? '编辑成员' : '创建成员'}
          </div>

          <div className="space-y-5">
            {!editingUser ? (
              <Field label="用户名"><input value={userForm.username} onChange={(e) => setUserForm(c => ({ ...c, username: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-primary-navy outline-none transition-colors focus:border-primary-navy dark:border-navy-800 dark:bg-navy-950 dark:text-white dark:focus:border-tertiary-sage" /></Field>
            ) : (
              <Field label="用户名"><div className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-500 dark:border-navy-800 dark:bg-navy-950 dark:text-slate-400">{editingUser.username}</div></Field>
            )}
            <Field label="成员真实姓名"><input value={userForm.name} onChange={(e) => setUserForm(c => ({ ...c, name: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-primary-navy outline-none transition-colors focus:border-primary-navy dark:border-navy-800 dark:bg-navy-950 dark:text-white dark:focus:border-tertiary-sage" /></Field>
            <Field label="角色权限">
              <select value={userForm.role} onChange={(e) => setUserForm(c => ({ ...c, role: e.target.value as UserRole }))} className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-primary-navy outline-none transition-colors focus:border-primary-navy dark:border-navy-800 dark:bg-navy-950 dark:text-white dark:focus:border-tertiary-sage">
                <option value="staff">业务员 (普通权限)</option>
                <option value="admin">管理员 (最高权限)</option>
              </select>
            </Field>
            {!editingUser && (
              <Field label="初始访问密码"><input type="password" value={userForm.password} onChange={(e) => setUserForm(c => ({ ...c, password: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-primary-navy outline-none transition-colors focus:border-primary-navy dark:border-navy-800 dark:bg-navy-950 dark:text-white dark:focus:border-tertiary-sage" /></Field>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={saveUser} className="btn-primary shadow-md">{editingUser ? '确认修改' : '立即创建'}</button>
              <button onClick={startCreateUser} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-navy-800">重置</button>
            </div>
          </div>

          {resettingUserId && (
            <div className="mt-8 border-t border-slate-200 pt-6 relative animate-in fade-in">
              <button onClick={() => { setResettingUserId(null); setResetPassword(''); setConfirmPassword(''); }} className="absolute top-6 right-0 text-slate-400 hover:text-primary-navy"><X size={16} /></button>
              <div className="mb-4 text-xs font-bold text-primary-navy tracking-tight">强制重置密码</div>
              <div className="space-y-3">
                <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="新密码" className="w-full flex-1 rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-primary-navy outline-none transition-colors focus:border-primary-navy dark:border-navy-800 dark:bg-navy-950 dark:text-white dark:focus:border-tertiary-sage" />
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="当前管理员密码" className="w-full flex-1 rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-primary-navy outline-none transition-colors focus:border-primary-navy dark:border-navy-800 dark:bg-navy-950 dark:text-white dark:focus:border-tertiary-sage" />
                <button onClick={submitResetPassword} className="w-full rounded-lg bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-black">提交</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
