import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, Paperclip, Loader2, Zap, Database, ShieldCheck } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../../lib/api';
import { hasAiSensitiveText, maskAiSensitiveText } from '../../lib/privacy';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isAction?: boolean;
  images?: string[];
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

const STORAGE_KEY = 'smarttrade_ai_float_history';

const QUICK_ACTIONS = [
  { label: '查看待办任务', icon: <Zap size={14} />, msg: '帮我查看当前有哪些待办任务' },
  { label: '查看逾期收款', icon: <Database size={14} />, msg: '查看逾期未收款' },
  { label: '查订单状态', icon: <ShieldCheck size={14} />, msg: '帮我查一下订单状态' },
];

export default function AIAssistantFloating() {
  const [isSuppressed, setIsSuppressed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
    return [{ role: 'assistant', content: '您好！我是 AI 助手，可以帮您创建任务、查询订单、添加跟进等。有什么需要帮助的吗？' }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const maskedPreview = maskAiSensitiveText(input);
  const shouldShowPrivacyPreview = hasAiSensitiveText(input);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const syncSuppressedState = () => {
      const hasBlockingLayer = Boolean(document.querySelector('[data-modal-layer="true"]'));
      setIsSuppressed(hasBlockingLayer);
      if (hasBlockingLayer) setIsOpen(false);
    };

    syncSuppressedState();
    const observer = new MutationObserver(syncSuppressedState);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    const outboundMsg = maskAiSensitiveText(msg);

    const userMsg: Message = { role: 'user', content: msg, images: uploadedImages.length ? [...uploadedImages] : undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setUploadedImages([]);
    setLoading(true);

    try {
      const response = await apiFetch<AiChatResponse>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: outboundMsg }),
      });
      let content = response.content;
      let isAction = false;
      if (response.action) {
        content = `已执行：${response.action.result.message}`;
        isAction = true;
      }
      if (response.requiresConfirmation && response.pendingAction) {
        setPendingAction(response.pendingAction);
      } else {
        setPendingAction(null);
      }
      setMessages(prev => [...prev, { role: 'assistant', content, isAction }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `诊断反馈：${getErrorMessage(err)}` }]);
    } finally {
      setLoading(false);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction || loading) return;
    setMessages(prev => [...prev, { role: 'user', content: '确认执行' }]);
    setLoading(true);
    try {
      const response = await apiFetch<AiChatResponse>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ pendingAction, confirmAction: true }),
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.action ? `已执行：${response.action.result.message}` : response.content,
        isAction: Boolean(response.action),
      }]);
      setPendingAction(null);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `诊断反馈：${getErrorMessage(err)}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      // Convert to base64 for preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setUploadedImages(prev => [...prev, ev.target!.result as string]);
      };
      reader.readAsDataURL(file);
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  };

  const clearHistory = () => {
    const initial: Message[] = [{ role: 'assistant', content: '对话已重置。请问有什么可以帮您？' }];
    setMessages(initial);
    localStorage.removeItem(STORAGE_KEY);
  };

  if (isSuppressed) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[500] flex h-14 w-14 items-center justify-center rounded-full bg-primary-navy dark:bg-tertiary-sage text-white shadow-2xl hover:scale-110 active:scale-95 transition-all animate-in fade-in"
        title="AI 助手"
      >
        {isOpen ? <X size={24} /> : <Bot size={24} />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[500] w-[380px] max-h-[600px] flex flex-col rounded-2xl border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-2xl animate-in slide-in-from-bottom-8 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-navy-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-navy dark:bg-tertiary-sage text-white shadow-sm">
                <Sparkles size={16} />
              </div>
              <div>
                <div className="text-sm font-bold text-primary-navy dark:text-white">AI 助手</div>
                <div className="text-[10px] font-bold text-slate-400 tracking-tight">随时为您服务</div>
              </div>
            </div>
            <button onClick={clearHistory} className="text-[10px] font-bold text-slate-400 hover:text-error transition-colors tracking-tight">清空</button>
          </div>

          {/* Quick Actions */}
          {messages.length <= 1 && (
            <div className="px-4 py-3 border-b border-slate-50 dark:border-navy-800 flex gap-2 overflow-x-auto shrink-0">
              {QUICK_ACTIONS.map((qa, i) => (
                <button key={i} onClick={() => sendMessage(qa.msg)} className="flex items-center gap-1.5 shrink-0 rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white transition-all whitespace-nowrap">
                  {qa.icon} {qa.label}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[350px]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary-navy dark:bg-tertiary-sage text-white rounded-br-md'
                    : msg.isAction
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 rounded-bl-md border border-emerald-100 dark:border-emerald-900/30'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
                }`}>
                  {msg.images?.map((img, j) => (
                    <img key={j} src={img} alt="" className="max-h-24 rounded-lg mb-2 border border-slate-200 dark:border-navy-700" />
                  ))}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-navy-800 rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image previews */}
          {uploadedImages.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 dark:border-navy-800 flex gap-2 overflow-x-auto shrink-0">
              {uploadedImages.map((img, i) => (
                <div key={i} className="relative group shrink-0">
                  <img src={img} alt="" className="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-navy-700" />
                  <button onClick={() => setUploadedImages(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-all">✕</button>
                </div>
              ))}
            </div>
          )}

          {pendingAction && (
            <div className="shrink-0 border-t border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-900/10">
              <div className="mb-2 truncate text-[11px] font-bold text-amber-800 dark:text-amber-300">待确认操作：{pendingAction.tool}</div>
              <button onClick={confirmPendingAction} disabled={loading} className="w-full rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-amber-800 disabled:opacity-50">
                确认执行
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-slate-100 dark:border-navy-800 shrink-0">
            {shouldShowPrivacyPreview && (
              <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-300">
                <div>将发送脱敏内容：</div>
                <div className="mt-0.5 line-clamp-2 font-medium opacity-90">{maskedPreview}</div>
              </div>
            )}
            <div className="flex items-end gap-2">
              <label className="shrink-0 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-all text-slate-400 hover:text-primary-navy dark:hover:text-white">
                <Paperclip size={18} />
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="输入消息..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-4 py-2.5 text-sm outline-none focus:border-primary-navy dark:focus:border-tertiary-sage transition-all text-primary-navy dark:text-white"
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-navy dark:bg-tertiary-sage text-white shadow-md hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
