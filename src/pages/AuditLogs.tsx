import React, { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '../lib/api';
import { Chip, EmptyStateBoard } from '../features/order-detail/components';
import { Clock, User, Box, ArrowLeft, Printer, History, Eye, X, FileJson, Copy, Check } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Pagination } from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';

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
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copied, setCopied] = useState(false);
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

  const {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    currentItems,
    setCurrentPage,
    setPageSize,
  } = usePagination(logs);

  const copyJson = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="flex h-screen w-full items-center justify-center p-8 text-center text-slate-400 font-bold animate-pulse uppercase tracking-widest">正在检索全库审计轨迹...</div>;
  if (error) return <div className="p-8 m-4 rounded-lg bg-red-50 text-red-600 border border-red-100 font-bold text-center">{error}</div>;

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      {/* Standalone Header for Audit Logs */}
      <header className="sticky top-0 z-[60] -mx-2 -mt-2 mb-4 flex items-center justify-between border-b border-slate-100 dark:border-navy-800 bg-white/95 dark:bg-navy-950/95 px-6 py-4 backdrop-blur-md transition-colors shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="group flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-navy-800 text-slate-400 hover:border-primary-navy transition-all shadow-sm bg-white dark:bg-navy-900"
            title="返回控制台"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex items-center gap-2 text-[13px] font-bold tracking-tight">
            <Link to="/dashboard" className="text-slate-400 uppercase tracking-widest hover:text-primary-navy dark:hover:text-white transition-colors">系统管理</Link>
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

      <div className="flex-1 px-1">
        <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm">
          {logs && logs.length > 0 ? (
            <div className="flex flex-col">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                    <tr>
                      <th className="px-6 py-4 text-left">时间 / 操作人</th>
                      <th className="px-6 py-4 text-center">类型</th>
                      <th className="px-6 py-4 text-left">影响实体</th>
                      <th className="px-6 py-4 text-left">数据变更摘要</th>
                      <th className="px-6 py-4 text-center">详情</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                    {currentItems.map((log) => (
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
                          <div className="max-w-[300px] text-[11px] text-slate-500 font-medium truncate italic">
                             {log.new_value || log.old_value || 'No data snapshot'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <button 
                            onClick={() => setSelectedLog(log)}
                            className="p-2 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-400 hover:text-primary-navy dark:hover:text-tertiary-sage hover:bg-white dark:hover:bg-navy-800 transition-all shadow-sm"
                           >
                             <Eye size={16} />
                           </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="shrink-0">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
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

      {/* JSON Viewer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-navy-900 shadow-2xl border border-slate-200 dark:border-navy-800 animate-in zoom-in duration-300 flex flex-col max-h-[85vh]">
            <div className="bg-slate-50 dark:bg-navy-950 px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-navy-800">
               <div className="flex items-center gap-3">
                 <FileJson className="text-primary-navy dark:text-tertiary-sage" size={20} />
                 <h3 className="text-sm font-extrabold text-primary-navy dark:text-white uppercase tracking-widest">操作详情与变更快照</h3>
               </div>
               <button onClick={() => setSelectedLog(null)} className="p-2 text-slate-400 hover:text-primary-navy transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 bg-white dark:bg-navy-900">
               <div className="grid grid-cols-3 gap-4">
                  <DetailBox label="操作类型" value={selectedLog.action_type} />
                  <DetailBox label="影响实体" value={selectedLog.entity_type} />
                  <DetailBox label="操作时间" value={selectedLog.created_at.replace('T', ' ').slice(0, 19)} />
               </div>

               <div className="space-y-4">
                  <JsonSection title="变更后 (New Value)" content={selectedLog.new_value} onCopy={() => copyJson(selectedLog.new_value)} copied={copied} />
                  <JsonSection title="变更前 (Old Value)" content={selectedLog.old_value} onCopy={() => copyJson(selectedLog.old_value)} copied={copied} />
               </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-navy-950 border-t border-slate-100 dark:border-navy-800 flex justify-end">
               <button onClick={() => setSelectedLog(null)} className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-8 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-all uppercase tracking-widest">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-100 dark:border-navy-800">
       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
       <div className="text-[13px] font-extrabold text-primary-navy dark:text-white uppercase truncate">{value}</div>
    </div>
  );
}

function JsonSection({ title, content, onCopy, copied }: { title: string; content: string; onCopy: () => void; copied: boolean }) {
  if (!content) return null;
  let formatted = content;
  try {
    formatted = JSON.stringify(JSON.parse(content), null, 2);
  } catch (e) {}

  return (
    <div className="space-y-2">
       <div className="flex items-center justify-between">
          <label className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{title}</label>
          <button onClick={onCopy} className="flex items-center gap-1.5 text-[10px] font-bold text-primary-navy dark:text-tertiary-sage hover:opacity-70 transition-all uppercase tracking-widest">
            {copied ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制代码</>}
          </button>
       </div>
       <pre className="bg-slate-900 dark:bg-black p-4 rounded-xl text-[12px] text-emerald-400 font-mono overflow-x-auto border border-white/5 leading-relaxed">
          {formatted}
       </pre>
    </div>
  );
}
