import React, { useEffect, useState, useRef } from 'react';
import { Download, Upload, PackageSearch, FileDigit, DatabaseBackup, CheckCircle2, Folder, Clock, ShieldCheck, PlayCircle, FolderOpen, AlertTriangle, RotateCcw, FileWarning } from 'lucide-react';
import { apiDownload, apiFetch, getErrorMessage } from '../../lib/api';

const EXPORT_FORMATS = [
  {
    id: 'xlsx',
    title: '业务数据明细（XLSX）',
    desc: '包含订单、财务、物流、客户等 12 个 Sheet。带自动筛选和专业样式，适合对账与财务分析。',
    icon: <FileDigit size={20} />,
  },
  {
    id: 'customer-archive',
    title: '业务全量归档包（Master ZIP）',
    desc: '【核心资产】按客户/订单分层级归档。包含订单详情、财务水单、报关单据及所有原始附件，适合公司核心业务物理留档。',
    icon: <Download size={20} />,
  },
  {
    id: 'restorable-backup',
    title: '系统迁移与灾备包（Standard ZIP）',
    desc: '【技术标准】包含完整的数据库快照、系统元数据和底层文件。可用于服务器搬迁、灾难恢复或系统整体导入。',
    icon: <DatabaseBackup size={20} />,
  },
];

type BackupConfig = {
  enabled: boolean;
  directory: string;
  intervalHours: 1 | 2 | 24;
};

type BackupStatus = {
  running: boolean;
  lastRunAt: string;
  lastFile: string;
  lastError: string;
  nextRunAt: string;
};

type FileSystemWritableFileStream = {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
};

type FileSystemFileHandle = {
  createWritable: () => Promise<FileSystemWritableFileStream>;
};

type FileSystemDirectoryHandle = {
  getFileHandle: (name: string, options: { create: boolean }) => Promise<FileSystemFileHandle>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
};

const DEFAULT_BACKUP_CONFIG: BackupConfig = { enabled: false, directory: '', intervalHours: 1 };
const DEFAULT_BACKUP_STATUS: BackupStatus = { running: false, lastRunAt: '', lastFile: '', lastError: '', nextRunAt: '' };

function normalizeBackupConfig(value: Partial<BackupConfig> | null | undefined): BackupConfig {
  return {
    enabled: Boolean(value?.enabled),
    directory: typeof value?.directory === 'string' ? value.directory : '',
    intervalHours: value?.intervalHours === 2 || value?.intervalHours === 24 ? value.intervalHours : 1,
  };
}

function normalizeBackupStatus(value: Partial<BackupStatus> | null | undefined): BackupStatus {
  return {
    running: Boolean(value?.running),
    lastRunAt: typeof value?.lastRunAt === 'string' ? value.lastRunAt : '',
    lastFile: typeof value?.lastFile === 'string' ? value.lastFile : '',
    lastError: typeof value?.lastError === 'string' ? value.lastError : '',
    nextRunAt: typeof value?.nextRunAt === 'string' ? value.nextRunAt : '',
  };
}

