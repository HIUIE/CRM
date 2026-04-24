import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, FileDigit, KeyRound, Shield, UserCog } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';
import type { AiSettings, DocumentSettings, ManagedUser } from '../types/crm';

type UserFormState = {
  username: string;
  name: string;
  role: UserRole;
  password: string;
};

const EMPTY_USER_FORM: UserFormState = {
  username: '',
  name: '',
  role: 'staff',
  password: '',
};

export default function SettingsView() {
  const { user } = useAuth();
  const [model, setModel] = useState('gemini-2.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [orderNumberPrefix, setOrderNumberPrefix] = useState('ORD-');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [userForm, setUserForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [resettingUserId, setResettingUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedAi, setSavedAi] = useState(false);
  const [savedDocument, setSavedDocument] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin';

  const loadSettings = async () => {
    try {
      const [aiData, documentData, userData] = await Promise.all([
        apiFetch<AiSettings>('/api/settings/ai'),
        isAdmin ? apiFetch<DocumentSettings>('/api/settings/document') : Promise.resolve({ orderNumberPrefix: 'ORD-' }),
        isAdmin ? apiFetch<ManagedUser[]>('/api/users') : Promise.resolve([]),
      ]);

      setModel(aiData.model);
      setApiKey(aiData.apiKey || '');
      setBaseUrl(aiData.baseUrl || '');
      setHasApiKey(aiData.hasApiKey);
      setOrderNumberPrefix(documentData.orderNumberPrefix || 'ORD-');
      setUsers(userData);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '读取系统设置失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const saveAiSettings = async () => {
    setError('');
    setSavedAi(false);
    try {
      await apiFetch('/api/settings/ai', {
        method: 'POST',
        body: JSON.stringify({ model, apiKey, baseUrl }),
      });
      setSavedAi(true);
      setHasApiKey(Boolean(apiKey && apiKey !== '***') || hasApiKey);
      window.setTimeout(() => setSavedAi(false), 1800);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '保存 AI 设置失败'));
    }
  };

  const saveDocumentSettings = async () => {
    setError('');
    setSavedDocument(false);
    try {
      await apiFetch('/api/settings/document', {
        method: 'POST',
        body: JSON.stringify({ orderNumberPrefix: orderNumberPrefix.trim() || 'ORD-' }),
      });
      setSavedDocument(true);
      window.setTimeout(() => setSavedDocument(false), 1800);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '保存单据编码规则失败'));
    }
  };

  const startCreateUser = () => {
    setEditingUser(null);
    setResettingUserId(null);
    setResetPassword('');
    setUserMessage('');
    setUserForm(EMPTY_USER_FORM);
  };

  const startEditUser = (nextUser: ManagedUser) => {
    setEditingUser(nextUser);
    setResettingUserId(null);
    setResetPassword('');
    setUserMessage('');
    setUserForm({
      username: nextUser.username,
      name: nextUser.name,
      role: nextUser.role,
      password: '',
    });
  };

  const saveUser = async () => {
    setError('');
    setUserMessage('');
    try {
      if (editingUser) {
        await apiFetch(`/api/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: userForm.name.trim(),
            role: userForm.role,
            active: editingUser.active !== false,
          }),
        });
        setUserMessage('用户信息已更新');
      } else {
        await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            username: userForm.username.trim(),
            name: userForm.name.trim(),
            role: userForm.role,
            password: userForm.password,
          }),
        });
        setUserMessage('用户已创建');
        setUserForm(EMPTY_USER_FORM);
      }
      await loadSettings();
    } catch (requestError) {
      setError(getErrorMessage(requestError, '保存用户失败'));
    }
  };

  const toggleUserStatus = async (managedUser: ManagedUser) => {
    setError('');
    setUserMessage('');
    try {
      await apiFetch(`/api/users/${managedUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: managedUser.name,
          role: managedUser.role,
          active: !(managedUser.active !== false),
        }),
      });
      setUserMessage(managedUser.active === false ? '用户已启用' : '用户已停用');
      await loadSettings();
    } catch (requestError) {
      setError(getErrorMessage(requestError, '更新用户状态失败'));
    }
  };

  const submitResetPassword = async () => {
    if (!resettingUserId || resetPassword.length < 6) {
      setError('新密码至少需要 6 位');
      return;
    }

    setError('');
    setUserMessage('');
    try {
      await apiFetch(`/api/users/${resettingUserId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: resetPassword }),
      });
      setUserMessage('密码已重置');
      setResetPassword('');
      setResettingUserId(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '重置密码失败'));
    }
  };

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">正在读取系统设置...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-white p-8 text-sm text-amber-700 shadow-sm">
        当前账号可以使用业务模块，但只有管理员可以查看和修改系统设置、编号规则与团队账号。
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {error ? <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
      {userMessage ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{userMessage}</div> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center text-lg font-bold text-slate-800">
              <FileDigit className="mr-2 h-5 w-5 text-blue-600" />
              单据编码规则
            </h2>
            <p className="mt-1 text-sm text-slate-500">第一版只控制新订单的编号前缀。修改后仅影响未来新建订单，不回写历史单号。</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            示例：{(orderNumberPrefix || 'ORD-') + new Date().getFullYear() + '-000123'}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">订单编号前缀</label>
            <input
              value={orderNumberPrefix}
              onChange={(event) => setOrderNumberPrefix(event.target.value)}
              placeholder="如 ORD- / PO-"
              className="w-full rounded-2xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={saveDocumentSettings}
            className="inline-flex items-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
          >
            {savedDocument ? <><CheckCircle2 className="mr-2 h-4 w-4" />已保存</> : '保存编码规则'}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center text-lg font-bold text-slate-800">
              <Bot className="mr-2 h-5 w-5 text-blue-600" />
              AI 模型设置
            </h2>
            <p className="mt-1 text-sm text-slate-500">AI 只承担订单草稿解析和订单风险诊断，不影响团队日常主流程。</p>
          </div>
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${hasApiKey ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            <KeyRound className="mr-1 h-3.5 w-3.5" />
            {hasApiKey ? '已配置密钥' : '未配置密钥'}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">默认激活模型</label>
            <select value={model} onChange={(event) => setModel(event.target.value)} className="w-full rounded-2xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="deepseek-chat">DeepSeek Chat</option>
              <option value="gpt-4o">OpenAI GPT-4o</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">API Key</label>
            <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="留空表示沿用现有密钥" className="w-full rounded-2xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Base URL</label>
            <input type="text" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="如无需自定义可留空" className="w-full rounded-2xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <button onClick={saveAiSettings} className="inline-flex items-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-black">
            {savedAi ? <><CheckCircle2 className="mr-2 h-4 w-4" />已保存</> : '保存 AI 设置'}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center text-lg font-bold text-slate-800">
              <UserCog className="mr-2 h-5 w-5 text-blue-600" />
              团队账号
            </h2>
            <p className="mt-1 text-sm text-slate-500">第一阶段采用管理员和业务员两档角色。管理员负责系统配置和团队账号维护。</p>
          </div>
          <button onClick={startCreateUser} className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            新增账号
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">姓名</th>
                  <th className="px-4 py-3">账号</th>
                  <th className="px-4 py-3">角色</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((managedUser) => (
                  <tr key={managedUser.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{managedUser.name}</td>
                    <td className="px-4 py-3 text-slate-600">{managedUser.username}</td>
                    <td className="px-4 py-3">{managedUser.role === 'admin' ? '管理员' : '业务员'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${managedUser.active === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                        {managedUser.active === false ? '已停用' : '启用中'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEditUser(managedUser)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                          编辑
                        </button>
                        <button onClick={() => setResettingUserId(managedUser.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                          重置密码
                        </button>
                        {managedUser.username !== 'root' ? (
                          <button onClick={() => void toggleUserStatus(managedUser)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                            {managedUser.active === false ? '启用' : '停用'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 flex items-center text-sm font-semibold text-slate-800">
              <Shield className="mr-2 h-4 w-4 text-blue-600" />
              {editingUser ? `编辑账号：${editingUser.username}` : '创建新账号'}
            </div>

            <div className="space-y-4">
              {!editingUser ? (
                <Field label="用户名">
                  <input
                    value={userForm.username}
                    onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
              ) : (
                <Field label="用户名">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">{editingUser.username}</div>
                </Field>
              )}

              <Field label="姓名">
                <input
                  value={userForm.name}
                  onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>

              <Field label="角色">
                <select
                  value={userForm.role}
                  onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value as UserRole }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="staff">业务员</option>
                  <option value="admin">管理员</option>
                </select>
              </Field>

              {!editingUser ? (
                <Field label="初始密码">
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
              ) : null}

              <div className="flex gap-3">
                <button onClick={saveUser} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  {editingUser ? '保存修改' : '创建账号'}
                </button>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setUserForm(EMPTY_USER_FORM);
                    setResettingUserId(null);
                    setResetPassword('');
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  清空
                </button>
              </div>
            </div>

            {resettingUserId ? (
              <div className="mt-6 border-t border-slate-200 pt-5">
                <div className="mb-3 text-sm font-semibold text-slate-800">重置密码</div>
                <div className="flex gap-3">
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    placeholder="输入至少 6 位新密码"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={submitResetPassword} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                    提交
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
