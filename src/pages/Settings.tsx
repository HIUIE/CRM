import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Download, FileDigit, KeyRound, Shield, UserCog, Settings, Layout, BrainCircuit, Plus, X, Globe, DollarSign, AlertCircle, Loader2 } from 'lucide-react';
import Field from '../components/ui/Field';
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

const AI_PROVIDERS = [
  { id: 'deepseek', label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'], baseUrl: 'https://api.deepseek.com', icon: <BrainCircuit size={20} /> },
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini'], baseUrl: 'https://api.openai.com', icon: <Bot size={20} /> },
  { id: 'gemini', label: 'Google Gemini', models: ['gemini-2.5-flash', 'gemini-2.5-pro'], baseUrl: '', icon: <Bot size={20} /> },
];

const EXPORT_FORMATS = [
  {
    id: 'customer-archive',
    title: '客户订单归档（推荐）',
    desc: '按客户分目录、按订单分子目录导出，含订单摘要、商品明细、财务流水、物流、报关、生产、装箱及附件原文件。',
    icon: <Download size={20} />,
  },
  {
    id: 'zip-csv',
    title: 'CSV 表格导出',
    desc: '所有订单、客户、财务、物流等核心数据导出为 CSV 表格文件，适合 Excel 分析处理。',
    icon: <FileDigit size={20} />,
  },
];

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
  const [exportFormat, setExportFormat] = useState<'customer-archive' | 'zip-csv'>('customer-archive');
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<'idle' | 'success' | 'fail'>('idle');
  const [selectedProvider, setSelectedProvider] = useState('deepseek');

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

      // Detect provider from model
      for (const p of AI_PROVIDERS) {
        if (p.models.includes(aiData.model)) { setSelectedProvider(p.id); break; }
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, '读取系统设置失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      setModel(provider.models[0]);
      if (provider.baseUrl && !baseUrl) setBaseUrl(provider.baseUrl);
    }
  };

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

  const testAiConnection = async () => {
    setTestingAi(true);
    setAiTestResult('idle');
    try {
      await apiFetch('/api/settings/ai/test', { method: 'POST' });
      setAiTestResult('success');
    } catch (requestError) {
      setAiTestResult('fail');
      setError(getErrorMessage(requestError, '连接测试失败'));
    } finally {
      setTestingAi(false);
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
      await apiDownload(`/api/settings/export?format=${exportFormat}`);
      const labels: Record<string, string> = { 'customer-archive': '客户订单归档', 'zip-csv': 'CSV 表格' };
      setUserMessage(`${labels[exportFormat] || '数据'}导出已开始下载`);
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
      <div className="flex bg-white dark:bg-navy-900 p-1 rounded-lg border border-slate-200 dark:border-navy-800 w-fit transition-colors">
         <button onClick={() => setActiveTab('general')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><Settings size={16} /> 常规配置</button>
         <button onClick={() => setActiveTab('export')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'export' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><Download size={16} /> 数据导出</button>
         <button onClick={() => setActiveTab('interface')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'interface' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><Layout size={16} /> 团队管理</button>
         <button onClick={() => setActiveTab('ai')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ai' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><BrainCircuit size={16} /> AI 配置</button>
      </div>

      {error ? <div className="rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400 animate-in fade-in">{error}</div> : null}
      {userMessage ? <div className="rounded-lg border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 animate-in fade-in">{userMessage}</div> : null}

      {/* ===== General Tab ===== */}
      {activeTab === 'general' && (
        <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 transition-colors">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
                <Settings className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
                系统常规配置
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">配置单据编码规则与业务参数。</p>
            </div>
          </div>

          <div className="space-y-8 max-w-3xl">
            {/* Order Number Prefix */}
            <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
              <h3 className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-4">
                <FileDigit size={16} /> 单据编码规则
              </h3>
              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <Field label="订单编号前缀">
                  <input
                    value={orderNumberPrefix}
                    onChange={(event) => setOrderNumberPrefix(event.target.value)}
                    placeholder="如 ORD- / PO-"
                    className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
                  />
                </Field>
                <button
                  type="button"
                  onClick={saveDocumentSettings}
                  className="btn-primary shadow-md"
                >
                  {savedDocument ? <><CheckCircle2 className="mr-2 h-4 w-4" />已保存</> : '保存编码规则'}
                </button>
              </div>
              <div className="mt-4 rounded-full bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 inline-flex items-center gap-2">
                <Globe size={12} /> 预览：{orderNumberPrefix}{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}{String(new Date().getDate()).padStart(2, '0')}01
              </div>
            </div>

            {/* Currency Settings */}
            <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
              <h3 className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-4">
                <DollarSign size={16} /> 默认业务币种
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-medium">系统将使用以下币种作为新建订单和财务记录的默认选项。</p>
              <div className="flex flex-wrap gap-3">
                {['USD', 'CNY', 'EUR', 'GBP', 'JPY'].map(currency => (
                  <div key={currency} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 cursor-pointer hover:border-primary-navy dark:hover:border-tertiary-sage transition-all">
                    <input type="radio" name="currency" defaultChecked={currency === 'USD'} className="accent-primary-navy dark:accent-tertiary-sage" />
                    <span className="text-sm font-bold text-primary-navy dark:text-white">{currency}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== Export Tab ===== */}
      {activeTab === 'export' && (
        <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 transition-colors">
          <div className="mb-8">
            <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
              <Download className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
              数据导出
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">选择导出格式，一键归档业务数据。</p>
          </div>

          <div className="space-y-4 mb-8">
            {EXPORT_FORMATS.map(fmt => (
              <div
                key={fmt.id}
                onClick={() => setExportFormat(fmt.id as 'customer-archive' | 'zip-csv')}
                className={`flex items-start gap-4 p-5 rounded-lg border cursor-pointer transition-all ${
                  exportFormat === fmt.id
                    ? 'border-primary-navy dark:border-tertiary-sage bg-primary-navy/5 dark:bg-tertiary-sage/10'
                    : 'border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 hover:border-slate-300 dark:hover:border-navy-700'
                }`}
              >
                <div className={`p-2 rounded-lg ${exportFormat === fmt.id ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-slate-100 dark:bg-navy-800 text-slate-500'}`}>
                  {fmt.icon}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-primary-navy dark:text-white">{fmt.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{fmt.desc}</div>
                </div>
                {exportFormat === fmt.id && <CheckCircle2 size={18} className="text-primary-navy dark:text-tertiary-sage shrink-0 mt-1" />}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 p-5 rounded-lg bg-slate-50 dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800">
            <div className="flex-1">
              <div className="text-sm font-bold text-primary-navy dark:text-white">仅管理员可操作</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">导出包包含所有业务数据，请妥善保管。</div>
            </div>
            <button
              type="button"
              onClick={() => void exportData()}
              disabled={exporting}
              className="btn-primary shadow-md disabled:opacity-60"
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? '正在导出...' : `立即导出`}
            </button>
          </div>
        </section>
      )}

      {/* ===== AI Tab ===== */}
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

          <div className="space-y-8 max-w-3xl">
            {/* Provider Selection */}
            <div>
              <label className="text-xs font-bold text-primary-navy dark:text-white uppercase tracking-widest mb-3 block">选择 AI 服务商</label>
              <div className="grid grid-cols-3 gap-3">
                {AI_PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleProviderChange(p.id)}
                    className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                      selectedProvider === p.id
                        ? 'border-primary-navy dark:border-tertiary-sage bg-primary-navy/5 dark:bg-tertiary-sage/10'
                        : 'border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 hover:border-slate-300 dark:hover:border-navy-700'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${selectedProvider === p.id ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-slate-100 dark:bg-navy-800 text-slate-500'}`}>
                      {p.icon}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-primary-navy dark:text-white">{p.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{p.models.length} 个模型</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="模型选择">
                <select
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-navy-800 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none appearance-none cursor-pointer bg-white dark:bg-navy-950 text-primary-navy dark:text-white"
                >
                  {AI_PROVIDERS.find(p => p.id === selectedProvider)?.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="custom">-- 自定义型号 --</option>
                </select>
              </Field>

              <Field label="自定义模型 ID">
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="如 deepseek-chat"
                  className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white data-field"
                />
              </Field>
            </div>

            <Field label="API 访问密钥 (API Key)">
              <div className="flex gap-3">
                <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="留空表示沿用现有密钥" className="flex-1 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white" />
              </div>
            </Field>

            <Field label="自定义 API 代理地址 (Base URL)">
              <input type="text" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder={AI_PROVIDERS.find(p => p.id === selectedProvider)?.baseUrl || 'https://api.deepseek.com'} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white" />
            </Field>

            <div className="flex gap-3">
              <button onClick={saveAiSettings} className="btn-primary shadow-md">
                {savedAi ? <><CheckCircle2 className="mr-2 h-4 w-4" />配置已更新</> : '保存 AI 引擎配置'}
              </button>
              <button
                onClick={() => void testAiConnection()}
                disabled={testingAi}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all disabled:opacity-50"
              >
                {testingAi ? <Loader2 size={16} className="animate-spin" /> : <AlertCircle size={16} />}
                {testingAi ? '测试中...' : '测试连接'}
              </button>
              {aiTestResult === 'success' && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={14} /> 连接成功
                </span>
              )}
              {aiTestResult === 'fail' && (
                <span className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
                  <AlertCircle size={14} /> 连接失败
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ===== Team Tab ===== */}
      {activeTab === 'interface' && (
        <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 transition-colors">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
                <UserCog className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
                团队成员管理
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">配置管理员与业务员账号权限。共 {users.length} 个账号。</p>
            </div>
            <button onClick={startCreateUser} className="btn-primary shadow-md">
              <Plus className="mr-2 h-4 w-4" />
              新增账号
            </button>
          </div>

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 transition-colors">
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
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-navy dark:bg-tertiary-sage text-[11px] font-black text-white shadow-sm">
                            {managedUser.name?.charAt(0) || '?'}
                          </div>
                          <span className="font-bold text-primary-navy dark:text-white">{managedUser.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-400 font-medium data-field">{managedUser.username}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider
                          ${managedUser.role === 'admin'
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                            : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400'}">
                          {managedUser.role === 'admin' ? '管理员' : '业务员'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                          managedUser.active === false
                            ? 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-600'
                            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          {managedUser.active === false ? '已停用' : '启用中'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => startEditUser(managedUser)} className="rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-tertiary-sage transition-all">
                            编辑
                          </button>
                          <button onClick={() => setResettingUserId(managedUser.id)} className="rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-tertiary-sage transition-all">
                            重置
                          </button>
                          {managedUser.username !== 'root' ? (
                            <button onClick={() => void toggleUserStatus(managedUser)} className="rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-tertiary-sage transition-all">
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

            <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
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
                      className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
                    />
                  </Field>
                ) : (
                  <Field label="用户名">
                    <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-200/50 dark:bg-navy-800/50 px-4 py-3 text-sm text-slate-500 dark:text-slate-500 font-bold">{editingUser.username}</div>
                  </Field>
                )}

                <Field label="成员真实姓名">
                  <input
                    value={userForm.name}
                    onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
                  />
                </Field>

                <Field label="角色权限">
                  <select
                    value={userForm.role}
                    onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value as UserRole }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none appearance-none cursor-pointer text-primary-navy dark:text-white"
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
                      className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
                    />
                  </Field>
                ) : null}

                <div className="flex gap-3 pt-2">
                  <button onClick={saveUser} className="btn-primary shadow-md">
                    {editingUser ? '确认修改' : '立即创建'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingUser(null);
                      setUserForm(EMPTY_USER_FORM);
                      setResettingUserId(null);
                      setResetPassword('');
                    }}
                    className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all"
                  >
                    重置
                  </button>
                </div>
              </div>

              {resettingUserId ? (
                <div className="mt-8 border-t border-slate-200 dark:border-navy-800 pt-6 animate-in fade-in relative">
                  <button onClick={() => setResettingUserId(null)} className="absolute top-6 right-0 text-slate-400 hover:text-primary-navy dark:hover:text-white"><X size={16} /></button>
                  <div className="mb-4 text-xs font-bold text-primary-navy dark:text-tertiary-sage uppercase tracking-widest">强制重置密码</div>
                  <div className="flex gap-3">
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(event) => setResetPassword(event.target.value)}
                      placeholder="新密码(至少6位)"
                      className="flex-1 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none text-primary-navy dark:text-white"
                    />
                    <button onClick={submitResetPassword} className="rounded-lg bg-slate-900 dark:bg-tertiary-sage px-6 py-3 text-sm font-bold text-white hover:bg-black dark:hover:bg-emerald-700 transition-all shadow-md">
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