export default function DataTab({ setImportEntityType }: { setImportEntityType: (type: 'CUSTOMER' | 'ORDER') => void }) {
  const [error, setError] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'customer-archive' | 'restorable-backup'>('xlsx');
  const [exporting, setExporting] = useState(false);
  const [backupConfig, setBackupConfig] = useState<BackupConfig>(DEFAULT_BACKUP_CONFIG);
  const [backupStatus, setBackupStatus] = useState<BackupStatus>(DEFAULT_BACKUP_STATUS);
  const [backupSaving, setBackupSaving] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [exportingToFolder, setExportingToFolder] = useState(false);
  const [pickingDirectory, setPickingDirectory] = useState(false);
  const [restoreStep, setRestoreStep] = useState<'idle' | 'previewing' | 'confirming' | 'restoring' | 'done'>('idle');
  const [restorePreview, setRestorePreview] = useState<any>(null);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [restoreError, setRestoreError] = useState('');
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<{ config: BackupConfig; status: BackupStatus }>('/api/settings/backup/config')
      .then((data) => {
        setBackupConfig(normalizeBackupConfig(data?.config));
        setBackupStatus(normalizeBackupStatus(data?.status));
      })
      .catch(() => undefined);
  }, []);

  const getExportUrl = () => {
    if (exportFormat === 'xlsx') return '/api/settings/export/xlsx';
    return `/api/settings/export?format=${exportFormat}`;
  };

  const getExportLabel = () => {
    const labels: Record<string, string> = { 'xlsx': '业务数据明细', 'customer-archive': '业务全量归档包', 'restorable-backup': '系统迁移与灾备包' };
    return labels[exportFormat] || '数据';
  };

  const exportData = async () => {
    setError(''); setUserMessage(''); setExporting(true);
    try {
      await apiDownload(getExportUrl());
      setUserMessage(`${getExportLabel()}导出已开始下载`);
    } catch (e) {
      setError(getErrorMessage(e, '导出数据失败'));
    } finally {
      setExporting(false);
    }
  };

  const fetchExportBlob = async () => {
    const response = await fetch(getExportUrl(), { credentials: 'include' });
    if (!response.ok) {
      let message = '导出数据失败';
      try {
        const payload = await response.json();
        message = payload?.error?.message || payload?.message || payload?.error || message;
      } catch {
        // Keep fallback message for non-JSON responses.
      }
      throw new Error(message);
    }
    const disposition = response.headers.get('content-disposition') || '';
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const simpleMatch = disposition.match(/filename="([^"]+)"/i);
    const fallbackName = `SmartTrade_CRM_${new Date().toISOString().slice(0, 10)}.${exportFormat === 'xlsx' ? 'xlsx' : 'zip'}`;
    const fileName = utf8Match ? decodeURIComponent(utf8Match[1]) : simpleMatch?.[1] || fallbackName;
    return { blob: await response.blob(), fileName };
  };

  const exportDataToFolder = async () => {
    setError(''); setUserMessage(''); setExportingToFolder(true);
    try {
      const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
      if (!picker) {
        await exportData();
        setUserMessage('当前浏览器不支持直接选择导出文件夹，已改为下载到浏览器默认下载目录');
        return;
      }
      const directory = await picker();
      const { blob, fileName } = await fetchExportBlob();
      const fileHandle = await directory.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      setUserMessage(`${getExportLabel()}已导出到所选文件夹：${fileName}`);
    } catch (e) {
      setError(getErrorMessage(e, '导出到文件夹失败'));
    } finally {
      setExportingToFolder(false);
    }
  };

  const saveBackupConfig = async () => {
    setError(''); setUserMessage(''); setBackupSaving(true);
    try {
      const data = await apiFetch<{ config: BackupConfig; status: BackupStatus }>('/api/settings/backup/config', {
        method: 'POST',
        body: JSON.stringify(backupConfig),
      });
      setBackupConfig(normalizeBackupConfig(data?.config));
      setBackupStatus(normalizeBackupStatus(data?.status));
      setUserMessage('自动备份设置已保存');
    } catch (e) {
      setError(getErrorMessage(e, '保存自动备份设置失败'));
    } finally {
      setBackupSaving(false);
    }
  };

  const pickBackupDirectory = async () => {
    setError(''); setUserMessage(''); setPickingDirectory(true);
    try {
      const data = await apiFetch<{ directory?: string }>('/api/settings/backup/pick-directory', { method: 'POST' });
      if (data.directory) {
        setBackupConfig({ ...backupConfig, directory: data.directory });
      }
    } catch (e) {
      setError(getErrorMessage(e, '选择文件夹失败，请手动输入备份路径'));
    } finally {
      setPickingDirectory(false);
    }
  };

  const runBackupNow = async () => {
    setError(''); setUserMessage(''); setBackupRunning(true);
    try {
      const data = await apiFetch<{ filePath: string; status: BackupStatus }>('/api/settings/backup/run', {
        method: 'POST',
        body: JSON.stringify({ directory: backupConfig.directory }),
      });
      setBackupStatus(normalizeBackupStatus(data?.status));
      setUserMessage(`备份完成：${data.filePath}`);
    } catch (e) {
      setError(getErrorMessage(e, '立即备份失败'));
    } finally {
      setBackupRunning(false);
    }
  };

  const handleRestoreFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setRestoreError('');
    setRestoreStep('previewing');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const data = await apiFetch<any>('/api/import/preview', { method: 'POST', body: formData });
      if (!data.isZip || !data.isBackup) {
        setRestoreError('所选文件不是有效的 SmartTrade CRM 备份包，请选择通过系统导出的可还原备份 ZIP 文件');
        setRestoreStep('idle');
        return;
      }
      setRestorePreview(data);
      setRestoreStep('confirming');
    } catch (err) {
      setRestoreError(getErrorMessage(err, '验证备份文件失败'));
      setRestoreStep('idle');
    }
  };

  const handleRestoreExecute = async () => {
    if (!restorePreview) return;
    setRestoreError('');
    setRestoreStep('restoring');

    try {
      const res = await apiFetch<any>('/api/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: restorePreview.filename,
          entityType: 'CUSTOMER',
          mapping: {},
          isBackup: true,
        }),
      });
      setRestoreResult(res);
      setRestoreStep('done');
    } catch (err) {
      setRestoreError(getErrorMessage(err, '数据恢复失败'));
      setRestoreStep('confirming');
    }
  };

  const resetRestore = () => {
    setRestoreStep('idle');
    setRestorePreview(null);
    setRestoreResult(null);
    setRestoreError('');
    if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400 font-bold">{error}</div>}
      {userMessage && <div className="rounded-lg border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 font-bold">{userMessage}</div>}

      <div className="mb-10">
        <div className="mb-6">
          <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
            <Upload className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
            数据导入
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">批量导入客户或订单数据，支持 XLSX、CSV 及系统可还原备份 ZIP。</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button onClick={() => setImportEntityType('CUSTOMER')} className="flex items-start gap-4 p-5 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 hover:border-primary-navy transition-all text-left">
            <div className="p-2 rounded-lg bg-primary-navy dark:bg-tertiary-sage text-white shrink-0"><PackageSearch size={20} /></div>
            <div>
              <div className="text-sm font-bold text-primary-navy dark:text-white mb-1">导入客户数据</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">从 XLSX/CSV 文件中批量导入客户资料，支持自动匹配字段。</div>
            </div>
          </button>
          <button onClick={() => setImportEntityType('ORDER')} className="flex items-start gap-4 p-5 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 hover:border-primary-navy transition-all text-left">
            <div className="p-2 rounded-lg bg-primary-navy dark:bg-tertiary-sage text-white shrink-0"><FileDigit size={20} /></div>
            <div>
              <div className="text-sm font-bold text-primary-navy dark:text-white mb-1">导入订单数据</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">从 XLSX/CSV 文件中批量导入订单，需确保客户名称匹配已有客户。</div>
            </div>
          </button>
        </div>

        <div className="mt-4 p-4 rounded-lg bg-slate-50 dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800 flex items-start gap-3">
          <DatabaseBackup size={16} className="text-slate-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">推荐上传“系统可还原备份（ZIP）”恢复完整数据链路：客户、联系人、订单、明细、财务、物流、报关、生产、装箱、任务、跟进记录和附件。</p>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-navy-800 pt-10">
        <div className="mb-6">
          <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
            <Download className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
            数据导出
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">选择业务归档或系统迁移格式，一键安全导出。</p>
        </div>

        <div className="space-y-4 mb-8">
            {EXPORT_FORMATS.map(fmt => (
            <div 
              key={fmt.id} 
              onClick={() => setExportFormat(fmt.id as typeof exportFormat)} 
              className={`flex items-start gap-4 p-5 rounded-lg border cursor-pointer transition-all ${
                exportFormat === fmt.id 
                  ? 'border-primary-navy bg-primary-navy/5 dark:border-tertiary-sage dark:bg-tertiary-sage/15' 
                  : 'border-slate-200 bg-surface dark:border-navy-800 hover:border-slate-300 dark:hover:border-navy-700'
              }`}
            >
              <div className={`p-2 rounded-lg ${exportFormat === fmt.id ? 'bg-primary-navy text-white' : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'}`}>{fmt.icon}</div>
              <div className="flex-1">
                <div className="text-sm font-bold text-primary-navy dark:text-white">{fmt.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{fmt.desc}</div>
              </div>
              {exportFormat === fmt.id && <CheckCircle2 size={18} className="text-primary-navy dark:text-tertiary-sage shrink-0 mt-1" />}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 p-5 rounded-lg bg-slate-50 dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800">
          <div className="flex-1">
            <div className="text-sm font-bold text-primary-navy dark:text-white">仅管理员可操作</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">导出包包含所有业务数据，请妥善保管。</div>
          </div>
          <button type="button" onClick={exportData} disabled={exporting} className="btn-primary shadow-md disabled:opacity-60">
            <Download className="mr-2 h-4 w-4" />
            {exporting ? '正在导出...' : `立即导出`}
          </button>
          <button type="button" onClick={exportDataToFolder} disabled={exportingToFolder} className="rounded-lg border border-slate-200 bg-surface px-5 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-60 dark:border-navy-800 dark:bg-navy-900 dark:text-slate-300">
            <FolderOpen className="mr-2 inline h-4 w-4" />
            {exportingToFolder ? '正在导出...' : '选择文件夹导出'}
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-navy-800 pt-10">
        <div className="mb-6">
          <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
            <ShieldCheck className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
            自动备份
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">备份文件使用可还原 ZIP 格式，文件名自动带时间戳。</p>
        </div>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-surface p-5 dark:border-navy-800 dark:bg-navy-950">
          <label className="flex items-center gap-3 text-sm font-bold text-primary-navy dark:text-white">
            <input
              type="checkbox"
              checked={backupConfig.enabled}
              onChange={(e) => setBackupConfig({ ...backupConfig, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            启用自动备份
          </label>

          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-extrabold text-slate-500 dark:text-slate-400"><Folder size={14} /> 备份文件夹路径</span>
              <div className="flex gap-2">
                <input
                  value={backupConfig.directory}
                  onChange={(e) => setBackupConfig({ ...backupConfig, directory: e.target.value })}
                  placeholder="例如 /Users/xxx/Documents/CRM-Backups"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-primary-navy outline-none focus:border-primary-navy dark:border-navy-800 dark:bg-navy-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={pickBackupDirectory}
                  disabled={pickingDirectory}
                  className="shrink-0 rounded-lg border border-slate-200 bg-surface px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-60 dark:border-navy-800 dark:bg-navy-900 dark:text-slate-300"
                >
                  <FolderOpen className="mr-2 inline h-4 w-4" />
                  {pickingDirectory ? '选择中...' : '选择文件夹'}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-extrabold text-slate-500 dark:text-slate-400"><Clock size={14} /> 备份频率</span>
              <select
                value={backupConfig.intervalHours}
                onChange={(e) => setBackupConfig({ ...backupConfig, intervalHours: Number(e.target.value) as 1 | 2 | 24 })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-primary-navy outline-none focus:border-primary-navy dark:border-navy-800 dark:bg-navy-900 dark:text-white"
              >
                <option value={1}>每 1 小时</option>
                <option value={2}>每 2 小时</option>
                <option value={24}>每天</option>
              </select>
            </label>
          </div>

          <div className="rounded-lg bg-slate-50 p-4 text-xs font-medium leading-relaxed text-slate-500 dark:bg-navy-900 dark:text-slate-400">
            最近备份：{backupStatus.lastFile || '暂无'}
            {backupStatus.nextRunAt && <span className="ml-3">下次自动备份：{new Date(backupStatus.nextRunAt).toLocaleString()}</span>}
            {backupStatus.lastError && <div className="mt-2 font-bold text-red-500">上次错误：{backupStatus.lastError}</div>}
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={runBackupNow} disabled={backupRunning || backupStatus.running} className="rounded-lg border border-slate-200 bg-surface px-5 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-60 dark:border-navy-800 dark:bg-navy-900 dark:text-slate-300">
              <PlayCircle className="mr-2 inline h-4 w-4" />
              {backupRunning || backupStatus.running ? '正在备份...' : '立即备份'}
            </button>
            <button type="button" onClick={saveBackupConfig} disabled={backupSaving} className="btn-primary px-6 py-2 text-xs disabled:opacity-60">
              {backupSaving ? '正在保存...' : '保存设置'}
            </button>
          </div>
        </div>
      </div>

      {/* 数据恢复 */}
      <div className="border-t border-slate-200 dark:border-navy-800 pt-10">
        <div className="mb-6">
          <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
            <RotateCcw className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
            数据恢复
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">从系统可还原备份 ZIP 文件恢复全部业务数据。</p>
        </div>

        <input type="file" ref={restoreFileInputRef} className="hidden" accept=".zip" onChange={handleRestoreFileSelect} />

        {restoreError && (
          <div className="mb-4 rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400 font-bold flex items-start gap-3">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{restoreError}</span>
          </div>
        )}

        {restoreStep === 'idle' && (
          <button
            onClick={() => restoreFileInputRef.current?.click()}
            className="w-full flex items-start gap-4 p-5 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 hover:border-primary-navy transition-all text-left"
          >
            <div className="p-2 rounded-lg bg-primary-navy dark:bg-tertiary-sage text-white shrink-0">
              <RotateCcw size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-primary-navy dark:text-white mb-1">选择备份文件并恢复</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">选择通过"系统可还原备份"导出的 ZIP 文件进行数据恢复。恢复前请确认当前数据将被覆盖。</div>
            </div>
          </button>
        )}

        {restoreStep === 'previewing' && (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500 font-medium">
            <DatabaseBackup size={20} className="animate-pulse mr-3" />
            正在验证备份文件...
          </div>
        )}

        {restoreStep === 'confirming' && restorePreview && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <FileWarning size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-extrabold text-amber-800 dark:text-amber-300 mb-1">
                  {restorePreview.isRestorableBackup ? '确认恢复系统可还原备份' : '确认导入旧版 CSV 备份'}
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  {restorePreview.isRestorableBackup
                    ? '此操作将使用备份包中的数据覆盖当前系统的全部数据表。恢复完成后，当前数据将被备份中的数据替换。此操作不可撤销，请确认已做好当前数据的备份。'
                    : '此操作将导入备份中的客户和订单数据，匹配的记录将更新，新记录将新增。'}
                </div>
              </div>
            </div>

            {restorePreview.isRestorableBackup && restorePreview.backupMeta && (
              <div className="rounded-lg bg-white dark:bg-navy-900 border border-amber-100 dark:border-amber-900/20 p-4 space-y-2">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  <span className="text-slate-500">备份时间：<span className="font-bold text-slate-700 dark:text-slate-300">{restorePreview.backupMeta.createdAt ? new Date(restorePreview.backupMeta.createdAt).toLocaleString() : '未知'}</span></span>
                  <span className="text-slate-500">备份版本：<span className="font-bold text-slate-700 dark:text-slate-300">v{restorePreview.backupMeta.version || 1}</span></span>
                  <span className="text-slate-500">系统版本：<span className="font-bold text-slate-700 dark:text-slate-300">{restorePreview.backupMeta.appVersion || '未知'}</span></span>
                </div>
                {restorePreview.backupMeta.counts && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(restorePreview.backupMeta.counts as Record<string, number>).map(([table, count]) => (
                      <span key={table} className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/20 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                        {table} <span className="text-amber-600">({count})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!restorePreview.isRestorableBackup && restorePreview.entries && (
              <div className="rounded-lg bg-white dark:bg-navy-900 border border-amber-100 dark:border-amber-900/20 p-4">
                <div className="text-xs font-bold text-slate-500 mb-2">包含的数据文件：</div>
                <div className="flex flex-wrap gap-1.5">
                  {restorePreview.entries.filter((e: string) => e.endsWith('.csv')).map((e: string) => (
                    <span key={e} className="rounded bg-slate-100 dark:bg-navy-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">{e}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 px-4 py-3 flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs font-bold text-red-600 dark:text-red-400 leading-relaxed">
                <div className="mb-1">恢复操作不可撤销，将直接修改数据库。</div>
                <div>建议在恢复前先执行一次"立即备份"，保留当前数据快照。</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={resetRestore} className="rounded-lg border border-slate-200 bg-surface px-5 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 dark:border-navy-800 dark:bg-navy-900 dark:text-slate-300">
                取消
              </button>
              <button type="button" onClick={handleRestoreExecute} className="rounded-lg bg-red-600 px-6 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-red-700">
                确认恢复
              </button>
            </div>
          </div>
        )}

        {restoreStep === 'restoring' && (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500 font-medium">
            <RotateCcw size={20} className="animate-spin mr-3" />
            正在恢复数据，请勿关闭页面...
          </div>
        )}

        {restoreStep === 'done' && restoreResult && (
          <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 p-6 space-y-4">
            <div className={`flex items-start gap-3 ${restoreResult.errorCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {restoreResult.errorCount > 0 ? <AlertTriangle size={20} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={20} className="shrink-0 mt-0.5" />}
              <div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">数据恢复完成</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  成功恢复 <span className="font-extrabold text-emerald-600">{restoreResult.successCount}</span> 条记录
                  {restoreResult.errorCount > 0 && <span className="text-red-500">，<span className="font-extrabold">{restoreResult.errorCount}</span> 条失败</span>}
                </div>
              </div>
            </div>

            {restoreResult.restoredTables && (
              <div className="rounded-lg bg-slate-50 dark:bg-navy-900 p-4">
                <div className="text-[10px] font-extrabold text-slate-400 tracking-tight mb-2">各表恢复记录数</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(restoreResult.restoredTables as Record<string, number>).map(([table, count]) => (
                    <span key={table} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${count > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-navy-800 text-slate-400'}`}>
                      {table} <span>({count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {restoreResult.errors?.length > 0 && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/10 p-4 max-h-32 overflow-y-auto">
                <div className="text-[10px] font-extrabold text-red-500 mb-2">错误详情</div>
                <ul className="space-y-0.5">
                  {restoreResult.errors.map((err: string, i: number) => (
                    <li key={i} className="text-[11px] text-red-600 dark:text-red-400">{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={resetRestore} className="rounded-lg border border-slate-200 bg-surface px-5 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 dark:border-navy-800 dark:bg-navy-900 dark:text-slate-300">
                恢复其他备份
              </button>
              <button type="button" onClick={resetRestore} className="btn-primary px-6 py-2 text-xs">
                完成
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 安全提示 */}
      <div className="border-t border-slate-200 dark:border-navy-800 pt-6">
        <div className="rounded-lg bg-slate-50 dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800 p-4 flex items-start gap-3">
          <ShieldCheck size={16} className="text-slate-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-600 dark:text-slate-300">数据安全提醒：</span>
            备份文件包含完整的客户资料、订单、财务和附件数据。请将备份文件存储在安全位置，避免泄露。系统备份使用未加密的 ZIP 格式，传输或存储在外部设备时请注意数据安全。
          </div>
        </div>
      </div>
    </div>
  );
}
