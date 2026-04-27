import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { apiFetch } from '../lib/api';

const POLLING_INTERVAL = 60 * 1000; // Check every minute

// Set VITE_UPDATE_URL in .env to enable remote version checking.
// Example: VITE_UPDATE_URL=https://raw.githubusercontent.com/your-org/smarttrade-crm/main/dist/version.json
// The URL should host a version.json file with { version, commit, buildTime } format.
// If not set, only local server restart detection is used.
const REMOTE_UPDATE_URL = import.meta.env.VITE_UPDATE_URL || '';

export default function VersionGuard() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateType, setUpdateType] = useState<'restart' | 'remote'>('restart');
  const initialStartupTime = useRef<number | null>(null);
  const localVersion = useRef<string>('');

  useEffect(() => {
    // Read local version from built version.json
    fetch('/version.json')
      .then(r => r.json())
      .then(data => { localVersion.current = data.version || ''; })
      .catch(() => {});

    let timer: number;

    const checkVersion = async () => {
      try {
        // 1. Check local server restart (existing behavior)
        const data = await apiFetch<{ startupTime: number }>('/api/health');
        if (data?.startupTime) {
          if (initialStartupTime.current === null) {
            initialStartupTime.current = data.startupTime;
          } else if (initialStartupTime.current !== data.startupTime) {
            setUpdateType('restart');
            setHasUpdate(true);
            return;
          }
        }

        // 2. Check remote version (for distributed users)
        if (REMOTE_UPDATE_URL && localVersion.current) {
          const remoteRes = await fetch(REMOTE_UPDATE_URL + '?t=' + Date.now());
          if (remoteRes.ok) {
            const remote = await remoteRes.json();
            if (remote.version && remote.version !== localVersion.current) {
              setUpdateType('remote');
              setHasUpdate(true);
            }
          }
        }
      } catch {
        // Ignore network errors
      }
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
            <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600/70 dark:text-blue-400/70 mt-0.5">
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
