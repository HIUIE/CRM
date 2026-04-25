import React, { useEffect, useState } from 'react';
import { Bot, Send, Sparkles, Zap, ShieldCheck, Database, LayoutDashboard, FileText, Trash2 } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'smarttrade_ai_chat_history';

export default function AIAssistantPage() {
  // 1. 初始化时尝试从本地存储读取历史记录
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
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

  // 2. 每当消息列表更新时，自动同步到本地存储
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const clearHistory = () => {
    if (window.confirm('确定要清空所有对话记录吗？')) {
      const initialMsg: Message[] = [{ role: 'assistant', content: '对话已重置。请问还有什么可以帮您？' }];
      setMessages(initialMsg);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setFormInput('');
    setLoading(true);

    try {
      const response = await apiFetch<{ content: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: input })
      });
      setMessages(prev => [...prev, { role: 'assistant', content: response.content }]);
    } catch (err) {
      const detailedError = getErrorMessage(err);
      setMessages(prev => [...prev, { role: 'assistant', content: `诊断反馈：${detailedError}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 shadow-sm transition-colors">
          <div className="flex items-center gap-3 text-tertiary-sage dark:text-emerald-400 mb-2">
            <Zap size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">实时诊断</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">自动识别订单中的潜在逾期风险与财务缺口，并在详情页实时同步。</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 shadow-sm transition-colors">
          <div className="flex items-center gap-3 text-blue-500 dark:text-blue-400 mb-2">
            <Database size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">知识增强</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">结合您的历史客户偏好与物流时效，提供智能化的排产与发货建议。</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 shadow-sm transition-colors">
          <div className="flex items-center gap-3 text-primary-navy dark:text-white mb-2">
            <ShieldCheck size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">合规审计</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">基于最新 HS Code 库，预先校验报关资料的逻辑严密性，减少清关障碍。</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-xl transition-colors relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02] dark:invert pointer-events-none" />
        
        {/* 对话框头部，增加清除记录按钮 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 dark:border-navy-800 bg-slate-50/30 dark:bg-navy-950/30 z-20">
           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <Bot size={14} /> 实时 AI 会话
           </div>
           <button onClick={clearHistory} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="清空对话历史">
              <Trash2 size={16} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`flex max-w-[80%] gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md ${m.role === 'user' ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-slate-100 dark:bg-navy-800 text-primary-navy dark:text-white'}`}>
                  {m.role === 'user' ? <LayoutDashboard size={20} /> : <Bot size={22} />}
                </div>
                <div className={`rounded-2xl px-5 py-3.5 text-sm font-medium leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-slate-50 dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800 text-slate-700 dark:text-slate-200 whitespace-pre-wrap'}`}>
                  {m.content}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-4 items-center">
                 <div className="h-10 w-10 bg-slate-100 dark:bg-navy-800 rounded-xl flex items-center justify-center text-primary-navy dark:text-white animate-pulse"><Sparkles size={20} /></div>
                 <div className="flex gap-1.5 px-4 py-3 bg-slate-50 dark:bg-navy-950/50 rounded-2xl border border-slate-100 dark:border-navy-800">
                    <div className="h-2 w-2 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce" />
                    <div className="h-2 w-2 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="h-2 w-2 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                 </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={sendMessage} className="border-t border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/50 p-4 relative z-10">
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
                  sendMessage(e as any);
                }
              }}
              placeholder="在这里输入业务咨询或指令 (Shift + Enter 换行)..."
              className="flex-1 rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-3.5 text-sm font-medium focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none shadow-inner text-primary-navy dark:text-white min-h-[52px] max-h-[200px] resize-none custom-scrollbar leading-relaxed"
              style={{ height: '52px' }}
            />
            <button
              disabled={loading || !input.trim()}
              type="submit"
              className={`flex items-center justify-center shrink-0 h-[52px] w-[52px] rounded-2xl font-bold transition-all active:scale-95 shadow-lg ${
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
    </div>
  );
}
