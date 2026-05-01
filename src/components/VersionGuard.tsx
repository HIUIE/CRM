import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { apiFetch } from '../lib/api';

const POLLING_INTERVAL = 60 * 1000; // Check every minute

// Uses server-side proxy /api/settings/check-update to check GitHub for updates.

async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/settings/check-update?_t=' + Date.now());
    if (!res.ok) return null;
    const data = await res.json();
    if (data.commit) return String(data.commit);
    if (data.version) return String(data.version);
    return null;
  } catch { return null; }
}

export default function VersionGuard() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateType, setUpdateType] = useState<'restart' | 'remote'>('restart');
  const initialStartupTime = useRef<number | null>(null);
  const localCommit = useRef<string>('');

  useEffect(() => {
    fetch('/version.json').then(r => r.json()).then(d => { localCommit.current = d.commit || ''; }).catch(() => {});

    let timer: number;
    const checkVersion = async () => {
      try {
        const health = await apiFetch<{ startupTime: number }>('/api/health');
        if (health?.startupTime) {
          if (initialStartupTime.current === null) initialStartupTime.current = health.startupTime;
          else if (initialStartupTime.current !== health.startupTime) { setUpdateType('restart'); setHasUpdate(true); return; }
        }
        if (localCommit.current) {
          const remote = await fetchRemoteVersion();
          if (remote && remote !== localCommit.current) { setUpdateType('remote'); setHasUpdate(true); }
        }
      } catch { /* ignore */ }
    };
    void checkVersion();
    timer = window.setInterval(checkVersion, POLLING_INTERVAL);
    return () => window.clearInterval(timer);
  }, []);

  if (!hasUpdate) return null;

  return (
    <div className="fixed bottom-24 right-6 z-[9999] w-[340px] animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div className="flex flex-col gap-3 rounded-lg border border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/20 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-500 text-white shadow-inner">
            <Zap size={14} className="fill-current" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-extrabold text-blue-900 dark:text-blue-400 tracking-tight">
              {updateType === 'remote' ? '新版本可用' : '系统已升级'}
            </h3>
            <p className="mt-0.5 text-[11px] font-bold tracking-tight text-blue-600/70 dark:text-blue-400/70">
              {updateType === 'remote'
                ? '有新版本发布，请拉取最新代码并重新构建。'
                : '服务已重启，请刷新以同步最新功能。'}
            </p>
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 dark:bg-blue-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-95"
        >
          <RefreshCw size={14} />
          一键刷新并应用
        </button>
      </div>
    </div>
  );
}
