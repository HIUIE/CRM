import React, { useEffect, useState } from 'react';
import { Bot, Send, Sparkles, Zap, ShieldCheck, Database, LayoutDashboard, Trash2 } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { hasAiSensitiveText, maskAiSensitiveText } from '../lib/privacy';
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type PendingAction = {
  tool: string;
  params: Record<string, string>;
};

type AiChatResponse = {
  content: string;
  requiresConfirmation?: boolean;
  pendingAction?: PendingAction;
  action?: { tool: string; result: { message: string } };
};

const STORAGE_KEY = 'smarttrade_ai_chat_history';
const LEGACY_LOCAL_STORAGE_KEY = STORAGE_KEY;

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load chat history', e);
      }
    }
    return [
      { role: 'assistant', content: '您好！我是 SmartTrade AI 业务向导。我可以帮您分析订单风险、生成报关草单建议，或者回答关于业务流程的问题。请问今天有什么可以帮您？' }
    ];
  });
  
  const [input, setFormInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const maskedPreview = maskAiSensitiveText(input);
  const shouldShowPrivacyPreview = hasAiSensitiveText(input);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
  }, [messages]);

  const clearHistory = () => {
    setIsClearing(true);
    const initialMsg: Message[] = [{ role: 'assistant', content: '对话已重置。请问还有什么可以帮您？' }];
    setMessages(initialMsg);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
    setShowClearConfirm(false);
    setIsClearing(false);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const originalInput = input;
    const outboundInput = maskAiSensitiveText(input);
    const userMsg: Message = { role: 'user', content: originalInput };
    setMessages(prev => [...prev, userMsg]);
    setFormInput('');
    setLoading(true);

    try {
      // P12: Send history for context, but limit to last 10 messages
      const history = messages.slice(-10);

      const response = await apiFetch<AiChatResponse>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: outboundInput, history })
      });
      let msg = response.content;
      if (response.action) {
        msg = `已执行：${response.action.result.message}`;
      }
      if (response.requiresConfirmation && response.pendingAction) {
        setPendingAction(response.pendingAction);
      } else {
        setPendingAction(null);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    } catch (err) {
      const detailedError = getErrorMessage(err);
      setMessages(prev => [...prev, { role: 'assistant', content: `诊断反馈：${detailedError}` }]);
    } finally {
      setLoading(false);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction || loading) return;
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: '确认执行' }]);
    try {
      const response = await apiFetch<AiChatResponse>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ pendingAction, confirmAction: true }),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: response.action ? `已执行：${response.action.result.message}` : response.content }]);
      setPendingAction(null);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `诊断反馈：${getErrorMessage(err)}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col gap-4 animate-page-in">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-4 shadow-sm transition-colors">
          <div className="flex items-center gap-3 text-tertiary-sage dark:text-emerald-400 mb-2">
            <Zap size={18} />
            <span className="text-xs font-bold tracking-tight">实时诊断</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">自动识别订单中的潜在逾期风险与财务缺口，并在详情页实时同步。</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-4 shadow-sm transition-colors">
          <div className="flex items-center gap-3 text-blue-500 dark:text-blue-400 mb-2">
            <Database size={18} />
            <span className="text-xs font-bold tracking-tight">知识增强</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">结合您的历史客户偏好与物流时效，提供智能化的排产与发货建议。</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 p-4 shadow-sm transition-colors">
          <div className="flex items-center gap-3 text-primary-navy dark:text-white mb-2">
            <ShieldCheck size={18} />
            <span className="text-xs font-bold tracking-tight">合规审计</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">基于最新 HS Code 库，预先校验报关资料的逻辑严密性，减少清关障碍。</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-xl transition-colors relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02] dark:invert pointer-events-none" />
        
        {/* 对话框头部，增加清除记录按钮 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 dark:border-navy-800 bg-slate-50/30 dark:bg-navy-950/30 z-20">
           <div className="flex items-center gap-2 text-xs font-bold text-slate-400 tracking-tight">
              <Bot size={14} /> 实时 AI 会话
           </div>
           <button onClick={() => setShowClearConfirm(true)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="清空对话历史">
              <Trash2 size={16} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`flex max-w-[80%] gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-md ${m.role === 'user' ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-slate-100 dark:bg-navy-800 text-primary-navy dark:text-white'}`}>
                  {m.role === 'user' ? <LayoutDashboard size={20} /> : <Bot size={22} />}
                </div>
                <div className={`rounded-lg px-5 py-3.5 text-sm font-medium leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-slate-50 dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800 text-slate-700 dark:text-slate-200 whitespace-pre-wrap'}`}>
                  {m.content}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-4 items-center">
                 <div className="h-10 w-10 bg-slate-100 dark:bg-navy-800 rounded-lg flex items-center justify-center text-primary-navy dark:text-white animate-pulse"><Sparkles size={20} /></div>
                 <div className="flex gap-1.5 px-4 py-3 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-100 dark:border-navy-800">
                    <div className="h-2 w-2 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce" />
                    <div className="h-2 w-2 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="h-2 w-2 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                 </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={sendMessage} className="border-t border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/50 p-4 relative z-10">
          {pendingAction && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
              <span className="min-w-0 truncate">待确认操作：{pendingAction.tool}</span>
              <button type="button" onClick={confirmPendingAction} disabled={loading} className="shrink-0 rounded-md bg-amber-700 px-3 py-1.5 text-white disabled:opacity-50">
                确认执行
              </button>
            </div>
          )}
          {shouldShowPrivacyPreview && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-300">
              <div className="mb-1">发送前将自动脱敏，实际发送内容预览：</div>
              <div className="line-clamp-2 font-medium opacity-90">{maskedPreview}</div>
            </div>
          )}
          <div className="relative flex items-end gap-3 max-w-4xl mx-auto">
            <textarea
              value={input}
              onChange={(e) => {
                setFormInput(e.target.value);
                e.target.style.height = '52px';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e as unknown as React.FormEvent);
                }
              }}
              placeholder="在这里输入业务咨询或指令 (Shift + Enter 换行)..."
              className="flex-1 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-6 py-3.5 text-sm font-medium focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none shadow-inner text-primary-navy dark:text-white min-h-[52px] max-h-[200px] resize-none custom-scrollbar leading-relaxed"
              style={{ height: '52px' }}
            />
            <button
              disabled={loading || !input.trim()}
              type="submit"
              className={`flex items-center justify-center shrink-0 h-[52px] w-[52px] rounded-lg font-bold transition-all active:scale-95 shadow-lg ${
                input.trim() 
                  ? 'bg-primary-navy dark:bg-tertiary-sage text-white hover:bg-slate-800 dark:hover:bg-emerald-700' 
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send size={20} className={input.trim() ? 'ml-1' : ''} />
            </button>
          </div>
        </form>
      </div>

      <ConfirmDeleteModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={clearHistory}
        title="清空 AI 对话"
        warning="确定要清空所有 AI 对话记录吗？此操作只会清除当前浏览器中的对话历史，不会影响业务数据。"
        entityLabel="确认文本"
        entityId="清空对话"
        isDeleting={isClearing}
        showCopy={false}
      />
    </div>
  );
}
