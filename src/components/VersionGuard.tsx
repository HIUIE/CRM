import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { apiFetch } from '../lib/api';

const POLLING_INTERVAL = 60 * 1000; // Check every minute

export default function VersionGuard() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const initialStartupTime = useRef<number | null>(null);

  useEffect(() => {
    let timer: number;

    const checkVersion = async () => {
      try {
        const data = await apiFetch<{ startupTime: number }>('/api/health');
        
        if (!data || !data.startupTime) return;

        if (initialStartupTime.current === null) {
          // 首次加载，记录当前服务端的指纹
          initialStartupTime.current = data.startupTime;
        } else if (initialStartupTime.current !== data.startupTime) {
          // 指纹发生变化，说明服务端被重启或发版
          setHasUpdate(true);
        }
      } catch (error) {
        // 忽略网络错误，不打扰用户
      }
    };

    // 初次检测并启动轮询
    void checkVersion();
    timer = window.setInterval(checkVersion, POLLING_INTERVAL);

    return () => window.clearInterval(timer);
  }, []);

  if (!hasUpdate) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-[320px] animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/20 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-500 text-white shadow-inner">
            <Zap size={14} className="fill-current" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-extrabold text-blue-900 dark:text-blue-400 tracking-tight">系统已升级</h3>
            <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600/70 dark:text-blue-400/70 mt-0.5">有新版本发布，请刷新以同步最新功能。</p>
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 dark:bg-blue-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-95"
        >
          <RefreshCw size={14} />
          一键刷新并应用
        </button>
      </div>
    </div>
  );
}
