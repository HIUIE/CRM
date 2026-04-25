import React, { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { Chip, EmptyStateBoard } from '../features/order-detail/components';
import { Clock, User, Box, ArrowLeft, Printer, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AuditLog {
  id: number;
  user_id: number;
  user_name: string;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity_type: string;
  entity_id: string;
  old_value: string;
  new_value: string;
  created_at: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await apiFetch<AuditLog[]>('/api/audit');
        setLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(getErrorMessage(err, '读取审计日志失败'));
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (loading) return <div className="flex h-[400px] w-full items-center justify-center p-8 text-center text-slate-400 font-bold animate-pulse uppercase tracking-widest">正在检索全库审计轨迹...</div>;
  if (error) return <div className="p-8 m-4 rounded-lg bg-red-50 text-red-600 border border-red-100 font-bold text-center">{error}</div>;

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      {/* Standalone Header for Audit Logs */}
      <header className="sticky top-0 z-[60] -mx-2 -mt-2 mb-6 flex items-center justify-between border-b border-slate-100 dark:border-navy-800 bg-white/95 dark:bg-navy-950/95 px-6 py-4 backdrop-blur-md transition-colors shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="group flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-navy-800 text-slate-400 hover:border-primary-navy dark:hover:border-tertiary-sage hover:text-primary-navy dark:hover:text-white transition-all shadow-sm bg-white dark:bg-navy-900"
            title="返回控制台"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex items-center gap-2 text-[13px] font-bold tracking-tight">
            <span className="text-slate-400 uppercase tracking-widest">系统管理</span>
            <span className="text-slate-200 dark:text-navy-800">/</span>
            <span className="text-primary-navy dark:text-white uppercase tracking-widest">操作审计日志</span>
          </div>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white transition-all uppercase tracking-widest shadow-sm"
        >
          <Printer size={14} /> 导出报告
        </button>
      </header>

      <div className="space-y-6 pb-12 px-1">
        <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm overflow-hidden min-h-[300px]">
          {logs && logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                  <tr>
                    <th className="px-6 py-4 text-left">时间 / 操作人</th>
                    <th className="px-6 py-4 text-center">类型</th>
                    <th className="px-6 py-4 text-left">影响实体</th>
                    <th className="px-6 py-4 text-left">数据变更快照</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="align-top hover:bg-slate-50/50 dark:hover:bg-navy-950/30 transition-colors">
                      <td className="px-6 py-4 text-left">
                        <div className="flex items-center gap-2 text-primary-navy dark:text-white font-bold mb-1">
                          <Clock size={14} className="text-slate-400" />
                          <span className="data-field">{log.created_at ? String(log.created_at).replace('T', ' ').slice(0, 19) : '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                          <User size={12} className="text-slate-300" />
                          {log.user_name || 'System'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Chip tone={log.action_type === 'CREATE' ? 'success' : log.action_type === 'DELETE' ? 'error' : 'info'}>
                          {log.action_type}
                        </Chip>
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="flex items-center gap-2 text-primary-navy dark:text-tertiary-sage font-bold uppercase tracking-tight mb-1">
                          <Box size={14} />
                          {log.entity_type}
                        </div>
                        <div className="text-[11px] font-bold text-slate-400 data-field">ID: {log.entity_id}</div>
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="max-w-[400px] space-y-2">
                          {log.old_value && (
                            <div className="text-[10px] bg-slate-50 dark:bg-navy-950 p-2 rounded border border-slate-100 dark:border-navy-800 text-slate-400 font-mono truncate" title={String(log.old_value)}>
                                <span className="text-red-400 font-bold mr-2">OLD:</span> {String(log.old_value)}
                            </div>
                          )}
                          {log.new_value && (
                            <div className="text-[10px] bg-emerald-50/30 dark:bg-emerald-900/10 p-2 rounded border border-emerald-100/50 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-mono truncate" title={String(log.new_value)}>
                                <span className="text-emerald-500 font-bold mr-2">NEW:</span> {String(log.new_value)}
                            </div>
                          )}
                          {!log.old_value && !log.new_value && <span className="text-slate-300 italic">No snapshot available</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-20 flex items-center justify-center w-full">
              <EmptyStateBoard 
                title="暂无审计记录" 
                description="系统尚未产生任何针对核心实体的敏感操作日志。" 
                icon={<History size={48} className="text-slate-200" />}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
