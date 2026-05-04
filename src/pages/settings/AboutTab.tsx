import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Box, History, Info, ShieldCheck } from 'lucide-react';

type VersionInfo = {
  version: string;
  dependencies: Record<string, string>;
  changelog: string;
};

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

  if (loading) return <div className="p-8 text-center text-slate-400">正在获取版本数据...</div>;
  
  if (error) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <Info className="h-6 w-6 text-red-500" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">无法加载版本信息</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-100 dark:bg-navy-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
        >
          重新尝试
        </button>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center text-red-500">无法加载版本信息</div>;

  return (
    <div className="space-y-8 w-full">
      {/* 应用核心版本卡片 */}
      <section className="relative overflow-hidden rounded-2xl bg-primary-navy dark:bg-navy-950 p-10 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
                <Box className="h-8 w-8 text-tertiary-sage" />
              </div>
              <h2 className="text-3xl font-black tracking-tight">SmartTrade AI CRM</h2>
            </div>
            <p className="text-white/60 font-medium text-base max-w-xl leading-relaxed">
              专业级 AI 驱动外贸管理系统，集成智能订单追踪、多币种利润核算及自动化物流监控，助力企业实现数字化转型。
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="px-4 py-1.5 bg-tertiary-sage/20 rounded-full border border-tertiary-sage/30 text-tertiary-sage text-xs font-black uppercase tracking-widest">
              Stable Release
            </div>
            <span className="text-6xl font-black text-white tracking-tighter drop-shadow-sm">v{data.version}</span>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Production Standard 2026</span>
          </div>
        </div>
        {/* 背景装饰 */}
        <div className="absolute top-[-40%] right-[-10%] h-96 w-96 bg-tertiary-sage/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-20%] left-[-5%] h-64 w-64 bg-blue-500/10 rounded-full blur-[80px]" />
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        {/* 技术栈清单 */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
             <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-navy-800">
               <ShieldCheck className="h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
             </div>
             <h3 className="text-lg font-black text-primary-navy dark:text-white">底层架构与依赖</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.dependencies && Object.entries(data.dependencies).map(([name, version]) => (
              <div key={name} className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 dark:border-navy-800 bg-surface dark:bg-navy-900/50 shadow-sm hover:border-slate-300 dark:hover:border-navy-700 transition-all">
                <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{name}</span>
                <span className="text-base font-bold text-primary-navy dark:text-white data-field">{(version || 'Unknown').replace('^', '').replace('~', '')}</span>
              </div>
            ))}
          </div>
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-900 text-xs font-bold text-slate-400 leading-relaxed italic">
            "本系统遵循 2026 年度企业级生产环境标准构建。所有核心组件均通过了严格的压力测试与安全审计，确保在高并发外贸业务场景下的持续稳定性。"
          </div>
        </section>

        {/* 更新记录 */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
             <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-navy-800">
               <History className="h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
             </div>
             <h3 className="text-lg font-black text-primary-navy dark:text-white">系统迭代日志</h3>
          </div>
          <div className="rounded-2xl border border-slate-100 dark:border-navy-800 bg-surface dark:bg-navy-900/50 p-8 shadow-sm max-h-[600px] overflow-y-auto custom-scrollbar">
            <div className="prose prose-slate prose-sm dark:prose-invert max-w-none">
              {data.changelog && data.changelog.split('\n').map((line, i) => {
                if (line.startsWith('## ')) {
                  return <h4 key={i} className="text-sm font-black text-primary-navy dark:text-tertiary-sage mt-6 mb-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-tertiary-sage" />
                    {line.replace('## ', '')}
                  </h4>;
                }
                if (line.startsWith('### ')) {
                  return <h5 key={i} className="text-[11px] font-black text-slate-900 dark:text-white mt-4 mb-2 uppercase tracking-wider">{line.replace('### ', '')}</h5>;
                }
                if (line.startsWith('- ')) {
                  return <li key={i} className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 list-none flex items-start gap-2">
                    <span className="text-tertiary-sage mt-1">•</span>
                    {line.replace('- ', '')}
                  </li>;
                }
                if (line.trim() === '---') return <hr key={i} className="my-4 border-slate-100 dark:border-navy-800" />;
                return <p key={i} className="text-xs text-slate-500 dark:text-slate-500">{line}</p>;
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
