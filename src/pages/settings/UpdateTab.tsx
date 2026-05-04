import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Loader2, ExternalLink, Clock } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../../lib/api';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';

export default function UpdateTab() {
  const [loading, setLoading] = useState(true);
  const [localVersion, setLocalVersion] = useState<any>(null);
  const [remoteVersion, setRemoteVersion] = useState<any>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [updateStatus, setUpdateStatus] = useState<any>(null);
  const [updateHistory, setUpdateHistory] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<any>('/api/settings/system/version').catch(() => null),
      apiFetch<any[]>('/api/settings/system/update/history').catch(() => []),
    ]).then(([version, history]) => {
      setLocalVersion(version);
      setUpdateHistory(history);
    }).finally(() => setLoading(false));

    const checkStatus = async () => {
      try {
        const s = await apiFetch<any>('/api/settings/system/update/status');
        setUpdateStatus(s);
        setUpdating(s?.phase === 'running' || s?.phase === 'restarting');
      } catch (e) {}
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkForUpdates = async () => {
    setCheckingUpdate(true);
    setError('');
    try {
      const res = await apiFetch<any>('/api/settings/system/check-update', { method: 'POST' });
      setRemoteVersion(res);
    } catch (e) {
      setError(getErrorMessage(e, '检查更新失败'));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const doUpdate = async () => {
    setShowUpdateConfirm(false);
    setUpdating(true);
    setError('');
    setUpdateLog(['正在初始化更新环境...']);
    try {
      await apiFetch('/api/settings/system/update', { method: 'POST' });
    } catch (e) {
      setError(getErrorMessage(e, '触发更新失败'));
      setUpdating(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-500 animate-pulse">正在读取系统配置...</div>;

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
          <RefreshCw className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
          系统版本
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">查看当前版本并检查更新。</p>
      </div>

      {error && <div className="rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
          <div className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-5">
            <CheckCircle2 size={16} className="text-emerald-500" /> 当前版本
          </div>
          {localVersion ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-navy-800">
                <span className="text-xs font-bold text-slate-500">版本号</span>
                <span className="text-sm font-black text-primary-navy dark:text-white">{localVersion.version}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-navy-800">
                <span className="text-xs font-bold text-slate-500">构建时间</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {localVersion.buildTime ? new Date(localVersion.buildTime).toLocaleString('zh-CN') : '未知'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-bold text-slate-500">提交哈希</span>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{localVersion.commit}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400">无法读取版本信息</div>
          )}
        </div>

        <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white">
              <RefreshCw size={16} className="text-blue-500" /> 检查更新
            </div>
            <button onClick={checkForUpdates} disabled={checkingUpdate} className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-surface dark:hover:bg-navy-800 transition-all disabled:opacity-50">
              {checkingUpdate ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {checkingUpdate ? '检测中...' : '检测更新'}
            </button>
          </div>

          {remoteVersion ? (
            remoteVersion.version !== localVersion?.version ? (
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 mb-3"><ExternalLink size={14} /> 新版本可用</div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs"><span className="font-bold text-slate-500">最新版本</span><span className="font-black text-primary-navy dark:text-white">{remoteVersion.version}</span></div>
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-500">发布时间</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {remoteVersion.buildTime ? new Date(remoteVersion.buildTime).toLocaleString('zh-CN') : '未知'}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/10 p-4 border border-blue-100 dark:border-blue-900/30">
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-medium leading-relaxed">请拉取最新代码并重新构建以更新系统：</p>
                  <code className="mt-2 block text-xs bg-surface dark:bg-navy-900 px-3 py-2 rounded border border-blue-100 dark:border-blue-900/30 font-mono text-slate-700 dark:text-slate-300">
                    git pull && npm install && npm run build && npm start
                  </code>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={16} /> 已是最新版本</div>
            )
          ) : (
            <div className="text-sm text-slate-400">点击"检测更新"查看是否有新版本可用。</div>
          )}

          {remoteVersion && remoteVersion.version !== localVersion?.version && (
            <div className="mt-5 pt-5 border-t border-slate-200 dark:border-navy-800">
              <button onClick={() => setShowUpdateConfirm(true)} disabled={updating} className="btn-primary w-full justify-center shadow-md disabled:opacity-60">
                {updating ? <Loader2 size={16} className="animate-spin mr-2" /> : <RefreshCw size={16} className="mr-2" />}
                {updating ? '正在更新...' : '一键更新系统'}
              </button>
              {updateStatus?.currentStep && <div className="mt-3 rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-xs text-slate-600 dark:text-slate-400 font-bold">当前状态：{updateStatus.currentStep}</div>}
              {updateStatus?.error && <div className="mt-3 rounded-lg border border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-400 font-bold">更新失败：{updateStatus.error}</div>}
              {updateLog.length > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-slate-100 dark:bg-navy-800 text-xs font-mono text-slate-600 space-y-1 max-h-24 overflow-y-auto">
                  {updateLog.map((log, i) => <div key={i}>{log}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {localVersion && (
        <div className="mt-6 rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
          <div className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-3">
            <Clock size={16} /> 更新指引
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            系统更新需要服务器管理员在终端执行命令。部署完成后，所有在线用户将自动收到"系统已升级"的刷新提示。
          </p>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={showUpdateConfirm}
        onClose={() => setShowUpdateConfirm(false)}
        onConfirm={() => void doUpdate()}
        title="确认执行系统更新"
        warning="此操作将中断当前服务约 1-2 分钟，在线用户可能会受到影响。确认后将开始执行更新流程。"
        isDeleting={updating}
        showCopy={false}
        variant="warning"
        requireTextConfirm={false}
        cancelLabel="暂不更新"
        confirmLabel="开始更新"
        loadingLabel="正在更新..."
      />

      {updateHistory.length > 0 && (
        <div className="mt-6 rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
          <div className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-4">
            <Clock size={16} /> 最近更新记录
          </div>
          <div className="space-y-3">
            {updateHistory.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-navy-800 pb-3 last:border-0 last:pb-0">
                <div className="font-bold text-slate-700 dark:text-slate-300">{item.version || item.id}</div>
                <div className="text-slate-500">
                  {item.finishedAt ? new Date(item.finishedAt).toLocaleString('zh-CN') : '时间未知'}
                </div>
                <div>
                  {item.phase === 'completed' ? (
                    <span className="text-emerald-600 font-bold">成功</span>
                  ) : (
                    <span className="text-red-600 font-bold">失败</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
