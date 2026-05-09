import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Box, CheckCircle2, History, Info, ShieldCheck, Sparkles } from 'lucide-react';

type VersionInfo = {
  version: string;
  dependencies: Record<string, string>;
  changelog: string;
};

const VERSION_HIGHLIGHTS = [
  '客户转交',
  '负责人权限隔离',
  '加密灾备',
  '税务模式联动',
  '进项发票预警',
  '单据槽位化',
];

function cleanVersion(version: string) {
  return (version || 'Unknown').replace('^', '').replace('~', '');
}

function dependencyLine(dependencies: Record<string, string> | undefined, names: string[]) {
  return names
    .map((name) => `${name} ${cleanVersion(dependencies?.[name] || '')}`)
    .join(' / ');
}

export default function AboutTab() {
  const [data, setData] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    apiFetch<VersionInfo>('/api/settings/version-info')
      .then(setData)
      .catch(err => {
        console.error('Failed to load version info:', err);
        setError(err instanceof Error ? err.message : '获取版本信息失败');
      })
      .finally(() => setLoading(false));
  }, []);

  const changelogLines = useMemo(() => data?.changelog?.split('\n') || [], [data?.changelog]);

  if (loading) return <div className="p-8 text-center text-slate-400">正在获取版本数据...</div>;

  if (error) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
          <Info className="h-6 w-6 text-red-500" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">无法加载版本信息</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-300"
        >
          重新尝试
        </button>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center text-red-500">无法加载版本信息</div>;

  return (
    <div className="w-full space-y-6">
      <section className="rounded-lg border border-slate-200 bg-surface p-6 shadow-sm dark:border-navy-800 dark:bg-navy-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-navy text-white dark:bg-tertiary-sage dark:text-navy-950">
                <Box className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-primary-navy dark:text-white">SmartTrade AI CRM</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">外贸订单、客户、财务、物流与单据协同管理系统</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {VERSION_HIGHLIGHTS.map((item) => (
                <span key={item} className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-right dark:border-navy-700 dark:bg-navy-950">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-extrabold text-emerald-700 dark:border-emerald-900/40 dark:bg-navy-900 dark:text-emerald-300">
              <CheckCircle2 size={14} /> Stable Release
            </div>
            <div className="text-4xl font-black tracking-tight text-primary-navy dark:text-white">v{data.version}</div>
            <div className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Production Standard 2026</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-surface shadow-sm dark:border-navy-800 dark:bg-navy-900">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4 dark:border-navy-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-1.5 dark:bg-navy-800">
              <History className="h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
            </div>
            <div>
              <h3 className="text-base font-black text-primary-navy dark:text-white">系统迭代日志</h3>
              <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">按版本记录核心业务能力与稳定性改进</p>
            </div>
          </div>
          <Sparkles className="hidden h-5 w-5 text-slate-300 dark:text-slate-600 sm:block" />
        </div>

        <div className="max-h-[560px] overflow-y-auto p-6 custom-scrollbar">
          <div className="space-y-1">
            {changelogLines.map((line, i) => {
              if (line.startsWith('# ')) {
                return null;
              }
              if (line.startsWith('## ')) {
                return (
                  <div key={i} className="mt-6 first:mt-0 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-navy-700 dark:bg-navy-950/60">
                    <h4 className="text-sm font-black text-primary-navy dark:text-tertiary-sage">{line.replace('## ', '')}</h4>
                  </div>
                );
              }
              if (line.startsWith('### ')) {
                return <h5 key={i} className="pt-3 text-xs font-black tracking-tight text-slate-700 dark:text-slate-200">{line.replace('### ', '')}</h5>;
              }
              if (line.startsWith('- ')) {
                return (
                  <div key={i} className="flex items-start gap-2 pl-2 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-tertiary-sage" />
                    <span>{line.replace('- ', '').replace(/\*\*/g, '')}</span>
                  </div>
                );
              }
              if (line.trim() === '---') return <div key={i} className="h-3" />;
              if (!line.trim()) return null;
              return <p key={i} className="text-xs text-slate-500 dark:text-slate-500">{line}</p>;
            })}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4 dark:border-navy-800 dark:bg-navy-950/60">
        <div className="mb-2 flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400">
          <ShieldCheck size={14} /> 底层架构与依赖
        </div>
        <div className="grid gap-1 text-xs font-bold leading-relaxed text-slate-500 dark:text-slate-400 md:grid-cols-2">
          <div>前端：{dependencyLine(data.dependencies, ['React', 'Vite', 'TypeScript', 'Tailwind'])}</div>
          <div>后端：Express {cleanVersion(data.dependencies?.Express || '')} / PostgreSQL / Node.js</div>
        </div>
      </section>
    </div>
  );
}
