import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, FileDigit, KeyRound } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';

interface AiSettings {
  model: string;
  apiKey: string;
  hasApiKey: boolean;
  baseUrl: string;
}

interface DocumentSettings {
  orderNumberPrefix: string;
}

export default function SettingsView() {
  const [model, setModel] = useState('gemini-2.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [orderNumberPrefix, setOrderNumberPrefix] = useState('ORD-');
  const [loading, setLoading] = useState(true);
  const [savedAi, setSavedAi] = useState(false);
  const [savedDocument, setSavedDocument] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        const [aiData, documentData] = await Promise.all([
          apiFetch<AiSettings>('/api/settings/ai'),
          apiFetch<DocumentSettings>('/api/settings/document'),
        ]);
        if (!mounted) {
          return;
        }
        setModel(aiData.model);
        setApiKey(aiData.apiKey);
        setBaseUrl(aiData.baseUrl);
        setHasApiKey(aiData.hasApiKey);
        setOrderNumberPrefix(documentData.orderNumberPrefix || 'ORD-');
      } catch (requestError) {
        if (mounted) {
          setError(getErrorMessage(requestError, '读取系统设置失败'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadSettings();
    return () => {
      mounted = false;
    };
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

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">正在读取系统设置...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {error ? <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center text-lg font-bold text-slate-800">
              <Bot className="mr-2 h-5 w-5 text-blue-600" />
              AI 解析设置
            </h2>
            <p className="mt-1 text-sm text-slate-500">AI 仍然是 Beta 辅助能力，不影响客户、订单、财务、物流的主流程。</p>
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
            <p className="mt-2 text-xs text-slate-400">如果你使用 DeepSeek，模型选 `deepseek-chat`，Base URL 可填 DeepSeek 兼容地址；留空时后端会优先尝试官方默认地址。</p>
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
      </div>
    </div>
  );
}
