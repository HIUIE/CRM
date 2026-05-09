import React, { useState, useRef } from 'react';
import { Upload, X, ChevronRight, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Archive, ShieldCheck, DatabaseBackup, AlertTriangle, FileWarning } from 'lucide-react';
import { apiFetch, getErrorMessage } from '../../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entityType: 'CUSTOMER' | 'ORDER';
}

const FIELD_LABELS: Record<string, Record<string, string>> = {
  CUSTOMER: {
    name: '客户名称 (必填)',
    country: '国家/地区 (必填)',
    contact: '联系方式',
    sourceChannel: '来源渠道',
    intentProducts: '意向产品',
    ownerUserName: '客户负责人',
  },
  ORDER: {
    customerName: '客户名称 (必填, 需匹配已有客户)',
    displayId: '订单编号',
    totalAmount: '订单总额',
    productSummary: '产品概括',
    status: '订单状态',
    details: '备注详情',
  }
};

type Step = 'upload' | 'mapping' | 'backup_confirm' | 'executing' | 'result';

export default function ImportModal({ isOpen, onClose, onSuccess, entityType }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<{
    headers?: string[];
    rows?: unknown[][];
    filename: string;
    isZip?: boolean;
    isBackup?: boolean;
    isRestorableBackup?: boolean;
    entries?: string[];
    backupMeta?: { format?: string; version?: number; appVersion?: string; createdAt?: string; counts?: Record<string, number>; note?: string } | null;
  } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ successCount: number; errorCount: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const data = await apiFetch<any>('/api/import/preview', {
        method: 'POST',
        body: formData,
      });
      setPreviewData(data);
      
      if (data.isZip) {
        if (data.isBackup) {
          setStep('backup_confirm');
        } else {
          setError('上传的压缩包不是有效的系统备份包 (需包含 customers.csv 或 orders.csv)');
        }
      } else {
        // Auto-map based on exact header matches for single files
        const initialMapping: Record<string, string> = {};
        const fields = Object.keys(FIELD_LABELS[entityType]);
        fields.forEach(field => {
          const label = FIELD_LABELS[entityType][field].replace(/ \(.*\)/, '');
          const match = data.headers.find((h: string) => h.toLowerCase() === label.toLowerCase() || h.toLowerCase() === field.toLowerCase());
          if (match) initialMapping[field] = match;
        });
        setMapping(initialMapping);
        setStep('mapping');
      }
    } catch (err) {
      setError(getErrorMessage(err, '解析文件失败'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecute = async () => {
    if (!previewData) return;
    setIsProcessing(true);
    setError(null);

    try {
      const res = await apiFetch<any>('/api/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: previewData.filename,
          entityType,
          mapping,
          isBackup: previewData.isBackup,
        }),
      });
      setResult(res);
      setStep('result');
      if (res.successCount > 0) onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, '导入执行失败'));
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setFile(null);
    setPreviewData(null);
    setMapping({});
    setResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-xl bg-surface dark:bg-navy-900 shadow-2xl border border-slate-200 dark:border-navy-800 animate-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary-navy dark:bg-navy-800 flex items-center justify-center">
              <Upload size={18} className="text-white dark:text-tertiary-sage" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">批量导入与数据还原</h3>
              <p className="text-[10px] text-slate-400 font-bold tracking-tight mt-0.5">支持 XLSX, CSV 或 系统备份 ZIP</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-8">
          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-10">
            <StepIndicator active={step === 'upload'} completed={step !== 'upload'} label="上传文件" />
            <div className="w-12 h-[1px] bg-slate-200 dark:bg-navy-800 mx-2" />
            <StepIndicator 
              active={['mapping', 'backup_confirm'].includes(step)} 
              completed={['executing', 'result'].includes(step)} 
              label={previewData?.isBackup ? '备份确认' : '字段映射'} 
            />
            <div className="w-12 h-[1px] bg-slate-200 dark:bg-navy-800 mx-2" />
            <StepIndicator active={step === 'result'} completed={false} label="导入结果" />
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-error shrink-0" size={18} />
              <p className="text-xs font-bold text-error leading-relaxed">{error}</p>
            </div>
          )}

          {step === 'upload' && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-navy-800 rounded-xl p-16 flex flex-col items-center justify-center cursor-pointer hover:border-primary-navy/40 hover:bg-slate-50 dark:hover:bg-navy-950/50 transition-all group"
            >
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.csv,.zip" onChange={handleFileChange} />
              {isProcessing ? (
                <Loader2 className="animate-spin text-primary-navy mb-4" size={48} />
              ) : (
                <Archive className="text-slate-300 group-hover:text-primary-navy transition-colors mb-4" size={48} />
              )}
              <div className="text-sm font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
                {isProcessing ? '正在解析文件...' : '点击或拖拽文件/备份包到此处'}
              </div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 text-center max-w-sm">
                支持 XLSX, CSV 导入 或 导出的 ZIP 备份包直接还原。系统将自动识别备份内容。
              </p>
            </div>
          )}

          {step === 'backup_confirm' && previewData && (
            <div className="flex flex-col py-2">
              {previewData.isRestorableBackup ? (
                <>
                  <div className="flex items-start gap-3 mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                    <FileWarning size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-extrabold text-amber-800 dark:text-amber-300 mb-1">系统可还原备份</div>
                      <div className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                        此备份包含全部 22 个数据表和附件文件。恢复将使用 <span className="font-extrabold">智能合并 (Upsert)</span> 策略：
                        已存在的记录将被更新，新记录将新增。未在备份中出现的现有记录不会删除。
                      </div>
                    </div>
                  </div>

                  {previewData.backupMeta && (
                    <div className="w-full bg-slate-50 dark:bg-navy-950 rounded-lg p-5 border border-slate-100 dark:border-navy-800 mb-6 space-y-3">
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                        <span className="text-slate-500">备份时间：<span className="font-bold text-slate-700 dark:text-slate-300">{previewData.backupMeta.createdAt ? new Date(previewData.backupMeta.createdAt).toLocaleString() : '未知'}</span></span>
                        <span className="text-slate-500">备份版本：<span className="font-bold text-slate-700 dark:text-slate-300">v{previewData.backupMeta.version || 1}</span></span>
                        <span className="text-slate-500">系统版本：<span className="font-bold text-slate-700 dark:text-slate-300">{previewData.backupMeta.appVersion || '未知'}</span></span>
                      </div>
                      {previewData.backupMeta.counts && (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(previewData.backupMeta.counts).map(([table, count]) => (
                            <span key={table} className="inline-flex items-center gap-1 rounded bg-surface dark:bg-navy-900 border border-slate-200 dark:border-navy-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                              {table} <span className="text-slate-400">({count})</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="h-16 w-16 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4 self-center">
                    <DatabaseBackup className="text-amber-500" size={32} />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-2 text-center tracking-tight">识别到旧版 CSV 备份包</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 text-center max-w-md self-center">
                    此备份仅包含 <span className="font-extrabold text-primary-navy dark:text-white">客户 (customers)</span> 和 <span className="font-extrabold text-primary-navy dark:text-white">订单 (orders)</span> 数据。
                    匹配的记录将更新，新记录将新增。其他数据（财务、物流、附件等）不会被导入。
                  </p>

                  <div className="w-full bg-slate-50 dark:bg-navy-950 rounded-lg p-4 border border-slate-100 dark:border-navy-800 mb-6">
                    <h4 className="text-[10px] font-extrabold text-slate-400 tracking-tight mb-3 flex items-center gap-2">
                      <DatabaseBackup size={14} /> 包含的 CSV 文件
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {previewData.entries?.filter((e: string) => e.endsWith('.csv')).map((e: string) => (
                        <div key={e} className="px-3 py-1.5 bg-surface dark:bg-navy-900 rounded border border-slate-200 dark:border-navy-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 shadow-sm">
                          {e}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 px-4 py-3 mb-6 flex items-start gap-3">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div className="text-xs font-bold text-red-600 dark:text-red-400 leading-relaxed">
                  导入将直接修改数据库。建议在操作前先通过"数据导出 → 系统可还原备份"做一次完整备份。
                </div>
              </div>

              <div className="flex gap-4 self-center">
                <button onClick={reset} className="px-8 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors tracking-tight border border-slate-200 dark:border-navy-800 rounded-lg">取消</button>
                <button
                  onClick={handleExecute}
                  disabled={isProcessing}
                  className="btn-primary px-10 py-2 text-xs flex items-center gap-2"
                >
                  {isProcessing ? <><Loader2 className="animate-spin" size={14} /> 正在还原数据...</> : <><ShieldCheck size={16} /> 确认并开始还原</>}
                </button>
              </div>
            </div>
          )}

          {step === 'mapping' && previewData && (
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-navy-950 rounded-lg p-4 border border-slate-100 dark:border-navy-800">
                <h4 className="text-[11px] font-extrabold text-slate-400 tracking-tight mb-4">设置字段对应关系</h4>
                <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                  {Object.entries(FIELD_LABELS[entityType]).map(([field, label]) => (
                    <div key={field} className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{label}</label>
                      <select 
                        value={mapping[field] || ''}
                        onChange={e => setMapping({ ...mapping, [field]: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-3 py-2 text-xs font-bold outline-none focus:border-primary-navy transition-all"
                      >
                        <option value="">-- 请选择对应列 --</option>
                        {previewData.headers?.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-navy-950 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-400 tracking-tight">数据预览 (前 5 行)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-navy-950/50">
                        {previewData.headers?.map(h => (
                          <th key={h} className="px-4 py-2 font-extrabold text-slate-500 border-b border-slate-100 dark:border-navy-800 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows?.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 dark:border-navy-800 last:border-0">
                          {row.map((cell, j) => (
                            <td key={j} className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">{String(cell || '-')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button onClick={reset} className="px-6 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors tracking-tight">重新上传</button>
                <button 
                  onClick={handleExecute}
                  disabled={isProcessing}
                  className="btn-primary px-8 py-2 text-xs flex items-center gap-2"
                >
                  {isProcessing ? <><Loader2 className="animate-spin" size={14} /> 正在导入...</> : <><ChevronRight size={16} /> 开始执行导入</>}
                </button>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="flex flex-col items-center py-6">
              <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full ${result.errorCount === 0 ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                {result.errorCount === 0 ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">导入完成</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8">
                成功导入 <span className="text-emerald-500 font-extrabold">{result.successCount}</span> 条数据
                {result.errorCount > 0 && <>，失败 <span className="text-error font-extrabold">{result.errorCount}</span> 条</>}
              </p>

              {result.errors.length > 0 && (
                <div className="w-full max-h-48 overflow-y-auto bg-red-50 dark:bg-red-900/10 rounded-lg p-4 mb-8 border border-red-100 dark:border-red-900/30">
                  <h4 className="text-[10px] font-extrabold text-error tracking-tight mb-2">错误详情</h4>
                  <ul className="space-y-1">
                    {result.errors.map((err, i) => (
                      <li key={i} className="text-[11px] font-medium text-red-700 dark:text-red-400">• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={reset} className="px-6 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors tracking-tight border border-slate-200 dark:border-navy-800 rounded-lg">继续导入</button>
                <button onClick={onClose} className="btn-primary px-10 py-2 text-xs">完成并关闭</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ active, completed, label }: { active: boolean; completed: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[13px] font-extrabold transition-all border-2 ${active ? 'bg-primary-navy border-primary-navy text-white shadow-lg shadow-primary-navy/20' : completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-surface dark:bg-navy-900 border-slate-200 dark:border-navy-800 text-slate-300'}`}>
        {completed ? <CheckCircle2 size={16} /> : active ? '•' : ''}
      </div>
      <span className={`text-[10px] font-bold tracking-tight ${active ? 'text-primary-navy dark:text-white' : completed ? 'text-emerald-500' : 'text-slate-300'}`}>{label}</span>
    </div>
  );
}
