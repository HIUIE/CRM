import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Download, FileDigit, KeyRound, Shield, UserCog, Settings, Layout, BrainCircuit, Plus, X, Globe, DollarSign, AlertCircle, Loader2, RefreshCw, GitBranch, Clock, ExternalLink, Bell, Upload, DatabaseBackup, PackageSearch } from 'lucide-react';
import Field from '../components/ui/Field';
import { apiDownload, apiFetch, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import FilterPill from '../components/ui/FilterPill';
import ImportModal from '../components/ui/ImportModal';
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

type SettingsTab = 'general' | 'data' | 'interface' | 'ai' | 'update';

interface VersionInfo {
  version: string;
  buildTime: string;
  commit: string;
}

const AI_PROVIDERS = [
  { id: 'deepseek', label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'], baseUrl: 'https://api.deepseek.com', icon: <BrainCircuit size={20} /> },
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini'], baseUrl: 'https://api.openai.com', icon: <Bot size={20} /> },
  { id: 'gemini', label: 'Google Gemini', models: ['gemini-2.5-flash', 'gemini-2.5-pro'], baseUrl: '', icon: <Bot size={20} /> },
];

const EXPORT_FORMATS = [
  {
    id: 'xlsx',
    title: 'Excel 工作簿（推荐）',
    desc: '单个 XLSX 文件，包含 12 个 Sheet：订单、商品明细、财务流水、物流、报关、生产、装箱、客户、合作伙伴、任务、客户跟进、订单跟进。带自动筛选和表头样式。',
    icon: <FileDigit size={20} />,
  },
  {
    id: 'customer-archive',
    title: '客户订单归档（ZIP）',
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
  const [siteName, setSiteName] = useState('SmartTrade AI CRM');
  const [siteSlogan, setSiteSlogan] = useState('');
  const [siteLogo, setSiteLogo] = useState('');
  const [siteFavicon, setSiteFavicon] = useState('');
  const [savedSite, setSavedSite] = useState(false);
  const [uploadingBrand, setUploadingBrand] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savedWebhook, setSavedWebhook] = useState(false);
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
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'customer-archive' | 'zip-csv'>('xlsx');
  const [importEntityType, setImportEntityType] = useState<'CUSTOMER' | 'ORDER' | null>(null);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<'idle' | 'success' | 'fail'>('idle');
  const [selectedProvider, setSelectedProvider] = useState('deepseek');
  const [localVersion, setLocalVersion] = useState<VersionInfo | null>(null);
  const [remoteVersion, setRemoteVersion] = useState<VersionInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState<string[]>([]);

  const isAdmin = user?.role === 'admin';

  const loadSettings = async () => {
    try {
      const [aiData, documentData, userData, basicData, webhookData] = await Promise.all([
        apiFetch<AiSettings>('/api/settings/ai'),
        isAdmin ? apiFetch<DocumentSettings>('/api/settings/document') : Promise.resolve({ orderNumberPrefix: 'ORD-' }),
        isAdmin ? apiFetch<ManagedUser[]>('/api/users') : Promise.resolve([]),
        apiFetch<{ siteName: string; siteSlogan: string; siteLogo: string; siteFavicon: string }>('/api/settings/basic'),
        apiFetch<{ webhookUrl: string }>('/api/settings/webhook').catch(() => ({ webhookUrl: '' })),
      ]);

      setModel(aiData.model);
      setApiKey(aiData.apiKey || '');
      setBaseUrl(aiData.baseUrl || '');
      setHasApiKey(aiData.hasApiKey);
      setOrderNumberPrefix(documentData.orderNumberPrefix || 'ORD-');
      setUsers(userData);
      setSiteName(basicData.siteName || 'SmartTrade AI CRM');
      setSiteSlogan(basicData.siteSlogan || '');
      setSiteLogo(basicData.siteLogo || '');
      setSiteFavicon(basicData.siteFavicon || '');
      setWebhookUrl(webhookData.webhookUrl || '');

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
    // Load local version info
    fetch('/version.json').then(r => r.json()).then(setLocalVersion).catch(() => {});
  }, []);

  const checkForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch('/api/settings/check-update?_t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        setRemoteVersion(data);
      }
    } catch { /* ignore */ }
    setCheckingUpdate(false);
  };

  const doUpdate = async () => {
    if (!window.confirm('确定要执行系统更新吗？服务将在更新完成后自动重启，耗时约 1-2 分钟。')) return;
    setUpdating(true);
    setUpdateLog([]);
    try {
      const res = await fetch('/api/settings/system/update', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      setUpdateLog(prev => [...prev, data.message || '更新命令已发送...']);
      if (data.success) {
        setTimeout(() => window.location.reload(), 3000);
      }
    } catch (e) {
      setUpdateLog(prev => [...prev, `错误: ${getErrorMessage(e)}`]);
      setUpdating(false);
    }
  };

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

  const saveWebhook = async () => {
    setError('');
    setSavedWebhook(false);
    try {
      await apiFetch('/api/settings/webhook', { method: 'POST', body: JSON.stringify({ webhookUrl }) });
      setSavedWebhook(true);
      window.setTimeout(() => setSavedWebhook(false), 1800);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '保存失败'));
    }
  };

  const saveSiteSettings = async () => {
    setError('');
    setSavedSite(false);
    try {
      await apiFetch('/api/settings/basic', {
        method: 'POST',
        body: JSON.stringify({ siteName, siteSlogan, siteLogo, siteFavicon }),
      });
      setSavedSite(true);
      window.setTimeout(() => setSavedSite(false), 1800);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '保存站点设置失败'));
    }
  };

  const uploadBrandFile = async (type: 'logo' | 'favicon') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/svg+xml,image/x-icon,.ico';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingBrand(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const result = await apiFetch<{ url: string }>('/api/settings/brand/upload', {
          method: 'POST',
          body: fd,
        });
        if (type === 'logo') setSiteLogo(result.url);
        else setSiteFavicon(result.url);
      } catch (e) {
        setError(getErrorMessage(e, '上传失败'));
      } finally {
        setUploadingBrand(false);
      }
    };
    input.click();
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
      const url = exportFormat === 'xlsx' ? '/api/settings/export/xlsx' : `/api/settings/export?format=${exportFormat}`;
      await apiDownload(url);
      const labels: Record<string, string> = { 'xlsx': 'Excel 工作簿', 'customer-archive': '客户订单归档', 'zip-csv': 'CSV 表格' };
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
    <div className="mx-auto w-[85%] max-w-[1440px] space-y-6">
      <div className="flex bg-white dark:bg-navy-900 p-1 rounded-lg border border-slate-200 dark:border-navy-800 w-fit transition-colors">
         <button onClick={() => setActiveTab('general')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><Settings size={16} /> 常规配置</button>
         <button onClick={() => setActiveTab('data')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'data' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><Download size={16} /> 数据管理</button>
         <button onClick={() => setActiveTab('interface')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'interface' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><Layout size={16} /> 团队管理</button>
         <button onClick={() => setActiveTab('ai')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ai' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><BrainCircuit size={16} /> AI 配置</button>
         <button onClick={() => setActiveTab('update')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'update' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><RefreshCw size={16} /> 版本更新</button>
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

          <div className="space-y-8 max-w-4xl">
            {/* Site Brand Settings */}
            <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
              <h3 className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-4">
                <Globe size={16} /> 站点基本设置
              </h3>
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="站点名称">
                    <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="如 SmartTrade AI CRM" className="w-full max-w-md rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy outline-none text-primary-navy dark:text-white" />
                  </Field>
                  <Field label="站点口号">
                    <input value={siteSlogan} onChange={e => setSiteSlogan(e.target.value)} placeholder="如 专业的外贸业务管理专家" className="w-full max-w-md rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy outline-none text-primary-navy dark:text-white" />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="站点 Logo（建议 200×200px PNG）">
                    <div className="flex items-center gap-3">
                      {siteLogo ? (
                        <div className="relative group">
                          <img src={siteLogo} alt="Logo" className="h-12 w-12 rounded-lg object-contain border border-slate-200 dark:border-navy-700 bg-white" />
                          <button onClick={() => setSiteLogo('')} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all">✕</button>
                        </div>
                      ) : null}
                      <button onClick={() => void uploadBrandFile('logo')} disabled={uploadingBrand} className="rounded-lg border border-slate-200 dark:border-navy-700 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800 transition-all disabled:opacity-50">
                        {uploadingBrand ? '上传中...' : '选择图片'}
                      </button>
                    </div>
                  </Field>
                  <Field label="Favicon（建议 32×32px ICO/PNG）">
                    <div className="flex items-center gap-3">
                      {siteFavicon ? (
                        <div className="relative group">
                          <img src={siteFavicon} alt="Favicon" className="h-8 w-8 rounded object-contain border border-slate-200 dark:border-navy-700 bg-white" />
                          <button onClick={() => setSiteFavicon('')} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all">✕</button>
                        </div>
                      ) : null}
                      <button onClick={() => void uploadBrandFile('favicon')} disabled={uploadingBrand} className="rounded-lg border border-slate-200 dark:border-navy-700 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800 transition-all disabled:opacity-50">
                        {uploadingBrand ? '上传中...' : '选择文件'}
                      </button>
                    </div>
                  </Field>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={saveSiteSettings} className="btn-primary shadow-md">
                    {savedSite ? <><CheckCircle2 className="mr-2 h-4 w-4" />已保存</> : '保存站点设置'}
                  </button>
                </div>
              </div>
            </div>

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
                    className="w-full max-w-xs rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
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

            {/* Webhook Notification */}
            <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
              <h3 className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-4">
                <Bell size={16} /> 消息通知（企业微信机器人）
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium">配置后，新订单创建时将自动推送通知到企业微信群。</p>
              <div className="flex gap-3 items-end">
                <div className="flex-1 max-w-xl">
                  <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm outline-none focus:border-primary-navy data-field text-primary-navy dark:text-white" />
                </div>
                <button onClick={saveWebhook} className="btn-primary shadow-md shrink-0">{savedWebhook ? '已保存' : '保存'}</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== Data Tab (Import + Export) ===== */}
      {activeTab === 'data' && (
        <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 transition-colors">
          {/* Import Section */}
          <div className="mb-10">
            <div className="mb-6">
              <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
                <Upload className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
                数据导入
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">批量导入客户或订单数据，支持 XLSX、CSV 及系统备份 ZIP。</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <button
                onClick={() => setImportEntityType('CUSTOMER')}
                className="flex items-start gap-4 p-5 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 hover:border-primary-navy dark:hover:border-tertiary-sage transition-all text-left"
              >
                <div className="p-2 rounded-lg bg-primary-navy dark:bg-tertiary-sage text-white shrink-0">
                  <PackageSearch size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-primary-navy dark:text-white mb-1">导入客户数据</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">从 XLSX/CSV 文件中批量导入客户资料，支持自动匹配字段。</div>
                </div>
              </button>

              <button
                onClick={() => setImportEntityType('ORDER')}
                className="flex items-start gap-4 p-5 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 hover:border-primary-navy dark:hover:border-tertiary-sage transition-all text-left"
              >
                <div className="p-2 rounded-lg bg-primary-navy dark:bg-tertiary-sage text-white shrink-0">
                  <FileDigit size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-primary-navy dark:text-white mb-1">导入订单数据</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">从 XLSX/CSV 文件中批量导入订单，需确保客户名称匹配已有客户。</div>
                </div>
              </button>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-slate-50 dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800 flex items-start gap-3">
              <DatabaseBackup size={16} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                也支持上传系统导出的 ZIP 备份包直接还原，系统会自动识别客户和订单数据。
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-navy-800 pt-10">
            {/* Export Section (existing) */}
            <div className="mb-6">
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
                  onClick={() => setExportFormat(fmt.id as typeof exportFormat)}
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

          <div className="space-y-8 max-w-4xl">
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

            <Field label="API 访问密钥 (API Key)" className="max-w-lg">
              <div className="flex gap-3">
                <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="留空表示沿用现有密钥" className="flex-1 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white" />
              </div>
            </Field>

            <Field label="自定义 API 代理地址 (Base URL)" className="max-w-lg">
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
                  <Field label="用户名" className="max-w-sm">
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

                <Field label="成员真实姓名" className="max-w-sm">
                  <input
                    value={userForm.name}
                    onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
                  />
                </Field>

                <Field label="角色权限" className="max-w-sm">
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
                  <Field label="初始访问密码" className="max-w-sm">
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
                      className="flex-1 max-w-xs rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage outline-none text-primary-navy dark:text-white"
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

      {/* Import Modal */}
      <ImportModal
        isOpen={importEntityType !== null}
        onClose={() => setImportEntityType(null)}
        onSuccess={() => setImportEntityType(null)}
        entityType={importEntityType || 'CUSTOMER'}
      />

      {/* ===== Version Update Tab ===== */}
      {activeTab === 'update' && (
        <section className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 transition-colors">
          <div className="mb-8">
            <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
              <RefreshCw className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
              系统版本
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">查看当前版本并检查更新。</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Current Version */}
            <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
              <div className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-5">
                <CheckCircle2 size={16} className="text-emerald-500" />
                当前版本
              </div>
              {localVersion ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-navy-800">
                    <span className="text-xs font-bold text-slate-500">版本号</span>
                    <span className="text-sm font-black text-primary-navy dark:text-white data-field">{localVersion.version}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-navy-800">
                    <span className="text-xs font-bold text-slate-500">构建时间</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{new Date(localVersion.buildTime).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs font-bold text-slate-500">提交哈希</span>
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{localVersion.commit}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400">无法读取版本信息</div>
              )}
            </div>

            {/* Remote Version / Update Check */}
            <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white">
                  <RefreshCw size={16} className="text-blue-500" />
                  检查更新
                </div>
                <button onClick={checkForUpdates} disabled={checkingUpdate} className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800 transition-all disabled:opacity-50">
                  {checkingUpdate ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  {checkingUpdate ? '检测中...' : '检测更新'}
                </button>
              </div>

              {remoteVersion ? (
                remoteVersion.version !== localVersion?.version ? (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 mb-3">
                      <ExternalLink size={14} /> 新版本可用
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-500">最新版本</span>
                        <span className="font-black text-primary-navy dark:text-white data-field">{remoteVersion.version}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-500">发布时间</span>
                        <span className="font-bold text-slate-700">{new Date(remoteVersion.buildTime).toLocaleString('zh-CN')}</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-900/10 p-4 border border-blue-100 dark:border-blue-900/30">
                      <p className="text-xs text-blue-700 dark:text-blue-400 font-medium leading-relaxed">
                        请拉取最新代码并重新构建以更新系统：
                      </p>
                      <code className="mt-2 block text-xs bg-white dark:bg-navy-900 px-3 py-2 rounded border border-blue-100 dark:border-blue-900/30 font-mono text-slate-700 dark:text-slate-300">
                        git pull &amp;&amp; npm install &amp;&amp; npm run build &amp;&amp; npm start
                      </code>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={16} /> 已是最新版本
                  </div>
                )
              ) : remoteVersion?.error ? (
                <div className="text-sm text-amber-600 dark:text-amber-400">{remoteVersion.error}。请确保已执行 git push，或设置 GITHUB_TOKEN (私有仓库需要)。</div>
              ) : (
                <div className="text-sm text-slate-400">点击"检测更新"查看是否有新版本可用。</div>
              )}

              {/* Update trigger */}
              {remoteVersion && remoteVersion.version !== localVersion?.version && (
                <div className="mt-5 pt-5 border-t border-slate-200 dark:border-navy-800">
                  <button onClick={doUpdate} disabled={updating} className="btn-primary w-full justify-center shadow-md disabled:opacity-60">
                    {updating ? <Loader2 size={16} className="animate-spin mr-2" /> : <RefreshCw size={16} className="mr-2" />}
                    {updating ? '正在更新...' : '一键更新系统'}
                  </button>
                  {updateLog.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-100 dark:bg-navy-800 text-xs font-mono text-slate-600 dark:text-slate-400 space-y-1 max-h-24 overflow-y-auto">
                      {updateLog.map((log, i) => <div key={i}>{log}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {localVersion && (
            <div className="mt-6 rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
              <div className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-3">
                <Clock size={16} /> 更新指引
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                系统更新需要服务器管理员在终端执行命令。部署完成后，所有在线用户将自动收到"系统已升级"的刷新提示。
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
