import React, { useEffect, useState } from 'react';
import { Bell, X, CheckCircle2, Info, ArrowRight, Trash2 } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../../lib/api';
import { Toast } from '../../features/order-detail/components';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: number;
  title: string;
  message: string;
  link: string;
  is_read: number;
  created_at: string;
}

export function NotificationDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const navigate = useNavigate();

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Notification[]>('/api/notifications');
      setNotifications(data);
    } catch (e) {
      setToast(getErrorMessage(e, '加载通知失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadNotifications();
  }, [isOpen]);

  const markAllRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications(notifications.map(n => ({ ...n, is_read: 1 })));
    } catch (e) {
      setToast(getErrorMessage(e, '操作失败'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm h-full bg-white dark:bg-navy-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-navy-800">
          <div className="flex items-center gap-3">
             <Bell size={18} className="text-primary-navy dark:text-tertiary-sage" />
             <h2 className="text-[15px] font-extrabold text-primary-navy dark:text-white uppercase tracking-tight">消息中心</h2>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-primary-navy dark:hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
           {loading ? (
             <div className="py-20 text-center text-slate-400 text-xs font-bold uppercase animate-pulse">正在同步消息...</div>
           ) : notifications.length > 0 ? (
             <div className="space-y-1">
                {notifications.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => {
                      if (n.link) navigate(n.link);
                      onClose();
                    }}
                    className={`p-4 rounded-lg transition-all cursor-pointer group ${n.is_read ? 'opacity-60' : 'bg-slate-50 dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800 shadow-sm'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                       <h3 className={`text-[13px] font-bold ${n.is_read ? 'text-slate-500' : 'text-primary-navy dark:text-white'}`}>{n.title}</h3>
                       {!n.is_read && <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">{n.message}</p>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                       <span>{n.created_at.slice(0, 16).replace('T', ' ')}</span>
                       <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-primary-navy dark:text-tertiary-sage">查看详情 <ArrowRight size={12} /></span>
                    </div>
                  </div>
                ))}
             </div>
           ) : (
             <div className="py-20 text-center">
                <Bell size={48} className="mx-auto mb-4 text-slate-100 dark:text-navy-800" />
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">暂无新消息</div>
             </div>
           )}
        </div>

        {notifications.some(n => !n.is_read) && (
          <div className="p-4 border-t border-slate-100 dark:border-navy-800">
            <button 
              onClick={markAllRead}
              className="w-full py-2.5 rounded-lg bg-slate-50 dark:bg-navy-950 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors border border-slate-100 dark:border-navy-800"
            >
              全部标记为已读
            </button>
          </div>
        )}
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
