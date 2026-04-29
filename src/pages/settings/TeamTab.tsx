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

  const loadUsers = async () => {
    if (!isAdmin) { setLoading(false); return; }
    try {
      const data = await apiFetch<ManagedUser[]>('/api/users');
      setUsers(data || []);
    } catch (e) { setError(getErrorMessage(e, '加载用户列表失败')); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, [isAdmin]);

  const startCreateUser = () => { setEditingUser(null); setUserForm(EMPTY_USER_FORM); setResettingUserId(null); };
  const startEditUser = (user: ManagedUser) => { setEditingUser(user); setUserForm({ username: user.username, name: user.name || '', password: '', role: user.role }); setResettingUserId(null); };

  const saveUser = async () => {
    setError('');
    try {
      if (editingUser) {
        await apiFetch(`/api/users/${editingUser.id}`, { method: 'PATCH', body: JSON.stringify({ name: userForm.name, role: userForm.role }) });
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
      await apiFetch(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ active: user.active === false ? true : false }) });
      await loadUsers();
    } catch (e) { setError(getErrorMessage(e, '状态更新失败')); }
  };

  const submitResetPassword = async () => {
    if (!resetPassword) return setError('请输入新密码');
    setError('');
    try {
      await apiFetch(`/api/users/${resettingUserId}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword: resetPassword }) });
      setResettingUserId(null); setResetPassword('');
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
            <thead className="bg-slate-50 dark:bg-navy-950 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
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
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${managedUser.role === 'admin' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                      {managedUser.role === 'admin' ? '管理员' : '业务员'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${managedUser.active === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                      {managedUser.active === false ? '已停用' : '启用中'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEditUser(managedUser)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all">编辑</button>
                      <button onClick={() => setResettingUserId(managedUser.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all">重置</button>
                      {managedUser.username !== 'root' && (
                        <button onClick={() => toggleUserStatus(managedUser)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all">
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
          <div className="mb-6 flex items-center text-sm font-bold text-primary-navy dark:text-white uppercase tracking-widest">
            <Shield className="mr-2 h-4 w-4 text-primary-navy dark:text-tertiary-sage" />
            {editingUser ? '编辑成员' : '创建成员'}
          </div>

          <div className="space-y-5">
            {!editingUser ? (
              <Field label="用户名"><input value={userForm.username} onChange={(e) => setUserForm(c => ({ ...c, username: e.target.value }))} className="w-full rounded-lg border border-slate-200 p-3.5 text-sm outline-none" /></Field>
            ) : (
              <Field label="用户名"><div className="rounded-lg border border-slate-200 bg-slate-200/50 px-4 py-3 text-sm font-bold">{editingUser.username}</div></Field>
            )}
            <Field label="成员真实姓名"><input value={userForm.name} onChange={(e) => setUserForm(c => ({ ...c, name: e.target.value }))} className="w-full rounded-lg border border-slate-200 p-3.5 text-sm outline-none" /></Field>
            <Field label="角色权限">
              <select value={userForm.role} onChange={(e) => setUserForm(c => ({ ...c, role: e.target.value as UserRole }))} className="w-full rounded-lg border border-slate-200 p-3.5 text-sm outline-none bg-white">
                <option value="staff">业务员 (普通权限)</option>
                <option value="admin">管理员 (最高权限)</option>
              </select>
            </Field>
            {!editingUser && (
              <Field label="初始访问密码"><input type="password" value={userForm.password} onChange={(e) => setUserForm(c => ({ ...c, password: e.target.value }))} className="w-full rounded-lg border border-slate-200 p-3.5 text-sm outline-none" /></Field>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={saveUser} className="btn-primary shadow-md">{editingUser ? '确认修改' : '立即创建'}</button>
              <button onClick={startCreateUser} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100">重置</button>
            </div>
          </div>

          {resettingUserId && (
            <div className="mt-8 border-t border-slate-200 pt-6 relative animate-in fade-in">
              <button onClick={() => setResettingUserId(null)} className="absolute top-6 right-0 text-slate-400 hover:text-primary-navy"><X size={16} /></button>
              <div className="mb-4 text-xs font-bold text-primary-navy uppercase tracking-widest">强制重置密码</div>
              <div className="flex gap-3">
                <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="新密码" className="flex-1 w-full rounded-lg border border-slate-200 p-3.5 text-sm outline-none" />
                <button onClick={submitResetPassword} className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-black">提交</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
