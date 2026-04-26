import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Download, FileDigit, KeyRound, Shield, UserCog, Settings, Layout, BrainCircuit, Plus, X } from 'lucide-react';
import { apiDownload, apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { FilterPill } from '../features/order-detail/components';
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

type SettingsTab = 'general' | 'export' | 'interface' | 'ai';

export default function SettingsView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
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
  const [exporting, setExporting] = useState(false);

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

  const exportData = async () => {
    setError('');
    setUserMessage('');
    setExporting(true);
    try {
      await apiDownload('/api/settings/export?format=customer-archive');
      setUserMessage('客户订单归档导出已开始下载');
    } catch (requestError) {
      setError(getErrorMessage(requestError, '导出数据失败'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 text-sm text-slate-500 dark:text-slate-400 shadow-sm transition-colors animate-pulse">正在读取系统设置...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-900/30 bg-white dark:bg-navy-900 p-8 text-sm text-amber-700 dark:text-amber-400 shadow-sm transition-colors">
        当前账号可以使用业务模块，但只有管理员可以查看和修改系统设置、编号规则与团队账号。
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex bg-white dark:bg-navy-900 p-1 rounded-2xl border border-slate-200 dark:border-navy-800 w-fit transition-colors">
         <button onClick={() => setActiveTab('general')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><Settings size={16} /> 常规配置</button>
         <button onClick={() => setActiveTab('export')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'export' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><Download size={16} /> 数据导出</button>
         <button onClick={() => setActiveTab('interface')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'interface' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><Layout size={16} /> 团队管理</button>
         <button onClick={() => setActiveTab('ai')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'ai' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><BrainCircuit size={16} /> AI 配置</button>
      </div>

      {error ? <div className="rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400 animate-in fade-in">{error}</div> : null}
      {userMessage ? <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 animate-in fade-in">{userMessage}</div> : null}

      {activeTab === 'general' && (
        <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 transition-colors">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
                <FileDigit className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
                单据编码规则
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">控制未来新建订单的默认前缀。</p>
            </div>
            <div className="rounded-full bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-800 px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
              预览：{'CQBX-' + new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + String(new Date().getDate()).padStart(2, '0') + '01'}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <Field label="订单编号前缀">
              <input
                value={orderNumberPrefix}
                onChange={(event) => setOrderNumberPrefix(event.target.value)}
                placeholder="如 ORD- / PO-"
                className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
              />
            </Field>
            <button
              type="button"
              onClick={saveDocumentSettings}
              className="inline-flex items-center rounded-xl bg-primary-navy dark:bg-tertiary-sage px-8 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-800 dark:hover:bg-emerald-700 shadow-md"
            >
              {savedDocument ? <><CheckCircle2 className="mr-2 h-4 w-4" />已保存</> : '保存编码规则'}
            </button>
          </div>
        </section>
      )}

      {activeTab === 'export' && (
        <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 transition-colors">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
                <Download className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
                客户订单归档导出
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">按客户分目录、按订单分子目录导出，并带出订单附件、图片和明细文件。</p>
            </div>
            <div className="rounded-full bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-800 px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
              结构：客户 / 订单 / 附件
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-3">
                <div className="text-sm font-bold text-primary-navy dark:text-white">客户维度归档导出</div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  导出包会按客户建立目录，客户目录下再按订单建立子目录。每个订单中会包含订单摘要、
                  商品明细、财务流水、物流、报关、生产、装箱数据，以及对应的图片和业务附件原文件。
                </p>
                <div className="inline-flex items-center rounded-full bg-white dark:bg-navy-800 px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700">
                  仅管理员可操作
                </div>
              </div>

              <button
                type="button"
                onClick={() => void exportData()}
                disabled={exporting}
                className="inline-flex items-center justify-center rounded-xl bg-primary-navy dark:bg-tertiary-sage px-8 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-800 dark:hover:bg-emerald-700 shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="mr-2 h-4 w-4" />
                {exporting ? '正在导出...' : '导出客户订单归档'}
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'ai' && (
        <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 transition-colors">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
                <Bot className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
                AI 引擎驱动设置
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">配置底层解析模型，优化草稿识别与风险诊断准确率。</p>
            </div>
            <div className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold ${hasApiKey ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>
              <KeyRound className="mr-2 h-3.5 w-3.5" />
              {hasApiKey ? '密钥已就绪' : '未配置 API 密钥'}
            </div>
          </div>

          <div className="space-y-6 max-w-2xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="预设模型 (Quick Presets)">
                <select 
                  value={model} 
                  onChange={(event) => setModel(event.target.value)} 
                  className="w-full rounded-xl border border-slate-200 dark:border-navy-800 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none appearance-none cursor-pointer bg-white dark:bg-navy-950 text-primary-navy dark:text-white"
                >
                  <option value="deepseek-v4-flash">DeepSeek-V4-Flash (极速推荐)</option>
                  <option value="deepseek-v4-pro">DeepSeek-V4-Pro (全能旗舰)</option>
                  <option value="deepseek-chat">DeepSeek-V3 (即将弃用)</option>
                  <option value="deepseek-reasoner">DeepSeek-R1 (推理/即将弃用)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="custom">-- 自定义型号 --</option>
                </select>
              </Field>

              <Field label="当前模型识别码 (Model ID)">
                <input 
                  type="text" 
                  value={model} 
                  onChange={(e) => setModel(e.target.value)} 
                  placeholder="如 deepseek-chat" 
                  className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white data-field"
                />
              </Field>
            </div>

            <Field label="API 访问密钥 (API Key)">
              <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="留空表示沿用现有密钥" className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white" />
            </Field>

            <Field label="自定义 API 代理地址 (Base URL)">
              <input type="text" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="DeepSeek 请用 https://api.deepseek.com" className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white" />
            </Field>

            <button onClick={saveAiSettings} className="inline-flex items-center rounded-xl bg-primary-navy dark:bg-tertiary-sage px-10 py-3.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all">
              {savedAi ? <><CheckCircle2 className="mr-2 h-4 w-4" />配置已更新</> : '保存 AI 引擎配置'}
            </button>
          </div>
        </section>
      )}

      {activeTab === 'interface' && (
        <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 transition-colors">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
                <UserCog className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
                团队成员管理
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">配置管理员与业务员账号权限。</p>
            </div>
            <button onClick={startCreateUser} className="inline-flex items-center rounded-xl bg-primary-navy dark:bg-tertiary-sage px-6 py-2 text-sm font-bold text-white shadow-md hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all">
              <Plus className="mr-2 h-4 w-4" />
              新增账号
            </button>
          </div>

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-navy-800">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 transition-colors">
                  <tr>
                    <th className="px-4 py-4">姓名</th>
                    <th className="px-4 py-4">账号</th>
                    <th className="px-4 py-4">角色</th>
                    <th className="px-4 py-4">状态</th>
                    <th className="px-4 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-900 transition-colors">
                  {users.map((managedUser) => (
                    <tr key={managedUser.id} className="hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                      <td className="px-4 py-4 font-bold text-primary-navy dark:text-white">{managedUser.name}</td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-400 font-medium">{managedUser.username}</td>
                      <td className="px-4 py-4">
                         <span className="text-[11px] font-bold text-secondary-slate dark:text-slate-500 uppercase">{managedUser.role === 'admin' ? '管理员' : '业务员'}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${managedUser.active === false ? 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-600' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'}`}>
                          {managedUser.active === false ? '已停用' : '启用中'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => startEditUser(managedUser)} className="rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-tertiary-sage transition-all">
                            编辑
                          </button>
                          <button onClick={() => setResettingUserId(managedUser.id)} className="rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-tertiary-sage transition-all">
                            重置
                          </button>
                          {managedUser.username !== 'root' ? (
                            <button onClick={() => void toggleUserStatus(managedUser)} className="rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-tertiary-sage transition-all">
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

            <div className="rounded-2xl border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
              <div className="mb-6 flex items-center text-sm font-bold text-primary-navy dark:text-white uppercase tracking-widest">
                <Shield className="mr-2 h-4 w-4 text-primary-navy dark:text-tertiary-sage" />
                {editingUser ? '编辑成员' : '创建成员'}
              </div>

              <div className="space-y-5">
                {!editingUser ? (
                  <Field label="用户名">
                    <input
                      value={userForm.username}
                      onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
                    />
                  </Field>
                ) : (
                  <Field label="用户名">
                    <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-200/50 dark:bg-navy-800/50 px-4 py-3 text-sm text-slate-500 dark:text-slate-500 font-bold">{editingUser.username}</div>
                  </Field>
                )}

                <Field label="成员真实姓名">
                  <input
                    value={userForm.name}
                    onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
                  />
                </Field>

                <Field label="角色权限">
                  <select
                    value={userForm.role}
                    onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value as UserRole }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none appearance-none cursor-pointer text-primary-navy dark:text-white"
                  >
                    <option value="staff">业务员 (普通权限)</option>
                    <option value="admin">管理员 (最高权限)</option>
                  </select>
                </Field>

                {!editingUser ? (
                  <Field label="初始访问密码">
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
                    />
                  </Field>
                ) : null}

                <div className="flex gap-3 pt-2">
                  <button onClick={saveUser} className="flex-1 rounded-xl bg-primary-navy dark:bg-tertiary-sage px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all">
                    {editingUser ? '确认修改' : '立即创建'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingUser(null);
                      setUserForm(EMPTY_USER_FORM);
                      setResettingUserId(null);
                      setResetPassword('');
                    }}
                    className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all"
                  >
                    重置
                  </button>
                </div>
              </div>

              {resettingUserId ? (
                <div className="mt-8 border-t border-slate-200 dark:border-navy-800 pt-6 animate-in fade-in relative">
                  <button onClick={() => setResettingUserId(null)} className="absolute top-6 right-0 text-slate-400 hover:text-primary-navy dark:hover:text-white"><X size={16} /></button>
                  <div className="mb-4 text-[10px] font-bold text-primary-navy dark:text-tertiary-sage uppercase tracking-widest">强制重置密码</div>
                  <div className="flex gap-3">
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(event) => setResetPassword(event.target.value)}
                      placeholder="新密码(至少6位)"
                      className="flex-1 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none text-primary-navy dark:text-white"
                    />
                    <button onClick={submitResetPassword} className="rounded-xl bg-slate-900 dark:bg-tertiary-sage px-6 py-3 text-sm font-bold text-white hover:bg-black dark:hover:bg-emerald-700 transition-all shadow-md">
                      提交
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="block text-xs font-bold text-primary-navy dark:text-white uppercase tracking-widest opacity-70">{label}</span>
      {children}
    </label>
  );
}
