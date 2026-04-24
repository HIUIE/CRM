import React, { useEffect, useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '../lib/api';
import type { AiSettings } from '../types/crm';

interface ParseResult {
  customerName: string;
  country: string;
  logistics: string;
  payment: string;
  totalAmount: number;
  details: string;
  suggestedReply: string;
}

export default function AIAssistantView() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        const data = await apiFetch<AiSettings>('/api/settings/ai');
        if (mounted) {
          setSettings(data);
        }
      } catch (_error) {
        if (mounted) {
          setSettings({ model: 'deepseek-chat', hasApiKey: false, baseUrl: '' });
        }
      }
    };

    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const handleParse = async () => {
    if (!text.trim()) {
      setError('请先输入需要解析的邮件、聊天记录或需求描述');
      return;
    }

    setLoading(true);
    setResult(null);
    setError('');

    try {
      const data = await apiFetch<ParseResult>('/api/ai/parse-order', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setResult(data);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '解析失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  const handleUseAsDraft = () => {
    if (!result) {
      return;
    }

    navigate('/orders?create=1', {
      state: {
        orderDraft: {
          customerName: result.customerName,
          details: `${result.details}\n\n付款信息：${result.payment || '未提取到'}\n物流要求：${result.logistics || '未提取到'}`,
          totalAmount: Number(result.totalAmount) || 0,
        },
      },
    });
  };

  const providerLabel = settings?.model?.toLowerCase().includes('deepseek')
    ? 'DeepSeek'
    : settings?.model?.toLowerCase().includes('gemini')
      ? 'Gemini'
      : '当前模型';
  const aiReady = Boolean(settings?.hasApiKey);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              AI 助手
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">AI 外贸辅助引擎</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              AI 目前只承担两件事：把文本整理成订单草稿，以及辅助识别订单风险。它不会阻塞客户、订单、财务和物流的日常主流程。
            </p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50">
            <Bot className="h-8 w-8 text-indigo-600" />
          </div>
        </div>

        {!aiReady ? (
          <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {!settings?.hasApiKey
              ? '还没有配置可用的 AI API Key。你仍然可以正常使用 CRM 主流程，等需要时再到系统设置中开启 AI。'
              : `${providerLabel} 当前还不可用，请检查系统设置中的模型、Key 和 Base URL。`}
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        ) : null}

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="例如：客户 Amsource 昨天邮件说要 3000 个不锈钢杯，发往洛杉矶，指定货代为东方国际，FOB 宁波，下周一支付 30% 定金，要求加固包装。"
            className="h-56 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500"
            spellCheck={false}
          />

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleParse}
              disabled={loading || !aiReady}
              className="inline-flex items-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Bot className="mr-2 h-4 w-4" />
              {loading ? 'AI 解析中...' : '解析成订单草稿'}
            </button>
          </div>
        </div>
      </div>

      {result ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">提取结果</h3>
              <p className="text-sm text-slate-500">先确认 AI 提取结果，再决定是否带入订单草稿。</p>
            </div>
            <button
              onClick={handleUseAsDraft}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              带入订单草稿
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard label="客户名称" value={result.customerName || '暂无'} />
            <InfoCard label="国家/地区" value={result.country || '暂无'} />
            <InfoCard label="交易金额" value={String(result.totalAmount || 0)} />
            <InfoCard label="付款方式" value={result.payment || '暂无'} />
            <InfoCard label="物流要求" value={result.logistics || '暂无'} className="md:col-span-2" />
            <InfoCard label="订单摘要" value={result.details || '暂无'} className="md:col-span-2" />
            <InfoCard label="建议英文回复" value={result.suggestedReply || '暂无'} className="md:col-span-2" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoCard({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50 p-4 ${className}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</div>
    </div>
  );
}
