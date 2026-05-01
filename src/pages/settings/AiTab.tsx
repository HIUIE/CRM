import React, { useState, useEffect } from 'react';
import { Bot, BrainCircuit, KeyRound, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Field from '../../components/ui/Field';
import { apiFetch, getErrorMessage } from '../../lib/api';

const AI_PROVIDERS = [
  { id: 'deepseek', label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'], baseUrl: 'https://api.deepseek.com', icon: <BrainCircuit size={20} /> },
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini'], baseUrl: 'https://api.openai.com', icon: <Bot size={20} /> },
  { id: 'gemini', label: 'Google Gemini', models: ['gemini-2.5-flash', 'gemini-2.5-pro'], baseUrl: '', icon: <Bot size={20} /> },
];

export default function AiTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userMessage, setUserMessage] = useState('');

  const [model, setModel] = useState('gemini-2.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('deepseek');
  const [savedAi, setSavedAi] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<'idle' | 'success' | 'fail'>('idle');

  useEffect(() => {
    apiFetch<{ model: string; apiKey: string; baseUrl: string; hasApiKey: boolean }>('/api/settings/ai')
      .then(aiData => {
        setModel(aiData.model);
        setApiKey(aiData.apiKey || '');
        setBaseUrl(aiData.baseUrl || '');
        setHasApiKey(aiData.hasApiKey);
        for (const p of AI_PROVIDERS) {
          if (p.models.includes(aiData.model)) { setSelectedProvider(p.id); break; }
        }
      })
      .catch(e => setError(getErrorMessage(e, '读取 AI 设置失败')))
      .finally(() => setLoading(false));
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
    setError(''); setSavedAi(false);
    try {
      await apiFetch('/api/settings/ai', { method: 'POST', body: JSON.stringify({ model, apiKey, baseUrl }) });
      setSavedAi(true);
      setHasApiKey(Boolean(apiKey && apiKey !== '***') || hasApiKey);
      setTimeout(() => setSavedAi(false), 1800);
    } catch (e) { setError(getErrorMessage(e, '保存 AI 设置失败')); }
  };

  const testAiConnection = async () => {
    setTestingAi(true); setAiTestResult('idle');
    try {
      await apiFetch('/api/settings/ai/test', { method: 'POST' });
      setAiTestResult('success');
    } catch (e) {
      setAiTestResult('fail');
      setError(getErrorMessage(e, '连接测试失败'));
    } finally { setTestingAi(false); }
  };

  if (loading) return <div className="p-8 text-sm text-slate-500 animate-pulse">正在读取 AI 配置...</div>;

  return (
    <div className="space-y-8 max-w-4xl">
      {error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
            <Bot className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
            AI 引擎驱动设置
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">配置底层解析模型，优化草稿识别与风险诊断准确率。</p>
        </div>
        <div className={`inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-bold ${hasApiKey ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300' : 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300'}`}>
          <KeyRound className="mr-2 h-3.5 w-3.5" />
          {hasApiKey ? '密钥已就绪' : '未配置 API 密钥'}
        </div>
      </div>

      <div>
        <label className="mb-3 block text-xs font-bold tracking-tight text-primary-navy dark:text-white">选择 AI 服务商</label>
        <div className="grid grid-cols-3 gap-3">
          {AI_PROVIDERS.map(p => (
            <button key={p.id} onClick={() => handleProviderChange(p.id)} className={`flex items-center gap-3 rounded-lg border p-4 transition-all ${selectedProvider === p.id ? 'border-primary-navy bg-slate-50 dark:border-tertiary-sage dark:bg-navy-800' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-navy-800 dark:bg-navy-900 dark:hover:border-navy-700'}`}>
              <div className={`rounded-lg p-2 ${selectedProvider === p.id ? 'bg-primary-navy text-white dark:bg-tertiary-sage' : 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400'}`}>{p.icon}</div>
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
          <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-primary-navy outline-none transition-colors focus:border-primary-navy dark:border-navy-800 dark:bg-navy-950 dark:text-white dark:focus:border-tertiary-sage">
            {AI_PROVIDERS.find(p => p.id === selectedProvider)?.models.map(m => <option key={m} value={m}>{m}</option>)}
            <option value="custom">-- 自定义型号 --</option>
          </select>
        </Field>
        <Field label="自定义模型 ID">
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="如 deepseek-chat" className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-primary-navy outline-none transition-colors focus:border-primary-navy dark:border-navy-800 dark:bg-navy-950 dark:text-white dark:focus:border-tertiary-sage" />
        </Field>
      </div>

      <Field label="API 访问密钥 (API Key)" className="max-w-lg">
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="留空表示沿用现有密钥" className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-primary-navy outline-none transition-colors focus:border-primary-navy dark:border-navy-800 dark:bg-navy-950 dark:text-white dark:focus:border-tertiary-sage" />
      </Field>

      <Field label="自定义 API 代理地址 (Base URL)" className="max-w-lg">
        <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={AI_PROVIDERS.find(p => p.id === selectedProvider)?.baseUrl || 'https://api.deepseek.com'} className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-primary-navy outline-none transition-colors focus:border-primary-navy dark:border-navy-800 dark:bg-navy-950 dark:text-white dark:focus:border-tertiary-sage" />
      </Field>

      <div className="flex gap-3">
        <button onClick={saveAiSettings} className="btn-primary shadow-md">
          {savedAi ? <><CheckCircle2 className="mr-2 h-4 w-4" />配置已更新</> : '保存 AI 引擎配置'}
        </button>
        <button onClick={testAiConnection} disabled={testingAi} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-navy-800">
          {testingAi ? <Loader2 size={16} className="animate-spin" /> : <AlertCircle size={16} />}
          {testingAi ? '测试中...' : '测试连接'}
        </button>
        {aiTestResult === 'success' && <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={14} /> 连接成功</span>}
        {aiTestResult === 'fail' && <span className="flex items-center gap-1 text-xs font-bold text-red-600"><AlertCircle size={14} /> 连接失败</span>}
      </div>
    </div>
  );
}
